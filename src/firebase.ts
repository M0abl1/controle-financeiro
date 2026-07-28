import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const firebaseEnabled = Boolean(config.apiKey && config.projectId);
const app = firebaseEnabled ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export async function googleLogin() {
  if (!auth) throw new Error("Configure o Firebase no arquivo .env.local");
  await setPersistence(auth, browserLocalPersistence);
  return signInWithPopup(auth, new GoogleAuthProvider());
}
export async function emailLogin(email: string, password: string) {
  if (!auth) throw new Error("Configure o Firebase no arquivo .env.local");
  await setPersistence(auth, browserLocalPersistence);
  return signInWithEmailAndPassword(auth, email, password);
}
export async function createAccount(email: string, password: string) {
  if (!auth) throw new Error("Configure o Firebase no arquivo .env.local");
  await setPersistence(auth, browserLocalPersistence);
  return createUserWithEmailAndPassword(auth, email, password);
}
export async function resetPassword(email: string) {
  if (!auth) throw new Error("Configure o Firebase no arquivo .env.local");
  return sendPasswordResetEmail(auth, email);
}
export async function logout() {
  if (auth) await signOut(auth);
}
