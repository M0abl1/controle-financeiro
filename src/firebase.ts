import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithRedirect, signOut } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
export const firebaseEnabled = Boolean(config.apiKey && config.projectId)
const app = firebaseEnabled ? initializeApp(config) : null
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
export async function googleLogin() { if (!auth) throw new Error('Configure o Firebase no arquivo .env.local'); return signInWithRedirect(auth, new GoogleAuthProvider()) }
export async function logout() { if (auth) await signOut(auth) }
