'use strict';
// ─── TRANSACTION STATE ───────────────────────────────────────
let tWF = 'all', tCF = 'all';
let tPeriodMode = 'month';
let tPY = null, tPM = null;
let tDateFrom = null, tDateTo = null;
let pendSplit = null, pickerType = 'keluar', pickerWid = null, tapWid = null;

// ─── PERIOD PRESETS ──────────────────────────────────────────
function setPeriodPreset(mode) {
  tPeriodMode = mode;
  // Update chip visuals
  document.querySelectorAll('.period-chip').forEach(c=>c.classList.remove('on'));
  const chip = el('tpc-'+mode); if (chip) chip.classList.add('on');
  // Show/hide month nav and custom date range
  el('t-month-nav')?.classList.toggle('hidden', mode!=='month');
  el('t-date-range')?.classList.toggle('hidden', mode!=='custom');
  // Reset month if entering month mode
  if (mode==='month') {
    const n=new Date(); tPY=n.getFullYear(); tPM=n.getMonth();
  }
  renderTrx();
}

function tPmove(dir) {
  tPeriodMode='month'; tPM+=dir;
  if(tPM>11){tPM=0;tPY++;} if(tPM<0){tPM=11;tPY--;}
  renderTrx();
}

// ─── TRANSACTION PAGE RENDER ─────────────────────────────────
function renderTrx() {
  if (!D) return;
  const now = new Date();
  if (tPY===null) { tPY=now.getFullYear(); tPM=now.getMonth(); }

  // Update month nav label
  if (tPeriodMode==='month') el('t-period').textContent = `${MONTHS[tPM]} ${tPY}`;

  // Build wallet chips
  const wchips = el('t-wchips');
  wchips.innerHTML = `<div class="chip ${tWF==='all'?'on':''}" onclick="setTWF('all')">Semua</div>`
    + D.walletList.map(w=>`<div class="chip ${tWF===w.id?'on':''}" onclick="setTWF('${w.id}')" style="${tWF===w.id?'background:'+w.color+';border-color:'+w.color+';color:#fff;':''}">${esc(w.icon)} ${esc(w.name)}</div>`).join('');

  // Build category chips
  const cchips = el('t-cchips');
  cchips.innerHTML = `<div class="chip ${tCF==='all'?'on':''}" onclick="setTCF('all')">Semua Kategori</div>`
    + Object.entries(CAT).map(([k,v])=>`<div class="chip ${tCF===k?'on':''}" onclick="setTCF('${k}')">${v.e} ${v.n}</div>`).join('');

  // Filter by wallet & category
  let filt = tWF==='all' ? [...D.transaksi] : D.transaksi.filter(t=>t.wallet===tWF);
  if (tCF !== 'all') filt = filt.filter(t=>t.cat===tCF);

  // Filter by period
  switch (tPeriodMode) {
    case 'today': {
      const td = todayStr();
      filt = filt.filter(t=>dateKey(t.ts)===td);
      break;
    }
    case 'week': {
      const ws = new Date(now); ws.setDate(now.getDate()-now.getDay()); ws.setHours(0,0,0,0);
      const we = new Date(ws); we.setDate(we.getDate()+6); we.setHours(23,59,59,999);
      filt = filt.filter(t=>t.ts>=ws.getTime()&&t.ts<=we.getTime());
      break;
    }
    case 'month':
      filt = filt.filter(t=>{const d=new Date(t.ts);return d.getFullYear()===tPY&&d.getMonth()===tPM;});
      break;
    case 'year':
      filt = filt.filter(t=>new Date(t.ts).getFullYear()===now.getFullYear());
      break;
    case 'custom': {
      const df = el('t-date-from')?.value, dt = el('t-date-to')?.value;
      if (df) filt = filt.filter(t=>dateKey(t.ts)>=df);
      if (dt) filt = filt.filter(t=>dateKey(t.ts)<=dt);
      break;
    }
    // 'all': no date filter
  }

  // Search filter (ket, wallet name, category name, note, nominal)
  const q = (el('t-q')?.value||'').trim().toLowerCase();
  if (q) {
    filt = filt.filter(t=>{
      const catN = t.cat ? (CAT[t.cat]?.n||'').toLowerCase() : '';
      const wN   = W(t.wallet).name.toLowerCase();
      const note = (t.note||'').toLowerCase();
      return t.ket.toLowerCase().includes(q) ||
             wN.includes(q) ||
             catN.includes(q) ||
             note.includes(q) ||
             String(t.nominal).includes(q);
    });
  }

  // Summary
  let mi=0, ko=0;
  filt.forEach(t=>{ if(t.tipe==='masuk')mi+=t.nominal; else if(t.tipe==='keluar')ko+=t.nominal; });
  const net = mi - ko;
  el('t-summary').innerHTML = `
    <div class="stat2-col"><div class="s2-lbl">Pemasukan</div><div class="s2-val" style="color:var(--mint);">${rp(mi)}</div></div>
    <div class="stat2-col"><div class="s2-lbl">Pengeluaran</div><div class="s2-val" style="color:var(--rose);">${rp(ko)}</div></div>
    <div class="stat2-col"><div class="s2-lbl">Saldo Bersih</div><div class="s2-val" style="color:${net>=0?'var(--gold)':'var(--rose)'};">${rp(net)}</div></div>`;

  // Group by date and render
  const groups = {};
  filt.forEach(t=>{ const dk=dateKey(t.ts); if(!groups[dk]) groups[dk]=[]; groups[dk].push(t); });
  const sortedDates = Object.keys(groups).sort((a,b)=>b.localeCompare(a));

  const list = el('t-list');
  if (!sortedDates.length) {
    const msg = q ? 'Tidak ada transaksi yang cocok' : 'Tidak ada transaksi di periode ini';
    list.innerHTML = `<div class="empty-note">${msg}</div>`;
    return;
  }

  list.innerHTML = sortedDates.map(dk=>{
    const rows = groups[dk];
    const d    = new Date(dk+'T00:00:00');
    const lbl  = dk===todayStr()?'Hari Ini':d.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'});
    let dMi=0,dKo=0;
    rows.forEach(t=>{ if(t.tipe==='masuk')dMi+=t.nominal; else if(t.tipe==='keluar')dKo+=t.nominal; });
    return `<div class="date-group">
      <div class="date-label">
        <span>${lbl}</span>
        <span class="date-bal">${dMi>0?'<span style="color:var(--mint)">+'+rp(dMi)+'</span>':''}${dKo>0?'<span style="color:var(--rose)"> −'+rp(dKo)+'</span>':''}</span>
      </div>
      ${rows.map(t=>trxRowHTML(t)).join('')}
    </div>`;
  }).join('');
}

