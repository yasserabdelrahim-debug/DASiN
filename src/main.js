/* آخر-تحديث: 2026-08-10 19:08:41 */
import { supabase } from './supabaseClient.js';
import { applyStaticTranslations, toggleLang, t } from './i18n.js';
import { recomputeFamily, findMismatchedStudents } from './pricing.js';

applyStaticTranslations();
document.getElementById('langToggleBtn').addEventListener('click', () => {
  toggleLang();
  // إعادة رسم أي نص ديناميكي معروض حاليًا (زي حالة الاتصال) باللغة الجديدة
  setBadge(statusBadge.classList.contains('badge-ok') ? 'ok' : 'error', null);
});

const statusBadge = document.getElementById('statusBadge');
const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginError = document.getElementById('loginError');
const schoolNameEl = document.getElementById('schoolName');
const studentsList = document.getElementById('studentsList');

let currentSchoolId = null;
let currentClasses = [];

function setBadge(state, text) {
  statusBadge.className = `badge badge-${state}`;
  statusBadge.textContent = text ?? t(state === 'ok' ? 'statusConnected' : state === 'error' ? 'statusError' : 'statusConnecting');
}

let connectionTimeout = setTimeout(() => {
  setBadge('error');
}, 8000);

async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  clearTimeout(connectionTimeout);
  setBadge('ok');

  if (session) {
    await routeAfterLogin();
  } else {
    showLogin();
  }
}

function showLogin() {
  loginView.hidden = false;
  dashboardView.hidden = true;
  document.getElementById('parentView').hidden = true;
}

async function routeAfterLogin() {
  const { data: members } = await supabase
    .from('school_members')
    .select('school_id, schools(name)')
    .limit(1);

  if (members && members.length > 0) {
    await showDashboard(members);
    return;
  }

  const { data: guardianLinks } = await supabase
    .from('guardian_students')
    .select('school_id, schools(name)')
    .limit(1);

  if (guardianLinks && guardianLinks.length > 0) {
    await showParentView(guardianLinks);
    return;
  }

  // لا موظف ولا ولي أمر — حساب مش مربوط بأي مدرسة
  loginView.hidden = false;
  dashboardView.hidden = true;
  document.getElementById('parentView').hidden = true;
  loginError.textContent = t('noAccountLinked');
}

async function showDashboard(members) {
  loginView.hidden = true;
  dashboardView.hidden = false;
  document.getElementById('parentView').hidden = true;

  currentSchoolId = members[0].school_id;
  schoolNameEl.textContent = members[0].schools?.name ?? '؟';

  await loadClasses();
  await loadStudentsTab();
}

