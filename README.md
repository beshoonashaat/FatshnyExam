# Revelation Exam Platform — امتحان سفر الرؤيا

منصة امتحان عربية RTL جاهزة للنشر العام على Vercel. المشروع يستخدم Next.js App Router وVercel Private Blob بدل قاعدة بيانات تقليدية.

## أهم الوظائف

- شاشة بيانات الممتحن: الاسم بالكامل، رقم التليفون، رقم الغياب.
- 14 سؤالًا بإجابات textarea غير محدودة، مع السماح الكامل بالكتابة والتعديل والنسخ واللصق داخل الإجابة.
- حماية نص السؤال فقط من التحديد/النسخ والـright-click.
- Autosave محلي للمسودة في المتصفح.
- مراجعة قبل التسليم مع عدد المجاب وغير المجاب، بدون إجبار على إكمال كل الأسئلة.
- كود تسليم فريد مثل `REV-8F3K2P`.
- Watermark شخصي متكرر + إشعار مرئي لأنظمة AI.
- تسجيل TAB_HIDDEN / WINDOW_BLUR / COPY_QUESTION_ATTEMPT / RIGHT_CLICK_QUESTION / FULLSCREEN_EXIT بدون رسوب تلقائي.
- `/admin` فقط للدخول الإداري، ولا يوجد له أي رابط في واجهة الطالب.
- فتح/إغلاق الامتحان فورًا. الوضع الافتراضي للإغلاق هو `STOP_ALL_SUBMISSIONS`.
- فحص حالة الامتحان server-side عند بدء الجلسة، وقبل التخزين مباشرة، ثم فحص دفاعي بعد التخزين لمقاومة سباقات الإغلاق/التسليم.
- Private Vercel Blob: ملف JSON مستقل لكل تسليم لتقليل تعارض الكتابة.
- نتائج + بحث + Excel/CSV/JSON + نسخة احتياطية داخل Blob.

## مسارات التخزين

- `config/exam-status.json`
- `config/status-history.json`
- `submissions/revelation-exam-01/REV-XXXXXX.json`
- `backup/backup-....json`

كل الملفات تُكتب بـ `access: 'private'`. لا يتم إرسال Blob URLs للطلاب.

## التشغيل المحلي للتطوير فقط

```bash
npm install
cp .env.example .env.local
npm run dev
```

ضع على الأقل:

```env
ADMIN_PASSWORD=your-strong-password
ADMIN_SESSION_SECRET=your-long-random-secret
```

لتجربة Blob محليًا، اربط المشروع بـVercel واسحب متغيرات البيئة باستخدام Vercel CLI، أو استخدم إعداد الـBlob token المناسب لحسابك.

## النشر على Vercel

1. ارفع المشروع إلى GitHub.
2. من Vercel اختر **Add New Project** ثم Import للـrepository.
3. من Storage أنشئ أو اربط **Vercel Blob** بالمشروع واختر **Private** access.
4. الإعدادات الحديثة في Vercel تدعم OIDC تلقائيًا للمشروعات المرتبطة بالـBlob. في إعدادات أقدم قد يظهر `BLOB_READ_WRITE_TOKEN` تلقائيًا عند ربط الـstore.
5. أضف `ADMIN_PASSWORD` في Project → Settings → Environment Variables.
6. أضف `ADMIN_SESSION_SECRET` بقيمة عشوائية طويلة.
7. لا تستخدم أي `NEXT_PUBLIC_*` لكلمات المرور أو بيانات اعتماد التخزين.
8. Deploy.

بعد النشر:

- رابط الطلاب: الـProduction URL نفسه، مثال `https://your-project.vercel.app/`
- الأدمن: `https://your-project.vercel.app/admin`

لا يوجد أي localhost أو LAN IP hardcoded داخل المشروع.

## ملاحظات الإغلاق

واجهة الطالب تعمل polling تقريبًا كل 15 ثانية، وتفحص أيضًا عند رجوع التبويب وعند المراجعة/التسليم. الأهم أن API التسليم لا يثق في حالة المتصفح: يطلب حالة Blob الحديثة server-side قبل الحفظ. عند الإغلاق يتم رفض التسليم بكود `EXAM_CLOSED` ولا تظهر رسالة نجاح إلا بعد نجاح التخزين.

## Production checklist

- استخدم Password قوي للأدمن.
- استخدم Private Blob فقط.
- اختبر فتح وإغلاق الامتحان على Production قبل الحدث.
- جرّب إرسال عدة تسليمات متزامنة.
- جرّب Excel/CSV/JSON من `/admin`.
- جرّب إغلاق الامتحان بينما صفحة طالب مفتوحة وتأكد أن Submit يُرفض.

## Exam duration

The exam duration is fixed at **30 minutes per started session**. The server signs each session using `ADMIN_SESSION_SECRET`, so the client cannot extend the deadline by editing `startedAt` or browser state. The UI shows a live countdown, and the submission API rejects submissions after the signed expiry time.
