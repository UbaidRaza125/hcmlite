// Firebase web SDK bootstrap. These values are public app identifiers, not server secrets.
// Authentication for the current HCM Lite app remains the server-issued JWT flow;
// do not use this client SDK to bypass the backend's role/scope checks.
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDT-uITQWnx_t02rF9YbnoV5_2a4Z_SumQ',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'hcm-project-368fc.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'hcm-project-368fc',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'hcm-project-368fc.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '955139939643',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:955139939643:web:b8558daf95c7ee6aa22b1e',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
export { firebaseConfig };