async function showParentView(guardianLinks) {
  loginView.hidden = true;
  dashboardView.hidden = true;
  const parentView = document.getElementById('parentView');
  parentView.hidden = false;

  document.getElementById('parentSchoolName').textContent = guardianLinks[0].schools?.name ?? '؟';

  const { data: links, error } = await supabase
    .from('guardian_students')
    .select('student_id, students(id, full_name, is_member)');

  const listEl = document.getElementById('childrenList');

  if (error || !links || links.length === 0) {
    listEl.innerHTML = '<p class="muted">مفيش أبناء مربوطين بحسابك لسه</p>';
    return;
  }

  listEl.innerHTML = '';
  for (const link of links) {
    const child = link.students;
    if (!child) continue;

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>${child.full_name}${child.is_member ? ' (عضو)' : ''}</h3>
      <div class="muted">الحضور الأخير</div>
      <div data-attendance-list></div>
      <div class="muted">الواجبات</div>
      <div data-homework-list></div>
    `;
    listEl.appendChild(card);

    const { data: attendance } = await supabase
      .from('attendance')
      .select('date, status')
      .eq('student_id', child.id)
      .order('date', { ascending: false })
      .limit(5);

    const attEl = card.querySelector('[data-attendance-list]');
    attEl.innerHTML = attendance && attendance.length > 0
      ? attendance.map(a => `<div class="muted">${a.date}: ${a.status}</div>`).join('')
      : '<div class="muted">مفيش سجل حضور لسه</div>';

    const { data: homeworkRows } = await supabase
      .from('homework')
      .select('title, due_date')
      .order('created_at', { ascending: false })
      .limit(5);

    const hwEl = card.querySelector('[data-homework-list]');
    hwEl.innerHTML = homeworkRows && homeworkRows.length > 0
      ? homeworkRows.map(h => `<div class="muted">${h.title}${h.due_date ? ' — تسليم: ' + h.due_date : ''}</div>`).join('')
      : '<div class="muted">مفيش واجبات لسه</div>';
  }
}

document.getElementById('parentLogoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  showLogin();
});

async function loadClasses() {
  const { data, error } = await supabase.from('classes').select('id, name');
  currentClasses = error ? [] : (data ?? []);

  const attSelect = document.getElementById('attClassSelect');
  const hwSelect = document.getElementById('hwClassSelect');
  const optionsHtml =
    '<option value="">-- اختر فصل --</option>' +
    currentClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  attSelect.innerHTML = optionsHtml;
  hwSelect.innerHTML = optionsHtml;
}

// ------------------------- تبويب الطلاب -------------------------

async function loadStudentsTab() {
  const { data: students, error } = await supabase
    .from('students')
    .select('id, full_name, is_member, is_paid, amount_due, amount_paid');

  if (error) {
    studentsList.innerHTML = `<p class="error">خطأ في تحميل الطلاب: ${error.message}</p>`;
    return;
  }

  if (!students || students.length === 0) {
    studentsList.innerHTML = '<p class="muted">مفيش طلاب مسجلين لسه</p>';
    return;
  }

  studentsList.innerHTML = '';
  for (const s of students) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <strong>${s.full_name}${s.is_member ? ' (عضو)' : ''}</strong>
      <div class="muted">المطلوب: ${s.amount_due ?? 0} — المدفوع: <span data-paid-display>${s.amount_paid ?? 0}</span></div>
      <div class="inline-group">
        <input type="number" data-amount-input value="${s.amount_paid ?? 0}" />
        <button data-save-payment class="small-btn">حفظ الدفع</button>
      </div>
    `;

    card.querySelector('[data-save-payment]').addEventListener('click', async () => {
      const newAmount = Number(card.querySelector('[data-amount-input]').value);
      const { error: updateError } = await supabase
        .from('students')
        .update({ amount_paid: newAmount, is_paid: newAmount >= (s.amount_due ?? 0) })
        .eq('id', s.id);

      if (updateError) {
        alert(`فشل الحفظ: ${updateError.message}`);
        return;
      }
      card.querySelector('[data-paid-display]').textContent = newAmount;
    });

    studentsList.appendChild(card);
  }
}

// ------------------------- تبويب الحضور -------------------------

async function loadAttendanceTab() {
  const attDate = document.getElementById('attDate');
  if (!attDate.value) {
    attDate.value = new Date().toISOString().slice(0, 10);
  }
  await renderAttendanceList();
}

async function renderAttendanceList() {
  const classId = document.getElementById('attClassSelect').value;
  const date = document.getElementById('attDate').value;
  const listEl = document.getElementById('attStudentsList');
  const msgEl = document.getElementById('attMessage');
  msgEl.textContent = '';

  if (!classId) {
    listEl.innerHTML = '<p class="muted">اختر فصل الأول</p>';
    return;
  }

  const { data: students, error } = await supabase
    .from('students')
    .select('id, full_name')
    .eq('class_id', classId);

  if (error) {
    listEl.innerHTML = `<p class="error">${error.message}</p>`;
    return;
  }

  if (!students || students.length === 0) {
    listEl.innerHTML = '<p class="muted">مفيش طلاب في الفصل ده</p>';
    return;
  }

  listEl.innerHTML = '';
  for (const s of students) {
    const row = document.createElement('div');
    row.className = 'card inline-group';
    row.innerHTML = `
      <span style="flex:1">${s.full_name}</span>
      <button data-status="present" class="small-btn">حاضر</button>
      <button data-status="late" class="small-btn">متأخر</button>
      <button data-status="absent" class="small-btn">غائب</button>
    `;
    row.querySelectorAll('[data-status]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { error: upsertError } = await supabase
          .from('attendance')
          .upsert(
            {
              school_id: currentSchoolId,
              student_id: s.id,
              class_id: classId,
              date,
              status: btn.dataset.status,
            },
            { onConflict: 'student_id,date' }
          );
        msgEl.textContent = upsertError
          ? `فشل تسجيل الحضور: ${upsertError.message}`
          : `اتسجل حضور ${s.full_name}: ${btn.dataset.status}`;
        msgEl.className = upsertError ? 'error' : 'success';
      });
    });
    listEl.appendChild(row);
  }
}

