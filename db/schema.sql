-- =====================================================================
-- DASiN — Schema كامل (v1)
-- شغّله في Supabase SQL Editor على مشروع فاضي (أو بعد ما تمسح الجداول
-- القديمة من تجربة الـPoC لو عايز تبدأ نضيف)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) المدارس (المستأجرين)
-- ---------------------------------------------------------------------
create table schools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2) الأدوار — كبيانات مش كود، زي §39 بالظبط. كل مدرسة عندها أدوارها
--    الخاصة، وليفل 1 = المالك (الأعلى)، ليفل 5 = الأقل.
-- ---------------------------------------------------------------------
create table roles (
  id                        uuid primary key default gen_random_uuid(),
  school_id                 uuid not null references schools(id) on delete cascade,
  name                      text not null,
  level                     int  not null check (level between 1 and 5),
  can_access_admin          boolean not null default true,
  counts_as_leadership      boolean not null default false,
  can_process_applications  boolean not null default false,
  created_at                timestamptz not null default now(),
  unique (school_id, name)
);

-- ---------------------------------------------------------------------
-- 3) عضوية المستخدمين في المدارس + الدور
-- ---------------------------------------------------------------------
create table school_members (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role_id     uuid not null references roles(id),
  created_at  timestamptz not null default now(),
  unique (school_id, user_id)
);

-- ---------------------------------------------------------------------
-- 4) البرامج — نموذجين زي §37: عضو شهري بلا خصم إخوة / غير عضو سنوي
--    بخصم، والسقف 18% منعًا لانعكاس ميزة العضوية.
-- ---------------------------------------------------------------------
create table programs (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references schools(id) on delete cascade,
  name                  text not null,
  pricing_model         text not null check (pricing_model in ('member', 'non_member')),
  monthly_price         numeric,
  yearly_price          numeric,
  months_count          int,
  material_fee          numeric default 0,
  sibling_discount_pct  numeric default 0 check (sibling_discount_pct <= 18),
  created_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5) الطلاب
-- ---------------------------------------------------------------------
create table students (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references schools(id) on delete cascade,
  program_id   uuid references programs(id),
  full_name    text not null,
  is_member    boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6) مفتاح الطوارئ — معادل erEier() بس بمنطق Postgres.
--    الجدول ده عمدًا مفيهوش ولا policy واحدة لدور authenticated —
--    يعني حتى لو RLS انكسرت في كل حتة تانية، محدش (غير صاحب مفتاح
--    service_role، اللي هو خارج النظام تمامًا زي كونسول Firebase)
--    يقدر يقرا أو يعدّل الجدول ده من التطبيق نفسه.
-- ---------------------------------------------------------------------
create table ownership_recovery (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references schools(id) on delete cascade,
  recovery_email        text not null,
  recovery_expires_at   timestamptz not null,
  created_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7) دالة مساعدة: مستوى المستخدم الحالي في مدرسة معينة
-- ---------------------------------------------------------------------
create or replace function my_role_level(p_school_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select r.level
  from school_members sm
  join roles r on r.id = sm.role_id
  where sm.school_id = p_school_id
    and sm.user_id = auth.uid()
  limit 1;
$$;

-- ---------------------------------------------------------------------
-- 8) تفعيل RLS على كل جدول (ما عدا ownership_recovery، لسه معمول
--    عليه enable لكن من غير أي policy — يعني مقفول تمامًا)
-- ---------------------------------------------------------------------
alter table schools             enable row level security;
alter table roles               enable row level security;
alter table school_members      enable row level security;
alter table programs            enable row level security;
alter table students            enable row level security;
alter table ownership_recovery  enable row level security;

-- ---------------------------------------------------------------------
-- 9) الـpolicies
-- ---------------------------------------------------------------------

-- schools: أي عضو يشوف مدرسته بس
create policy "schools_select_own"
  on schools for select
  using (
    id in (select school_id from school_members where user_id = auth.uid())
  );

-- roles: أي عضو يشوف أدوار مدرسته
create policy "roles_select_own_school"
  on roles for select
  using (
    school_id in (select school_id from school_members where user_id = auth.uid())
  );

-- roles: بس القيادة (ليفل 1 أو 2) تقدر تنشئ دور، وبس أقل درجة منها
create policy "roles_insert_leadership_only"
  on roles for insert
  with check (
    my_role_level(school_id) is not null
    and my_role_level(school_id) <= 2
    and level > my_role_level(school_id)
  );

-- roles: نفس المنطق للتعديل، وممنوع حد غير المالك يلمس دور المالك (ليفل 1)
create policy "roles_update_leadership_only"
  on roles for update
  using (
    my_role_level(school_id) is not null
    and my_role_level(school_id) <= 2
    and (level != 1 or my_role_level(school_id) = 1)
  )
  with check (
    my_role_level(school_id) is not null
    and my_role_level(school_id) <= 2
    and (level != 1 or my_role_level(school_id) = 1)
  );

-- school_members: أي عضو يشوف زملاءه في نفس المدرسة
create policy "school_members_select_own_school"
  on school_members for select
  using (
    school_id in (select school_id from school_members where user_id = auth.uid())
  );

-- school_members: القيادة بس تضيف عضو، وبدور أقل من درجتها
create policy "school_members_insert_leadership_only"
  on school_members for insert
  with check (
    my_role_level(school_id) is not null
    and my_role_level(school_id) <= 2
    and (select level from roles where id = role_id) > my_role_level(school_id)
  );

-- programs: كل حاجة لأعضاء المدرسة بس
create policy "programs_all_own_school"
  on programs for all
  using (
    school_id in (select school_id from school_members where user_id = auth.uid())
  )
  with check (
    school_id in (select school_id from school_members where user_id = auth.uid())
  );

-- students: كل حاجة لأعضاء المدرسة بس
create policy "students_all_own_school"
  on students for all
  using (
    school_id in (select school_id from school_members where user_id = auth.uid())
  )
  with check (
    school_id in (select school_id from school_members where user_id = auth.uid())
  );

-- ownership_recovery: عمدًا ولا policy — الجدول مقفول بالكامل على
-- authenticated. الوصول الوحيد المسموح: Supabase SQL Editor (اللي
-- بيشتغل بدور postgres) أو مفتاح service_role من سكريبت إداري منفصل.
