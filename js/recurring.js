'use strict';
// ─── RECURRING STATE ─────────────────────────────────────────
let recurEditType = 'masuk';
let recurEditFreq = 'monthly';
let recurEditId   = null;

// ─── ADVANCE DATE ────────────────────────────────────────────
function advanceDate(dateStr, frequency) {
  const d = new Date(dateStr+'T12:00:00');
  switch (frequency) {
    case 'daily':   d.setDate(d.getDate()+1);     break;
    case 'weekly':  d.setDate(d.getDate()+7);     break;
    case 'monthly': d.setMonth(d.getMonth()+1);   break;
    case 'yearly':  d.setFullYear(d.getFullYear()+1); break;
  }
  return d.toISOString().slice(0,10);
}

// ─── CHECK & AUTO-CREATE ─────────────────────────────────────
async function checkRecurring() {
  if (!D.recurring?.length) return;
  const today = todayStr();
  let changed  = false;
  const nd     = JSON.parse(JSON.stringify(D));
  let idx      = 0;

  nd.recurring.forEach(r => {
    if (!r.active || !r.nextDate) return;
    while (r.nextDate <= today) {
      const ts = new Date(r.nextDate+'T12:00:00').getTime() + idx++;
      nd.transaksi.unshift({
        id:ts, ket:r.ket, nominal:r.nominal, wallet:r.wallet,
        tipe:r.tipe, cat:r.cat||'', note:r.note||'', ts, recurId:r.id
      });
      if (r.tipe==='masuk')  nd.wallets[r.wallet]=(nd.wallets[r.wallet]||0)+r.nominal;
      if (r.tipe==='keluar') nd.wallets[r.wallet]=(nd.wallets[r.wallet]||0)-r.nominal;
      r.nextDate = advanceDate(r.nextDate, r.frequency);
      changed = true;
    }
  });

  if (changed) {
    nd.transaksi = nd.transaksi.slice(0,600);
    await save(nd);
    showToast('Transaksi berulang dibuat otomatis 🔄');
  }
}

// ─── RECURRING MANAGER ───────────────────────────────────────
function openRecurMgr() {
  renderRecurList();
  show('ov-recur-mgr');
  hide('ov-settings');
}

