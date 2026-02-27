import { $, $$, toast, openModal, fmtMoney, today, downloadBlob, renderCanvasBarChart } from "./ui.js";
import { ensureAuth, watchAuth, loginEmail, registerEmail, logout } from "./firebase.js";
import { uploadImage } from "./cloudinary.js";
import {
  watchCashboxes, createCashbox, updateCashbox, deleteCashbox,
  watchTransactions, addTransaction, updateTransaction, deleteTransaction,
  getCashbox, watchCheques, createCheque
} from "./db.js";

/**
 * CashBoxes Pro PWA
 * - Drawer closes on backdrop or any screen click (fixed)
 * - Cashbox card click opens Statement (كشف حساب) with date range + opening balance for the selected start date
 * - Full CRUD for cashboxes + transactions + cheques
 * - Excel Import/Export for transactions using SheetJS
 * - Professional reports + charts
 */

const state = {
  route: "dashboard",
  cashboxes: [],
  activeCashboxId: null,
  txUnsub: null,
  cashboxUnsub: null,
  chequesUnsub: null,
  transactions: [],
  cheques: [],
  filterFrom: "",
  filterTo: "",
  themeMode: localStorage.getItem("themeMode") || "auto", // auto | light | dark
  authUser: null,
  deferredInstallPrompt: null
};

// ---------- Theme ----------
function applyTheme(){
  const mode = state.themeMode;
  const root = document.documentElement;
  if (mode === "auto"){
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = prefersDark ? "dark" : "light";
  } else {
    root.dataset.theme = mode;
  }
  localStorage.setItem("themeMode", mode);
}
applyTheme();
window.matchMedia("(prefers-color-scheme: dark)")?.addEventListener("change", ()=>{
  if (state.themeMode === "auto") applyTheme();
});

// ---------- Drawer ----------
const drawer = $("#drawer");
const backdrop = $("#backdrop");
function openDrawer(){
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden","false");
  backdrop.hidden = false;
}
function closeDrawer(){
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden","true");
  backdrop.hidden = true;
}
$("#btnMenu").onclick = openDrawer;
$("#btnCloseDrawer").onclick = closeDrawer;
backdrop.addEventListener("click", closeDrawer);
// Close drawer on any main click (requested behavior)
$("#main").addEventListener("click", ()=> {
  if (drawer.classList.contains("open")) closeDrawer();
});

// ---------- Bottom nav / Drawer nav ----------
function setActiveNav(route){
  $$(".bn").forEach(b=> b.classList.toggle("active", b.dataset.route === route));
  $$(".navitem").forEach(b=> b.classList.toggle("active", b.dataset.route === route));
}
$$(".bn").forEach(b=> b.onclick = ()=> navigate(b.dataset.route));
$$(".navitem").forEach(b=> b.onclick = ()=> { navigate(b.dataset.route); closeDrawer(); });

function navigate(route, params={}){
  state.route = route;
  setActiveNav(route);
  render(route, params);
}

// ---------- PWA install ----------
window.addEventListener("beforeinstallprompt", (e)=>{
  e.preventDefault();
  state.deferredInstallPrompt = e;
  $("#btnInstall").hidden = false;
});
$("#btnInstall").onclick = async ()=>{
  const p = state.deferredInstallPrompt;
  if (!p) return;
  p.prompt();
  await p.userChoice;
  state.deferredInstallPrompt = null;
  $("#btnInstall").hidden = true;
};

// ---------- Auth ----------
watchAuth((u)=>{
  state.authUser = u;
  $("#authState").textContent = u ? `UID: ${u.uid.slice(0,8)}…` : "غير مسجّل";
  $("#btnSignOut").hidden = !u || u.isAnonymous;
});
$("#btnSignOut").onclick = async ()=> {
  await logout();
  toast("تم تسجيل الخروج");
  await ensureAuth(); // keep app usable
};

async function init(){
  await ensureAuth();
  state.cashboxUnsub = watchCashboxes((items)=>{
    state.cashboxes = items;
    if (!state.activeCashboxId && items[0]) state.activeCashboxId = items[0].id;
    if (["dashboard","cashboxes","reports"].includes(state.route)) render(state.route);
  });
  registerSW();
  navigate("dashboard");
}
init().catch(err=> toast(err.message || "حدث خطأ"));

