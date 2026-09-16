/* ============================================
   JADWAL KELUARGA — script.js (FIXED)
   Bug fixes:
   1. PIN system unified — removed duplicate inline PIN, uses class-based unlock
   2. showDay() scoped to suami column only (tidak tabrakan dengan day-panel lain)
   3. pinBackspace alias added for backward compat with any remaining pinDel() calls
   ============================================ */

/* PIN logic dipindah ke inline <script> di index.html */


/* ============================================
   FIREBASE CONFIG
   ============================================ */
const DATABASE_URL = 'https://jadwal-keluarga-17b86-default-rtdb.asia-southeast1.firebasedatabase.app/';

let db      = null;
let todosRef = null;
let isFirebaseReady = false;

function initFirebase() {
  if (DATABASE_URL.startsWith('GANTI')) {
    setSyncStatus('error', 'Belum dikonfigurasi — pakai data lokal');
    loadFromLocal();
    return;
  }
  try {
    const app = firebase.initializeApp({ databaseURL: DATABASE_URL });
    db        = firebase.database(app);
    todosRef  = db.ref('todos');

    db.ref('.info/connected').on('value', snap => {
      setSyncStatus(snap.val() ? 'connected' : 'offline', snap.val() ? 'Tersync ✓' : 'Offline — data lokal');
    });

    todosRef.on('value', snap => {
      const raw = snap.val();
      todos = raw ? Object.entries(raw).map(([fbKey, v]) => ({ ...v, fbKey })) : [];
      renderTodos();
    }, err => {
      setSyncStatus('error', 'Gagal: ' + err.code);
      loadFromLocal();
    });

    isFirebaseReady = true;
    setTimeout(initMenuFirebase, 0);
  } catch(e) {
    setSyncStatus('error', 'Error Firebase');
    console.error(e);
    loadFromLocal();
  }
}

function setSyncStatus(state, msg) {
  const dot  = document.getElementById('sync-dot');
  const text = document.getElementById('sync-text');
  if (!dot || !text) return;
  dot.className  = 'sync-dot ' + state;
  text.textContent = msg;
}

const LOCAL_KEY = 'todos_keluarga';

function loadFromLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    todos = raw ? JSON.parse(raw) : [];
  } catch { todos = []; }
  renderTodos();
}

function saveToLocal() {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(todos)); } catch {}
}

/* ========================
   TO-DO — State
   ======================== */
let todos        = [];
let activeWho    = 'suami';
let activeFilter = 'semua';

window.addTodo = function() {
  const input   = document.getElementById('todo-input');
  const dlInput = document.getElementById('todo-deadline');
  const text    = input.value.trim();
  if (!text) { input.focus(); return; }

  const item = {
    id:        Date.now(),
    text,
    who:       activeWho,
    done:      false,
    deadline:  dlInput?.value || null,
    createdAt: Date.now(),
    doneAt:    null
  };

  if (isFirebaseReady && todosRef) {
    todosRef.push(item);
  } else {
    todos.push(item);
    saveToLocal();
    renderTodos();
  }

  input.value = '';
  if (dlInput) dlInput.value = '';
  input.focus();
};

window.toggleTodo = function(id) {
  const item = todos.find(t => t.id === id);
  if (!item) return;
  const nowDone = !item.done;
  const patch   = { done: nowDone, doneAt: nowDone ? Date.now() : null };

  if (isFirebaseReady && item.fbKey) {
    todosRef.child(item.fbKey).update(patch);
  } else {
    todos = todos.map(t => t.id === id ? { ...t, ...patch } : t);
    saveToLocal();
    renderTodos();
  }
};

window.deleteTodo = function(id) {
  const item = todos.find(t => t.id === id);
  if (!item) return;

  if (isFirebaseReady && item.fbKey) {
    todosRef.child(item.fbKey).remove();
  } else {
    todos = todos.filter(t => t.id !== id);
    saveToLocal();
    renderTodos();
  }
};

window.clearDone = function() {
  const doneItems = todos.filter(t => t.done);
  if (!doneItems.length) return;
  if (!confirm(`Hapus ${doneItems.length} tugas yang sudah selesai?`)) return;

  if (isFirebaseReady) {
    const updates = {};
    doneItems.forEach(t => { if (t.fbKey) updates[t.fbKey] = null; });
    todosRef.update(updates);
  } else {
    todos = todos.filter(t => !t.done);
    saveToLocal();
    renderTodos();
  }
};

