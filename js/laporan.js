'use strict';
// ─── LAPORAN STATE ───────────────────────────────────────────
let rptY, rptM, rptRange = 3;

// ─── REPORT PAGE ─────────────────────────────────────────────
function rptMv(dir) { rptM+=dir; if(rptM>11){rptM=0;rptY++;} if(rptM<0){rptM=11;rptY--;} renderLaporan(); }

function setRR(r) {
  rptRange=r;
  document.querySelectorAll('.rr-chip').forEach(c=>c.classList.remove('on'));
  document.querySelector(`.rr-chip[onclick="setRR(${r})"]`)?.classList.add('on');
  renderBarChart();
}

function renderLaporan() {
  if (!D) return;
  const now=new Date();
  if(!rptY){rptY=now.getFullYear();rptM=now.getMonth();}
  el('rpt-period').textContent=`${MONTHS[rptM]} ${rptY}`;

  const mTrx=D.transaksi.filter(t=>{const d=new Date(t.ts);return d.getFullYear()===rptY&&d.getMonth()===rptM;});
  let mi=0,ko=0;
  mTrx.forEach(t=>{if(t.tipe==='masuk')mi+=t.nominal;else if(t.tipe==='keluar')ko+=t.nominal;});
  const net=mi-ko;
  const pct=mi>0?Math.round(ko/mi*100):0;

  el('rpt-masuk').textContent =rpF(mi);
  el('rpt-keluar').textContent=rpF(ko);
  el('rpt-net').textContent   =rpF(net);
  el('rpt-net').style.color   =net>=0?'var(--mint)':'var(--rose)';
  el('rpt-pct').innerHTML= mi>0
    ? `<span style="color:${pct>80?'var(--rose)':pct>50?'#f5a623':'var(--mint)'};">${pct}%</span> pengeluaran dari pemasukan`
    : ko>0 ? `Belum ada pemasukan bulan ini` : `Belum ada aktivitas`;

  renderDonut(mTrx);
  renderInsights(mTrx, mi, ko);
  renderBarChart();
}

function renderDonut(trx) {
  const cats={};
  trx.filter(t=>t.tipe==='keluar').forEach(t=>{ cats[t.cat||'lainnya']=(cats[t.cat||'lainnya']||0)+t.nominal; });
  const sorted=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const total=sorted.reduce((s,[,v])=>s+v,0);
  const d=el('rpt-donut'); if(!d) return;
  if(!sorted.length){d.innerHTML='<div class="empty-note" style="margin:20px auto;">Belum ada pengeluaran</div>';return;}
  const palC=['#8b7cf8','#f26b6b','#4aded8','#f5a623','#52c7f5','#f2c94c'];
  let offset=0, slices='', legend='';
  const r=15.9155, circ=2*Math.PI*r;
  sorted.forEach(([k,v],i)=>{
    const pct=v/total, sweep=pct*circ;
    slices+=`<circle r="${r}" cx="21" cy="21" fill="none" stroke="${palC[i]}" stroke-width="4"
      stroke-dasharray="${sweep.toFixed(2)} ${(circ-sweep).toFixed(2)}"
      stroke-dashoffset="${(circ/4-offset).toFixed(2)}" style="cursor:pointer;" onclick="showCatDetail('${k}',${rptY},${rptM})"></circle>`;
    offset+=sweep;
    legend+=`<div class="legend-row"><span class="legend-dot" style="background:${palC[i]};"></span>
      <span>${CAT[k]?.e||'📦'} ${CAT[k]?.n||'Lainnya'}</span>
      <span class="legend-pct">${Math.round(pct*100)}%</span>
      <span class="legend-val">${rp(v)}</span></div>`;
  });
  d.innerHTML=`<div class="donut-wrap">
    <div class="donut-svg-wrap">
      <svg viewBox="0 0 42 42" width="120" height="120"><circle r="${r}" cx="21" cy="21" fill="#1c1f2e" stroke="#252836" stroke-width="4"></circle>${slices}</svg>
      <div class="donut-center"><div class="dc-lbl">Total</div><div class="dc-val">${rp(total)}</div></div>
    </div>
    <div class="donut-legend">${legend}</div>
  </div>`;
}