function setTWF(v) { tWF=v; renderTrx(); }
function setTCF(v) { tCF=v; renderTrx(); }

// ─── QUICK TAP (SAVINGS) ─────────────────────────────────────
function openTap() {
  const saving = D.walletList.filter(w=>w.type==='saving');
  if(!saving.length){showToast('Belum ada dompet tabungan');return;}
  tapWid = saving[0].id;
  el('tap-nom').value = D.lastTapNom||10000;
  el('tap-wallets').innerHTML = saving.map(w=>`
    <div class="tw-item ${tapWid===w.id?'on':''}" onclick="setTapW('${w.id}')" style="${tapWid===w.id?'border-color:'+w.color+';background:'+w.color+'15;':''}">
      <span>${esc(w.icon)}</span><span>${esc(w.name)}</span>
    </div>`).join('');
  show('ov-tap');
}
function setTapW(id) {
  tapWid=id;
  el('tap-wallets').querySelectorAll('.tw-item').forEach(x=>x.classList.remove('on'));
  event.currentTarget.classList.add('on');
}
async function confirmTap() {
  const nom = parseAmount(el('tap-nom').value);
  if (nom === null) { showToast('Nominal tidak valid'); return; }
  const nd=JSON.parse(JSON.stringify(D));
  nd.wallets[tapWid]=(nd.wallets[tapWid]||0)+nom;
  const ts=Date.now();
  nd.transaksi.unshift({id:ts,ket:'Tabungan',nominal:nom,wallet:tapWid,tipe:'masuk',cat:'',note:'',ts});
  nd.transaksi=nd.transaksi.slice(0,600);
  nd.lastTapNom=nom;
  await save(nd); hide('ov-tap'); renderBeranda(); showToast('Tabungan +'+rp(nom)+' ✓');
}

