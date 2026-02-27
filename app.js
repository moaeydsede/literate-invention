import { firebaseConfig, ADMIN_UID, CLOUDINARY } from './firebase.js';

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, addDoc, collection,
  query, orderBy, getDocs, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const SHEETJS_URL = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (sel, root=document) => root.querySelector(sel);

const state = {
  user: null,
  profile: null,
  role: "viewer",
  page: "dashboard",
  arg: null,
  themeMode: "auto", // auto|dark|light
  installable: false,
};

let deferredInstallPrompt = null;

function todayISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}
function fmtMoney(n){
  const v = Number(n||0);
  return v.toLocaleString('ar-EG', { maximumFractionDigits: 2 });
}
function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
function toast(msg){
  let wrap = $("#toast-wrap");
  if(!wrap){
    wrap = document.createElement("div");
    wrap.id = "toast-wrap";
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(()=> t.remove(), 2600);
}


async function uploadChequeImageToCloudinary(file, onProgress){
  // Unsigned upload to Cloudinary
  // Endpoint: https://api.cloudinary.com/v1_1/<cloudName>/upload
  const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUDINARY.cloudName)}/upload`;
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY.uploadPreset);
  if(CLOUDINARY.folder) fd.append("folder", CLOUDINARY.folder);

  // Use XHR to get progress events
  const res = await new Promise((resolve, reject)=>{
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e)=>{
      if(!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 100);
      try{ onProgress?.(pct); }catch{}
    };
    xhr.onload = ()=>{
      try{
        const json = JSON.parse(xhr.responseText || "{}");
        if(xhr.status >= 200 && xhr.status < 300) resolve(json);
        else reject(new Error(json.error?.message || "Cloudinary upload failed"));
      }catch(err){
        reject(err);
      }
    };
    xhr.onerror = ()=> reject(new Error("Network error"));
    xhr.send(fd);
  });

  const secureUrl = res.secure_url || res.url;
  if(!secureUrl) throw new Error("No URL returned from Cloudinary");
  return secureUrl;
}
/* Theme */
function setTheme(mode){
  state.themeMode = mode;
  localStorage.setItem("themeMode", mode);
  applyTheme();
}
function applyTheme(){
  const saved = localStorage.getItem("themeMode") || "auto";
  state.themeMode = saved;
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved === "auto" ? (prefersDark ? "dark":"light") : saved;
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute("content", theme==="dark" ? "#0b1220" : "#f7f9ff");
}
function nextThemeMode(){
  const m = state.themeMode || "auto";
  return m === "auto" ? "dark" : (m === "dark" ? "light" : "auto");
}
function themeLabel(m){ return m === "auto" ? "Auto" : (m === "dark" ? "Dark" : "Light"); }

/* Icons */
function icon(name){
  const icons = {
    menu:`<svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    close:`<svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    sun:`<svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    box:`<svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M4 7l8-4 8 4-8 4-8-4Z" stroke="currentColor" stroke-width="2"/><path d="M4 7v10l8 4 8-4V7" stroke="currentColor" stroke-width="2"/></svg>`,
    plus:`<svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    excel:`<svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M4 4h10l6 6v10H4V4Z" stroke="currentColor" stroke-width="2"/><path d="M14 4v6h6" stroke="currentColor" stroke-width="2"/><path d="M7 16l3-4-3-4M11 8l3 4-3 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    logout:`<svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M10 17l-1 0a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4h1" stroke="currentColor" stroke-width="2"/><path d="M15 7l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 12H10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    cheq:`<svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M4 7h16v10H4V7Z" stroke="currentColor" stroke-width="2"/><path d="M7 10h6M7 14h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    report:`<svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M4 4h16v16H4V4Z" stroke="currentColor" stroke-width="2"/><path d="M7 16V8M12 16V6M17 16v-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    back:`<svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    void:`<svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    download:`<svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M12 3v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 11l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 21h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    settings:`<svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a7.9 7.9 0 0 0 .1-2l2-1.2-2-3.5-2.3.6a8 8 0 0 0-1.7-1L13.8 4h-3.6L8.7 7a8 8 0 0 0-1.7 1L4.7 7.4 2.7 11l2 1.2a7.9 7.9 0 0 0 .1 2l-2 1.2 2 3.5 2.3-.6a8 8 0 0 0 1.7 1l1.5 3h3.6l1.5-3a8 8 0 0 0 1.7-1l2.3.6 2-3.5-2-1.2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  };
  return icons[name] || "";
}

/* Routing */
function parseHash(){
  const h = (location.hash || "#dashboard").slice(1);
  const parts = h.split("/");
  return { page: parts[0] || "dashboard", arg: parts[1] || null };
}
window.addEventListener("hashchange", ()=>{ const r=parseHash(); state.page=r.page; state.arg=r.arg; render(); });

/* Views */
function render(){
  const root = $("#app");
  if(!state.user){ root.innerHTML = loginView(); bindLogin(); return; }
  root.innerHTML = shellView();
  bindShell();
  renderPage();
}

function shellView(){
  const themeMode = state.themeMode || "auto";
  const installBtn = state.installable ? `<button class="icon-btn" id="btn-install" title="Install">${icon("download")}</button>` : ``;

  return `
  <div class="app-shell">
    <header class="topbar">
      <div class="topbar__row">
        <div class="topbar__left">
          <button class="icon-btn" id="btn-menu" aria-label="menu">${icon("menu")}</button>
          <div class="topbar__title">
            <div class="h1">CashBoxes Pro</div>
            <div class="h2">${escapeHtml(state.profile?.email || "")} • ${escapeHtml(state.role)}</div>
          </div>
        </div>
        <div class="topbar__right">
          ${installBtn}
          <button class="icon-btn" id="btn-theme" title="Theme">${icon("sun")} <span>${themeLabel(themeMode)}</span></button>
        </div>
      </div>
    </header>

    <div class="drawer-backdrop" id="drawer-backdrop"></div>
    <aside class="drawer" id="drawer">
      <div class="drawer__hd">
        <div style="text-align:right">
          <div style="font-weight:950">القائمة</div>
          <div class="small">PWA • Firebase</div>
        </div>
        <button class="icon-btn" id="btn-close">${icon("close")}</button>
      </div>
      <div class="drawer__menu">
        ${navItem("dashboard","الرئيسية","ملخص وأرقام", "report")}
        ${navItem("cashboxes","الصناديق","قائمة الصناديق", "box")}
        ${navItem("cheques","الشيكات","Pending / Due / Collected", "cheq")}
        ${navItem("report","التقارير","ملخص شامل", "report")}
        ${state.role==="admin" ? navItem("admin","الأدمن","أدوات وإعدادات", "settings") : ""}
        <button class="navitem" id="btn-logout">
          <div><div class="t">تسجيل الخروج</div><div class="s">Logout</div></div>
          ${icon("logout")}
        </button>
      </div>
    </aside>

    <main class="main" id="main"></main>

    <nav class="bottom-nav" aria-label="Bottom navigation">
      ${bNav("dashboard","الرئيسية","report")}
      ${bNav("cashboxes","الصناديق","box")}
      ${bNav("cheques","الشيكات","cheq")}
      ${bNav("report","التقارير","report")}
    </nav>
  </div>`;
}

function navItem(page, title, subtitle, ico){
  const active = state.page === page ? "active" : "";
  return `<a class="navitem ${active}" href="#${page}">
    <div><div class="t">${escapeHtml(title)}</div><div class="s">${escapeHtml(subtitle)}</div></div>
    ${icon(ico)}
  </a>`;
}
function bNav(page, title, ico){
  const active = state.page === page ? "active" : "";
  return `<a class="bnav-btn ${active}" href="#${page}">${icon(ico)}<div>${escapeHtml(title)}</div></a>`;
}

function loginView(){
  return `
  <div class="splash">
    <div class="brand">
      <img src="icon-192.png" alt="" class="brand__logo" />
      <div class="brand__title">CashBoxes Pro</div>
      <div class="brand__sub">تسجيل دخول Firebase</div>
    </div>

    <div class="card" style="width:min(520px, 100%); text-align:right">
      <div class="card__hd"><div><div class="title">تسجيل الدخول</div><div class="sub">Admin / Viewer</div></div></div>
      <div class="card__bd">
        <div class="field">
          <label>البريد الإلكتروني</label>
          <input class="input" id="email" type="email" placeholder="name@domain.com" autocomplete="username" />
        </div>
        <div class="field">
          <label>كلمة المرور</label>
          <input class="input" id="password" type="password" placeholder="••••••••" autocomplete="current-password" />
        </div>
        <button class="btn btn--primary" id="btn-login">دخول</button>
        <div class="spacer"></div>
        <div class="small">الصلاحيات من Firestore: /users/{uid}.</div>
      </div>
    </div>

    <div class="muted">v2 • Premium UI</div>
  </div>`;
}

function bindLogin(){
  $("#btn-login")?.addEventListener("click", async ()=>{
    const email = $("#email").value.trim();
    const password = $("#password").value;
    if(!email || !password) return toast("أدخل البريد وكلمة المرور");
    try{ await signInWithEmailAndPassword(auth, email, password); }
    catch(e){ console.error(e); toast("فشل تسجيل الدخول — تحقق من البيانات"); }
  });
}

function bindShell(){
  const drawer = $("#drawer");
  const backdrop = $("#drawer-backdrop");
  const openDrawer = ()=>{ drawer.classList.add("open"); backdrop.classList.add("open"); };
  const closeDrawer = ()=>{ drawer.classList.remove("open"); backdrop.classList.remove("open"); };
  $("#btn-menu")?.addEventListener("click", openDrawer);
  $("#btn-close")?.addEventListener("click", closeDrawer);
  backdrop?.addEventListener("click", closeDrawer);
  document.addEventListener("click", (e)=>{ if(e.target.closest('a[href^="#"]')) closeDrawer(); });

  $("#btn-logout")?.addEventListener("click", async ()=>{ await signOut(auth); });

  $("#btn-theme")?.addEventListener("click", ()=>{ setTheme(nextThemeMode()); render(); });

  $("#btn-install")?.addEventListener("click", async ()=>{
    if(!deferredInstallPrompt) return toast("غير متاح الآن");
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    state.installable = false;
    toast(choice?.outcome === "accepted" ? "تم بدء التثبيت" : "تم الإلغاء");
    render();
  });
}

async function renderPage(){
  const main = $("#main");
  const { page, arg } = parseHash();
  state.page = page; state.arg = arg;

  const offlineBanner = !navigator.onLine ? `
    <div class="banner">
      <div><div class="t">أنت غير متصل</div><div class="s">سيعمل التطبيق بالملفات المحفوظة، لكن Firebase يحتاج إنترنت.</div></div>
      <span class="badge">Offline</span>
    </div>` : ``;

  if(page === "dashboard"){ main.innerHTML = offlineBanner + await dashboardView(); bindDashboard(); return; }
  if(page === "cashboxes"){ main.innerHTML = offlineBanner + await cashboxesView(); bindCashboxes(); return; }
  if(page === "statement"){ main.innerHTML = offlineBanner + await statementView(arg); bindStatement(arg); return; }
  if(page === "cheques"){ main.innerHTML = offlineBanner + await chequesView(); bindCheques(); return; }
  if(page === "report"){ main.innerHTML = offlineBanner + await reportView(); bindReport(); return; }
  if(page === "admin"){ main.innerHTML = offlineBanner + await adminView(); bindAdmin(); return; }

  main.innerHTML = offlineBanner + `<div class="card"><div class="card__bd">صفحة غير موجودة</div></div>`;
}

/* Data layer */
async function ensureUserProfile(user){
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    const role = user.uid === ADMIN_UID ? "admin" : "viewer";
    await setDoc(ref, { email: user.email || "", role, createdAt: serverTimestamp() });
  }
  const snap2 = await getDoc(ref);
  const data = snap2.data() || {};
  const role = (user.uid === ADMIN_UID) ? "admin" : (data.role || "viewer");
  state.profile = { email: data.email || user.email || "", role };
  state.role = role;
}

async function listCashboxes(includeInactive=false){
  const qy = query(collection(db,"cashboxes"), orderBy("createdAt","desc"));
  const snap = await getDocs(qy);
  const arr = [];
  snap.forEach(d=>{
    const x = d.data();
    if(includeInactive || x.isActive !== false) arr.push({ id:d.id, ...x });
  });
  return arr;
}

async function chequesCounts(){
  const snap = await getDocs(collection(db,"cheques"));
  let pending=0, due=0, collected=0;
  const t = todayISO();
  snap.forEach(d=>{
    const x = d.data();
    if(x.status==="pending"){ pending++; if(x.dueDate && x.dueDate <= t) due++; }
    if(x.status==="collected") collected++;
  });
  return { pending, due, collected };
}

/* Dashboard */
async function dashboardView(){
  const cashboxes = await listCashboxes();
  const totalBalance = cashboxes.reduce((s,c)=> s + Number(c.balance||0), 0);
  const cheq = await chequesCounts();

  return `
    <div class="card">
      <div class="card__hd">
        <div><div class="title">ملخص سريع</div><div class="sub">${new Date().toLocaleString('ar-EG')}</div></div>
        <span class="badge">${cashboxes.length} صناديق</span>
      </div>
      <div class="card__bd">
        <div class="grid2">
          <div class="tile"><div class="k">إجمالي الأرصدة</div><div class="v">${fmtMoney(totalBalance)}</div></div>
          <div class="tile"><div class="k">شيكات معلّقة</div><div class="v">${cheq.pending}</div></div>
          <div class="tile"><div class="k">شيكات مستحقة/متأخرة</div><div class="v">${cheq.due}</div></div>
          <div class="tile"><div class="k">شيكات مُحصّلة</div><div class="v">${cheq.collected}</div></div>
        </div>
        <div class="sep"></div>
        <div class="hstack">
          <a class="btn btn--primary" href="#cashboxes">${icon("box")} الصناديق</a>
          <a class="btn" href="#cheques">${icon("cheq")} الشيكات</a>
          <a class="btn" href="#report">${icon("report")} التقارير</a>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card__hd">
        <div><div class="title">الصناديق</div><div class="sub">اضغط لفتح كشف الحساب</div></div>
        ${state.role==="admin" ? `<button class="btn btn--ghost" id="btn-add-cb">${icon("plus")} إضافة</button>` : ``}
      </div>
      <div class="card__bd">
        ${cashboxes.length ? cashboxes.map(cb => cashboxCard(cb)).join("") : `<div class="small">لا توجد صناديق بعد.</div>`}
      </div>
    </div>
  `;
}

function cashboxCard(cb){
  return `
  <a class="navitem" href="#statement/${encodeURIComponent(cb.id)}" style="margin-bottom:10px">
    <div>
      <div class="t">${escapeHtml(cb.name || "بدون اسم")}</div>
      <div class="s">افتتاحي: ${fmtMoney(cb.openingBalance)} • الحالي: <b>${fmtMoney(cb.balance)}</b></div>
      <div class="s">${escapeHtml(cb.id)}</div>
    </div>
    <span class="badge">${cb.isActive===false ? "موقوف" : "نشط"}</span>
  </a>`;
}
function bindDashboard(){ $("#btn-add-cb")?.addEventListener("click", ()=> openCashboxModal()); }

/* Cashboxes */
async function cashboxesView(){
  const cashboxes = await listCashboxes(true);
  return `
    <div class="card">
      <div class="card__hd">
        <div><div class="title">الصناديق</div><div class="sub">بحث سريع + إدارة</div></div>
        ${state.role==="admin" ? `<button class="btn btn--ghost" id="btn-add-cb">${icon("plus")} إضافة</button>` : ``}
      </div>
      <div class="card__bd">
        <div class="field" style="margin-bottom:10px">
          <label>بحث</label>
          <input class="input" id="cb-q" placeholder="ابحث بالاسم..." />
        </div>
        <div id="cb-list">
          ${cashboxes.length ? cashboxes.map(cb => cashboxCard(cb)).join("") : `<div class="small">لا توجد صناديق بعد.</div>`}
        </div>
      </div>
    </div>
  `;
}
function bindCashboxes(){
  $("#btn-add-cb")?.addEventListener("click", ()=> openCashboxModal());
  const q = $("#cb-q");
  const list = $("#cb-list");
  if(q && list){
    q.addEventListener("input", async ()=>{
      const all = await listCashboxes(true);
      const term = q.value.trim().toLowerCase();
      const filtered = all.filter(c => (c.name||"").toLowerCase().includes(term));
      list.innerHTML = filtered.map(cashboxCard).join("") || `<div class="small">لا نتائج.</div>`;
    });
  }
}

/* Modal */
function modal(html){
  const d = document.createElement("div");
  d.className = "drawer-backdrop open";
  d.style.display="block";
  d.innerHTML = `<div style="position:fixed; inset:0; display:flex; align-items:flex-end; justify-content:center; padding:12px; padding-bottom:calc(12px + env(safe-area-inset-bottom)); z-index:90">
    <div class="card" style="width:min(560px, 100%)">${html}</div>
  </div>`;
  d.addEventListener("click", (e)=>{ if(e.target===d) d.remove(); });
  document.body.appendChild(d);
  return d;
}

function openCashboxModal(existing=null){
  if(state.role!=="admin") return toast("غير مسموح");
  const isEdit = !!existing;
  const m = modal(`
    <div class="card__hd">
      <div><div class="title">${isEdit ? "تعديل صندوق" : "إضافة صندوق"}</div><div class="sub">${isEdit ? "تحديث بيانات الصندوق" : "اسم + رصيد افتتاحي"}</div></div>
      <button class="icon-btn" data-close>${icon("close")}</button>
    </div>
    <div class="card__bd">
      <div class="field"><label>اسم الصندوق</label><input class="input" id="cb-name" value="${escapeHtml(existing?.name||"")}" placeholder="مثال: خزنة المكتب" /></div>
      <div class="field"><label>الرصيد الافتتاحي</label><input class="input" id="cb-open" type="number" inputmode="decimal" value="${existing?.openingBalance ?? 0}" /></div>
      <button class="btn btn--primary" id="cb-save">${isEdit ? "حفظ التعديل" : "إنشاء الصندوق"}</button>
      ${isEdit ? `<div class="spacer"></div><button class="btn" id="cb-toggle">${existing?.isActive===false ? "تفعيل" : "إيقاف"} الصندوق</button>` : ""}
    </div>
  `);
  m.querySelector("[data-close]")?.addEventListener("click", ()=> m.remove());
  m.querySelector("#cb-save")?.addEventListener("click", async ()=>{
    const name = m.querySelector("#cb-name").value.trim();
    const openingBalance = Number(m.querySelector("#cb-open").value || 0);
    if(!name) return toast("اكتب اسم الصندوق");
    try{
      if(isEdit){
        await updateDoc(doc(db,"cashboxes", existing.id), { name, openingBalance });
      }else{
        await addDoc(collection(db,"cashboxes"), {
          name, openingBalance,
          balance: openingBalance,
          totalInYear: 0, totalOutYear: 0,
          lastTxAt: "",
          isActive: true,
          createdAt: serverTimestamp(),
          createdBy: state.user.uid,
        });
      }
      toast("تم الحفظ");
      m.remove();
      render();
    }catch(e){ console.error(e); toast("تعذر الحفظ"); }
  });
  m.querySelector("#cb-toggle")?.addEventListener("click", async ()=>{
    try{
      await updateDoc(doc(db,"cashboxes", existing.id), { isActive: !(existing.isActive!==false) });
      toast("تم التحديث");
      m.remove();
      render();
    }catch(e){ console.error(e); toast("تعذر التحديث"); }
  });
}

/* Statement */
async function getCounterRef(cashboxId, year){
  return doc(db, "cashboxes", cashboxId, "meta", `counters_${year}`);
}
async function getNextVoucher(cashboxId, kind, year){
  const ref = await getCounterRef(cashboxId, year);
  const snap = await getDoc(ref);
  let rc=0, py=0;
  if(snap.exists()){ const d=snap.data(); rc=Number(d.rc||0); py=Number(d.py||0); }
  else { await setDoc(ref, { rc:0, py:0 }); }
  if(kind==="IN"){ rc += 1; await updateDoc(ref, { rc }); return `RC-${year}-${String(rc).padStart(6,"0")}`; }
  py += 1; await updateDoc(ref, { py }); return `PY-${year}-${String(py).padStart(6,"0")}`;
}
async function addTransaction(cashboxId, { kind, date, amount, account, note, refObj=null }){
  const year = Number((date||todayISO()).slice(0,4));
  const voucher = await getNextVoucher(cashboxId, kind, year);

  const tx = { date, voucher, kind, amount, account, note: note||"", status:"active", ref: refObj, createdAt: serverTimestamp(), createdBy: state.user.uid };

  const cbRef = doc(db, "cashboxes", cashboxId);
  const txCol = collection(db, "cashboxes", cashboxId, "transactions");
  const batch = writeBatch(db);

  const cbSnap = await getDoc(cbRef);
  if(!cbSnap.exists()) throw new Error("cashbox missing");
  const cb = cbSnap.data();
  const delta = (kind==="IN") ? amount : -amount;

  batch.set(doc(txCol), tx);
  const updates = { balance: (cb.balance ?? cb.openingBalance ?? 0) + delta, lastTxAt: date };
  const currentYear = new Date().getFullYear();
  if(year === currentYear){
    updates.totalInYear = (cb.totalInYear ?? 0) + (kind==="IN" ? amount : 0);
    updates.totalOutYear = (cb.totalOutYear ?? 0) + (kind==="OUT" ? amount : 0);
  }
  batch.update(cbRef, updates);
  await batch.commit();
}
async function voidTransaction(cashboxId, txId){
  if(state.role!=="admin") throw new Error("forbidden");

  const cbRef = doc(db, "cashboxes", cashboxId);
  const txRef = doc(db, "cashboxes", cashboxId, "transactions", txId);

  const [cbSnap, txSnap] = await Promise.all([getDoc(cbRef), getDoc(txRef)]);
  if(!cbSnap.exists() || !txSnap.exists()) throw new Error("missing");
  const cb = cbSnap.data();
  const tx = txSnap.data();
  if(tx.status === "void") return;

  const amount = Number(tx.amount||0);
  const kind = tx.kind;
  const date = tx.date || todayISO();
  const year = Number(date.slice(0,4));
  const delta = (kind==="IN") ? -amount : +amount;

  const batch = writeBatch(db);
  batch.update(txRef, { status:"void", voidedAt: serverTimestamp(), voidedBy: state.user.uid });

  const updates = { balance: (cb.balance ?? cb.openingBalance ?? 0) + delta };
  const currentYear = new Date().getFullYear();
  if(year === currentYear){
    updates.totalInYear = (cb.totalInYear ?? 0) + (kind==="IN" ? -amount : 0);
    updates.totalOutYear = (cb.totalOutYear ?? 0) + (kind==="OUT" ? -amount : 0);
  }
  batch.update(cbRef, updates);
  await batch.commit();
}

async function buildStatement(cashboxId, from, to){
  const cbSnap = await getDoc(doc(db,"cashboxes",cashboxId));
  const cb = cbSnap.data() || {};
  const openingBalance = Number(cb.openingBalance||0);

  const txCol = collection(db,"cashboxes",cashboxId,"transactions");
  const qy = query(txCol, orderBy("date","asc"), orderBy("createdAt","asc"));
  const snap = await getDocs(qy);
  const all = [];
  snap.forEach(d=> all.push({ id:d.id, ...d.data() }));

  const fromISO = from || "";
  const toISO = to || "";

  const beforeFrom = all.filter(t => t.status!=="void" && fromISO && t.date < fromISO);
  const inBefore = beforeFrom.filter(t=>t.kind==="IN").reduce((s,t)=> s+Number(t.amount||0), 0);
  const outBefore = beforeFrom.filter(t=>t.kind==="OUT").reduce((s,t)=> s+Number(t.amount||0), 0);
  const openingForPeriod = openingBalance + inBefore - outBefore;

  const within = all.filter(t=>{
    if(t.status==="void") return false;
    if(fromISO && t.date < fromISO) return false;
    if(toISO && t.date > toISO) return false;
    return true;
  });

  let running = openingForPeriod;
  const rows = within.map((t, idx)=>{
    const amt = Number(t.amount||0);
    running += (t.kind==="IN") ? amt : -amt;
    return { ...t, i: idx+1, running };
  });

  const totals = {
    in: rows.filter(r=>r.kind==="IN").reduce((s,r)=> s+Number(r.amount||0), 0),
    out: rows.filter(r=>r.kind==="OUT").reduce((s,r)=> s+Number(r.amount||0), 0),
  };
  return { openingForPeriod, rows, totals };
}

function exportCSV(rows, filename){
  const header = ["#", "date", "voucher", "account", "note", "in", "out", "balance"];
  const lines = [header.join(",")];
  for(const r of rows){
    const inAmt = r.kind==="IN" ? r.amount : "";
    const outAmt = r.kind==="OUT" ? r.amount : "";
    lines.push([
      r.i, r.date, r.voucher||"", (r.account||"").replaceAll(","," "), (r.note||"").replaceAll(","," "),
      inAmt, outAmt, r.running
    ].join(","));
  }
  const blob = new Blob([lines.join("\n")], { type:"text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function loadSheetJS(){
  if(window.XLSX) return;
  await new Promise((resolve, reject)=>{
    const s = document.createElement("script");
    s.src = SHEETJS_URL;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function statementView(cashboxId){
  if(!cashboxId) return `<div class="card"><div class="card__bd">اختر صندوقاً</div></div>`;
  const cbRef = doc(db,"cashboxes", cashboxId);
  const cbSnap = await getDoc(cbRef);
  if(!cbSnap.exists()) return `<div class="card"><div class="card__bd">الصندوق غير موجود</div></div>`;
  const cb = { id: cashboxId, ...cbSnap.data() };

  const from = (localStorage.getItem(`from_${cashboxId}`) || "");
  const to = (localStorage.getItem(`to_${cashboxId}`) || "");
  const { openingForPeriod, rows, totals } = await buildStatement(cashboxId, from, to);

  return `
    <div class="card">
      <div class="card__hd">
        <div><div class="title">${escapeHtml(cb.name||"صندوق")}</div><div class="sub">كشف حساب</div></div>
        <a class="btn btn--ghost" href="#cashboxes">${icon("back")} رجوع</a>
      </div>
      <div class="card__bd">
        <div class="grid2">
          <div class="tile"><div class="k">${(from && to && from===to) ? "افتتاحي قبل اليوم" : "افتتاحي للفترة"}</div><div class="v">${fmtMoney(openingForPeriod)}</div></div>
          <div class="tile"><div class="k">الرصيد الافتتاحي (الصندوق)</div><div class="v">${fmtMoney(cb.openingBalance)}</div></div>
          <div class="tile"><div class="k">الرصيد الحالي</div><div class="v">${fmtMoney(cb.balance)}</div></div>
          <div class="tile"><div class="k">إجمالي مقبوضات</div><div class="v">${fmtMoney(totals.in)}</div></div>
          <div class="tile"><div class="k">إجمالي مدفوعات</div><div class="v">${fmtMoney(totals.out)}</div></div>
        </div>

        <div class="sep"></div>

        <div class="row">
          <div class="field"><label>من</label><input class="input" id="st-from" type="date" value="${escapeHtml(from)}" /></div>
          <div class="field"><label>إلى</label><input class="input" id="st-to" type="date" value="${escapeHtml(to)}" /></div>
        </div>
        <div class="hstack">
          <button class="btn" id="st-apply">تطبيق</button>
          ${state.role==="admin" ? `<button class="btn btn--primary" id="btn-add-tx">${icon("plus")} عملية</button>` : ``}
          <button class="btn" id="btn-export-csv">${icon("excel")} CSV</button>
          ${state.role==="admin" ? `<button class="btn" id="btn-import-xlsx">${icon("excel")} Excel</button>` : ``}
        </div>

        <div class="sep"></div>

        <div style="overflow:auto">
          <table class="table">
            <thead>
              <tr>
                <th>#</th><th>التاريخ</th><th>السند</th><th>الحساب</th><th>البيان</th><th>مقبوض</th><th>مدفوع</th><th>الرصيد</th>
                ${state.role==="admin" ? `<th>إجراء</th>` : ``}
              </tr>
            </thead>
            <tbody>
              ${rows.length ? rows.map(r => txRow(r)).join("") : `<tr><td colspan="${state.role==="admin"?9:8}"><span class="small">لا توجد حركات ضمن الفترة.</span></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
function txRow(r){
  const inAmt = r.kind==="IN" ? fmtMoney(r.amount) : "";
  const outAmt = r.kind==="OUT" ? fmtMoney(r.amount) : "";
  return `<tr data-txid="${escapeHtml(r.id)}">
    <td>${r.i}</td>
    <td>${escapeHtml(r.date)}</td>
    <td>${escapeHtml(r.voucher || "")}</td>
    <td class="wrap">${escapeHtml(r.account || "")}</td>
    <td class="wrap">${escapeHtml(r.note || "")}</td>
    <td>${inAmt}</td>
    <td>${outAmt}</td>
    <td><b>${fmtMoney(r.running)}</b></td>
    ${state.role==="admin" ? `<td><button class="icon-btn" data-void title="Void">${icon("void")}</button></td>` : ``}
  </tr>`;
}

async function bindStatement(cashboxId){
  $("#st-apply")?.addEventListener("click", ()=>{
    localStorage.setItem(`from_${cashboxId}`, $("#st-from").value);
    localStorage.setItem(`to_${cashboxId}`, $("#st-to").value);
    render();
  });
  $("#btn-add-tx")?.addEventListener("click", ()=> openTxModal(cashboxId));
  $("#btn-export-csv")?.addEventListener("click", async ()=>{
    const { rows } = await buildStatement(cashboxId, $("#st-from").value, $("#st-to").value);
    exportCSV(rows, `transactions_${cashboxId}_${$("#st-from").value||"all"}_to_${$("#st-to").value||"all"}.csv`);
  });
  $("#btn-import-xlsx")?.addEventListener("click", ()=> openImportModal(cashboxId));

  $("#main")?.addEventListener("click", async (e)=>{
    const btn = e.target.closest("[data-void]");
    if(!btn) return;
    const tr = e.target.closest("tr[data-txid]");
    const txid = tr?.dataset?.txid;
    if(!txid) return;
    if(!confirm("إلغاء هذا السند (Void)؟")) return;
    await voidTransaction(cashboxId, txid);
    toast("تم الإلغاء");
    render();
  });
}

function openTxModal(cashboxId){
  if(state.role!=="admin") return toast("غير مسموح");
  const m = modal(`
    <div class="card__hd"><div><div class="title">إضافة عملية</div><div class="sub">قبض / صرف</div></div><button class="icon-btn" data-close>${icon("close")}</button></div>
    <div class="card__bd">
      <div class="row">
        <div class="field"><label>النوع</label>
          <select id="tx-kind"><option value="IN">قبض (IN)</option><option value="OUT">صرف (OUT)</option></select>
        </div>
        <div class="field"><label>التاريخ</label><input class="input" id="tx-date" type="date" value="${todayISO()}" /></div>
      </div>
      <div class="field"><label>المبلغ</label><input class="input" id="tx-amount" type="number" inputmode="decimal" placeholder="0" /></div>
      <div class="field"><label>الحساب / الطرف</label><input class="input" id="tx-account" placeholder="اسم الطرف" /></div>
      <div class="field"><label>البيان (اختياري)</label><input class="input" id="tx-note" placeholder="ملاحظة" /></div>
      <button class="btn btn--primary" id="tx-save">${icon("plus")} حفظ</button>
      <div class="small">RC/PY-YYYY-XXXXXX تلقائي.</div>
    </div>
  `);
  m.querySelector("[data-close]")?.addEventListener("click", ()=> m.remove());
  m.querySelector("#tx-save")?.addEventListener("click", async ()=>{
    const kind = m.querySelector("#tx-kind").value;
    const date = m.querySelector("#tx-date").value || todayISO();
    const amount = Number(m.querySelector("#tx-amount").value || 0);
    const account = m.querySelector("#tx-account").value.trim();
    const note = m.querySelector("#tx-note").value.trim();
    if(!amount || amount<=0) return toast("أدخل مبلغاً صحيحاً");
    if(!account) return toast("أدخل الحساب/الطرف");
    try{
      await addTransaction(cashboxId, { kind, date, amount, account, note });
      toast("تمت الإضافة");
      m.remove();
      render();
    }catch(e){ console.error(e); toast("تعذر الإضافة"); }
  });
}

function openImportModal(cashboxId){
  if(state.role!=="admin") return toast("غير مسموح");
  const m = modal(`
    <div class="card__hd"><div><div class="title">استيراد Excel</div><div class="sub">Date / Account / Receipts / Payments / Statement</div></div><button class="icon-btn" data-close>${icon("close")}</button></div>
    <div class="card__bd">
      <input class="input" id="file" type="file" accept=".xlsx,.xls" />
      <div class="spacer"></div>
      <button class="btn btn--primary" id="go">${icon("excel")} استيراد</button>
      <div class="small">سيتم تجاهل الصفوف غير الصالحة.</div>
    </div>
  `);
  m.querySelector("[data-close]")?.addEventListener("click", ()=> m.remove());
  m.querySelector("#go")?.addEventListener("click", async ()=>{
    const f = m.querySelector("#file").files?.[0];
    if(!f) return toast("اختر ملف Excel");
    try{
      await loadSheetJS();
      const buf = await f.arrayBuffer();
      const wb = window.XLSX.read(buf, { type:"array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = window.XLSX.utils.sheet_to_json(ws, { defval:"" });

      let ok = 0;
      for(const row of json){
        const date = String(row.Date || row.date || "").slice(0,10);
        const account = String(row.Account || row.account || "").trim();
        const receipts = Number(row.Receipts || row.receipts || 0);
        const payments = Number(row.Payments || row.payments || 0);
        const note = String(row.Statement || row.statement || "").trim();

        if(!date || !account) continue;
        if((receipts>0 && payments>0) || (receipts<=0 && payments<=0)) continue;

        const kind = receipts>0 ? "IN" : "OUT";
        const amount = receipts>0 ? receipts : payments;
        await addTransaction(cashboxId, { kind, date, amount, account, note });
        ok += 1;
      }
      toast(`تم استيراد ${ok} صف`);
      m.remove();
      render();
    }catch(e){ console.error(e); toast("فشل الاستيراد"); }
  });
}

/* Cheques */
async function chequesView(){
  const cashboxes = await listCashboxes(true);
  const snap = await getDocs(query(collection(db,"cheques"), orderBy("dueDate","asc")));
  const t = todayISO();

  const pending = [], due = [], collected = [];
  snap.forEach(d=>{
    const x = { id:d.id, ...d.data() };
    if(x.status==="pending"){ pending.push(x); if(x.dueDate && x.dueDate <= t) due.push(x); }
    else if(x.status==="collected"){ collected.push(x); }
  });

  const section = (title, sub, arr, mode)=>(`
    <div class="card">
      <div class="card__hd"><div><div class="title">${title}</div><div class="sub">${sub}</div></div><span class="badge">${arr.length}</span></div>
      <div class="card__bd">${arr.length ? arr.map(c=> chequeCard(c, mode, cashboxes)).join("") : `<div class="small">لا توجد بيانات.</div>`}</div>
    </div>
  `);

  return `
    <div class="hstack">
      ${state.role==="admin" ? `<button class="btn btn--primary" id="btn-add-cheq">${icon("plus")} إضافة شيك</button>` : ``}
      <a class="btn" href="#cashboxes">${icon("box")} الصناديق</a>
    </div>
    ${section("معلّقة", "pending", pending, "pending")}
    ${section("مستحقة/متأخرة", "dueDate <= اليوم", due, "due")}
    ${section("مُحصّلة", "collected", collected, "collected")}
  `;
}

function chequeCard(c, mode, cashboxes){
  const dueClass = (mode==="due") ? ` style="outline:2px solid color-mix(in srgb, var(--warn) 35%, transparent)"` : "";
  const cbName = cashboxes.find(x=>x.id===c.cashboxId)?.name || c.cashboxId || "";
  return `
    <div class="navitem" ${dueClass} style="margin-bottom:10px">
      <div>
        <div class="t">شيك #${escapeHtml(c.chequeNo||"")}</div>
        <div class="s">قيمة: <b>${fmtMoney(c.amount)}</b> • استلام: ${escapeHtml(c.receivedDate||"")} • استحقاق: ${escapeHtml(c.dueDate||"")}</div>
        <div class="s">صندوق: ${escapeHtml(cbName)}</div>
      </div>
      <div class="hstack">
        ${c.imageUrl ? `<a class="icon-btn" href="${escapeHtml(c.imageUrl)}" target="_blank" rel="noopener">صورة</a>` : ``}
        ${state.role==="admin" && c.status==="pending" ? `<button class="icon-btn" data-collect data-id="${escapeHtml(c.id)}">تحصيل</button>` : ``}
      </div>
    </div>`;
}

function bindCheques(){
  $("#btn-add-cheq")?.addEventListener("click", ()=> openChequeModal());
  $("#main")?.addEventListener("click", async (e)=>{
    const btn = e.target.closest("[data-collect]");
    if(!btn) return;
    const id = btn.dataset.id;
    if(!confirm("تأكيد التحصيل؟ سيُضاف قبض للصندوق.")) return;
    await collectCheque(id);
    toast("تم التحصيل");
    render();
  });
}

async function openChequeModal(){
  if(state.role!=="admin") return toast("غير مسموح");
  const cashboxes = await listCashboxes(true);
  const options = cashboxes.map(c=> `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name||c.id)}</option>`).join("");
  const m = modal(`
    <div class="card__hd"><div><div class="title">إضافة شيك</div><div class="sub">pending</div></div><button class="icon-btn" data-close>${icon("close")}</button></div>
    <div class="card__bd">
      <div class="field"><label>الصندوق</label><select id="c-cb">${options}</select></div>
      <div class="row">
        <div class="field"><label>رقم الشيك</label><input class="input" id="c-no" placeholder="12345" /></div>
        <div class="field"><label>القيمة</label><input class="input" id="c-amt" type="number" inputmode="decimal" placeholder="0" /></div>
      </div>
      <div class="row">
        <div class="field"><label>تاريخ الاستلام</label><input class="input" id="c-rec" type="date" value="${todayISO()}" /></div>
        <div class="field"><label>تاريخ الاستحقاق</label><input class="input" id="c-due" type="date" value="${todayISO()}" /></div>
      </div>
      
      <div class="field">
        <label>صورة الشيك (رفع على Cloudinary)</label>
        <input class="input" id="c-file" type="file" accept="image/*" />
        <div class="spacer"></div>
        <div class="progress hidden" id="c-prog"><div></div></div>
        <div class="small">أو ضع رابط يدوي (اختياري):</div>
        <input class="input" id="c-img" placeholder="https://..." />
      </div>
      <button class="btn btn--primary" id="c-save">${icon("plus")} حفظ</button>
    </div>
  `);
  m.querySelector("[data-close]")?.addEventListener("click", ()=> m.remove());
  m.querySelector("#c-save")?.addEventListener("click", async ()=>{
    const cashboxId = m.querySelector("#c-cb").value.trim();
    const chequeNo = m.querySelector("#c-no").value.trim();
    const amount = Number(m.querySelector("#c-amt").value || 0);
    const receivedDate = m.querySelector("#c-rec").value || todayISO();
    const dueDate = m.querySelector("#c-due").value || todayISO();
    const file = m.querySelector("#c-file").files?.[0] || null;
    let imageUrl = m.querySelector("#c-img").value.trim();

    // If file selected: upload to Cloudinary unsigned
    if(file){
      const progWrap = m.querySelector("#c-prog");
      const progBar = progWrap?.querySelector("div");
      if(progWrap){ progWrap.classList.remove("hidden"); }
      try{
        imageUrl = await uploadChequeImageToCloudinary(file, (pct)=>{
          if(progBar) progBar.style.width = `${pct}%`;
        });
      }catch(err){
        console.error(err);
        return toast("فشل رفع الصورة (Cloudinary)");
      }
    }
    if(!cashboxId) return toast("اختر الصندوق");
    if(!chequeNo) return toast("اكتب رقم الشيك");
    if(!amount || amount<=0) return toast("اكتب قيمة صحيحة");
    try{
      await addDoc(collection(db,"cheques"), {
        cashboxId, chequeNo, amount, receivedDate, dueDate,
        status: "pending", collectedDate: null, imageUrl: imageUrl || "",
        createdAt: serverTimestamp(), createdBy: state.user.uid,
      });
      toast("تم الحفظ");
      m.remove();
      render();
    }catch(e){ console.error(e); toast("تعذر الحفظ"); }
  });
}

async function collectCheque(chequeId){
  if(state.role!=="admin") throw new Error("forbidden");
  const cRef = doc(db,"cheques", chequeId);
  const snap = await getDoc(cRef);
  if(!snap.exists()) throw new Error("missing");
  const c = snap.data();
  if(c.status !== "pending") return;

  const cashboxId = c.cashboxId;
  const amount = Number(c.amount||0);
  const today = todayISO();

  await updateDoc(cRef, { status:"collected", collectedDate: today });

  await addTransaction(cashboxId, { kind:"IN", date: today, amount, account: `Cheque#${c.chequeNo}`, note:"تحصيل شيك", refObj:{ chequeId } });
}

