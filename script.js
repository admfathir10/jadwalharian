/* ============================================
   PIN LOCK — proteksi privasi keluarga
   ============================================
   GANTI PIN DI BAWAH INI dengan 6 digit pilihanmu.
   Ini bukan enkripsi tingkat bank (situs statis di GitHub Pages
   memang tidak bisa 100% aman dari orang yang sengaja membuka kode
   sumbernya) — tapi cukup untuk mencegah orang random yang menemukan
   link ini iseng buka dan lihat jadwal/data keluarga kalian.
   ============================================ */
(function () {
  const PIN_CODE = '111213';            // <-- GANTI PIN 6 digit di sini
  const REMEMBER_DAYS = 0;             // berapa hari device ini tetap "ingat" login

  const STORAGE_KEY = 'jk_pin_unlock';
  let enteredPin = '';

  function getDots() { return document.querySelectorAll('#pin-dots .pin-dot'); }

  function refreshDots() {
    const dots = getDots();
    dots.forEach((dot, i) => dot.classList.toggle('filled', i < enteredPin.length));
  }

  function showError(msg) {
    const errEl = document.getElementById('pin-error');
    const box = document.getElementById('pin-lock-box');
    if (errEl) errEl.textContent = msg;
    if (box) {
      box.classList.add('shake');
      setTimeout(() => box.classList.remove('shake'), 400);
    }
  }

  function unlockApp(remember) {
    document.body.classList.add('app-unlocked');
    if (remember) {
      const expires = Date.now() + REMEMBER_DAYS * 24 * 60 * 60 * 1000;
      try { localStorage.setItem(STORAGE_KEY, String(expires)); } catch (e) {}
    }
  }

  function isRemembered() {
    try {
      const expires = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
      return expires > Date.now();
    } catch (e) { return false; }
  }

  function checkPin() {
    if (enteredPin === PIN_CODE) {
      document.getElementById('pin-error').textContent = '';
      unlockApp(true);
    } else {
      showError('PIN salah, coba lagi');
      enteredPin = '';
      refreshDots();
    }
  }

  window.pinPress = function (digit) {
    if (enteredPin.length >= 6) return;
    enteredPin += digit;
    refreshDots();
    if (enteredPin.length === 6) {
      setTimeout(checkPin, 120);
    }
  };

  window.pinBackspace = function () {
    enteredPin = enteredPin.slice(0, -1);
    refreshDots();
    document.getElementById('pin-error').textContent = '';
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (isRemembered()) {
      unlockApp(false);
      return;
    }
    // Dukungan keyboard fisik (angka 0-9 dan backspace)
    document.addEventListener('keydown', function (e) {
      if (document.body.classList.contains('app-unlocked')) return;
      if (e.key >= '0' && e.key <= '9') window.pinPress(e.key);
      else if (e.key === 'Backspace') window.pinBackspace();
    });
  });
})();

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
    // Panggil setelah db siap — pakai setTimeout 0 agar tidak race condition
    setTimeout(initMenuFirebase, 0);

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
   Firebase realtime sync (pakai db yang sama dengan Todo)
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

/* State */
let weekOffset = 0;
let menuData   = {};   // { "2026-07-14": { sarapan:["Nasi Goreng","Telur Dadar"], siang:[], malam:[] } }
let bahanData  = {};   // { "Beras": true/false/undefined }
let activeSlot = null; // { dk, slot, menuIndex } — menuIndex = index dalam array menu (0/1/2)

/* Firebase refs untuk menu & bahan */
let menuRef  = null;
let bahanRef = null;
let menuFirebaseReady = false;

/* Encode nama bahan jadi Firebase-safe key — konsisten saat simpan & baca */
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

