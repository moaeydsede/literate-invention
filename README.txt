CashBoxes Pro (PWA) — نسخة جاهزة للرفع من الموبايل (Root بدون مجلدات)
========================================================

✅ هذه الحزمة "بدون مجلدات" ومناسبة 100% للموبايل.
✅ تعمل كـ PWA (تثبيت على الموبايل + أوفلاين عبر Service Worker).
✅ ثيم احترافي مع Dark/Light تلقائي حسب إعداد الجهاز + زر تبديل يدوي.
✅ Firebase Auth + Firestore حسب نموذج البيانات في تقرير التحليل.

المتطلبات
---------
1) Firebase Project: sweng-2f675
2) تفعيل Authentication (Email/Password)
3) تفعيل Firestore
4) (اختياري) Cloudinary لرفع صور الشيكات (Unsigned) — الإعدادات موجودة في firebase.js

إعدادات الأدمن
--------------
- ADMIN_UID الحالي:
  31ZskJ12hdNhy5D5lwP6dPB5Kw92

خطوات النشر على GitHub Pages (من الموبايل)
------------------------------------------
1) أنشئ مستودع GitHub جديد.
2) ارفع كل الملفات الموجودة في هذا الـ ZIP مباشرةً في الجذر (Root).
3) من Settings -> Pages:
   - Source: Deploy from branch
   - Branch: main / (root)
4) افتح رابط GitHub Pages من Chrome على Android ثم:
   - Add to Home Screen (سيعمل كتطبيق)

ملاحظة أمان مهمّة
-----------------
هذه الحزمة تستخدم قواعد Firestore آمنة "أدمن فقط" (قراءة وكتابة للأدمن فقط).
إذا كنت تريد عدة مستخدمين (سيرفر/قواعد متعددة المستأجرين)، أخبرني وسأعطيك قواعد Tenant + Roles عبر Custom Claims.