function registerSW(){
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", async ()=>{
    try{
      await navigator.serviceWorker.register("./sw.js");
    }catch(e){
      console.warn(e);
    }
  });
}

// ---------- Screens ----------
function render(route, params={}){
  const main = $("#main");
  main.innerHTML = "";
  const subtitle = $("#subtitle");
  if (route === "dashboard"){
    subtitle.textContent = "ملخص سريع + آخر المعاملات";
    main.appendChild(screenDashboard());
  } else if (route === "cashboxes"){
    subtitle.textContent = "إدارة الصناديق والمعاملات";
    main.appendChild(screenCashboxes());
  } else if (route === "reports"){
    subtitle.textContent = "تقارير احترافية ومتطورة";
    main.appendChild(screenReports());
  } else if (route === "settings"){
    subtitle.textContent = "تخصيص + حساب";
    main.appendChild(screenSettings());
  } else if (route === "statement"){
    subtitle.textContent = "كشف حساب";
    main.appendChild(screenStatement(params.cashboxId));
  }
}

// ---------- Components ----------
function el(tag, attrs={}, children=[]){
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{
    if (k === "class") e.className = v;
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else if (v === false || v == null) {}
    else e.setAttribute(k, v === true ? "" : String(v));
  });
  (Array.isArray(children)?children:[children]).forEach(c=>{
    if (c == null) return;
    if (typeof c === "string") e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  });
  return e;
}

function moneyBadge(n){
  const cls = Number(n||0) >= 0 ? "success" : "danger";
  return el("span", { class:`badge ${cls}` }, [`${fmtMoney(n)} EGP`]);
}

// ---------- Dashboard ----------
function screenDashboard(){
  const wrap = el("div",{class:"stack"});
  const active = state.cashboxes.find(c=>c.id===state.activeCashboxId) || state.cashboxes[0];

  wrap.appendChild(el("div",{class:"card stack"},[
    el("div",{class:"row between"},[
      el("div",{},[
        el("div",{class:"h1"},["لوحة التحكم"]),
        el("div",{class:"tiny"},["اختر صندوق ثم اضغط لعرض كشف الحساب"])
      ]),
      el("button",{class:"btn primary", style:"width:auto;padding:0 14px", onclick:()=>openAddCashbox()},["+ صندوق"])
    ]),
    el("div",{class:"grid2"},[
      kpi("عدد الصناديق", state.cashboxes.length),
      kpi("إجمالي الأرصدة", sumBalances(state.cashboxes))
    ]),
    active ? el("div",{class:"item", role:"button", tabindex:"0", onclick:()=> navigate("statement",{cashboxId: active.id})},[
      el("div",{class:"iconpill"},["🧰"]),
      el("div",{class:"meta"},[
        el("div",{class:"name"},[active.name || "بدون اسم"]),
        el("div",{class:"sub"},[active.isActive ? "نشط" : "غير نشط"])
      ]),
      el("div",{class:"amt"},[fmtMoney(active.balance || 0)])
    ]) : el("div",{class:"tiny"},["لا يوجد صناديق بعد. اضغط + صندوق."])
  ]));

  // Latest transactions (from active cashbox)
  if (active){
    wrap.appendChild(latestTransactionsCard(active.id));
  }
  return wrap;
}

function kpi(label, value){
  return el("div",{class:"kpi"},[
    el("div",{class:"val"},[typeof value==="number" ? fmtMoney(value) : String(value)]),
    el("div",{class:"lbl"},[label])
  ]);
}

function sumBalances(items){
  return items.reduce((a,c)=> a + Number(c.balance||0), 0);
}

