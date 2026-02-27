
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ===== Config ===== */
const firebaseConfig = {
  apiKey: "AIzaSyCZiGxUHq8tGuU9BWoXDNJuy-0dbUakA5I",
  authDomain: "sweng-2f675.firebaseapp.com",
  projectId: "sweng-2f675",
  storageBucket: "sweng-2f675.firebasestorage.app",
  messagingSenderId: "815669038878",
  appId: "1:815669038878:web:d7487b86cadf40bbf0c30f"
};

const DEFAULT_SETTINGS = {
  currency: "EGP",
  cloudName: "dthtzvypx",
  uploadPreset: "Joodkids"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

await setPersistence(auth, browserLocalPersistence);

/* ===== UI Helpers ===== */
const $ = (id) => document.getElementById(id);
const toastEl = $("toast");

function toast(msg, ms = 2200){
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.add("hidden"), ms);
}

function fmtMoney(n){
  const cur = state.settings?.currency || "EGP";
  const v = Number(n || 0);
  try { return new Intl.NumberFormat("ar-EG", { style:"currency", currency: cur }).format(v); }
  catch { return `${v.toFixed(2)} ${cur}`; }
}

function todayISO(){
  const d = new Date();
  const tzOff = d.getTimezoneOffset()*60000;
  return new Date(d.getTime() - tzOff).toISOString().slice(0,10);
}

function monthISO(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function toTimestampFromISO(iso){
  // start of day local -> timestamp
  const [y,m,dd] = iso.split("-").map(Number);
  const dt = new Date(y, m-1, dd, 0,0,0,0);
  return Timestamp.fromDate(dt);
}
function toTimestampEndOfDay(iso){
  const [y,m,dd] = iso.split("-").map(Number);
  const dt = new Date(y, m-1, dd, 23,59,59,999);
  return Timestamp.fromDate(dt);
}

function safeNum(x){
  const v = Number(String(x).replace(",", "."));
  return Number.isFinite(v) ? v : 0;
}

function escapeHtml(s){
  return (s ?? "").toString().replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

/* ===== Theme ===== */
const THEME_KEY = "cb_theme"; // auto | dark | light
function applyTheme(mode){
  document.documentElement.removeAttribute("data-theme");
  if (mode === "dark") document.documentElement.setAttribute("data-theme","dark");
  if (mode === "light") document.documentElement.setAttribute("data-theme","light");
}
function cycleTheme(){
  const cur = localStorage.getItem(THEME_KEY) || "auto";
  const next = cur === "auto" ? "dark" : cur === "dark" ? "light" : "auto";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next === "auto" ? null : next);
  toast(`الثيم: ${next === "auto" ? "تلقائي" : next === "dark" ? "داكن" : "فاتح"}`);
}
(function initTheme(){
  const cur = localStorage.getItem(THEME_KEY) || "auto";
  if (cur === "dark" || cur === "light") applyTheme(cur);
})();

/* ===== Drawer ===== */
const drawer = $("drawer");
const drawerOverlay = $("drawerOverlay");
function openDrawer(){
  drawer.classList.remove("hidden");
  drawerOverlay.classList.remove("hidden");
}
function closeDrawer(){
  drawer.classList.add("hidden");
  drawerOverlay.classList.add("hidden");
}
$("menuBtn").addEventListener("click", openDrawer);
$("closeDrawerBtn").addEventListener("click", closeDrawer);
drawerOverlay.addEventListener("click", closeDrawer);
$("themeBtn").addEventListener("click", cycleTheme);

/* ===== Routing ===== */
const screens = {
  home: $("screen-home"),
  boxes: $("screen-boxes"),
  transactions: $("screen-transactions"),
  reports: $("screen-reports"),
  importExport: $("screen-importExport"),
  settings: $("screen-settings")
};

function setActiveRoute(route){
  Object.entries(screens).forEach(([k, el]) => el.classList.toggle("hidden", k !== route));
  document.querySelectorAll(".navbtn,.tab").forEach(b => b.classList.toggle("active", b.dataset.route === route));
  closeDrawer();
}

document.querySelectorAll(".navbtn,.tab").forEach(btn => {
  btn.addEventListener("click", () => setActiveRoute(btn.dataset.route));
});

/* ===== Modal System ===== */
const modalOverlay = $("modalOverlay");
function openModal(id){
  modalOverlay.classList.remove("hidden");
  $(id).classList.remove("hidden");
}
function closeModal(id){
  $(id).classList.add("hidden");
  // close overlay if no other modals open
  const anyOpen = document.querySelectorAll(".modal:not(.hidden)").length > 0;
  if (!anyOpen) modalOverlay.classList.add("hidden");
}
modalOverlay.addEventListener("click", () => {
  document.querySelectorAll(".modal:not(.hidden)").forEach(m => m.classList.add("hidden"));
  modalOverlay.classList.add("hidden");
});
document.querySelectorAll("[data-close]").forEach(btn => {
  btn.addEventListener("click", () => closeModal(btn.dataset.close));
});

/* ===== State ===== */
const state = {
  user: null,
  settings: {...DEFAULT_SETTINGS},
  boxes: [],
  tx: [],
  currentBox: null,
  editingBoxId: null,
  editingTxId: null,
  txFilter: { boxId: "all", from: "", to: "" }
};

/* ===== Auth ===== */
$("loginBtn").addEventListener("click", async () => {
  const email = $("email").value.trim();
  const password = $("password").value;
  if (!email || !password) return toast("اكتب البريد وكلمة المرور");

  try{
    await signInWithEmailAndPassword(auth, email, password);
    toast("تم تسجيل الدخول ✅");
  }catch(e){
    if (e.code === "auth/user-not-found"){
      await createUserWithEmailAndPassword(auth, email, password);
      toast("تم إنشاء الحساب ✅");
    }else{
      toast(e.code || e.message);
    }
  }
});

$("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  toast("تم تسجيل الخروج");
});

