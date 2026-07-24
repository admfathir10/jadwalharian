/* ============================================
   JADWAL KELUARGA — script.js
   Live clock + Sedang Berlangsung + To-Do
   dengan deadline & persistensi permanen
   ============================================ */

/* ========================
   TO-DO — Storage
   ======================== */
const STORAGE_KEY = 'todos_keluarga';

function loadTodos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveTodos(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

let todos        = loadTodos();
let activeWho    = 'suami';
let activeFilter = 'semua';

/* ========================
   Date helpers
   ======================== */
// "YYYY-MM-DD" string untuk hari ini
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Bandingkan tanggal deadline (string YYYY-MM-DD) dengan hari ini
// return: 'lewat' | 'hari-ini' | 'besok' | 'mendatang' | null
function deadlineStatus(deadline) {
  if (!deadline) return null;
  const today = todayStr();
  if (deadline < today) return 'lewat';
  if (deadline === today) return 'hari-ini';
  const tom = new Date(); tom.setDate(tom.getDate()+1);
  const tomStr = `${tom.getFullYear()}-${String(tom.getMonth()+1).padStart(2,'0')}-${String(tom.getDate()).padStart(2,'0')}`;
  if (deadline === tomStr) return 'besok';
  return 'mendatang';
}

// Format "YYYY-MM-DD" → "Sen, 14 Jul"
function fmtDeadline(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-').map(Number);
  const dt   = new Date(y, m-1, d);
  const hari = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'][dt.getDay()];
  const bln  = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'][m-1];
  const today = todayStr();
  if (str === today) return 'Hari ini';
  const tom = new Date(); tom.setDate(tom.getDate()+1);
  const tomStr = `${tom.getFullYear()}-${String(tom.getMonth()+1).padStart(2,'0')}-${String(tom.getDate()).padStart(2,'0')}`;
  if (str === tomStr) return 'Besok';
  return `${hari}, ${d} ${bln}`;
}

// Format timestamp → jam atau "Sen 14/7 07:30"
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

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ========================
   Add todo
   ======================== */
window.addTodo = function () {
  const input    = document.getElementById('todo-input');
  const deadline = document.getElementById('todo-deadline');
  const text     = input.value.trim();
  if (!text) { input.focus(); return; }

  todos.push({
    id:        Date.now(),
    text,
    who:       activeWho,
    done:      false,
    deadline:  deadline?.value || null,
    createdAt: Date.now(),
    doneAt:    null
  });
  saveTodos(todos);
  renderTodos();
  input.value    = '';
  if (deadline) deadline.value = '';
  input.focus();
};

/* ========================
   Toggle done
   ======================== */
window.toggleTodo = function (id) {
  todos = todos.map(t => {
    if (t.id !== id) return t;
    const nowDone = !t.done;
    return { ...t, done: nowDone, doneAt: nowDone ? Date.now() : null };
  });
  saveTodos(todos);
  renderTodos();
};

/* ========================
   Delete todo
   ======================== */
window.deleteTodo = function (id) {
  todos = todos.filter(t => t.id !== id);
  saveTodos(todos);
  renderTodos();
};

/* ========================
   Clear done
   ======================== */
window.clearDone = function () {
  const count = todos.filter(t => t.done).length;
  if (!count) return;
  if (!confirm(`Hapus ${count} tugas yang sudah selesai?`)) return;
  todos = todos.filter(t => !t.done);
  saveTodos(todos);
  renderTodos();
};

/* ========================
   Set who / filter
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
      filtered = filtered.filter(t => t.done);
      break;
    case 'hari-ini':
      filtered = filtered.filter(t => !t.done && t.deadline === today);
      break;
    case 'terlambat':
      filtered = filtered.filter(t => !t.done && t.deadline && t.deadline < today);
      break;
    case 'suami':
    case 'istri':
    case 'bersama':
      filtered = filtered.filter(t => t.who === activeFilter && !t.done);
      break;
  }

  // Urutan: terlambat → hari ini → besok → mendatang → tanpa deadline → selesai
  const rank = t => {
    if (t.done) return 99;
    const s = deadlineStatus(t.deadline);
    if (s === 'lewat')     return 0;
    if (s === 'hari-ini')  return 1;
    if (s === 'besok')     return 2;
    if (s === 'mendatang') return 3;
    return 4; // no deadline
  };

  filtered.sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    // same rank: deadline asc, then createdAt desc
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

/* ========================
   Build todo element
   ======================== */
function buildTodoEl(item) {
  const div = document.createElement('div');
  const ds  = deadlineStatus(item.deadline);
  const isLate = !item.done && ds === 'lewat';
  const isToday = !item.done && ds === 'hari-ini';

  div.className = 'todo-item'
    + (item.done   ? ' done'    : '')
    + (isLate      ? ' overdue' : '')
    + (isToday     ? ' today'   : '');
  div.setAttribute('data-who', item.who);

  const whoLabel = { suami: 'Fathir', istri: 'Salma', bersama: 'Bersama' };
  const tagClass = { suami: 'tag-suami', istri: 'tag-istri', bersama: 'tag-bersama' };

  // Deadline badge HTML
  let deadlineBadge = '';
  if (item.deadline && !item.done) {
    const label = fmtDeadline(item.deadline);
    const cls   = ds === 'lewat'    ? 'dl-overdue'
                : ds === 'hari-ini' ? 'dl-today'
                : ds === 'besok'    ? 'dl-soon'
                :                    'dl-future';
    const icon  = ds === 'lewat'    ? '⚠️'
                : ds === 'hari-ini' ? '📅'
                : ds === 'besok'    ? '🔔'
                :                    '🗓️';
    deadlineBadge = `<span class="deadline-badge ${cls}">${icon} ${label}</span>`;
  } else if (item.deadline && item.done) {
    deadlineBadge = `<span class="deadline-badge dl-done">✓ ${fmtDeadline(item.deadline)}</span>`;
  }

  const createdStr = fmtTime(item.createdAt);
  const doneStr    = item.doneAt ? fmtTime(item.doneAt) : '';

  div.innerHTML = `
    <div class="todo-check" onclick="toggleTodo(${item.id})">
      <span class="todo-check-mark">✓</span>
    </div>
    <div class="todo-body">
      <div class="todo-text">${escHtml(item.text)}</div>
      <div class="todo-meta">
        <span class="todo-who-tag ${tagClass[item.who] || 'tag-bersama'}">${whoLabel[item.who] || 'Bersama'}</span>
        ${deadlineBadge}
        <span class="todo-time-tag">dibuat ${createdStr}</span>
        ${item.done && doneStr ? `<span class="todo-done-at">✓ selesai ${doneStr}</span>` : ''}
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

window.showView = function (id) {
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.main-tabs button').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + id).classList.add('active');
  document.getElementById('mtab-' + id).classList.add('active');
};

window.showDay = function (day, btn) {
  document.querySelectorAll('.day-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.day-tabs button').forEach(b => b.classList.remove('active'));
  document.getElementById('day-' + day).classList.add('active');
  btn.classList.add('active');
  highlightLiveBlocks();
};

window.showIstri = function (id, btn) {
  document.querySelectorAll('.istri-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.istri-tabs button').forEach(b => b.classList.remove('active'));
  document.getElementById('istri-' + id).classList.add('active');
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
  return p.length < 2 ? NaN : +p[0] * 60 + +p[1];
}

function getScheduleBlocks(panel) {
  const items = [];
  panel.querySelectorAll('.row').forEach(row => {
    const timeEl  = row.querySelector('.time');
    const blockEl = row.querySelector('.block');
    if (!timeEl || !blockEl) return;
    const min = parseTime(timeEl.textContent);
    if (!isNaN(min)) items.push({ startMin: min, blockEl });
  });
  items.forEach((it, i) => {
    it.endMin = i + 1 < items.length ? items[i+1].startMin : it.startMin + 60;
  });
  return items;
}

function highlightLiveBlocks() {
  document.querySelectorAll('.block').forEach(b => {
    b.classList.remove('live-now');
    b.querySelector('.live-badge')?.remove();
  });

  const now        = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const todayIdx   = now.getDay();

  const badge = () => {
    const s = document.createElement('span');
    s.className = 'live-badge';
    s.innerHTML = '<span class="live-dot"></span> sedang berlangsung';
    return s;
  };

  const activeDay = document.querySelector('.day-panel.active');
  if (activeDay) {
    const activeBtn = document.querySelector('.day-tabs button.active');
    if (activeBtn?.getAttribute('data-day') === ID_HARI[todayIdx]) {
      getScheduleBlocks(activeDay).forEach(it => {
        if (currentMin >= it.startMin && currentMin < it.endMin) {
          it.blockEl.classList.add('live-now');
          it.blockEl.appendChild(badge());
        }
      });
    }
  }

  const activeIstri = document.querySelector('.istri-panel.active');
  if (activeIstri) {
    const isWeekend = todayIdx === 0 || todayIdx === 6;
    const id = activeIstri.id;
    const match = (id === 'istri-weekend' && isWeekend) ||
                  (id === 'istri-kerja'   && !isWeekend);
    if (match) {
      getScheduleBlocks(activeIstri).forEach(it => {
        if (currentMin >= it.startMin && currentMin < it.endMin) {
          it.blockEl.classList.add('live-now');
          it.blockEl.appendChild(badge());
        }
      });
    }
  }
}

/* ========================
   Auto-select hari ini
   ======================== */
function autoSelectDay() {
  const today  = new Date().getDay();
  const hariId = ID_HARI[today];
  const btn    = document.querySelector(`.day-tabs button[data-day="${hariId}"]`);
  if (btn) {
    document.querySelectorAll('.day-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.day-tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById('day-' + hariId)?.classList.add('active');
    btn.classList.add('active');
  }
  const isWeekend = today === 0 || today === 6;
  const istriBtns = document.querySelectorAll('.istri-tabs button');
  document.querySelectorAll('.istri-panel').forEach(p => p.classList.remove('active'));
  istriBtns.forEach(b => b.classList.remove('active'));
  if (isWeekend) {
    document.getElementById('istri-weekend')?.classList.add('active');
    istriBtns[1]?.classList.add('active');
  } else {
    document.getElementById('istri-kerja')?.classList.add('active');
    istriBtns[0]?.classList.add('active');
  }
}

/* ========================
   Inject clock & date badge
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
  const d    = new Date();
  const hari = NAMA_HARI[d.getDay()];
  el.textContent = `${hari}, ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
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
  renderTodos();
  setInterval(updateClock, 1000);
  setInterval(highlightLiveBlocks, 30000);
});