document.getElementById('attClassSelect').addEventListener('change', renderAttendanceList);
document.getElementById('attDate').addEventListener('change', renderAttendanceList);

// ------------------------- تبويب الواجبات -------------------------

async function loadHomeworkTab() {
  await renderHomeworkList();
}

async function renderHomeworkList() {
  const listEl = document.getElementById('homeworkList');
  const { data, error } = await supabase
    .from('homework')
    .select('id, title, due_date, classes(name)')
    .order('created_at', { ascending: false });

  if (error) {
    listEl.innerHTML = `<p class="error">${error.message}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    listEl.innerHTML = '<p class="muted">مفيش واجبات مضافة لسه</p>';
    return;
  }

  listEl.innerHTML = data
    .map(h => `
      <div class="card">
        <strong>${h.title}</strong>
        <div class="muted">${h.classes?.name ?? ''} — تسليم: ${h.due_date ?? 'مفيش موعد'}</div>
      </div>
    `)
    .join('');
}

document.getElementById('hwAddBtn').addEventListener('click', async () => {
  const classId = document.getElementById('hwClassSelect').value;
  const title = document.getElementById('hwTitle').value.trim();
  const dueDate = document.getElementById('hwDueDate').value || null;

  if (!classId || !title) {
    alert('اختر فصل واكتب عنوان الواجب');
    return;
  }

  const { error } = await supabase
    .from('homework')
    .insert({ school_id: currentSchoolId, class_id: classId, title, due_date: dueDate });

  if (error) {
    alert(`فشلت الإضافة: ${error.message}`);
    return;
  }

  document.getElementById('hwTitle').value = '';
  await renderHomeworkList();
});

// ------------------------- تبويب الطلبات (القبول) -------------------------

async function loadRegistrationsTab() {
  const listEl = document.getElementById('registrationsList');
  const { data, error } = await supabase
    .from('registrations')
    .select('id, student_name, guardian_name, guardian_email, guardian_phone, program_id, status')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    listEl.innerHTML = `<p class="error">${error.message}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    listEl.innerHTML = '<p class="muted">مفيش طلبات جديدة</p>';
    return;
  }

  listEl.innerHTML = '';
  for (const reg of data) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <strong>${reg.student_name}</strong>
      <div class="muted">ولي الأمر: ${reg.guardian_name} — ${reg.guardian_email}${reg.guardian_phone ? ' — ' + reg.guardian_phone : ''}</div>
      <div class="inline-group">
        <button data-approve class="small-btn">قبول</button>
        <button data-reject class="small-btn">رفض</button>
      </div>
      <p data-msg class="muted"></p>
    `;

    card.querySelector('[data-approve]').addEventListener('click', async () => {
      // درس §50 من مدينة: مبنبنيش الطالب بنسخ الطلب كامل (حاجة زي
      // {...reg})، عشان الـid بتاع الطلب ميدوسش على id الطالب الجديد.
      // بنبني سطر جديد صريح، كل حقل لوحده.
      const { error: insertError } = await supabase
        .from('students')
        .insert({
          school_id: currentSchoolId,
          program_id: reg.program_id,
          full_name: reg.student_name,
          is_member: false,
        });

      if (insertError) {
        card.querySelector('[data-msg]').textContent = `فشل القبول: ${insertError.message}`;
        return;
      }

      const { error: updateError } = await supabase
        .from('registrations')
        .update({ status: 'approved' })
        .eq('id', reg.id);

      if (updateError) {
        card.querySelector('[data-msg]').textContent = `الطالب اتضاف بس فشل تحديث حالة الطلب: ${updateError.message}`;
        return;
      }

      card.remove();
    });

    card.querySelector('[data-reject]').addEventListener('click', async () => {
      const { error: rejectError } = await supabase
        .from('registrations')
        .update({ status: 'rejected' })
        .eq('id', reg.id);

      if (rejectError) {
        card.querySelector('[data-msg]').textContent = `فشل الرفض: ${rejectError.message}`;
        return;
      }
      card.remove();
    });

    listEl.appendChild(card);
  }
}

// ------------------------- تبويب البرامج -------------------------

async function loadProgramsTab() {
  const listEl = document.getElementById('programsList');
  const { data, error } = await supabase
    .from('programs')
    .select('id, name, pricing_model, monthly_price, yearly_price, sibling_discount_pct');

  if (error) {
    listEl.innerHTML = `<p class="error">${error.message}</p>`;
    return;
  }

  listEl.innerHTML = (data ?? [])
    .map(p => `
      <div class="card">
        <strong>${p.name}</strong>
        <div class="muted">
          ${p.pricing_model === 'member' ? 'عضو (شهري): ' + (p.monthly_price ?? 0) + ' كل شهر' : 'غير عضو (سنوي): ' + (p.yearly_price ?? 0) + ' في السنة'}
          ${p.sibling_discount_pct ? ' — خصم إخوة ' + p.sibling_discount_pct + '%' : ''}
        </div>
      </div>
    `)
    .join('') || '<p class="muted">مفيش برامج مضافة لسه</p>';
}

document.getElementById('progAddBtn').addEventListener('click', async () => {
  const name = document.getElementById('progName').value.trim();
  const model = document.getElementById('progModel').value;
  const price = Number(document.getElementById('progPrice').value);

  if (!name || !price) {
    alert('اكتب اسم البرنامج والسعر');
    return;
  }

  const payload = {
    school_id: currentSchoolId,
    name,
    pricing_model: model,
    monthly_price: model === 'member' ? price : null,
    yearly_price: model === 'non_member' ? price : null,
  };

  const { error } = await supabase.from('programs').insert(payload);

  if (error) {
    alert(`فشلت الإضافة: ${error.message}`);
    return;
  }

  document.getElementById('progName').value = '';
  document.getElementById('progPrice').value = '';
  await loadProgramsTab();
});

// ------------------------- تبويب سجل الحذف -------------------------

async function loadDeletionsTab() {
  const listEl = document.getElementById('deletionsList');
  const { data, error } = await supabase
    .from('deletion_log')
    .select('id, table_name, record_data, deleted_at')
    .order('deleted_at', { ascending: false })
    .limit(20);

  if (error) {
    listEl.innerHTML = `<p class="error">${error.message}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    listEl.innerHTML = '<p class="muted">مفيش حذف حصل لسه</p>';
    return;
  }

  const tableLabels = {
    students: 'طالب',
    teachers: 'معلم',
    homework: 'واجب',
    registrations: 'طلب تسجيل',
  };

  listEl.innerHTML = data
    .map(d => {
      const name = d.record_data?.full_name || d.record_data?.title || d.record_data?.student_name || '(بلا اسم)';
      return `
        <div class="card">
          <strong>${tableLabels[d.table_name] ?? d.table_name}: ${name}</strong>
          <div class="muted">اتمسح في: ${new Date(d.deleted_at).toLocaleString('ar-EG')}</div>
        </div>
      `;
    })
    .join('');
}