function latestTransactionsCard(cashboxId){
  const card = el("div",{class:"card stack"});
  card.appendChild(el("div",{class:"row between"},[
    el("div",{class:"h2"},["آخر المعاملات"]),
    el("button",{class:"btn", style:"width:auto;padding:0 14px", onclick:()=> navigate("statement",{cashboxId})},["كشف حساب"])
  ]));

  const list = el("div",{class:"list"});
  card.appendChild(list);

  // one-shot subscription
  if (state.txUnsub) state.txUnsub();
  state.txUnsub = watchTransactions(cashboxId, {}, (items)=>{
    state.transactions = items;
    list.innerHTML = "";
    (items.slice(0,6)).forEach(t=>{
      list.appendChild(txRow(t, {cashboxId, compact:true}));
    });
    if (!items.length) list.appendChild(el("div",{class:"tiny"},["لا توجد معاملات."]));
  });
  return card;
}

// ---------- Cashboxes screen ----------
function screenCashboxes(){
  const wrap = el("div",{class:"stack"});

  wrap.appendChild(el("div",{class:"card stack"},[
    el("div",{class:"row between"},[
      el("div",{},[
        el("div",{class:"h1"},["الصناديق"]),
        el("div",{class:"tiny"},["اضغط على صندوق لفتح كشف الحساب (المعاملات)"])
      ]),
      el("button",{class:"btn primary", style:"width:auto;padding:0 14px", onclick:()=>openAddCashbox()},["+ صندوق"])
    ]),
  ]));

  const list = el("div",{class:"list"});
  wrap.appendChild(list);

  state.cashboxes.forEach(c=>{
    list.appendChild(el("div",{class:"item", role:"button", tabindex:"0", onclick:()=>navigate("statement",{cashboxId:c.id})},[
      el("div",{class:"iconpill purple"},[c.isActive ? "✅" : "⛔"]),
      el("div",{class:"meta"},[
        el("div",{class:"name"},[c.name || "بدون اسم"]),
        el("div",{class:"sub"},[`رصيد افتتاحي: ${fmtMoney(c.openingBalance||0)} • آخر تحديث`])
      ]),
      el("div",{class:"amt"},[fmtMoney(c.balance||0)])
    ]));
  });

  if (!state.cashboxes.length) list.appendChild(el("div",{class:"tiny"},["لا يوجد صناديق بعد."]));
  return wrap;
}

// ---------- Statement ----------
function screenStatement(cashboxId){
  state.activeCashboxId = cashboxId;
  const wrap = el("div",{class:"stack"});
  const header = el("div",{class:"card stack"});
  wrap.appendChild(header);

  const cashbox = state.cashboxes.find(c=>c.id===cashboxId);
  header.appendChild(el("div",{class:"row between"},[
    el("div",{},[
      el("div",{class:"h1"},[cashbox?.name || "كشف حساب"]),
      el("div",{class:"tiny"},["حدد التاريخ لعرض الرصيد الافتتاحي + الحركات"])
    ]),
    el("button",{class:"btn", style:"width:auto;padding:0 14px", onclick:()=> navigate("cashboxes")},["رجوع"])
  ]));

  const from = state.filterFrom || today();
  const to = state.filterTo || today();
  state.filterFrom = from;
  state.filterTo = to;

  const filters = el("div",{class:"grid2"},[
    el("div",{},[
      el("div",{class:"tiny"},["من"]),
      el("input",{class:"input", type:"date", value:from, onchange:(e)=>{ state.filterFrom = e.target.value; render("statement",{cashboxId}); }})
    ]),
    el("div",{},[
      el("div",{class:"tiny"},["إلى"]),
      el("input",{class:"input", type:"date", value:to, onchange:(e)=>{ state.filterTo = e.target.value; render("statement",{cashboxId}); }})
    ])
  ]);
  header.appendChild(filters);

  const stats = el("div",{class:"grid2"});
  header.appendChild(stats);

  const actions = el("div",{class:"grid2"},[
    el("button",{class:"btn primary", onclick:()=>openAddTx(cashboxId)},["➕ إضافة معاملة"]),
    el("button",{class:"btn", onclick:()=>openExcelTools(cashboxId)},["📥/📤 Excel"])
  ]);
  header.appendChild(actions);

  // Tx list
  const listCard = el("div",{class:"card stack"});
  listCard.appendChild(el("div",{class:"row between"},[
    el("div",{class:"h2"},["المعاملات"]),
    el("button",{class:"btn", style:"width:auto;padding:0 14px", onclick:()=>openChequeFlow(cashboxId)},["🧾 شيكات"])
  ]));
  const list = el("div",{class:"list"});
  listCard.appendChild(list);
  wrap.appendChild(listCard);

  // Subscribe transactions with date filter
  if (state.txUnsub) state.txUnsub();
  state.txUnsub = watchTransactions(cashboxId, {from: state.filterFrom, to: state.filterTo}, async (items)=>{
    state.transactions = items;
    list.innerHTML = "";
    items.forEach(t=> list.appendChild(txRow(t,{cashboxId})));
    if (!items.length) list.appendChild(el("div",{class:"tiny"},["لا توجد معاملات ضمن هذا النطاق."]));

    // Compute opening balance for the selected FROM day:
    // openingBalanceAtFrom = cashbox.openingBalance + sum(all active tx before FROM)
    const opening = await computeOpeningBalanceAt(cashboxId, state.filterFrom);
    const net = computeNet(items);
    const closing = opening + net;

    stats.innerHTML = "";
    stats.appendChild(kpi("الرصيد الافتتاحي", opening));
    stats.appendChild(kpi("الرصيد الختامي", closing));
  });

  return wrap;
}

