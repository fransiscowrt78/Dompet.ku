'use strict';
// ─── AUTH STATE (Firebase Authentication) ────────────────────
let lMode = 'in';

// ─── ONBOARD ─────────────────────────────────────────────────
function checkOnboard() {
  const done = lsGet('dku_ob');
  if (!done) { showPage('pg-onboard'); return; }
  showPage('pg-login'); // actual routing happens via onAuthStateChanged below
}

function doneOnboard() {
  lsSet('dku_ob', 1);
  showPage('pg-login');
}

// ─── FIREBASE AUTH STATE LISTENER ────────────────────────────
// Fires once immediately with the current session (if any) on every page
// load — this is what makes "stay logged in after closing the app" work —
// and again automatically whenever the user logs in or out.
fbAuth.onAuthStateChanged(async (user) => {
  try {
    if (user) {
      S = { uid: user.uid, email: user.email, displayName: user.email.split('@')[0] };
      let data = await fetchUserData(user.uid);
      if (data) {
        D = data;
        migrateD();
        if (D.displayName) S.displayName = D.displayName;
        // Self-heal: if Firestore was unreachable earlier (e.g. security rules
        // misconfigured) and this data actually came from the local fallback,
        // this push syncs it up the moment Firestore becomes writable again.
        // Harmless no-op if Firestore already matches.
        saveUserData(user.uid, D).catch(() => {});
      } else {
        // Brand-new account — no Firestore doc AND no local fallback either.
        D = initD();
        D.displayName = _pendingDisplayName || S.displayName;
        S.displayName = D.displayName;
        _pendingDisplayName = null;
        await saveUserData(user.uid, D);
      }
      if (_unsubscribeUserData) _unsubscribeUserData();
      _unsubscribeUserData = listenUserData(user.uid, (remoteData) => {
        D = remoteData;
        migrateD();
        refreshCurrentPage();
      }, () => showToast('⚠️ Koneksi sinkronisasi terputus'));
      await initApp();
      await checkDeletionStatusOnLogin();
    } else {
      S = null; D = null;
      if (_unsubscribeUserData) { _unsubscribeUserData(); _unsubscribeUserData = null; }
      hide('nav');
      document.querySelectorAll('.ov').forEach(o => o.classList.add('hidden'));
      el('l-name').value = ''; el('l-user').value = ''; el('l-pw').value = ''; el('l-pw2').value = '';
      showPage('pg-login');
    }
  } catch (err) {
    console.error('Auth state handling failed:', err);
    showToast('⚠️ Gagal memuat data akun. Coba refresh.');
  }
});

// ─── LOGIN / REGISTER ────────────────────────────────────────
function lTab(t) {
  lMode = t;
  el('lt-in').classList.toggle('on', t==='in');
  el('lt-reg').classList.toggle('on', t==='reg');
  el('l-name-row').classList.toggle('hidden', t==='in');
  el('l-pw2-row').classList.toggle('hidden', t==='in');
  el('l-btn').textContent = t==='in' ? 'Masuk' : 'Daftar';
}

function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

// Set just before createUserWithEmailAndPassword resolves, then read once by
// the onAuthStateChanged handler in app.js when it creates the brand-new
// account's initial Firestore document. Using a shared variable (rather than
// writing directly here) avoids a race between this function and the auth
// state listener both trying to initialize the same new document at once.
let _pendingDisplayName = null;

async function doLogin() {
  const name  = sanitizeText(el('l-name').value, 40);
  const email = sanitizeText(el('l-user').value, 100).toLowerCase();
  const p  = el('l-pw').value.slice(0, 200);
  const p2 = el('l-pw2').value.slice(0, 200);
  if (!email || !p) { showToast('Email & password wajib!'); return; }
  if (!isValidEmail(email)) { showToast('Format email tidak valid'); return; }

  const btn = el('l-btn');
  btn.disabled = true; const origText = btn.textContent; btn.textContent = 'Memproses…';
  try {
    if (lMode === 'reg') {
      if (!name) { showToast('Isi nama yang ingin dipakai!'); return; }
      if (p.length < 6) { showToast('Password min 6 karakter'); return; }
      if (p !== p2) { showToast('Password tidak cocok'); return; }
      _pendingDisplayName = name;
      await fbAuth.createUserWithEmailAndPassword(email, p);
    } else {
      await fbAuth.signInWithEmailAndPassword(email, p);
    }
    // onAuthStateChanged listener above takes over from here.
  } catch (err) {
    _pendingDisplayName = null;
    showToast(friendlyAuthError(err));
  } finally {
    btn.disabled = false; btn.textContent = origText;
  }
}

