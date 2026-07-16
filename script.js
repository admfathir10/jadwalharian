/* ============================================
   JADWAL KELUARGA — script.js (Premium Edition)
   Live clock + "Sedang Berlangsung" indicator
   ============================================ */

const NAMA_HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const ID_HARI   = ['minggu','senin','selasa','rabu','kamis','jumat','sabtu'];

/* ========================
   Switch main view
   ======================== */
function showView(id) {
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.main-tabs button').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + id).classList.add('active');
  document.getElementById('mtab-' + id).classList.add('active');
}

/* ========================
   Switch hari (suami)
   ======================== */
function showDay(day, btn) {
  document.querySelectorAll('.day-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.day-tabs button').forEach(b => b.classList.remove('active'));
  document.getElementById('day-' + day).classList.add('active');
  btn.classList.add('active');
  // Re-highlight live block for newly visible panel
  highlightLiveBlocks();
}

/* ========================
   Switch sub-tab Istri
   ======================== */
function showIstri(id, btn) {
  document.querySelectorAll('.istri-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.istri-tabs button').forEach(b => b.classList.remove('active'));
  document.getElementById('istri-' + id).classList.add('active');
  btn.classList.add('active');
  highlightLiveBlocks();
}

/* ========================
   Live clock (header)
   ======================== */
function updateClock() {
  const el = document.getElementById('live-clock');
  const dayEl = document.getElementById('live-day');
  if (!el) return;

  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  const ss = String(now.getSeconds()).padStart(2,'0');
  el.textContent = `${hh}:${mm}:${ss}`;
  if (dayEl) dayEl.textContent = NAMA_HARI[now.getDay()];
}

/* ========================
   Parse time string → total minutes
   "04.30" → 270, "21.30" → 1290
   ======================== */
function parseTime(str) {
  const clean = str.trim().replace(',','.');
  const parts = clean.split('.');
  if (parts.length < 2) return NaN;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/* ========================
   Collect all rows in a panel → [{startMin, endMin, blockEl}]
   End time = start time of next row; last row ends 60 min later
   ======================== */
function getScheduleBlocks(panel) {
  const rows = panel.querySelectorAll('.row');
  const items = [];

  rows.forEach(row => {
    const timeEl = row.querySelector('.time');
    const blockEl = row.querySelector('.block');
    if (!timeEl || !blockEl) return;
    const min = parseTime(timeEl.textContent);
    if (!isNaN(min)) items.push({ startMin: min, blockEl });
  });

  // Assign end times
  for (let i = 0; i < items.length; i++) {
    items[i].endMin = (i + 1 < items.length)
      ? items[i + 1].startMin
      : items[i].startMin + 60;
  }
  return items;
}

/* ========================
   Highlight live blocks
   ======================== */
function highlightLiveBlocks() {
  // Remove all existing badges & live class
  document.querySelectorAll('.block').forEach(b => {
    b.classList.remove('live-now');
    const badge = b.querySelector('.live-badge');
    if (badge) badge.remove();
  });

  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const todayIdx   = now.getDay(); // 0=Sun

  // ── SUAMI: find active day panel ──
  const activeDayPanel = document.querySelector('.day-panel.active');
  if (activeDayPanel) {
    // Only highlight if the tab shown matches today
    const activeBtn = document.querySelector('.day-tabs button.active');
    const shownDay  = activeBtn ? activeBtn.getAttribute('data-day') : null;
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

  // ── ISTRI: find active istri panel ──
  const activeIstriPanel = document.querySelector('.istri-panel.active');
  if (activeIstriPanel) {
    const isWeekend = (todayIdx === 0 || todayIdx === 6);
    const shownId   = activeIstriPanel.id; // 'istri-kerja' or 'istri-weekend'
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
   Auto-select today's tab
   ======================== */
function autoSelectDay() {
  const today  = new Date().getDay();
  const hariId = ID_HARI[today];
  const btn    = document.querySelector(`.day-tabs button[data-day="${hariId}"]`);
  if (btn) {
    document.querySelectorAll('.day-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.day-tabs button').forEach(b => b.classList.remove('active'));
    const panel = document.getElementById('day-' + hariId);
    if (panel) panel.classList.add('active');
    btn.classList.add('active');
  }

  // Auto-select istri tab based on today
  const isWeekend = (today === 0 || today === 6);
  const istriBtns = document.querySelectorAll('.istri-tabs button');
  const istirPanels = document.querySelectorAll('.istri-panel');
  istirPanels.forEach(p => p.classList.remove('active'));
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
   Inject live clock into header
   ======================== */
function injectClock() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const clockDiv = document.createElement('div');
  clockDiv.className = 'header-clock';
  clockDiv.innerHTML = '<span id="live-clock">--:--:--</span><span class="header-clock-day" id="live-day"></span>';
  header.appendChild(clockDiv);
}

/* ========================
   Init
   ======================== */
document.addEventListener('DOMContentLoaded', function () {
  injectClock();
  autoSelectDay();
  updateClock();
  highlightLiveBlocks();

  // Update clock every second
  setInterval(updateClock, 1000);
  // Update live highlight every 30 seconds
  setInterval(highlightLiveBlocks, 30000);
});
