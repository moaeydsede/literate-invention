/* CashBoxes Pro — PWA (SPA) — mobile-first, RTL
   - Firebase Auth (Email/Password)
   - Firestore (cashboxes, transactions, cheques)
   - Cloudinary unsigned upload for cheque images
   - Auto theme: system dark/light + manual toggle
   - Hash router
*/
import { firebaseConfig, ADMIN_UID, CLOUDINARY } from "./firebase.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getStorage,
  ref as sRef,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  writeBatch,
  increment,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ----------------------- Utilities -----------------------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function escapeHtml(s=""){
  return String(s).replace(/[&<>"']/g, (m)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function todayISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtMoney(n){
  const x = Number(n||0);
  return x.toLocaleString("ar-EG", { maximumFractionDigits: 2 });
}

function icon(name){
  // Lightweight inline icons (no external libs)
  const icons = {
    menu: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    moon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M21 13.2A7.5 7.5 0 0 1 10.8 3 9 9 0 1 0 21 13.2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
    sun: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    plus: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    logout: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M10 17l1 0m-1 0l0-10m0 10H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M15 16l4-4-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 12H10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    chart: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 19V5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4 19h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 16v-5M12 16V8M16 16v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    box: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M21 8v13H3V8" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M3 8l9-5 9 5-9 5-9-5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
    cheque: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 7h16v10H4z" stroke="currentColor" stroke-width="2"/><path d="M7 10h6M7 13h10M7 16h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    home: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 11.5L12 4l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
    admin: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 3l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V7l8-4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    edit: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 20h9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
    trash: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 6h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 6V4h8v2" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M7 6l1 16h8l1-16" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  };
  return icons[name] || "";
}

let __lastToastKey = "";
let __lastToastAt = 0;
function toastOnce(msg, kind="info", key="", cooldownMs=1600){
  const now = Date.now();
  const k = key || (kind + ":" + msg);
  if(__lastToastKey === k && (now-__lastToastAt) < cooldownMs) return;
  __lastToastKey = k; __lastToastAt = now;
  toast(msg, kind);
}
function errText(e){
  if(!e) return "";
  const code = e.code ? ` (${e.code})` : "";
  const msg = e.message || String(e);
  return msg + code;
}

function toast(msg, kind="info"){
  const wrap = state.toastWrap || (() => {
    const t = document.createElement("div");
    t.className = "toastwrap";
    document.body.appendChild(t);
    state.toastWrap = t;
    return t;
  })();
  const el = document.createElement("div");
  el.className = "toast";
  const color = kind==="danger" ? "var(--danger)" : kind==="success" ? "var(--success)" : "var(--brand)";
  el.style.borderColor = "rgba(255,255,255,.12)";
  el.innerHTML = `
    <div class="msg" style="border-inline-start:4px solid ${color}; padding-inline-start:10px">
      ${escapeHtml(msg)}
    </div>
    <div class="x" aria-label="close">${"✕"}</div>
  `;
  $(".x", el).onclick = () => el.remove();
  wrap.prepend(el);
  setTimeout(()=>{ try{ el.remove(); }catch{} }, 4600);
}

function setMainLoading(on){
  const main = $("#main");
  if(!main) return;
  if(on){
    main.innerHTML = `
      <div class="container">
        <div class="card">
          <div class="row between">
            <div class="col">
              <div class="h2">جاري التحميل…</div>
              <div class="p">لحظات من فضلك</div>
            </div>
            <div class="badge">⚡ PWA</div>
          </div>
        </div>
      </div>`;
  }
}

// ----------------------- Theme -----------------------
function getThemePref(){
  return localStorage.getItem("themeMode") || "auto"; // auto | dark | light
}
function setThemePref(mode){
  localStorage.setItem("themeMode", mode);
  applyTheme();
}
function applyTheme(){
  const mode = getThemePref();
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = (mode==="auto") ? (prefersDark ? "dark" : "light") : mode;
  document.documentElement.dataset.theme = theme;
  state.theme = theme;
  state.themeMode = mode;
  // Theme color (address bar) best-effort
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute("content", theme==="dark" ? "#0b1220" : "#f6f8fc");
}
function nextThemeMode(){
  const mode = getThemePref();
  const next = mode==="auto" ? "dark" : mode==="dark" ? "light" : "auto";
  setThemePref(next);
  toast(`تم تغيير الثيم: ${themeLabel(next)}`, "success");
}
function themeLabel(mode){
  if(mode==="auto") return "تلقائي";
  if(mode==="dark") return "داكن";
  return "فاتح";
}
window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", ()=> {
  if(getThemePref()==="auto") applyTheme();
});

// ----------------------- State + Router -----------------------
const state = {
  user: null,
  role: "viewer",
  page: "dashboard",
  arg: "",
  drawerOpen: false,
  installPrompt: null,
  theme: "dark",
  themeMode: "auto",
};

function parseHash(){
  const h = (location.hash || "#login").slice(1);
  const [page, ...rest] = h.split("/");
  return { page: page || "dashboard", arg: rest.join("/") };
}
function go(hash){
  location.hash = hash.startsWith("#") ? hash : `#${hash}`;
}
function render(){
  const { page, arg } = parseHash();
  state.page = page;
  state.arg = arg;

  $("#app").innerHTML = shellView();
  bindShell();

  const main = $("#main");
  if(!state.user){
    main.innerHTML = loginView();
    bindLogin();
    return;
  }

  // route
  const routes = {
    dashboard: [dashboardView, bindDashboard],
    cashboxes: [cashboxesView, bindCashboxes],
    statement: [statementView, bindStatement],
    cheques: [chequesView, bindCheques],
    report: [reportView, bindReport],
    admin: [adminView, bindAdmin],
  };

  const entry = routes[state.page] || routes.dashboard;
  main.innerHTML = entry[0]();
  entry[1]();
}

window.addEventListener("hashchange", render);

// ----------------------- Auth + profile -----------------------
async function ensureUserProfile(uid){
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    // default profile (admin is based on UID here; rules enforce admin anyway)
    await setDoc(ref, { role: uid===ADMIN_UID ? "admin" : "viewer", createdAt: serverTimestamp() });
  }
  const now = (await getDoc(ref)).data();
  state.role = (uid === ADMIN_UID) ? "admin" : (now?.role || "viewer");
}

