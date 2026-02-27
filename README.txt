CashBoxes Pro v3 (PWA) — ملفات بدون مجلدات للرفع من الموبايل

✅ تحسينات v3 (احتراف أعلى):
- رفع صور الشيكات إلى Cloudinary (Unsigned upload)
  Cloud: dthtzvypx
  Preset: Unsigned
  Folder: Joodkids
- كشف حساب للصندوق عند الضغط + فلترة تاريخ (من/إلى)
- إظهار: الرصيد الافتتاحي للصندوق + افتتاحي الفترة (أو افتتاحي قبل اليوم عند تحديد يوم واحد)
- واجهة Premium + Bottom Navigation + Install زر تلقائي + Offline banner

رفع على GitHub Pages:
1) ارفع كل الملفات إلى Root في repo (main).
2) Settings > Pages > Deploy from branch > main / root
3) افتح رابط Pages من Chrome على Android ثم Add to Home Screen.

Firebase:
- أنشئ مستخدم Admin بالبريد/الباسورد الذي تريده.
- Firestore: /users/{uid} role=admin أو viewer.
- القواعد في firestore.rules فيها Admin UID ثابت: 31ZskJ12hdNhy5D5lwP6dPB5Kw92

Cloudinary:
- تأكد أن Upload preset (Unsigned) مفعّل كـ Unsigned في لوحة Cloudinary.
- إن أردت تغيير folder/preset عدّل firebase.js.


v4 Fixes:
- Cloudinary upload: compression + retry + progress
- CRUD: edit tx, edit/delete cheque, edit/delete cashbox
- Excel: improved import + XLSX export
- Account drilldown: tap account name => account statement
- Drawer: tap outside closes + prevent background scroll
