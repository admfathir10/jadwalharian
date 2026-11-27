/* ============================================
   RUMARA — script.js (FIXED)
   Bug fixes:
   1. PIN system unified — removed duplicate inline PIN, uses class-based unlock
   2. showDay() scoped to suami column only (tidak tabrakan dengan day-panel lain)
   3. pinBackspace alias added for backward compat with any remaining pinDel() calls
   ============================================ */

(function () {
  // ═══════════════════════════════════════════════════════
  // PIN AMAN — SHA-256 Hashing
  // PIN asli TIDAK tersimpan di sini. Hanya hash-nya.
  // Untuk ganti PIN:
  //   1. Buka https://emn178.github.io/online-tools/sha256.html
  //   2. Ketik PIN baru → copy hash-nya
  //   3. Ganti nilai PIN_HASH di bawah ini
  // ═══════════════════════════════════════════════════════
  const PIN_HASH    = 'b446cdb79227871c27c8b3bd88f7370d716e67416a6617f7bfde99600f248deb'; // SHA-256 dari PIN
  const PIN_ENABLED = false; // ← ubah ke true untuk menyalakan kunci PIN lagi
  const STORAGE_KEY = 'jk_pin_unlock';
  const ROLE_KEY    = 'jk_role';
  const ROLE_LABEL  = { suami: 'Suami', istri: 'Istri', keluarga: 'Keluarga' };
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

  function applyRole(role) {
    ['suami','istri','keluarga'].forEach(r => document.body.classList.remove('role-' + r));
    document.body.classList.add('role-' + role);
    window.currentRole = role;
    const who = document.getElementById('who-label');
    if (who) who.textContent = 'Masuk sebagai ' + (ROLE_LABEL[role] || role);
  }

  function unlockApp(role) {
    role = role || 'suami';
    applyRole(role);
    document.body.classList.add('app-unlocked');
    if (PIN_ENABLED) { try { localStorage.setItem(STORAGE_KEY, String(Date.now())); localStorage.setItem(ROLE_KEY, role); } catch(e) {} }
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

  // Fungsi hash SHA-256 menggunakan Web Crypto API (built-in browser, tanpa library)
  async function sha256(str) {
    const buf  = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  // PIN Istri & Keluarga: hash-nya disimpan di Firebase (/akses), diatur oleh Suami lewat tombol Akses.
  async function fetchAkses() {
    try {
      const r = await fetch(DATABASE_URL + 'akses.json');
      if (!r.ok) return null;
      return (await r.json()) || {};
    } catch (e) { return null; }
  }

  async function checkPin() {
    const inputHash = await sha256(enteredPin);
    let role = null;
    if (inputHash === PIN_HASH) role = 'suami';
    else {
      const akses = await fetchAkses();
      if (akses) {
        if (akses.istri && inputHash === akses.istri) role = 'istri';
        else if (akses.keluarga && inputHash === akses.keluarga) role = 'keluarga';
      }
    }
    if (role) {
      const errEl = document.getElementById('pin-error');
      if (errEl) errEl.textContent = '';
      unlockApp(role);
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

  // Kunci ulang aplikasi (ganti pengguna)
  window.kunciAplikasi = function() {
    try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(ROLE_KEY); } catch(e) {}
    location.reload();
  };

  // Panel Akses (hanya Suami): atur PIN Istri & Keluarga
  window.bukaAkses = async function() {
    if (window.currentRole !== 'suami') return;
    document.getElementById('akses-modal').classList.add('open');
    const info = document.getElementById('akses-info');
    info.textContent = 'Memuat…';
    const a = await fetchAkses();
    info.textContent = a === null ? 'Tidak bisa terhubung ke server. Coba lagi nanti.'
      : 'Istri: ' + (a.istri ? 'sudah diatur' : 'belum diatur') + ' · Keluarga: ' + (a.keluarga ? 'sudah diatur' : 'belum diatur');
  };
  window.tutupAkses = function() { document.getElementById('akses-modal').classList.remove('open'); };
  window.simpanAkses = async function() {
    if (window.currentRole !== 'suami') return;
    const info = document.getElementById('akses-info');
    const pi = document.getElementById('akses-istri').value.trim();
    const pk = document.getElementById('akses-keluarga').value.trim();
    const okFmt = v => v === '' || /^\d{6}$/.test(v);
    if (!okFmt(pi) || !okFmt(pk)) { info.textContent = 'PIN harus 6 angka (atau kosongkan untuk tidak diubah).'; return; }
    if (!pi && !pk) { info.textContent = 'Isi minimal satu PIN.'; return; }
    if ((pi && await sha256(pi) === PIN_HASH) || (pk && await sha256(pk) === PIN_HASH) || (pi && pk && pi === pk)) {
      info.textContent = 'Setiap PIN harus berbeda.'; return;
    }
    const cur = (await fetchAkses()) || {};
    if (pi) cur.istri = await sha256(pi);
    if (pk) cur.keluarga = await sha256(pk);
    try {
      const r = await fetch(DATABASE_URL + 'akses.json', { method: 'PUT', body: JSON.stringify(cur) });
      if (!r.ok) throw new Error('gagal');
      document.getElementById('akses-istri').value = '';
      document.getElementById('akses-keluarga').value = '';
      info.textContent = 'Tersimpan. Istri: ' + (cur.istri ? 'sudah diatur' : 'belum') + ' · Keluarga: ' + (cur.keluarga ? 'sudah diatur' : 'belum');
    } catch (e) { info.textContent = 'Gagal menyimpan. Periksa koneksi.'; }
  };

  document.addEventListener('DOMContentLoaded', function() {
    if (!PIN_ENABLED) {
      document.body.classList.add('pin-off');
      unlockApp('suami');
      return;
    }
    if (isRemembered()) {
      let r = 'suami';
      try { r = localStorage.getItem(ROLE_KEY) || 'suami'; } catch(e) {}
      unlockApp(r);
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
    setTimeout(initFinAllocFirebase, 0);
    setTimeout(initAgendaFirebase, 0);
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
  const tp = document.getElementById('todo-panel'); if (tp) tp.setAttribute('data-filter', filter);
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
  updateTodoCount();
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

  const whoLabel = { suami:atob('cmlodGFG').split('').reverse().join(''), istri:atob('YW1sYVM=').split('').reverse().join(''), bersama:'Bersama' };
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
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (id === 'finansial' && window.currentRole === 'keluarga') return; // Finansial privat: hanya Suami & Istri
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
  pickDay(ID_HARI[new Date().getDay()], true);
}

// Pilih hari: berlaku untuk jadwal Suami (per hari) dan Istri (hari kerja / akhir pekan)
window.pickDay = function(hariId, isAuto) {
  document.querySelectorAll('#day-picker button').forEach(b => {
    b.classList.toggle('active', b.dataset.day === hariId);
    b.classList.toggle('is-today', b.dataset.day === ID_HARI[new Date().getDay()]);
  });
  const suamiCard = document.querySelector('.col-card:first-child');
  if (suamiCard) {
    suamiCard.querySelectorAll('.day-panel').forEach(p => p.classList.remove('active'));
    suamiCard.querySelectorAll('.day-tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById('day-' + hariId)?.classList.add('active');
    suamiCard.querySelector(`.day-tabs button[data-day="${hariId}"]`)?.classList.add('active');
  }
  const isWE = hariId === 'sabtu' || hariId === 'minggu';
  const ib = document.querySelectorAll('.istri-tabs button');
  document.querySelectorAll('.istri-panel').forEach(p => p.classList.remove('active'));
  ib.forEach(b => b.classList.remove('active'));
  document.getElementById(isWE ? 'istri-weekend' : 'istri-kerja')?.classList.add('active');
  ib[isWE ? 1 : 0]?.classList.add('active');
  if (!isAuto) highlightLiveBlocks();
};

window.setPerson = function(p) {
  const g = document.getElementById('dual-grid');
  if (g) { g.classList.toggle('show-suami', p === 'suami'); g.classList.toggle('show-istri', p === 'istri'); }
  document.querySelectorAll('#person-toggle button').forEach(b => b.classList.toggle('active', b.dataset.p === p));
};

window.toggleTodo = function() {
  const panel = document.getElementById('todo-panel');
  if (!panel) return;
  const open = panel.classList.toggle('collapsed') === false;
  document.getElementById('todo-head')?.setAttribute('aria-expanded', String(open));
};

function updateTodoCount() {
  const el = document.getElementById('todo-count');
  if (!el) return;
  const n = todos.filter(t => !t.done).length;
  const late = todos.filter(t => !t.done && t.deadline && t.deadline < todayStr()).length;
  el.textContent = n ? `${n} belum selesai${late ? ` · ${late} terlambat` : ''}` : 'Semua beres 🎉';
  const hg = document.getElementById('hg-todo');
  if (hg) { hg.textContent = n ? `${n} belum selesai` : 'Semua beres'; hg.classList.toggle('late', late > 0); }
  const hd = document.getElementById('hg-date');
  if (hd) hd.textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
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
  renderMindset();
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
   MINDSET HARIAN — berganti tiap hari
   ================================================ */

const MINDSET_LIST = [
  {
    lama: "Rebahan dulu, nanti ngurusin keluarga kalau sudah tenang.",
    baru: "Keluarga dulu 40 menit, baru boleh rebahan.",
    icon: "❤️",
    tema: "Keluarga"
  },
  {
    lama: "Capek kerja, nanti saja bermain sama anak.",
    baru: "Anak butuh hadir, bukan sempurna. 10 menit penuh fokus lebih berharga dari 2 jam sambil pegang HP.",
    icon: "👦",
    tema: "Hadir"
  },
  {
    lama: "Tunggu penghasilan besar dulu, baru investasi.",
    baru: "Mulai kecil hari ini. Konsistensi kecil mengalahkan niat besar yang tidak dimulai.",
    icon: "💰",
    tema: "Finansial"
  },
  {
    lama: "Nanti saja belajar Inggris kalau ada waktu.",
    baru: "30 menit sehari sudah cukup. Waktu tidak datang — waktu dibuat.",
    icon: "🇬🇧",
    tema: "Belajar"
  },
  {
    lama: "Sholat nanti saja, masih banyak urusan.",
    baru: "Urusan tidak akan pernah habis. Sholat dulu, urusan mengikut.",
    icon: "🕌",
    tema: "Ibadah"
  },
  {
    lama: atob("YW1sYVM=").split("").reverse().join("")+" pasti mengerti kalau saya sibuk.",
    baru: "Date night bukan kemewahan — itu kebutuhan. Jumat malam adalah investasi pernikahan.",
    icon: "💑",
    tema: "Pernikahan"
  },
  {
    lama: "Olahraga bisa nanti, masih muda masih sehat.",
    baru: "Tubuh sehat adalah amanah. 20 menit pagi hari membangun energi seharian.",
    icon: "💪",
    tema: "Kesehatan"
  },
  {
    lama: "Toko bisa nomor satu dulu, keluarga menyusul.",
    baru: "Toko adalah alat, bukan tujuan. Tujuan adalah keluarga yang bahagia.",
    icon: "🛍️",
    tema: "Prioritas"
  },
  {
    lama: "Nanti kalau sudah tenang baru bersyukur.",
    baru: "Syukur bukan kondisi — syukur adalah pilihan. Mulai dari hal terkecil hari ini.",
    icon: "🌿",
    tema: "Syukur"
  },
  {
    lama: "Susah bangun malam, mending tidur terus.",
    baru: "Tahajud adalah percakapan paling sepi tapi paling didengar. Bangun 5 menit dulu.",
    icon: "🌙",
    tema: "Tahajud"
  },
  {
    lama: "Stres kerja, wajar kalau kurang sabar sama anak.",
    baru: "Anak menyerap energi yang kita bawa pulang. Ambil napas sebelum masuk pintu rumah.",
    icon: "🏠",
    tema: "Sabar"
  },
  {
    lama: "Nanti saja tilawah, sekarang masih banyak kerjaan.",
    baru: "Al-Qur'an adalah penawar, bukan penambah beban. 10 ayat setelah Subuh sudah cukup.",
    icon: "📖",
    tema: "Al-Qur'an"
  },
  {
    lama: "Dana darurat bisa nanti, kebutuhan sekarang lebih mendesak.",
    baru: "Dana darurat adalah ketenangan pikiran. Sisihkan sebelum dipakai, bukan dari sisa.",
    icon: "🛡️",
    tema: "Dana Darurat"
  },
  {
    lama: "Nanti kalau anak sudah besar baru diajarin agama.",
    baru: "Anak belajar dari apa yang dilihat setiap hari. Jadilah guru terbaik di rumah sendiri.",
    icon: "🌱",
    tema: "Mendidik"
  },
  {
    lama: "Saya kurang bakat berbahasa Inggris.",
    baru: "Bakat adalah mitos. Konsistensi 30 menit sehari lebih kuat dari bakat apapun.",
    icon: "⭐",
    tema: "Percaya Diri"
  },
  {
    lama: atob("ZXJvdHNuYWlyZWxpdHJB").split("").reverse().join("")+" bisa dikerjakan sendiri semua.",
    baru: "Delegasi bukan kelemahan — itu kecerdasan. Fokus pada yang hanya bisa kamu lakukan.",
    icon: "🎯",
    tema: "Delegasi"
  },
  {
    lama: "Kalau sudah kaya baru bisa sedekah banyak.",
    baru: "Sedekah bukan dari lebihnya harta, tapi dari keikhlasan hati. Mulai dari yang ada.",
    icon: "🤲",
    tema: "Sedekah"
  },
  {
    lama: "Liburan keluarga butuh biaya besar.",
    baru: "Alun-alun "+atob("aXJpZGVL").split("").reverse().join("")+" bersama keluarga lebih berharga dari resort tanpa hadir penuh.",
    icon: "🌳",
    tema: "Family Trip"
  },
  {
    lama: "Nanti saja evaluasi diri, masih sibuk.",
    baru: "Tanpa evaluasi, kerja keras hanya mengulang kesalahan. 10 menit malam ini sudah cukup.",
    icon: "🔍",
    tema: "Evaluasi"
  },
  {
    lama: "HP harus selalu dipegang, takut ketinggalan info.",
    baru: "Yang paling penting ada di depan mata — bukan di layar. HP bisa tunggu, momen tidak.",
    icon: "📵",
    tema: "Digital Detox"
  },
];

function renderMindset() {
  const el = document.getElementById('mindset-card');
  if (!el) return;
  // Satu quote per hari: berganti otomatis tiap tengah malam, sama untuk semua perangkat.
  const d = new Date();
  const dayIndex = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  const q = MINDSET_LIST[dayIndex % MINDSET_LIST.length];
  el.innerHTML = `
    <section class="quote-card" aria-label="Quote hari ini">
      <div class="quote-top"><span class="quote-ico">${q.icon}</span><span class="quote-label">Quote Hari Ini</span><span class="quote-tema">${q.tema}</span></div>
      <blockquote class="quote-text">“${q.baru}”</blockquote>
      <div class="quote-old">Bukan lagi: <em>${q.lama}</em></div>
    </section>`;
}

/* ════════════════════════════════════════════════
   FINANSIAL v2 — Tab switcher
   ════════════════════════════════════════════════ */
window.switchFinTab = function(tab, btn) {
  // Deactivate all tabs and panels
  document.querySelectorAll('.fin-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.fin-panel').forEach(p => p.classList.remove('active'));
  // Activate selected
  if (btn) btn.classList.add('active');
  const panel = document.getElementById('fin-panel-' + tab);
  if (panel) panel.classList.add('active');
};

/* ================================================
   FINANSIAL — Checklist Alokasi Dana (Firebase sync)
   Path: fin_alloc/YYYY-MM/{s1,s2,...,i1,i2,...}
   Key per bulan — otomatis kosong bulan depan
   ================================================ */

// Metadata: prefix → jumlah kategori
const FIN_CATS = { s: 8, i: 7 };

let finAllocRef  = null;
let finAllocData = {};

function getFinMonthKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
}

function initFinAllocFirebase() {
  try {
    finAllocRef = db.ref('fin_alloc/' + getFinMonthKey());
    // Real-time listener — update semua device seketika
    finAllocRef.on('value', snap => {
      finAllocData = snap.val() || {};
      renderFinAlloc();
    }, err => {
      console.warn('FinAlloc Firebase error:', err);
      loadFinAllocLocal();
    });
  } catch(e) {
    console.warn('initFinAllocFirebase error:', e);
    loadFinAllocLocal();
  }
}

function loadFinAllocLocal() {
  try {
    finAllocData = JSON.parse(localStorage.getItem('fin_alloc_' + getFinMonthKey()) || '{}');
  } catch { finAllocData = {}; }
  renderFinAlloc();
}

function renderFinAlloc() {
  Object.entries(FIN_CATS).forEach(([prefix, total]) => {
    let done = 0;

    for (let i = 1; i <= total; i++) {
      const key     = prefix + i;
      const checked = !!finAllocData[key];
      if (checked) done++;

      // Update tombol
      const btn = document.getElementById('finchk-' + key);
      if (btn) {
        btn.classList.toggle('done', checked);
        const icon = btn.querySelector('.fin-chk-icon');
        if (icon) icon.textContent = checked ? '✓' : '○';
      }

      // Update row background
      const row = document.getElementById('finrow-' + key);
      if (row) row.classList.toggle('alloc-done', checked);
    }

    // Update progress bar & label
    const bar   = document.getElementById('fin-bar-' + prefix);
    const label = document.getElementById('fin-label-' + prefix);
    const pct   = Math.round(done / total * 100);

    if (bar) bar.style.width = pct + '%';
    if (label) {
      if (done === total) {
        label.textContent = '✅ Semua ' + total + ' kategori selesai!';
        label.style.color = '#16a34a';
      } else {
        label.textContent = done + ' / ' + total + ' dialokasikan';
        label.style.color = '';
      }
    }
  });
}

window.toggleFinChk = function(key) {
  const newVal     = !finAllocData[key];
  finAllocData[key] = newVal;

  if (finAllocRef) {
    finAllocRef.child(key).set(newVal);
    // renderFinAlloc akan dipanggil otomatis oleh listener
  } else {
    try { localStorage.setItem('fin_alloc_' + getFinMonthKey(), JSON.stringify(finAllocData)); } catch {}
    renderFinAlloc();
  }
};

window.resetFinChk = function(prefix) {
  const who   = prefix === 's' ? 'Suami' : 'Istri';
  const total = FIN_CATS[prefix];
  if (!confirm('Reset checklist alokasi ' + who + ' bulan ini?')) return;

  for (let i = 1; i <= total; i++) delete finAllocData[prefix + i];

  if (finAllocRef) {
    const updates = {};
    for (let i = 1; i <= total; i++) updates[prefix + i] = null;
    finAllocRef.update(updates);
  } else {
    try { localStorage.setItem('fin_alloc_' + getFinMonthKey(), JSON.stringify(finAllocData)); } catch {}
    renderFinAlloc();
  }
};

/* ===== Tips & Trik ===== */
window.openTip = function(id) {
  ['sampah','cuci'].forEach(function(k){ var e=document.getElementById('tp-'+k); if(e) e.hidden = (k !== id); });
  var hub = document.getElementById('tp-hub'); if (hub) hub.hidden = !!id;
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
(function(){
  var TIPS = [
    'Tulang jangan ke wastafel. Taruh di wadah organik.',
    'Kerok sisa nasi dulu sebelum mencuci piring.',
    'Bilas kemasan sebelum masuk wadah anorganik.',
    'Minyak jelantah ditampung di botol, bukan dibuang ke saluran.',
    'Baterai dan lampu bekas masuk wadah B3 terpisah.',
    'Kosongkan wadah organik dapur tiap sore.',
    'Pasang saringan di wastafel, buang isinya tiap selesai.'
  ];
  document.addEventListener('DOMContentLoaded', function(){
    var el = document.getElementById('tp-today-text');
    if (el) el.textContent = TIPS[new Date().getDay() % TIPS.length];
  });
})();


/* ========================
   AGENDA KELUARGA — kalender + ringkasan mendatang
   (terpisah dari To-Do: agenda = kejadian terjadwal, bukan tugas yang dicentang)
   ======================== */
const AGENDA_KEY = 'agenda_keluarga';
let agendas = [];
let agendaRef = null;
let agView = new Date(); agView.setDate(1);
let agSel = todayStr();
const AG_WHO = { bersama: 'Bersama', suami: 'Suami', istri: 'Istri' };

function agLoadLocal() {
  try { const r = localStorage.getItem(AGENDA_KEY); agendas = r ? JSON.parse(r) : []; } catch (e) { agendas = []; }
}
function agSaveLocal() { try { localStorage.setItem(AGENDA_KEY, JSON.stringify(agendas)); } catch (e) {} }

function initAgendaFirebase() {
  try {
    agendaRef = db.ref('agenda');
    agendaRef.on('value', snap => {
      const raw = snap.val();
      agendas = raw ? Object.entries(raw).map(([fbKey, v]) => ({ ...v, fbKey })) : [];
      renderAgenda();
    }, () => { agendaRef = null; agLoadLocal(); renderAgenda(); });
  } catch (e) { agendaRef = null; }
}

function agSorted(list) {
  return [...list].sort((a, b) => (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99')));
}
function agDateLabel(ds, full) {
  const [y, m, d] = ds.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', full ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' });
}
function agRelative(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  const [ty, tm, td] = todayStr().split('-').map(Number);
  const diff = Math.round((new Date(y, m - 1, d) - new Date(ty, tm - 1, td)) / 86400000);
  if (diff === 0) return 'Hari ini';
  if (diff === 1) return 'Besok';
  return diff + ' hari lagi';
}

window.agMonth = function (n) {
  agView = new Date(agView.getFullYear(), agView.getMonth() + n, 1);
  renderAgenda();
};
window.agPick = function (ds) { agSel = ds; renderAgenda(); };

window.agAdd = function (e) {
  e.preventDefault();
  const title = document.getElementById('ag-title');
  const text = title.value.trim();
  if (!text) { title.focus(); return; }
  const item = {
    id: Date.now(), title: text, date: agSel,
    time: document.getElementById('ag-time').value || '',
    who: document.getElementById('ag-who').value || 'bersama',
    createdAt: Date.now()
  };
  if (agendaRef) { agendaRef.push(item); }
  else { agendas.push(item); agSaveLocal(); renderAgenda(); }
  title.value = ''; document.getElementById('ag-time').value = '';
  title.focus();
};

window.agDel = function (id) {
  const it = agendas.find(a => a.id === id);
  if (!it) return;
  if (agendaRef && it.fbKey) { agendaRef.child(it.fbKey).remove(); }
  else { agendas = agendas.filter(a => a.id !== id); agSaveLocal(); renderAgenda(); }
};

function agItemHtml(a, withDate) {
  return `<div class="ag-item ag-${escHtml(a.who || 'bersama')}">
    <button type="button" class="ag-itembody" onclick="agPick('${escHtml(a.date)}')">
      <span class="ag-itemtitle">${escHtml(a.title)}</span>
      <span class="ag-meta">${withDate ? escHtml(agDateLabel(a.date)) + ' · ' : ''}${a.time ? escHtml(a.time) + ' · ' : ''}${escHtml(AG_WHO[a.who] || 'Bersama')}</span>
    </button>
    ${withDate ? `<span class="ag-rel">${escHtml(agRelative(a.date))}</span>` : `<button type="button" class="ag-del" onclick="agDel(${Number(a.id)})" aria-label="Hapus agenda ${escHtml(a.title)}">✕</button>`}
  </div>`;
}

function agDiff(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  const [ty, tm, td] = todayStr().split('-').map(Number);
  return Math.round((new Date(y, m - 1, d) - new Date(ty, tm - 1, td)) / 86400000);
}

window.agOpen = function (ds) {
  agSel = ds;
  const [y, m] = ds.split('-').map(Number);
  agView = new Date(y, m - 1, 1);
  showView('bersama');
  renderAgenda();
  const c = document.getElementById('agenda-card');
  if (c) c.scrollIntoView({ block: 'start' });
};

function renderAgendaRemind() {
  const box = document.getElementById('agenda-remind');
  if (!box) return;
  const today = todayStr();
  const up = agSorted(agendas.filter(a => a.date >= today));
  if (!up.length) {
    box.innerHTML = `<button type="button" class="ag-rcard" onclick="agOpen('${today}')"><div class="ag-rtop"><div class="ag-rico" aria-hidden="true">📆</div><div class="ag-rtxt"><div class="ag-rlabel">AGENDA TERDEKAT</div><div class="ag-rtitle">Belum ada agenda</div><div class="ag-rmeta">Ketuk untuk menambah di tab Bersama</div></div></div></button>`;
    return;
  }
  const first = up[0];
  const dd = agDiff(first.date);
  const near = dd <= 1;
  const more = up.slice(1, 3);
  const meta = agDateLabel(first.date) + (first.time ? ' · ' + first.time : '') + ' · ' + (AG_WHO[first.who] || 'Bersama');
  box.innerHTML = `<button type="button" class="ag-rcard${near ? ' soon' : ''}" onclick="agOpen('${escHtml(first.date)}')" aria-label="Agenda terdekat: ${escHtml(first.title)}, ${escHtml(agRelative(first.date))}">
    <div class="ag-rtop">
      <div class="ag-rico" aria-hidden="true">${near ? '🔔' : '📆'}</div>
      <div class="ag-rtxt"><div class="ag-rlabel">AGENDA TERDEKAT</div><div class="ag-rtitle">${escHtml(first.title)}</div><div class="ag-rmeta">${escHtml(meta)}</div></div>
      <div class="ag-rbadge">${escHtml(agRelative(first.date))}</div>
    </div>
    ${more.length ? '<div class="ag-rmore">' + more.map(a => `<div class="ag-rline"><span>${escHtml(a.title)}</span><span>${escHtml(agRelative(a.date))}</span></div>`).join('') + '</div>' : ''}
  </button>`;
}

function renderAgenda() {
  renderAgendaRemind();
  const grid = document.getElementById('ag-grid');
  if (!grid) return;
  const y = agView.getFullYear(), m = agView.getMonth();
  document.getElementById('ag-month').textContent = agView.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const first = (new Date(y, m, 1).getDay() + 6) % 7;      // Senin = 0
  const days = new Date(y, m + 1, 0).getDate();
  const today = todayStr();
  const byDate = {};
  agendas.forEach(a => { (byDate[a.date] = byDate[a.date] || []).push(a); });
  let html = '';
  for (let i = 0; i < first; i++) html += '<span class="ag-cell ag-empty"></span>';
  for (let d = 1; d <= days; d++) {
    const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const n = (byDate[ds] || []).length;
    const cls = 'ag-cell' + (ds === today ? ' is-today' : '') + (ds === agSel ? ' is-sel' : '') + (n ? ' has' : '');
    html += `<button type="button" class="${cls}" onclick="agPick('${ds}')" aria-label="${escHtml(agDateLabel(ds, true))}${n ? ', ' + n + ' agenda' : ''}"><span>${d}</span>${n ? '<i></i>' : ''}</button>`;
  }
  grid.innerHTML = html;

  document.getElementById('ag-daytitle').textContent = agDateLabel(agSel, true) + (agSel === today ? ' · Hari ini' : '');
  const dayItems = agSorted(byDate[agSel] || []);
  document.getElementById('ag-daylist').innerHTML = dayItems.length
    ? dayItems.map(a => agItemHtml(a, false)).join('')
    : '<div class="ag-none">Belum ada agenda di tanggal ini.</div>';

  const soon = agSorted(agendas.filter(a => a.date >= today)).slice(0, 5);
  document.getElementById('ag-soonlist').innerHTML = soon.length
    ? soon.map(a => agItemHtml(a, true)).join('')
    : '<div class="ag-none">Belum ada agenda mendatang. Pilih tanggal di kalender lalu tambah.</div>';
}

agLoadLocal();
renderAgenda();


/* ========================
   Petunjuk ringkas: ikon ? / catatan -> popup kecil (hemat ruang)
   ======================== */
(function () {
  let pop = null, anchor = null, openedAt = 0;
  function close() { if (pop) { pop.remove(); pop = null; } if (anchor) { anchor.setAttribute('aria-expanded', 'false'); anchor = null; } }
  function open(btn) {
    close();
    pop = document.createElement('div');
    pop.className = 'hint-pop'; pop.setAttribute('role', 'tooltip');
    pop.textContent = btn.getAttribute('data-hint') || '';
    document.body.appendChild(pop);
    anchor = btn; openedAt = Date.now(); btn.setAttribute('aria-expanded', 'true');
    const r = btn.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = Math.min(Math.max(12, r.left + r.width / 2 - pw / 2), window.innerWidth - pw - 12);
    let top = r.bottom + 8;
    if (top + ph > window.innerHeight - 12) top = Math.max(12, r.top - ph - 8);
    pop.style.left = (left + window.scrollX) + 'px';
    pop.style.top = (top + window.scrollY) + 'px';
  }
  document.addEventListener('click', function (e) {
    const b = e.target.closest('.hint, .hint-chip');
    if (b) { e.preventDefault(); e.stopPropagation(); (anchor === b) ? close() : open(b); return; }
    close();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  window.addEventListener('scroll', function () { if (Date.now() - openedAt > 400) close(); }, { passive: true });
  window.addEventListener('resize', close);

  // Catatan panjang di bawah jadwal -> satu tombol kecil "Catatan"
  function compactNotes() {
    document.querySelectorAll('.note:not([data-compact])').forEach(function (n) {
      if (n.closest('#todo-panel')) return;
      n.setAttribute('data-compact', '1');
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'hint-chip';
      b.setAttribute('data-hint', n.textContent.trim()); b.setAttribute('aria-expanded', 'false');
      b.innerHTML = '<span aria-hidden="true">ⓘ</span> Catatan';
      n.parentNode.insertBefore(b, n);
      n.hidden = true;
    });
  }
  compactNotes();
})();


/* ========================
   RUMARA — pasang di HP (PWA)
   ======================== */
(function () {
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  const bar = document.getElementById('install-bar');
  if (!bar) return;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  let dismissed = false;
  try { dismissed = localStorage.getItem('rumara_install_x') === '1'; } catch (e) {}
  if (standalone || dismissed) return;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const go = document.getElementById('install-go');
  const sub = document.getElementById('install-sub');
  let deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; bar.hidden = false; });
  window.addEventListener('appinstalled', function () { bar.hidden = true; });
  if (isIOS) {
    bar.hidden = false;
    sub.textContent = 'Lewat tombol Bagikan';
    go.textContent = 'Caranya';
    go.setAttribute('data-hint', 'Buka di Safari. Ketuk tombol Bagikan (kotak dengan panah ke atas), lalu pilih "Tambah ke Layar Utama" dan ketuk Tambah.');
    go.classList.add('hint-chip');
  } else {
    go.addEventListener('click', function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.finally(function () { deferred = null; bar.hidden = true; });
    });
  }
  document.getElementById('install-x').addEventListener('click', function () {
    bar.hidden = true;
    try { localStorage.setItem('rumara_install_x', '1'); } catch (e) {}
  });
})();

/* ========================
   RUMARA — pengingat (Web Push)
   Langganan disimpan di Firebase 'push_subs'; pengiriman oleh GitHub Actions (scripts/send-push.mjs)
   ======================== */
(function () {
  const VAPID_PUBLIC = 'BEF3ASpSO1Zpyg8ZhF4Nk2IyYjjF0zQKbCtdQ2e4wHs339iI_kCPmiHDc8787KS7cfJET9s7AVHv8L9GToKzOrQ';
  const bar = document.getElementById('push-bar');
  if (!bar) return;
  if (!window.isSecureContext) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
  const go = document.getElementById('push-go');
  const sel = document.getElementById('push-who');
  const x = document.getElementById('push-x');
  const sub = bar.querySelector('.install-txt b');
  let dismissed = false;
  try { dismissed = localStorage.getItem('rumara_push_x') === '1'; } catch (e) {}

  function u8(b64) {
    const pad = '='.repeat((4 - b64.length % 4) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, function (c) { return c.charCodeAt(0); });
  }
  async function idOf(endpoint) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
    return Array.from(new Uint8Array(buf)).slice(0, 10).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  function waitDb(cb, tries) {
    if (typeof db !== 'undefined' && db) return cb(db);
    if ((tries || 0) > 40) return cb(null);
    setTimeout(function () { waitDb(cb, (tries || 0) + 1); }, 250);
  }
  function save(subscription, who) {
    return new Promise(function (resolve) {
      waitDb(function (d) {
        if (!d) return resolve(false);
        idOf(subscription.endpoint).then(function (id) {
          d.ref('push_subs/' + id).set({ sub: subscription.toJSON(), who: who, ts: Date.now() })
            .then(function () { resolve(true); }, function () { resolve(false); });
        });
      });
    });
  }
  function done(msg) {
    sub.textContent = msg;
    sel.parentNode.style.display = 'none';
    go.hidden = true;
    setTimeout(function () { bar.hidden = true; }, 3500);
  }

  navigator.serviceWorker.ready.then(function (reg) {
    reg.pushManager.getSubscription().then(function (existing) {
      if (existing) {
        // sudah aktif: pastikan tersimpan, lalu sembunyikan ajakan
        try { var w = localStorage.getItem('rumara_push_who'); if (w) save(existing, w); } catch (e) {}
        return;
      }
      if (dismissed || Notification.permission === 'denied') return;
      try { var last = localStorage.getItem('rumara_push_who'); if (last) sel.value = last; else if (window.currentRole === 'istri') sel.value = 'istri'; } catch (e) {}
      bar.hidden = false;
    });
    go.addEventListener('click', function () {
      go.disabled = true;
      Notification.requestPermission().then(function (perm) {
        if (perm !== 'granted') { go.disabled = false; done('Izin notifikasi ditolak'); return null; }
        return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(VAPID_PUBLIC) });
      }).then(function (subscription) {
        if (!subscription) return;
        try { localStorage.setItem('rumara_push_who', sel.value); } catch (e) {}
        return save(subscription, sel.value).then(function (ok) {
          done(ok ? 'Pengingat aktif ✓' : 'Gagal menyimpan, coba lagi nanti');
        });
      }).catch(function () { go.disabled = false; done('Gagal mengaktifkan pengingat'); });
    });
  });
  x.addEventListener('click', function () {
    bar.hidden = true;
    try { localStorage.setItem('rumara_push_x', '1'); } catch (e) {}
  });
})();
