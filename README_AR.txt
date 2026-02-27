CashBoxes Pro — Enterprise PWA (Mobile-First)
===========================================

1) Firebase Authentication
- Firebase Console → Authentication → Sign-in method → Enable Email/Password
- Authentication → Settings → Authorized domains → add: moaeydsede.github.io

2) Firestore
- Enable Firestore database
- Paste rules from: firestore.rules.txt into Firestore Rules
- Important: structure is per-user:
  users/{uid}/boxes/{boxId}
  users/{uid}/transactions/{txId}
  users/{uid}/settings/main

3) Cloudinary (Unsigned Upload)
- Cloud name: dthtzvypx
- Upload preset (Unsigned): Joodkids
- In Cloudinary preset, allow image formats and size as you want

4) Hosting
- Upload ALL files in this zip to GitHub Pages root
- Open site; login/register with:
  Email: Acc@cash.local
  Password: 31ZskJ12hdNhy5D5lwP6dPB5Kw92

5) Features
- Boxes list + click box => Statement with day picker
- Opening balance computed from all previous transactions before selected day
- Add/Edit/Delete transactions
- Filter transactions by box and date range
- Reports: monthly chart + top accounts
- Import/Export: XLSX/CSV (SheetJS CDN)
- Professional drawer: closes on overlay tap

If Firestore asks for an index, open Firebase Console → Firestore → Indexes and create suggested index.
