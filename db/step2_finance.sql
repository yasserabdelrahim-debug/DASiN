-- =====================================================================
-- DASiN — الخطوة 2: التسعير/المالية
-- =====================================================================

-- ثلاث حقول الدفع (زي مدينة بالظبط): هل دفع، المطلوب، المدفوع فعلًا
alter table students add column is_paid boolean not null default false;
alter table students add column amount_due numeric default 0;
alter table students add column amount_paid numeric default 0;

-- سجل نشاط مالي — أي تغيير في دفع طالب بيتسجل هنا، عشان "الفشل الصامت"
-- مايحصلش (زي درس §0: أي حاجة تتغير لازم يبقى ليها أثر واضح)
create table finance_log (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references schools(id) on delete cascade,
  student_id   uuid references students(id) on delete set null,
  changed_by   uuid references auth.users(id),
  old_amount_paid  numeric,
  new_amount_paid  numeric,
  note         text,
  created_at   timestamptz not null default now()
);

alter table finance_log enable row level security;

create policy "finance_log_all_own_school"
  on finance_log for all
  using (school_id in (select my_school_ids()))
  with check (school_id in (select my_school_ids()));

-- تريجر: أي تعديل على amount_paid لطالب بيتسجل تلقائي في finance_log،
-- عشان محدش ينسى يسجّله يدوي (نفس درس "الكود اللي بيفشل بصمت")
create or replace function log_student_payment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.amount_paid is distinct from new.amount_paid then
    insert into finance_log (school_id, student_id, changed_by, old_amount_paid, new_amount_paid)
    values (new.school_id, new.id, auth.uid(), old.amount_paid, new.amount_paid);
  end if;
  return new;
end;
$$;

create trigger trg_log_student_payment
  after update on students
  for each row
  execute function log_student_payment_change();
