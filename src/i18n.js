// نظام لغتين بسيط: عربي (افتراضي) ونرويجي. الاختيار بيتحفظ في المتصفح.

export const translations = {
  ar: {
    statusConnecting: 'جاري الاتصال...',
    statusConnected: 'متصل',
    statusError: 'مفيش رد من القاعدة — تأكد من إعدادات .env',
    loginTitle: 'تسجيل الدخول',
    emailPlaceholder: 'الإيميل',
    passwordPlaceholder: 'الباسورد',
    loginBtn: 'دخول',
    logoutBtn: 'خروج',
    dashboardPrefix: 'لوحة',
    tabStudents: 'الطلاب',
    tabRegistrations: 'الطلبات',
    tabAttendance: 'الحضور',
    tabHomework: 'الواجبات',
    tabPrograms: 'البرامج',
    tabDeletions: 'سجل الحذف',
    tabActivity: 'النشاط',
    hwTitlePlaceholder: 'عنوان الواجب',
    hwAddBtn: 'إضافة واجب',
    progNamePlaceholder: 'اسم البرنامج',
    addProgramHeading: 'إضافة برنامج جديد',
    progModelMember: 'عضو (شهري)',
    progModelNonMember: 'غير عضو (سنوي)',
    progPricePlaceholder: 'السعر',
    progAddBtn: 'إضافة',
    parentPortalPrefix: 'بوابة أولياء الأمور —',
    registerTitle: 'استمارة التسجيل',
    regStudentNamePlaceholder: 'اسم الطالب',
    regGuardianNamePlaceholder: 'اسم ولي الأمر',
    regGuardianEmailPlaceholder: 'إيميل ولي الأمر',
    regGuardianPhonePlaceholder: 'تليفون ولي الأمر (اختياري)',
    submitRegBtn: 'إرسال الطلب',
    langToggle: 'Norsk',
    noAccountLinked: 'الحساب ده مش مربوط بأي مدرسة لسه',
  },
  no: {
    statusConnecting: 'Kobler til...',
    statusConnected: 'Tilkoblet',
    statusError: 'Ingen respons fra databasen — sjekk .env-innstillingene',
    loginTitle: 'Logg inn',
    emailPlaceholder: 'E-post',
    passwordPlaceholder: 'Passord',
    loginBtn: 'Logg inn',
    logoutBtn: 'Logg ut',
    dashboardPrefix: 'Panel',
    tabStudents: 'Elever',
    tabRegistrations: 'Søknader',
    tabAttendance: 'Oppmøte',
    tabHomework: 'Lekser',
    tabPrograms: 'Programmer',
    tabDeletions: 'Slettelogg',
    tabActivity: 'Aktivitet',
    hwTitlePlaceholder: 'Tittel på lekse',
    hwAddBtn: 'Legg til lekse',
    progNamePlaceholder: 'Programnavn',
    addProgramHeading: 'Legg til nytt program',
    progModelMember: 'Medlem (månedlig)',
    progModelNonMember: 'Ikke medlem (årlig)',
    progPricePlaceholder: 'Pris',
    progAddBtn: 'Legg til',
    parentPortalPrefix: 'Foreldreportal —',
    registerTitle: 'Registreringsskjema',
    regStudentNamePlaceholder: 'Elevens navn',
    regGuardianNamePlaceholder: 'Foresattes navn',
    regGuardianEmailPlaceholder: 'Foresattes e-post',
    regGuardianPhonePlaceholder: 'Foresattes telefon (valgfritt)',
    submitRegBtn: 'Send søknad',
    langToggle: 'عربي',
    noAccountLinked: 'Denne kontoen er ikke koblet til noen skole ennå',
  },
};

export function getLang() {
  return localStorage.getItem('dasin_lang') || 'ar';
}

export function setLang(lang) {
  localStorage.setItem('dasin_lang', lang);
}

export function t(key) {
  const lang = getLang();
  return translations[lang]?.[key] ?? translations.ar[key] ?? key;
}

// بيطبّق الترجمة على أي عنصر عليه data-i18n (نص) أو
// data-i18n-placeholder (خانة إدخال)، وبيظبط اتجاه الصفحة (rtl/ltr)
export function applyStaticTranslations() {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });

  document.querySelectorAll('[data-i18n-toggle]').forEach(el => {
    el.textContent = t('langToggle');
  });
}

export function toggleLang() {
  setLang(getLang() === 'ar' ? 'no' : 'ar');
  applyStaticTranslations();
}