// ------------------------- تبويب النشاط -------------------------

async function loadActivityTab() {
  const listEl = document.getElementById('activityList');

  const { data: staff, error: staffError } = await supabase
    .from('school_members')
    .select('last_login_at, roles(name)');

  const { data: guardians, error: guardianError } = await supabase
    .from('guardian_students')
    .select('last_login_at, students(full_name)');

  if (staffError || guardianError) {
    listEl.innerHTML = `<p class="error">${(staffError || guardianError).message}</p>`;
    return;
  }

  let html = '<h3>الموظفين</h3>';
  html += (staff ?? [])
    .map(s => `
      <div class="card">
        <strong>${s.roles?.name ?? '؟'}</strong>
        <div class="muted">آخر دخول: ${s.last_login_at ? new Date(s.last_login_at).toLocaleString('ar-EG') : 'مادخلش لسه'}</div>
      </div>
    `)
    .join('') || '<p class="muted">مفيش موظفين</p>';

  html += '<h3>أولياء الأمور</h3>';
  html += (guardians ?? [])
    .map(g => `
      <div class="card">
        <strong>ولي أمر ${g.students?.full_name ?? '؟'}</strong>
        <div class="muted">آخر دخول: ${g.last_login_at ? new Date(g.last_login_at).toLocaleString('ar-EG') : 'مادخلش لسه'}</div>
      </div>
    `)
    .join('') || '<p class="muted">مفيش أولياء أمور مربوطين</p>';

  listEl.innerHTML = html;
}

// ------------------------- تبويب الأسعار -------------------------