// ─── EDIT DISPLAY NAME ────────────────────────────────────────
function openEditName() {
  el('en-name').value = S.displayName || '';
  show('ov-edit-name');
}

async function confirmEditName() {
  const name = sanitizeText(el('en-name').value, 40);
  if (!name) { showToast('Nama tidak boleh kosong!'); return; }
  S.displayName = name;
  const nd = JSON.parse(JSON.stringify(D));
  nd.displayName = name;
  await save(nd);
  hide('ov-edit-name');
  renderSettingsPage();
  el('h-uname').textContent = name;
  el('h-av').textContent = name[0].toUpperCase();
  showToast('Nama tampilan diperbarui ✓');
}

function friendlyAuthError(err) {
  const map = {
    'auth/email-already-in-use': 'Email sudah terdaftar. Coba menu Masuk.',
    'auth/invalid-email': 'Format email tidak valid.',
    'auth/weak-password': 'Password terlalu lemah (min 6 karakter).',
    'auth/user-not-found': 'Akun dengan email ini tidak ditemukan.',
    'auth/wrong-password': 'Password salah.',
    'auth/invalid-credential': 'Email atau password salah.',
    'auth/too-many-requests': 'Terlalu banyak percobaan gagal. Coba lagi beberapa menit.',
    'auth/network-request-failed': 'Tidak ada koneksi internet.',
    'auth/requires-recent-login': 'Sesi terlalu lama — masuk ulang dulu.',
  };
  return map[err.code] || ('Gagal: ' + (err.message || 'terjadi kesalahan'));
}

// ─── FORGOT PASSWORD ─────────────────────────────────────────
// IMPORTANT BEHAVIOR NOTE: every Firebase project created from 15 Sept 2023
// onward (this one included) has "Email Enumeration Protection" ON by
// default. Under that setting, sendPasswordResetEmail() ALWAYS resolves
// successfully — even for an email that isn't registered — and Firebase
// gives NO error and NO signal at all about whether a real email was
// actually sent. This is an intentional Google privacy/security design,
// not a bug, and there is no client-side-only way to detect true delivery
// failure (that would require a backend with the Admin SDK, which this
// project deliberately doesn't use). So the toast below is phrased to
// reflect that honestly, and genuine failures (bad format, no internet,
// rate-limited) still surface a clear error via friendlyAuthError().
let _resetCooldownUntil = 0;

async function doForgotPassword() {
  const email = sanitizeText(el('l-user').value, 100).toLowerCase();
  if (!email || !isValidEmail(email)) { showToast('Isi email yang valid dulu di kolom atas'); return; }

  const now = Date.now();
  if (now < _resetCooldownUntil) {
    const sisa = Math.ceil((_resetCooldownUntil - now) / 1000);
    showToast(`Tunggu ${sisa} detik sebelum kirim ulang`);
    return;
  }

  try {
    await fbAuth.sendPasswordResetEmail(email);
    _resetCooldownUntil = Date.now() + 60000; // 60s cooldown — avoids tripping Firebase's abuse rate-limit
    showToast(`Jika ${email} terdaftar, link reset sudah dikirim. Cek juga folder Spam/Promosi 📩`);
  } catch (err) {
    showToast(friendlyAuthError(err));
  }
}

// ─── LOGOUT ──────────────────────────────────────────────────
async function doLogout() {
  try { await fbAuth.signOut(); } catch (err) { console.error('Sign out failed:', err); }
  // onAuthStateChanged listener above handles resetting the UI.
}

// ─── CHANGE PASSWORD (requires re-authentication per Firebase security rules) ──
async function doChangePw() {
  const op  = el('cp-old').value.slice(0,200);
  const np  = el('cp-new').value.slice(0,200);
  const np2 = el('cp-new2').value.slice(0,200);
  if (!op || !np || !np2) { showToast('Lengkapi semua field!'); return; }
  if (np !== np2) { showToast('Password baru tidak cocok'); return; }
  if (np.length < 6) { showToast('Password baru min 6 karakter'); return; }
  try {
    const cred = firebase.auth.EmailAuthProvider.credential(S.email, op);
    await fbAuth.currentUser.reauthenticateWithCredential(cred);
    await fbAuth.currentUser.updatePassword(np);
    hide('ov-change-pw');
    el('cp-old').value=''; el('cp-new').value=''; el('cp-new2').value='';
    showToast('Password berhasil diubah ✓');
  } catch (err) {
    showToast(friendlyAuthError(err));
  }
}
