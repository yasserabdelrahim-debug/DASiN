import { supabase } from './supabaseClient.js';
import { applyStaticTranslations, toggleLang } from './i18n.js';

applyStaticTranslations();
document.getElementById('langToggleBtn').addEventListener('click', toggleLang);

// صفحة التسجيل بتحدد المدرسة عن طريق ?school=dasin في الرابط.
// لو مفيش، بترجع لـdasin كافتراضي.
const params = new URLSearchParams(window.location.search);
const schoolSlug = params.get('school') || 'dasin';

const submitBtn = document.getElementById('submitRegBtn');
const messageEl = document.getElementById('regMessage');

submitBtn.addEventListener('click', async () => {
  messageEl.textContent = '';
  messageEl.className = '';

  const studentName = document.getElementById('regStudentName').value.trim();
  const guardianName = document.getElementById('regGuardianName').value.trim();
  const guardianEmail = document.getElementById('regGuardianEmail').value.trim();
  const guardianPhone = document.getElementById('regGuardianPhone').value.trim();

  if (!studentName || !guardianName || !guardianEmail) {
    messageEl.textContent = 'من فضلك املأ اسم الطالب، اسم ولي الأمر، والإيميل';
    messageEl.className = 'error';
    return;
  }

  // خطوة 1: نلاقي id المدرسة من الـslug (عبر الدالة الآمنة)
  const { data: schoolId, error: schoolError } = await supabase
    .rpc('school_id_by_slug', { p_slug: schoolSlug });

  if (schoolError || !schoolId) {
    messageEl.textContent = 'مقدرناش نتعرف على المدرسة — تأكد من الرابط';
    messageEl.className = 'error';
    return;
  }

  // خطوة 2: نبعت الطلب
  const { error: insertError } = await supabase
    .from('registrations')
    .insert({
      school_id: schoolId,
      student_name: studentName,
      guardian_name: guardianName,
      guardian_email: guardianEmail,
      guardian_phone: guardianPhone || null,
    });

  if (insertError) {
    messageEl.textContent = `حصل خطأ: ${insertError.message}`;
    messageEl.className = 'error';
    return;
  }

  messageEl.textContent = 'تم إرسال طلبك بنجاح، هنتواصل معاك قريبًا';
  messageEl.className = 'success';
  document.getElementById('registerForm').querySelectorAll('input').forEach(i => i.value = '');
});
