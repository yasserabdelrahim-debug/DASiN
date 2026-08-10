-- =====================================================================
-- DASiN — الخطوة 4: بوابة أولياء الأمور
-- =====================================================================

create table guardian_students (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references schools(id) on delete cascade,
  guardian_id  uuid not null references auth.users(id) on delete cascade,
  student_id   uuid not null references students(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (guardian_id, student_id)
);

alter table guardian_students enable row level security;

create policy "guardian_students_select_own"
  on guardian_students for select
  using (guardian_id = auth.uid());

create policy "guardian_students_insert_leadership_only"
  on guardian_students for insert
  with check (
    my_role_level(school_id) is not null
    and my_role_level(school_id) <= 2
  );

create or replace function my_children_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select student_id from guardian_students where guardian_id = auth.uid();
$$;

create policy "students_select_own_children"
  on students for select
  using (id in (select my_children_ids()));

create policy "attendance_select_own_children"
  on attendance for select
  using (student_id in (select my_children_ids()));

create policy "homework_select_for_own_children_class"
  on homework for select
  using (
    class_id in (
      select class_id from students where id in (select my_children_ids())
    )
  );
