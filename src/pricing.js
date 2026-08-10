/* آخر-تحديث: 2026-08-10 17:50:24 */
// محرك حساب أسعار العائلة — مترجم بالظبط من familiePriser() في مدينة.
//
// القاعدة: الأعضاء بسعر شهري ثابت بلا خصم إخوة، وغير الأعضاء بسعر سنوي
// مع ترتيب تصاعدي حسب السعر — الخصم بيقع على الأرخص أولًا، فالأغلى (تاني
// وتالت طفل) بياخد الخصم الأكبر، عشان العيلة توفر أكتر. الأعضاء
// والمدارس المختلطة (بعض الإخوة أعضاء وبعضهم لأ) بتتحسب لوحدها.

import { supabase } from './supabaseClient.js';

export async function computeFamilyPrices(schoolId, guardianId, extraStudent) {
  const { data: settingsRows } = await supabase
    .from('pricing_settings')
    .select('sibling_discount_2_pct, sibling_discount_3_pct')
    .eq('school_id', schoolId)
    .limit(1);
  const settings = settingsRows?.[0] ?? { sibling_discount_2_pct: 0, sibling_discount_3_pct: 0 };

  const { data: links } = await supabase
    .from('guardian_students')
    .select('student_id, students(id, full_name, program_id, is_member, amount_paid)')
    .eq('guardian_id', guardianId);

  let children = (links ?? []).map(l => l.students).filter(Boolean);

  if (extraStudent) {
    children = children.filter(c => c.id !== extraStudent.id).concat([extraStudent]);
  }

  const programIds = [...new Set(children.map(c => c.program_id).filter(Boolean))];
  const { data: programs } = await supabase
    .from('programs')
    .select('id, monthly_price, yearly_price, months_count, material_fee')
    .in('id', programIds.length ? programIds : ['00000000-0000-0000-0000-000000000000']);

  const programById = Object.fromEntries((programs ?? []).map(p => [p.id, p]));
  const result = {};

  // الأعضاء: سعر شهري ثابت، بلا خصم إخوة، بلا ترتيب
  const members = children.filter(c => c.is_member);
  for (const c of members) {
    const p = programById[c.program_id];
    const teaching = p ? Math.round((p.monthly_price ?? 0) * (p.months_count ?? 1)) : 0;
    const material = p?.material_fee ?? 0;
    result[c.id] = {
      teaching, material, price: teaching + material,
      position: 1, isMember: true, missing: !p || !p.monthly_price,
    };
  }

  // غير الأعضاء: ترتيب تصاعدي بالسعر السنوي، وخصم على الطفل التاني والتالت
  const nonMembers = children.filter(c => !c.is_member)
    .map(c => ({ c, p: programById[c.program_id] }))
    .sort((a, b) => {
      const diff = (a.p?.yearly_price ?? 0) - (b.p?.yearly_price ?? 0);
      if (diff !== 0) return diff;
      return String(a.c.id).localeCompare(String(b.c.id));
    });

  nonMembers.forEach((row, i) => {
    const position = i + 1;
    const p = row.p;
    let teaching = p?.yearly_price ?? 0;
    if (position === 2) teaching = Math.round(teaching * (1 - settings.sibling_discount_2_pct / 100));
    else if (position >= 3) teaching = Math.round(teaching * (1 - settings.sibling_discount_3_pct / 100));
    const material = p?.material_fee ?? 0;
    result[row.c.id] = {
      teaching, material, price: teaching + material,
      position, isMember: false, missing: !p || !p.yearly_price,
    };
  });

  return result;
}

// هل بعض إخوة العيلة أعضاء وبعضهم لأ؟ ده افتراض مكسور — العضوية قرار
// عيلة، مش طفل لوحده — فالحساب بيبقى مبني على افتراض غلط.
export async function hasMixedMembership(schoolId, guardianId) {
  const { data: links } = await supabase
    .from('guardian_students')
    .select('students(is_member)')
    .eq('guardian_id', guardianId);
  const flags = (links ?? []).map(l => l.students?.is_member).filter(v => v !== undefined);
  if (flags.length < 2) return false;
  const memberCount = flags.filter(Boolean).length;
  return memberCount > 0 && memberCount < flags.length;
}

// إعادة حساب أسعار عيلة كاملة، وتحديث المطلوب فعليًا في القاعدة.
// بتتخطى أي طالب دفع جزء من المبلغ فعلًا (منعًا لتغيير رقم اتفق عليه)،
// وبترجع تقرير واضح: مين اتغيّر، مين اتخطّى، ومين فشل وليه — مش رقم
// أعمى زي "0 اتغيروا" من غير سبب (درس §0 من مدينة).
export async function recomputeFamily(schoolId, guardianId) {
  const prices = await computeFamilyPrices(schoolId, guardianId);

  const { data: links } = await supabase
    .from('guardian_students')
    .select('students(id, full_name, amount_due, amount_paid, sibling_order)')
    .eq('guardian_id', guardianId);

  const children = (links ?? []).map(l => l.students).filter(Boolean);

  const report = { changed: [], skipped: [], failed: [] };

  for (const child of children) {
    const p = prices[child.id];
    if (!p || !p.price) continue;

    const oldAmount = Math.round(child.amount_due ?? 0);
    const newAmount = Math.round(p.price);
    if (oldAmount === newAmount && String(child.sibling_order ?? '') === String(p.position)) continue;

    if ((child.amount_paid ?? 0) > 0) {
      report.skipped.push(child.full_name);
      continue;
    }

    const { error } = await supabase
      .from('students')
      .update({ amount_due: newAmount, sibling_order: p.position })
      .eq('id', child.id);

    if (error) {
      report.failed.push({ name: child.full_name, message: error.message });
    } else {
      report.changed.push(child.full_name);
    }
  }

  return report;
}

// كل الطلاب اللي المبلغ المحفوظ عندهم مش متطابق مع قاعدة التسعير
// الحالية — عشان اللوحة بتحسب لحظيًا لكن البوابة بتقرا المخزّن، والاتنين
// ممكن يتفرقوا من غير ما حد ياخد باله (درس §54).
export async function findMismatchedStudents(schoolId) {
  const { data: allLinks } = await supabase
    .from('guardian_students')
    .select('guardian_id, students(id, full_name, amount_due, amount_paid, is_member)')
    .eq('school_id', schoolId);

  const byGuardian = {};
  for (const link of allLinks ?? []) {
    if (!byGuardian[link.guardian_id]) byGuardian[link.guardian_id] = [];
    byGuardian[link.guardian_id].push(link.students);
  }

  const mismatches = [];
  for (const guardianId of Object.keys(byGuardian)) {
    const prices = await computeFamilyPrices(schoolId, guardianId);
    for (const child of byGuardian[guardianId]) {
      if (!child) continue;
      const p = prices[child.id];
      if (!p || !p.price) continue;
      const stored = Math.round(child.amount_due ?? 0);
      if (stored === Math.round(p.price)) continue;
      mismatches.push({
        studentId: child.id,
        name: child.full_name,
        stored,
        correct: Math.round(p.price),
        alreadyPaid: (child.amount_paid ?? 0) > 0,
      });
    }
  }
  return mismatches;
}