function renderRecurList() {
  const d   = el('recur-list'); if (!d) return;
  const recs = D.recurring||[];
  if (!recs.length) { d.innerHTML='<div class="empty-note">Belum ada transaksi berulang.<br>Tambah untuk mencatat gaji, tagihan, dll. secara otomatis.</div>'; return; }
  const freqLabel = {daily:'Harian',weekly:'Mingguan',monthly:'Bulanan',yearly:'Tahunan'};
  d.innerHTML = recs.map(r=>{
    const w   = W(r.wallet);
    const col = r.tipe==='masuk'?'var(--mint)':'var(--rose)';
    const sgn = r.tipe==='masuk'?'+':'−';
    return `<div class="recur-card ${r.active?'':'recur-inactive'}">
      <div class="recur-left">
        <div class="recur-ico" style="background:${w.color}22;">${CAT[r.cat]?.e||w.icon}</div>
        <div>
          <div class="recur-name">${esc(r.ket)}</div>
          <div class="recur-meta">${w.name} · ${freqLabel[r.frequency]||r.frequency}</div>
          <div class="recur-next">Berikutnya: ${r.nextDate}</div>
        </div>
      </div>
      <div class="recur-right">
        <div class="recur-amt" style="color:${col};">${sgn}${rp(r.nominal)}</div>
        <div class="recur-acts">
          <button class="icon-btn" onclick="openEditRecur('${r.id}')">✏️</button>
          <button class="icon-btn" onclick="toggleRecurActive('${r.id}')">${r.active?'⏸️':'▶️'}</button>
          <button class="icon-btn" onclick="deleteRecur('${r.id}')">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ─── ADD / EDIT RECURRING ────────────────────────────────────
function openAddRecur() {
  recurEditId   = null;
  recurEditType = 'masuk';
  recurEditFreq = 'monthly';
  el('recur-title').textContent = 'Tambah Transaksi Berulang';
  el('r-ket').value=''; el('r-nom').value=''; el('r-cat').value=''; el('r-note').value='';
  el('r-start').value = todayStr();
  el('r-del').classList.add('hidden');
  // Fill wallet select
  el('r-wallet').innerHTML = D.walletList.map(w=>`<option value="${w.id}">${w.icon} ${w.name}</option>`).join('');
  // Reset type chips
  el('r-masuk').classList.add('on'); el('r-keluar').classList.remove('on');
  // Reset freq chips
  document.querySelectorAll('[id^="rf-"]').forEach(c=>c.classList.remove('on'));
  el('rf-monthly').classList.add('on');
  hide('ov-recur-mgr');
  show('ov-recur');
}

function openEditRecur(id) {
  const r = (D.recurring||[]).find(x=>x.id===id); if(!r) return;
  recurEditId   = id;
  recurEditType = r.tipe;
  recurEditFreq = r.frequency;
  el('recur-title').textContent = 'Edit Transaksi Berulang';
  el('r-ket').value   = r.ket;
  el('r-nom').value   = r.nominal;
  el('r-cat').value   = r.cat||'';
  el('r-note').value  = r.note||'';
  el('r-start').value = r.nextDate;
  el('r-wallet').innerHTML = D.walletList.map(w=>`<option value="${w.id}" ${w.id===r.wallet?'selected':''}>${w.icon} ${w.name}</option>`).join('');
  // Type chips
  el('r-masuk').classList.toggle('on', r.tipe==='masuk');
  el('r-keluar').classList.toggle('on', r.tipe==='keluar');
  // Freq chips
  document.querySelectorAll('[id^="rf-"]').forEach(c=>c.classList.remove('on'));
  el('rf-'+r.frequency)?.classList.add('on');
  el('r-del').classList.remove('hidden');
  hide('ov-recur-mgr');
  show('ov-recur');
}

function setRecurType(t) {
  recurEditType = t;
  el('r-masuk').classList.toggle('on', t==='masuk');
  el('r-keluar').classList.toggle('on', t==='keluar');
}

function setRecurFreq(f) {
  recurEditFreq = f;
  document.querySelectorAll('[id^="rf-"]').forEach(c=>c.classList.remove('on'));
  el('rf-'+f)?.classList.add('on');
}

async function confirmRecur() {
  const ket   = sanitizeText(el('r-ket').value, 100);
  const nom   = parseAmount(el('r-nom').value);
  const wallet= el('r-wallet').value;
  const cat   = el('r-cat').value;
  const note  = sanitizeText(el('r-note').value, 200);
  const start = el('r-start').value;
  if (!ket || nom === null || !wallet || !start) { showToast('Lengkapi semua field dengan benar!'); return; }

  const nd = JSON.parse(JSON.stringify(D));
  if (!nd.recurring) nd.recurring=[];

  if (recurEditId) {
    const r=nd.recurring.find(x=>x.id===recurEditId); if(!r) return;
    r.ket=ket; r.nominal=nom; r.wallet=wallet; r.tipe=recurEditType;
    r.cat=cat; r.note=note; r.frequency=recurEditFreq; r.nextDate=start;
  } else {
    nd.recurring.push({
      id:'r'+Date.now(), ket, nominal:nom, wallet, tipe:recurEditType,
      cat, note, frequency:recurEditFreq, nextDate:start, active:true, createdAt:Date.now()
    });
  }
  await save(nd);
  hide('ov-recur');
  renderRecurList();
  show('ov-recur-mgr');
  updateRecurSub();
  showToast(recurEditId?'Transaksi berulang diperbarui ✓':'Transaksi berulang ditambahkan ✓');
}

async function deleteRecur(id) {
  if (!await customConfirm('Hapus transaksi berulang ini?')) return;
  const nd = JSON.parse(JSON.stringify(D));
  nd.recurring = (nd.recurring||[]).filter(r=>r.id!==id);
  await save(nd); renderRecurList(); updateRecurSub(); showToast('Dihapus');
}

async function deleteRecurFromEdit() {
  if (!recurEditId) return;
  await deleteRecur(recurEditId);
  hide('ov-recur');
  show('ov-recur-mgr');
}

async function toggleRecurActive(id) {
  const nd = JSON.parse(JSON.stringify(D));
  const r  = (nd.recurring||[]).find(x=>x.id===id); if(!r) return;
  r.active = !r.active;
  await save(nd); renderRecurList(); updateRecurSub();
  showToast(r.active?'Transaksi berulang diaktifkan':'Transaksi berulang dijeda');
}

function updateRecurSub() {
  const active=(D.recurring||[]).filter(r=>r.active).length;
  const sub=el('s-recur-sub'); if(sub) sub.textContent=`${active} transaksi aktif`;
}
