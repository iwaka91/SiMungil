# SiMungil

**Administrasi Guru Jadi Mungil**

SiMungil adalah portal internal sekolah untuk membantu perangkat pembelajaran, dokumen guru/sekolah, rekap kehadiran, Catatan Harian, tindak lanjut, notifikasi internal, dan sinkronisasi data sekolah.

## Status

**V11 — GAS Ready + QR/Barcode Scan**

Tahap saat ini:
- frontend mobile-first sudah dibersihkan dari data dummy bawaan;
- database siswa lokal memakai IndexedDB;
- sinkronisasi siswa disiapkan dengan delta update;
- Catatan Harian mendukung pencarian Nama/NIS/NISN dan scan QR/barcode;
- backend Google Apps Script Phase 1 sudah disiapkan;
- target setelah uji GAS lolos: Google Auth, upload foto/PDF ke Drive sekolah, lalu packaging APK.

## Struktur repo

```text
SiMungil/
├── index.html
├── gas/
│   └── Code.gs
├── docs/
│   └── Panduan_GAS_Phase1.md
├── archive/
└── README.md
```

## Mulai uji GAS

Ikuti [docs/Panduan_GAS_Phase1.md](docs/Panduan_GAS_Phase1.md).

Secara ringkas:
1. buat Spreadsheet master;
2. buat project Apps Script;
3. salin `gas/Code.gs`;
4. set `SIMUNGIL_SHEET_ID` dan `SIMUNGIL_TEST_TOKEN` di Script Properties;
5. jalankan `setupSiMungilSheets()`;
6. deploy sebagai Web App;
7. pada salinan lokal `index.html`, isi `GAS_API_URL` dan token uji.

> Jangan commit token, credential, atau data siswa ke repository. Master data siswa tetap berada di Google Sheet/Drive sekolah, bukan GitHub.

## Data utama

Backend menyiapkan master dan transaksi untuk USER, USER_ROLE, SISWA, KELAS, RIWAYAT_KELAS, JADWAL_PIKET, TAHUN_AJARAN, CONFIG, GEM, ABSENSI, CATATAN_HARIAN, TINDAK_LANJUT, LAMPIRAN, NOTIFIKASI, LOG_AKTIVITAS, serta fondasi PRESTASI dan POIN_DISIPLIN.

## Catatan keamanan

Mekanisme email manual + `TEST_TOKEN` hanya untuk **uji GAS awal**. Sebelum penggunaan produksi harus diganti dengan autentikasi Google dan validasi identitas di backend.

## Pengembang

Toto Gutomo, S.Pd., Gr., M.Pd., CPSS  
SMA Negeri 3 Maliku — Kabupaten Pulang Pisau, Kalimantan Tengah.
