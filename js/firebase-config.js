'use strict';
// ─── FIREBASE CONFIG ──────────────────────────────────────────
// Project: Dompetku (console.firebase.google.com)
// Note: Firebase apiKey is NOT a secret — it identifies the project only.
// Actual access control is enforced by Firestore Security Rules + Auth,
// so it's safe for this to be public/visible in client-side code.
const firebaseConfig = {
  apiKey: "AIzaSyAEZ9rt7lj0AZ2RojO1xddvCwTh4jbf1Ak",
  authDomain: "dompetku-5e797.firebaseapp.com",
  projectId: "dompetku-5e797",
  storageBucket: "dompetku-5e797.firebasestorage.app",
  messagingSenderId: "508059111785",
  appId: "1:508059111785:web:5741e5930612baefeaedf8",
  measurementId: "G-0Y93PDH3J2"
};

firebase.initializeApp(firebaseConfig);
const fbAuth = firebase.auth();
const fbDb   = firebase.firestore();

// Offline cache — lets the app read/write while offline; Firestore syncs
// automatically once connectivity returns. Wrapped in try/catch because it
// fails if multiple tabs of the app are open at once (non-fatal, app still works).
try {
  fbDb.enablePersistence({ synchronizeTabs: true }).catch((err) => {
    console.warn('Firestore offline persistence not enabled:', err.code);
  });
} catch (err) {
  console.warn('Firestore offline persistence error:', err);
}