window.setWho = function(who, btn) {
  activeWho = who;
  document.querySelectorAll('.who-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
};

window.setFilter = function(filter, btn) {
  activeFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTodos();
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function deadlineStatus(dl) {
  if (!dl) return null;
  const today = todayStr();
  if (dl < today) return 'lewat';
  if (dl === today) return 'hari-ini';
  const tom = new Date(); tom.setDate(tom.getDate()+1);
  const ts  = `${tom.getFullYear()}-${String(tom.getMonth()+1).padStart(2,'0')}-${String(tom.getDate()).padStart(2,'0')}`;
  return dl === ts ? 'besok' : 'mendatang';
}

function fmtDeadline(str) {
  if (!str) return '';
  const [y,m,d] = str.split('-').map(Number);
  const dt   = new Date(y, m-1, d);
  const hari = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'][dt.getDay()];
  const bln  = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'][m-1];
  const today = todayStr();
  if (str === today) return 'Hari ini';
  const tom = new Date(); tom.setDate(tom.getDate()+1);
  const ts  = `${tom.getFullYear()}-${String(tom.getMonth()+1).padStart(2,'0')}-${String(tom.getDate()).padStart(2,'0')}`;
  if (str === ts) return 'Besok';
  return `${hari}, ${d} ${bln}`;
}

function fmtTime(ts) {
  const d   = new Date(ts);
  const now = new Date();
  const hh  = String(d.getHours()).padStart(2,'0');
  const mm  = String(d.getMinutes()).padStart(2,'0');
  const sameDay = d.getDate()===now.getDate() && d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
  if (sameDay) return `${hh}:${mm}`;
  const hari = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'][d.getDay()];
  return `${hari} ${d.getDate()}/${d.getMonth()+1} ${hh}:${mm}`;
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderTodos() {
  const list  = document.getElementById('todo-list');
  const empty = document.getElementById('todo-empty');
  if (!list) return;

  list.querySelectorAll('.todo-item').forEach(el => el.remove());

  const today = todayStr();
  let filtered = [...todos];

  switch (activeFilter) {
    case 'selesai':   filtered = filtered.filter(t => t.done); break;
    case 'hari-ini':  filtered = filtered.filter(t => !t.done && t.deadline === today); break;
    case 'terlambat': filtered = filtered.filter(t => !t.done && t.deadline && t.deadline < today); break;
    case 'suami': case 'istri': case 'bersama':
      filtered = filtered.filter(t => t.who === activeFilter && !t.done); break;
  }

  const rank = t => {
    if (t.done) return 99;
    const s = deadlineStatus(t.deadline);
    return s==='lewat'?0:s==='hari-ini'?1:s==='besok'?2:s==='mendatang'?3:4;
  };

  filtered.sort((a,b) => {
    const ra=rank(a),rb=rank(b);
    if (ra!==rb) return ra-rb;
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    return b.createdAt - a.createdAt;
  });

  if (filtered.length===0) { if (empty) empty.style.display='flex'; return; }
  if (empty) empty.style.display='none';
  filtered.forEach(item => list.appendChild(buildTodoEl(item)));
}

function buildTodoEl(item) {
  const div = document.createElement('div');
  const ds  = deadlineStatus(item.deadline);
  div.className = 'todo-item'
    + (item.done ? ' done' : '')
    + (!item.done && ds==='lewat' ? ' overdue' : '')
    + (!item.done && ds==='hari-ini' ? ' today' : '');
  div.setAttribute('data-who', item.who);

  const whoLabel = { suami:'Fathir', istri:'Salma', bersama:'Bersama' };
  const tagClass = { suami:'tag-suami', istri:'tag-istri', bersama:'tag-bersama' };

  let dlBadge = '';
  if (item.deadline && !item.done) {
    const lbl = fmtDeadline(item.deadline);
    const cls = ds==='lewat'?'dl-overdue':ds==='hari-ini'?'dl-today':ds==='besok'?'dl-soon':'dl-future';
    const ico = ds==='lewat'?'⚠️':ds==='hari-ini'?'📅':ds==='besok'?'🔔':'🗓️';
    dlBadge = `<span class="deadline-badge ${cls}">${ico} ${lbl}</span>`;
  } else if (item.deadline && item.done) {
    dlBadge = `<span class="deadline-badge dl-done">✓ ${fmtDeadline(item.deadline)}</span>`;
  }

  div.innerHTML = `
    <div class="todo-check" onclick="toggleTodo(${item.id})">
      <span class="todo-check-mark">✓</span>
    </div>
    <div class="todo-body">
      <div class="todo-text">${escHtml(item.text)}</div>
      <div class="todo-meta">
        <span class="todo-who-tag ${tagClass[item.who]||'tag-bersama'}">${whoLabel[item.who]||'Bersama'}</span>
        ${dlBadge}
        <span class="todo-time-tag">dibuat ${fmtTime(item.createdAt)}</span>
        ${item.done&&item.doneAt?`<span class="todo-done-at">✓ selesai ${fmtTime(item.doneAt)}</span>`:''}
      </div>
    </div>
    <button class="todo-delete" onclick="deleteTodo(${item.id})" title="Hapus">✕</button>
  `;
  return div;
}

/* ========================
   JADWAL — navigasi
   ======================== */
const NAMA_HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const ID_HARI   = ['minggu','senin','selasa','rabu','kamis','jumat','sabtu'];

window.showView = function(id) {
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.main-tabs button').forEach(b => b.classList.remove('active'));
  const vp = document.getElementById('view-'+id);
  const mt = document.getElementById('mtab-'+id);
  if (vp) vp.classList.add('active');
  if (mt) mt.classList.add('active');
  if (id === 'menu') initMenu();
};

// FIX #3: showDay hanya scope ke dalam kolom SUAMI (.col-card:first-child)
window.showDay = function(day, btn) {
  // Hanya toggle day-panel yang ada di dalam .col-card SUAMI (bukan istri)
  const suamiCard = document.querySelector('.col-card:first-child');
  if (!suamiCard) return;

  suamiCard.querySelectorAll('.day-panel').forEach(p => p.classList.remove('active'));
  suamiCard.querySelectorAll('.day-tabs button').forEach(b => b.classList.remove('active'));

  const target = document.getElementById('day-'+day);
  if (target) target.classList.add('active');
  btn.classList.add('active');
  highlightLiveBlocks();
};

window.showIstri = function(id, btn) {
  document.querySelectorAll('.istri-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.istri-tabs button').forEach(b => b.classList.remove('active'));
  const target = document.getElementById('istri-'+id);
  if (target) target.classList.add('active');
  btn.classList.add('active');
  highlightLiveBlocks();
};

/* ========================
   Live clock
   ======================== */
function updateClock() {
  const el    = document.getElementById('live-clock');
  const dayEl = document.getElementById('live-day');
  if (!el) return;
  const now = new Date();
  el.textContent = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map(n => String(n).padStart(2,'0')).join(':');
  if (dayEl) dayEl.textContent = NAMA_HARI[now.getDay()];
}

/* ========================
   Sedang berlangsung
   ======================== */
function parseTime(str) {
  const p = str.trim().replace(',','.').split('.');
  return p.length < 2 ? NaN : +p[0]*60 + +p[1];
}

function getScheduleBlocks(panel) {
  const items = [];
  panel.querySelectorAll('.row').forEach(row => {
    const te = row.querySelector('.time');
    const be = row.querySelector('.block');
    if (!te || !be) return;
    const min = parseTime(te.textContent);
    if (!isNaN(min)) items.push({ startMin: min, blockEl: be });
  });
  items.forEach((it,i) => { it.endMin = i+1 < items.length ? items[i+1].startMin : it.startMin+60; });
  return items;
}

function makeBadge() {
  const s = document.createElement('span');
  s.className = 'live-badge';
  s.innerHTML = '<span class="live-dot"></span> sedang berlangsung';
  return s;
}

function highlightLiveBlocks() {
  document.querySelectorAll('.block').forEach(b => {
    b.classList.remove('live-now');
    b.querySelector('.live-badge')?.remove();
  });
  const now  = new Date();
  const cur  = now.getHours()*60 + now.getMinutes();
  const tidx = now.getDay();

  const activeDay = document.querySelector('.day-panel.active');
  if (activeDay) {
    const btn = document.querySelector('.day-tabs button.active');
    if (btn?.getAttribute('data-day') === ID_HARI[tidx]) {
      getScheduleBlocks(activeDay).forEach(it => {
        if (cur >= it.startMin && cur < it.endMin) {
          it.blockEl.classList.add('live-now');
          it.blockEl.appendChild(makeBadge());
        }
      });
    }
  }

  const activeIstri = document.querySelector('.istri-panel.active');
  if (activeIstri) {
    const isWE = tidx===0||tidx===6;
    const id   = activeIstri.id;
    if ((id==='istri-weekend'&&isWE)||(id==='istri-kerja'&&!isWE)) {
      getScheduleBlocks(activeIstri).forEach(it => {
        if (cur >= it.startMin && cur < it.endMin) {
          it.blockEl.classList.add('live-now');
          it.blockEl.appendChild(makeBadge());
        }
      });
    }
  }
}

/* ========================
   Auto-select hari
   ======================== */
function autoSelectDay() {
  const today  = new Date().getDay();
  const hariId = ID_HARI[today];

  // FIX #3 applied here too — scope ke suami card
  const suamiCard = document.querySelector('.col-card:first-child');
  if (suamiCard) {
    suamiCard.querySelectorAll('.day-panel').forEach(p => p.classList.remove('active'));
    suamiCard.querySelectorAll('.day-tabs button').forEach(b => b.classList.remove('active'));
    const dayTarget = document.getElementById('day-'+hariId);
    const dayBtn    = suamiCard.querySelector(`.day-tabs button[data-day="${hariId}"]`);
    if (dayTarget) dayTarget.classList.add('active');
    if (dayBtn)    dayBtn.classList.add('active');
  }

  const isWE = today===0||today===6;
  const ib   = document.querySelectorAll('.istri-tabs button');
  document.querySelectorAll('.istri-panel').forEach(p => p.classList.remove('active'));
  ib.forEach(b => b.classList.remove('active'));
  if (isWE) {
    document.getElementById('istri-weekend')?.classList.add('active');
    ib[1]?.classList.add('active');
  } else {
    document.getElementById('istri-kerja')?.classList.add('active');
    ib[0]?.classList.add('active');
  }
}

function injectClock() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const div = document.createElement('div');
  div.className = 'header-clock';
  div.innerHTML = '<span id="live-clock">--:--:--</span><span class="header-clock-day" id="live-day"></span>';
  header.appendChild(div);
}

function injectDateBadge() {
  const el = document.getElementById('todo-date-badge');
  if (!el) return;
  const d = new Date();
  el.textContent = `${NAMA_HARI[d.getDay()]}, ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
}

/* ========================
   Init
   ======================== */
document.addEventListener('DOMContentLoaded', () => {
  injectClock();
  injectDateBadge();
  autoSelectDay();
  updateClock();
  highlightLiveBlocks();
  initFirebase();
  setInterval(updateClock, 1000);
  setInterval(highlightLiveBlocks, 30000);
});

/* ================================================
   MENU MASAKAN
   ================================================ */
const DAFTAR_MENU = [
  "Pecel","Telur Dadar","Telur Rebus","Sayur Sop","Ayam Goreng",
  "Oseng Tempe","Sayur Asem","Pindang Goreng","Capjay Kuah","Mendoan",
  "Sayur Bening","Lele Goreng","Sop Daging","Nasi Goreng","Sop Ayam",
  "Tahu Goreng","Ca Kangkung","Capjay","Ayam Kecap","Oseng Tahu",
  "Sardine","Dadar Jagung","Nasi Sayur Bobor","Telur Balado",
  "Oseng Daun Pepaya","Udang Goreng","Ayam Kentacky","Tumis Brokoli",
  "Tumis Kubis","Oseng Terong","Sambal Terasi","Sambal Teri",
  "Sambal Matah","Sambal Orek","Bergedel Kentang","Tumis Sawi Kecambah",
  "Tumis Kecambah","Orak Arik Tahu Telor","Sop Pakchoy Tahu"
].sort();

const DAFTAR_BAHAN = {
  "\uD83C\uDF5A Bahan Pokok": [
    "Beras","Telur","Tempe","Tahu","Ayam","Daging sapi",
    "Lele","Udang","Ikan pindang","Sardine kaleng","Jagung",
    "Tepung terigu","Tepung tapioka","Tepung beras"
  ],
  "\uD83E\uDD6C Sayuran": [
    "Kangkung","Bayam","Wortel","Kol/Kubis","Brokoli","Labu siam",
    "Daun pepaya","Terong","Daun bawang","Seledri","Tomat","Timun",
    "Kacang panjang","Tauge","Buncis","Sawi","Kentang","Daun melinjo","Daun singkong"
  ],
  "\uD83E\uDDC4 Bumbu Dasar": [
    "Bawang merah","Bawang putih","Cabai kecil","Cabai merah","Cabai rawit","Kemiri",
    "Ketumbar","Merica/Lada","Kunyit","Jahe","Lengkuas","Kencur",
    "Serai","Daun salam","Daun jeruk","Daun kunyit","Daun bawang","Seledri",
    "Garam","Gula pasir","Gula merah","Kaldu bubuk","Minyak goreng"
  ],
  "\uD83E\uDD63 Bahan Pelengkap": [
    "Kecap manis","Saus tiram","Santan","Air asam jawa","Asam jawa",
    "Terasi","Tepung bumbu","Tepung panir","Jeruk nipis","Jeruk limau","Minyak wijen"
  ]
};

const SLOTS      = ['sarapan','siang','malam'];
const SLOT_LABEL = { sarapan:'\uD83C\uDF05 Sarapan', siang:'\u2600\uFE0F Makan Siang', malam:'\uD83C\uDF19 Makan Malam' };
const MAX_MENU_PER_SLOT = 3;

let weekOffset = 0;
let menuData   = {};
let bahanData  = {};
let activeSlot = null;

let menuRef  = null;
let bahanRef = null;
let menuFirebaseReady = false;

function encodeBahanKey(nama) {
  return nama
    .replace(/\./g,  '__dot__')
    .replace(/\//g,  '__sl__')
    .replace(/\[/g,  '__lb__')
    .replace(/\]/g,  '__rb__')
    .replace(/\#/g,  '__hash__')
    .replace(/\$/g,  '__dol__')
    .replace(/\s+/g, '_');
}

function initMenuFirebase() {
  if (!db) { initMenuLocal(); return; }
  try {
    menuRef  = db.ref('menu');
    bahanRef = db.ref('bahan');

    menuRef.on('value', snap => {
      const raw = snap.val() || {};
      menuData = {};
      Object.entries(raw).forEach(([dk, slots]) => {
        menuData[dk] = {};
        SLOTS.forEach(s => {
          const v = slots[s];
          if (!v) menuData[dk][s] = [];
          else if (Array.isArray(v)) menuData[dk][s] = v.filter(Boolean);
          else if (typeof v === 'string' && v !== '') menuData[dk][s] = [v];
          else menuData[dk][s] = [];
        });
      });
      renderMenuGrid();
    }, () => initMenuLocal());

    bahanRef.on('value', snap => {
      const raw = snap.val() || {};
      bahanData = {};
      Object.values(DAFTAR_BAHAN).flat().forEach(nama => {
        const k = encodeBahanKey(nama);
        if (raw[k] !== undefined) bahanData[nama] = raw[k];
      });
      renderBahanGrid();
    }, () => initMenuLocal());

    menuFirebaseReady = true;
  } catch(e) {
    console.error('Menu Firebase error:', e);
    initMenuLocal();
  }
}

function initMenuLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem('menu_mingguan_v2') || '{}');
    menuData = {};
    Object.entries(raw).forEach(([dk, slots]) => {
      menuData[dk] = {};
      SLOTS.forEach(s => {
        const v = slots[s];
        if (!v) menuData[dk][s] = [];
        else if (Array.isArray(v)) menuData[dk][s] = v.filter(Boolean);
        else if (typeof v === 'string' && v !== '') menuData[dk][s] = [v];
        else menuData[dk][s] = [];
      });
    });
  } catch { menuData = {}; }
  try { bahanData = JSON.parse(localStorage.getItem('stok_bahan_v2') || '{}'); } catch { bahanData = {}; }
  renderMenuGrid();
  renderBahanGrid();
}

function getMenuArray(dk, slot) {
  const val = menuData[dk]?.[slot];
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(v => v && v !== '');
  if (typeof val === 'string' && val !== '') return [val];
  return [];
}

function saveMenuSlot(dk, slot, arr) {
  if (!menuData[dk]) menuData[dk] = {};
  menuData[dk][slot] = arr;
  if (menuFirebaseReady && menuRef) {
    menuRef.child(dk).child(slot).set(arr.length ? arr : null);
  } else {
    localStorage.setItem('menu_mingguan_v2', JSON.stringify(menuData));
  }
}

function addMenuToSlot(dk, slot, menu) {
  const arr = getMenuArray(dk, slot);
  if (arr.length >= MAX_MENU_PER_SLOT) return;
  if (!arr.includes(menu)) arr.push(menu);
  saveMenuSlot(dk, slot, arr);
}

function removeMenuFromSlot(dk, slot, idx) {
  const arr = getMenuArray(dk, slot);
  arr.splice(idx, 1);
  saveMenuSlot(dk, slot, arr);
}

function replaceMenuInSlot(dk, slot, idx, menu) {
  const arr = getMenuArray(dk, slot);
  arr[idx] = menu;
  saveMenuSlot(dk, slot, arr);
}

function saveBahanItem(nama, value) {
  bahanData[nama] = value;
  const key = encodeBahanKey(nama);
  if (menuFirebaseReady && bahanRef) {
    bahanRef.child(key).set(value === undefined ? null : value);
  } else {
    localStorage.setItem('stok_bahan_v2', JSON.stringify(bahanData));
  }
}

function saveAllBahan(status) {
  const all = Object.values(DAFTAR_BAHAN).flat();
  all.forEach(n => { bahanData[n] = status; });
  if (menuFirebaseReady && bahanRef) {
    const updates = {};
    all.forEach(n => { updates[encodeBahanKey(n)] = status; });
    bahanRef.update(updates);
  } else {
    localStorage.setItem('stok_bahan_v2', JSON.stringify(bahanData));
    renderBahanGrid();
  }
}

function getMondayOf(offset) {
  const d = new Date();
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff + offset * 7);
  d.setHours(0,0,0,0);
  return d;
}
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function todayKey2() { return dateKey(new Date()); }
function getWeekDays(offset) {
  const mon = getMondayOf(offset);
  return Array.from({length:7}, (_,i) => {
    const d = new Date(mon); d.setDate(mon.getDate()+i); return d;
  });
}

function updateWeekLabel() {
  const days = getWeekDays(weekOffset);
  const bln  = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
  const f = `${days[0].getDate()} ${bln[days[0].getMonth()]}`;
  const l = `${days[6].getDate()} ${bln[days[6].getMonth()]} ${days[6].getFullYear()}`;
  const el = document.getElementById('week-label');
  if (el) el.textContent = weekOffset===0 ? `Minggu ini · ${f} – ${l}` : `${f} – ${l}`;
}

window.shiftWeek = function(dir) { weekOffset += dir; renderMenuGrid(); };
window.resetWeek = function()    { weekOffset  = 0;   renderMenuGrid(); };

function renderMenuGrid() {
  updateWeekLabel();
  const grid = document.getElementById('menu-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const today = todayKey2();
  const dayNames = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];

  getWeekDays(weekOffset).forEach(d => {
    const dk   = dateKey(d);
    const idx  = d.getDay()===0 ? 6 : d.getDay()-1;
    const card = document.createElement('div');
    card.className = 'menu-day-card' + (dk===today ? ' today' : '');
    card.innerHTML = `
      <div class="menu-day-label">
        ${dayNames[idx]}
        <span class="menu-day-date">${d.getDate()}/${d.getMonth()+1}</span>
      </div>
      <div class="menu-slots">
        ${SLOTS.map(s => buildSlotHTML(dk, s)).join('')}
      </div>`;
    grid.appendChild(card);
  });
}

function buildSlotHTML(dk, slot) {
  const arr    = getMenuArray(dk, slot);
  const filled = arr.length > 0;
  const canAdd = arr.length < MAX_MENU_PER_SLOT;

  const menuItems = arr.map((m, i) => `
    <div class="slot-menu-item">
      <span class="slot-menu-text" onclick="openMenuModal('${dk}','${slot}',${i})">${escMH(m)}</span>
      <button class="slot-menu-remove" onclick="event.stopPropagation();removeMenuSlotItem('${dk}','${slot}',${i})" title="Hapus menu ini">✕</button>
    </div>`).join('');

  return `
    <div class="menu-slot ${filled ? 'filled' : ''}">
      <div class="slot-label ${slot}">${SLOT_LABEL[slot]}</div>
      ${filled ? `<div class="slot-menu-list">${menuItems}</div>` : ''}
      ${canAdd ? `<div class="slot-empty" onclick="openMenuModal('${dk}','${slot}',${arr.length})">+ ${filled ? 'tambah menu' : 'pilih menu'}</div>` : ''}
    </div>`;
}
function escMH(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

window.removeMenuSlotItem = function(dk, slot, idx) {
  removeMenuFromSlot(dk, slot, idx);
  renderMenuGrid();
};

window.openMenuModal = function(dk, slot, menuIndex) {
  activeSlot = { dk, slot, menuIndex: menuIndex ?? 0 };
  const bln  = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
  const d    = new Date(dk+'T00:00:00');
  const names= { sarapan:'Sarapan', siang:'Makan Siang', malam:'Makan Malam' };
  const arr  = getMenuArray(dk, slot);
  const menuNum = arr.length > 0 ? ` (Menu ${(menuIndex ?? arr.length) + 1})` : '';
  document.getElementById('modal-title').textContent = `${names[slot]}${menuNum} · ${d.getDate()} ${bln[d.getMonth()]}`;
  document.getElementById('modal-search').value = '';
  document.getElementById('menu-modal').classList.add('open');
  document.getElementById('modal-search').focus();
  renderModalList('');
};

window.closeMenuModal = function(e) {
  if (!e || e.target === document.getElementById('menu-modal')) {
    document.getElementById('menu-modal').classList.remove('open');
    activeSlot = null;
  }
};
window.filterMenuModal = function() { renderModalList(document.getElementById('modal-search').value); };

function renderModalList(q) {
  const arr     = activeSlot ? getMenuArray(activeSlot.dk, activeSlot.slot) : [];
  const curMenu = activeSlot && activeSlot.menuIndex < arr.length ? arr[activeSlot.menuIndex] : '';
  const filtered = DAFTAR_MENU.filter(m => m.toLowerCase().includes(q.toLowerCase()));
  document.getElementById('modal-list').innerHTML = filtered.map(m => {
    const isCur   = m === curMenu;
    const isOther = arr.includes(m) && !isCur;
    return `<div class="menu-option ${isCur?'selected':''} ${isOther?'already-picked':''}" onclick="selectMenu('${escMH(m)}')">${escMH(m)}${isOther?' ✓':''}</div>`;
  }).join('');
}

window.selectMenu = function(menu) {
  if (!activeSlot) return;
  const { dk, slot, menuIndex } = activeSlot;
  const arr = getMenuArray(dk, slot);
  if (menuIndex < arr.length) {
    replaceMenuInSlot(dk, slot, menuIndex, menu);
  } else {
    addMenuToSlot(dk, slot, menu);
  }
  renderMenuGrid();
  document.getElementById('menu-modal').classList.remove('open');
  activeSlot = null;
};

window.clearSlot = function() {
  if (!activeSlot) return;
  const { dk, slot, menuIndex } = activeSlot;
  const arr = getMenuArray(dk, slot);
  if (menuIndex < arr.length) {
    removeMenuFromSlot(dk, slot, menuIndex);
  } else {
    saveMenuSlot(dk, slot, []);
  }
  renderMenuGrid();
  document.getElementById('menu-modal').classList.remove('open');
  activeSlot = null;
};

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.getElementById('menu-modal')?.classList.remove('open');
    activeSlot = null;
  }
});

function renderBahanGrid() {
  const grid = document.getElementById('bahan-grid');
  if (!grid) return;
  grid.innerHTML = '';

  Object.entries(DAFTAR_BAHAN).forEach(([kat, items]) => {
    const grp = document.createElement('div');
    grp.className = 'bahan-group';
    grp.innerHTML = `<div class="bahan-group-label">${kat}</div><div class="bahan-items"></div>`;
    grid.appendChild(grp);

    const cont = grp.querySelector('.bahan-items');
    items.forEach(nama => {
      const val  = bahanData[nama];
      const cls  = val===true ? 'ada' : val===false ? 'habis' : '';
      const pill = document.createElement('div');
      pill.className = `bahan-pill ${cls}`;
      pill.innerHTML = `<span class="bahan-pill-dot"></span>${nama}`;
      pill.onclick   = () => toggleBahan(nama, pill);
      cont.appendChild(pill);
    });
  });
}

function toggleBahan(nama, el) {
  const cur = bahanData[nama];
  let next;
  if (cur===undefined||cur===null) { next=true;      el.className='bahan-pill ada';   }
  else if (cur===true)             { next=false;     el.className='bahan-pill habis'; }
  else                             { next=undefined; el.className='bahan-pill';       }
  bahanData[nama] = next;
  saveBahanItem(nama, next);
}

window.setAllBahan = function(status) { saveAllBahan(status); };

function initMenu() {
  if (menuFirebaseReady) {
    renderMenuGrid();
    renderBahanGrid();
  } else {
    initMenuLocal();
  }
}

/* ================================================
   HARI INI — Dashboard harian
   ================================================ */

const JADWAL_SUAMI = {
  senin:  [
    {t:'03.00',a:'Bangun — persiapan ibadah malam'},{t:'03.15',a:'Tahajud, Witir, doa'},
    {t:'03.40',a:'Sahur'},{t:'04.10',a:'Tilawah Al-Qur\'an'},{t:'04.45',a:'Sholat Subuh + Dzikir pagi'},
    {t:'05.10',a:'Mengaji'},{t:'05.30',a:'Workout pagi (20 menit)'},{t:'05.50',a:'Mandi, berpakaian rapi'},
    {t:'06.20',a:'Berangkat ke SMAN 8 Kota Kediri'},{t:'06.45',a:'Tiba di sekolah'},
    {t:'07.00',a:'Jadwal sesuai pelajaran'},{t:'09.00',a:'Istirahat — Sholat Dhuha'},
    {t:'09.30',a:'Jadwal sesuai pelajaran'},{t:'11.30',a:'Sholat Dzuhur berjamaah (puasa)'},
    {t:'12.15',a:'Jadwal sesuai pelajaran'},{t:'15.00',a:'Sholat Ashar'},
    {t:'15.30',a:'Absensi pulang — perjalanan ke rumah'},{t:'16.20',a:'Bermain dengan anak'},
    {t:'17.00',a:'Istirahat / persiapan berbuka'},{t:'17.45',a:'Maghrib — berbuka puasa'},
    {t:'18.30',a:'Makan malam bersama keluarga'},{t:'19.15',a:'Sholat Isya + Dzikir malam'},
    {t:'20.00',a:'Cek Artilerianstore'},{t:'20.30',a:'Coding / membaca / nulis artikel'},{t:'21.30',a:'Tidur'}
  ],
  selasa: [
    {t:'03.45',a:'Bangun — Tahajud, Witir, doa'},{t:'04.30',a:'Sahur ringan / minum'},
    {t:'04.45',a:'Sholat Subuh + Dzikir pagi'},{t:'05.10',a:'Mengaji / Tilawah'},
    {t:'05.35',a:'Workout pagi (25 menit)'},{t:'06.00',a:'Mandi + sarapan'},
    {t:'06.20',a:'Berangkat ke sekolah'},{t:'06.45',a:'Tiba di sekolah'},
    {t:'07.00',a:'Jadwal sesuai pelajaran'},{t:'09.00',a:'Istirahat — Sholat Dhuha + snack'},
    {t:'09.30',a:'Jadwal sesuai pelajaran'},{t:'11.30',a:'Sholat Dzuhur + makan siang'},
    {t:'12.15',a:'Jadwal sesuai pelajaran'},{t:'15.00',a:'Sholat Ashar'},
    {t:'15.30',a:'Absensi pulang'},{t:'16.00',a:'Fotografi / videografi sore'},
    {t:'16.45',a:'Mandi + istirahat'},{t:'18.00',a:'Maghrib + Tilawah'},
    {t:'18.30',a:'Makan malam bersama keluarga'},{t:'19.15',a:'Isya'},
    {t:'19.45',a:'Nulis artikel / edit foto-video / cek toko'},{t:'21.30',a:'Tidur'}
  ],
  rabu: [
    {t:'03.45',a:'Bangun — Tahajud, Witir, doa'},{t:'04.30',a:'Sahur ringan / minum'},
    {t:'04.45',a:'Sholat Subuh + Dzikir + Tilawah'},{t:'05.10',a:'Mengaji'},
    {t:'05.35',a:'Workout pagi (20 menit)'},{t:'06.00',a:'Mandi + sarapan'},
    {t:'06.20',a:'Berangkat ke sekolah'},{t:'06.45',a:'Tiba di sekolah'},
    {t:'07.00',a:'Jadwal sesuai pelajaran'},{t:'09.00',a:'Istirahat — Sholat Dhuha'},
    {t:'09.30',a:'Jadwal sesuai pelajaran'},{t:'11.30',a:'Sholat Dzuhur + makan siang'},
    {t:'12.15',a:'Jadwal sesuai pelajaran'},{t:'15.00',a:'Sholat Ashar'},
    {t:'15.30',a:'Absensi pulang — segera pulang'},{t:'15.45',a:'Makan ringan + persiapan madin'},
    {t:'16.30',a:'Mengajar Madin / TPA (hingga 19.00)'},{t:'19.00',a:'Selesai madin — Sholat Maghrib'},
    {t:'19.30',a:'Sholat Isya'},{t:'19.45',a:'Makan malam + istirahat ringan'},
    {t:'20.30',a:'Santai: baca / coding ringan / cek toko'},{t:'21.30',a:'Tidur'}
  ],
  kamis: [
    {t:'03.00',a:'Bangun — persiapan ibadah malam'},{t:'03.15',a:'Tahajud, Witir, doa'},
    {t:'03.40',a:'Sahur'},{t:'04.10',a:'Tilawah Al-Qur\'an'},{t:'04.45',a:'Sholat Subuh + Dzikir pagi'},
    {t:'05.10',a:'Mengaji'},{t:'05.30',a:'Workout pagi (20 menit)'},{t:'05.50',a:'Mandi, berpakaian rapi'},
    {t:'06.20',a:'Berangkat ke sekolah'},{t:'06.45',a:'Tiba di sekolah'},
    {t:'07.00',a:'Jadwal sesuai pelajaran'},{t:'09.00',a:'Sholat Dhuha (2–4 rakaat)'},
    {t:'09.30',a:'Jadwal sesuai pelajaran'},{t:'11.30',a:'Sholat Dzuhur berjamaah (puasa)'},
    {t:'12.15',a:'Jadwal sesuai pelajaran'},{t:'15.00',a:'Sholat Ashar'},
    {t:'15.30',a:'Absensi pulang'},{t:'16.20',a:'Bermain dengan anak'},
    {t:'17.00',a:'Istirahat / persiapan berbuka'},{t:'17.45',a:'Maghrib — berbuka puasa'},
    {t:'18.30',a:'Makan malam bersama keluarga'},{t:'19.15',a:'Sholat Isya + Dzikir malam'},
    {t:'20.00',a:'Cek Artilerianstore'},{t:'20.30',a:'Coding / membaca / nulis artikel'},{t:'21.30',a:'Tidur'}
  ],
  jumat: [
    {t:'03.45',a:'Bangun — Tahajud, Witir, doa'},{t:'04.30',a:'Sahur ringan / minum'},
    {t:'04.45',a:'Subuh + Dzikir (sunnah baca Al-Kahfi)'},{t:'05.10',a:'Mengaji / Tilawah'},
    {t:'05.35',a:'Workout pagi (25 menit)'},{t:'06.00',a:'Mandi + sarapan'},
    {t:'06.20',a:'Berangkat ke sekolah'},{t:'06.45',a:'Tiba di sekolah'},
    {t:'07.00',a:'Jadwal sesuai pelajaran'},{t:'09.00',a:'Sholat Dhuha + istirahat'},
    {t:'09.30',a:'Jadwal sesuai pelajaran'},{t:'11.00',a:'Persiapan Sholat Jumat'},
    {t:'11.30',a:'Berangkat ke Masjid — Sholat Jumat'},{t:'13.00',a:'Jadwal sesuai pelajaran'},
    {t:'15.00',a:'Ashar'},{t:'16.00',a:'Absensi pulang + pulang'},
    {t:'16.30',a:'Workout sore / mancing sore'},{t:'17.00',a:'Mandi + istirahat'},
    {t:'18.00',a:'Maghrib + Tilawah'},{t:'18.30',a:'Nongki malam / makan malam bersama istri'},
    {t:'19.15',a:'Isya'},{t:'20.00',a:'Quality time keluarga / cek toko'},{t:'21.30',a:'Tidur'}
  ],
  sabtu: [
    {t:'04.30',a:'Subuh + Tilawah + Dzikir'},{t:'05.15',a:'Jogging / workout pagi (45–60 menit)'},
    {t:'06.15',a:'Bantu istri mandikan anak'},{t:'06.45',a:'Sarapan bersama keluarga'},
    {t:'07.30',a:'Merawat tanaman & aquascape'},{t:'08.30',a:'Bersih-bersih sekitar rumah'},
    {t:'09.30',a:'Sholat Dhuha'},{t:'09.45',a:'Fotografi / Coding / nulis artikel'},
    {t:'11.30',a:'Dzuhur'},{t:'12.00',a:'Makan siang + tidur siang (1–1.5 jam)'},
    {t:'13.30',a:'Evaluasi toko Shopee — brief karyawan'},{t:'14.30',a:'Jalan-jalan keluarga / wisata kuliner'},
    {t:'15.00',a:'Ashar'},{t:'15.30',a:'Mancing sore / nongki santai'},
    {t:'17.30',a:'Mandi + istirahat'},{t:'18.00',a:'Maghrib + Tilawah'},
    {t:'18.30',a:'Kuliner malam / nongkrong bareng istri'},{t:'19.15',a:'Isya'},
    {t:'20.00',a:'Baca buku / nonton film / masak bareng istri'},{t:'22.00',a:'Tidur'}
  ],
  minggu: [
    {t:'05.00',a:'Subuh (boleh agak telat bangun — weekend rest)'},{t:'05.30',a:'Tidur lagi / rebahan santai'},
    {t:'07.00',a:'Bangun — bantu mandikan anak, sarapan keluarga'},{t:'08.00',a:'Jogging pagi bersama keluarga'},
    {t:'09.00',a:'Sholat Dhuha'},{t:'09.30',a:'Liburan keluarga / wisata / jalan-jalan'},
    {t:'11.30',a:'Dzuhur'},{t:'12.00',a:'Makan siang + tidur siang (2 jam)'},
    {t:'14.00',a:'Family time — bermain dengan anak / jalan sore'},{t:'15.00',a:'Ashar'},
    {t:'15.30',a:'Hobi bebas: mancing / aquascape / baca buku'},{t:'17.30',a:'Mandi + persiapan malam'},
    {t:'18.00',a:'Maghrib + Tilawah'},{t:'18.30',a:'Cek toko Shopee — evaluasi & set target'},
    {t:'19.00',a:'Makan malam keluarga + ngobrol santai'},{t:'19.30',a:'Isya'},
    {t:'20.00',a:'Me-time: baca / nulis / coding / evaluasi mingguan'},{t:'21.00',a:'Tidur'}
  ]
};

const REMINDER_PER_HARI = {
  senin:  '🌙 Puasa Sunnah Senin. Bangun 03.00 untuk Tahajud + Sahur. Batas HP kerja 16.00.',
  selasa: '📸 Hari untuk konten kreatif — bawa kamera/hp bagus sore. Batas HP kerja 16.00.',
  rabu:   '⚠️ Hari tersibuk! Pulang cepat untuk Madin 16.30. Workout sore ditiadakan. Jaga stamina.',
  kamis:  '🌙 Puasa Sunnah Kamis. Berbuka Maghrib 17.45. Batas HP kerja 16.00.',
  jumat:  '📖 Baca Al-Kahfi pagi. Sholat Jumat berjamaah 11.30. Date Night Salma malam ini 💑',
  sabtu:  '🌿 Libur produktif! Evaluasi toko Shopee siang. Jalan-jalan keluarga sore.',
  minggu: '🏡 Hari keluarga & istirahat penuh. Evaluasi mingguan malam untuk persiapan Senin.'
};

const CHECKLIST_ITEMS = [
  'Sholat Subuh ✓','Dzikir pagi ✓','Workout / olahraga ✓','Tilawah Al-Qur\'an ✓',
  'Sholat Dhuha ✓','Cek toko Artilerianstore ✓','Sholat Dzuhur ✓','Sholat Ashar ✓',
  'Quality time keluarga ✓','Sholat Maghrib ✓','Sholat Isya ✓','Baca buku / belajar ✓'
];

const DCHECKS_KEY = 'dchecks_' + new Date().toISOString().slice(0,10);

function parseTimeMin(str) {
  const p = str.replace(',','.').split('.');
  return p.length < 2 ? NaN : +p[0]*60 + +p[1];
}

function initHariIni() {
  const now     = new Date();
  const todayId = ID_HARI[now.getDay()];
  const curMin  = now.getHours()*60 + now.getMinutes();

  // Stat cards
  const statHari = document.getElementById('d-stat-hari');
  const statJam  = document.getElementById('d-stat-jam');
  if (statHari) statHari.textContent = NAMA_HARI[now.getDay()];
  if (statJam)  statJam.textContent  = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  // Timeline
  const tl   = document.getElementById('d-timeline');
  const sched = JADWAL_SUAMI[todayId] || [];
  if (tl) {
    tl.innerHTML = '';
    sched.forEach((item, i) => {
      const startM = parseTimeMin(item.t);
      const endM   = i+1 < sched.length ? parseTimeMin(sched[i+1].t) : startM+60;
      const isLive = curMin >= startM && curMin < endM;
      const row    = document.createElement('div');
      row.className = 'dash-tl-row' + (isLive ? ' live-row' : '');
      row.innerHTML = `<span class="dash-tl-time">${item.t}</span><span class="dash-tl-text">${item.a}${isLive ? ' <span style="font-size:9px;background:#f0c060;color:#7a4800;border-radius:8px;padding:1px 6px;margin-left:4px;font-weight:700">▶ sekarang</span>' : ''}</span>`;
      tl.appendChild(row);
      if (isLive) setTimeout(() => row.scrollIntoView({block:'center',behavior:'smooth'}), 200);
    });
  }

  // Checklist
  const checksEl = document.getElementById('d-checks');
  if (checksEl) {
    checksEl.innerHTML = '';
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(DCHECKS_KEY) || '{}'); } catch{}
    CHECKLIST_ITEMS.forEach((label, i) => {
      const done = saved[i] || false;
      const item = document.createElement('div');
      item.className = 'dash-check-item' + (done ? ' checked' : '');
      item.setAttribute('data-idx', i);
      item.innerHTML = `<div class="dash-check-box">${done ? '✓' : ''}</div><span class="dash-check-label">${label}</span>`;
      item.onclick = () => {
        item.classList.toggle('checked');
        const box = item.querySelector('.dash-check-box');
        const isNowChecked = item.classList.contains('checked');
        box.textContent = isNowChecked ? '✓' : '';
      };
      checksEl.appendChild(item);
    });
  }

  // Reminder
  const remEl = document.getElementById('d-reminder');
  if (remEl) {
    remEl.innerHTML = `<div class="dash-reminder-title">📌 Catatan Hari ${NAMA_HARI[now.getDay()]}</div>${REMINDER_PER_HARI[todayId] || 'Selamat beraktivitas!'}`;
  }
}

window.saveDChecks = function() {
  const items = document.querySelectorAll('#d-checks .dash-check-item');
  const data  = {};
  items.forEach((item, i) => { data[i] = item.classList.contains('checked'); });
  try { localStorage.setItem(DCHECKS_KEY, JSON.stringify(data)); } catch{}
  // brief visual feedback
  const btn = document.querySelector('[onclick="saveDChecks()"]');
  if (btn) { const orig = btn.textContent; btn.textContent = '✓ Tersimpan!'; setTimeout(()=> btn.textContent = orig, 1200); }
};

window.resetDChecks = function() {
  try { localStorage.removeItem(DCHECKS_KEY); } catch{}
  document.querySelectorAll('#d-checks .dash-check-item').forEach(item => {
    item.classList.remove('checked');
    item.querySelector('.dash-check-box').textContent = '';
  });
};

/* ================================================
   Override showView to init sub-views
   ================================================ */
const _origShowView2 = window.showView;
window.showView = function(id) {
  _origShowView2(id);
  if (id === 'today')   setTimeout(initHariIni,  50);
  if (id === 'english') setTimeout(initEnglish,  50);
};

// Auto-update stat time every minute
setInterval(() => {
  const panel = document.getElementById('view-today');
  if (panel && panel.classList.contains('active')) {
    const now   = new Date();
    const el    = document.getElementById('d-stat-jam');
    if (el) el.textContent = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  }
}, 60000);

/* ================================================
   ENGLISH LEARNING TRACKER — Gamified System
   Intermediate → Advanced
   ================================================ */

const ENG_KEY    = 'eng_data_v3';      // { dates: {YYYY-MM-DD: true}, totalXP: 0 }
const ENG_WEEKLY = ['senin','selasa','rabu','kamis','jumat','sabtu','minggu'];
const DAY_ID_MAP = [6,0,1,2,3,4,5];   // JS getDay (0=Sun) → ENG_WEEKLY index

const ENG_SCHEDULE = {
  senin:  { icon:'🎧', bg:'#eff6ff', name:'Senin — Listening', focus:'Podcast / Video 20\' + Anki 10\'', tasks:['Buka BBC 6 Minute English atau TED-Ed','Dengarkan 1–2 episode, catat 3–5 frasa baru','Tambahkan frasa ke Anki deck'], xp:10 },
  selasa: { icon:'✍️', bg:'#ecfdf5', name:'Selasa — Writing', focus:'English Journal 150+ kata 20\' + Grammar 10\'', tasks:['Tulis hari ini dalam bahasa Inggris (minimal 150 kata)','Gunakan Grammarly untuk review','Pelajari 1 grammar point baru'], xp:12 },
  rabu:   { icon:'⚡', bg:'#fef2f2', name:'Rabu — Micro Day', focus:'Anki review 10 menit (wajib)', tasks:['Buka Anki — review semua due cards','Minimal 10 menit sebelum tidur','Tidak perlu lebih — konsistensi kunci!'], xp:5 },
  kamis:  { icon:'📖', bg:'#eff6ff', name:'Kamis — Reading', focus:'Artikel English 20\' + Vocab in context 10\'', tasks:['Baca 1 artikel dari BBC Education atau The Guardian','Underline kata/frasa baru','Masukkan ke Anki dengan contoh kalimat'], xp:10 },
  jumat:  { icon:'🎙️', bg:'#fffbeb', name:'Jumat — Speaking', focus:'Shadowing 15\' + Self-recording 2 menit', tasks:['Pilih video YouTube, tirukan intonasi & ritme','Rekam diri sendiri bicara topik bebas 2 menit','Dengar ulang — evaluasi pronunciation'], xp:15 },
  sabtu:  { icon:'🌿', bg:'#f0fdfa', name:'Sabtu — Applied English', focus:'Konten bisnis + YouTube tanpa subtitle', tasks:['Buat 2–3 caption Artilerianstore/Salmarket dalam Inggris','Nonton 1 episode YouTube tanpa subtitle','Catat ungkapan natural yang menarik'], xp:10 },
  minggu: { icon:'🏠', bg:'#f9f8f5', name:'Minggu — Rest & Review', focus:'Review Anki ringan + evaluasi minggu', tasks:['Anki review jika sempat (opsional)','Evaluasi: skill apa yang paling berkembang?','Rencanakan target minggu depan'], xp:5 }
};

const LEVEL_SYSTEM = [
  { min:0,   max:99,  badge:'🌱', title:'Beginner',      color:'#6b7280' },
  { min:100, max:249, badge:'📗', title:'Elementary',    color:'#16a34a' },
  { min:250, max:499, badge:'⭐', title:'Pre-Intermediate', color:'#ca8a04' },
  { min:500, max:849, badge:'🔥', title:'Intermediate',  color:'#ea580c' },
  { min:850, max:1299,badge:'💫', title:'Upper-Inter',   color:'#7c3aed' },
  { min:1300,max:1999,badge:'🏆', title:'Advanced',      color:'#1d4ed8' },
  { min:2000,max:9999,badge:'👑', title:'Expert',        color:'#f0c060' }
];

const ACHIEVEMENTS = [
  { id:'first',   icon:'🎯', name:'Mulai!',          desc:'Selesai 1 sesi',    req: d => d.total >= 1 },
  { id:'week1',   icon:'📅', name:'Seminggu',        desc:'7 hari total',      req: d => d.total >= 7 },
  { id:'streak3', icon:'🔥', name:'3 Hari Beruntun', desc:'Streak 3 hari',     req: d => d.streak >= 3 },
  { id:'streak7', icon:'⚡', name:'Seminggu Penuh',  desc:'Streak 7 hari',     req: d => d.streak >= 7 },
  { id:'month',   icon:'🏅', name:'Sebulan',         desc:'30 hari total',     req: d => d.total >= 30 },
  { id:'speak',   icon:'🎙️', name:'Speaker',         desc:'10x sesi Speaking', req: d => (d.bySkill?.jumat||0) >= 10 },
  { id:'writer',  icon:'✍️', name:'Writer',          desc:'10x sesi Writing',  req: d => (d.bySkill?.selasa||0) >= 10 },
  { id:'streak30',icon:'👑', name:'30 Hari Beruntun', desc:'Streak 30 hari',   req: d => d.streak >= 30 },
];

const TIPS_POOL = [
  { text:"Don't just study English — use it. Caption toko Artilerianstore dalam bahasa Inggris hari ini.", sub:"Applied learning 5× lebih efektif dari hafalan pasif.", cat:"Strategi" },
  { text:"Record yourself speaking for 2 minutes. You'll be surprised how much you've improved.", sub:"Self-monitoring adalah salah satu teknik paling powerful untuk pronunciation.", cat:"Speaking" },
  { text:"Learn vocabulary in context, not in isolation. 'I'm swamped with work' jauh lebih memorable dari hafal kata 'swamped' saja.", sub:"Gunakan Anki dengan contoh kalimat lengkap, bukan kata tunggal.", cat:"Vocabulary" },
  { text:"Consistency beats intensity. 20 menit tiap hari lebih baik dari 3 jam sekali seminggu.", sub:"Otak membutuhkan repetisi terjadwal untuk menyimpan informasi ke long-term memory.", cat:"Motivasi" },
  { text:"Shadowing is your fastest path to natural English. Mirror the speaker's rhythm, not just words.", sub:"Teknik ini digunakan language learner professional di seluruh dunia.", cat:"Speaking" },
  { text:"When you read in English, don't look up every word. Try to guess from context first.", sub:"Kemampuan inferring meaning dari konteks adalah ciri khas advanced learner.", cat:"Reading" },
  { text:"Error correction: write something, use Grammarly, then understand WHY it was wrong.", sub:"Pelajari pola error kamu. Intermediate learner biasanya punya 5–7 error pattern yang berulang.", cat:"Writing" },
  { text:"Start your day with 10 minutes of English input — podcast, YouTube, or audio book.", sub:"Morning brain lebih receptive. Gunakan waktu commute motor ke sekolah.", cat:"Strategi" },
  { text:"Advanced English means using collocations naturally: 'make a decision', not 'do a decision'.", sub:"Fokus belajar collocations, bukan vocab tunggal. Ini pembeda Intermediate vs Advanced.", cat:"Vocabulary" },
  { text:"Think in English for 5 minutes a day. Narrate what you're doing: 'I'm preparing lessons for tomorrow.'", sub:"Inner monolog dalam bahasa Inggris mempercepat fluency secara signifikan.", cat:"Speaking" },
  { text:"The best English learners are the most comfortable with making mistakes in public.", sub:"Fear of mistakes adalah hambatan terbesar. Madin dan sekolah = practice arena!", cat:"Motivasi" },
  { text:"Use English for real purposes: reply 1 email in English today, or write product description toko.", sub:"Real-world usage menciptakan motivasi intrinsik yang lebih kuat dari latihan buatan.", cat:"Strategi" },
  { text:"Upgrade your vocabulary: instead of 'good', use 'outstanding', 'remarkable', 'stellar'.", sub:"Intermediate → Advanced = range sinonim yang lebar & presisi dalam memilih kata.", cat:"Vocabulary" },
  { text:"Listen to the same podcast episode twice: once for gist, once for detail.", sub:"Double listening melatih bottom-up dan top-down listening strategy sekaligus.", cat:"Listening" },
  { text:"Write 3 sentences about your teaching day in English before sleeping. Just 3 sentences.", sub:"Micro habit yang mudah dimulai. Lama-lama jadi paragraf, lalu halaman penuh.", cat:"Writing" },
];

const PHRASES = [
  { en:"I'd like to elaborate on that.", id:"Saya ingin menguraikan hal itu lebih lanjut.", ctx:"Formal meetings / presentations" },
  { en:"That's a valid point, however...", id:"Itu poin yang valid, namun...", ctx:"Debating / discussion" },
  { en:"I'm swamped with work right now.", id:"Saya sedang sangat sibuk sekarang.", ctx:"Casual / informal" },
  { en:"Could you shed some light on this?", id:"Bisakah Anda menjelaskan ini lebih lanjut?", ctx:"Asking for clarification" },
  { en:"It's on the tip of my tongue.", id:"Sudah di ujung lidah / hampir ingat.", ctx:"When forgetting a word" },
  { en:"Let's touch base tomorrow.", id:"Mari kita koordinasi lagi besok.", ctx:"Business / professional" },
  { en:"I'm inclined to agree with you.", id:"Saya cenderung setuju dengan Anda.", ctx:"Polite agreement" },
  { en:"That goes without saying.", id:"Itu sudah jelas / tidak perlu dikatakan.", ctx:"Emphasizing obvious points" },
  { en:"I'll take that on board.", id:"Saya akan mempertimbangkan masukan itu.", ctx:"Receiving feedback professionally" },
  { en:"To put it in a nutshell...", id:"Singkatnya / Intinya...", ctx:"Summarizing" },
  { en:"I'm on the fence about this.", id:"Saya masih ragu / belum memutuskan.", ctx:"Expressing uncertainty" },
  { en:"Don't reinvent the wheel.", id:"Tidak perlu membuat sesuatu dari nol jika sudah ada solusinya.", ctx:"Practical advice" },
];

/* ── Data helpers ── */
function getEngData() {
  try { return JSON.parse(localStorage.getItem(ENG_KEY) || '{}'); } catch { return {}; }
}
function saveEngData(d) {
  try { localStorage.setItem(ENG_KEY, JSON.stringify(d)); } catch {}
}

function calcStreak(datesObj) {
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0,10);
    if (datesObj[key]) streak++;
    else if (i > 0) break; // Allow today to be incomplete
  }
  return streak;
}

function getLevel(xp) {
  for (let i = LEVEL_SYSTEM.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_SYSTEM[i].min) return { ...LEVEL_SYSTEM[i], idx: i };
  }
  return { ...LEVEL_SYSTEM[0], idx: 0 };
}

function getTodayDayId() {
  const d = new Date().getDay(); // 0=Sun,1=Mon,...6=Sat
  return ENG_WEEKLY[DAY_ID_MAP[d]];
}

function getWeekDates() {
  const today = new Date();
  const day   = today.getDay();
  const diff  = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return Array.from({length:7}, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0,10);
  });
}

/* ── Render ── */
function initEnglish() {
  const raw       = getEngData();
  const dates     = raw.dates     || {};
  const totalXP   = raw.totalXP   || 0;
  const bySkill   = raw.bySkill   || {};
  const total     = Object.values(dates).filter(Boolean).length;
  const streak    = calcStreak(dates);
  const todayKey  = new Date().toISOString().slice(0,10);
  const todayId   = getTodayDayId();
  const level     = getLevel(totalXP);
  const nextLevel = LEVEL_SYSTEM[Math.min(level.idx+1, LEVEL_SYSTEM.length-1)];
  const xpInLevel = totalXP - level.min;
  const xpNeeded  = nextLevel.min - level.min;
  const xpPct     = Math.min(100, Math.round((xpInLevel / xpNeeded) * 100));

  // ── Hero card ──
  const el = s => document.getElementById(s);
  if (el('eng-streak'))     el('eng-streak').textContent     = streak;
  if (el('eng-streak-lbl')) el('eng-streak-lbl').textContent = streak === 0 ? 'hari streak · Mulai hari ini!' : `hari streak berturut-turut${streak >= 7 ? ' 🔥' : ''}`;
  if (el('eng-streak-fire')) el('eng-streak-fire').textContent = streak >= 7 ? '🔥' : streak >= 3 ? '⚡' : '📚';
  if (el('eng-badge'))      el('eng-badge').textContent      = level.badge;
  if (el('eng-badge-title')) el('eng-badge-title').textContent = level.title;
  if (el('eng-total-days')) el('eng-total-days').textContent = total;
  if (el('eng-xp-label'))   el('eng-xp-label').textContent  = `${totalXP} XP`;
  if (el('eng-xp-bar'))     el('eng-xp-bar').style.width    = xpPct + '%';
  if (el('eng-level-pill')) el('eng-level-pill').textContent = `${level.title} → ${nextLevel.title} (${xpPct}%)`;

  // Week dots
  const weekDates = getWeekDates();
  const dotsEl    = el('eng-week-dots');
  if (dotsEl) {
    dotsEl.innerHTML = '';
    const dayLabels  = ['S','S','R','K','J','S','M'];
    weekDates.forEach((dt, i) => {
      const dot = document.createElement('div');
      const isToday  = dt === todayKey;
      const isDone   = dates[dt];
      dot.className  = 'eng-week-dot' + (isDone ? ' done' : '') + (isToday ? ' today-dot' : '');
      dot.textContent = isDone ? '✓' : dayLabels[i];
      dot.title       = dt;
      dotsEl.appendChild(dot);
    });
  }

  // ── Today card ──
  const sched = ENG_SCHEDULE[todayId] || ENG_SCHEDULE.senin;
  const isDoneToday = dates[todayKey];
  if (el('eng-today-day')) el('eng-today-day').textContent = sched.name;
  if (el('eng-today-body')) {
    el('eng-today-body').innerHTML = `
      <div class="eng-today-focus-text">${sched.focus}</div>
      <div class="eng-today-tasks">
        ${sched.tasks.map(t => `<div class="eng-task-chip">→ ${t}</div>`).join('')}
      </div>
    `;
  }
  const doneBtn = el('eng-done-btn');
  if (doneBtn) {
    doneBtn.textContent = isDoneToday ? `✅ Selesai! (+${sched.xp} XP)` : `○ Tandai Selesai (+${sched.xp} XP)`;
    doneBtn.className   = 'eng-done-btn' + (isDoneToday ? ' done-state' : '');
  }

  // Highlight today's day card
  ENG_WEEKLY.forEach(id => {
    const card = document.getElementById('edc-'+id);
    if (card) {
      card.classList.toggle('today-highlight', id === todayId);
      const tag = document.getElementById('done-' + id);
      // Mark done if any date this week matches this day
      const dayIdx    = ENG_WEEKLY.indexOf(id);
      const dateOfDay = weekDates[dayIdx];
      if (tag) {
        tag.textContent = '✓ Selesai';
        tag.classList.toggle('visible', !!dates[dateOfDay]);
      }
    }
  });

  // ── Progress tab ──
  renderEngProgress(dates, todayKey);

  // ── Achievements ──
  const achEl = el('eng-achievements');
  if (achEl) {
    const stats = { total, streak, bySkill };
    achEl.innerHTML = ACHIEVEMENTS.map(a => {
      const unlocked = a.req(stats);
      return `<div class="eng-ach ${unlocked ? 'unlocked' : ''}">
        <span class="eng-ach-icon ${unlocked ? '' : 'eng-ach-locked'}">${a.icon}</span>
        <div><div style="font-size:12px;font-weight:${unlocked?'700':'500'}">${a.name}</div>
        <div style="font-size:10px;opacity:.65">${a.desc}</div></div>
      </div>`;
    }).join('');
  }

  // ── Tips tab ──
  renderEngTips();
}

function renderEngProgress(dates, todayKey) {
  const grid = document.getElementById('eng-progress-grid');
  if (!grid) return;
  grid.innerHTML = '';

  // Show last 5 weeks + current
  const today   = new Date();
  const day     = today.getDay();
  const diff    = day === 0 ? -6 : 1 - day;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() + diff);

  for (let w = 4; w >= 0; w--) {
    const monday = new Date(thisMonday);
    monday.setDate(thisMonday.getDate() - w * 7);

    // Week label
    const lbl = document.createElement('div');
    lbl.className = 'eng-prog-week-label';
    const opts = {day:'numeric',month:'short'};
    const end  = new Date(monday); end.setDate(monday.getDate()+6);
    lbl.textContent = w === 0 ? `Minggu ini · ${monday.toLocaleDateString('id-ID',opts)}` : monday.toLocaleDateString('id-ID',opts) + ' – ' + end.toLocaleDateString('id-ID',opts);
    grid.appendChild(lbl);

    const dayLabels = ['S','S','R','K','J','S','M'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday); d.setDate(monday.getDate()+i);
      const key = d.toISOString().slice(0,10);
      const div = document.createElement('div');
      const isDone  = dates[key];
      const isToday = key === todayKey;
      const isFuture = d > today;
      div.className = 'eng-prog-day' + (isDone ? ' done-day' : '') + (isToday ? ' today-prog' : '');
      div.textContent = isDone ? '✓' : dayLabels[i];
      div.style.opacity = isFuture ? '0.35' : '1';
      div.title = key;
      grid.appendChild(div);
    }
  }
}

function renderEngTips() {
  // Daily tip — rotates by day of year
  const doy = Math.floor((new Date() - new Date(new Date().getFullYear(),0,0)) / 86400000);
  const tip  = TIPS_POOL[doy % TIPS_POOL.length];
  const tipEl = document.getElementById('eng-tip-of-day');
  if (tipEl) {
    tipEl.innerHTML = `
      <div class="eng-tip-label">💡 Tip Hari Ini · ${tip.cat}</div>
      <div class="eng-tip-text">${tip.text}</div>
      <div class="eng-tip-sub">${tip.sub}</div>
    `;
  }

  // Phrases — show 6 random ones based on day
  const phraseEl = document.getElementById('eng-phrases');
  if (phraseEl) {
    const shuffled = [...PHRASES].sort((a,b) => {
      const seed = doy * 7;
      return (PHRASES.indexOf(a) * 31 + seed) % 100 - (PHRASES.indexOf(b) * 17 + seed) % 100;
    }).slice(0, 6);
    phraseEl.innerHTML = shuffled.map(p => `
      <div class="eng-phrase-item">
        <div class="eng-phrase-en">${p.en}</div>
        <div class="eng-phrase-id">${p.id}</div>
        <div class="eng-phrase-context">📌 ${p.ctx}</div>
      </div>
    `).join('');
  }
}

window.showEngTab = function(tab, btn) {
  document.querySelectorAll('.eng-sub-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.eng-tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('eng-tab-'+tab)?.classList.add('active');
  if (tab === 'progress') renderEngProgress(
    (getEngData().dates || {}), new Date().toISOString().slice(0,10)
  );
  if (tab === 'tips') renderEngTips();
};

window.saveEngStreak = function() {
  const todayKey = new Date().toISOString().slice(0,10);
  const todayId  = getTodayDayId();
  const raw      = getEngData();
  const dates    = raw.dates   || {};
  const bySkill  = raw.bySkill || {};
  let   totalXP  = raw.totalXP || 0;

  const wasOff   = !dates[todayKey];
  dates[todayKey] = wasOff;   // toggle

  if (wasOff) {
    // Adding XP
    totalXP += ENG_SCHEDULE[todayId]?.xp || 10;
    bySkill[todayId] = (bySkill[todayId] || 0) + 1;
  } else {
    // Removing XP
    totalXP = Math.max(0, totalXP - (ENG_SCHEDULE[todayId]?.xp || 10));
    bySkill[todayId] = Math.max(0, (bySkill[todayId] || 1) - 1);
  }

  saveEngData({ dates, totalXP, bySkill });
  initEnglish();
};

window.resetEngWeek = function() {
  if (!confirm('Reset data minggu ini?')) return;
  const raw    = getEngData();
  const dates  = raw.dates || {};
  getWeekDates().forEach(d => { delete dates[d]; });
  saveEngData({ ...raw, dates });
  initEnglish();
};

window.resetEngAll = function() {
  if (!confirm('Hapus SEMUA data streak English? Ini tidak bisa dibatalkan.')) return;
  localStorage.removeItem(ENG_KEY);
  initEnglish();
};

/* ================================================
   MINDSET HARIAN — Keluarga tab
   Rotasi harian + refresh manual
   ================================================ */
const MINDSET_LIST = [
  { cat:'Keluarga', old:'Nanti saja ngurusin anak kalau sudah tidak capek.', baru:'Hadir 30 menit penuh sekarang lebih berharga dari 3 jam sambil main HP.', quote:'❤️' },
  { cat:'Keluarga', old:'Salma pasti mengerti kalau aku sibuk.', baru:'Jumat malam adalah tanggal — jadikan prioritas, bukan kalau sempat.', quote:'💑' },
  { cat:'Produktivitas', old:'Scroll dulu, baru kerja.', baru:'Kerja dulu 45 menit, scroll boleh 10 menit sebagai reward.', quote:'⚡' },
  { cat:'Ibadah', old:'Sholat nanti saja setelah selesai ini.', baru:'Sholat di awal waktu = energi dan berkah untuk semua yang sesudahnya.', quote:'🌙' },
  { cat:'Kesehatan', old:'Olahraga besok saja, hari ini capek.', baru:'20 menit workout = stamina lebih baik untuk keluarga & kerja seharian.', quote:'💪' },
  { cat:'Bisnis', old:'Cek toko kalau ada waktu luang.', baru:'30 menit terfokus pada toko = lebih produktif dari 3 jam sambil terdistraksi.', quote:'🏪' },
  { cat:'Growth', old:'Nanti belajar Inggris kalau sudah ada waktu.', baru:'20 menit tiap hari = fluent dalam 1–2 tahun. Tidak ada waktu = tidak ada kemajuan.', quote:'📚' },
  { cat:'Ayah', old:'Anak masih kecil, nanti juga dekat sendiri.', baru:'Kelekatan (attachment) dibangun dari 0–5 tahun. Waktu itu sekarang.', quote:'👨‍👦' },
  { cat:'Mindfulness', old:'Istirahat artinya rebahan sambil scroll.', baru:'Istirahat sejati = meletakkan HP, lakukan satu hal, atau tidak melakukan apa-apa.', quote:'🧘' },
  { cat:'Keluarga', old:'Nanti ada waktu liburan kalau ada uang lebih.', baru:'Alun-alun Kediri gratis. Anak butuh kehadiranmu, bukan destinasinya.', quote:'🌳' },
  { cat:'Finansial', old:'Belanja dulu, menabung dari sisanya.', baru:'Tabung dulu 20%, belanja dari sisanya. Urutan itu yang mengubah segalanya.', quote:'💰' },
  { cat:'Produktivitas', old:'Multi-tasking biar lebih cepat selesai.', baru:'Single-tasking = hasil 2× lebih baik dengan waktu 2× lebih cepat.', quote:'🎯' },
  { cat:'Ayah', old:'Anak baik-baik saja ditinggal sebentar pakai gadget.', baru:'Gadget adalah pengasuh terburuk. 40 menit focus play > 4 jam gadget.', quote:'👦' },
  { cat:'Growth', old:'Sudah cukup ilmu mengajar dari pengalaman.', baru:'Guru terbaik adalah murid seumur hidup. Apa yang kamu pelajari minggu ini?', quote:'🎓' },
  { cat:'Ibadah', old:'Sedekah nanti kalau sudah banyak rezekinya.', baru:'Sedekah membuka rezeki, bukan sebaliknya. Mulai dari yang kecil, rutin.', quote:'🤲' },
  { cat:'Kesehatan', old:'Tidur itu menyia-nyiakan waktu produktif.', baru:'Tidur 7–8 jam = decision making lebih baik, emosi lebih stabil, lebih sabar ke keluarga.', quote:'😴' },
  { cat:'Keluarga', old:'Istri sudah mengerti kalau aku lelah pulang kerja.', baru:'\'Aku capek\' bukan alasan — \'aku pilih hadir meski capek\' adalah karakter.', quote:'💪' },
  { cat:'Bisnis', old:'Toko jalan sendiri, tidak perlu evaluasi rutin.', baru:'Evaluasi mingguan 30 menit Sabtu = tren masalah ketahuan sebelum jadi krisis.', quote:'📊' },
  { cat:'Growth', old:'Saya bukan tipe orang yang bisa bahasa Inggris.', baru:'Bahasa Inggris adalah skill, bukan bakat. Dilatih tiap hari, pasti bisa.', quote:'🌏' },
  { cat:'Mindfulness', old:'Buka HP dulu di pagi hari untuk cek notifikasi.', baru:'Mulai hari dengan dzikir & tilawah — atur agenda, jangan diatur notifikasi.', quote:'🌅' },
  { cat:'Produktivitas', old:'Kalau mood bagus baru produktif.', baru:'Produktivitas adalah disiplin, bukan menunggu mood. Action dulu, mood menyusul.', quote:'🔥' },
  { cat:'Ayah', old:'Anak laki-laki tidak perlu terlalu dimanja.', baru:'Kasih sayang dari ayah membentuk rasa aman yang menjadi fondasi kepercayaan dirinya seumur hidup.', quote:'🏡' },
];

let mindsetManualIdx = -1; // -1 berarti gunakan rotasi harian

function getMindsetIdx() {
  if (mindsetManualIdx >= 0) return mindsetManualIdx;
  // Rotasi berdasarkan hari (berubah tiap hari, bukan random setiap refresh)
  const doy = Math.floor((new Date() - new Date(new Date().getFullYear(),0,0)) / 86400000);
  return doy % MINDSET_LIST.length;
}

function renderMindset() {
  const idx  = getMindsetIdx();
  const m    = MINDSET_LIST[idx];
  const el   = document.getElementById('mindset-content');
  const ctr  = document.getElementById('mindset-counter');
  if (!el) return;
  el.innerHTML = `
    <div class="mindset-old">❌ <em>"${m.old}"</em></div>
    <div class="mindset-new">
      <div class="mindset-quote">${m.quote}</div>
      <div class="mindset-category">${m.cat}</div>
      <em>"${m.baru}"</em>
    </div>
  `;
  if (ctr) ctr.textContent = `${idx+1} / ${MINDSET_LIST.length}`;
}

window.refreshMindset = function() {
  const cur = getMindsetIdx();
  mindsetManualIdx = (cur + 1) % MINDSET_LIST.length;
  renderMindset();
};

/* ================================================
   Override showView — init all sub-views
   ================================================ */
const _origShowView2 = window.showView;
window.showView = function(id) {
  _origShowView2(id);
  if (id === 'today')    setTimeout(initHariIni, 50);
  if (id === 'english')  setTimeout(initEnglish, 50);
  if (id === 'keluarga') setTimeout(renderMindset, 50);
};

// Auto-update Hari Ini stat clock every minute
setInterval(() => {
  const panel = document.getElementById('view-today');
  if (panel && panel.classList.contains('active')) {
    const now = new Date();
    const el  = document.getElementById('d-stat-jam');
    if (el) el.textContent = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  }
}, 60000);

// Init mindset on page load (for keluarga tab default state)
document.addEventListener('DOMContentLoaded', () => {
  renderMindset();
});