onAuthStateChanged(auth, async (user) => {
  state.user = user;
  $("authPill").textContent = user ? "مسجّل" : "غير مسجّل";
  $("authStateText").textContent = user ? `UID: ${user.uid}` : "غير مسجّل";
  $("logoutBtn").style.display = user ? "block" : "none";

  if (user){
    await ensureUserBootstrap();
    await loadAll();
    setActiveRoute("home");
  } else {
    state.boxes = [];
    state.tx = [];
    renderBoxes();
    renderTx();
    renderKPIsToday();
  }
});

async function ensureUserBootstrap(){
  const sref = doc(db, "users", state.user.uid, "settings", "main");
  const snap = await getDoc(sref);
  if (!snap.exists()){
    await setDoc(sref, DEFAULT_SETTINGS);
  }
  state.settings = { ...DEFAULT_SETTINGS, ...(snap.exists() ? snap.data() : {}) };
  $("currencyInput").value = state.settings.currency || "EGP";
  $("cloudNameInput").value = state.settings.cloudName || DEFAULT_SETTINGS.cloudName;
  $("presetInput").value = state.settings.uploadPreset || DEFAULT_SETTINGS.uploadPreset;
}

/* ===== Firestore helpers ===== */
function userColl(name){
  return collection(db, "users", state.user.uid, name);
}

async function loadAll(){
  await Promise.all([loadSettings(), loadBoxes(), loadTransactions()]);
  renderBoxes();
  refreshBoxSelects();
  renderTx();
  renderKPIsToday();
  initReportsUI();
}

async function loadSettings(){
  const sref = doc(db, "users", state.user.uid, "settings", "main");
  const snap = await getDoc(sref);
  state.settings = { ...DEFAULT_SETTINGS, ...(snap.exists() ? snap.data() : {}) };
  $("currencyInput").value = state.settings.currency || "EGP";
  $("cloudNameInput").value = state.settings.cloudName || DEFAULT_SETTINGS.cloudName;
  $("presetInput").value = state.settings.uploadPreset || DEFAULT_SETTINGS.uploadPreset;
}

