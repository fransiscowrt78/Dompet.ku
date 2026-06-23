'use strict';
// ─── SETTINGS STATE ──────────────────────────────────────────
let editWid=null, editWico='💰', editWcol='#f2c94c';
let editTid=null;
let ssM=50, ssP=50;

// ─── WALLET MANAGEMENT ───────────────────────────────────────
function openWalletMgr() {
  const d=el('wl-list'); if(!d) return;
  d.innerHTML=D.walletList.map(w=>{
    const bal=D.wallets[w.id]||0;
    return `<div class="wl-row">
      <div class="wl-ico" style="background:${w.color}22;">${w.icon}</div>
      <div class="wl-info"><div class="wl-name">${esc(w.name)}</div><div class="wl-bal" style="color:${w.color};">${rpF(bal)}</div></div>
      <button class="icon-btn" onclick="openEditWallet('${w.id}')">✏️</button>
    </div>`;
  }).join('');
  show('ov-wallet-mgr');
}

function openAddWallet() {
  editWid=null; editWico='💸'; editWcol=COLORS[0];
  el('wl-form-title').textContent='Tambah Dompet';
  el('wf-name').value=''; el('wf-type').value='regular'; el('wf-saldo').value='0';
  renderWlIcons(); renderWlColors();
  hide('wf-del'); hide('ov-wallet-mgr'); show('ov-wallet-form');
}

function openEditWallet(id) {
  const w=D.walletList.find(x=>x.id===id); if(!w) return;
  editWid=id; editWico=w.icon; editWcol=w.color;
  el('wl-form-title').textContent='Edit Dompet';
  el('wf-name').value=w.name; el('wf-type').value=w.type||'regular';
  el('wf-saldo').value=D.wallets[id]||0;
  renderWlIcons(); renderWlColors();
  show('wf-del'); hide('ov-wallet-mgr'); show('ov-wallet-form');
}

function renderWlIcons() {
  el('wf-icons').innerHTML=ICONS.map(i=>`<div class="ico-opt ${editWico===i?'on':''}" onclick="selWlIco('${i}')">${i}</div>`).join('');
}
function selWlIco(i) { editWico=i; renderWlIcons(); }
function renderWlColors() {
  el('wf-colors').innerHTML=COLORS.map(c=>`<div class="col-opt ${editWcol===c?'on':''}" style="background:${c};" onclick="selWlCol('${c}')"></div>`).join('');
}
function selWlCol(c) { editWcol=c; renderWlColors(); }

async function confirmWallet() {
  const name = sanitizeText(el('wf-name').value, 40);
  const type = el('wf-type').value;
  const saldo = parseAmountAllowZero(el('wf-saldo').value);
  if (!name) { showToast('Nama dompet wajib!'); return; }
  if (saldo === null) { showToast('Saldo awal tidak valid!'); return; }
  const nd=JSON.parse(JSON.stringify(D));
  if (editWid) {
    const w=nd.walletList.find(x=>x.id===editWid); if(!w) return;
    const diff=saldo-(nd.wallets[editWid]||0);
    w.name=name; w.type=type; w.icon=editWico; w.color=editWcol;
    nd.wallets[editWid]=(nd.wallets[editWid]||0)+diff;
  } else {
    const id='w'+Date.now();
    nd.walletList.push({id,name,type,icon:editWico,color:editWcol});
    nd.wallets[id]=saldo;
  }
  await save(nd); hide('ov-wallet-form'); openWalletMgr();
  el('s-wallet-sub').textContent=`${nd.walletList.length} dompet`;
  showToast(editWid?'Dompet diperbarui ✓':'Dompet ditambahkan ✓');
  renderBeranda();
}

async function deleteWallet() {
  if (!editWid) return;
  if (!await customConfirm('Hapus dompet ini? Data transaksi tetap tersimpan.')) return;
  const nd=JSON.parse(JSON.stringify(D));
  nd.walletList=nd.walletList.filter(w=>w.id!==editWid);
  delete nd.wallets[editWid];
  await save(nd); hide('ov-wallet-form'); openWalletMgr();
  el('s-wallet-sub').textContent=`${nd.walletList.length} dompet`;
  showToast('Dompet dihapus'); renderBeranda();
}