/* Dipanggil setelah Firebase db siap */
function initMenuFirebase() {
  if (!db) { initMenuLocal(); return; }
  try {
    menuRef  = db.ref('menu');
    bahanRef = db.ref('bahan');

    /* Listen menu realtime — format: { "2026-07-14": { sarapan:["Menu1","Menu2"], siang:[], malam:[] } }
       Migrasi otomatis dari format string lama ke array */
    menuRef.on('value', snap => {
      const raw = snap.val() || {};
      menuData = {};
      Object.entries(raw).forEach(([dk, slots]) => {
        menuData[dk] = {};
        SLOTS.forEach(s => {
          const v = slots[s];
          if (!v) menuData[dk][s] = [];
          else if (Array.isArray(v)) menuData[dk][s] = v.filter(Boolean);
          else if (typeof v === 'string' && v !== '') menuData[dk][s] = [v]; // format lama
          else menuData[dk][s] = [];
        });
      });
      renderMenuGrid();
    }, () => initMenuLocal());

    /* Listen bahan realtime — format: { "Beras": true/false/null } dengan key encoded */
    bahanRef.on('value', snap => {
      const raw = snap.val() || {};
      /* Decode balik: key encoded → nama asli */
      bahanData = {};
      /* Simpan dengan nama asli sebagai key untuk lookup mudah */
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
    // Migrasi format string lama → array
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

/* Save helpers */
/* Ambil array menu untuk slot (selalu array, max 3) */
function getMenuArray(dk, slot) {
  const val = menuData[dk]?.[slot];
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(v => v && v !== '');
  if (typeof val === 'string' && val !== '') return [val]; // migrasi format lama
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

/* Tambah satu menu ke slot */
function addMenuToSlot(dk, slot, menu) {
  const arr = getMenuArray(dk, slot);
  if (arr.length >= MAX_MENU_PER_SLOT) return;
  if (!arr.includes(menu)) arr.push(menu);
  saveMenuSlot(dk, slot, arr);
}

/* Hapus menu pada index tertentu dari slot */
function removeMenuFromSlot(dk, slot, idx) {
  const arr = getMenuArray(dk, slot);
  arr.splice(idx, 1);
  saveMenuSlot(dk, slot, arr);
}

/* Ganti menu pada index tertentu */
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

/* ── Week helpers ── */
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
  if (el) el.textContent = weekOffset === 0 ? `Minggu ini \xb7 ${f} \u2013 ${l}` : `${f} \u2013 ${l}`;
}

window.shiftWeek = function(dir) { weekOffset += dir; renderMenuGrid(); };
window.resetWeek = function()    { weekOffset  = 0;   renderMenuGrid(); };

/* ── Render grid ── */
function renderMenuGrid() {
  updateWeekLabel();
  const grid = document.getElementById('menu-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const today = todayKey2();
  const dayNames = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];

  getWeekDays(weekOffset).forEach(d => {
    const dk     = dateKey(d);
    const idx    = d.getDay() === 0 ? 6 : d.getDay()-1;
    const card   = document.createElement('div');
    card.className = 'menu-day-card' + (dk === today ? ' today' : '');
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

/* ── Modal ── */
window.openMenuModal = function(dk, slot, menuIndex) {
  activeSlot = { dk, slot, menuIndex: menuIndex ?? 0 };
  const ov   = document.getElementById('menu-modal');
  const bln  = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
  const d    = new Date(dk+'T00:00:00');
  const names= { sarapan:'Sarapan', siang:'Makan Siang', malam:'Makan Malam' };
  const arr  = getMenuArray(dk, slot);
  const isEdit = menuIndex < arr.length;
  const menuNum = arr.length > 0 ? ` (Menu ${(menuIndex ?? arr.length) + 1})` : '';
  document.getElementById('modal-title').textContent = `${names[slot]}${menuNum} \xb7 ${d.getDate()} ${bln[d.getMonth()]}`;
  document.getElementById('modal-search').value = '';
  ov.classList.add('open');
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
  const arr = activeSlot ? getMenuArray(activeSlot.dk, activeSlot.slot) : [];
  const curMenu = activeSlot && activeSlot.menuIndex < arr.length ? arr[activeSlot.menuIndex] : '';
  const filtered = DAFTAR_MENU.filter(m => m.toLowerCase().includes(q.toLowerCase()));
  document.getElementById('modal-list').innerHTML = filtered.map(m => {
    const isCur = m === curMenu;
    const isOther = arr.includes(m) && !isCur;
    return `<div class="menu-option ${isCur?'selected':''} ${isOther?'already-picked':''}" onclick="selectMenu('${escMH(m)}')">${escMH(m)}${isOther?' ✓':''}</div>`;
  }).join('');
}

window.selectMenu = function(menu) {
  if (!activeSlot) return;
  const { dk, slot, menuIndex } = activeSlot;
  const arr = getMenuArray(dk, slot);
  if (menuIndex < arr.length) {
    // Edit menu yang sudah ada
    replaceMenuInSlot(dk, slot, menuIndex, menu);
  } else {
    // Tambah menu baru
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
    // Hapus hanya menu pada index ini
    removeMenuFromSlot(dk, slot, menuIndex);
  } else {
    // Kosongkan semua
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

/* ── Bahan stok ── */
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
      /* bahanData selalu pakai nama asli sebagai key (decode sudah dilakukan saat listen) */
      const val = bahanData[nama];
      const cls = val === true ? 'ada' : val === false ? 'habis' : '';
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
  if (cur === undefined || cur === null) { next = true;      el.className = 'bahan-pill ada';   }
  else if (cur === true)                 { next = false;     el.className = 'bahan-pill habis'; }
  else                                   { next = undefined; el.className = 'bahan-pill';       }
  bahanData[nama] = next;
  saveBahanItem(nama, next);
}

window.setAllBahan = function(status) { saveAllBahan(status); };

/* ── Init ── */
function initMenu() {
  if (menuFirebaseReady) {
    /* sudah listen realtime, render ulang saja */
    renderMenuGrid();
    renderBahanGrid();
  } else {
    initMenuLocal();
  }
}

/* Override showView untuk trigger initMenu */
const _origShowView = window.showView;
window.showView = function(id) {
  _origShowView(id);
  if (id === 'menu') initMenu();
};