async function computeOpeningBalanceAt(cashboxId, fromDate){
  const cashbox = await getCashbox(cashboxId);
  const base = Number(cashbox?.openingBalance || 0);
  // We already have all transactions for the date window; but we need before FROM too.
  // For simplicity: fetch all tx client-side once from snapshot cache by subscribing without filter, then compute.
  // Use current state.transactions if it includes earlier; if not, do a one-time fetch via snapshot from local cache is complex.
  // We'll do a lightweight on-demand snapshot through watchTransactions without filter but immediately unsubscribe.
  return await new Promise((resolve)=>{
    const unsub = watchTransactions(cashboxId, {}, (all)=>{
      unsub();
      let bal = base;
      all.forEach(t=>{
        if (t.status && t.status !== "active") return;
        if (t.date < fromDate){
          const amt = Number(t.amount||0);
          bal += (t.kind === "IN") ? amt : -amt;
        }
      });
      resolve(bal);
    });
  });
}

function computeNet(items){
  let net = 0;
  items.forEach(t=>{
    if (t.status && t.status !== "active") return;
    const amt = Number(t.amount||0);
    net += (t.kind === "IN") ? amt : -amt;
  });
  return net;
}

function txRow(t,{cashboxId, compact=false}){
  const isIn = t.kind === "IN";
  const amtClass = isIn ? "amt in" : "amt out";
  const icon = isIn ? "⬆️" : "⬇️";
  const row = el("div",{class:"item"},[
    el("div",{class:"iconpill " + (isIn?"green":"red")},[icon]),
    el("div",{class:"meta"},[
      el("div",{class:"name"},[t.account || "بدون حساب"]),
      el("div",{class:"sub"},[compact ? `${t.date}` : `${t.date} • ${t.note || "—"}`])
    ]),
    el("div",{class:amtClass},[fmtMoney(t.amount||0)])
  ]);

  if (!compact){
    row.addEventListener("click", ()=> openTxActions(cashboxId, t));
  }
  return row;
}

// ---------- Reports ----------
function screenReports(){
  const wrap = el("div",{class:"stack"});
  wrap.appendChild(el("div",{class:"card stack"},[
    el("div",{class:"h1"},["التقارير"]),
    el("div",{class:"tiny"},["ملخص، شهري، أفضل الحسابات + تصدير Excel/CSV"])
  ]));

  const cashboxPick = el("select",{class:"select"});
  state.cashboxes.forEach(c=>{
    cashboxPick.appendChild(el("option",{value:c.id, selected:c.id===state.activeCashboxId},[c.name || c.id]));
  });

  const card = el("div",{class:"card stack"},[
    el("div",{class:"row between"},[
      el("div",{class:"h2"},["اختيار الصندوق"]),
      cashboxPick
    ]),
    el("canvas",{id:"chart"})
  ]);
  wrap.appendChild(card);

  const actions = el("div",{class:"grid2"},[
    el("button",{class:"btn", onclick:()=> exportReportCSV()},["تصدير CSV"]),
    el("button",{class:"btn primary", onclick:()=> exportReportXLSX()},["تصدير XLSX"])
  ]);
  wrap.appendChild(actions);

  const tableCard = el("div",{class:"card stack"},[
    el("div",{class:"h2"},["أفضل الحسابات"]),
    el("div",{id:"topAccounts"})
  ]);
  wrap.appendChild(tableCard);

  const update = ()=>{
    state.activeCashboxId = cashboxPick.value;
    // chart uses last 6 months net
    buildReports(state.activeCashboxId);
  };
  cashboxPick.onchange = update;
  update();

  return wrap;
}