// ----------------------- Views -----------------------
function shellView(){
  const loggedIn = !!state.user;
  const isAdmin = state.role === "admin";
  const page = state.page;

  const themeIco = state.themeMode==="dark" ? icon("moon") : state.themeMode==="light" ? icon("sun") : "A";
  const themeTxt = themeLabel(state.themeMode);

  return `
    <div class="topbar">
      <div class="wrap">
        <div class="brand" onclick="location.hash='${loggedIn ? "#dashboard" : "#login"}'">
          <div class="logo" aria-hidden="true"></div>
          <div class="col" style="gap:0">
            <div class="title">CashBoxes Pro</div>
            <div class="sub">إدارة صناديق + سندات + شيكات</div>
          </div>
        </div>
        <div class="row">
          <button class="iconbtn" id="btnTheme" title="الثيم">${themeModeGlyph(state.themeMode)}</button>
          ${loggedIn ? `<button class="iconbtn" id="btnMenu" title="القائمة">${icon("menu")}</button>` : ``}
        </div>
      </div>
    </div>

    <div id="drawerBackdrop" class="drawer-backdrop"></div>
    <aside id="drawer" class="drawer" aria-hidden="${state.drawerOpen ? "false":"true"}">
      <div class="card" style="box-shadow:none">
        <div class="row between">
          <div class="col" style="gap:2px">
            <div class="h2">الإعدادات</div>
            <div class="p">الثيم: <b>${escapeHtml(themeTxt)}</b></div>
          </div>
          <button class="iconbtn" id="btnCloseDrawer" title="إغلاق">✕</button>
        </div>
      </div>

      <div class="item">
        <div class="col" style="gap:2px">
          <div class="t">تبديل الثيم</div>
          <div class="d">Auto / Dark / Light</div>
        </div>
        <button class="btn small" id="btnTheme2">${themeModeGlyph(state.themeMode)}</button>
      </div>

      <div class="item">
        <div class="col" style="gap:2px">
          <div class="t">تثبيت التطبيق</div>
          <div class="d">Add to Home Screen</div>
        </div>
        <button class="btn small primary" id="btnInstall" ${state.installPrompt ? "" : "disabled"}>تثبيت</button>
      </div>

      <div class="item">
        <div class="col" style="gap:2px">
          <div class="t">الحساب</div>
          <div class="d">${escapeHtml(state.user?.email || "")}</div>
        </div>
        <button class="btn small" id="btnLogout">${icon("logout")} خروج</button>
      </div>

      ${isAdmin ? `
      <div class="item" onclick="location.hash='#admin'">
        <div class="col" style="gap:2px">
          <div class="t">لوحة الأدمن</div>
          <div class="d">استيراد/تصدير + أدوات</div>
        </div>
        <span>›</span>
      </div>` : ``}

      <div class="card" style="margin-top:12px; box-shadow:none">
        <div class="footnote">
          • التطبيق يعمل Offline للملفات الأساسية.<br>
          • قواعد Firestore في الملف <b>firestore.rules</b> آمنة (أدمن فقط).<br>
          • Cloudinary Unsigned قد يحتاج تقييد/تحويل لـ Signed لاحقًا.
        </div>
      </div>
    </aside>

    <main id="main"></main>

    ${loggedIn ? bottomNav(page, isAdmin) : ``}
  `;
}

function themeModeGlyph(mode){
  if(mode==="auto") return `<span style="font-weight:900">A</span>`;
  if(mode==="dark") return icon("moon");
  return icon("sun");
}

function bottomNav(active, isAdmin){
  const items = [
    ["dashboard","الرئيسية", icon("home")],
    ["cashboxes","الصناديق", icon("box")],
    ["cheques","الشيكات", icon("cheque")],
    ["report","التقارير", icon("chart")],
  ];
  if(isAdmin) items.push(["admin","أدمن", icon("admin")]);
  return `
    <nav class="bottomnav">
      <div class="bar">
        ${items.map(([k,label,ico])=>`
          <a class="navbtn ${active===k?"active":""}" href="#${k}">
            <div>${ico}</div>
            <div>${label}</div>
          </a>
        `).join("")}
      </div>
    </nav>
  `;
}

function loginView(){
  return `
    <div class="container">
      <div class="card">
        <div class="row between">
          <div class="col">
            <div class="h1">تسجيل الدخول</div>
            <div class="p">استخدم إيميل/باسورد Firebase</div>
          </div>
          <div class="badge">v9</div>
        </div>
        <hr class="sep"/>
        <div class="col" style="gap:10px">
          <input id="email" class="input" inputmode="email" placeholder="البريد الإلكتروني" autocomplete="username"/>
          <input id="pass" class="input" type="password" placeholder="كلمة المرور" autocomplete="current-password"/>
          <button id="btnLogin" class="btn primary">${icon("admin")} دخول</button>
          <div class="footnote">
            إذا لم يكن لديك مستخدم: أنشئه من Firebase Authentication ثم استخدم نفس الإيميل هنا.
          </div>
        </div>
      </div>
    </div>
  `;
}

function dashboardView(){
  return `
    <div class="container">
      <div class="card">
        <div class="row between">
          <div class="col">
            <div class="h1">لوحة التحكم</div>
            <div class="p">ملخص سريع للصناديق والحركة</div>
          </div>
          <span class="badge">👤 ${escapeHtml(state.role)}</span>
        </div>
        <div id="kpis" class="kpi" style="margin-top:12px">
          <div class="box"><div class="num">—</div><div class="lbl">عدد الصناديق</div></div>
          <div class="box"><div class="num">—</div><div class="lbl">إجمالي الأرصدة</div></div>
          <div class="box"><div class="num">—</div><div class="lbl">شيكات معلّقة</div></div>
          <div class="box"><div class="num">—</div><div class="lbl">حركات اليوم</div></div>
        </div>

        <hr class="sep"/>
        <div class="row" style="gap:10px; flex-wrap:wrap">
          <a class="btn" href="#cashboxes">${icon("box")} إدارة الصناديق</a>
          <a class="btn" href="#cheques">${icon("cheque")} إدارة الشيكات</a>
          <a class="btn" href="#report">${icon("chart")} التقارير</a>
          ${state.role==="admin" ? `<a class="btn primary" href="#admin">${icon("admin")} أدوات الأدمن</a>` : ``}
        </div>
      </div>

      <div class="card">
        <div class="h2">آخر الصناديق</div>
        <div class="p">آخر 5 صناديق حسب آخر حركة</div>
        <div id="recentCashboxes" style="margin-top:10px"></div>
      </div>
    </div>
  `;
}

function cashboxesView(){
  const isAdmin = state.role==="admin";
  return `
    <div class="container">
      <div class="card">
        <div class="row between">
          <div class="col">
            <div class="h1">الصناديق</div>
            <div class="p">إنشاء/تعديل + كشف حساب</div>
          </div>
          ${isAdmin ? `<button class="btn primary" id="btnNewCashbox">${icon("plus")} جديد</button>` : ``}
        </div>
        <hr class="sep"/>
        <input id="cashboxSearch" class="input" placeholder="بحث باسم الصندوق…" />
      </div>

      <div id="cashboxList"></div>
    </div>
  `;
}

