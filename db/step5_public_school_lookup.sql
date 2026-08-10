-- =====================================================================
-- DASiN — الخطوة 5: دالة آمنة لمعرفة id المدرسة من الاسم المختصر (slug)
-- عشان صفحة التسجيل العامة (بدون تسجيل دخول) تعرف تبعت الطلب لمدرسة
-- صحيحة، من غير ما نكشف أي بيانات تانية عن المدرسة.
-- =====================================================================
create or replace function school_id_by_slug(p_slug text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from schools where slug = p_slug limit 1;
$$;

grant execute on function school_id_by_slug(text) to anon, authenticated;
