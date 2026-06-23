'use strict';
// ─── ACCOUNT DELETION (simplified — no email step) ───────────
// Flow:
//   1. User taps "Hapus Akun" → confirmation modal, "Ya, Hapus" disabled for 5s
//   2. After 5s, user must also type "HAPUS" to enable the final button
//      (two layers of friction since there's no email-confirmation step here)
//   3. On confirm: deletion.scheduledFor = now + 30 days, saved immediately
//   4. Every login checks deletion.status:
//        'scheduled', days left > 0  → show days remaining, Cancel/Lanjutkan
//        'scheduled', days left <= 0 → no scheduler runs this automatically
//          (there's no backend) — so it executes lazily right here, the next
//          time the account owner happens to log in after the 30 days pass.
let _delCountdownTimer = null;
let _delTimerDone = false;

// ─── STEP 1: Open confirmation modal with 5s delayed button + type-to-confirm ──
function openDeleteAccount() {
  show('ov-delete-confirm');
  el('del-confirm-type').value = '';
  _delTimerDone = false;
  const btn = el('del-confirm-btn');
  let secs = 5;
  btn.disabled = true;
  btn.textContent = `Tunggu ${secs}s…`;
  clearInterval(_delCountdownTimer);
  _delCountdownTimer = setInterval(() => {
    secs--;
    if (secs <= 0) {
      clearInterval(_delCountdownTimer);
      _delTimerDone = true;
      checkDeleteTypedConfirm(); // re-evaluate against whatever's already typed
    } else {
      btn.textContent = `Tunggu ${secs}s…`;
    }
  }, 1000);
}

function closeDeleteAccount() {
  clearInterval(_delCountdownTimer);
  hide('ov-delete-confirm');
}

// Called on every keystroke in the "type HAPUS" field, and once the 5s timer
// finishes — button only enables once BOTH conditions are satisfied.
function checkDeleteTypedConfirm() {
  const btn = el('del-confirm-btn');
  const typedOk = el('del-confirm-type').value.trim().toUpperCase() === 'HAPUS';
  if (_delTimerDone && typedOk) {
    btn.disabled = false;
    btn.textContent = 'Ya, Hapus Akun Saya';
  } else if (_delTimerDone) {
    btn.disabled = true;
    btn.textContent = 'Ketik "HAPUS" di atas';
  }
}

// ─── STEP 2: Confirmed — schedule deletion 30 days out, no email needed ──────
async function confirmDeleteAccountStep1() {
  const btn = el('del-confirm-btn');
  if (btn.disabled) return;
  btn.disabled = true; btn.textContent = 'Memproses…';

  try {
    const scheduledFor = Date.now() + 30*24*60*60*1000;
    const nd = JSON.parse(JSON.stringify(D));
    nd.deletion = { status:'scheduled', token:null, requestedAt: Date.now(), scheduledFor };
    const tier = await save(nd);

    if (tier !== 'cloud') {
      showToast('⚠️ Gagal menyimpan ke cloud. Periksa koneksi, lalu coba lagi.');
      const rb = JSON.parse(JSON.stringify(D));
      rb.deletion = { status:'none', token:null, requestedAt:null, scheduledFor:null };
      await save(rb);
      return;
    }

    hide('ov-delete-confirm');
    const tgl = new Date(scheduledFor).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'});
    showToast(`Akun dijadwalkan terhapus pada ${tgl}. Login lagi sebelum itu untuk membatalkan.`);
  } catch (err) {
    console.error('Delete account failed:', err);
    showToast('⚠️ Terjadi kesalahan. Coba lagi.');
  } finally {
    btn.disabled = false; btn.textContent = 'Ya, Hapus Akun Saya';
  }
}

// ─── STEP 3: Check on every login ─────────────────────────────
async function checkDeletionStatusOnLogin() {
  if (!D?.deletion || D.deletion.status === 'none') return;
  if (D.deletion.status !== 'scheduled') return; // legacy 'pending_email' state from an old build, ignore

  const msLeft = D.deletion.scheduledFor - Date.now();
  if (msLeft <= 0) {
    // Grace period already passed — no background job ran this since there's
    // no server, so it executes now, lazily, the moment the owner logs back in.
    await executeLazyDeletion();
    return;
  }
  const daysLeft = Math.ceil(msLeft / (24*60*60*1000));
  const tgl = new Date(D.deletion.scheduledFor).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'});
  el('del-status-title').textContent = 'Akun Dijadwalkan Terhapus';
  el('del-status-msg').textContent = `Akun ini akan terhapus permanen pada ${tgl} (${daysLeft} hari lagi). Mau batalkan, atau lanjutkan?`;
  el('del-status-cancel').textContent = 'Batalkan Penghapusan';
  el('del-status-continue').classList.remove('hidden');
  show('ov-deletion-status');
}

async function cancelAccountDeletion() {
  const nd = JSON.parse(JSON.stringify(D));
  nd.deletion = { status:'none', token:null, requestedAt:null, scheduledFor:null };
  await save(nd);
  hide('ov-deletion-status');
  showToast('Penghapusan akun dibatalkan ✓ Akun kamu aman.');
}

function continueAccountDeletion() {
  hide('ov-deletion-status');
}

// ─── STEP 4: Actually delete (lazy — runs on first login after day 30) ──
async function executeLazyDeletion() {
  try {
    await userDocRef(S.uid).delete();
    await fbAuth.currentUser.delete();
    lsSet('dku_fallback_'+S.uid, null);
  } catch (err) {
    console.error('Account deletion failed:', err);
    if (err.code === 'auth/requires-recent-login') {
      showToast('Sesi login sudah lama — masuk ulang dulu, lalu data akan otomatis terhapus.');
      await fbAuth.signOut();
    } else {
      showToast('⚠️ Gagal menghapus akun otomatis. Hubungi developer.');
    }
  }
}