function statementView(){
  const cashboxId = state.arg || "";
  return `
    <div class="container">
      <div class="card">
        <div class="row between">
          <div class="col">
            <div class="h1">كشف حساب</div>
            <div class="p" id="stTitle">—</div>
          </div>
          <a class="btn" href="#cashboxes">رجوع</a>
        </div>

        <hr class="sep"/>
        <div class="grid2">
          <div class="col">
            <div class="p">من</div>
            <input id="fromDate" class="input" type="date" />
          </div>
          <div class="col">
            <div class="p">إلى</div>
            <input id="toDate" class="input" type="date" />
          </div>
        </div>

        <div class="row" style="margin-top:10px; gap:10px; flex-wrap:wrap">
          <button class="btn primary" id="btnReload">تحديث</button>
          ${state.role==="admin" ? `<button class="btn" id="btnAddTx">${icon("plus")} إضافة سند</button>` : ``}
          <button class="btn" id="btnExportCsv">تصدير CSV</button>
          <button class="btn" id="btnExportXlsx">تصدير Excel</button>
        </div>

        <div id="stTotals" class="kpi" style="margin-top:12px">
          <div class="box"><div class="num">—</div><div class="lbl">إجمالي الداخل</div></div>
          <div class="box"><div class="num">—</div><div class="lbl">إجمالي الخارج</div></div>
        </div>
      </div>

      <div class="card">
        <div class="h2">الحركات</div>
        <div class="p">مرتبة حسب التاريخ</div>
        <div id="stTable" style="margin-top:10px"></div>
      </div>

      <div class="card">
        <div class="h2">الرسم البياني</div>
        <div class="p">صافي (IN - OUT) خلال الفترة</div>
        <canvas id="chart" style="width:100%; height:240px; border-radius:18px; border:1px solid var(--border); background: var(--surface)"></canvas>
      </div>
    </div>
  `;
}

function chequesView(){
  const isAdmin = state.role==="admin";
  return `
    <div class="container">
      <div class="card">
        <div class="row between">
          <div class="col">
            <div class="h1">الشيكات</div>
            <div class="p">قيد الانتظار / تم التحصيل</div>
          </div>
          ${isAdmin ? `<button class="btn primary" id="btnNewCheque">${icon("plus")} شيك</button>` : ``}
        </div>
        <hr class="sep"/>
        <div class="grid2">
          <select id="chequeStatus" class="input">
            <option value="pending">قيد الانتظار</option>
            <option value="collected">تم التحصيل</option>
            <option value="all">الكل</option>
          </select>
          <input id="chequeSearch" class="input" placeholder="بحث برقم الشيك…" />
        </div>
      </div>

      <div id="chequeList"></div>
    </div>
  `;
}

function reportView(){
  return `
    <div class="container">
      <div class="card">
        <div class="row between">
          <div class="col">
            <div class="h1">التقارير</div>
            <div class="p">ملخص إجمالي (قد يأخذ وقت حسب البيانات)</div>
          </div>
          <button class="btn" id="btnRefreshReport">تحديث</button>
        </div>
        <hr class="sep"/>
        <div id="reportBody"></div>
      </div>
    </div>
  `;
}

function adminView(){
  if(state.role!=="admin"){
    return `
      <div class="container">
        <div class="card">
          <div class="h1">غير مصرح</div>
          <div class="p">هذه الصفحة للأدمن فقط.</div>
        </div>
      </div>
    `;
  }
  return `
    <div class="container">
      <div class="card">
        <div class="row between">
          <div class="col">
            <div class="h1">لوحة الأدمن</div>
            <div class="p">أدوات صيانة + استيراد/تصدير</div>
          </div>
          <span class="badge">UID: ${escapeHtml(ADMIN_UID.slice(0,8))}…</span>
        </div>
        <hr class="sep"/>

        <div class="card" style="box-shadow:none">
          <div class="h2">تصدير بيانات</div>
          <div class="p">CSV/JSON سريع</div>
          <div class="row" style="gap:10px; flex-wrap:wrap; margin-top:10px">
            <button class="btn" id="btnExportCashboxes">تصدير الصناديق (JSON)</button>
            <button class="btn" id="btnExportCheques">تصدير الشيكات (JSON)</button>
          </div>
        </div>

        <div class="card" style="box-shadow:none; margin-top:12px">
          <div class="h2">استيراد Excel</div>
          <div class="p">يتطلب ملف XLSX بصيغة: date, kind, amount, account, note, cashboxId</div>
          <input type="file" id="xlsxFile" class="input" accept=".xlsx" />
          <div class="row" style="gap:10px; margin-top:10px; flex-wrap:wrap">
            <button class="btn primary" id="btnImportXlsx">استيراد</button>
          </div>
          <div class="footnote">يتم تحميل مكتبة SheetJS عند الاستيراد فقط.</div>
        </div>
      </div>
    </div>
  `;
}

