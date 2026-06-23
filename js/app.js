'use strict';
// ─── GLOBAL ERROR HANDLING (Bagian 8) ────────────────────────
window.addEventListener('error', (e) => {
  console.error('Uncaught error:', e.error || e.message);
  try { showToast('⚠️ Terjadi kesalahan. Coba ulangi aksi terakhir.'); } catch {}
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
  try { showToast('⚠️ Terjadi kesalahan saat memproses data.'); } catch {}
});

// ─── DATA INIT ───────────────────────────────────────────────
function initD() {
  const w={};
  DEF_WL.forEach(x=>{ w[x.id]=0; });
  return {
    displayName: '',
    wallets:     w,
    walletList:  JSON.parse(JSON.stringify(DEF_WL)),
    transaksi:   [],
    profitSplit: {modal:50, priv:50},
    utang:       [],
    targets:     [],
    recurring:   [],
    lastTapNom:  10000,
    deletion:    { status:'none', token:null, requestedAt:null, scheduledFor:null }
  };
}

function migrateD() {
  if (!D) return;
  if (!D.walletList)  D.walletList = JSON.parse(JSON.stringify(DEF_WL));
  if (!D.utang)       D.utang = [];
  if (!D.lastTapNom)  D.lastTapNom = 10000;
  if (!D.targets)     D.targets = [];
  if (!D.recurring)   D.recurring = [];
  if (typeof D.displayName === 'undefined') D.displayName = '';
  if (!D.deletion)    D.deletion = { status:'none', token:null, requestedAt:null, scheduledFor:null };
  if (!D.profitSplit || typeof D.profitSplit.modal==='undefined') {
    const mp = D.profitSplit?.modalPct || 50;
    D.profitSplit = {modal:mp, priv:100-mp};
  }
  // Clean up legacy local-auth fields no longer used now that Firebase Auth
  // handles identity — pwHash/pin used to live on D in the pre-Firebase version.
  if (D.pwHash !== undefined) delete D.pwHash;
  if (D.pin !== undefined) delete D.pin;
  if (D.savingStreak !== undefined) delete D.savingStreak;
}

// ─── INIT APP ────────────────────────────────────────────────
async function initApp() {
  const name = S.displayName || S.email.split('@')[0];
  el('h-greet').textContent  = greet();
  el('h-uname').textContent  = name;
  el('h-av').textContent     = name[0].toUpperCase();
  el('s-av').textContent     = name[0].toUpperCase();
  el('s-name').textContent   = name;
  el('s-email').textContent = S.email;
  el('s-sub').textContent    = `${D.walletList.length} dompet aktif`;
  el('s-wallet-sub').textContent = `${D.walletList.length} dompet`;
  el('s-split-sub').textContent  = `${D.profitSplit.modal}% modal / ${D.profitSplit.priv}% pribadi`;
  updateRecurSub();

  await checkRecurring();

  const now=new Date();
  rptY=now.getFullYear(); rptM=now.getMonth();
  tPY=now.getFullYear(); tPM=now.getMonth(); tPeriodMode='month';

  show('nav');
  showPage('pg-beranda');
  el('tab-beranda').classList.add('on');
  renderBeranda();
}

// ─── PAGE NAVIGATION ─────────────────────────────────────────
function goPage(p) {
  document.querySelectorAll('.ov').forEach(o=>o.classList.add('hidden'));
  showPage('pg-'+p);
  if(p==='beranda')   { renderBeranda(); }
  if(p==='transaksi') { tWF='all'; tCF='all'; _gotoTransaksi(); }
  if(p==='laporan')   { const n=new Date(); rptY=n.getFullYear(); rptM=n.getMonth(); renderLaporan(); }
  if(p==='utang')     { utFiltState='all'; utMode='saya'; renderUtang(); }
  if(p==='settings')  { updateRecurSub(); renderSettingsPage(); }
}

function _gotoTransaksi() {
  tCF='all'; tPeriodMode='month';
  const now=new Date(); tPY=now.getFullYear(); tPM=now.getMonth();
  document.querySelectorAll('.period-chip').forEach(c=>c.classList.remove('on'));
  el('tpc-month')?.classList.add('on');
  el('t-month-nav')?.classList.remove('hidden');
  el('t-date-range')?.classList.add('hidden');
  renderTrx();
}

// ─── LIVE SYNC: re-render whatever page is active ────────────
// Called by the Firestore real-time listener (storage.js) whenever data
// changes — including edits made from a different device on the same
// account — so the UI updates immediately without needing a manual refresh.
function refreshCurrentPage() {
  if (!S || !D) return;
  const active = document.querySelector('.page.active');
  if (!active) return;
  switch (active.id) {
    case 'pg-beranda':   renderBeranda(); break;
    case 'pg-transaksi': renderTrx(); break;
    case 'pg-laporan':   renderLaporan(); break;
    case 'pg-utang':     renderUtang(); break;
    case 'pg-settings':  renderSettingsPage(); break;
  }
}

// ─── BOOT ────────────────────────────────────────────────────
(async () => {
  try {
    checkOnboard();
  } catch (err) {
    console.error('Boot failed:', err);
    document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;padding:24px;text-align:center;color:#dce4f0;font-family:sans-serif;">
      <div>
        <div style="font-size:32px;margin-bottom:12px;">⚠️</div>
        <div style="font-weight:700;margin-bottom:6px;">Gagal memuat aplikasi</div>
        <div style="font-size:13px;color:#6b7fa0;">Coba refresh halaman. Jika masih gagal, hubungi developer.</div>
      </div>
    </div>`;
  }
})();

// ─── SETTINGS PAGE RENDER ───────────────────────────────────
function renderSettingsPage() {
  if (!S || !D) return;
  const name = S.displayName || S.email.split('@')[0];
  el('s-av').textContent     = name[0].toUpperCase();
  el('s-name').textContent   = name;
  el('s-email').textContent  = S.email;
  el('s-name-sub').textContent = `Saat ini: ${name}`;
  el('s-sub').textContent    = `${D.walletList.length} dompet aktif`;
  el('s-wallet-sub').textContent = `${D.walletList.length} dompet`;
  el('s-split-sub').textContent  = `${D.profitSplit.modal}% modal / ${D.profitSplit.priv}% pribadi`;
  updateRecurSub();
}