function showCatDetail(cat, y, m) {
  const trx=D.transaksi.filter(t=>{const d=new Date(t.ts);return d.getFullYear()===y&&d.getMonth()===m&&t.cat===cat&&t.tipe==='keluar';});
  const total=trx.reduce((s,t)=>s+t.nominal,0);
  const ci=CAT[cat]||{e:'📦',n:'Lainnya'};
  el('cat-detail-title').textContent=`${ci.e} ${ci.n}`;
  el('cat-detail-total').textContent=rpF(total);
  el('cat-detail-list').innerHTML=trx.map(t=>`
    <div class="trx-row">
      <div class="trx-ico" style="background:${W(t.wallet).color}18;">${ci.e}</div>
      <div class="trx-mid">
        <div class="trx-name">${esc(t.ket)}</div>
        <div class="trx-sub">${esc(W(t.wallet).name)}${t.note?` · ${esc(t.note)}`:''}</div>
      </div>
      <div class="trx-right">
        <div class="trx-amt" style="color:var(--rose);">−${rp(t.nominal)}</div>
        <div class="trx-time">${fDate(t.ts)}</div>
      </div>
    </div>`).join('') || '<div class="empty-note">Tidak ada transaksi</div>';
  show('ov-cat-detail');
}

function renderInsights(trx, mi, ko) {
  const d=el('rpt-insights'); if(!d) return;
  const insights=[];
  if(mi>0&&ko>0) {
    const pct=Math.round(ko/mi*100);
    if(pct>90) insights.push({ico:'⚠️',msg:`Pengeluaran ${pct}% dari pemasukan — sangat tinggi`,col:'var(--rose)'});
    else if(pct>70) insights.push({ico:'📊',msg:`Pengeluaran ${pct}% dari pemasukan — perlu dikontrol`,col:'#f5a623'});
    else insights.push({ico:'✅',msg:`Pengeluaran ${pct}% dari pemasukan — terkendali`,col:'var(--mint)'});
  }
  const cats={};
  trx.filter(t=>t.tipe==='keluar').forEach(t=>{cats[t.cat||'lainnya']=(cats[t.cat||'lainnya']||0)+t.nominal;});
  const topCat=Object.entries(cats).sort((a,b)=>b[1]-a[1])[0];
  if(topCat) insights.push({ico:CAT[topCat[0]]?.e||'📦',msg:`Pengeluaran terbesar: ${CAT[topCat[0]]?.n||'Lainnya'} (${rp(topCat[1])})`,col:'var(--muted)'});
  if(!insights.length) insights.push({ico:'💡',msg:'Tambah transaksi untuk melihat insight',col:'var(--muted)'});
  d.innerHTML=insights.map(i=>`<div class="insight-row"><span>${i.ico}</span><span style="color:${i.col};">${i.msg}</span></div>`).join('');
}

function renderBarChart() {
  const d=el('rpt-bars'); if(!d||!D) return;
  const now=new Date(); const y=now.getFullYear(); const m=now.getMonth();
  const bars=[];
  for(let i=rptRange-1;i>=0;i--) {
    let mm=m-i, yy=y;
    if(mm<0){mm+=12;yy--;}
    const trx=D.transaksi.filter(t=>{const dd=new Date(t.ts);return dd.getFullYear()===yy&&dd.getMonth()===mm;});
    let mi2=0,ko2=0;
    trx.forEach(t=>{if(t.tipe==='masuk')mi2+=t.nominal;else if(t.tipe==='keluar')ko2+=t.nominal;});
    bars.push({label:MSHORT[mm],mi:mi2,ko:ko2,isCur:mm===m&&yy===y});
  }
  const maxVal=Math.max(...bars.map(b=>Math.max(b.mi,b.ko)),1);
  d.innerHTML=bars.map(b=>`
    <div class="bar-group" onclick="showBarDetail(${bars.indexOf(b)})">
      <div class="bar-pair">
        <div class="bar-seg" style="height:${Math.round(b.mi/maxVal*80)}px;background:var(--mint);" title="Masuk ${rp(b.mi)}"></div>
        <div class="bar-seg" style="height:${Math.round(b.ko/maxVal*80)}px;background:var(--rose);" title="Keluar ${rp(b.ko)}"></div>
      </div>
      <div class="bar-lbl ${b.isCur?'bar-lbl-cur':''}">${b.label}</div>
    </div>`).join('');
}

function showBarDetail(i) {
  const now=new Date(); const m=now.getMonth(), y=now.getFullYear();
  let mm=m-(rptRange-1)+i, yy=y;
  if(mm<0){mm+=12;yy--;} if(mm>11){mm-=12;yy++;}
  rptY=yy; rptM=mm; renderLaporan();
}
