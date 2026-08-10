-- =====================================================================
-- DASiN — الخطوة 3: الحضور والواجبات
-- =====================================================================

create table attendance (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references schools(id) on delete cascade,
  student_id   uuid not null references students(id) on delete cascade,
  class_id     uuid references classes(id),
  date         date not null,
  status       text not null check (status in ('present', 'absent', 'late')),
  recorded_by  uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  unique (student_id, date)
);

create table homework (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references schools(id) on delete cascade,
  class_id     uuid references classes(id),
  teacher_id   uuid references teachers(id),
  title        text not null,
  description  text,
  due_date     date,
  created_at   timestamptz not null default now()
);

alter table attendance enable row level security;
alter table homework   enable row level security;

create policy "attendance_all_own_school"
  on attendance for all
  using (school_id in (select my_school_ids()))
  with check (school_id in (select my_school_ids()));

create policy "homework_all_own_school"
  on homework for all
  using (school_id in (select my_school_ids()))
  with check (school_id in (select my_school_ids()));
