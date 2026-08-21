/* ============================================
   JADWAL KELUARGA — script.js (Firebase Sync)
   ============================================

   SETUP (sekali saja, 3 menit):
   1. Buka https://console.firebase.google.com
   2. Create project → nama bebas (mis. jadwal-keluarga)
   3. Build → Realtime Database → Create Database
      → pilih Singapore → Start in test mode
   4. Salin URL database (bentuknya:
      https://nama-project-default-rtdb.asia-southeast1.firebasedatabase.app)
   5. Tempel di DATABASE_URL di bawah ini, lalu upload ulang script.js

   ============================================ */

const DATABASE_URL = 'https://jadwal-keluarga-17b86-default-rtdb.asia-southeast1.firebasedatabase.app/';
// Contoh: 'https://jadwal-keluarga-abc12-default-rtdb.asia-southeast1.firebasedatabase.app'

/* ─── Firebase init ─── */
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
    const app = firebase.initializeApp({
      databaseURL: DATABASE_URL
    });
    db       = firebase.database(app);
    todosRef = db.ref('todos');

    // Deteksi online/offline
    db.ref('.info/connected').on('value', snap => {
      if (snap.val()) {
        setSyncStatus('connected', 'Tersync ✓');
      } else {
        setSyncStatus('offline', 'Offline — data lokal');
      }
    });

    // Listen realtime
    todosRef.on('value', snap => {
      const raw = snap.val();
      todos = raw ? Object.entries(raw).map(([fbKey, v]) => ({ ...v, fbKey })) : [];
      renderTodos();
    }, err => {
      setSyncStatus('error', 'Gagal: ' + err.code);
      loadFromLocal();
    });

    isFirebaseReady = true;

  } catch (e) {
    setSyncStatus('error', 'Error Firebase');
    console.error(e);
    loadFromLocal();
  }
}

/* ─── Sync status indicator ─── */
function setSyncStatus(state, msg) {
  const dot  = document.getElementById('sync-dot');
  const text = document.getElementById('sync-text');
  if (!dot || !text) return;
  dot.className = 'sync-dot ' + state;
  text.textContent = msg;
}

/* ─── Fallback localStorage ─── */
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

/* ========================
   CRUD — Firebase-aware
   ======================== */