function monthKey(d){ return d.slice(0,7); } // YYYY-MM

function buildReports(cashboxId){
  const canvas = $("#chart");
  const topDiv = $("#topAccounts");
  // subscribe without filter for complete reporting, then compute monthly & top accounts
  if (state.txUnsub) state.txUnsub();
  state.txUnsub = watchTransactions(cashboxId, {}, (items)=>{
    state.transactions = items;

    const byMonth = new Map();
    const byAcc = new Map();
    items.forEach(t=>{
      if (t.status && t.status !== "active") return;
      const key = monthKey(t.date);
      const delta = (t.kind==="IN") ? Number(t.amount||0) : -Number(t.amount||0);
      byMonth.set(key, (byMonth.get(key)||0) + delta);
      const a = t.account || "بدون حساب";
      byAcc.set(a, (byAcc.get(a)||0) + delta);
    });

    const months = Array.from(byMonth.keys()).sort().slice(-6);
    const vals = months.map(m=> byMonth.get(m));
    renderCanvasBarChart(canvas, months.map(m=>m.replace("-","/")), vals);

    // Top accounts
    const rows = Array.from(byAcc.entries())
      .sort((a,b)=> Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0,10);
    topDiv.innerHTML = "";
    if (!rows.length){
      topDiv.appendChild(el("div",{class:"tiny"},["لا توجد بيانات."]));
      return;
    }
    const tbl = el("table",{class:"table"});
    tbl.appendChild(el("thead",{},[
      el("tr",{},[
        el("th",{},["الحساب"]),
        el("th",{},["الصافي"])
      ])
    ]));
    const tb = el("tbody");
    rows.forEach(([acc,val])=>{
      tb.appendChild(el("tr",{},[
        el("td",{},[acc]),
        el("td",{},[moneyBadge(val)])
      ]));
    });
    tbl.appendChild(tb);
    topDiv.appendChild(tbl);
  });
}

function exportReportCSV(){
  const rows = [["date","kind","amount","account","note","status"]];
  state.transactions.forEach(t=>{
    rows.push([t.date,t.kind,t.amount,t.account,t.note,t.status]);
  });
  const csv = rows.map(r=> r.map(x=> `"${String(x??"").replaceAll('"','""')}"`).join(",")).join("\n");
  downloadBlob("transactions.csv", new Blob([csv], {type:"text/csv;charset=utf-8"}));
  toast("تم تصدير CSV");
}

