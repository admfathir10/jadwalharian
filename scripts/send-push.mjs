// Pengirim pengingat Rumara — dijalankan GitHub Actions tiap ±10 menit.
// Membaca agenda + langganan dari Firebase (REST), mengirim Web Push, mencatat yang sudah terkirim.
import * as wp from 'web-push';
const webpush = wp.default || wp;   // cocok untuk web-push v3 (CJS) maupun v4 (ESM)
import { planMessages, wibParts } from './push-logic.mjs';

const DB = (process.env.DATABASE_URL || 'https://jadwal-keluarga-17b86-default-rtdb.asia-southeast1.firebasedatabase.app').replace(/\/$/, '');
const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const TEST = process.env.PUSH_TEST === 'true';
const DRY = process.env.DRY_RUN === 'true';
const APP_URL = 'https://admfathir10.github.io/jadwalharian/';

if (!PUBLIC_KEY || !PRIVATE_KEY) {
  console.error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY belum diisi (cek GitHub → Settings → Secrets → Actions).');
  process.exit(1);
}
webpush.setVapidDetails(APP_URL, PUBLIC_KEY, PRIVATE_KEY);

async function fb(path, method = 'GET', body) {
  const res = await fetch(DB + '/' + path + '.json', {
    method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!res.ok) throw new Error(method + ' ' + path + ' → HTTP ' + res.status);
  return method === 'GET' ? res.json() : null;
}

const now = Date.now();
const [agendaRaw, subs, sent] = await Promise.all([fb('agenda'), fb('push_subs'), fb('push_sent')]);
const agendas = agendaRaw ? Object.entries(agendaRaw).map(([fbKey, v]) => ({ ...v, fbKey })) : [];
const subCount = Object.keys(subs || {}).length;
console.log('WIB', JSON.stringify(wibParts(now)), '| agenda:', agendas.length, '| perangkat:', subCount);

let msgs;
if (TEST) {
  msgs = Object.keys(subs || {}).map(subId => ({
    subId, key: 'tes_' + now + '_' + subId, tag: 'tes',
    title: 'Tes pengingat Rumara 🔔', body: 'Kalau ini muncul, pengingat sudah jalan.'
  }));
} else {
  msgs = planMessages({ agendas, subs, sent, nowMs: now });
}
console.log('Pesan yang dikirim:', msgs.length);

let ok = 0, dead = 0, fail = 0;
for (const m of msgs) {
  if (DRY) { console.log('[DRY]', m.subId, m.title, '|', m.body.replace(/\n/g, ' / ')); continue; }
  try {
    await webpush.sendNotification(subs[m.subId].sub, JSON.stringify({ title: m.title, body: m.body, tag: m.tag, url: APP_URL }), { TTL: 3600 });
    await fb('push_sent/' + m.key, 'PUT', now);
    ok++;
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) { await fb('push_subs/' + m.subId, 'DELETE'); dead++; }
    else { fail++; console.error('Gagal kirim ke', m.subId, e.statusCode || '', e.body || e.message); }
  }
}

// bersihkan catatan terkirim yang lebih dari 3 hari
if (!DRY && sent) {
  const old = Object.entries(sent).filter(([, t]) => now - Number(t) > 3 * 86400000).map(([k]) => k);
  for (const k of old) await fb('push_sent/' + k, 'DELETE');
  if (old.length) console.log('Dibersihkan:', old.length, 'catatan lama');
}
console.log(`Selesai: terkirim ${ok}, langganan mati dihapus ${dead}, gagal ${fail}`);
if (fail && !ok) process.exit(1);