async function loadPricingTab() {
  const { data: rows } = await supabase
    .from('pricing_settings')
    .select('sibling_discount_2_pct, sibling_discount_3_pct')
    .eq('school_id', currentSchoolId)
    .limit(1);

  const settings = rows?.[0];
  document.getElementById('discount2Input').value = settings?.sibling_discount_2_pct ?? 0;
  document.getElementById('discount3Input').value = settings?.sibling_discount_3_pct ?? 0;
  document.getElementById('mismatchList').innerHTML = '';
}

document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  const d2 = Number(document.getElementById('discount2Input').value);
  const d3 = Number(document.getElementById('discount3Input').value);
  const msgEl = document.getElementById('settingsMsg');

  if (d2 > 18 || d3 > 18) {
    msgEl.textContent = 'السقف الأقصى لأي خصم هو 18% — عشان العضوية تفضل دايمًا أوفر (زي §37)';
    msgEl.className = 'error';
    return;
  }

  const { error } = await supabase
    .from('pricing_settings')
    .update({ sibling_discount_2_pct: d2, sibling_discount_3_pct: d3, updated_at: new Date().toISOString() })
    .eq('school_id', currentSchoolId);

  msgEl.textContent = error ? `فشل الحفظ: ${error.message}` : '✓ اتحفظ';
  msgEl.className = error ? 'error' : 'success';
});