function exportReportXLSX(){
  if (!window.XLSX){
    toast("جاري تحميل مكتبة XLSX… أعد المحاولة");
    return;
  }
  const data = state.transactions.map(t=>({
    date: t.date,
    kind: t.kind,
    amount: Number(t.amount||0),
    account: t.account || "",
    note: t.note || "",
    status: t.status || ""
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transactions");
  const out = XLSX.write(wb, {bookType:"xlsx", type:"array"});
  downloadBlob("transactions.xlsx", new Blob([out], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
  toast("تم تصدير XLSX");
}

// ---------- Settings ----------
function screenSettings(){
  const wrap = el("div",{class:"stack"});
  wrap.appendChild(el("div",{class:"card stack"},[
    el("div",{class:"h1"},["الإعدادات"]),
    el("div",{class:"tiny"},["وضع تلقائي/فاتح/داكن + تسجيل دخول بالبريد (اختياري)"])
  ]));

  // theme
  const sel = el("select",{class:"select"});
  [
    ["auto","تلقائي (حسب الجهاز)"],
    ["light","فاتح"],
    ["dark","داكن"]
  ].forEach(([v,txt])=> sel.appendChild(el("option",{value:v, selected:state.themeMode===v},[txt])));
  sel.onchange = (e)=>{ state.themeMode = e.target.value; applyTheme(); toast("تم تحديث المظهر"); };

  wrap.appendChild(el("div",{class:"card stack"},[
    el("div",{class:"h2"},["المظهر"]),
    sel,
    el("div",{class:"tiny"},["التغيير يتم فوراً، ويدعم الوضع التلقائي."])
  ]));

  // auth email (optional)
  wrap.appendChild(el("div",{class:"card stack"},[
    el("div",{class:"h2"},["الحساب (اختياري)"]),
    el("div",{class:"tiny"},["إذا فعّلت Email/Password من Firebase يمكنك تسجيل الدخول هنا. لا نُخزّن كلمة المرور."]),
    authCard()
  ]));

  return wrap;
}

function authCard(){
  const email = el("input",{class:"input", type:"email", placeholder:"البريد الإلكتروني"});
  const pass = el("input",{class:"input", type:"password", placeholder:"كلمة المرور"});
  const row = el("div",{class:"grid2"},[
    el("button",{class:"btn", onclick: async ()=>{
      try{
        await loginEmail(email.value.trim(), pass.value);
        toast("تم تسجيل الدخول");
      }catch(e){ toast(e.message || "فشل تسجيل الدخول"); }
    }},["دخول"]),
    el("button",{class:"btn primary", onclick: async ()=>{
      try{
        await registerEmail(email.value.trim(), pass.value);
        toast("تم إنشاء حساب");
      }catch(e){ toast(e.message || "فشل إنشاء الحساب"); }
    }},["تسجيل"])
  ]);
  return el("div",{class:"stack"},[email, pass, row]);
}

// ---------- Modals / CRUD ----------
function openAddCashbox(){
  const name = el("input",{class:"input", placeholder:"اسم الصندوق"});
  const opening = el("input",{class:"input", type:"number", inputmode:"decimal", placeholder:"الرصيد الافتتاحي", value:"0"});
  const active = el("select",{class:"select"},[
    el("option",{value:"true", selected:true},["نشط"]),
    el("option",{value:"false"},["غير نشط"])
  ]);

  openModal({
    title:"إضافة صندوق",
    body: el("div",{class:"stack"},[
      name,
      opening,
      el("div",{},[el("div",{class:"tiny"},["الحالة"]), active])
    ]),
    actions:[
      {label:"إلغاء", variant:""},
      {label:"حفظ", variant:"primary", onClick: async ()=>{
        if (!name.value.trim()) { toast("اكتب اسم الصندوق"); return; }
        await createCashbox({name:name.value, openingBalance: Number(opening.value||0), isActive: active.value==="true"});
        toast("تمت الإضافة");
      }}
    ]
  });
}

function openTxActions(cashboxId, t){
  openModal({
    title:"إجراءات المعاملة",
    body: el("div",{class:"stack"},[
      el("div",{class:"item"},[
        el("div",{class:"iconpill"},[t.kind==="IN"?"⬆️":"⬇️"]),
        el("div",{class:"meta"},[
          el("div",{class:"name"},[t.account || "بدون حساب"]),
          el("div",{class:"sub"},[`${t.date} • ${t.note || "—"}`])
        ]),
        el("div",{class:"amt"},[fmtMoney(t.amount||0)])
      ]),
      el("div",{class:"tiny"},["يمكنك تعديل / حذف / جعلها ملغاة (Void)."])
    ]),
    actions:[
      {label:"إلغاء", variant:""},
      {label:"تعديل", variant:"primary", close:false, onClick: async ()=>{ closeModal(); openEditTx(cashboxId,t); }},
      {label:"حذف", variant:"danger", onClick: async ()=>{
        await deleteTransaction(cashboxId, t.id);
        toast("تم الحذف");
      }}
    ]
  });
}

function openAddTx(cashboxId){
  const date = el("input",{class:"input", type:"date", value: today()});
  const kind = el("select",{class:"select"},[
    el("option",{value:"IN"},["إيراد (IN)"]),
    el("option",{value:"OUT"},["مصروف (OUT)"])
  ]);
  const amount = el("input",{class:"input", type:"number", inputmode:"decimal", placeholder:"المبلغ"});
  const account = el("input",{class:"input", placeholder:"اسم الحساب/الجهة"});
  const note = el("textarea",{class:"textarea", placeholder:"ملاحظة (اختياري)"});

  openModal({
    title:"إضافة معاملة",
    body: el("div",{class:"stack"},[
      date,
      kind,
      amount,
      account,
      note
    ]),
    actions:[
      {label:"إلغاء"},
      {label:"حفظ", variant:"primary", onClick: async ()=>{
        if (!amount.value || Number(amount.value)<=0) { toast("اكتب مبلغ صحيح"); return; }
        if (!account.value.trim()) { toast("اكتب الحساب"); return; }
        await addTransaction(cashboxId, {
          date: date.value,
          kind: kind.value,
          amount: Number(amount.value),
          account: account.value,
          note: note.value,
          status: "active"
        });
        toast("تمت الإضافة");
      }}
    ]
  });
}

function openEditTx(cashboxId, t){
  const date = el("input",{class:"input", type:"date", value: t.date || today()});
  const kind = el("select",{class:"select"},[
    el("option",{value:"IN", selected:t.kind==="IN"},["إيراد (IN)"]),
    el("option",{value:"OUT", selected:t.kind==="OUT"},["مصروف (OUT)"])
  ]);
  const amount = el("input",{class:"input", type:"number", inputmode:"decimal", value: String(t.amount||0)});
  const account = el("input",{class:"input", value: t.account || ""});
  const note = el("textarea",{class:"textarea"},[t.note || ""]);
  const status = el("select",{class:"select"},[
    el("option",{value:"active", selected:(t.status||"active")==="active"},["نشطة"]),
    el("option",{value:"void", selected:(t.status||"active")==="void"},["ملغاة (Void)"])
  ]);

  openModal({
    title:"تعديل معاملة",
    body: el("div",{class:"stack"},[
      date,
      kind,
      amount,
      account,
      note,
      el("div",{},[el("div",{class:"tiny"},["الحالة"]), status])
    ]),
    actions:[
      {label:"إلغاء"},
      {label:"حفظ", variant:"primary", onClick: async ()=>{
        await updateTransaction(cashboxId, t.id, {
          date: date.value,
          kind: kind.value,
          amount: Number(amount.value||0),
          account: account.value,
          note: note.value,
          status: status.value
        });
        toast("تم التعديل");
      }}
    ]
  });
}

// ---------- Excel Import/Export ----------
function openExcelTools(cashboxId){
  const info = el("div",{class:"stack"},[
    el("div",{class:"tiny"},["التصدير: ينشئ ملف transactions.xlsx / transactions.csv"]),
    el("div",{class:"tiny"},["الاستيراد: ارفع ملف Excel يحتوي الأعمدة: date, kind, amount, account, note, status"]),
  ]);
  const file = el("input",{type:"file", class:"input", accept:".xlsx,.xls,.csv"});
  openModal({
    title:"Excel أدوات",
    body: el("div",{class:"stack"},[
      info,
      el("button",{class:"btn", onclick:()=>exportReportXLSX()},["تصدير XLSX"]),
      el("button",{class:"btn", onclick:()=>exportReportCSV()},["تصدير CSV"]),
      el("div",{class:"tiny"},["استيراد إلى نفس الصندوق:"]),
      file
    ]),
    actions:[
      {label:"إغلاق"},
      {label:"استيراد", variant:"primary", onClick: async ()=>{
        if (!file.files?.[0]) { toast("اختر ملف"); return; }
        await importExcelToCashbox(cashboxId, file.files[0]);
      }}
    ]
  });
}

async function importExcelToCashbox(cashboxId, f){
  if (!window.XLSX){
    toast("جاري تحميل مكتبة XLSX… أعد المحاولة");
    return;
  }
  const buf = await f.arrayBuffer();
  let wb;
  try{
    wb = XLSX.read(buf, {type:"array"});
  }catch(e){
    toast("ملف غير صالح");
    return;
  }
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, {defval:""});
  let ok = 0, bad = 0;
  for (const r of rows){
    const date = String(r.date||r.Date||"").slice(0,10);
    const kind = String(r.kind||r.Kind||"").toUpperCase();
    const amount = Number(r.amount||r.Amount||0);
    const account = String(r.account||r.Account||"").trim();
    const note = String(r.note||r.Note||"");
    const status = String(r.status||r.Status||"active") || "active";
    const isDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
    const isKind = (kind==="IN"||kind==="OUT");
    if (!isDate || !isKind || !(amount>0) || !account){
      bad++; continue;
    }
    await addTransaction(cashboxId, {date, kind, amount, account, note, status});
    ok++;
  }
  toast(`تم الاستيراد: ${ok} ✅ | تم تجاهل: ${bad} ⛔`);
}

// ---------- Cheques (image upload) ----------
function openChequeFlow(cashboxId){
  const amount = el("input",{class:"input", type:"number", inputmode:"decimal", placeholder:"مبلغ الشيك"});
  const due = el("input",{class:"input", type:"date", value: today()});
  const img = el("input",{class:"input", type:"file", accept:"image/*"});
  const preview = el("div",{class:"tiny"},["اختر صورة للشيك (اختياري)"]);

  openModal({
    title:"إضافة شيك",
    body: el("div",{class:"stack"},[
      amount, due, img, preview,
      el("div",{class:"tiny"},["سيتم رفع الصورة إلى Cloudinary (Unsigned) ثم حفظ الرابط في Firestore."])
    ]),
    actions:[
      {label:"إغلاق"},
      {label:"حفظ", variant:"primary", onClick: async ()=>{
        if (!amount.value || Number(amount.value)<=0){ toast("اكتب مبلغ صحيح"); return; }
        let url = "";
        if (img.files?.[0]){
          toast("رفع الصورة…");
          url = await uploadImage(img.files[0]);
        }
        await createCheque({cashboxId, amount:Number(amount.value), dueDate: due.value, imageUrl:url});
        toast("تم حفظ الشيك");
        closeModal();
        openChequesList(cashboxId);
      }}
    ]
  });
}

function openChequesList(cashboxId){
  const list = el("div",{class:"stack"});
  const card = el("div",{class:"card stack"},[
    el("div",{class:"row between"},[
      el("div",{class:"h1"},["الشيكات"]),
      el("button",{class:"btn", style:"width:auto;padding:0 14px", onclick:()=> navigate("statement",{cashboxId})},["رجوع"])
    ]),
    list
  ]);
  $("#main").innerHTML = "";
  $("#main").appendChild(card);

  if (state.chequesUnsub) state.chequesUnsub();
  state.chequesUnsub = watchCheques(cashboxId, (items)=>{
    state.cheques = items;
    list.innerHTML = "";
    items.forEach(c=>{
      const row = el("div",{class:"item"},[
        el("div",{class:"iconpill"},["🧾"]),
        el("div",{class:"meta"},[
          el("div",{class:"name"},[`شيك • ${fmtMoney(c.amount||0)}`]),
          el("div",{class:"sub"},[`استحقاق: ${c.dueDate || "—"}`])
        ]),
        c.imageUrl ? el("a",{href:c.imageUrl, target:"_blank", class:"badge"},["صورة"]) : el("span",{class:"tiny"},["—"])
      ]);
      list.appendChild(row);
    });
    if (!items.length) list.appendChild(el("div",{class:"tiny"},["لا يوجد شيكات بعد."]));
  });
}

// ---------- Topbar theme button quick toggle ----------
$("#btnTheme").onclick = ()=>{
  const order = ["auto","light","dark"];
  const next = order[(order.indexOf(state.themeMode)+1)%order.length];
  state.themeMode = next;
  applyTheme();
  toast(`المظهر: ${next === "auto" ? "تلقائي" : next === "light" ? "فاتح" : "داكن"}`);
};

