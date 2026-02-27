CashBoxes Pro v2 (PWA) — ملفات بدون مجلدات للرفع من الموبايل

✅ تحسينات v2:
- تصميم Premium + Bottom Navigation
- زر Install يظهر تلقائياً عند توفر التثبيت
- Offline banner
- اختيار الصندوق في الشيكات من قائمة (بدلاً من كتابة ID)
- بحث في الصناديق
- Dark/Light/Auto

رفع على GitHub Pages:
1) ارفع كل الملفات إلى Root في repo (main).
2) Settings > Pages > Deploy from branch > main / root
3) افتح رابط Pages من Chrome على Android ثم Add to Home Screen.

Firebase:
- أنشئ مستخدم Admin بالبريد/الباسورد الذي تريده.
- Firestore: /users/{uid} role=admin أو viewer.
- القواعد في firestore.rules فيها Admin UID ثابت.