// ----------------------- Modals -----------------------
function openModal(title, bodyHtml, actionsHtml){
  closeModal();
  const back = document.createElement("div");
  back.className = "modal-backdrop show";
  back.id = "modalBackdrop";
  back.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="row between">
        <div class="h2">${escapeHtml(title)}</div>
        <button class="iconbtn" id="btnModalClose" title="إغلاق">✕</button>
      </div>
      <hr class="sep"/>
      <div id="modalBody">${bodyHtml}</div>
      <hr class="sep"/>
      <div class="row" style="gap:10px; justify-content:flex-start; flex-wrap:wrap">${actionsHtml || ""}</div>
    </div>
  `;
  document.body.appendChild(back);
  $("#btnModalClose").onclick = closeModal;
  back.addEventListener("click", (e)=>{ if(e.target === back) closeModal(); });
}
function closeModal(){
  $("#modalBackdrop")?.remove();
}

// ----------------------- Data layer -----------------------
async function listCashboxes(){
  const qy = query(collection(db, "cashboxes"), orderBy("lastTxAt","desc"), limit(60));
  const snap = await getDocs(qy);
  return snap.docs.map(d=>({ id:d.id, ...d.data() }));
}

async function createCashbox({name, openingBalance}){
  const docRef = await addDoc(collection(db, "cashboxes"), {
    name,
    openingBalance: Number(openingBalance||0),
    balance: Number(openingBalance||0),
    totalInYear: 0,
    totalOutYear: 0,
    lastTxAt: todayISO(),
    isActive: true,
    createdAt: serverTimestamp(),
    createdBy: state.user.uid,
  });
  return docRef.id;
}

async function updateCashbox(id, patch){
  await updateDoc(doc(db, "cashboxes", id), patch);
}

async function deleteCashbox(id){
  await deleteDoc(doc(db, "cashboxes", id));
}

function getCounterRef(cashboxId, year){
  return doc(db, "cashboxes", cashboxId, "meta", `counters_${year}`);
}

async function getNextVoucher(cashboxId, kind, year){
  const ref = getCounterRef(cashboxId, year);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    await setDoc(ref, { rc:0, py:0, updatedAt: serverTimestamp() }, { merge:true });
  }
  const field = (kind==="IN") ? "rc" : "py";
  const batch = writeBatch(db);
  batch.update(ref, { [field]: increment(1), updatedAt: serverTimestamp() });
  await batch.commit();

  const fresh = await getDoc(ref);
  const n = Number(fresh.data()?.[field] || 1);
  const seq = String(n).padStart(6,"0");
  return `${kind==="IN" ? "RC" : "PY"}-${year}-${seq}`;
}

async function addTransaction({cashboxId, date, kind, amount, account, note, ref}){
  const year = Number((date||todayISO()).slice(0,4));
  const voucher = await getNextVoucher(cashboxId, kind, year);
  const cashRef = doc(db, "cashboxes", cashboxId);
  const txRef = doc(collection(db, "cashboxes", cashboxId, "transactions"));

  const delta = (kind==="IN") ? +Number(amount) : -Number(amount);

  const batch = writeBatch(db);
  batch.set(txRef, {
    date,
    voucher,
    kind,
    amount: Number(amount),
    account: account || "",
    note: note || "",
    status: "active",
    ref: ref || null,
    createdAt: serverTimestamp(),
    createdBy: state.user.uid,
  });

  const patch = {
    balance: increment(delta),
    lastTxAt: date,
  };
  const curYear = (new Date()).getFullYear();
  if(year === curYear){
    if(kind==="IN") patch.totalInYear = increment(+Number(amount));
    else patch.totalOutYear = increment(+Number(amount));
  }
  batch.update(cashRef, patch);
  await batch.commit();
  return { id: txRef.id, voucher };
}

async function voidTransaction(cashboxId, txId){
  const txRef = doc(db, "cashboxes", cashboxId, "transactions", txId);
  const snap = await getDoc(txRef);
  if(!snap.exists()) throw new Error("الحركة غير موجودة");
  const tx = snap.data();
  if(tx.status==="void") return;

  const delta = (tx.kind==="IN") ? -Number(tx.amount) : +Number(tx.amount);
  const year = Number(String(tx.date||"").slice(0,4) || 0);
  const batch = writeBatch(db);

  batch.update(txRef, { status:"void", voidedAt: serverTimestamp() });

  const cashRef = doc(db, "cashboxes", cashboxId);
  const patch = { balance: increment(delta) };
  const curYear = (new Date()).getFullYear();
  if(year === curYear){
    if(tx.kind==="IN") patch.totalInYear = increment(-Number(tx.amount));
    else patch.totalOutYear = increment(-Number(tx.amount));
  }
  batch.update(cashRef, patch);
  await batch.commit();
}

async function listTransactions(cashboxId){
  const qy = query(collection(db, "cashboxes", cashboxId, "transactions"), orderBy("date","asc"), orderBy("createdAt","asc"), limit(2000));
  const snap = await getDocs(qy);
  return snap.docs.map(d=>({ id:d.id, ...d.data() }));
}

async function listCheques({status="pending"}){
  let qy;
  if(status==="all"){
    qy = query(collection(db, "cheques"), orderBy("dueDate","asc"), limit(400));
  }else{
    qy = query(collection(db, "cheques"), where("status","==",status), orderBy("dueDate","asc"), limit(400));
  }
  const snap = await getDocs(qy);
  return snap.docs.map(d=>({ id:d.id, ...d.data() }));
}

async function createCheque(data){
  const ref = await addDoc(collection(db, "cheques"), {
    ...data,
    status: "pending",
    collectedDate: null,
    createdAt: serverTimestamp(),
    createdBy: state.user.uid,
  });
  return ref.id;
}

async function updateCheque(id, patch){
  await updateDoc(doc(db, "cheques", id), patch);
}

async function collectCheque(cheque){
  // 1) mark collected
  await updateDoc(doc(db, "cheques", cheque.id), { status:"collected", collectedDate: todayISO() });

  // 2) add IN transaction
  await addTransaction({
    cashboxId: cheque.cashboxId,
    date: todayISO(),
    kind: "IN",
    amount: Number(cheque.amount),
    account: `Cheque#${cheque.chequeNo}`,
    note: "Cheque collected",
    ref: { chequeId: cheque.id }
  });
}

// ----------------------- Image Upload (Cloudinary + Firebase Storage fallback) -----------------------
async function compressImageForUpload(file, maxW=1280, quality=0.82){
  const img = await new Promise((res, rej)=>{
    const i = new Image();
    i.onload = ()=>res(i);
    i.onerror = rej;
    i.src = URL.createObjectURL(file);
  });
  const scale = Math.min(1, maxW / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await new Promise((res)=> canvas.toBlob(res, "image/jpeg", quality));
  return new File([blob], (file?.name || "cheque") + ".jpg", { type: "image/jpeg" });
}

async function uploadChequeImageToCloudinary(file){
  if(!CLOUDINARY?.cloudName || !CLOUDINARY?.uploadPreset) throw new Error("Cloudinary غير مُعد");
  const small = await compressImageForUpload(file);
  const fd = new FormData();
  fd.append("file", small);
  fd.append("upload_preset", CLOUDINARY.uploadPreset);
  if(CLOUDINARY.folder) fd.append("folder", CLOUDINARY.folder);

  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`;

  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), 25000);

  const res = await fetch(url, { method:"POST", body: fd, signal: ctrl.signal })
    .catch(()=>{ throw new Error("فشل الاتصال بـ Cloudinary"); })
    .finally(()=>clearTimeout(t));

  const j = await res.json().catch(()=> ({}));
  if(!res.ok) throw new Error(j?.error?.message || "فشل رفع الصورة على Cloudinary");
  const out = j.secure_url || j.url;
  if(!out) throw new Error("Cloudinary لم يرجع رابط");
  return out;
}

async function uploadChequeImageToFirebaseStorage(file){
  const small = await compressImageForUpload(file);
  const path = `cheques/${state.user?.uid || "anon"}/${Date.now()}_${Math.random().toString(16).slice(2)}.jpg`;
  const r = sRef(storage, path);
  await uploadBytes(r, small, { contentType: "image/jpeg" });
  const url = await getDownloadURL(r);
  return url;
}

async function uploadChequeImageSmart(file){
  if(CLOUDINARY?.cloudName && CLOUDINARY?.uploadPreset){
    try{
      return await uploadChequeImageToCloudinary(file);
    }catch(e){
      toastOnce(`Cloudinary: ${errText(e)} — سيتم المحاولة عبر Firebase Storage`, "danger", "cloud_fail", 2500);
    }
  }
  return await uploadChequeImageToFirebaseStorage(file);
}

// ----------------------- Binders -----------------------
function bindShell(){
  applyTheme();

  const btnTheme = $("#btnTheme");
  btnTheme.onclick = nextThemeMode;

  const btnMenu = $("#btnMenu");
  btnMenu?.addEventListener("click", () => openDrawer(true));
  $("#drawerBackdrop")?.addEventListener("click", ()=>openDrawer(false));
  $("#btnCloseDrawer")?.addEventListener("click", ()=>openDrawer(false));
  $("#btnTheme2")?.addEventListener("click", ()=> { nextThemeMode(); render(); });

  $("#btnLogout")?.addEventListener("click", async ()=>{
    await signOut(auth);
    toast("تم تسجيل الخروج", "success");
    go("#login");
  });

  $("#btnInstall")?.addEventListener("click", async ()=>{
    if(!state.installPrompt) return;
    state.installPrompt.prompt();
    await state.installPrompt.userChoice.catch(()=>{});
    state.installPrompt = null;
    render();
  });
}

function openDrawer(on){
  state.drawerOpen = !!on;
  $("#drawerBackdrop")?.classList.toggle("show", state.drawerOpen);
  $("#drawer")?.classList.toggle("show", state.drawerOpen);
}

function bindLogin(){
  $("#btnLogin").onclick = async ()=>{
    const email = $("#email").value.trim();
    const pass = $("#pass").value;
    if(!email || !pass) return toast("اكتب الإيميل وكلمة المرور", "danger");
    try{
      await signInWithEmailAndPassword(auth, email, pass);
    }catch(e){
      toast(e?.message || "فشل تسجيل الدخول", "danger");
    }
  };
}

function bindDashboard(){
  (async ()=>{
    try{
      // Load data and paint into the existing dashboard view (no re-render loops)
      const cashboxes = await listCashboxes();
      const totalBalance = cashboxes.reduce((a,c)=>a+Number(c.balance||0),0);
      const pendingCheques = await listCheques({status:"pending"}).catch(()=>[]);
      // tx today: approximate by scanning small sample per cashbox (fast)
      let txToday = 0;
      const t = todayISO();
      for(const cb of cashboxes.slice(0,10)){
        const qy = query(collection(db,"cashboxes",cb.id,"transactions"), where("date","==",t), limit(50));
        const snap = await getDocs(qy);
        txToday += snap.size;
      }

      const k = $("#kpis");
      if(k){
        const nums = k.querySelectorAll(".num");
        nums[0].textContent = fmtMoney(cashboxes.length);
        nums[1].textContent = fmtMoney(totalBalance);
        nums[2].textContent = fmtMoney(pendingCheques.length);
        nums[3].textContent = fmtMoney(txToday);
      }

      const host = $("#recentCashboxes");
      if(host){
        host.innerHTML = cashboxes.slice(0,5).map(cb=>cashboxCard(cb)).join("") || `<div class="p">لا يوجد بيانات بعد</div>`;
        $$(".cashboxCard", host).forEach(el=>{
          el.onclick = ()=> go(`#statement/${el.dataset.id}`);
        });
      }
    }catch(e){
      // show the real error so we can debug (permissions, index, etc.)
      toast((e && e.message) ? `خطأ: ${e.message}` : "تعذر تحميل البيانات", "danger");
    }
  })();
}