async function loadBoxes(){
  const qy = query(userColl("boxes"), orderBy("createdAt","desc"));
  const res = await getDocs(qy);
  state.boxes = res.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadTransactions(){
  // load last 400 tx ordered desc by date (mobile safe)
  const qy = query(userColl("transactions"), orderBy("date","desc"));
  const res = await getDocs(qy);
  state.tx = res.docs.slice(0, 400).map(d => ({ id: d.id, ...d.data() }));
}

/* ===== Boxes ===== */
$("addBoxBtn").addEventListener("click", () => openBoxModal());
$("addBoxBtn2").addEventListener("click", () => openBoxModal());

function openBoxModal(box=null){
  state.editingBoxId = box?.id || null;
  $("boxModalTitle").textContent = box ? "تعديل صندوق" : "إضافة صندوق";
  $("boxName").value = box?.name || "";
  $("boxTitle").value = box?.title || "";
  openModal("boxModal");
}

$("saveBoxBtn").addEventListener("click", async () => {
  if (!state.user) return toast("سجّل الدخول أولاً");
  const name = $("boxName").value.trim();
  const title = $("boxTitle").value.trim();
  if (!name) return toast("اكتب اسم الصندوق");

  try{
    if (state.editingBoxId){
      const ref = doc(db, "users", state.user.uid, "boxes", state.editingBoxId);
      await updateDoc(ref, { name, title, updatedAt: Timestamp.now() });
      toast("تم التعديل ✅");
    } else {
      await addDoc(userColl("boxes"), {
        name, title,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      toast("تمت الإضافة ✅");
    }
    closeModal("boxModal");
    await loadBoxes();
    renderBoxes();
    refreshBoxSelects();
  }catch(e){
    toast(e.code || e.message);
  }
});

async function deleteBox(boxId){
  if (!confirm("حذف الصندوق؟")) return;
  try{
    await deleteDoc(doc(db, "users", state.user.uid, "boxes", boxId));
    toast("تم الحذف ✅");
    await loadBoxes();
    renderBoxes();
    refreshBoxSelects();
  }catch(e){ toast(e.code || e.message); }
}

function renderBoxes(){
  const containerA = $("boxesList");
  const containerB = $("boxesList2");
  const html = state.boxes.length ? state.boxes.map(b => boxRow(b)).join("") :
    `<div class="small muted">لا يوجد صناديق بعد. اضغط “إضافة صندوق”.</div>`;
  containerA.innerHTML = html;
  containerB.innerHTML = html;

  // wire actions
  document.querySelectorAll("[data-box-open]").forEach(btn => {
    btn.addEventListener("click", () => openStatement(btn.dataset.boxOpen));
  });
  document.querySelectorAll("[data-box-edit]").forEach(btn => {
    const box = state.boxes.find(x => x.id === btn.dataset.boxEdit);
    btn.addEventListener("click", () => openBoxModal(box));
  });
  document.querySelectorAll("[data-box-del]").forEach(btn => {
    btn.addEventListener("click", () => deleteBox(btn.dataset.boxDel));
  });
}

function boxRow(b){
  const bal = computeBoxBalance(b.id);
  return `
  <div class="item">
    <div class="itemTop">
      <div>
        <div class="itemTitle">${escapeHtml(b.name)}</div>
        <div class="itemSub">${escapeHtml(b.title || "—")}</div>
        <div class="itemSub">الرصيد الحالي: <b>${escapeHtml(fmtMoney(bal))}</b></div>
      </div>
      <div class="itemActions">
        <button class="chip" data-box-open="${b.id}">كشف حساب</button>
        <button class="chip" data-box-edit="${b.id}">تعديل</button>
        <button class="chip" data-box-del="${b.id}">حذف</button>
      </div>
    </div>
  </div>`;
}

function computeBoxBalance(boxId){
  let bal = 0;
  for (const t of state.tx){
    if (t.boxId !== boxId) continue;
    bal += t.type === "income" ? Number(t.amount||0) : -Number(t.amount||0);
  }
  return bal;
}

/* ===== Transactions ===== */
$("addTxBtn").addEventListener("click", () => openTxModal());
$("applyTxFilter").addEventListener("click", () => {
  state.txFilter.boxId = $("boxFilter").value;
  state.txFilter.from = $("fromDate").value;
  state.txFilter.to = $("toDate").value;
  renderTx();
});

function refreshBoxSelects(){
  const options = [`<option value="all">كل الصناديق</option>`]
    .concat(state.boxes.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`))
    .join("");
  $("boxFilter").innerHTML = options;

  const txOpts = state.boxes.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("");
  $("txBox").innerHTML = txOpts;

  // defaults
  if (!$("fromDate").value) $("fromDate").value = "";
  if (!$("toDate").value) $("toDate").value = "";
  $("todayPill").textContent = todayISO();
  $("monthPicker").value = monthISO();
}

function openTxModal(tx=null){
  if (!state.user) return toast("سجّل الدخول أولاً");
  if (!state.boxes.length) return toast("أنشئ صندوق أولاً");

  state.editingTxId = tx?.id || null;
  $("txModalTitle").textContent = tx ? "تعديل معاملة" : "إضافة معاملة";
  $("deleteTxBtn").style.display = tx ? "block" : "none";

  $("txBox").value = tx?.boxId || state.boxes[0].id;
  $("txType").value = tx?.type || "income";
  $("txAmount").value = tx ? String(tx.amount) : "";
  $("txAccount").value = tx?.account || "";
  $("txNote").value = tx?.note || "";
  $("txDate").value = tx?.date ? tx.date.toDate().toISOString().slice(0,10) : todayISO();

  openModal("txModal");
}

$("saveTxBtn").addEventListener("click", async () => {
  if (!state.user) return toast("سجّل الدخول أولاً");
  const boxId = $("txBox").value;
  const box = state.boxes.find(b => b.id === boxId);
  if (!box) return toast("اختر صندوق صحيح");

  const type = $("txType").value;
  const amount = safeNum($("txAmount").value);
  const account = $("txAccount").value.trim();
  const note = $("txNote").value.trim();
  const dateISO = $("txDate").value || todayISO();

  if (!account) return toast("اكتب اسم الحساب");
  if (!(amount > 0)) return toast("اكتب مبلغ صحيح");

  const data = {
    boxId,
    boxName: box.name,
    type,
    amount,
    account,
    note,
    date: toTimestampFromISO(dateISO),
    updatedAt: Timestamp.now()
  };

  try{
    if (state.editingTxId){
      await updateDoc(doc(db, "users", state.user.uid, "transactions", state.editingTxId), data);
      toast("تم التعديل ✅");
    } else {
      await addDoc(userColl("transactions"), { ...data, createdAt: Timestamp.now() });
      toast("تمت الإضافة ✅");
    }
    closeModal("txModal");
    await loadTransactions();
    renderBoxes();
    renderTx();
    renderKPIsToday();
  }catch(e){ toast(e.code || e.message); }
});

$("deleteTxBtn").addEventListener("click", async () => {
  if (!state.editingTxId) return;
  if (!confirm("حذف المعاملة؟")) return;
  try{
    await deleteDoc(doc(db, "users", state.user.uid, "transactions", state.editingTxId));
    toast("تم الحذف ✅");
    closeModal("txModal");
    await loadTransactions();
    renderBoxes();
    renderTx();
    renderKPIsToday();
  }catch(e){ toast(e.code || e.message); }
});

function filteredTx(){
  let arr = [...state.tx];
  const { boxId, from, to } = state.txFilter;
  if (boxId && boxId !== "all") arr = arr.filter(t => t.boxId === boxId);
  if (from) {
    const fromTs = toTimestampFromISO(from).toMillis();
    arr = arr.filter(t => t.date?.toMillis?.() >= fromTs);
  }
  if (to) {
    const toTs = toTimestampEndOfDay(to).toMillis();
    arr = arr.filter(t => t.date?.toMillis?.() <= toTs);
  }
  return arr;
}

function renderTx(){
  const container = $("txList");
  const arr = filteredTx();
  if (!arr.length){
    container.innerHTML = `<div class="small muted">لا يوجد معاملات.</div>`;
    return;
  }
  container.innerHTML = arr.map(txRow).join("");

  document.querySelectorAll("[data-tx-edit]").forEach(btn => {
    const tx = arr.find(t => t.id === btn.dataset.txEdit);
    btn.addEventListener("click", () => openTxModal(tx));
  });
  document.querySelectorAll("[data-account]").forEach(btn => {
    btn.addEventListener("click", () => openAccountStatement(btn.dataset.account));
  });
}

function txRow(t){
  const date = t.date?.toDate ? t.date.toDate().toISOString().slice(0,10) : "—";
  const sign = t.type === "income" ? "+" : "-";
  return `
  <div class="item">
    <div class="itemTop">
      <div>
        <div class="itemTitle">${escapeHtml(t.boxName)} <span class="chip">${escapeHtml(date)}</span></div>
        <div class="itemSub">
          <button class="chip" data-account="${escapeHtml(t.account)}">الحساب: ${escapeHtml(t.account)}</button>
          <span class="chip">${t.type === "income" ? "دخل" : "مصروف"}</span>
        </div>
        <div class="itemSub">${escapeHtml(t.note || "—")}</div>
      </div>
      <div class="itemActions">
        <div class="itemTitle">${escapeHtml(sign)} ${escapeHtml(fmtMoney(t.amount))}</div>
        <button class="chip" data-tx-edit="${t.id}">تعديل</button>
      </div>
    </div>
  </div>`;
}

/* ===== Statements ===== */
async function openStatement(boxId){
  const box = state.boxes.find(b => b.id === boxId);
  if (!box) return;
  state.currentBox = box;

  $("statementDay").value = todayISO();
  $("openingBal").textContent = fmtMoney(0);
  $("stIncome").textContent = fmtMoney(0);
  $("stExpense").textContent = fmtMoney(0);
  $("closingBal").textContent = fmtMoney(0);
  $("statementList").innerHTML = `<div class="small muted">اضغط عرض.</div>`;

  openModal("statementModal");
}

$("runStatementBtn").addEventListener("click", async () => {
  if (!state.currentBox) return;
  const day = $("statementDay").value || todayISO();
  await runStatement(state.currentBox.id, day);
});

async function runStatement(boxId, dayISO){
  const start = toTimestampFromISO(dayISO);
  const end = toTimestampEndOfDay(dayISO);

  // Opening balance: all tx before start date (box filtered)
  let opening = 0;
  for (const t of state.tx){
    if (t.boxId !== boxId) continue;
    if (t.date?.toMillis?.() < start.toMillis()){
      opening += t.type === "income" ? Number(t.amount||0) : -Number(t.amount||0);
    }
  }

  // Today list
  const todayTx = state.tx
    .filter(t => t.boxId === boxId && t.date?.toMillis?.() >= start.toMillis() && t.date?.toMillis?.() <= end.toMillis())
    .sort((a,b) => a.date.toMillis() - b.date.toMillis());

  let inc = 0, exp = 0;
  for (const t of todayTx){
    if (t.type === "income") inc += Number(t.amount||0);
    else exp += Number(t.amount||0);
  }
  const closing = opening + inc - exp;

  $("openingBal").textContent = fmtMoney(opening);
  $("stIncome").textContent = fmtMoney(inc);
  $("stExpense").textContent = fmtMoney(exp);
  $("closingBal").textContent = fmtMoney(closing);

  $("statementList").innerHTML = todayTx.length ? todayTx.map(t => `
    <div class="item">
      <div class="itemTop">
        <div>
          <div class="itemTitle">${escapeHtml(t.account)} <span class="chip">${t.type === "income" ? "دخل" : "مصروف"}</span></div>
          <div class="itemSub">${escapeHtml(t.note || "—")}</div>
        </div>
        <div class="itemActions">
          <div class="itemTitle">${escapeHtml((t.type==="income"?"+":"-"))} ${escapeHtml(fmtMoney(t.amount))}</div>
          <button class="chip" data-tx-edit="${t.id}">تعديل</button>
        </div>
      </div>
    </div>
  `).join("") : `<div class="small muted">لا يوجد معاملات لهذا اليوم.</div>`;

  document.querySelectorAll("#statementList [data-tx-edit]").forEach(btn => {
    const tx = state.tx.find(x => x.id === btn.dataset.txEdit);
    btn.addEventListener("click", () => openTxModal(tx));
  });
}

/* Account statement when clicking account chip */
function openAccountStatement(accountName){
  // jump to transactions screen filtered by account text
  setActiveRoute("transactions");
  toast(`فلترة حسب الحساب: ${accountName}`);
  // temporary filter by setting date/box unchanged and filtering in render
  const base = filteredTx().filter(t => (t.account||"") === accountName);
  $("txList").innerHTML = base.length ? base.map(txRow).join("") : `<div class="small muted">لا يوجد معاملات لهذا الحساب.</div>`;
  document.querySelectorAll("[data-tx-edit]").forEach(btn => {
    const tx = state.tx.find(t => t.id === btn.dataset.txEdit);
    btn.addEventListener("click", () => openTxModal(tx));
  });
}

/* ===== KPIs (Today) ===== */
function renderKPIsToday(){
  const iso = todayISO();
  const start = toTimestampFromISO(iso).toMillis();
  const end = toTimestampEndOfDay(iso).toMillis();

  let inc=0, exp=0;
  for (const t of state.tx){
    const ms = t.date?.toMillis?.();
    if (!ms || ms < start || ms > end) continue;
    if (t.type === "income") inc += Number(t.amount||0);
    else exp += Number(t.amount||0);
  }
  $("kpiIncome").textContent = fmtMoney(inc);
  $("kpiExpense").textContent = fmtMoney(exp);
  $("kpiNet").textContent = fmtMoney(inc-exp);
  $("todayPill").textContent = iso;
}

/* ===== Reports ===== */
function initReportsUI(){
  $("monthPicker").value = monthISO();
}

$("runMonthly").addEventListener("click", () => runMonthlyReport());
$("runTopAccounts").addEventListener("click", () => runTopAccounts());

function runMonthlyReport(){
  const m = $("monthPicker").value || monthISO(); // YYYY-MM
  const [y,mm] = m.split("-").map(Number);
  const start = Timestamp.fromDate(new Date(y, mm-1, 1, 0,0,0,0)).toMillis();
  const end = Timestamp.fromDate(new Date(y, mm, 0, 23,59,59,999)).toMillis();

  // daily totals
  const daysInMonth = new Date(y, mm, 0).getDate();
  const inc = Array(daysInMonth).fill(0);
  const exp = Array(daysInMonth).fill(0);

  for (const t of state.tx){
    const ms = t.date?.toMillis?.(); if (!ms) continue;
    if (ms < start || ms > end) continue;
    const d = t.date.toDate().getDate(); // 1..days
    if (t.type === "income") inc[d-1] += Number(t.amount||0);
    else exp[d-1] += Number(t.amount||0);
  }

  drawMonthlyChart(inc, exp, y, mm, daysInMonth);
}

function drawMonthlyChart(inc, exp, y, mm, days){
  const c = $("monthlyChart");
  const ctx = c.getContext("2d");
  const w = c.width = c.clientWidth * devicePixelRatio;
  const h = c.height = 180 * devicePixelRatio;
  ctx.clearRect(0,0,w,h);

  // background
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  roundRect(ctx, 0,0,w,h, 16*devicePixelRatio);
  ctx.fill();

  const maxV = Math.max(1, ...inc, ...exp);
  const pad = 16*devicePixelRatio;
  const chartW = w - pad*2;
  const chartH = h - pad*2;
  const stepX = chartW / Math.max(1, days-1);

  // axes
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1*devicePixelRatio;
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, pad+chartH);
  ctx.lineTo(pad+chartW, pad+chartH);
  ctx.stroke();

  // line helpers
  const yMap = (v) => pad + chartH - (v/maxV)*chartH;

  // income line (blue)
  ctx.strokeStyle = "rgba(79,140,255,0.95)";
  ctx.lineWidth = 2.5*devicePixelRatio;
  ctx.beginPath();
  inc.forEach((v,i) => {
    const x = pad + i*stepX;
    const y = yMap(v);
    if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();

  // expense line (red)
  ctx.strokeStyle = "rgba(255,91,91,0.92)";
  ctx.lineWidth = 2.5*devicePixelRatio;
  ctx.beginPath();
  exp.forEach((v,i) => {
    const x = pad + i*stepX;
    const y = yMap(v);
    if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();

  // title
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = `${12*devicePixelRatio}px system-ui`;
  ctx.fillText(`تقرير ${y}-${String(mm).padStart(2,'0')}`, pad, 14*devicePixelRatio);
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr, y);
  ctx.arcTo(x+w, y, x+w, y+h, rr);
  ctx.arcTo(x+w, y+h, x, y+h, rr);
  ctx.arcTo(x, y+h, x, y, rr);
  ctx.arcTo(x, y, x+w, y, rr);
  ctx.closePath();
}

function runTopAccounts(){
  const map = new Map(); // account -> net
  for (const t of state.tx){
    const key = t.account || "—";
    const cur = map.get(key) || 0;
    const v = (t.type === "income") ? Number(t.amount||0) : -Number(t.amount||0);
    map.set(key, cur + v);
  }
  const arr = [...map.entries()].sort((a,b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 12);
  $("topAccountsList").innerHTML = arr.length ? arr.map(([k,v]) => `
    <div class="item">
      <div class="itemTop">
        <div>
          <div class="itemTitle">${escapeHtml(k)}</div>
          <div class="itemSub">الصافي: <b>${escapeHtml(fmtMoney(v))}</b></div>
        </div>
      </div>
    </div>
  `).join("") : `<div class="small muted">لا يوجد بيانات.</div>`;
}

/* ===== Settings ===== */
$("saveSettingsBtn").addEventListener("click", async () => {
  if (!state.user) return toast("سجّل الدخول أولاً");
  const currency = $("currencyInput").value.trim() || "EGP";
  const cloudName = $("cloudNameInput").value.trim() || DEFAULT_SETTINGS.cloudName;
  const uploadPreset = $("presetInput").value.trim() || DEFAULT_SETTINGS.uploadPreset;

  try{
    await setDoc(doc(db, "users", state.user.uid, "settings", "main"), {
      currency, cloudName, uploadPreset, updatedAt: Timestamp.now()
    }, { merge: true });
    toast("تم حفظ الإعدادات ✅");
    await loadSettings();
  }catch(e){ toast(e.code || e.message); }
});

/* ===== Cloudinary Upload ===== */
async function uploadToCloudinary(file){
  const cloudName = state.settings?.cloudName || DEFAULT_SETTINGS.cloudName;
  const uploadPreset = state.settings?.uploadPreset || DEFAULT_SETTINGS.uploadPreset;

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", uploadPreset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form
  });
  if (!res.ok){
    const t = await res.text();
    throw new Error(t);
  }
  const data = await res.json();
  return { url: data.secure_url, publicId: data.public_id };
}

$("uploadPhotoBtn").addEventListener("click", async () => {
  if (!state.user) return toast("سجّل الدخول أولاً");
  const f = $("photoFile").files?.[0];
  if (!f) return toast("اختر صورة أولاً");

  $("photoResult").textContent = "جاري الرفع...";
  try{
    const out = await uploadToCloudinary(f);
    $("photoResult").innerHTML = `تم ✅ <a href="${out.url}" target="_blank">فتح الصورة</a>`;
  }catch(e){
    $("photoResult").textContent = "فشل: " + (e.message || e);
  }
});

/* ===== Import/Export ===== */
$("exportCsvBtn").addEventListener("click", () => exportCSV());
$("exportXlsxBtn").addEventListener("click", () => exportXLSX());
$("importBtn").addEventListener("click", () => importFile());

function txToRows(arr){
  return arr.map(t => ({
    date: t.date?.toDate ? t.date.toDate().toISOString().slice(0,10) : "",
    type: t.type,
    amount: Number(t.amount||0),
    account: t.account || "",
    note: t.note || "",
    boxName: t.boxName || "",
    boxId: t.boxId || ""
  }));
}

function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportCSV(){
  const arr = filteredTx();
  const rows = txToRows(arr);
  const header = Object.keys(rows[0] || {date:"",type:"",amount:"",account:"",note:"",boxName:"",boxId:""});
  const lines = [header.join(",")].concat(rows.map(r => header.map(k => `"${String(r[k]??"").replace(/"/g,'""')}"`).join(",")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `cashboxes_${todayISO()}.csv`);
}

function exportXLSX(){
  const arr = filteredTx();
  const rows = txToRows(arr);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transactions");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, `cashboxes_${todayISO()}.xlsx`);
}

async function importFile(){
  if (!state.user) return toast("سجّل الدخول أولاً");
  const file = $("importFile").files?.[0];
  if (!file) return toast("اختر ملف أولاً");
  if (!state.boxes.length) return toast("أنشئ صندوق أولاً");

  const isCSV = file.name.toLowerCase().endsWith(".csv");
  let rows = [];

  try{
    if (isCSV){
      const txt = await file.text();
      rows = parseCSV(txt);
    } else {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    }
  }catch(e){
    return toast("فشل قراءة الملف");
  }

  if (!rows.length) return toast("الملف فارغ");

  // map boxName -> boxId
  const boxByName = new Map(state.boxes.map(b => [b.name.trim(), b]));
  let ok=0, fail=0;

  toast("جاري الاستيراد...");
  for (const r of rows){
    try{
      const dateISO = (r.date || r.Date || "").toString().slice(0,10) || todayISO();
      const typeRaw = (r.type || r.Type || "").toString().toLowerCase();
      const type = (typeRaw.includes("exp") || typeRaw.includes("مص")) ? "expense" : "income";
      const amount = safeNum(r.amount ?? r.Amount ?? r.المبلغ ?? 0);
      const account = (r.account || r.Account || r.الحساب || "").toString().trim() || "—";
      const note = (r.note || r.Note || r.ملاحظة || "").toString().trim();
      const boxName = (r.boxName || r.BoxName || r.الصندوق || "").toString().trim();
      const box = boxByName.get(boxName) || state.boxes[0];

      if (!(amount > 0)) throw new Error("amount");
      await addDoc(userColl("transactions"), {
        boxId: box.id,
        boxName: box.name,
        type,
        amount,
        account,
        note,
        date: toTimestampFromISO(dateISO),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      ok++;
    }catch(e){
      fail++;
    }
  }

  await loadTransactions();
  renderBoxes();
  renderTx();
  renderKPIsToday();
  toast(`تم الاستيراد ✅ (${ok} نجاح / ${fail} فشل)`);
}

function parseCSV(text){
  // minimal CSV parser (handles quotes)
  const rows = [];
  let i=0, field="", row=[], inQ=false;
  const pushField = () => { row.push(field); field=""; };
  const pushRow = () => {
    if (row.length) rows.push(row);
    row=[];
  };
  while (i < text.length){
    const c = text[i];
    if (inQ){
      if (c === '"' && text[i+1] === '"'){ field += '"'; i += 2; continue; }
      if (c === '"'){ inQ=false; i++; continue; }
      field += c; i++; continue;
    } else {
      if (c === '"'){ inQ=true; i++; continue; }
      if (c === ','){ pushField(); i++; continue; }
      if (c === '\n'){ pushField(); pushRow(); i++; continue; }
      if (c === '\r'){ i++; continue; }
      field += c; i++; continue;
    }
  }
  pushField(); pushRow();
  const header = rows.shift() || [];
  return rows.map(r => {
    const obj = {};
    header.forEach((h, idx) => obj[String(h||"").trim()] = r[idx] ?? "");
    return obj;
  });
}

/* ===== Init defaults ===== */
$("statementDay").value = todayISO();
$("txDate").value = todayISO();
$("monthPicker").value = monthISO();

// default route
setActiveRoute("home");