window.addTodo = function () {
  const input    = document.getElementById('todo-input');
  const dlInput  = document.getElementById('todo-deadline');
  const text     = input.value.trim();
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
    // Firebase: push lalu biarkan listener yang update todos[]
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

window.toggleTodo = function (id) {
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

window.deleteTodo = function (id) {
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

window.clearDone = function () {
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

/* ========================
   Who / Filter
   ======================== */
window.setWho = function (who, btn) {
  activeWho = who;
  document.querySelectorAll('.who-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
};

window.setFilter = function (filter, btn) {
  activeFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTodos();
};

/* ========================
   Date helpers
   ======================== */
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
  const sameDay = d.getDate()    === now.getDate() &&
                  d.getMonth()   === now.getMonth() &&
                  d.getFullYear() === now.getFullYear();
  if (sameDay) return `${hh}:${mm}`;
  const hari = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'][d.getDay()];
  return `${hari} ${d.getDate()}/${d.getMonth()+1} ${hh}:${mm}`;
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ========================
   Render
   ======================== */
function renderTodos() {
  const list  = document.getElementById('todo-list');
  const empty = document.getElementById('todo-empty');
  if (!list) return;

  list.querySelectorAll('.todo-item').forEach(el => el.remove());

  const today = todayStr();
  let filtered = [...todos];

  switch (activeFilter) {
    case 'selesai':
      filtered = filtered.filter(t => t.done); break;
    case 'hari-ini':
      filtered = filtered.filter(t => !t.done && t.deadline === today); break;
    case 'terlambat':
      filtered = filtered.filter(t => !t.done && t.deadline && t.deadline < today); break;
    case 'suami': case 'istri': case 'bersama':
      filtered = filtered.filter(t => t.who === activeFilter && !t.done); break;
  }

  const rank = t => {
    if (t.done) return 99;
    const s = deadlineStatus(t.deadline);
    return s === 'lewat' ? 0 : s === 'hari-ini' ? 1 : s === 'besok' ? 2 : s === 'mendatang' ? 3 : 4;
  };

  filtered.sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    return b.createdAt - a.createdAt;
  });

  if (filtered.length === 0) {
    if (empty) empty.style.display = 'flex';
    return;
  }
  if (empty) empty.style.display = 'none';

  filtered.forEach(item => list.appendChild(buildTodoEl(item)));
}

function buildTodoEl(item) {
  const div = document.createElement('div');
  const ds  = deadlineStatus(item.deadline);
  div.className = 'todo-item'
    + (item.done                  ? ' done'    : '')
    + (!item.done && ds==='lewat' ? ' overdue' : '')
    + (!item.done && ds==='hari-ini' ? ' today' : '');
  div.setAttribute('data-who', item.who);

  const whoLabel = { suami:'Fathir', istri:'Salma', bersama:'Bersama' };
  const tagClass = { suami:'tag-suami', istri:'tag-istri', bersama:'tag-bersama' };

  let dlBadge = '';
  if (item.deadline && !item.done) {
    const lbl = fmtDeadline(item.deadline);
    const cls = ds==='lewat' ? 'dl-overdue' : ds==='hari-ini' ? 'dl-today' : ds==='besok' ? 'dl-soon' : 'dl-future';
    const ico = ds==='lewat' ? '⚠️' : ds==='hari-ini' ? '📅' : ds==='besok' ? '🔔' : '🗓️';
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
        ${item.done && item.doneAt ? `<span class="todo-done-at">✓ selesai ${fmtTime(item.doneAt)}</span>` : ''}
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
  document.getElementById('view-'+id).classList.add('active');
  document.getElementById('mtab-'+id).classList.add('active');
};

window.showDay = function(day, btn) {
  document.querySelectorAll('.day-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.day-tabs button').forEach(b => b.classList.remove('active'));
  document.getElementById('day-'+day).classList.add('active');
  btn.classList.add('active');
  highlightLiveBlocks();
};

window.showIstri = function(id, btn) {
  document.querySelectorAll('.istri-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.istri-tabs button').forEach(b => b.classList.remove('active'));
  document.getElementById('istri-'+id).classList.add('active');
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
  const btn    = document.querySelector(`.day-tabs button[data-day="${hariId}"]`);
  if (btn) {
    document.querySelectorAll('.day-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.day-tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById('day-'+hariId)?.classList.add('active');
    btn.classList.add('active');
  }
  const isWE = today===0||today===6;
  const ib   = document.querySelectorAll('.istri-tabs button');
  document.querySelectorAll('.istri-panel').forEach(p => p.classList.remove('active'));
  ib.forEach(b => b.classList.remove('active'));
  if (isWE) { document.getElementById('istri-weekend')?.classList.add('active'); ib[1]?.classList.add('active'); }
  else       { document.getElementById('istri-kerja')?.classList.add('active');   ib[0]?.classList.add('active'); }
}

/* ========================
   Clock & date badge inject
   ======================== */
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
  initFirebase(); // akan fallback ke localStorage jika DATABASE_URL belum diisi
  setInterval(updateClock, 1000);
  setInterval(highlightLiveBlocks, 30000);
});

/* ================================================
   MENU MASAKAN — Week planner + Stok Bahan
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
  "🍚 Bahan Pokok": [
    "Beras","Telur","Tempe","Tahu","Ayam","Daging sapi",
    "Lele","Udang","Ikan pindang","Sardine kaleng","Jagung",
    "Tepung terigu","Tepung tapioka","Tepung beras"
  ],
  "🥬 Sayuran": [
    "Kangkung","Bayam","Wortel","Kol/Kubis","Brokoli","Labu siam",
    "Daun pepaya","Terong","Daun bawang","Seledri","Tomat","Timun",
    "Kacang panjang","Tauge","Buncis","Sawi","Kentang","Daun melinjo","Daun singkong"
  ],
  "🧄 Bumbu Dasar": [
    "Bawang merah","Bawang putih","Bawang bombay","Cabai kecil","Cabai merah","Cabai rawit","Kemiri",
    "Ketumbar","Merica/Lada","Kunyit","Jahe","Lengkuas","Kencur",
    "Serai","Daun salam","Daun jeruk","Daun kunyit","Daun bawang",
    "Garam","Gula pasir","Gula merah","Kaldu bubuk","Minyak goreng"
  ],
  "🥣 Bahan Pelengkap": [
    "Kecap manis","Saus tiram","Santan","Air asam jawa","Asam jawa","Saus tomat",
    "Terasi","Tepung bumbu","Tepung panir","Jeruk nipis","Jeruk limau","Minyak goreng"
  ]
};

const MENU_KEY  = 'menu_mingguan_v2';
const BAHAN_KEY = 'stok_bahan_v2';
const SLOTS     = ['sarapan','siang','malam'];
const SLOT_LABEL= { sarapan:'🌅 Sarapan', siang:'☀️ Makan Siang', malam:'🌙 Makan Malam' };
const HARI_ID   = ['minggu','senin','selasa','rabu','kamis','jumat','sabtu'];
const HARI_LONG = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

/* State */
let weekOffset   = 0;   // 0 = minggu ini, -1 = minggu lalu, dst
let menuData     = {};  // { "2026-07-14": { sarapan:"Nasi Goreng", siang:"", malam:"" } }
let bahanData    = {};  // { "Beras": true/false }
let activeSlot   = null; // { dateKey, slot }

/* ── Storage ── */
function loadMenuData()  { try { return JSON.parse(localStorage.getItem(MENU_KEY)  || '{}'); } catch { return {}; } }
function saveMenuData()  { localStorage.setItem(MENU_KEY,  JSON.stringify(menuData));  }
function loadBahanData() { try { return JSON.parse(localStorage.getItem(BAHAN_KEY) || '{}'); } catch { return {}; } }
function saveBahanData() { localStorage.setItem(BAHAN_KEY, JSON.stringify(bahanData)); }

/* ── Week helpers ── */
function getMondayOf(offset) {
  const d = new Date();
  const day = d.getDay(); // 0=sun
  const diff = (day === 0 ? -6 : 1 - day); // ke Senin
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
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d;
  });
}

/* ── Week label ── */
function updateWeekLabel() {
  const days = getWeekDays(weekOffset);
  const first = days[0], last = days[6];
  const bln = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
  const f = `${first.getDate()} ${bln[first.getMonth()]}`;
  const l = `${last.getDate()} ${bln[last.getMonth()]} ${last.getFullYear()}`;
  const lbl = document.getElementById('week-label');
  if (lbl) lbl.textContent = weekOffset === 0 ? `Minggu ini · ${f} – ${l}` : `${f} – ${l}`;
}

window.shiftWeek = function(dir) { weekOffset += dir; renderMenuGrid(); };
window.resetWeek = function()    { weekOffset = 0;    renderMenuGrid(); };

/* ── Render 7 kolom ── */
function renderMenuGrid() {
  updateWeekLabel();
  const grid = document.getElementById('menu-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const today  = todayKey2();
  const days   = getWeekDays(weekOffset);

  // Urutan: Senin(idx1)..Minggu(idx0)
  const ordered = [days[0],days[1],days[2],days[3],days[4],days[5],days[6]];
  // hari senin=idx0 dalam array getWeekDays

  ordered.forEach((d, i) => {
    const dk    = dateKey(d);
    const dayIdx = (d.getDay() === 0 ? 6 : d.getDay() - 1); // 0=Sen..6=Min
    const isToday = dk === today;
    const dayNames = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];

    const card = document.createElement('div');
    card.className = 'menu-day-card' + (isToday ? ' today' : '');
    card.innerHTML = `
      <div class="menu-day-label">
        ${dayNames[dayIdx]}
        <span class="menu-day-date">${d.getDate()}/${d.getMonth()+1}</span>
      </div>
      <div class="menu-slots">
        ${SLOTS.map(slot => buildSlotHTML(dk, slot)).join('')}
      </div>
    `;
    grid.appendChild(card);
  });
}

function buildSlotHTML(dk, slot) {
  const val = menuData[dk]?.[slot] || '';
  const filled = val !== '';
  return `
    <div class="menu-slot ${filled ? 'filled' : ''}" onclick="openMenuModal('${dk}','${slot}')">
      <div class="slot-label ${slot}">${SLOT_LABEL[slot]}</div>
      ${filled
        ? `<div class="slot-menu">${escMenuHtml(val)}</div>`
        : `<div class="slot-empty">+ pilih menu</div>`
      }
      <span class="slot-edit-icon">✏️</span>
    </div>`;
}

function escMenuHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ── Modal ── */
window.openMenuModal = function(dk, slot) {
  activeSlot = { dk, slot };
  const overlay = document.getElementById('menu-modal');
  const title   = document.getElementById('modal-title');
  const search  = document.getElementById('modal-search');
  if (!overlay) return;

  const slotNames = { sarapan:'Sarapan', siang:'Makan Siang', malam:'Makan Malam' };
  const d = new Date(dk + 'T00:00:00');
  const bln = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
  title.textContent = `${slotNames[slot]} · ${d.getDate()} ${bln[d.getMonth()]}`;

  search.value = '';
  overlay.classList.add('open');
  search.focus();
  renderModalList('');
};

window.closeMenuModal = function(e) {
  if (!e || e.target === document.getElementById('menu-modal')) {
    document.getElementById('menu-modal').classList.remove('open');
    activeSlot = null;
  }
};

window.filterMenuModal = function() {
  renderModalList(document.getElementById('modal-search').value);
};

function renderModalList(q) {
  const list    = document.getElementById('modal-list');
  const current = activeSlot ? (menuData[activeSlot.dk]?.[activeSlot.slot] || '') : '';
  const filtered = DAFTAR_MENU.filter(m => m.toLowerCase().includes(q.toLowerCase()));

  list.innerHTML = filtered.map(m => `
    <div class="menu-option ${m === current ? 'selected' : ''}" onclick="selectMenu('${escMenuHtml(m)}')">
      ${escMenuHtml(m)}
    </div>`).join('');
}

window.selectMenu = function(menu) {
  if (!activeSlot) return;
  const { dk, slot } = activeSlot;
  if (!menuData[dk]) menuData[dk] = {};
  menuData[dk][slot] = menu;
  saveMenuData();
  renderMenuGrid();
  document.getElementById('menu-modal').classList.remove('open');
  activeSlot = null;
};

window.clearSlot = function() {
  if (!activeSlot) return;
  const { dk, slot } = activeSlot;
  if (menuData[dk]) menuData[dk][slot] = '';
  saveMenuData();
  renderMenuGrid();
  document.getElementById('menu-modal').classList.remove('open');
  activeSlot = null;
};

/* Keyboard: Esc tutup modal */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.getElementById('menu-modal')?.classList.remove('open');
    activeSlot = null;
  }
});