// ─── ADD TRANSACTION PICKER ──────────────────────────────────
function openPicker() {
  pickerWid=D.walletList[0]?.id||'pribadi';
  pickerType='keluar';
  el('p-keluar').classList.add('on'); el('p-masuk').classList.remove('on'); el('p-transfer').classList.remove('on');
  el('trx-ket').value=''; el('trx-nom').value=''; el('trx-cat').value=''; el('trx-date').value=todayStr(); el('trx-note').value='';
  el('trx-to-row').classList.add('hidden');
  el('trx-split-hint')?.classList.add('hidden');
  el('trx-to').innerHTML = D.walletList.map(w=>`<option value="${w.id}">${esc(w.icon)} ${esc(w.name)}</option>`).join('');
  renderPickerWallets(); show('ov-picker');
}

function setPickerType(t) {
  pickerType=t;
  ['keluar','masuk','transfer'].forEach(x=>el('p-'+x)?.classList.toggle('on',x===t));
  const transferRow=el('trx-to-row');
  if (transferRow) transferRow.classList.toggle('hidden',t!=='transfer');
  renderPickerWallets();
}

function renderPickerWallets() {
  const d=el('p-wallets'); if(!d) return;
  d.innerHTML=D.walletList.map(w=>`
    <div class="pw-item ${pickerWid===w.id?'on':''}" onclick="pickerSelect('${w.id}')"
         style="${pickerWid===w.id?'border-color:'+w.color+';background:'+w.color+'15;':''}">
      ${esc(w.icon)} <span>${esc(w.name)}</span>
    </div>`).join('');
}

function pickerSelect(id) {
  pickerWid=id; renderPickerWallets();
  const isBiz=W(id).type==='biz';
  el('trx-split-hint')?.classList.toggle('hidden',!isBiz||pickerType!=='keluar');
}

async function confirmTrx() {
  const ket = sanitizeText(el('trx-ket').value, 100);
  const nom = parseAmount(el('trx-nom').value);
  const cat = el('trx-cat').value;
  const note = sanitizeText(el('trx-note').value, 200);
  const dateVal=el('trx-date').value;
  if (!ket) { showToast('Keterangan wajib diisi!'); return; }
  if (nom === null) { showToast('Jumlah harus angka positif yang valid!'); return; }
  const ts=dateVal ? new Date(dateVal+'T12:00:00').getTime() : Date.now();
  const nd=JSON.parse(JSON.stringify(D));

  if(pickerType==='transfer'){
    const toW=el('trx-to')?.value;
    if(!toW||toW===pickerWid){showToast('Pilih dompet tujuan yang berbeda');return;}
    nd.wallets[pickerWid]=(nd.wallets[pickerWid]||0)-nom;
    nd.wallets[toW]=(nd.wallets[toW]||0)+nom;
    nd.transaksi.unshift({id:ts,ket,nominal:nom,wallet:pickerWid,walletTo:toW,tipe:'transfer',cat,note,ts});
  } else {
    const isK=pickerType==='keluar';
    if(isK) nd.wallets[pickerWid]=(nd.wallets[pickerWid]||0)-nom;
    else     nd.wallets[pickerWid]=(nd.wallets[pickerWid]||0)+nom;
    nd.transaksi.unshift({id:ts,ket,nominal:nom,wallet:pickerWid,tipe:isK?'keluar':'masuk',cat,note,ts});
    // Biz split for business wallets
    if(isK && W(pickerWid).type==='biz' && el('trx-split')?.checked) {
      pendSplit={ket,nom,wallet:pickerWid,ts}; hide('ov-picker');
      el('sp-ket').textContent=ket; el('sp-nom').textContent=rpF(nom);
      const mp=D.profitSplit?.modal||50, pp=D.profitSplit?.priv||50;
      el('sp-m-nom').textContent=rpF(nom*mp/100); el('sp-p-nom').textContent=rpF(nom*pp/100);
      show('ov-split'); nd.transaksi=nd.transaksi.slice(0,600);
      await save(nd); renderBeranda(); return;
    }
  }
  nd.transaksi=nd.transaksi.slice(0,600);
  await save(nd); hide('ov-picker'); renderBeranda();
  showToast(pickerType==='masuk'?'Pemasukan dicatat ✓':pickerType==='keluar'?'Pengeluaran dicatat ✓':'Transfer dicatat ✓');
  if(el('pg-transaksi').classList.contains('active')) renderTrx();
}

