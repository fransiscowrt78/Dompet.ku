'use strict';
// ─── UTANG STATE ─────────────────────────────────────────────
let utFiltState='all', bayarId=null, utMode='saya';
let expandedUtang={};

// ─── RENDER UTANG ────────────────────────────────────────────
function setUtF(s) {
  utFiltState=s;
  document.querySelectorAll("#pg-utang .chips .chip").forEach(c=>c.classList.remove("on"));
  event.currentTarget.classList.add("on");
  renderUtang();
}

function renderUtang() {
  if (!D) return;
  const utang=D.utang||[];
  // group by person
  const byPerson={};
  utang.filter(u=>{
    if(utMode==='saya'&&u.jenis!=='saya') return false;
    if(utMode==='piutang'&&u.jenis!=='piutang') return false;
    if(utFiltState==='lunas'&&!u.lunas) return false;
    if(utFiltState==='aktif'&&u.lunas) return false;
    return true;
  }).forEach(u=>{
    if(!byPerson[u.person]) byPerson[u.person]=[];
    byPerson[u.person].push(u);
  });

  const totalAktif=utang.filter(u=>u.jenis==='saya'&&!u.lunas).reduce((s,u)=>s+u.sisa,0);
  const totalPiutang=utang.filter(u=>u.jenis==='piutang'&&!u.lunas).reduce((s,u)=>s+u.sisa,0);
  el('ut-total-hutang').textContent=rpF(totalAktif);
  el('ut-total-piutang').textContent=rpF(totalPiutang);

  el('ut-mode-saya').classList.toggle('on',utMode==='saya');
  el('ut-mode-piutang').classList.toggle('on',utMode==='piutang');

  const d=el('ut-list');
  if(!Object.keys(byPerson).length){d.innerHTML='<div class="empty-note">Tidak ada '+(utMode==='saya'?'hutang':'piutang')+' di kategori ini</div>';return;}
  d.innerHTML=Object.entries(byPerson).map(([person,items])=>{
    const total=items.filter(u=>!u.lunas).reduce((s,u)=>s+u.sisa,0);
    const isExp=expandedUtang[person];
    return `<div class="person-card ${isExp?'expanded':''}">
      <div class="person-head" onclick="toggleUtang('${escAttr(person)}')">
        <div class="person-av">${esc(person[0].toUpperCase())}</div>
        <div class="person-info">
          <div class="person-name">${esc(person)}</div>
          <div class="person-sub">${items.length} transaksi${total>0?' · '+rp(total)+' aktif':' · Lunas'}</div>
        </div>
        <div class="person-arr">${isExp?'▲':'▼'}</div>
      </div>
      ${isExp?`<div class="person-detail">
        ${items.map(u=>`
          <div class="ut-item ${u.lunas?'ut-lunas':''}">
            <div class="ut-item-head">
              <div>
                <div class="ut-ket">${esc(u.ket)}</div>
                <div class="ut-date">${fDate(u.ts)} · ${u.lunas?'Lunas':'Sisa '+rp(u.sisa)}</div>
              </div>
              <div>
                <div class="ut-nom" style="color:${u.jenis==='saya'?'var(--rose)':'var(--mint)'};">${rp(u.pokok)}</div>
                ${!u.lunas?`<button class="pay-btn" onclick="openBayar(${u.id})">Bayar</button>`:''}
              </div>
            </div>
            ${u.catatan?`<div class="ut-note">📝 ${esc(u.catatan)}</div>`:''}
          </div>`).join('')}
        <button class="btn btn-ghost" style="margin-top:8px;" onclick="openAddUtang('${escAttr(person)}')">+ Tambah ke ${esc(person)}</button>
      </div>`:''}
    </div>`;
  }).join('');
}

function toggleUtang(p) { expandedUtang[p]=!expandedUtang[p]; renderUtang(); }

function openAddUtang(person='') {
  el('ut-person').value=person;
  el('ut-ket').value=''; el('ut-nom').value=''; el('ut-note').value=''; el('ut-date').value=todayStr();
  el('ut-jenis-saya').classList.add('on'); el('ut-jenis-piutang').classList.remove('on');
  show('ov-add-utang');
}

async function confirmUtang() {
  const person = sanitizeText(el('ut-person').value, 50);
  const ket = sanitizeText(el('ut-ket').value, 100);
  const nom = parseAmount(el('ut-nom').value);
  const note = sanitizeText(el('ut-note')?.value, 200);
  const jenis=el('ut-jenis-saya').classList.contains('on')?'saya':'piutang';
  const dateVal=el('ut-date').value;
  if (!person || !ket) { showToast('Nama & keterangan wajib diisi!'); return; }
  if (nom === null) { showToast('Nominal tidak valid!'); return; }
  const nd=JSON.parse(JSON.stringify(D));
  const ts=dateVal?new Date(dateVal+'T12:00:00').getTime():Date.now();
  nd.utang.push({id:ts,person,ket,pokok:nom,sisa:nom,jenis,lunas:false,ts,catatan:note,riwayat:[]});
  await save(nd); hide('ov-add-utang'); renderUtang(); showToast('Hutang/piutang dicatat ✓');
}

function openBayar(id) {
  bayarId=id;
  const u=D.utang.find(x=>x.id===id); if(!u) return;
  el('bayar-ket').textContent=u.ket;
  el('bayar-sisa').textContent=rpF(u.sisa);
  el('bayar-nom').value=u.sisa;
  show('ov-bayar');
}

async function confirmBayar() {
  const nom = parseAmount(el('bayar-nom').value);
  if (nom === null) { showToast('Nominal tidak valid'); return; }
  const nd=JSON.parse(JSON.stringify(D));
  const u=nd.utang.find(x=>x.id===bayarId); if(!u) return;
  u.sisa=Math.max(0,u.sisa-nom);
  u.lunas=u.sisa<=0;
  u.riwayat=u.riwayat||[];
  u.riwayat.push({ts:Date.now(),nom});
  await save(nd); hide('ov-bayar'); renderUtang();
  showToast(u.lunas?'Lunas! 🎉':'Pembayaran dicatat ✓');
}

async function deletePersonUtang(person) {
  if(!await customConfirm(`Hapus semua data hutang/piutang untuk ${person}?`, 'Hapus Data')) return;
  const nd = JSON.parse(JSON.stringify(D));
  nd.utang = (nd.utang||[]).filter(u=>u.person!==person);
  await save(nd);
  renderUtang();
  showToast('Data dihapus');
}
