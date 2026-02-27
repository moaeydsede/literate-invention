// Firebase bootstrap (modular v9+)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export const firebaseConfig = {
  "apiKey": "AIzaSyCZiGxUHq8tGuU9BWoXDNJuy-0dbUakA5I",
  "authDomain": "sweng-2f675.firebaseapp.com",
  "projectId": "sweng-2f675",
  "storageBucket": "sweng-2f675.firebasestorage.app",
  "messagingSenderId": "815669038878",
  "appId": "1:815669038878:web:d7487b86cadf40bbf0c30f"
};
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { serverTimestamp };

export async function ensureAuth() {
  // Prefer existing session; otherwise anonymous sign-in
  if (auth.currentUser) return auth.currentUser;
  await signInAnonymously(auth);
  return auth.currentUser;
}

export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

export async function loginEmail(email, password) {
  return await signInWithEmailAndPassword(auth, email, password);
}

export async function registerEmail(email, password) {
  return await createUserWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  return await signOut(auth);
}
