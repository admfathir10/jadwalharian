/* ============================================
   JADWAL KELUARGA — script.js
   Live clock + Sedang Berlangsung + To-Do Harian
   (localStorage per hari, otomatis reset besok)
   ============================================ */

/* ========================
   TO-DO — State & Storage
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

let todos      = loadTodos();   // [{id, text, who, done, createdAt, doneAt}]
let activeWho  = 'suami';
let activeFilter = 'semua';

/* ========================
   Add todo
   ======================== */
window.addTodo = function () {
  const input = document.getElementById('todo-input');
  const text  = input.value.trim();
  if (!text) { input.focus(); return; }

  todos.push({
    id:        Date.now(),
    text,
    who:       activeWho,
    done:      false,
    createdAt: Date.now(),
    doneAt:    null
  });
  saveTodos(todos);
  renderTodos();
  input.value = '';
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
   Set who
   ======================== */
window.setWho = function (who, btn) {
  activeWho = who;
  document.querySelectorAll('.who-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
};

/* ========================
   Set filter
   ======================== */
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

  let filtered = [...todos];
  if (activeFilter === 'selesai') {
    filtered = filtered.filter(t => t.done);
  } else if (activeFilter !== 'semua') {
    filtered = filtered.filter(t => t.who === activeFilter && !t.done);
  }

  // Undone dulu (terbaru di atas), done belakangan
  filtered.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
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
  div.className = 'todo-item' + (item.done ? ' done' : '');
  div.setAttribute('data-who', item.who);

  const whoLabel = { suami: 'Fathir', istri: 'Salma', bersama: 'Bersama' };
  const tagClass = { suami: 'tag-suami', istri: 'tag-istri', bersama: 'tag-bersama' };
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
        <span class="todo-time-tag">${createdStr}</span>
        ${item.done && doneStr ? `<span class="todo-done-at">✓ selesai ${doneStr}</span>` : ''}
      </div>
    </div>
    <button class="todo-delete" onclick="deleteTodo(${item.id})" title="Hapus">✕</button>
  `;
  return div;
}

/* ========================
   Helpers
   ======================== */
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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

/* ========================
   JADWAL — view / hari / istri
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
  const hh  = String(now.getHours()).padStart(2,'0');
  const mm  = String(now.getMinutes()).padStart(2,'0');
  const ss  = String(now.getSeconds()).padStart(2,'0');
  el.textContent = `${hh}:${mm}:${ss}`;
  if (dayEl) dayEl.textContent = NAMA_HARI[now.getDay()];
}

/* ========================
   Sedang berlangsung
   ======================== */
function parseTime(str) {
  const clean = str.trim().replace(',','.');
  const parts = clean.split('.');
  if (parts.length < 2) return NaN;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function getScheduleBlocks(panel) {
  const rows  = panel.querySelectorAll('.row');
  const items = [];
  rows.forEach(row => {
    const timeEl  = row.querySelector('.time');
    const blockEl = row.querySelector('.block');
    if (!timeEl || !blockEl) return;
    const min = parseTime(timeEl.textContent);
    if (!isNaN(min)) items.push({ startMin: min, blockEl });
  });
  for (let i = 0; i < items.length; i++) {
    items[i].endMin = i + 1 < items.length ? items[i+1].startMin : items[i].startMin + 60;
  }
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

  const activeDayPanel = document.querySelector('.day-panel.active');
  if (activeDayPanel) {
    const activeBtn = document.querySelector('.day-tabs button.active');
    const shownDay  = activeBtn?.getAttribute('data-day');
    if (shownDay && shownDay === ID_HARI[todayIdx]) {
      getScheduleBlocks(activeDayPanel).forEach(item => {
        if (currentMin >= item.startMin && currentMin < item.endMin) {
          item.blockEl.classList.add('live-now');
          const badge = document.createElement('span');
          badge.className = 'live-badge';
          badge.innerHTML = '<span class="live-dot"></span> sedang berlangsung';
          item.blockEl.appendChild(badge);
        }
      });
    }
  }

  const activeIstriPanel = document.querySelector('.istri-panel.active');
  if (activeIstriPanel) {
    const isWeekend = (todayIdx === 0 || todayIdx === 6);
    const shownId   = activeIstriPanel.id;
    const matchDay  = (shownId === 'istri-weekend' && isWeekend) ||
                      (shownId === 'istri-kerja'   && !isWeekend);
    if (matchDay) {
      getScheduleBlocks(activeIstriPanel).forEach(item => {
        if (currentMin >= item.startMin && currentMin < item.endMin) {
          item.blockEl.classList.add('live-now');
          const badge = document.createElement('span');
          badge.className = 'live-badge';
          badge.innerHTML = '<span class="live-dot"></span> sedang berlangsung';
          item.blockEl.appendChild(badge);
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
  const isWeekend = (today === 0 || today === 6);
  const istriBtns = document.querySelectorAll('.istri-tabs button');
  document.querySelectorAll('.istri-panel').forEach(p => p.classList.remove('active'));
  istriBtns.forEach(b => b.classList.remove('active'));
  if (isWeekend) {
    document.getElementById('istri-weekend')?.classList.add('active');
    if (istriBtns[1]) istriBtns[1].classList.add('active');
  } else {
    document.getElementById('istri-kerja')?.classList.add('active');
    if (istriBtns[0]) istriBtns[0].classList.add('active');
  }
}

/* ========================
   Inject live clock
   ======================== */
function injectClock() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const div = document.createElement('div');
  div.className = 'header-clock';
  div.innerHTML = '<span id="live-clock">--:--:--</span><span class="header-clock-day" id="live-day"></span>';
  header.appendChild(div);
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

function injectDateBadge() {
  const el = document.getElementById('todo-date-badge');
  if (!el) return;
  const d    = new Date();
  const hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][d.getDay()];
  const tgl  = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
  el.textContent = `${hari}, ${tgl}`;
}
