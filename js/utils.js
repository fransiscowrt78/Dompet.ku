'use strict';
// ─── GLOBAL STATE ───────────────────────────────────────────
// S = { uid, email, displayName } — the signed-in Firebase user's session info.
// D = the full app data blob for that account (wallets, transaksi, utang, ...),
//     mirrored to/from Firestore document users/{uid}.
let S = null, D = null;
let _unsubscribeUserData = null; // Firestore real-time listener handle

// ─── CONSTANTS ──────────────────────────────────────────────
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const MSHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const CAT = {
  makanan:    {e:'🍜', n:'Makanan'},
  transport:  {e:'🚗', n:'Transport'},
  belanja:    {e:'🛍️', n:'Belanja'},
  hiburan:    {e:'🎮', n:'Hiburan'},
  kesehatan:  {e:'💊', n:'Kesehatan'},
  pendidikan: {e:'📚', n:'Pendidikan'},
  tagihan:    {e:'💡', n:'Tagihan'},
  modal:      {e:'💼', n:'Modal'},
  gaji:       {e:'💰', n:'Gaji'},
  lainnya:    {e:'📦', n:'Lainnya'},
};
const CAT_OPTS = `<option value="">— Semua Kategori —</option>
  <option value="makanan">🍜 Makanan</option>
  <option value="transport">🚗 Transport</option>
  <option value="belanja">🛍️ Belanja</option>
  <option value="hiburan">🎮 Hiburan</option>
  <option value="kesehatan">💊 Kesehatan</option>
  <option value="pendidikan">📚 Pendidikan</option>
  <option value="tagihan">💡 Tagihan</option>
  <option value="modal">💼 Modal</option>
  <option value="gaji">💰 Gaji</option>
  <option value="lainnya">📦 Lainnya</option>`;
const ICONS  = ['💰','🏦','🎮','🧸','📚','🍜','🛍️','💼','🚗','✈️','🏠','💊','🎵','⚽','🐱','🌟','💎','🔒','🎁','📱'];
const COLORS = ['#f2c94c','#4aded8','#8b7cf8','#52c7f5','#f5a623','#f26b6b','#e91e8c','#00bcd4','#8bc34a','#ff5722'];
const DEF_WL = [
  {id:'online',   name:'Usaha Online',  icon:'🎮', color:'#8b7cf8', type:'biz'},
  {id:'offline',  name:'Usaha Offline', icon:'🧸', color:'#f5a623', type:'biz'},
  {id:'tabungan', name:'Tabungan',      icon:'🏦', color:'#52c7f5', type:'saving'},
  {id:'jajan',    name:'Uang Jajan',    icon:'🍜', color:'#f2c94c', type:'regular'},
  {id:'pribadi',  name:'Pribadi',       icon:'🔒', color:'#f26b6b', type:'regular'},
];

// ─── DOM HELPERS ─────────────────────────────────────────────
const el   = id => document.getElementById(id);
const show = id => { const e = el(id); if (e) e.classList.remove('hidden'); };
const hide = id => { const e = el(id); if (e) e.classList.add('hidden'); };

// ─── DATA HELPERS ────────────────────────────────────────────
// Note: the old local DJB2-hash password function (hashPw) has been removed.
// Password security is now handled entirely by Firebase Authentication.

function rp(n) {
  const a = Math.abs(n), sg = n < 0 ? '-' : '';
  if (a >= 1e9) return sg+'Rp '+(a/1e9).toFixed(1)+'M';
  if (a >= 1e6) return sg+'Rp '+(a/1e6).toFixed(1)+'jt';
  if (a >= 1e3) return sg+'Rp '+Math.round(a/1e3)+'rb';
  return sg+'Rp '+a;
}
const rpF = n => (n < 0 ? '-' : '')+'Rp '+Math.abs(Math.round(n)).toLocaleString('id-ID');

function p2(n)      { return ('0'+n).slice(-2); }
function todayStr() { const d=new Date(); return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`; }
function dateKey(ts){ const d=new Date(ts); return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`; }
function fDate(ts)  { return new Date(ts).toLocaleDateString('id-ID',{day:'numeric',month:'short'}); }
function fDateFull(ts) { return new Date(ts).toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'long',year:'numeric'}); }
function fTime(ts)  { return new Date(ts).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}); }
function W(id)      { return (D?.walletList||DEF_WL).find(w=>w.id===id)||{name:id,icon:'💸',color:'#6b7591',type:'regular'}; }
function greet()    { const h=new Date().getHours(); return h<11?'Selamat Pagi':h<15?'Selamat Siang':h<18?'Selamat Sore':'Selamat Malam'; }

async function save(nd) {
  D = nd;
  const tier = await saveUserData(S.uid, nd);
  if (tier === 'local-fallback') {
    showToast('⚠️ Gagal sync ke cloud — tersimpan di HP ini saja sementara.');
  } else if (tier === 'failed') {
    showToast('⚠️ Gagal menyimpan perubahan. Periksa koneksi internet.');
  }
  return tier;
}

// ─── SECURITY: HTML-escape user input before inserting into innerHTML ───────
// Prevents stored-XSS from transaction names, notes, wallet/target names, etc.
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Escapes text for safe use inside  onclick="fn('...')"  (single-quoted JS string
// nested in a double-quoted HTML attribute). Needed wherever raw user text — not a
// system-generated id — is passed as an inline-handler argument (e.g. debt person names).
function escAttr(str) {
  if (str == null) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;');
}

// ─── SECURITY: sanitize free-text input (trim + cap length) ─────────────────
function sanitizeText(str, maxLen = 100) {
  if (str == null) return '';
  return String(str).trim().slice(0, maxLen);
}

// ─── VALIDATION: parse a money amount, reject NaN/negative/absurd values ────
function parseAmount(str) {
  const n = parseInt(String(str).replace(/[^0-9-]/g, ''), 10);
  if (!Number.isFinite(n) || n <= 0 || n > 999999999999) return null;
  return n;
}

// Same as parseAmount but allows 0 (e.g. a brand-new wallet's starting balance).
function parseAmountAllowZero(str) {
  const n = parseInt(String(str).replace(/[^0-9-]/g, ''), 10);
  if (!Number.isFinite(n) || n < 0 || n > 999999999999) return null;
  return n;
}
