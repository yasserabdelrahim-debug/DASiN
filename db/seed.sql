-- =====================================================================
-- DASiN — بيانات ابتدائية (اختياري، للتجربة فقط)
-- شغّله بعد schema.sql مباشرة
-- =====================================================================

insert into schools (name, slug) values
  ('DASiN', 'dasin'),
  ('EgySamfunn', 'egysamfunn');

-- 5 مستويات الأدوار (زي §39-ب بالظبط) لكل مدرسة
insert into roles (school_id, name, level, can_access_admin, counts_as_leadership, can_process_applications)
select id, r.name, r.level, true, r.leadership, r.applications
from schools
cross join (values
  ('Eier',            1, true,  true),
  ('Skoleleder',       2, true,  true),
  ('Faglig leder',     3, true,  true),
  ('Lærer',            4, false, false),
  ('Assistent',        5, false, false)
) as r(name, level, leadership, applications);

insert into programs (school_id, name, pricing_model, monthly_price, yearly_price, months_count, material_fee, sibling_discount_pct)
select id, 'البرنامج الرئيسي', 'member', 500, null, 9, 450, 0 from schools
union all
select id, 'البرنامج الرئيسي', 'non_member', null, 5500, null, 450, 15 from schools;

-- ملاحظة: لازم تربط مستخدم حقيقي بدور Eier (ليفل 1) لكل مدرسة يدويًا:
--
-- insert into school_members (school_id, user_id, role_id)
-- values (
--   (select id from schools where slug = 'dasin'),
--   '<uuid المستخدم>',
--   (select id from roles where school_id = (select id from schools where slug = 'dasin') and level = 1)
-- );
