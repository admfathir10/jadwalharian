// Logika pengingat Rumara (murni, tanpa jaringan) — dipakai send-push.mjs dan dites di test-push.mjs
// Semua waktu memakai WIB (UTC+7).

export const WIB = 7 * 3600 * 1000;

export function wibParts(ms) {
  const d = new Date(ms + WIB);
  const p = n => String(n).padStart(2, '0');
  return {
    date: d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes()
  };
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  const p = x => String(x).padStart(2, '0');
  return t.getUTCFullYear() + '-' + p(t.getUTCMonth() + 1) + '-' + p(t.getUTCDate());
}

// ms (UTC) dari tanggal + jam WIB
export function wibMs(dateStr, hhmm) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (hhmm || '00:00').split(':').map(Number);
  return Date.UTC(y, m - 1, d, hh, mm) - WIB;
}

const WHO_LABEL = { bersama: 'Bersama', suami: 'Suami', istri: 'Istri' };

// agenda untuk satu pelanggan: yang "bersama" + yang cocok dengan pilihannya
function forSub(a, sub) {
  if (!a || !a.date || !a.title) return false;
  if (a.who === 'suami' || a.who === 'istri') return sub.who === a.who;
  return true;
}

function line(a) {
  return (a.time ? a.time + ' ' : '') + a.title;
}

const sortAg = (x, y) => (x.time || '99:99').localeCompare(y.time || '99:99');

/**
 * Susun pesan yang perlu dikirim sekarang.
 * agendas: array {fbKey, title, date:'YYYY-MM-DD', time:'HH:MM'|'', who}
 * subs: { subId: {who:'suami'|'istri'|'bersama', sub:{...}} }
 * sent: { key: timestamp }
 * return: [{subId, key, title, body, tag}]
 */
export function planMessages({ agendas, subs, sent, nowMs }) {
  const out = [];
  const { date: today, hour } = wibParts(nowMs);
  const tomorrow = addDays(today, 1);
  const seen = sent || {};

  for (const [subId, rec] of Object.entries(subs || {})) {
    if (!rec || !rec.sub) continue;
    const mine = (agendas || []).filter(a => forSub(a, rec));

    // 1) Ringkasan pagi: jam 06.00–08.59 WIB (rentang lebar karena jadwal GitHub bisa telat)
    if (hour >= 6 && hour < 9) {
      const key = 'pagi_' + today + '_' + subId;
      const list = mine.filter(a => a.date === today).sort(sortAg);
      if (list.length && !seen[key]) {
        out.push({
          subId, key, tag: 'pagi',
          title: list.length === 1 ? 'Agenda hari ini' : list.length + ' agenda hari ini',
          body: list.slice(0, 4).map(line).join('\n') + (list.length > 4 ? '\n+' + (list.length - 4) + ' lagi' : '')
        });
      }
    }

    // 2) Pengingat malam untuk besok: jam 19.00–21.59 WIB
    if (hour >= 19 && hour < 22) {
      const key = 'malam_' + today + '_' + subId;
      const list = mine.filter(a => a.date === tomorrow).sort(sortAg);
      if (list.length && !seen[key]) {
        out.push({
          subId, key, tag: 'malam',
          title: 'Besok: ' + (list.length === 1 ? '1 agenda' : list.length + ' agenda'),
          body: list.slice(0, 4).map(line).join('\n') + (list.length > 4 ? '\n+' + (list.length - 4) + ' lagi' : '')
        });
      }
    }

    // 3) Satu jam sebelum agenda berjam (dari 60 menit sampai 5 menit lewat)
    for (const a of mine) {
      if (!a.time || a.date !== today || !a.fbKey) continue;
      const diffMin = (wibMs(a.date, a.time) - nowMs) / 60000;
      const key = 'jam_' + a.fbKey + '_' + subId;
      if (diffMin <= 60 && diffMin > -5 && !seen[key]) {
        const mins = Math.max(0, Math.round(diffMin));
        out.push({
          subId, key, tag: 'jam_' + a.fbKey,
          title: mins <= 1 ? 'Sekarang: ' + a.title : mins + ' menit lagi: ' + a.title,
          body: a.time + ' · ' + (WHO_LABEL[a.who] || 'Bersama')
        });
      }
    }
  }
  return out;
}
