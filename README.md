# DASiN — نقطة البداية

هيكل مشروع حقيقي (مش ملف HTML واحد ضخم) + schema كامل لـSupabase، جاهز
للربط بمشروعك الحالي (DASiN Project اللي عملته على Supabase).

## المحتوى

```
db/schema.sql   — كل الجداول + RLS + الأدوار كبيانات + مفتاح الطوارئ
db/seed.sql     — بيانات تجريبية (مدرستين + 5 مستويات أدوار + برامج)
src/            — كود الواجهة (Vite + Supabase JS، بدون framework)
.github/workflows/deploy.yml — نشر أوتوماتيك لـGitHub Pages عند كل push
```

## خطوات الإعداد

### 1) القاعدة (Supabase)

لو عايز تبدأ من الصفر (مشروع Supabase جديد فاضي)، شغّل `db/schema.sql`
كامل في SQL Editor، وبعدها `db/seed.sql` لو عايز بيانات تجريبية.

**لو عندك بيانات الـPoC القديمة** (جداول schools/school_members/programs/
students من التجربة اللي عملناها)، ينفع تكمل عليها زي ما هي — الجداول
والـpolicies في `schema.sql` نفس الأسماء، بس فيها إضافة (roles) والربط
بقى عبر `role_id` بدل نص `role` حر. لو حابب تكمل من غيرها بلبس، قولي
وهنعمل ملف migration منفصل بدل ما تمسح وتبدأ تاني.

### 2) المفاتيح

من Supabase: Project Settings → API. هتلاقي:
- **Project URL**
- **anon public key**

خد نسخة من `.env.example` واسمه `.env`، واملأ فيه القيمتين دول.
**متسيبش `.env` يتنشر على GitHub أبدًا** — `.gitignore` بيحميه أصلًا.

### 3) التشغيل المحلي (اختياري، لو عندك Node.js على الجهاز)

```
npm install
npm run dev
```

هيفتحلك رابط محلي تقدر تجرب عليه.

### 4) النشر عبر GitHub

1. اعمل ريبو جديد على GitHub، وارفع المشروع ده كامل فيه
2. من إعدادات الريبو → Settings → Pages → Source، اختار "GitHub Actions"
3. من Settings → Secrets and variables → Actions، ضيف Secret باسم
   `VITE_SUPABASE_URL` وقيمته الـProject URL، وSecret تاني باسم
   `VITE_SUPABASE_ANON_KEY` وقيمته الـanon key
4. أي `push` على `main` هيبني وينشر أوتوماتيك (زي `firebase-hosting.yml`
   بتاع مدينة بالظبط، بس هنا مبني من ملفات منفصلة مش ملف واحد ضخم)

## مفتاح الطوارئ (معادل erEier())

جدول `ownership_recovery` **عمدًا** ماله ولا `policy` — يعني التطبيق
نفسه ميقدرش يقراه أو يعدّله خالص، حتى لو حصل خطأ في باقي الـRLS. الوصول
الوحيد له من SQL Editor في كونسول Supabase (بيشتغل بدور `postgres` اللي
بيتخطى RLS)، أو مفتاح `service_role` من سكريبت إداري منفصل — ده المعادل
لدخولك على Firebase Console في مدينة.

## اللي لسه ناقص (v1 بس)

- مفيش شاشة "إنشاء مدرسة جديدة" من الواجهة لسه — إنشاء مدرسة وربط أول
  Eier بيتم يدوي عبر SQL Editor، زي ما عملنا في التجربة
- مفيش نظام رسايل قابلة للنسخ (زي §55 في مدينة) — لسه رسايل الأخطاء
  بترجع كما هي من Supabase
- الأدوار الخمسة موجودة كبيانات، بس شاشة "🔑 Roller og tilganger"
  لتعديلها من الواجهة لسه معمولاش