/* ── Bahan stok ── */
function renderBahanGrid() {
  const grid = document.getElementById('bahan-grid');
  if (!grid) return;
  grid.innerHTML = '';

  Object.entries(DAFTAR_BAHAN).forEach(([kategori, items]) => {
    const group = document.createElement('div');
    group.className = 'bahan-group';
    group.innerHTML = `<div class="bahan-group-label">${kategori}</div><div class="bahan-items" id="bahan-items-${kategori.replace(/\s/g,'_')}"></div>`;
    grid.appendChild(group);

    const container = group.querySelector('.bahan-items');
    items.forEach(nama => {
      const status = bahanData[nama]; // true=ada, false=habis, undefined=belum dicek
      const cls = status === true ? 'ada' : status === false ? 'habis' : '';
      const pill = document.createElement('div');
      pill.className = `bahan-pill ${cls}`;
      pill.setAttribute('data-nama', nama);
      pill.innerHTML = `<span class="bahan-pill-dot"></span>${nama}`;
      pill.onclick = () => toggleBahan(nama, pill);
      container.appendChild(pill);
    });
  });
}

function toggleBahan(nama, el) {
  const cur = bahanData[nama];
  // undefined → ada → habis → undefined (cycle)
  if (cur === undefined || cur === null) {
    bahanData[nama] = true;
    el.className = 'bahan-pill ada';
  } else if (cur === true) {
    bahanData[nama] = false;
    el.className = 'bahan-pill habis';
  } else {
    bahanData[nama] = undefined;
    el.className = 'bahan-pill';
  }
  saveBahanData();
}

window.setAllBahan = function(status) {
  Object.values(DAFTAR_BAHAN).flat().forEach(n => { bahanData[n] = status; });
  saveBahanData();
  renderBahanGrid();
};

/* ── Init menu ── */
function initMenu() {
  menuData  = loadMenuData();
  bahanData = loadBahanData();
  renderMenuGrid();
  renderBahanGrid();
}

/* Panggil initMenu saat view-menu dibuka */
const _origShowView = window.showView;
window.showView = function(id) {
  _origShowView(id);
  if (id === 'menu') initMenu();
};
