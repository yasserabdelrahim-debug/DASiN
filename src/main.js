import { supabase } from './supabaseClient.js';

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
  statusBadge.textContent = text;
}

let connectionTimeout = setTimeout(() => {
  setBadge('error', 'مفيش رد من القاعدة — تأكد من إعدادات .env');
}, 8000);

async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  clearTimeout(connectionTimeout);
  setBadge('ok', 'متصل');

  if (session) {
    await showDashboard();
  } else {
    showLogin();
  }
}

function showLogin() {
  loginView.hidden = false;
  dashboardView.hidden = true;
}

async function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;

  const { data: members, error: memberError } = await supabase
    .from('school_members')
    .select('school_id, schools(name)')
    .limit(1);

  if (memberError || !members || members.length === 0) {
    schoolNameEl.textContent = '؟';
    studentsList.innerHTML = '<p class="error">مقدرش أوصل لبيانات مدرستك — راجع الحساب أو الصلاحيات</p>';
    return;
  }

  currentSchoolId = members[0].school_id;
  schoolNameEl.textContent = members[0].schools?.name ?? '؟';

  await loadClasses();
  await loadStudentsTab();
}

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
      <div class="card-row">
        <strong>${s.full_name}${s.is_member ? ' (عضو)' : ''}</strong>
      </div>
      <div class="muted">المطلوب: ${s.amount_due ?? 0} — المدفوع: <span data-paid-display>${s.amount_paid ?? 0}</span></div>
      <div class="card-row">
        <input type="number" data-amount-input value="${s.amount_paid ?? 0}" style="width:100px" />
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
    row.className = 'card card-row';
    row.innerHTML = `
      <span>${s.full_name}</span>
      <span>
        <button data-status="present" class="small-btn">حاضر</button>
        <button data-status="late" class="small-btn">متأخر</button>
        <button data-status="absent" class="small-btn">غائب</button>
      </span>
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

// ------------------------- التبويبات -------------------------

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
    if (btn.dataset.tab === 'attendance') await loadAttendanceTab();
    if (btn.dataset.tab === 'homework') await loadHomeworkTab();
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

  await showDashboard();
});

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  showLogin();
});

init();
