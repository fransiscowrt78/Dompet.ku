'use strict';
// ─── BERANDA (DASHBOARD) ─────────────────────────────────────

function renderBeranda() {
  if (!D) return;
  const tot  = D.walletList.reduce((s,w)=>s+(D.wallets[w.id]||0),0);
  const now  = new Date();
  const mTrx = D.transaksi.filter(t=>{
    const d=new Date(t.ts);
    return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();
  });

  let mi=0, ko=0;
  mTrx.forEach(t=>{
    if(t.tipe==='masuk') mi+=t.nominal;
    else if(t.tipe==='keluar') ko+=t.nominal;
  });
  const net = mi - ko;

  // ── Hero ──
  el('b-total').textContent = rpF(tot);
  const utH = (D.utang||[]).filter(u=>u.jenis==='saya'&&!u.lunas).reduce((s,u)=>s+u.sisa,0);
  el('b-meta').textContent  = `${D.walletList.length} dompet aktif${utH>0?' · hutang '+rp(utH):''}`;
  el('b-month').textContent = `Statistik ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  el('b-masuk').textContent  = rp(mi);
  el('b-keluar').textContent = rp(ko);
  el('b-net').textContent    = rp(net);
  el('b-net').style.color    = net>=0 ? 'var(--gold)' : 'var(--rose)';

  // ── Spending percentage ──
  if (mi > 0) {
    const pct = Math.round(ko/mi*100);
    let pctColor = 'var(--mint)';
    if (pct > 90) pctColor = 'var(--rose)';
    else if (pct > 70) pctColor = '#f5a623';
    el('b-pct').innerHTML = `<span style="color:${pctColor};font-weight:700;">${pct}%</span> pengeluaran dari pemasukan`;
  } else if (ko > 0) {
    el('b-pct').innerHTML = `Pengeluaran <span style="color:var(--rose);">${rp(ko)}</span> tanpa pemasukan`;
  } else {
    el('b-pct').innerHTML = '';
  }

  // ── Wallets ──
  renderWalletCards();

  // ── Targets ──
  renderTargets();

  // ── Recent transactions ──
  renderRecent();
}

function renderWalletCards() {
  const d = el('b-wallets'); if (!d) return;
  d.innerHTML = D.walletList.map(w => {
    const bal = D.wallets[w.id] || 0;
    return `<div class="wcard" onclick="goToWallet('${w.id}')">
      <div class="wc-top">
        <div class="wc-ico" style="background:${w.color}22;">${w.icon}</div>
        <div class="wc-name">${esc(w.name)}</div>
      </div>
      <div class="wc-bal" style="color:${w.color};">${rpF(bal)}</div>
    </div>`;
  }).join('');
}

function goToWallet(id) {
  tWF = id;
  document.querySelectorAll(".ov").forEach(o=>o.classList.add("hidden"));
  showPage("pg-transaksi");
  _gotoTransaksi();
}

function renderTargets() {
  const d = el('b-targets'); if (!d) return;
  const targets = D.targets||[];
  if (!targets.length) { d.innerHTML='<div class="empty-note">Belum ada target tabungan. <span class="link" onclick="openTargetMgr()">Tambah target</span></div>'; return; }
  d.innerHTML = targets.map(g=>{
    const w    = D.wallets[g.wallet]||0;
    const pct  = Math.min(100, Math.round(w/g.target*100));
    const col  = g.color||W(g.wallet).color||'#4aded8';
    const done = pct>=100;
    return `<div class="target-card">
      <div class="tc-row">
        <div>
          <div class="tc-name">${done?'✅ ':''} ${esc(g.icon||'🎯')} ${esc(g.name)}</div>
          <div class="tc-wallet">${W(g.wallet).name}</div>
        </div>
        <div class="tc-vals">
          <div class="tc-cur" style="color:${col};">${rp(w)}</div>
          <div class="tc-max">/ ${rp(g.target)}</div>
        </div>
      </div>
      <div class="prog-bar"><div class="prog-fill" style="width:${pct}%;background:${col};"></div></div>
      <div class="tc-pct">${pct}% tercapai${done?' 🎉':''}</div>
    </div>`;
  }).join('');
}

function renderRecent() {
  const d = el('b-recent'); if (!d) return;
  const rec = D.transaksi.slice(0,5);
  if (!rec.length) { d.innerHTML='<div class="empty-note">Belum ada transaksi</div>'; return; }
  d.innerHTML = rec.map(t=>trxRowHTML(t)).join('');
}