function cashboxCard(cb){
  return `
    <div class="card cashboxCard" data-id="${escapeHtml(cb.id)}" style="cursor:pointer">
      <div class="row between">
        <div class="col">
          <div class="h2">${escapeHtml(cb.name||"—")}</div>
          <div class="p">الرصيد: <b>${fmtMoney(cb.balance)}</b> • آخر حركة: ${escapeHtml(cb.lastTxAt||"—")}</div>
        </div>
        <span class="badge">${cb.isActive ? "نشط" : "غير نشط"}</span>
      </div>
    </div>
  `;
}

function bindCashboxes(){
  let all = [];
  (async ()=>{
    try{
      all = await listCashboxes();
      paint(all);
    }catch(e){
      toast("تعذر تحميل الصناديق", "danger");
    }
  })();

  $("#cashboxSearch").addEventListener("input", (e)=>{
    const q = e.target.value.trim().toLowerCase();
    const filtered = all.filter(x=>String(x.name||"").toLowerCase().includes(q));
    paint(filtered);
  });

  $("#btnNewCashbox")?.addEventListener("click", ()=> openCashboxModal());

  function paint(list){
    const host = $("#cashboxList");
    host.innerHTML = (list.length ? list.map(cashboxCard).join("") : `<div class="container"><div class="card"><div class="p">لا يوجد صناديق</div></div></div>`);
    $$(".cashboxCard", host).forEach(el=>{
      el.onclick = ()=> go(`#statement/${el.dataset.id}`);
    });
    if(state.role==="admin"){
      // attach long-press menu (simple)
      $$(".cashboxCard", host).forEach(el=>{
        let pressTimer=null;
        el.addEventListener("touchstart", ()=>{ pressTimer = setTimeout(()=>openCashboxModal(all.find(x=>x.id===el.dataset.id)), 520); }, {passive:true});
        el.addEventListener("touchend", ()=>{ if(pressTimer) clearTimeout(pressTimer); });
      });
    }
  }
}

function openCashboxModal(cb){
  if(state.role!=="admin") return;
  const isEdit = !!cb;
  openModal(isEdit ? "تعديل صندوق" : "صندوق جديد", `
    <div class="col" style="gap:10px">
      <div>
        <div class="p">اسم الصندوق</div>
        <input id="mName" class="input" value="${escapeHtml(cb?.name||"")}" placeholder="مثال: صندوق المبيعات" />
      </div>
      <div>
        <div class="p">الرصيد الافتتاحي</div>
        <input id="mOpen" class="input" inputmode="decimal" value="${escapeHtml(String(cb?.openingBalance ?? 0))}" />
      </div>
      <div class="footnote">ملاحظة: تعديل الرصيد الافتتاحي لا يُعيد احتساب الحركات السابقة.</div>
    </div>
  `, `
    <button class="btn primary" id="mSave">حفظ</button>
    ${isEdit ? `<button class="btn danger" id="mDelete">${icon("trash")} حذف</button>` : ``}
  `);

  $("#mSave").onclick = async ()=>{
    const name = $("#mName").value.trim();
    const openingBalance = Number($("#mOpen").value || 0);
    if(!name) return toast("اكتب اسم الصندوق", "danger");
    try{
      if(isEdit){
        await updateCashbox(cb.id, { name, openingBalance });
        toast("تم التحديث", "success");
      }else{
        await createCashbox({ name, openingBalance });
        toast("تم الإنشاء", "success");
      }
      closeModal();
      render();
    }catch(e){
      toast(e?.message || "فشل الحفظ", "danger");
    }
  };

  $("#mDelete")?.addEventListener("click", async ()=>{
    if(!confirm("حذف الصندوق؟ (قد تفقد بيانات مرتبطة)")) return;
    try{
      await deleteCashbox(cb.id);
      toast("تم الحذف", "success");
      closeModal();
      render();
    }catch(e){
      toast("تعذر الحذف", "danger");
    }
  });
}

