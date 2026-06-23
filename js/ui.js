'use strict';
// ─── TOAST & UNDO ────────────────────────────────────────────
let _undoFn = null, _undoTimer = null;

function showToast(msg, undoFn = null) {
  clearTimeout(_undoTimer);
  _undoFn = undoFn;
  el('toast-msg').textContent = msg;
  el('toast-undo').style.display = undoFn ? 'inline-block' : 'none';
  const t = el('toast'); t.classList.add('show');
  _undoTimer = setTimeout(() => t.classList.remove('show'), 4000);
}
async function doUndo() {
  el('toast').classList.remove('show');
  if (_undoFn) { await _undoFn(); _undoFn = null; }
}

// ─── PAGE NAVIGATION ─────────────────────────────────────────
// Uses inline styles (not just CSS classes) for bulletproof page isolation.
// Belt-and-suspenders: pages also have style="display:none" in HTML.
function showPage(id) {
  // Hide ALL pages with inline style - reliable regardless of CSS loading
  document.querySelectorAll('.page').forEach(p => {
    p.style.display = 'none';
    p.classList.remove('active');
  });

  const target = el(id);
  if (!target) return;

  // Login and onboard need flex layout; all other pages use block
  const flexPages = ['pg-login', 'pg-onboard'];
  target.style.display = flexPages.includes(id) ? 'flex' : 'block';
  target.classList.add('active');

  // Sync bottom nav tab highlight
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
  const tabMap = {
    'pg-beranda':   'tab-beranda',
    'pg-transaksi': 'tab-transaksi',
    'pg-laporan':   'tab-laporan',
    'pg-utang':     'tab-utang'
  };
  if (tabMap[id]) el(tabMap[id])?.classList.add('on');

  // Scroll to top of page-area on every navigation
  const pa = el('page-area');
  if (pa) pa.scrollTop = 0;
}

// ─── CUSTOM CONFIRM MODAL ─────────────────────────────────────
// Native confirm() is unreliable inside Android WebView / Capacitor / PWA
// wrappers — some configurations silently auto-dismiss it without showing
// anything. This promise-based modal replaces it everywhere in the app.
let _confirmResolve = null;

function customConfirm(message, title = 'Konfirmasi') {
  return new Promise((resolve) => {
    _confirmResolve = resolve;
    el('confirm-title').textContent = title;
    el('confirm-msg').textContent = message;
    show('ov-confirm');
  });
}
function _resolveConfirm(result) {
  hide('ov-confirm');
  if (_confirmResolve) { _confirmResolve(result); _confirmResolve = null; }
}
function trxRowHTML(t) {
  const w   = W(t.wallet);
  const cat = t.cat ? CAT[t.cat] : null;
  const col = t.tipe==='masuk' ? 'var(--mint)' : t.tipe==='transfer' ? 'var(--iris)' : 'var(--rose)';
  const sgn = t.tipe==='masuk' ? '+' : t.tipe==='transfer' ? '⇄' : '−';
  const noteLine = t.note ? `<div class="trx-note">📝 ${esc(t.note.length>45 ? t.note.slice(0,45)+'…' : t.note)}</div>` : '';
  const recurBadge = t.recurId ? '<span class="trx-recur">🔄</span>' : '';
  return `<div class="trx-row" onclick="openEditTrx(${t.id})">
    <div class="trx-ico" style="background:${w.color}18;">${cat ? cat.e : w.icon}</div>
    <div class="trx-mid">
      <div class="trx-name">${esc(t.ket)}${recurBadge}</div>
      <div class="trx-sub">${w.name}${cat ? ' · '+cat.n : ''}</div>
      ${noteLine}
    </div>
    <div class="trx-right">
      <div class="trx-amt" style="color:${col};">${sgn}${rp(t.nominal)}</div>
      <div class="trx-time">${fTime(t.ts)}</div>
    </div>
  </div>`;
}
