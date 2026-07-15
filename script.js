/* ============================================
   JADWAL KELUARGA — script.js
   ============================================ */

/* === Switch main view (Jadwal Hari / Momen Bersama) === */
function showView(id) {
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.main-tabs button').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + id).classList.add('active');
  document.getElementById('mtab-' + id).classList.add('active');
}

/* === Switch hari di kolom Suami === */
function showDay(day, btn) {
  document.querySelectorAll('.day-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.day-tabs button').forEach(b => b.classList.remove('active'));
  document.getElementById('day-' + day).classList.add('active');
  btn.classList.add('active');
}

/* === Switch sub-tab Istri (kerja / weekend) === */
function showIstri(id, btn) {
  document.querySelectorAll('.istri-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.istri-tabs button').forEach(b => b.classList.remove('active'));
  document.getElementById('istri-' + id).classList.add('active');
  btn.classList.add('active');
}

/* === Auto-select hari berdasarkan hari ini === */
function autoSelectDay() {
  const hariMap = {
    0: 'minggu',
    1: 'senin',
    2: 'selasa',
    3: 'rabu',
    4: 'kamis',
    5: 'jumat',
    6: 'sabtu'
  };
  const today = new Date().getDay();
  const hariId = hariMap[today];
  const targetBtn = document.querySelector(`.day-tabs button[data-day="${hariId}"]`);
  if (targetBtn) {
    document.querySelectorAll('.day-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.day-tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById('day-' + hariId).classList.add('active');
    targetBtn.classList.add('active');
  }
}

/* === Init === */
document.addEventListener('DOMContentLoaded', function () {
  autoSelectDay();
});
