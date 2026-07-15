# 📅 Jadwal Keluarga

Website jadwal harian untuk suami (Guru PPPK SMAN 8 Kediri) dan istri (IRT Produktif).

## Struktur File

```
jadwal-keluarga/
├── index.html   → Halaman utama (struktur & konten)
├── style.css    → Semua tampilan & warna
├── script.js    → Logika tab & interaksi
└── README.md    → Panduan ini
```

## Cara Deploy ke GitHub Pages

1. **Buat repository baru** di GitHub (mis. nama: `jadwal-keluarga`)
2. **Upload ketiga file** ini: `index.html`, `style.css`, `script.js`
3. Masuk ke **Settings → Pages**
4. Di bagian *Source*, pilih **Deploy from a branch**
5. Pilih branch **main** dan folder **/ (root)**
6. Klik **Save**
7. Tunggu 1–2 menit, website live di:
   `https://<username-github>.github.io/jadwal-keluarga/`

## Cara Edit Konten

| Mau edit apa?         | Buka file mana?  | Cari bagian apa?         |
|-----------------------|------------------|--------------------------|
| Warna blok aktivitas  | `style.css`      | `/* === Block Colors ===` |
| Warna kolom header    | `style.css`      | `--col-suami-bg`          |
| Jam & isi jadwal      | `index.html`     | komentar `<!-- SENIN -->` dll |
| Logika tab/hari       | `script.js`      | fungsi `showDay()`        |

## Cara Tambah/Edit Baris Jadwal

Salin pola ini di `index.html`:
```html
<div class="row">
  <span class="time">07.00</span>
  <div class="block blk-ibadah">Isi aktivitas di sini</div>
</div>
```

Ganti `blk-ibadah` dengan kelas warna yang sesuai:
- `blk-ibadah` — hijau (sholat, tilawah, dzikir)
- `blk-olahraga` — biru (workout, lari)
- `blk-kerja` — ungu (sekolah, mengajar)
- `blk-istirahat` — abu (makan, mandi, tidur siang)
- `blk-sosial` — kuning (nongki, hangout)
- `blk-hobby` — oranye (hobi, kreatif)
- `blk-keluarga` — pink (waktu keluarga)
- `blk-toko` — tosca (Shopee, bisnis)
- `blk-madin` — ungu tua (mengajar madin/TPA)
- `blk-tidur` — abu muda (tidur malam)
