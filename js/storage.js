'use strict';
// ─── STORAGE LAYER (Firestore-backed) ────────────────────────
// Each account's entire data blob lives in one document: users/{uid}.
// Firestore's own offline cache (enabled in firebase-config.js) handles
// reading/writing while offline and syncs automatically once back online —
// so this layer no longer needs the old manual localStorage fallback chain
// for normal operation. A localStorage fallback is kept only for the
// catastrophic case where the Firebase SDK itself fails to load (e.g.
// network blocking gstatic.com entirely), so the app degrades gracefully
// instead of crashing.
const FB_OK = typeof firebase !== 'undefined' && typeof fbDb !== 'undefined';

function userDocRef(uid) {
  return fbDb.collection('users').doc(uid);
}

// One-time fetch of a user's data document.
//
// IMPORTANT: if Firestore Security Rules were ever misconfigured (denying
// writes), saveUserData() would have silently fallen back to local-only
// storage on this device for a while — meaning the Firestore document could
// be genuinely empty even though the account is NOT actually new and has
// real local data. So an empty/missing Firestore doc is NOT, by itself,
// reliable proof of "this is a brand-new account" — we only treat it as
// brand-new if there's ALSO no local fallback copy.
async function fetchUserData(uid) {
  const localFallback = lsGet('dku_fallback_'+uid);
  if (!FB_OK) return localFallback;
  try {
    const snap = await userDocRef(uid).get();
    if (snap.exists) return snap.data();
    return localFallback || null; // empty in cloud but real data may exist locally
  } catch (err) {
    console.error('fetchUserData failed:', err);
    return localFallback;
  }
}

// Writes the full data blob for a user. Returns a status string so callers
// can warn the user if persistence degraded to the local-only fallback.
async function saveUserData(uid, data) {
  if (!FB_OK) { lsSet('dku_fallback_'+uid, data); return 'local-fallback'; }
  try {
    await userDocRef(uid).set(data);
    lsSet('dku_fallback_'+uid, data); // mirror locally too, belt-and-suspenders
    return 'cloud';
  } catch (err) {
    console.error('saveUserData failed:', err);
    const ok = lsSet('dku_fallback_'+uid, data);
    return ok ? 'local-fallback' : 'failed';
  }
}

// Real-time listener — fires whenever data changes, including from other
// devices signed into the same account. Returns an unsubscribe function.
function listenUserData(uid, onChange, onError) {
  if (!FB_OK) return () => {};
  return userDocRef(uid).onSnapshot(
    (snap) => { if (snap.exists) onChange(snap.data()); },
    (err) => { console.error('Snapshot listener error:', err); if (onError) onError(err); }
  );
}

// ─── Plain local key/value helpers (used for onboarding flag, last-tap, etc. —
// small device-local UI preferences that don't need to sync across devices) ──
const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
