-- =====================================================================
-- DASiN — الخطوة 1: معلمين + فصول + تسجيل وقبول
-- =====================================================================

create table classes (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table teachers (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  full_name   text not null,
  class_id    uuid references classes(id),
  subject     text,
  created_at  timestamptz not null default now()
);

-- استمارة التسجيل العامة — بيانات خام من طلب ولي أمر، قبل أي مراجعة
create table registrations (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references schools(id) on delete cascade,
  student_name    text not null,
  guardian_name   text not null,
  guardian_email  text not null,
  guardian_phone  text,
  program_id      uuid references programs(id),
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at      timestamptz not null default now()
);

alter table classes         enable row level security;
alter table teachers        enable row level security;
alter table registrations   enable row level security;

-- classes/teachers: أعضاء المدرسة بس
create policy "classes_all_own_school"
  on classes for all
  using (school_id in (select my_school_ids()))
  with check (school_id in (select my_school_ids()));

create policy "teachers_all_own_school"
  on teachers for all
  using (school_id in (select my_school_ids()))
  with check (school_id in (select my_school_ids()));

-- registrations: أي حد (حتى من غير تسجيل دخول) يقدر يضيف طلب جديد بس
create policy "registrations_insert_public"
  on registrations for insert
  to anon, authenticated
  with check (true);

-- registrations: القراءة/التعديل لأعضاء المدرسة بس (منع أي حد يشوف طلبات غيره)
create policy "registrations_select_own_school"
  on registrations for select
  using (school_id in (select my_school_ids()));

create policy "registrations_update_own_school"
  on registrations for update
  using (school_id in (select my_school_ids()))
  with check (school_id in (select my_school_ids()));
