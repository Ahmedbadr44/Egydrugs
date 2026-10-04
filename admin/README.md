# لوحة إدارة الأدوية

واجهة مستقلة في المتصفح لإضافة الأدوية وتعديلها وحذفها. لا توجد أي واجهة إدارة داخل تطبيق أندرويد.

## الإعداد مرة واحدة

1. في Supabase SQL Editor، شغّل [`../supabase/migrations/20261003_enable_browser_admin.sql`](../supabase/migrations/20261003_enable_browser_admin.sql).
2. من **Authentication > Users**، أنشئ حسابًا بالبريد الإلكتروني وكلمة مرور قوية. فعّل Email provider إذا لم يكن مفعّلًا.
3. انسخ UUID لهذا المستخدم وشغّل في SQL Editor:

   ```sql
   insert into public.drug_admins (user_id)
   values ('AUTH_USER_UUID');
   ```

4. افتح الصفحة من خادم محلي أو استضافة ثابتة. إعداد Project URL وPublishable key للمشروع الحالي مضاف مسبقًا؛ لا يحتاج المستخدم لإدخالهما. عند نقل الصفحة لمشروع آخر، يمكن فتح **إعداد الاتصال** وتحديث القيم. هاتان قيمتان عامتان للتطبيقات، وليستا `service_role` أو مفتاح قاعدة البيانات.

## التشغيل محليًا

من داخل مجلد المشروع:

```powershell
py -m http.server 8080 -d admin
```

ثم افتح `http://localhost:8080`. يمكن استضافة نفس مجلد `admin` على Netlify أو GitHub Pages أو أي استضافة ملفات ثابتة.

## الحماية

Publishable key وحده لا يمنح صلاحية التعديل. قاعدة البيانات تتحقق من جلسة المستخدم وسياسة RLS قبل أي إضافة أو تعديل أو حذف. لا تضع `service_role` أو `sb_secret` في أي ملف أو في المتصفح.
