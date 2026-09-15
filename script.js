/* ================================================
   PIN SCREEN — 6 digit
   Ganti PIN_CORRECT di bawah dengan PIN yang kamu inginkan
   ================================================ */

const PIN_CORRECT  = '123456';   // ← GANTI PIN DI SINI
const PIN_STORAGE  = 'jadwal_unlocked';
const PIN_DURATION = 12 * 60 * 60 * 1000; // 12 jam — tidak perlu login ulang seharian

let pinBuffer = '';
let pinLocked = true;

function initPinScreen() {
  const screen  = document.getElementById('pin-screen');
  const content = document.getElementById('app-content');

  // Pastikan konten tersembunyi dulu
  content.style.display = 'none';

  // Cek apakah sudah unlock dalam 12 jam terakhir
  try {
    const saved = localStorage.getItem(PIN_STORAGE);
    if (saved) {
      const { ts } = JSON.parse(saved);
      if (Date.now() - ts < PIN_DURATION) {
        unlockApp(true); // langsung buka tanpa animasi
        return;
      }
    }
  } catch {}

  // Tampilkan PIN screen pakai class .visible
  screen.classList.add('visible');

  // Keyboard support (laptop)
  document.addEventListener('keydown', handlePinKey);
}

function handlePinKey(e) {
  if (!pinLocked) return;
  if (e.key >= '0' && e.key <= '9') pinPress(e.key);
  else if (e.key === 'Backspace') pinDel();
}

window.pinPress = function(digit) {
  if (!pinLocked) return;
  if (pinBuffer.length >= 6) return;

  pinBuffer += digit;
  updatePinDots();

  if (pinBuffer.length === 6) {
    setTimeout(checkPin, 120); // delay kecil agar dot ke-6 terlihat terisi
  }
};

window.pinDel = function() {
  if (!pinLocked) return;
  pinBuffer = pinBuffer.slice(0, -1);
  updatePinDots();
  clearError();
};

function updatePinDots() {
  for (let i = 0; i < 6; i++) {
    const dot = document.getElementById('d' + i);
    dot.classList.toggle('filled', i < pinBuffer.length);
    dot.classList.remove('error');
  }
}

function checkPin() {
  if (pinBuffer === PIN_CORRECT) {
    // Simpan timestamp unlock
    localStorage.setItem(PIN_STORAGE, JSON.stringify({ ts: Date.now() }));
    unlockApp(false);
  } else {
    // Shake + error
    const dots = document.getElementById('pin-dots');
    dots.classList.add('shake');
    for (let i = 0; i < 6; i++) {
      const dot = document.getElementById('d' + i);
      dot.classList.remove('filled');
      dot.classList.add('error');
    }
    document.getElementById('pin-error').textContent = 'PIN salah, coba lagi';
    pinBuffer = '';
    setTimeout(() => {
      dots.classList.remove('shake');
      updatePinDots();
    }, 500);
  }
}

function clearError() {
  document.getElementById('pin-error').textContent = '';
}

function unlockApp(instant) {
  pinLocked = false;
  document.removeEventListener('keydown', handlePinKey);
  const screen  = document.getElementById('pin-screen');
  const content = document.getElementById('app-content');

  content.style.display = 'block';

  if (instant) {
    screen.classList.remove('visible');
    screen.style.display = 'none';
  } else {
    screen.classList.add('unlocked');
    setTimeout(() => {
      screen.classList.remove('visible');
      screen.style.display = 'none';
    }, 400);
  }
}

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

    // Listen realtime todos — tangkap PERMISSION_DENIED secara spesifik
    todosRef.on('value', snap => {
      const raw = snap.val();
      todos = raw ? Object.entries(raw).map(([fbKey, v]) => ({ ...v, fbKey })) : [];
      renderTodos();
    }, err => {
      console.error('Firebase error:', err.code);
      if (err.code === 'PERMISSION_DENIED') {
        setSyncStatus('error', '⚠️ Izin ditolak');
        showPermissionBanner();
      } else {
        setSyncStatus('error', 'Gagal sync');
      }
      loadFromLocal();
    });

    isFirebaseReady = true;
    setTimeout(initMenuFirebase, 0);

  } catch (e) {
    setSyncStatus('error', 'Error Firebase');
    console.error(e);
    loadFromLocal();
  }
}