function bindStatement(){
  const cashboxId = state.arg;
  if(!cashboxId) return go("#cashboxes");

  const from = $("#fromDate");
  const to = $("#toDate");
  const now = todayISO();
  from.value = now.slice(0,4)+"-01-01";
  to.value = now;

  $("#btnReload").onclick = ()=> loadStatement();
  $("#btnAddTx")?.addEventListener("click", ()=> openTxModal({ cashboxId }));
  $("#btnExportCsv").onclick = ()=> exportCSV();
  $("#btnExportXlsx").onclick = ()=> exportXLSX();

  let txs = [];
  let cashbox = null;

  (async ()=>{
    try{
      const snap = await getDoc(doc(db,"cashboxes",cashboxId));
      if(!snap.exists()) return toast("الصندوق غير موجود", "danger");
      cashbox = { id: cashboxId, ...snap.data() };
      $("#stTitle").textContent = cashbox.name || cashboxId;

      await loadStatement();
    }catch(e){
      toastOnce(`تعذر تحميل الصندوق: ${errText(e)}`, "danger", "stmt_load");
    }
  })();

  async function loadStatement(){
    try{
      // lightweight loading (avoid full re-render loops)
      const host = $("#stTable");
      if(host) host.innerHTML = `<div class="p">جاري بناء الكشف…</div>`;
      const list = await listTransactions(cashboxId);
      const f = from.value || "0000-01-01";
      const t = to.value || "9999-12-31";
      txs = list.filter(x => (x.date||"") >= f && (x.date||"") <= t);

      // opening balance for period
      const before = list.filter(x => (x.date||"") < f);
      const opening = Number(cashbox.openingBalance||0) + before.reduce((a,x)=> a + ((x.status==="void")?0: (x.kind==="IN"?+x.amount:-x.amount)), 0);

      let run = opening;
      let totalIn=0, totalOut=0;

      const rows = txs.map(x=>{
        const eff = (x.status==="void") ? 0 : (x.kind==="IN" ? +x.amount : -x.amount);
        run += eff;
        if(x.status!=="void"){
          if(x.kind==="IN") totalIn += +x.amount;
          else totalOut += +x.amount;
        }
        return { ...x, running: run };
      });

      // render totals
      const totals = $("#stTotals").querySelectorAll(".num");
      totals[0].textContent = fmtMoney(totalIn);
      totals[1].textContent = fmtMoney(totalOut);

      // render table
      $("#stTable").innerHTML = renderTxTable(rows, opening);
      bindTxTable();

      // chart (monthly net)
      drawMonthlyNetChart(rows);

    }catch(e){
      toastOnce(`تعذر بناء الكشف: ${errText(e)}`, "danger", "stmt");
    }
  }

  function renderTxTable(rows, opening){
    if(!rows.length){
      return `<div class="p">لا توجد حركات في هذه الفترة</div>`;
    }
    return `
      <div class="badge">الرصيد الافتتاحي: <b>${fmtMoney(opening)}</b></div>
      <div style="height:10px"></div>
      <table class="table">
        <thead>
          <tr>
            <th>التاريخ</th>
            <th>السند</th>
            <th>النوع</th>
            <th>المبلغ</th>
            <th>الحساب</th>
            <th>ملاحظة</th>
            <th>الرصيد</th>
            ${state.role==="admin" ? `<th>إجراء</th>` : ``}
          </tr>
        </thead>
        <tbody>
          ${rows.map(r=>{
            const kindLbl = r.kind==="IN" ? "قبض" : "صرف";
            const status = r.status==="void" ? `<span class="badge" style="border-color:rgba(255,91,122,.35)">ملغي</span>` : "";
            return `
              <tr data-id="${escapeHtml(r.id)}">
                <td>${escapeHtml(r.date||"")}</td>
                <td>${escapeHtml(r.voucher||"")}</td>
                <td>${kindLbl} ${status}</td>
                <td><b>${fmtMoney(r.amount)}</b></td>
                <td>${escapeHtml(r.account||"")}</td>
                <td>${escapeHtml(r.note||"")}</td>
                <td><b>${fmtMoney(r.running)}</b></td>
                ${state.role==="admin" ? `<td>
                  ${r.status==="void" ? "" : `<button class="btn small danger btnVoid">إلغاء</button>`}
                </td>` : ``}
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  }

  function bindTxTable(){
    $$(".btnVoid").forEach(btn=>{
      btn.onclick = async (e)=>{
        const tr = e.target.closest("tr");
        const txId = tr?.dataset?.id;
        if(!txId) return;
        if(!confirm("إلغاء السند؟")) return;
        try{
          await voidTransaction(cashboxId, txId);
          toast("تم الإلغاء", "success");
          render();
        }catch(err){
          toast("تعذر الإلغاء", "danger");
        }
      };
    });
  }

  function drawMonthlyNetChart(rows){
    const map = new Map(); // yyyy-mm => net
    for(const r of rows){
      if(r.status==="void") continue;
      const ym = String(r.date||"").slice(0,7) || "---- --";
      const net = (r.kind==="IN") ? +r.amount : -r.amount;
      map.set(ym, (map.get(ym)||0) + net);
    }
    const labels = Array.from(map.keys());
    const values = labels.map(k=>map.get(k));
    drawBarChart($("#chart"), labels, values);
  }

  function exportCSV(){
    const rows = txs.map(x=>({
      date: x.date, voucher: x.voucher, kind: x.kind, amount: x.amount,
      account: x.account, note: x.note, status: x.status
    }));
    downloadCSV(rows, `statement_${cashboxId}_${from.value}_to_${to.value}.csv`);
  }

  async function exportXLSX(){
    const rows = txs.map(x=>({
      date: x.date, voucher: x.voucher, kind: x.kind, amount: x.amount,
      account: x.account, note: x.note, status: x.status
    }));
    await exportWithSheetJS(rows, `statement_${cashboxId}_${from.value}_to_${to.value}.xlsx`);
  }
}

function openTxModal({cashboxId}){
  if(state.role!=="admin") return;
  openModal("إضافة سند (قبض/صرف)", `
    <div class="grid2">
      <div class="col">
        <div class="p">التاريخ</div>
        <input id="txDate" class="input" type="date" value="${todayISO()}" />
      </div>
      <div class="col">
        <div class="p">النوع</div>
        <select id="txKind" class="input">
          <option value="IN">قبض (IN)</option>
          <option value="OUT">صرف (OUT)</option>
        </select>
      </div>
    </div>

    <div style="height:10px"></div>

    <div class="grid2">
      <div class="col">
        <div class="p">المبلغ</div>
        <input id="txAmount" class="input" inputmode="decimal" placeholder="0" />
      </div>
      <div class="col">
        <div class="p">الحساب</div>
        <input id="txAccount" class="input" placeholder="مثال: مبيعات / مصروفات" />
      </div>
    </div>

    <div style="height:10px"></div>

    <div class="col">
      <div class="p">ملاحظة</div>
      <textarea id="txNote" placeholder="اختياري…"></textarea>
    </div>
  `, `
    <button class="btn primary" id="txSave">حفظ</button>
  `);

  $("#txSave").onclick = async ()=>{
    const date = $("#txDate").value || todayISO();
    const kind = $("#txKind").value;
    const amount = Number($("#txAmount").value || 0);
    const account = $("#txAccount").value.trim();
    const note = $("#txNote").value.trim();
    if(!amount || amount<=0) return toast("اكتب مبلغ صحيح", "danger");
    if(!account) return toast("اكتب اسم الحساب", "danger");
    try{
      const r = await addTransaction({ cashboxId, date, kind, amount, account, note });
      toast(`تم حفظ السند: ${r.voucher}`, "success");
      closeModal();
      render();
    }catch(e){
      toast(e?.message || "فشل الحفظ", "danger");
    }
  };
}