/* Report */
async function reportView(){
  const cashboxes = await listCashboxes(true);
  const totalBalance = cashboxes.reduce((s,c)=> s + Number(c.balance||0), 0);
  const totalOpen = cashboxes.reduce((s,c)=> s + Number(c.openingBalance||0), 0);
  const totalIn = cashboxes.reduce((s,c)=> s + Number(c.totalInYear||0), 0);
  const totalOut = cashboxes.reduce((s,c)=> s + Number(c.totalOutYear||0), 0);

  return `
    <div class="card">
      <div class="card__hd"><div><div class="title">التقارير</div><div class="sub">ملخص شامل (CSV)</div></div><button class="btn btn--ghost" id="rep-export">${icon("excel")} Export</button></div>
      <div class="card__bd">
        <div class="grid2">
          <div class="tile"><div class="k">افتتاحي (إجمالي)</div><div class="v">${fmtMoney(totalOpen)}</div></div>
          <div class="tile"><div class="k">حالي (إجمالي)</div><div class="v">${fmtMoney(totalBalance)}</div></div>
          <div class="tile"><div class="k">مقبوضات السنة</div><div class="v">${fmtMoney(totalIn)}</div></div>
          <div class="tile"><div class="k">مدفوعات السنة</div><div class="v">${fmtMoney(totalOut)}</div></div>
        </div>
        <div class="sep"></div>
        <div style="overflow:auto">
          <table class="table">
            <thead><tr><th>الصندوق</th><th>افتتاحي</th><th>مقبوضات</th><th>مدفوعات</th><th>حالي</th><th>الحالة</th></tr></thead>
            <tbody>
              ${cashboxes.map(c=>`
                <tr>
                  <td class="wrap"><a href="#statement/${encodeURIComponent(c.id)}">${escapeHtml(c.name||"")}</a><div class="small">${escapeHtml(c.id)}</div></td>
                  <td>${fmtMoney(c.openingBalance)}</td>
                  <td>${fmtMoney(c.totalInYear)}</td>
                  <td>${fmtMoney(c.totalOutYear)}</td>
                  <td><b>${fmtMoney(c.balance)}</b></td>
                  <td>${c.isActive===false ? `<span class="badge">موقوف</span>` : `<span class="badge">نشط</span>`}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
function bindReport(){
  $("#rep-export")?.addEventListener("click", async ()=>{
    const cashboxes = await listCashboxes(true);
    const rows = cashboxes.map((c,i)=>({
      i:i+1, date:"", voucher:"", account: c.name, note: c.id, kind:"IN", amount: c.balance, running: c.balance
    }));
    exportCSV(rows, `cashboxes_report_${new Date().getFullYear()}.csv`);
  });
}

/* Admin */
async function adminView(){
  if(state.role!=="admin") return `<div class="card"><div class="card__bd">غير مسموح</div></div>`;
  return `
    <div class="card">
      <div class="card__hd"><div><div class="title">الأدمن</div><div class="sub">صلاحيات المستخدمين</div></div><span class="badge">UID: ${escapeHtml(state.user.uid)}</span></div>
      <div class="card__bd">
        <div class="field"><label>UID المستخدم</label><input class="input" id="u-uid" placeholder="User UID" /></div>
        <div class="row">
          <button class="btn" id="u-viewer">Viewer</button>
          <button class="btn btn--primary" id="u-admin">Admin</button>
        </div>
        <div class="sep"></div>
        <div class="small">ملاحظة: Admin UID الثابت = 31ZskJ12hdNhy5D5lwP6dPB5Kw92. (أفضل أماناً)</div>
      </div>
    </div>
  `;
}
function bindAdmin(){
  const setRole = async (role)=>{
    const uid = $("#u-uid").value.trim();
    if(!uid) return toast("اكتب UID");
    try{ await updateDoc(doc(db,"users", uid), { role }); toast("تم التحديث"); }
    catch(e){ console.error(e); toast("تعذر التحديث (تأكد أن المستخدم موجود)"); }
  };
  $("#u-viewer")?.addEventListener("click", ()=> setRole("viewer"));
  $("#u-admin")?.addEventListener("click", ()=> setRole("admin"));
}

/* Boot */
applyTheme();
if(window.matchMedia){
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", ()=>{
    if((localStorage.getItem("themeMode")||"auto")==="auto") applyTheme();
  });
}
window.addEventListener("online", ()=> render());
window.addEventListener("offline", ()=> render());

window.addEventListener("beforeinstallprompt", (e)=>{
  e.preventDefault();
  deferredInstallPrompt = e;
  state.installable = true;
  render();
});

onAuthStateChanged(auth, async (user)=>{
  state.user = user || null;
  if(user) await ensureUserProfile(user);
  else { state.profile=null; state.role="viewer"; }
  if(!location.hash) location.hash = "#dashboard";
  render();
});

if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  });
}