// ─── TARGET MANAGEMENT ───────────────────────────────────────
function openTargetMgr() {
  const d=el('target-list'); if(!d) return;
  d.innerHTML=(!D.targets?.length)
    ? '<div class="empty-note">Belum ada target tabungan</div>'
    : D.targets.map(g=>{
        const cur=D.wallets[g.wallet]||0, pct=Math.min(100,Math.round(cur/g.target*100));
        return `<div class="tg-row">
          <div class="tg-ico">${g.icon||'🎯'}</div>
          <div class="tg-info">
            <div class="tg-name">${esc(g.name)}</div>
            <div class="tg-wallet">${W(g.wallet).name}</div>
            <div class="prog-bar" style="margin-top:4px;"><div class="prog-fill" style="width:${pct}%;background:${g.color||'#4aded8'};"></div></div>
          </div>
          <div class="tg-right">
            <div class="tg-pct">${pct}%</div>
            <button class="icon-btn" onclick="openEditTarget('${g.id}')">✏️</button>
          </div>
        </div>`;
      }).join('');
  show('ov-target-mgr');
}

function openAddTarget() {
  editTid=null;
  el('tg-form-title').textContent='Tambah Target';
  el('tg-name').value=''; el('tg-target').value=''; el('tg-icon').value='🎯'; el('tg-col').value='#4aded8';
  el('tg-wallet').innerHTML=D.walletList.map(w=>`<option value="${w.id}">${esc(w.icon)} ${esc(w.name)}</option>`).join('');
  el('tg-del').classList.add('hidden');
  hide('ov-target-mgr'); show('ov-target-form');
}

function openEditTarget(id) {
  const g=D.targets.find(x=>x.id===id); if(!g) return;
  editTid=id;
  el('tg-form-title').textContent='Edit Target';
  el('tg-name').value=g.name; el('tg-target').value=g.target;
  el('tg-icon').value=g.icon||'🎯'; el('tg-col').value=g.color||'#4aded8';
  el('tg-wallet').innerHTML=D.walletList.map(w=>`<option value="${w.id}" ${w.id===g.wallet?'selected':''}>${esc(w.icon)} ${esc(w.name)}</option>`).join('');
  el('tg-del').classList.remove('hidden');
  hide('ov-target-mgr'); show('ov-target-form');
}

async function confirmTarget() {
  const name = sanitizeText(el('tg-name').value, 40);
  const target = parseAmount(el('tg-target').value);
  const wallet = el('tg-wallet').value;
  const icon = sanitizeText(el('tg-icon').value, 4) || '🎯';
  const color = el('tg-col').value || '#4aded8';
  if (!name) { showToast('Nama target wajib!'); return; }
  if (target === null) { showToast('Nominal target tidak valid!'); return; }
  const nd=JSON.parse(JSON.stringify(D));
  if (!nd.targets) nd.targets=[];
  if (editTid) {
    const g=nd.targets.find(x=>x.id===editTid); if(!g) return;
    Object.assign(g,{name,target,wallet,icon,color});
  } else {
    nd.targets.push({id:'t'+Date.now(),name,target,wallet,icon,color,createdAt:Date.now()});
  }
  await save(nd); hide('ov-target-form'); openTargetMgr(); renderBeranda();
  showToast(editTid?'Target diperbarui ✓':'Target ditambahkan ✓');
}

async function deleteTarget() {
  if (!editTid) return;
  if (!await customConfirm('Hapus target ini?')) return;
  const nd=JSON.parse(JSON.stringify(D));
  nd.targets=nd.targets.filter(g=>g.id!==editTid);
  await save(nd); hide('ov-target-form'); openTargetMgr(); renderBeranda();
  showToast('Target dihapus');
}

// ─── SPLIT SETTINGS ──────────────────────────────────────────
function openSplitSet() {
  ssM=D.profitSplit?.modal||50; ssP=D.profitSplit?.priv||50;
  el('ss-modal').value=ssM; el('ss-priv').value=ssP;
  el('ss-preview').textContent=`Modal ${ssM}% / Pribadi ${ssP}%`;
  show('ov-split-set');
}

function onSS(which, val) {
  val=Math.max(0,Math.min(100,parseInt(val)||0));
  if(which==='m'){ssM=val;ssP=100-val;el('ss-priv').value=ssP;}
  else {ssP=val;ssM=100-val;el('ss-modal').value=ssM;}
  el('ss-preview').textContent=`Modal ${ssM}% / Pribadi ${ssP}%`;
}

async function saveSplit() {
  const nd=JSON.parse(JSON.stringify(D));
  nd.profitSplit={modal:ssM,priv:ssP};
  await save(nd); hide('ov-split-set');
  el('s-split-sub').textContent=`${ssM}% modal / ${ssP}% pribadi`;
  showToast('Pengaturan split disimpan ✓');
}

