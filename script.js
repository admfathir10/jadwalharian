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
  renderEngStreak();
  renderHariIni();
  setInterval(updateClock, 1000);
  setInterval(highlightLiveBlocks, 30000);
  setInterval(renderHariIni, 60000); // update every minute
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
   ENGLISH STREAK — Checklist per hari (3–5 materi)
   ================================================ */

const ENG_STREAK_KEY = 'eng_streak_v2';
const ENG_DAY_LABELS = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];

// Checklist materi per hari (3–5 item)
const ENG_CHECKLIST = {
  // idx 0 = Senin
  0: [
    { id:'a', label:'🎧 Dengarkan Podcast BBC / TED-Ed 20 menit' },
    { id:'b', label:'📝 Catat 3 frasa / kosa kata baru' },
    { id:'c', label:'🃏 Review Anki 10 menit' },
    { id:'d', label:'💬 Ucapkan ulang frasa yang didengar (shadowing singkat)' },
  ],
  // idx 1 = Selasa
  1: [
    { id:'a', label:'✍️ Tulis jurnal / paragraf 150 kata dalam Inggris' },
    { id:'b', label:'📚 Pelajari 1 grammar point hari ini (10 menit)' },
    { id:'c', label:'🃏 Review Anki 10 menit' },
    { id:'d', label:'🔁 Baca ulang tulisan & koreksi sendiri' },
  ],
  // idx 2 = Rabu (hari padat — cukup 3 item ringan)
  2: [
    { id:'a', label:'🃏 Anki 10 menit (di perjalanan / istirahat)' },
    { id:'b', label:'👁️ Baca 1 kalimat Inggris & terjemahkan dalam hati' },
    { id:'c', label:'🔤 Hafal 2 kata baru hari ini' },
  ],
  // idx 3 = Kamis
  3: [
    { id:'a', label:'📖 Baca artikel edukasi / Islam berbahasa Inggris 20 menit' },
    { id:'b', label:'📝 Catat 3–5 vocab baru dari artikel' },
    { id:'c', label:'🃏 Review Anki 10 menit' },
    { id:'d', label:'💡 Buat 1 kalimat sendiri dari vocab baru' },
  ],
  // idx 4 = Jumat
  4: [
    { id:'a', label:'🎙️ Shadowing 1 video / audio Inggris 20 menit' },
    { id:'b', label:'🎤 Rekam monolog sendiri 2 menit — topik bebas' },
    { id:'c', label:'👂 Dengar ulang rekaman & catat kesalahan' },
    { id:'d', label:'🃏 Review Anki + tambah vocab dari rekaman' },
    { id:'e', label:'🗣️ Pronunciation drill — tirukan 5 kalimat dari YouTube' },
  ],
  // idx 5 = Sabtu (bebas & santai)
  5: [
    { id:'a', label:'📺 Nonton YouTube tanpa subtitle 20+ menit' },
    { id:'b', label:'🛍️ Tulis 1 caption produk Artilerianstore dalam Inggris' },
    { id:'c', label:'📝 Catat 3 ekspresi natural yang didengar' },
    { id:'d', label:'🃏 Anki review ringan (opsional)' },
  ],
  // idx 6 = Minggu (istirahat — cukup 3 item ringan)
  6: [
    { id:'a', label:'🃏 Anki review ringan (opsional)' },
    { id:'b', label:'🔁 Review vocab minggu ini — mana yang sudah hafal?' },
    { id:'c', label:'📅 Rencanakan target belajar Inggris minggu depan' },
  ],
};

function getEngData() {
  try {
    const raw = localStorage.getItem(ENG_STREAK_KEY);
    return raw ? JSON.parse(raw) : { checks: {}, days: {} };
  } catch { return { checks: {}, days: {} }; }
}

function saveEngData(data) {
  try { localStorage.setItem(ENG_STREAK_KEY, JSON.stringify(data)); } catch {}
}

function getMondayOfWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function engTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function engTodayIdx() {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

function getEngWeekDays() {
  const mon = new Date(getMondayOfWeek() + 'T00:00:00');
  return Array.from({length: 7}, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
}

// Hitung berapa checklist hari ini sudah selesai
function countTodayChecks() {
  const data    = getEngData();
  const today   = engTodayKey();
  const todayIdx = engTodayIdx();
  const items   = ENG_CHECKLIST[todayIdx] || [];
  const saved   = data.checks[today] || {};
  return { done: items.filter(it => saved[it.id]).length, total: items.length };
}

// Hari dianggap "selesai" jika semua checklist dicentang
function isDayDone(dk, dayIdx) {
  const data  = getEngData();
  const items = ENG_CHECKLIST[dayIdx] || [];
  if (!items.length) return false;
  const saved = data.checks[dk] || {};
  return items.every(it => saved[it.id]);
}

function renderEngStreak() {
  const data     = getEngData();
  const weekDays = getEngWeekDays();
  const todayIdx = engTodayIdx();
  const today    = engTodayKey();

  // Hitung hari selesai minggu ini
  let count = 0;
  weekDays.forEach((dk, i) => { if (isDayDone(dk, i)) count++; });

  // Hitung progres hari ini
  const { done: todayDone, total: todayTotal } = countTodayChecks();

  const badges = ['🌱','🌿','🌳','⭐','🔥','💪','🏆'];
  const badge  = badges[Math.min(count, badges.length - 1)];

  let streakLbl;
  if (todayDone === todayTotal && todayTotal > 0) {
    streakLbl = `hari selesai minggu ini · Hari ini tuntas! 🎉`;
  } else if (todayDone > 0) {
    streakLbl = `hari selesai minggu ini · Hari ini: ${todayDone}/${todayTotal} materi`;
  } else {
    const dayLabels = ['Mulai hari ini!','Bagus, terus!','Hampir setengah!','Setengah jalan!','Hebat!','Hampir sempurna!','Sempurna! 🎉'];
    streakLbl = `hari · ${dayLabels[Math.min(count, dayLabels.length - 1)]}`;
  }

  const numEl = document.getElementById('eng-streak');
  const lblEl = document.getElementById('eng-streak-lbl');
  const bdgEl = document.getElementById('eng-badge');
  const dotEl = document.getElementById('eng-week-dots');

  if (numEl) numEl.textContent = count;
  if (lblEl) lblEl.textContent = streakLbl;
  if (bdgEl) bdgEl.textContent = badge;

  // Week dots
  if (dotEl) {
    dotEl.innerHTML = '';
    ENG_DAY_LABELS.forEach((label, i) => {
      const dk      = weekDays[i];
      const isDone  = isDayDone(dk, i);
      const isToday = i === todayIdx;
      const div = document.createElement('div');
      div.className = 'eng-week-dot'
        + (isDone ? ' done' : '')
        + (!isDone && isToday ? ' today-dot' : '');
      div.title = label + (isDone ? ' ✓' : isToday ? ' (hari ini)' : '');
      div.textContent = label;
      dotEl.appendChild(div);
    });
  }

  // Render checklist hari ini
  renderEngChecklist();
}

function renderEngChecklist() {
  const container = document.getElementById('eng-checklist-wrap');
  if (!container) return;

  const data     = getEngData();
  const today    = engTodayKey();
  const todayIdx = engTodayIdx();
  const items    = ENG_CHECKLIST[todayIdx] || [];
  const saved    = data.checks[today] || {};
  const doneCnt  = items.filter(it => saved[it.id]).length;

  container.innerHTML = `
    <div class="eng-checklist-header">
      <span class="eng-checklist-title">📋 Materi Hari Ini</span>
      <span class="eng-checklist-prog">${doneCnt}/${items.length} selesai</span>
    </div>
    <div class="eng-prog-bar-wrap">
      <div class="eng-prog-bar-fill" style="width:${items.length ? Math.round(doneCnt/items.length*100) : 0}%"></div>
    </div>
    <div class="eng-checklist-items">
      ${items.map(it => {
        const checked = !!saved[it.id];
        return `<div class="eng-check-item ${checked ? 'checked' : ''}" onclick="toggleEngCheck('${it.id}')">
          <div class="eng-check-box">${checked ? '✓' : ''}</div>
          <div class="eng-check-label">${it.label}</div>
        </div>`;
      }).join('')}
    </div>
    ${doneCnt === items.length && items.length > 0
      ? `<div class="eng-all-done">🎉 Semua materi hari ini selesai! Streak bertambah.</div>`
      : ''}
  `;
}

window.toggleEngCheck = function(itemId) {
  const data    = getEngData();
  const today   = engTodayKey();
  data.checks   = data.checks || {};
  data.checks[today] = data.checks[today] || {};
  data.checks[today][itemId] = !data.checks[today][itemId];
  // Jika semua selesai, tandai hari ini done
  const todayIdx = engTodayIdx();
  const items    = ENG_CHECKLIST[todayIdx] || [];
  data.days      = data.days || {};
  if (items.length && items.every(it => data.checks[today][it.id])) {
    data.days[today] = true;
  } else {
    delete data.days[today];
  }
  saveEngData(data);
  renderEngStreak();
};

// Tetap ada tombol "Tandai Selesai" sebagai shortcut selesaikan semua
window.saveEngStreak = function() {
  const data     = getEngData();
  const today    = engTodayKey();
  const todayIdx = engTodayIdx();
  const items    = ENG_CHECKLIST[todayIdx] || [];
  data.checks    = data.checks || {};
  data.checks[today] = data.checks[today] || {};
  items.forEach(it => { data.checks[today][it.id] = true; });
  data.days      = data.days || {};
  data.days[today] = true;
  saveEngData(data);
  renderEngStreak();
};

window.resetEngWeek = function() {
  if (!confirm('Reset semua checklist & streak minggu ini?')) return;
  const data     = getEngData();
  const weekDays = getEngWeekDays();
  weekDays.forEach(dk => {
    delete data.days[dk];
    delete data.checks[dk];
  });
  saveEngData(data);
  renderEngStreak();
};

/* ================================================
   HARI INI — Dynamic agenda & checklist
   ================================================ */

const JADWAL_HARIAN = {
  senin:  [
    {t:'03.00',l:'Bangun — Tahajud, Witir, Sahur',cat:'ibadah'},
    {t:'04.45',l:'Sholat Subuh + Dzikir pagi',cat:'ibadah'},
    {t:'05.30',l:'Workout pagi (20 menit)',cat:'olahraga'},
    {t:'06.20',l:'Berangkat ke SMAN 8 Kediri',cat:'kerja'},
    {t:'07.00',l:'Jadwal mengajar',cat:'kerja'},
    {t:'09.00',l:'Sholat Dhuha',cat:'ibadah'},
    {t:'11.30',l:'Sholat Dzuhur berjamaah',cat:'ibadah'},
    {t:'15.00',l:'Sholat Ashar + pulang',cat:'ibadah'},
    {t:'16.20',l:'Bermain bersama anak',cat:'keluarga'},
    {t:'17.45',l:'Maghrib — berbuka puasa',cat:'ibadah'},
    {t:'18.30',l:'Makan malam bersama keluarga',cat:'keluarga'},
    {t:'20.00',l:'Cek Artilerianstore + belajar Inggris',cat:'toko'},
    {t:'21.30',l:'Tidur',cat:'tidur'},
  ],
  selasa: [
    {t:'03.45',l:'Bangun — Tahajud + Sahur',cat:'ibadah'},
    {t:'04.45',l:'Sholat Subuh + Dzikir',cat:'ibadah'},
    {t:'05.35',l:'Workout pagi (25 menit)',cat:'olahraga'},
    {t:'06.20',l:'Berangkat ke sekolah',cat:'kerja'},
    {t:'07.00',l:'Jadwal mengajar',cat:'kerja'},
    {t:'09.00',l:'Sholat Dhuha',cat:'ibadah'},
    {t:'11.30',l:'Sholat Dzuhur',cat:'ibadah'},
    {t:'15.00',l:'Sholat Ashar + pulang',cat:'ibadah'},
    {t:'16.20',l:'Bermain bersama anak',cat:'keluarga'},
    {t:'17.45',l:'Maghrib',cat:'ibadah'},
    {t:'19.15',l:'Sholat Isya + Jurnal Inggris (Writing)',cat:'ibadah'},
    {t:'20.00',l:'Cek Artilerianstore',cat:'toko'},
    {t:'21.30',l:'Tidur',cat:'tidur'},
  ],
  rabu: [
    {t:'04.30',l:'Subuh + Anki 10 menit (Rabu padat)',cat:'ibadah'},
    {t:'05.35',l:'Workout pagi',cat:'olahraga'},
    {t:'06.20',l:'Berangkat ke sekolah',cat:'kerja'},
    {t:'07.00',l:'Jadwal mengajar',cat:'kerja'},
    {t:'09.00',l:'Sholat Dhuha',cat:'ibadah'},
    {t:'14.00',l:'Honor Madin',cat:'kerja'},
    {t:'15.00',l:'Sholat Ashar + pulang',cat:'ibadah'},
    {t:'16.20',l:'Bermain bersama anak',cat:'keluarga'},
    {t:'17.45',l:'Maghrib',cat:'ibadah'},
    {t:'19.15',l:'Isya',cat:'ibadah'},
    {t:'21.30',l:'Tidur (hari padat)',cat:'tidur'},
  ],
  kamis: [
    {t:'03.00',l:'Bangun — Tahajud, Witir, Sahur',cat:'ibadah'},
    {t:'04.45',l:'Sholat Subuh + Dzikir',cat:'ibadah'},
    {t:'05.35',l:'Workout pagi',cat:'olahraga'},
    {t:'06.20',l:'Berangkat ke sekolah',cat:'kerja'},
    {t:'07.00',l:'Jadwal mengajar',cat:'kerja'},
    {t:'09.00',l:'Sholat Dhuha',cat:'ibadah'},
    {t:'15.00',l:'Sholat Ashar — berbuka puasa',cat:'ibadah'},
    {t:'16.20',l:'Bermain bersama anak',cat:'keluarga'},
    {t:'17.45',l:'Maghrib',cat:'ibadah'},
    {t:'19.15',l:'Isya + baca artikel Inggris (Reading)',cat:'ibadah'},
    {t:'21.30',l:'Tidur',cat:'tidur'},
  ],
  jumat: [
    {t:'04.30',l:'Subuh + Tilawah Al-Kahfi',cat:'ibadah'},
    {t:'05.35',l:'Workout pagi',cat:'olahraga'},
    {t:'06.20',l:'Berangkat ke sekolah',cat:'kerja'},
    {t:'07.00',l:'Jadwal mengajar',cat:'kerja'},
    {t:'11.00',l:'Persiapan Sholat Jumat',cat:'ibadah'},
    {t:'11.30',l:'Sholat Jumat di masjid',cat:'ibadah'},
    {t:'13.00',l:'Jadwal mengajar lanjut',cat:'kerja'},
    {t:'15.00',l:'Ashar + pulang',cat:'ibadah'},
    {t:'16.30',l:'Hobi / olahraga sore',cat:'olahraga'},
    {t:'18.00',l:'Maghrib',cat:'ibadah'},
    {t:'18.30',l:'Date Night Salma 💑',cat:'keluarga'},
    {t:'19.15',l:'Isya + Speaking Inggris',cat:'ibadah'},
    {t:'21.30',l:'Tidur',cat:'tidur'},
  ],
  sabtu: [
    {t:'04.30',l:'Subuh + Tilawah',cat:'ibadah'},
    {t:'05.15',l:'Jogging / workout (45–60 menit)',cat:'olahraga'},
    {t:'06.15',l:'Bantu mandikan anak',cat:'keluarga'},
    {t:'07.30',l:'Merawat tanaman & aquascape',cat:'hobby'},
    {t:'09.30',l:'Sholat Dhuha',cat:'ibadah'},
    {t:'11.30',l:'Dzuhur',cat:'ibadah'},
    {t:'12.00',l:'Makan siang + tidur siang',cat:'istirahat'},
    {t:'13.30',l:'Evaluasi toko Shopee',cat:'toko'},
    {t:'14.30',l:'Jalan-jalan keluarga Kediri',cat:'keluarga'},
    {t:'18.00',l:'Maghrib',cat:'ibadah'},
    {t:'19.15',l:'Isya',cat:'ibadah'},
    {t:'22.00',l:'Tidur',cat:'tidur'},
  ],
  minggu: [
    {t:'05.00',l:'Subuh (santai — weekend)',cat:'ibadah'},
    {t:'07.00',l:'Bantu mandikan anak, sarapan',cat:'keluarga'},
    {t:'08.00',l:'Jogging pagi bersama keluarga',cat:'olahraga'},
    {t:'09.00',l:'Sholat Dhuha',cat:'ibadah'},
    {t:'09.30',l:'Liburan keluarga / jalan-jalan',cat:'keluarga'},
    {t:'11.30',l:'Dzuhur',cat:'ibadah'},
    {t:'12.00',l:'Makan siang + tidur siang',cat:'istirahat'},
    {t:'14.00',l:'Family time bersama anak',cat:'keluarga'},
    {t:'18.00',l:'Maghrib',cat:'ibadah'},
    {t:'18.30',l:'Cek toko — set target minggu depan',cat:'toko'},
    {t:'19.30',l:'Isya + me-time',cat:'ibadah'},
    {t:'21.00',l:'Tidur lebih awal',cat:'tidur'},
  ],
};

const CHECKLIST_HARIAN = {
  semua: [
    { id:'ibadah', label:'Sholat 5 waktu lengkap' },
    { id:'quran',  label:'Tilawah / Baca Al-Qur\'an' },
    { id:'dzikir', label:'Dzikir pagi & petang' },
    { id:'workout',label:'Olahraga / workout' },
    { id:'keluarga',label:'Quality time keluarga' },
    { id:'toko',   label:'Cek Artilerianstore' },
  ],
  senin:  [{ id:'puasa_sen',label:'Puasa Senin ✓' }],
  kamis:  [{ id:'puasa_kam',label:'Puasa Kamis ✓' }],
  jumat:  [{ id:'jumat_kahfi',label:'Baca Al-Kahfi (Jum\'at)' }],
};

const REMINDER_HARIAN = {
  senin:  ['Puasa Senin — jaga niat & energi','Quality time anak 16.20–17.00','Cek Artilerianstore malam','Batas WA siswa: jam 16.00'],
  selasa: ['Jadwal Writing Inggris malam ini (19.45)','Deadline admin toko → Kamis malam','Quality time anak sore','Batas WA siswa: jam 16.00'],
  rabu:   ['Hari padat — cukup Anki 10 menit','Madin','Istirahat cukup malam ini','Batas WA siswa: jam 16.00'],
  kamis:  ['Puasa Kamis — berbuka sore','Baca artikel Inggris malam (Reading)','Deadline admin toko → hari ini','Quality time anak 16.20–17.00'],
  jumat:  ['Baca Al-Kahfi pagi ini','Sholat Jumat 11.30 — siap lebih awal','Date Night Salma malam ini 💑','Speaking Inggris malam (20.30)'],
  sabtu:  ['Evaluasi toko Shopee 13.30','Nonton YouTube tanpa sub (Inggris bebas)','Family trip sore bersama keluarga','Mandikan anak pagi — beri Salma 1 jam'],
  minggu: ['Hari keluarga — semua HP kerja off','Set target & evaluasi minggu depan','Isya + me-time untuk diri sendiri','Tidur lebih awal — Senin kerja lagi'],
};

const HARI_ID_MAP = ['minggu','senin','selasa','rabu','kamis','jumat','sabtu'];

function parseTimeToMin(str) {
  const p = str.trim().replace(',','.').split('.');
  if (p.length < 2) return NaN;
  return +p[0]*60 + +p[1];
}

function renderHariIni() {
  const now   = new Date();
  const hari  = HARI_ID_MAP[now.getDay()];
  const cur   = now.getHours()*60 + now.getMinutes();

  // ── Stat cards ──
  const statHari = document.getElementById('d-stat-hari');
  const statJam  = document.getElementById('d-stat-jam');
  if (statHari) {
    const hariLabel = NAMA_HARI[now.getDay()];
    const bln = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'][now.getMonth()];
    statHari.textContent = `${hariLabel}, ${now.getDate()} ${bln}`;
  }
  if (statJam) {
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    statJam.textContent = `${hh}:${mm}`;
  }

  // ── Timeline agenda ──
  const tlEl = document.getElementById('d-timeline');
  if (tlEl) {
    const schedule = JADWAL_HARIAN[hari] || [];
    const catColors = {
      ibadah:'#639922', olahraga:'#378add', kerja:'#7f77dd',
      istirahat:'#888780', sosial:'#ba7517', hobby:'#d85a30',
      keluarga:'#d4537e', toko:'#1d9e75', tidur:'#9ca3af'
    };

    // Find current block
    let curIdx = -1;
    for (let i = 0; i < schedule.length; i++) {
      const start = parseTimeToMin(schedule[i].t);
      const end   = i+1 < schedule.length ? parseTimeToMin(schedule[i+1].t) : start+60;
      if (cur >= start && cur < end) { curIdx = i; break; }
    }

    tlEl.innerHTML = schedule.map((item, i) => {
      const isNow = i === curIdx;
      const isPast = parseTimeToMin(item.t) < cur && !isNow;
      const color = catColors[item.cat] || '#888';
      return `<div class="dash-tl-item ${isNow ? 'dash-tl-now' : ''}">
        <div class="dash-tl-time" style="${isPast ? 'opacity:0.4' : ''}">${item.t}</div>
        <div class="dash-tl-block" style="border-left-color:${color};${isPast ? 'opacity:0.45' : ''}">${item.l}${isNow ? ' <span class="live-badge"><span class="live-dot"></span> sekarang</span>' : ''}</div>
      </div>`;
    }).join('');
  }

  // ── Checklist ──
  const checksEl = document.getElementById('d-checks');
  if (checksEl) {
    const CKEY = 'hari_ini_checks_' + todayStr();
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(CKEY) || '{}'); } catch {}

    const items = [...(CHECKLIST_HARIAN.semua), ...(CHECKLIST_HARIAN[hari] || [])];
    checksEl.innerHTML = items.map(it => {
      const checked = !!saved[it.id];
      return `<div class="d-check-item ${checked ? 'checked' : ''}" onclick="toggleDCheck('${it.id}','${CKEY}',this)">
        <div class="d-check-box">${checked ? '✓' : ''}</div>
        <div class="d-check-label">${it.label}</div>
      </div>`;
    }).join('');
  }

  // ── Reminder ──
  const remEl = document.getElementById('d-reminder');
  if (remEl) {
    const rems = REMINDER_HARIAN[hari] || [];
    remEl.innerHTML = rems.map(r =>
      `<div class="d-reminder-item"><span class="d-reminder-ico">💡</span><span>${r}</span></div>`
    ).join('');
  }
}

window.toggleDCheck = function(id, ckey, el) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(ckey) || '{}'); } catch {}
  saved[id] = !saved[id];
  try { localStorage.setItem(ckey, JSON.stringify(saved)); } catch {}
  el.classList.toggle('checked', !!saved[id]);
  const box = el.querySelector('.d-check-box');
  if (box) box.textContent = saved[id] ? '✓' : '';
  const lbl = el.querySelector('.d-check-label');
  if (lbl) lbl.style.textDecoration = saved[id] ? 'line-through' : '';
};

window.saveDChecks = function() {
  const btn = document.querySelector('[onclick="saveDChecks()"]');
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = '✓ Tersimpan!';
    btn.style.background = 'linear-gradient(135deg,#16a34a,#22c55e)';
    setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 1600);
  }
};

window.resetDChecks = function() {
  if (!confirm('Reset checklist hari ini?')) return;
  const CKEY = 'hari_ini_checks_' + todayStr();
  try { localStorage.removeItem(CKEY); } catch {}
  renderHariIni();
};
