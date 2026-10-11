# Panduan SiMungil – GAS Phase 1

File pendamping:
- Frontend: `SiMungil_v11_gas_ready_scan.html`
- Backend GAS: `SiMungil_GAS_Phase1_Code.gs`

## Tujuan uji pertama
Uji awal hanya memastikan:
1. frontend terhubung ke GAS,
2. email user dikenali,
3. role/jadwal piket terbaca,
4. database siswa masuk IndexedDB dan delta update berjalan,
5. rekap ketidakhadiran terbaca,
6. Catatan Harian dapat dikirim ke Sheet,
7. 5 dokumen terbaru bisa dibaca jika folder Drive sekolah sudah diset.

> Email manual + TEST_TOKEN pada V11 hanya untuk uji tahap awal. Jangan dipakai sebagai keamanan produksi. Setelah backend lolos uji, tahap berikutnya adalah Google Auth.

## A. Buat Spreadsheet master

1. Buat Google Spreadsheet baru, misalnya **SiMungil Master**.
2. Salin ID spreadsheet dari URL:
   `https://docs.google.com/spreadsheets/d/ID_SPREADSHEET/edit`
3. Jangan bagikan sebagai “Anyone with the link”.

## B. Buat Apps Script

1. Buka `script.google.com` dengan Gmail yang akan menjadi pengelola backend.
2. Buat **New project** → beri nama `SiMungil GAS`.
3. Hapus isi `Code.gs`.
4. Copy seluruh isi file `SiMungil_GAS_Phase1_Code.gs` ke `Code.gs`.
5. Buka **Project Settings → Script Properties**.
6. Buat:
   - `SIMUNGIL_SHEET_ID` = ID Spreadsheet master.
   - `SIMUNGIL_TEST_TOKEN` = token acak sementara, contoh buat sendiri minimal 24–32 karakter.

## C. Buat semua tab otomatis

Di Apps Script:
1. Pilih fungsi `setupSiMungilSheets`
2. Klik **Run**
3. Berikan izin Google jika diminta.
4. Setelah selesai, Spreadsheet akan memiliki tab master dan transaksi.

Opsional: jalankan `seedDefaultClasses()` untuk membuat 9 kelas:
X 1, X 2, X 3, XI A–C, XII A–C.

## D. Isi master minimal untuk uji login

### USER
Isi minimal satu user nyata:

| UserID | Email | Nama | Status |
|---|---|---|---|
| USR001 | email@gmail.com | Nama Guru | Aktif |

Kolom CreatedAt/UpdatedAt boleh diisi kemudian.

### USER_ROLE
Contoh:

| UserRoleID | UserID | Role | Value | Aktif |
|---|---|---|---|---|
| UR001 | USR001 | Wakasek Kurikulum | | TRUE |

Role mengikuti aplikasi:
- Kepsek
- Wakasek Kurikulum
- Wakasek Kesiswaan
- Wakasek Sarpras
- Wakasek Humas
- Guru
- Wali Kelas X 1 ... XII C
- Satpam
- TU
- Tendik Lainnya

### CONFIG
Pada baris `ADMIN_EMAIL_1`, isi email admin pertama.
Jika frontend akan menampilkan Drive sekolah, isi:
- `SCHOOL_DRIVE_URL`
- `SCHOOL_DRIVE_FOLDER_ID`

## E. Isi data siswa minimal

### SISWA
Contoh struktur:

| StudentID | NIS | NISN | Nama | Status |
|---|---|---|---|---|
| STD001 | 26001 | 0060010011 | Nama Siswa | Aktif |

### RIWAYAT_KELAS
Siswa wajib mempunyai enrollment aktif.

| EnrollmentID | StudentID | TahunAjaranID | KelasID | TanggalMulai | TanggalSelesai | Status | UpdatedAt |
|---|---|---|---|---|---|---|---|
| ENR001 | STD001 | 2026-2027 | K-X1 | 2026-07-01 | | Aktif | 2026-09-24T00:00:00Z |

Penting: `UpdatedAt` dipakai untuk **delta sync**. Setiap perubahan siswa/kelas harus memperbarui `UpdatedAt`.

## F. Isi Jadwal Piket

Tab `JADWAL_PIKET`:

| PicketID | Hari | UserID | TahunAjaranID | TanggalMulai | TanggalSelesai | Aktif |
|---|---|---|---|---|---|---|
| PK001 | Senin | USR001 | 2026-2027 | | | TRUE |

Guru yang terjadwal akan otomatis mendapat kapasitas **Guru Piket** pada hari tersebut.

## G. Deploy sebagai Web App

1. Di Apps Script klik **Deploy → New deployment**.
2. Type: **Web app**.
3. Execute as: **Me** (untuk uji awal).
4. Who has access: pilih opsi yang memungkinkan perangkat uji mengakses Web App sesuai akun Google Anda.
5. Klik **Deploy**.
6. Copy URL yang berakhir `/exec`.

## H. Hubungkan frontend

Buka file `SiMungil_v11_gas_ready_scan.html` di editor teks.

Cari:

```js
const GAS_API_URL='PASTE_GAS_WEB_APP_URL_HERE';
const GAS_TEST_TOKEN='PASTE_TEMP_TEST_TOKEN_HERE';
```

Ganti dengan:
- URL `/exec` dari deployment GAS
- token yang sama dengan `SIMUNGIL_TEST_TOKEN`

Simpan file.

## I. Uji pertama

Sebaiknya jalankan frontend melalui Live Server / localhost, bukan `file://`.

1. Buka SiMungil.
2. Masukkan email yang sudah ada di tab `USER`.
3. Klik **Masuk & Sinkron GAS**.
4. Periksa:
   - nama user dan role muncul,
   - Pengaturan → Database Siswa Offline memiliki jumlah siswa,
   - Jadwal piket memengaruhi kapasitas user,
   - Rekap Kehadiran membaca data ABSENSI,
   - Catatan Harian tidak lagi menampilkan data contoh.

## J. Uji delta siswa

Setelah sinkron pertama:
1. Tambahkan satu siswa atau ubah `RIWAYAT_KELAS`.
2. Pastikan `UpdatedAt` di baris terkait diubah ke waktu terbaru.
3. Di SiMungil buka **Pengaturan → Periksa Pembaruan Data Siswa**.
4. Hanya record yang berubah yang dikirim ke IndexedDB.

## K. Uji scan kartu siswa

Pada Catatan Harian:
1. Tekan `＋ Catat`.
2. Pada field siswa tekan ikon `▦`.
3. Izinkan kamera.
4. Scan QR/barcode yang isinya salah satu dari:
   - NISN,
   - NIS,
   - StudentID.
5. Jika cocok dengan IndexedDB, nama dan kelas terisi otomatis.

Untuk tahap kartu siswa nanti, rekomendasi tetap: QR cukup memuat **NISN atau StudentID**, bukan data pribadi lengkap.

## Catatan keamanan sebelum produksi

Sebelum SiMungil dipakai sungguhan:
- hapus `SIMUNGIL_TEST_TOKEN` dari arsitektur client,
- ganti email manual dengan Google Auth,
- GAS harus memvalidasi identitas token Google,
- jangan pernah membuat Sheet master publik,
- foto/PDF Catatan Harian selanjutnya diunggah ke Drive sekolah dengan hak akses terkontrol.

## Setelah uji Phase 1 lolos

Tahap berikutnya:
1. Google Auth,
2. upload foto/PDF ke Drive sekolah,
3. notifikasi server-side,
4. pengumuman/admin write penuh,
5. sinkron offline queue lebih kuat,
6. uji multi-user,
7. baru bungkus dengan Capacitor menjadi APK.