// ─── CHANGE PASSWORD ─────────────────────────────────────────
// doChangePw() now lives in auth.js — it uses Firebase's reauthenticateWithCredential
// + updatePassword(), which is required by Firebase's security model.

// ─── EXPORT / IMPORT ─────────────────────────────────────────
// Share-or-download helper: tries the native Web Share API first (works
// reliably inside Android WebView / Capacitor / PWA wrappers, where the
// classic <a download> click trick is frequently blocked or silently no-ops),
// then falls back to the normal blob-download approach for desktop browsers.
async function shareOrDownload(filename, content, mimeType) {
  try {
    const file = new File([content], filename, { type: mimeType });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return true;
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return false; // user cancelled share sheet
    // fall through to download fallback on any other share failure
  }
  try {
    const blob = new Blob([content], { type: mimeType });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    return true;
  } catch (err) {
    showToast('Gagal mengekspor file. Coba lagi.');
    return false;
  }
}

async function doExportJSON() {
  const ok = await shareOrDownload(
    `dompetku-${S.displayName||S.email.split('@')[0]}-${todayStr()}.json`,
    JSON.stringify(D, null, 2),
    'application/json'
  );
  if (ok) showToast('Data berhasil diekspor ✓');
}

async function doExportCSV() {
  const rows=[['Tanggal','Keterangan','Nominal','Tipe','Dompet','Kategori','Catatan']];
  D.transaksi.forEach(t=>{
    rows.push([
      new Date(t.ts).toLocaleDateString('id-ID'),
      t.ket, t.nominal, t.tipe,
      W(t.wallet).name, CAT[t.cat]?.n||'', t.note||''
    ]);
  });
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const ok = await shareOrDownload(
    `dompetku-${S.displayName||S.email.split('@')[0]}-${todayStr()}.csv`,
    '\ufeff'+csv,
    'text/csv;charset=utf-8;'
  );
  if (ok) showToast('CSV berhasil diekspor ✓');
}

// ─── VALIDATION: deep-check an imported JSON blob before accepting it ───────
function validateImportData(data) {
  if (!data || typeof data !== 'object') return { valid:false, reason:'File bukan format data yang valid.' };
  if (!data.wallets || typeof data.wallets !== 'object') return { valid:false, reason:'Data dompet tidak ditemukan / rusak.' };
  if (!Array.isArray(data.transaksi)) return { valid:false, reason:'Data transaksi tidak ditemukan / rusak.' };
  if (data.walletList && !Array.isArray(data.walletList)) return { valid:false, reason:'Struktur daftar dompet rusak.' };
  if (data.utang && !Array.isArray(data.utang)) return { valid:false, reason:'Struktur data utang rusak.' };
  if (data.targets && !Array.isArray(data.targets)) return { valid:false, reason:'Struktur data target rusak.' };
  if (data.recurring && !Array.isArray(data.recurring)) return { valid:false, reason:'Struktur transaksi berulang rusak.' };
  // Spot-check transaction shape (don't reject the whole file for one bad row — just count anomalies)
  const bad = data.transaksi.filter(t => !t || typeof t.nominal !== 'number' || !t.tipe).length;
  if (bad > 0 && bad === data.transaksi.length && data.transaksi.length > 0) {
    return { valid:false, reason:'Seluruh data transaksi tidak terbaca dengan benar.' };
  }
  return { valid:true };
}

function doImport() {
  const f=el('import-file').files[0]; if(!f){showToast('Pilih file terlebih dahulu');return;}
  if (f.size > 10 * 1024 * 1024) { showToast('File terlalu besar (maks 10MB)'); return; }
  const r=new FileReader();
  r.onload=async e=>{
    let data;
    try {
      data = JSON.parse(e.target.result);
    } catch {
      showToast('File rusak — bukan JSON yang valid'); return;
    }
    const check = validateImportData(data);
    if (!check.valid) { showToast(check.reason); return; }
    if (!await customConfirm('Import akan mengganti seluruh data saat ini. Lanjutkan?', 'Konfirmasi Import')) return;
    try {
      await save(data); hide('ov-settings'); await initApp();
      showToast('Data berhasil diimpor ✓');
    } catch {
      showToast('Gagal menyimpan data hasil import. Coba lagi.');
    }
  };
  r.onerror = () => showToast('Gagal membaca file');
  r.readAsText(f);
}
