/* ============================================
   JADWAL KELUARGA — script.js (FIXED)
   Bug fixes:
   1. PIN system unified — removed duplicate inline PIN, uses class-based unlock
   2. showDay() scoped to suami column only (tidak tabrakan dengan day-panel lain)
   3. pinBackspace alias added for backward compat with any remaining pinDel() calls
   ============================================ */

(function () {
  const PIN_CODE    = '111213'; // Ganti PIN di sini
  const STORAGE_KEY = 'jk_pin_unlock';
  const REMEMBER_MS = 12 * 60 * 60 * 1000; // 12 jam
  let enteredPin    = '';

  function getDots() { return document.querySelectorAll('#pin-dots .pin-dot'); }

  function refreshDots() {
    getDots().forEach((dot, i) => {
      dot.classList.toggle('filled', i < enteredPin.length);
      dot.classList.remove('error');
    });
  }

  function showError(msg) {
    const errEl = document.getElementById('pin-error');
    const box   = document.getElementById('pin-lock-box');
    if (errEl) errEl.textContent = msg;
    if (box) {
      box.classList.add('shake');
      setTimeout(() => box.classList.remove('shake'), 400);
    }
  }

  function unlockApp() {
    document.body.classList.add('app-unlocked');
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch(e) {}
    const screen = document.querySelector('.pin-lock-screen');
    if (screen) {
      screen.style.opacity = '0';
      screen.style.transition = 'opacity 0.35s ease';
      setTimeout(() => { screen.style.display = 'none'; }, 380);
    }
  }

  function isRemembered() {
    try {
      const ts = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
      return ts && (Date.now() - ts < REMEMBER_MS);
    } catch(e) { return false; }
  }

  function checkPin() {
    if (enteredPin === PIN_CODE) {
      const errEl = document.getElementById('pin-error');
      if (errEl) errEl.textContent = '';
      unlockApp();
    } else {
      showError('PIN salah, coba lagi');
      getDots().forEach(d => d.classList.add('error'));
      enteredPin = '';
      setTimeout(refreshDots, 600);
    }
  }

  window.pinPress = function(digit) {
    if (document.body.classList.contains('app-unlocked')) return;
    if (enteredPin.length >= 6) return;
    enteredPin += digit;
    refreshDots();
    if (enteredPin.length === 6) setTimeout(checkPin, 140);
  };

  // FIX #2: Expose both names (HTML uses pinDel, JS defined pinBackspace)
  window.pinBackspace = function() {
    enteredPin = enteredPin.slice(0, -1);
    refreshDots();
    const errEl = document.getElementById('pin-error');
    if (errEl) errEl.textContent = '';
  };
  window.pinDel = window.pinBackspace; // alias agar tombol ⌫ di HTML tetap berfungsi

  document.addEventListener('DOMContentLoaded', function() {
    if (isRemembered()) {
      unlockApp();
      return;
    }
    // Keyboard support
    document.addEventListener('keydown', function(e) {
      if (document.body.classList.contains('app-unlocked')) return;
      if (e.key >= '0' && e.key <= '9') window.pinPress(e.key);
      else if (e.key === 'Backspace') window.pinBackspace();
    });
  });
})();

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
   ENGLISH LEARNING TRACKER
   ================================================ */
const ENG_KEY = 'eng_streak_v2';

function getEngData() {
  try { return JSON.parse(localStorage.getItem(ENG_KEY) || '{}'); } catch { return {}; }
}
function saveEngData(d) {
  try { localStorage.setItem(ENG_KEY, JSON.stringify(d)); } catch{}
}

function initEnglish() {
  const data  = getEngData();
  const week  = getWeekDaysStr();
  const today = new Date().toISOString().slice(0,10);

  // Count done this week
  const doneDays = week.filter(d => data[d]);
  const streak   = doneDays.length;

  const numEl   = document.getElementById('eng-streak');
  const lblEl   = document.getElementById('eng-streak-lbl');
  const dotsEl  = document.getElementById('eng-week-dots');
  const badgeEl = document.getElementById('eng-badge');

  if (numEl)   numEl.textContent   = streak;
  if (lblEl)   lblEl.textContent   = streak === 0 ? 'hari · Mulai hari ini!' : `hari minggu ini · ${streak >= 5 ? 'Luar biasa! 🔥' : 'Terus semangat!'}`;
  if (badgeEl) badgeEl.textContent = streak >= 6 ? '🏆' : streak >= 4 ? '🔥' : streak >= 2 ? '⭐' : '🌱';

  if (dotsEl) {
    dotsEl.innerHTML = '';
    week.forEach(d => {
      const dot = document.createElement('div');
      dot.className = 'eng-week-dot' + (data[d] ? ' done' : '');
      dot.title = d;
      dotsEl.appendChild(dot);
    });
  }
}

function getWeekDaysStr() {
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

window.saveEngStreak = function() {
  const today = new Date().toISOString().slice(0,10);
  const data  = getEngData();
  data[today] = !data[today]; // toggle
  saveEngData(data);
  initEnglish();
  const btn = document.querySelector('[onclick="saveEngStreak()"]');
  if (btn) {
    const data2 = getEngData();
    btn.textContent = data2[today] ? '✅ Sudah ditandai!' : '☐ Tandai Hari Ini Selesai';
    if (data2[today]) btn.style.background = 'linear-gradient(135deg,#16a34a,#22c55e)';
    else btn.style.background = '';
  }
};

window.resetEngWeek = function() {
  const week = getWeekDaysStr();
  const data = getEngData();
  week.forEach(d => delete data[d]);
  saveEngData(data);
  initEnglish();
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