async function doSplit() {
  if (!pendSplit) return;
  const nd=JSON.parse(JSON.stringify(D));
  const mp=D.profitSplit?.modal||50, pp=D.profitSplit?.priv||50;
  const mNom=Math.round(pendSplit.nom*mp/100), pNom=Math.round(pendSplit.nom*pp/100);
  const mW=D.walletList.find(w=>w.type==='biz'&&w.id!==pendSplit.wallet) || D.walletList.find(w=>w.type==='biz');
  const pW=D.walletList.find(w=>w.type==='regular');
  if(mW){ nd.wallets[mW.id]=(nd.wallets[mW.id]||0)+mNom; nd.transaksi.unshift({id:pendSplit.ts+1,ket:'Split: '+pendSplit.ket,nominal:mNom,wallet:mW.id,tipe:'masuk',cat:'modal',note:'Split otomatis',ts:pendSplit.ts+1}); }
  if(pW){ nd.wallets[pW.id]=(nd.wallets[pW.id]||0)+pNom; nd.transaksi.unshift({id:pendSplit.ts+2,ket:'Split: '+pendSplit.ket,nominal:pNom,wallet:pW.id,tipe:'masuk',cat:'lainnya',note:'Split otomatis',ts:pendSplit.ts+2}); }
  nd.transaksi=nd.transaksi.slice(0,600);
  pendSplit=null; await save(nd); hide('ov-split'); renderBeranda();
  showToast('Profit dibagi otomatis ✓');
}

// ─── EDIT TRANSACTION ────────────────────────────────────────
function openEditTrx(id) {
  const t=D.transaksi.find(x=>x.id===id); if(!t) return;
  el('e-id').value=id;
  el('e-ket').value=t.ket;
  el('e-nom').value=t.nominal;
  el('e-cat').value=t.cat||'';
  el('e-note').value=t.note||'';
  el('e-date-info').textContent=`${fDateFull(t.ts)} · ${fTime(t.ts)}`;
  el('e-recur-info').innerHTML=t.recurId?'<span class="recur-badge">🔄 Dibuat otomatis dari transaksi berulang</span>':'';
  show('ov-edit');
}

async function confirmEdit() {
  const id=+el('e-id').value;
  const ket = sanitizeText(el('e-ket').value, 100);
  const nom = parseAmount(el('e-nom').value);
  const cat = el('e-cat').value;
  const note = sanitizeText(el('e-note').value, 200);
  if (!ket) { showToast('Keterangan wajib diisi!'); return; }
  if (nom === null) { showToast('Jumlah harus angka positif yang valid!'); return; }
  const nd=JSON.parse(JSON.stringify(D));
  const t=nd.transaksi.find(x=>x.id===id); if(!t) return;
  const diff=nom-t.nominal;
  if(t.tipe==='masuk')  nd.wallets[t.wallet]=(nd.wallets[t.wallet]||0)+diff;
  if(t.tipe==='keluar') nd.wallets[t.wallet]=(nd.wallets[t.wallet]||0)-diff;
  t.ket=ket; t.nominal=nom; t.cat=cat; t.note=note;
  await save(nd); hide('ov-edit'); renderBeranda(); showToast('Transaksi diperbarui ✓');
  if(el('pg-transaksi')?.classList.contains('active')) renderTrx();
}

async function deleteEditTrx() {
  const id=+el('e-id').value;
  const t=D.transaksi.find(x=>x.id===id); if(!t) return;
  const snap=JSON.parse(JSON.stringify(D));
  const nd=JSON.parse(JSON.stringify(D));
  nd.transaksi=nd.transaksi.filter(x=>x.id!==id);
  if(t.tipe==='masuk')    nd.wallets[t.wallet]=(nd.wallets[t.wallet]||0)-t.nominal;
  else if(t.tipe==='keluar') nd.wallets[t.wallet]=(nd.wallets[t.wallet]||0)+t.nominal;
  await save(nd); hide('ov-edit'); renderBeranda(); showToast('Transaksi dihapus',async()=>{await save(snap);renderBeranda();});
  if(el('pg-transaksi')?.classList.contains('active')) renderTrx();
}