function bindCheques(){
  let all = [];
  (async ()=>{
    try{
      all = await listCheques({status: $("#chequeStatus").value});
      paint(all);
    }catch(e){
      toast("تعذر تحميل الشيكات", "danger");
    }
  })();

  $("#chequeStatus").addEventListener("change", async ()=>{
    all = await listCheques({status: $("#chequeStatus").value});
    paint(all);
  });
  $("#chequeSearch").addEventListener("input", ()=>{
    const q = $("#chequeSearch").value.trim().toLowerCase();
    const filtered = all.filter(x=>String(x.chequeNo||"").toLowerCase().includes(q));
    paint(filtered);
  });

  $("#btnNewCheque")?.addEventListener("click", ()=> openChequeModal());

  function paint(list){
    const host = $("#chequeList");
    host.innerHTML = list.length ? list.map(chequeCard).join("") : `<div class="container"><div class="card"><div class="p">لا يوجد شيكات</div></div></div>`;
    $$(".btnCollect", host).forEach(btn=>{
      btn.onclick = async (e)=>{
        const id = e.target.closest("[data-id]")?.dataset?.id;
        const cheque = list.find(x=>x.id===id);
        if(!cheque) return;
        if(!confirm("تحصيل الشيك؟ سيتم إضافة سند قبض للصندوق.")) return;
        try{
          await collectCheque(cheque);
          toast("تم التحصيل", "success");
          render();
        }catch(err){
          toast("تعذر التحصيل", "danger");
        }
      };
    });

    $$(".btnEditCheque", host).forEach(btn=>{
      btn.onclick = (e)=>{
        const id = e.target.closest("[data-id]")?.dataset?.id;
        const cheque = list.find(x=>x.id===id);
        openChequeModal(cheque);
      };
    });

    $$(".btnViewImg", host).forEach(btn=>{
      btn.onclick = (e)=>{
        const id = e.target.closest("[data-id]")?.dataset?.id;
        const cheque = list.find(x=>x.id===id);
        if(cheque?.imageUrl) openImageViewer(cheque.imageUrl);
        else toast("لا توجد صورة", "danger");
      };
    });
  }

  function chequeCard(c){
    const st = c.status==="pending" ? `<span class="badge">معلّق</span>` : `<span class="badge" style="border-color:rgba(52,211,153,.35)">محصل</span>`;
    return `
      <div class="card" data-id="${escapeHtml(c.id)}">
        <div class="row between">
          <div class="col">
            <div class="h2">شيك #${escapeHtml(c.chequeNo||"")}</div>
            <div class="p">المبلغ: <b>${fmtMoney(c.amount)}</b> • الاستحقاق: ${escapeHtml(c.dueDate||"—")}</div>
            <div class="p">الصندوق: ${escapeHtml(c.cashboxId||"—")}</div>
          </div>
          ${st}
        </div>
        <div class="row" style="gap:10px; flex-wrap:wrap; margin-top:12px">
          <button class="btn small btnViewImg" type="button">${icon("edit")} صورة</button>
          ${state.role==="admin" ? `<button class="btn small btnEditCheque">${icon("edit")} تعديل</button>` : ``}
          ${state.role==="admin" && c.status==="pending" ? `<button class="btn small primary btnCollect">تحصيل</button>` : ``}
        </div>
      </div>
    `;
  }
}

function openChequeModal(c){
  if(state.role!=="admin") return;
  const isEdit = !!c;
  openModal(isEdit ? "تعديل شيك" : "شيك جديد", `
    <div class="grid2">
      <div class="col">
        <div class="p">رقم الشيك</div>
        <input id="chNo" class="input" value="${escapeHtml(c?.chequeNo||"")}" />
      </div>
      <div class="col">
        <div class="p">المبلغ</div>
        <input id="chAmount" class="input" inputmode="decimal" value="${escapeHtml(String(c?.amount ?? ""))}" />
      </div>
    </div>

    <div style="height:10px"></div>

    <div class="grid2">
      <div class="col">
        <div class="p">تاريخ الاستلام</div>
        <input id="chRecv" class="input" type="date" value="${escapeHtml(c?.receivedDate||todayISO())}" />
      </div>
      <div class="col">
        <div class="p">تاريخ الاستحقاق</div>
        <input id="chDue" class="input" type="date" value="${escapeHtml(c?.dueDate||todayISO())}" />
      </div>
    </div>

    <div style="height:10px"></div>

    <div class="col">
      <div class="p">Cashbox ID (معرف الصندوق)</div>
      <input id="chCashbox" class="input" value="${escapeHtml(c?.cashboxId||"")}" placeholder="من صفحة الصناديق: افتح كشف الحساب ثم انسخ المعرف من الرابط" />
      <div class="footnote">ملاحظة: لتجربة أسرع يمكنك لصق معرف الصندوق هنا.</div>
    </div>

    <div style="height:10px"></div>

    <div class="col">
      <div class="p">صورة الشيك (اختياري)</div>
      <input id="chImg" class="input" type="file" accept="image/*" />
      <div class="footnote">سيتم ضغط الصورة قبل الرفع لتوفير البيانات.</div>
    </div>
  `, `
    <button class="btn primary" id="chSave">حفظ</button>
  `);

  $("#chSave").onclick = async ()=>{
    const chequeNo = $("#chNo").value.trim();
    const amount = Number($("#chAmount").value || 0);
    const receivedDate = $("#chRecv").value || todayISO();
    const dueDate = $("#chDue").value || todayISO();
    const cashboxId = $("#chCashbox").value.trim();
    const imgFile = $("#chImg").files?.[0] || null;

    if(!chequeNo) return toast("اكتب رقم الشيك", "danger");
    if(!amount || amount<=0) return toast("اكتب مبلغ صحيح", "danger");
    if(!cashboxId) return toast("اكتب معرف الصندوق", "danger");

    try{
      let imageUrl = c?.imageUrl || "";
      if(imgFile){
        toastOnce("جاري رفع الصورة…", "info", "upl");
        imageUrl = await uploadChequeImageSmart(imgFile);
      }

      if(isEdit){
        await updateCheque(c.id, { chequeNo, amount, receivedDate, dueDate, cashboxId, imageUrl });
        toast("تم تحديث الشيك", "success");
      }else{
        await createCheque({ chequeNo, amount, receivedDate, dueDate, cashboxId, imageUrl });
        toast("تم إنشاء الشيك", "success");
      }
      closeModal();
      render();
    }catch(e){
      toast(e?.message || "فشل الحفظ", "danger");
    }
  };
}

function openImageViewer(url){
  openModal("صورة الشيك", `
    <div class="card" style="padding:10px; box-shadow:none">
      <img src="${escapeHtml(url)}" alt="cheque" style="border-radius:16px; border:1px solid var(--border)"/>
    </div>
  `, `<button class="btn" onclick="navigator.clipboard?.writeText('${escapeHtml(url)}');">نسخ الرابط</button>`);
}