/* Banner muncul saat permission denied — tampil sekali, bisa ditutup */
function showPermissionBanner() {
  if (document.getElementById('fb-permission-banner')) return;
  const el = document.createElement('div');
  el.id = 'fb-permission-banner';
  el.style.cssText = [
    'position:fixed','bottom:1.25rem','left:50%','transform:translateX(-50%)',
    'background:#1e1b2e','color:#fde68a','border:1.5px solid #f59e0b',
    'border-radius:14px','padding:.85rem 1.25rem','font-size:12.5px',
    'font-family:system-ui,sans-serif','z-index:9999','max-width:min(480px,92vw)',
    'box-shadow:0 8px 32px rgba(0,0,0,0.35)','line-height:1.6',
    'display:flex','align-items:flex-start','gap:10px'
  ].join(';');
  el.innerHTML = \`
    <span style="font-size:20px;flex-shrink:0;margin-top:1px">⚠️</span>
    <div style="flex:1">
      <b style="display:block;margin-bottom:3px">Firebase Rules perlu diperbarui</b>
      1. Buka <b>console.firebase.google.com</b><br>
      2. Pilih project → <b>Realtime Database → Rules</b><br>
      3. Ganti <code style="background:#fff2;padding:0 4px;border-radius:3px">false</code>
         jadi <code style="background:#fff2;padding:0 4px;border-radius:3px">true</code>
         untuk <b>.read</b> dan <b>.write</b><br>
      4. Klik <b>Publish</b>
    </div>
    <button onclick="document.getElementById('fb-permission-banner').remove()" style="
      background:none;border:none;color:#fde68a;font-size:18px;
      cursor:pointer;flex-shrink:0;line-height:1">✕</button>
  \`;
  document.body.appendChild(el);
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
  // PIN dihandle inline di index.html
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

/* ================================================
   DASHBOARD TABS — Hari Ini, English, Keluarga, Finansial
   ================================================ */

/* ── Data Agenda per hari ── */
const _schedules = {
  1: [
    {time:'03.00',act:'Bangun — persiapan ibadah malam',icon:'🌙',color:'#D1FAE5'},
    {time:'03.15',act:'Tahajud, Witir, doa',icon:'📿',color:'#D1FAE5'},
    {time:'03.40',act:'Sahur',icon:'🍽️',color:'#FEF9E7'},
    {time:'04.10',act:'Tilawah Al-Qur\'an',icon:'📖',color:'#D1FAE5'},
    {time:'04.45',act:'Sholat Subuh + Dzikir pagi',icon:'📿',color:'#D1FAE5'},
    {time:'05.30',act:'Workout pagi (20 menit)',icon:'💪',color:'#DBEAFE'},
    {time:'06.20',act:'Berangkat ke SMAN 8 Kediri',icon:'🏍️',color:'#DBEAFE'},
    {time:'09.00',act:'Istirahat — Sholat Dhuha',icon:'🕌',color:'#D1FAE5'},
    {time:'11.30',act:'Sholat Dzuhur berjamaah',icon:'🕌',color:'#D1FAE5'},
    {time:'15.00',act:'Sholat Ashar',icon:'🕌',color:'#D1FAE5'},
    {time:'15.30',act:'Absensi pulang',icon:'🏫',color:'#DBEAFE'},
    {time:'16.20',act:'Main bareng anak',sub:'Tanpa HP — 40 menit fokus',icon:'👦',color:'#D1FAE5'},
    {time:'17.45',act:'Maghrib — berbuka puasa',icon:'🌅',color:'#D1FAE5'},
    {time:'18.30',act:'Makan malam bersama keluarga',icon:'🍽️',color:'#D1FAE5'},
    {time:'19.15',act:'Isya + Dzikir malam',icon:'📿',color:'#D1FAE5'},
    {time:'20.00',act:'Cek Artilerianstore / Coding / Baca',icon:'💻',color:'#EDE9FE'},
    {time:'21.30',act:'Tidur',icon:'😴',color:'#F3F4F6'},
  ],
  2: [
    {time:'03.45',act:'Bangun — Tahajud, Witir, doa',icon:'🌙',color:'#D1FAE5'},
    {time:'04.45',act:'Sholat Subuh + Dzikir',icon:'📿',color:'#D1FAE5'},
    {time:'05.35',act:'Workout pagi (25 menit)',icon:'💪',color:'#DBEAFE'},
    {time:'06.20',act:'Berangkat ke sekolah',icon:'🏍️',color:'#DBEAFE'},
    {time:'09.00',act:'Sholat Dhuha',icon:'🕌',color:'#D1FAE5'},
    {time:'11.30',act:'Sholat Dzuhur + makan siang',icon:'🕌',color:'#D1FAE5'},
    {time:'15.30',act:'Absensi pulang',icon:'🏫',color:'#DBEAFE'},
    {time:'16.00',act:'Fotografi / Videografi konten',icon:'📸',color:'#FEF3C7'},
    {time:'18.00',act:'Maghrib + Tilawah',icon:'🌅',color:'#D1FAE5'},
    {time:'18.30',act:'Makan malam bersama keluarga',icon:'🍽️',color:'#D1FAE5'},
    {time:'19.15',act:'Isya',icon:'📿',color:'#D1FAE5'},
    {time:'19.45',act:'English: Writing — jurnal / paragraf',icon:'✍️',color:'#EDE9FE'},
    {time:'21.30',act:'Tidur',icon:'😴',color:'#F3F4F6'},
  ],
  3: [
    {time:'03.45',act:'Bangun — Tahajud, Witir, doa',icon:'🌙',color:'#D1FAE5'},
    {time:'04.45',act:'Sholat Subuh + Dzikir',icon:'📿',color:'#D1FAE5'},
    {time:'05.35',act:'Workout pagi (20 menit — ringkas)',icon:'💪',color:'#DBEAFE'},
    {time:'06.20',act:'Berangkat ke sekolah',icon:'🏍️',color:'#DBEAFE'},
    {time:'09.00',act:'Sholat Dhuha',icon:'🕌',color:'#D1FAE5'},
    {time:'11.30',act:'Sholat Dzuhur + makan siang',icon:'🕌',color:'#D1FAE5'},
    {time:'15.30',act:'Segera pulang — madin jam 16.30',icon:'🏫',color:'#DBEAFE'},
    {time:'16.30',act:'Mengajar Madin / TPA',icon:'📖',color:'#EDE9FE',sub:'Hingga 19.00'},
    {time:'19.00',act:'Maghrib + Isya',icon:'🌅',color:'#D1FAE5'},
    {time:'19.45',act:'Makan malam + istirahat',icon:'🍽️',color:'#D1FAE5'},
    {time:'21.00',act:'Tidur lebih awal',icon:'😴',color:'#F3F4F6'},
  ],
  4: [
    {time:'03.00',act:'Bangun — Tahajud, Witir, doa',icon:'🌙',color:'#D1FAE5'},
    {time:'03.40',act:'Sahur',icon:'🍽️',color:'#FEF9E7'},
    {time:'04.45',act:'Sholat Subuh + Dzikir',icon:'📿',color:'#D1FAE5'},
    {time:'05.30',act:'Workout pagi (20 menit)',icon:'💪',color:'#DBEAFE'},
    {time:'06.20',act:'Berangkat ke sekolah',icon:'🏍️',color:'#DBEAFE'},
    {time:'09.00',act:'Sholat Dhuha',icon:'🕌',color:'#D1FAE5'},
    {time:'11.30',act:'Sholat Dzuhur (puasa)',icon:'🕌',color:'#D1FAE5'},
    {time:'15.30',act:'Absensi pulang',icon:'🏫',color:'#DBEAFE'},
    {time:'16.20',act:'Main bareng anak',icon:'👦',color:'#D1FAE5'},
    {time:'17.45',act:'Maghrib — berbuka puasa',icon:'🌅',color:'#D1FAE5'},
    {time:'18.30',act:'Makan malam bersama keluarga',icon:'🍽️',color:'#D1FAE5'},
    {time:'19.15',act:'Isya',icon:'📿',color:'#D1FAE5'},
    {time:'20.00',act:'English: Reading — artikel edukasi',icon:'📖',color:'#EDE9FE'},
    {time:'21.30',act:'Tidur',icon:'😴',color:'#F3F4F6'},
  ],
  5: [
    {time:'03.45',act:'Tahajud, Witir, doa',icon:'🌙',color:'#D1FAE5'},
    {time:'04.45',act:'Subuh + baca Al-Kahfi pagi Jumat',icon:'📿',color:'#D1FAE5'},
    {time:'05.35',act:'Workout pagi (25 menit)',icon:'💪',color:'#DBEAFE'},
    {time:'06.20',act:'Berangkat ke sekolah',icon:'🏍️',color:'#DBEAFE'},
    {time:'11.30',act:'Sholat Jumat berjamaah',icon:'🕌',color:'#D1FAE5'},
    {time:'16.00',act:'Absensi pulang',icon:'🏫',color:'#DBEAFE'},
    {time:'16.30',act:'Workout sore / mancing sore',icon:'🎣',color:'#FEF3C7'},
    {time:'18.00',act:'Maghrib + Tilawah',icon:'🌅',color:'#D1FAE5'},
    {time:'18.30',act:'Date Night Salma ❤️',sub:'Konsisten tiap Jumat',icon:'💑',color:'#FCE7F3'},
    {time:'19.15',act:'Isya',icon:'📿',color:'#D1FAE5'},
    {time:'20.30',act:'English: Speaking — shadowing',icon:'🎙️',color:'#EDE9FE'},
    {time:'21.30',act:'Tidur',icon:'😴',color:'#F3F4F6'},
  ],
  6: [
    {time:'04.30',act:'Subuh + Dzikir',icon:'📿',color:'#D1FAE5'},
    {time:'05.15',act:'Jogging / workout (45–60 menit)',icon:'🏃',color:'#DBEAFE'},
    {time:'06.15',act:'Mandikan anak — beri Salma 1 jam bebas',icon:'🛁',color:'#FCE7F3'},
    {time:'06.45',act:'Sarapan bersama keluarga',icon:'🍳',color:'#D1FAE5'},
    {time:'09.30',act:'Sholat Dhuha',icon:'🕌',color:'#D1FAE5'},
    {time:'09.45',act:'Fotografi / Coding / nulis artikel',icon:'📸',color:'#FEF3C7'},
    {time:'12.00',act:'Makan siang + tidur siang',icon:'😴',color:'#F3F4F6'},
    {time:'13.30',act:'Evaluasi toko Shopee — brief karyawan',icon:'📊',color:'#FEF3C7'},
    {time:'14.30',act:'Jalan-jalan keluarga / kuliner Kediri',icon:'👨‍👩‍👦',color:'#D1FAE5'},
    {time:'18.00',act:'Maghrib + Tilawah',icon:'🌅',color:'#D1FAE5'},
    {time:'18.30',act:'Kuliner / nongki bareng Salma',icon:'🍜',color:'#FCE7F3'},
    {time:'22.00',act:'Tidur',icon:'😴',color:'#F3F4F6'},
  ],
  0: [
    {time:'05.00',act:'Subuh',icon:'📿',color:'#D1FAE5'},
    {time:'07.00',act:'Bangun santai — sarapan keluarga',icon:'☕',color:'#D1FAE5'},
    {time:'08.00',act:'Jogging pagi bersama keluarga',icon:'🏃',color:'#DBEAFE'},
    {time:'09.00',act:'Sholat Dhuha',icon:'🕌',color:'#D1FAE5'},
    {time:'09.30',act:'Liburan / wisata keluarga',icon:'🌳',color:'#D1FAE5'},
    {time:'12.00',act:'Makan siang + tidur siang panjang',icon:'😴',color:'#F3F4F6'},
    {time:'14.00',act:'Main bareng anak / hobi bebas',icon:'👦',color:'#D1FAE5'},
    {time:'18.00',act:'Maghrib + Tilawah',icon:'🌅',color:'#D1FAE5'},
    {time:'18.30',act:'Cek toko Shopee — set target minggu depan',icon:'📊',color:'#FEF3C7'},
    {time:'19.00',act:'Makan malam keluarga',icon:'🍽️',color:'#D1FAE5'},
    {time:'21.00',act:'Tidur lebih awal — besok Senin',icon:'😴',color:'#F3F4F6'},
  ],
};

const _reminders = {
  1:'Senin 🌙 Hari puasa sunnah. Bangun 03.00 untuk Tahajud + Sahur. Main bareng anak sore ini 40 menit — prioritas.',
  2:'Selasa ✍️ Selesaikan admin di sekolah sebelum jam 16. Malam ini: English Writing 30 menit.',
  3:'Rabu ⚡ Hari tersibuk. Ada madin jam 16.30 sampai 19.00. Tidak ada target tambahan — selamatkan hari ini.',
  4:'Kamis 🌙 Hari puasa sunnah. Bangun 03.00 untuk Tahajud + Sahur. Main bareng anak sore jam 16.20.',
  5:'Jumat ✨ Baca Al-Kahfi pagi ini. Setelah pulang: HP kerja OFF. Date night Salma malam ini — jangan skip.',
  6:'Sabtu 🌿 Mandikan anak pagi ini, beri Salma waktu bebas. Sore: jalan keluarga Kediri.',
  0:'Minggu 🏠 Hari keluarga penuh. Hadir sepenuhnya untuk Salma dan anak. Tidak ada urusan sekolah hari ini.',
};

/* ── Render Timeline ── */
function renderDTimeline() {
  const el = document.getElementById('d-timeline');
  if (!el) return;
  const now = new Date();
  const dow = now.getDay();
  const sched = _schedules[dow] || _schedules[1];
  const curH = now.getHours() + now.getMinutes() / 60;
  el.innerHTML = '';
  sched.forEach((item, i) => {
    const [h, m] = item.time.split('.').map(Number);
    const ih = h + (m || 0) / 60;
    const nh = i < sched.length - 1
      ? (() => { const [nh2,nm2] = sched[i+1].time.split('.').map(Number); return nh2+(nm2||0)/60; })()
      : 25;
    const isDone = curH > ih + 0.5;
    const isNow  = curH >= ih && curH < nh;
    const div = document.createElement('div');
    div.className = 'd-tl-item' + (isDone?' done':'') + (isNow?' now':'');
    div.innerHTML = `
      <div class="d-tl-dot" style="background:${item.color}">${item.icon}</div>
      <div class="d-tl-content">
        <div class="d-tl-time">${item.time}${isNow?'<span class="d-now-chip">SEKARANG</span>':''}</div>
        <div class="d-tl-act">${item.act}</div>
        ${item.sub?`<div class="d-tl-sub">${item.sub}</div>`:''}
      </div>`;
    el.appendChild(div);
  });
}

/* ── Reminder ── */
function renderDReminder() {
  const el = document.getElementById('d-reminder');
  if (!el) return;
  el.textContent = _reminders[new Date().getDay()] || '';
}

/* ── DateTime stat ── */
function renderDDateTime() {
  const now = new Date();
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const sh = document.getElementById('d-stat-hari');
  const sj = document.getElementById('d-stat-jam');
  if (sh) sh.textContent = days[now.getDay()];
  if (sj) sj.textContent = now.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
}

/* ── Checklist ── */
const _checkItems = [
  {id:'subuh',   lbl:'Sholat Subuh berjamaah / tepat waktu',    tag:'Ibadah',    color:'green'},
  {id:'tilawah', lbl:'Tilawah Al-Qur\'an (min. 1 halaman)',      tag:'Ibadah',    color:'green'},
  {id:'dhuha',   lbl:'Sholat Dhuha (istirahat sekolah)',          tag:'Ibadah',    color:'green'},
  {id:'dzuhur',  lbl:'Sholat Dzuhur berjamaah',                   tag:'Ibadah',    color:'green'},
  {id:'isya',    lbl:'Sholat Isya & doa malam bersama anak',      tag:'Ibadah',    color:'green'},
  {id:'hpoff',   lbl:'HP kerja OFF setelah jam 16.00',            tag:'Keluarga',  color:'rose'},
  {id:'anak',    lbl:"Main / quality time dengan anak (min. 30')",tag:'Keluarga',  color:'rose'},
  {id:'salma',   lbl:'Ngobrol dengan Salma (bukan sambil HP)',     tag:'Keluarga',  color:'rose'},
  {id:'admin',   lbl:'Selesaikan admin sekolah DI SEKOLAH',        tag:'Kerja',     color:'blue'},
  {id:'english', lbl:'Belajar Bahasa Inggris 30 menit',           tag:'Upgrade',   color:'purple'},
  {id:'toko',    lbl:'Cek Artilerianstore (singkat)',              tag:'Bisnis',    color:'blue'},
];
const _tagCls = {green:'d-tag-green', rose:'d-tag-rose', blue:'d-tag-blue', purple:'d-tag-purple'};

function renderDChecks() {
  const el = document.getElementById('d-checks');
  if (!el) return;
  const today = new Date().toDateString();
  const saved = JSON.parse(localStorage.getItem('dchecks_' + today) || '{}');
  el.innerHTML = '';
  _checkItems.forEach(item => {
    const div = document.createElement('div');
    const checked = saved[item.id] || false;
    div.className = 'd-check-item' + (checked ? ' checked' : '');
    div.onclick = () => toggleDCheck(item.id);
    div.innerHTML = `
      <div class="d-check-box">${checked ? '✓' : ''}</div>
      <div class="d-check-lbl">${item.lbl}</div>
      <span class="d-check-tag ${_tagCls[item.color] || 'd-tag-blue'}">${item.tag}</span>`;
    el.appendChild(div);
  });
}

function toggleDCheck(id) {
  const today = new Date().toDateString();
  const saved = JSON.parse(localStorage.getItem('dchecks_' + today) || '{}');
  saved[id] = !saved[id];
  localStorage.setItem('dchecks_' + today, JSON.stringify(saved));
  renderDChecks();
}

window.saveDChecks = function() {
  const today = new Date().toDateString();
  const saved = JSON.parse(localStorage.getItem('dchecks_' + today) || '{}');
  const done = Object.values(saved).filter(Boolean).length;
  alert(`Checklist tersimpan! ${done}/${_checkItems.length} selesai. Tetap istiqamah 💪`);
};

window.resetDChecks = function() {
  const today = new Date().toDateString();
  localStorage.removeItem('dchecks_' + today);
  renderDChecks();
};

/* ── English Streak ── */
const _engDayNames = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const _engFocus    = ['🏠','🎧','✍️','⚡','📖','🎙️','🌿'];
const _engBadges   = ['🌱','🌿','⭐','🔥','🔥','🏆','🏆'];
const _engMsgs     = ['Mulai hari ini!','Bagus, lanjutkan!','Momentum terbentuk!','Luar biasa!','Hampir sempurna!','Konsisten sekali!','Sempurna minggu ini! 🎉'];

function _getWeekKey() {
  const now = new Date(), s = new Date(now);
  s.setDate(now.getDate() - now.getDay());
  return 'eng_' + s.toDateString();
}

function renderEngWeek() {
  const wk = _getWeekKey();
  const states = JSON.parse(localStorage.getItem(wk) || '["","","","","","",""]');
  const done = states.filter(s => s === 'done').length;
  const sEl = document.getElementById('eng-streak');
  const lEl = document.getElementById('eng-streak-lbl');
  const bEl = document.getElementById('eng-badge');
  if (sEl) sEl.textContent = done;
  if (lEl) lEl.textContent = 'hari · ' + _engMsgs[Math.min(done, 6)];
  if (bEl) bEl.textContent = _engBadges[Math.min(done, 6)];
  const grid = document.getElementById('eng-week-dots');
  if (!grid) return;
  grid.innerHTML = '';
  _engDayNames.forEach((d, i) => {
    const wrap = document.createElement('div'); wrap.className = 'eng-wdot-wrap';
    const dot  = document.createElement('div');
    dot.className = 'eng-wdot' + (states[i]==='done'?' done':states[i]==='skip'?' skip':'');
    dot.textContent = states[i]==='done' ? '✓' : states[i]==='skip' ? '✗' : _engFocus[i];
    dot.onclick = () => {
      if (states[i]==='')     states[i] = 'done';
      else if (states[i]==='done') states[i] = 'skip';
      else states[i] = '';
      localStorage.setItem(wk, JSON.stringify(states));
      renderEngWeek();
    };
    const lbl = document.createElement('div'); lbl.className = 'eng-wdot-lbl'; lbl.textContent = d;
    wrap.appendChild(dot); wrap.appendChild(lbl); grid.appendChild(wrap);
  });
}

window.saveEngStreak = function() {
  const wk = _getWeekKey();
  const states = JSON.parse(localStorage.getItem(wk) || '["","","","","","",""]');
  const dow = new Date().getDay();
  if (states[dow] !== 'done') {
    states[dow] = 'done';
    localStorage.setItem(wk, JSON.stringify(states));
    renderEngWeek();
  }
  alert('Keren! Sesi hari ini ditandai selesai 💪');
};

window.resetEngWeek = function() {
  localStorage.removeItem(_getWeekKey());
  renderEngWeek();
};

/* ── Init fungsi-fungsi dashboard ── */
function initDashboard() {
  renderDDateTime();
  renderDTimeline();
  renderDReminder();
  renderDChecks();
  renderEngWeek();
  setInterval(renderDDateTime, 30000);
  setInterval(renderDTimeline, 60000);
}

/* Sambungkan ke initApp yang sudah ada */
const _origInitApp = window.initApp;
window.initApp = function() {
  if (_origInitApp) _origInitApp();
  initDashboard();
};

/* Override showView untuk refresh data saat pindah tab */
const _origShowViewDash = window.showView;
window.showView = function(id) {
  if (_origShowViewDash) _origShowViewDash(id);
  if (id === 'today')   { renderDDateTime(); renderDTimeline(); renderDChecks(); renderDReminder(); }
  if (id === 'english') { renderEngWeek(); }
};