document.getElementById('checkMismatchBtn').addEventListener('click', async () => {
  const listEl = document.getElementById('mismatchList');
  listEl.innerHTML = '<p class="muted">جاري الفحص...</p>';

  const mismatches = await findMismatchedStudents(currentSchoolId);

  if (mismatches.length === 0) {
    listEl.innerHTML = '<p class="muted">كل المبالغ متطابقة مع قاعدة التسعير الحالية</p>';
    return;
  }

  listEl.innerHTML = '';
  for (const m of mismatches) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <strong>${m.name}</strong>
      <div class="muted">المحفوظ: ${m.stored} — الصحيح: ${m.correct}${m.alreadyPaid ? ' — دفع جزء بالفعل (لن يتغير تلقائي)' : ''}</div>
    `;
    listEl.appendChild(card);
  }
});

// ------------------------- أولياء الأمور -------------------------

async function loadGuardiansTab() {
  const { data, error } = await supabase
    .from('guardians')
    .select('id, full_name, phone, email')
    .order('created_at', { ascending: false });

  const listEl = document.getElementById('guardiansList');
  if (error) { listEl.innerHTML = `<p class="error">${error.message}</p>`; return; }
  listEl.innerHTML = (data ?? []).map(g => `
    <div class="card">
      <strong>${g.full_name}</strong>
      <div class="muted">${g.phone ?? ''} ${g.email ? '— ' + g.email : ''}</div>
    </div>
  `).join('') || '<p class="muted">مفيش أولياء أمور مسجلين لسه</p>';
}

document.getElementById('gAddBtn').addEventListener('click', async () => {
  const full_name = document.getElementById('gName').value.trim();
  const phone = document.getElementById('gPhone').value.trim();
  const email = document.getElementById('gEmail').value.trim();
  if (!full_name) { alert('اكتب الاسم'); return; }
  const { error } = await supabase.from('guardians').insert({ school_id: currentSchoolId, full_name, phone: phone || null, email: email || null });
  if (error) { alert(error.message); return; }
  document.getElementById('gName').value = '';
  document.getElementById('gPhone').value = '';
  document.getElementById('gEmail').value = '';
  await loadGuardiansTab();
});

// ------------------------- التقويم -------------------------

async function loadCalendarTab() {
  const { data, error } = await supabase
    .from('school_calendar')
    .select('id, description, from_date, to_date')
    .order('from_date', { ascending: true });

  const listEl = document.getElementById('calendarList');
  if (error) { listEl.innerHTML = `<p class="error">${error.message}</p>`; return; }
  listEl.innerHTML = (data ?? []).map(c => `
    <div class="card">
      <strong>${c.description}</strong>
      <div class="muted">${c.from_date}${c.to_date && c.to_date !== c.from_date ? ' — ' + c.to_date : ''}</div>
    </div>
  `).join('') || '<p class="muted">مفيش أحداث مضافة لسه</p>';
}

document.getElementById('calAddBtn').addEventListener('click', async () => {
  const description = document.getElementById('calDesc').value.trim();
  const from_date = document.getElementById('calFrom').value;
  const to_date = document.getElementById('calTo').value || null;
  if (!description || !from_date) { alert('اكتب الوصف والتاريخ'); return; }
  const { error } = await supabase.from('school_calendar').insert({ school_id: currentSchoolId, description, from_date, to_date });
  if (error) { alert(error.message); return; }
  document.getElementById('calDesc').value = '';
  await loadCalendarTab();
});

// ------------------------- الإعلانات -------------------------

async function loadAnnouncementsTab() {
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, body, created_at')
    .order('created_at', { ascending: false });

  const listEl = document.getElementById('announcementsList');
  if (error) { listEl.innerHTML = `<p class="error">${error.message}</p>`; return; }
  listEl.innerHTML = (data ?? []).map(a => `
    <div class="card">
      <strong>${a.title}</strong>
      <div class="muted">${a.body ?? ''}</div>
    </div>
  `).join('') || '<p class="muted">مفيش إعلانات لسه</p>';
}

document.getElementById('annAddBtn').addEventListener('click', async () => {
  const title = document.getElementById('annTitle').value.trim();
  const body = document.getElementById('annBody').value.trim();
  if (!title) { alert('اكتب عنوان'); return; }
  const { error } = await supabase.from('announcements').insert({ school_id: currentSchoolId, title, body: body || null });
  if (error) { alert(error.message); return; }
  document.getElementById('annTitle').value = '';
  document.getElementById('annBody').value = '';
  await loadAnnouncementsTab();
});

// ------------------------- الاجتماعات -------------------------

async function loadMeetingsTab() {
  const { data, error } = await supabase
    .from('meetings')
    .select('id, title, date, minutes')
    .order('date', { ascending: false });

  const listEl = document.getElementById('meetingsList');
  if (error) { listEl.innerHTML = `<p class="error">${error.message}</p>`; return; }
  listEl.innerHTML = (data ?? []).map(m => `
    <div class="card">
      <strong>${m.title}</strong>
      <div class="muted">${m.date ?? ''}</div>
      ${m.minutes ? `<div class="muted">${m.minutes}</div>` : ''}
    </div>
  `).join('') || '<p class="muted">مفيش محاضر اجتماعات لسه</p>';
}

document.getElementById('meetAddBtn').addEventListener('click', async () => {
  const title = document.getElementById('meetTitle').value.trim();
  const date = document.getElementById('meetDate').value || null;
  const minutes = document.getElementById('meetMinutes').value.trim();
  if (!title) { alert('اكتب عنوان الاجتماع'); return; }
  const { error } = await supabase.from('meetings').insert({ school_id: currentSchoolId, title, date, minutes: minutes || null });
  if (error) { alert(error.message); return; }
  document.getElementById('meetTitle').value = '';
  document.getElementById('meetMinutes').value = '';
  await loadMeetingsTab();
});

// ------------------------- المالية العامة -------------------------

async function loadFinancesTab() {
  const { data, error } = await supabase
    .from('finances')
    .select('id, date, entry_type, amount, description')
    .order('date', { ascending: false });

  const listEl = document.getElementById('financesList');
  if (error) { listEl.innerHTML = `<p class="error">${error.message}</p>`; return; }
  listEl.innerHTML = (data ?? []).map(f => `
    <div class="card">
      <strong>${f.entry_type === 'income' ? 'إيراد' : 'مصروف'}: ${f.amount}</strong>
      <div class="muted">${f.date} — ${f.description ?? ''}</div>
    </div>
  `).join('') || '<p class="muted">مفيش قيود مالية لسه</p>';
}

document.getElementById('finAddBtn').addEventListener('click', async () => {
  const date = document.getElementById('finDate').value;
  const entry_type = document.getElementById('finType').value;
  const amount = Number(document.getElementById('finAmount').value);
  const description = document.getElementById('finDesc').value.trim();
  if (!date || !amount) { alert('اكتب التاريخ والمبلغ'); return; }
  const { error } = await supabase.from('finances').insert({ school_id: currentSchoolId, date, entry_type, amount, description: description || null });
  if (error) { alert(error.message); return; }
  document.getElementById('finAmount').value = '';
  document.getElementById('finDesc').value = '';
  await loadFinancesTab();
});

// ------------------------- ملاحظات الطلاب -------------------------

async function loadNotesTab() {
  const { data: students } = await supabase.from('students').select('id, full_name');
  const sel = document.getElementById('noteStudentSelect');
  sel.innerHTML = (students ?? []).map(s => `<option value="${s.id}">${s.full_name}</option>`).join('');
  await renderNotesForSelectedStudent();
}

async function renderNotesForSelectedStudent() {
  const studentId = document.getElementById('noteStudentSelect').value;
  const listEl = document.getElementById('notesListForStudent');
  if (!studentId) { listEl.innerHTML = ''; return; }

  const { data, error } = await supabase
    .from('student_notes')
    .select('id, note, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) { listEl.innerHTML = `<p class="error">${error.message}</p>`; return; }
  listEl.innerHTML = (data ?? []).map(n => `
    <div class="card">
      <div>${n.note}</div>
      <div class="muted">${new Date(n.created_at).toLocaleDateString('ar-EG')}</div>
    </div>
  `).join('') || '<p class="muted">مفيش ملاحظات لسه</p>';
}

document.getElementById('noteStudentSelect').addEventListener('change', renderNotesForSelectedStudent);

document.getElementById('noteAddBtn').addEventListener('click', async () => {
  const studentId = document.getElementById('noteStudentSelect').value;
  const note = document.getElementById('noteText').value.trim();
  if (!studentId || !note) { alert('اختار طالب واكتب ملاحظة'); return; }
  const { error } = await supabase.from('student_notes').insert({ school_id: currentSchoolId, student_id: studentId, note });
  if (error) { alert(error.message); return; }
  document.getElementById('noteText').value = '';
  await renderNotesForSelectedStudent();
});



// ------------------------- التبويبات -------------------------

document.querySelectorAll('.category-tabs button').forEach(catBtn => {
  catBtn.addEventListener('click', () => {
    document.querySelectorAll('.category-tabs button').forEach(b => b.classList.remove('active'));
    catBtn.classList.add('active');

    document.querySelectorAll('nav.tabs[data-category-group]').forEach(group => {
      group.hidden = group.dataset.categoryGroup !== catBtn.dataset.category;
    });

    const activeGroup = document.querySelector(`nav.tabs[data-category-group="${catBtn.dataset.category}"]`);
    const firstTabBtn = activeGroup.querySelector('button');
    if (firstTabBtn) {
      firstTabBtn.click();
    } else {
      // قسم لسه مفيهوش شاشات مبنية (زي "الموظفين" دلوقتي) — نخفي كل
      // اللوحات، بدل ما نسيب آخر تبويب من قسم تاني ظاهر بالغلط
      document.querySelectorAll('.tabPanel').forEach(p => (p.hidden = true));
    }
  });
});

document.querySelectorAll('nav.tabs button').forEach(btn => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('nav.tabs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    document.querySelectorAll('.tabPanel').forEach(p => (p.hidden = true));
    const panel = document.getElementById(
      'tab' + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)
    );
    panel.hidden = false;

    if (btn.dataset.tab === 'students') await loadStudentsTab();
    if (btn.dataset.tab === 'registrations') await loadRegistrationsTab();
    if (btn.dataset.tab === 'attendance') await loadAttendanceTab();
    if (btn.dataset.tab === 'homework') await loadHomeworkTab();
    if (btn.dataset.tab === 'programs') await loadProgramsTab();
    if (btn.dataset.tab === 'deletions') await loadDeletionsTab();
    if (btn.dataset.tab === 'activity') await loadActivityTab();
    if (btn.dataset.tab === 'pricing') await loadPricingTab();
    if (btn.dataset.tab === 'guardians') await loadGuardiansTab();
    if (btn.dataset.tab === 'calendar') await loadCalendarTab();
    if (btn.dataset.tab === 'announcements') await loadAnnouncementsTab();
    if (btn.dataset.tab === 'meetings') await loadMeetingsTab();
    if (btn.dataset.tab === 'finances') await loadFinancesTab();
    if (btn.dataset.tab === 'notes') await loadNotesTab();
  });
});

// ------------------------- الدخول/الخروج -------------------------

loginBtn.addEventListener('click', async () => {
  loginError.textContent = '';
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    loginError.textContent = error.message;
    return;
  }

  await supabase.rpc('update_my_last_login');
  await routeAfterLogin();
});

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  showLogin();
});

init();