function bindReport(){
  $("#btnRefreshReport").onclick = computeReport;
  computeReport();

  async function computeReport(){
    try{
      $("#reportBody").innerHTML = `<div class="p">جاري التجهيز…</div>`;
      const cashboxes = await listCashboxes();
      const totalBalance = cashboxes.reduce((a,c)=>a+Number(c.balance||0),0);
      const pending = await listCheques({status:"pending"}).catch(()=>[]);
      const collected = await listCheques({status:"collected"}).catch(()=>[]);

      $("#reportBody").innerHTML = `
        <div class="kpi">
          <div class="box"><div class="num">${fmtMoney(cashboxes.length)}</div><div class="lbl">عدد الصناديق</div></div>
          <div class="box"><div class="num">${fmtMoney(totalBalance)}</div><div class="lbl">إجمالي الأرصدة</div></div>
          <div class="box"><div class="num">${fmtMoney(pending.length)}</div><div class="lbl">شيكات معلّقة</div></div>
          <div class="box"><div class="num">${fmtMoney(collected.length)}</div><div class="lbl">شيكات مُحصّلة</div></div>
        </div>
        <hr class="sep"/>
        <div class="h2">أرصدة الصناديق</div>
        <div style="height:10px"></div>
        <table class="table">
          <thead><tr><th>الصندوق</th><th>الرصيد</th><th>آخر حركة</th></tr></thead>
          <tbody>
            ${cashboxes.slice(0,120).map(c=>`
              <tr>
                <td>${escapeHtml(c.name||c.id)}</td>
                <td><b>${fmtMoney(c.balance)}</b></td>
                <td>${escapeHtml(c.lastTxAt||"")}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      `;
    }catch(e){
      $("#reportBody").innerHTML = `<div class="p">تعذر تحميل التقرير</div>`;
    }
  }
}

function bindAdmin(){
  if(state.role!=="admin") return;

  $("#btnExportCashboxes").onclick = async ()=>{
    const cbs = await listCashboxes();
    downloadJSON(cbs, "cashboxes.json");
  };
  $("#btnExportCheques").onclick = async ()=>{
    const ch = await listCheques({status:"all"});
    downloadJSON(ch, "cheques.json");
  };

  $("#btnImportXlsx").onclick = async ()=>{
    const file = $("#xlsxFile").files?.[0];
    if(!file) return toast("اختر ملف XLSX", "danger");
    try{
      const XLSX = await loadSheetJS();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type:"array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval:"" });

      // Expected columns:
      // date, kind, amount, account, note, cashboxId
      let ok=0;
      for(const r of rows){
        const cashboxId = String(r.cashboxId||r.CashboxId||r.cashbox||"").trim();
        const date = String(r.date||r.Date||todayISO()).slice(0,10);
        const kind = String(r.kind||r.Kind||"IN").toUpperCase()==="OUT" ? "OUT" : "IN";
        const amount = Number(r.amount||r.Amount||0);
        const account = String(r.account||r.Account||"").trim();
        const note = String(r.note||r.Note||"").trim();
        if(!cashboxId || !amount || !account) continue;
        await addTransaction({ cashboxId, date, kind, amount, account, note });
        ok++;
      }
      toast(`تم استيراد ${ok} صف`, "success");
    }catch(e){
      toast(e?.message || "فشل الاستيراد", "danger");
    }
  };
}

// ----------------------- Export helpers -----------------------
function downloadBlob(blob, filename){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 250);
}
function downloadJSON(obj, filename){
  downloadBlob(new Blob([JSON.stringify(obj,null,2)], {type:"application/json"}), filename);
}
function downloadCSV(rows, filename){
  const headers = Object.keys(rows[0]||{});
  const esc = (v)=> `"${String(v??"").replace(/"/g,'""')}"`;
  const csv = [headers.join(","), ...rows.map(r=> headers.map(h=>esc(r[h])).join(","))].join("\n");
  downloadBlob(new Blob([csv], {type:"text/csv;charset=utf-8"}), filename);
}

async function loadSheetJS(){
  if(window.XLSX) return window.XLSX;
  await new Promise((res, rej)=>{
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.20.2/dist/xlsx.full.min.js";
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
  return window.XLSX;
}

async function exportWithSheetJS(rows, filename){
  const XLSX = await loadSheetJS();
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const out = XLSX.write(wb, { bookType:"xlsx", type:"array" });
  downloadBlob(new Blob([out], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}), filename);
}

// ----------------------- Chart (canvas) -----------------------
function drawBarChart(canvas, labels, values){
  if(!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(320, rect.width) * dpr;
  const h = Math.max(220, rect.height) * dpr;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0,0,w,h);

  const pad = 18*dpr;
  const baseY = h - pad*1.8;
  const baseX = pad*1.5;
  const topY = pad*1.2;
  const rightX = w - pad*1.1;

  const maxV = Math.max(1, ...values.map(v=>Math.abs(v)));
  const barW = (rightX - baseX) / Math.max(1, values.length);
  const barGap = barW * 0.26;
  const bw = Math.max(6*dpr, barW - barGap);

  // grid
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#fff";
  ctx.lineWidth = 1*dpr;
  for(let i=0;i<=4;i++){
    const y = topY + (baseY-topY)*(i/4);
    ctx.beginPath(); ctx.moveTo(baseX,y); ctx.lineTo(rightX,y); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const brand = getComputedStyle(document.documentElement).getPropertyValue("--brand").trim() || "#6ee7ff";
  const brand2 = getComputedStyle(document.documentElement).getPropertyValue("--brand-2").trim() || "#a78bfa";

  // bars
  for(let i=0;i<values.length;i++){
    const v = values[i];
    const x = baseX + i*barW + barGap/2;
    const barH = (Math.abs(v)/maxV) * (baseY-topY);
    const y = baseY - barH;

    const grad = ctx.createLinearGradient(0,y,0,baseY);
    grad.addColorStop(0, v>=0 ? brand : brand2);
    grad.addColorStop(1, "rgba(255,255,255,0.05)");

    roundRect(ctx, x, y, bw, barH, 10*dpr);
    ctx.fillStyle = grad;
    ctx.fill();

    // labels (limited)
    if(values.length <= 10){
      ctx.globalAlpha = 0.86;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = `${12*dpr}px system-ui`;
      const lbl = labels[i] || "";
      ctx.fillText(lbl, x, baseY + 16*dpr);
      ctx.globalAlpha = 1;
    }
  }

  // axis line
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.lineTo(rightX, baseY);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
function roundRect(ctx, x, y, w, h, r){
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr, y);
  ctx.arcTo(x+w, y, x+w, y+h, rr);
  ctx.arcTo(x+w, y+h, x, y+h, rr);
  ctx.arcTo(x, y+h, x, y, rr);
  ctx.arcTo(x, y, x+w, y, rr);
  ctx.closePath();
}

// ----------------------- Install prompt capture -----------------------
window.addEventListener("beforeinstallprompt", (e)=>{
  e.preventDefault();
  state.installPrompt = e;
  // do not force a toast; keep subtle
  render();
});

// ----------------------- Boot -----------------------
applyTheme();
onAuthStateChanged(auth, async (user)=>{
  state.user = user || null;
  if(user){
    await ensureUserProfile(user.uid).catch(()=>{ state.role = (user.uid===ADMIN_UID) ? "admin" : "viewer"; });
    if(!location.hash || location.hash==="#login") go("#dashboard");
  }else{
    state.role = "viewer";
    go("#login");
  }
  render();
});

// default route
if(!location.hash) go("#login");
