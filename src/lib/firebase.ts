import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC8vQjjeFmCVT5Nx75El7_OUkRo-cqgs4c",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "nexa-69000.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "nexa-69000",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "nexa-69000.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "590792933420",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:590792933420:web:c6e71583330963f5e45189",
  measurementId: "G-E3NHXEQWCZ"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
