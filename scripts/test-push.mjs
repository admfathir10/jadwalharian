// Tes logika pengingat (tanpa jaringan): node scripts/test-push.mjs
import assert from 'node:assert/strict';
import { planMessages, wibMs } from './push-logic.mjs';

const subs = {
  s1: { who: 'suami', sub: { endpoint: 'x' } },
  s2: { who: 'istri', sub: { endpoint: 'y' } },
  s3: { who: 'bersama', sub: { endpoint: 'z' } }
};
const ag = [
  { fbKey: 'A', title: 'Rapat guru', date: '2026-12-01', time: '09:00', who: 'suami' },
  { fbKey: 'B', title: 'Arisan', date: '2026-12-01', time: '', who: 'bersama' },
  { fbKey: 'C', title: 'Periksa anak', date: '2026-12-02', time: '16:30', who: 'istri' },
  { fbKey: 'D', title: 'Belanja', date: '2026-12-02', time: '', who: 'bersama' }
];
const at = (d, t) => wibMs(d, t);
const run = (nowMs, sent = {}) => planMessages({ agendas: ag, subs, sent, nowMs });

// 05.59 → belum ada apa-apa
assert.equal(run(at('2026-12-01', '05:59')).length, 0);

// 06.05 → ringkasan pagi: s1 (2 agenda), s2 (1), s3 (1)
let m = run(at('2026-12-01', '06:05'));
assert.equal(m.length, 3);
assert.equal(m.find(x => x.subId === 's1').title, '2 agenda hari ini');
assert.match(m.find(x => x.subId === 's1').body, /09:00 Rapat guru\nArisan|Arisan\n/);
assert.equal(m.find(x => x.subId === 's2').title, 'Agenda hari ini');
assert.equal(m.find(x => x.subId === 's2').body, 'Arisan');

// sudah terkirim → tidak dobel
const sent = Object.fromEntries(m.map(x => [x.key, 1]));
assert.equal(run(at('2026-12-01', '06:15'), sent).length, 0);

// 08.05 (telat) masih mengirim pagi bila belum; jam 09.00 sudah lewat jendela
assert.equal(run(at('2026-12-01', '08:50')).filter(x => x.tag === 'pagi').length, 3);
assert.equal(run(at('2026-12-01', '09:00')).filter(x => x.tag === 'pagi').length, 0);

// 08.00 → satu jam sebelum rapat 09.00 (hanya s1)
m = run(at('2026-12-01', '08:00'), sent).filter(x => x.tag.startsWith('jam_'));
assert.equal(m.length, 1);
assert.equal(m[0].subId, 's1');
assert.equal(m[0].title, '60 menit lagi: Rapat guru');
// 07.30 terlalu awal, 09.03 masih boleh ("Sekarang"), 09.10 sudah lewat
assert.equal(run(at('2026-12-01', '07:30'), sent).filter(x => x.tag.startsWith('jam_')).length, 0);
assert.equal(run(at('2026-12-01', '09:03'), sent).filter(x => x.tag.startsWith('jam_'))[0].title, 'Sekarang: Rapat guru');
assert.equal(run(at('2026-12-01', '09:10'), sent).filter(x => x.tag.startsWith('jam_')).length, 0);

// 19.30 → malam untuk besok: s1 (Belanja), s2 (Periksa + Belanja), s3 (Belanja)
m = run(at('2026-12-01', '19:30'), sent);
assert.equal(m.length, 3);
assert.equal(m.find(x => x.subId === 's2').title, 'Besok: 2 agenda');
assert.equal(m.find(x => x.subId === 's1').title, 'Besok: 1 agenda');

// tanpa agenda → tidak kirim apa pun
assert.equal(planMessages({ agendas: [], subs, sent: {}, nowMs: at('2026-12-01', '06:30') }).length, 0);

// zona waktu: 23.30 UTC tgl 30 Nov = 06.30 WIB tgl 1 Des
assert.equal(run(Date.UTC(2026, 10, 30, 23, 30)).filter(x => x.tag === 'pagi').length, 3);

console.log('Semua tes logika pengingat lulus ✔');
