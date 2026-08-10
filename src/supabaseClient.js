import { createClient } from '@supabase/supabase-js';

// القيم دي بتيجي من متغيرات بيئة وقت البناء (build)، مش مكتوبة هنا
// مباشرة — كده مفتاح المشروع مش داخل الكود المنشور. شوف .env.example
// و README.md لطريقة الإعداد المحلي، وملف الـGitHub Actions لطريقة
// النشر عبر GitHub Secrets.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // فشل واضح بدل صمت — زي درس §0: أي حاجة تفشل لازم تقول إنها فشلت
  console.error(
    'DASiN: متغيرات Supabase مش موجودة. تأكد من ملف .env المحلي، أو من GitHub Secrets وقت النشر.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
