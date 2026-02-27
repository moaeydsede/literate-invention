// Firestore data access layer
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, orderBy, where, limit,
  onSnapshot, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db, ensureAuth } from "./firebase.js";

const cashboxesCol = () => collection(db, "cashboxes");
const cashboxDoc = (id) => doc(db, "cashboxes", id);
const txCol = (cashboxId) => collection(db, "cashboxes", cashboxId, "transactions");
const chequesCol = () => collection(db, "cheques");

export async function createCashbox({ name, openingBalance=0, isActive=true }) {
  await ensureAuth();
  const now = serverTimestamp();
  const ref = await addDoc(cashboxesCol(), {
    name: String(name || "").trim(),
    openingBalance: Number(openingBalance || 0),
    balance: Number(openingBalance || 0),
    isActive: !!isActive,
    createdAt: now,
    updatedAt: now
  });
  return ref.id;
}

export async function updateCashbox(id, patch) {
  await ensureAuth();
  const now = serverTimestamp();
  const clean = { ...patch, updatedAt: now };
  // Never allow NaN
  if (clean.openingBalance != null) clean.openingBalance = Number(clean.openingBalance || 0);
  if (clean.balance != null) clean.balance = Number(clean.balance || 0);
  await updateDoc(cashboxDoc(id), clean);
}

export async function deleteCashbox(id) {
  await ensureAuth();
  // Delete cashbox + its transactions (best-effort for small sizes)
  const batch = writeBatch(db);
  batch.delete(cashboxDoc(id));
  const txSnap = await getDocs(query(txCol(id), limit(500)));
  txSnap.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

export function watchCashboxes(cb) {
  return onSnapshot(query(cashboxesCol(), orderBy("updatedAt","desc")), (snap)=>{
    const items = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    cb(items);
  });
}

export async function addTransaction(cashboxId, tx) {
  await ensureAuth();
  const now = serverTimestamp();
  const payload = {
    date: tx.date, // YYYY-MM-DD
    kind: tx.kind, // IN | OUT
    amount: Number(tx.amount || 0),
    account: String(tx.account || "").trim(),
    note: String(tx.note || "").trim(),
    status: tx.status || "active",
    createdAt: now
  };
  const ref = await addDoc(txCol(cashboxId), payload);
  await recalcBalance(cashboxId);
  return ref.id;
}

export async function updateTransaction(cashboxId, txId, patch) {
  await ensureAuth();
  const ref = doc(db, "cashboxes", cashboxId, "transactions", txId);
  const clean = { ...patch };
  if (clean.amount != null) clean.amount = Number(clean.amount || 0);
  await updateDoc(ref, clean);
  await recalcBalance(cashboxId);
}

export async function deleteTransaction(cashboxId, txId) {
  await ensureAuth();
  const ref = doc(db, "cashboxes", cashboxId, "transactions", txId);
  await deleteDoc(ref);
  await recalcBalance(cashboxId);
}

export function watchTransactions(cashboxId, {from=null, to=null}={}, cb) {
  let q = query(txCol(cashboxId), orderBy("date","desc"), orderBy("createdAt","desc"));
  // client-side filtering for simplicity; date is a string
  return onSnapshot(q, (snap)=>{
    let items = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    if (from) items = items.filter(t=>t.date >= from);
    if (to) items = items.filter(t=>t.date <= to);
    cb(items);
  });
}

export async function getCashbox(id){
  await ensureAuth();
  const d = await getDoc(cashboxDoc(id));
  if (!d.exists()) return null;
  return { id:d.id, ...d.data() };
}

export async function recalcBalance(cashboxId){
  const cashbox = await getCashbox(cashboxId);
  if (!cashbox) return;
  const snap = await getDocs(query(txCol(cashboxId)));
  let balance = Number(cashbox.openingBalance || 0);
  snap.forEach(d=>{
    const t = d.data();
    if (t.status && t.status !== "active") return;
    const amt = Number(t.amount || 0);
    if (t.kind === "IN") balance += amt;
    else balance -= amt;
  });
  await updateCashbox(cashboxId, { balance });
}

export async function createCheque({cashboxId, amount, dueDate, imageUrl, status="pending"}){
  await ensureAuth();
  const now = serverTimestamp();
  const ref = await addDoc(chequesCol(), {
    cashboxId,
    amount: Number(amount || 0),
    dueDate,
    imageUrl,
    status,
    createdAt: now
  });
  return ref.id;
}

export function watchCheques(cashboxId, cb){
  return onSnapshot(
    query(chequesCol(), where("cashboxId","==",cashboxId), orderBy("dueDate","asc")),
    (snap)=> cb(snap.docs.map(d=>({id:d.id, ...d.data()})))
  );
}
