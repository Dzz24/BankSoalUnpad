# Bank Soal Unpad

Prototipe Bank Soal responsif dengan React, TypeScript, Vite, Express, dan PostgreSQL. Struktur layar mengikuti mockup Figma Bank Soal, dengan header putih dan aksen kuning dari Portal Students Unpad.

## Menjalankan proyek

Gunakan Node.js 22.18 atau lebih baru dan server PostgreSQL yang berjalan. Siapkan database khusus proyek dan role yang memiliki database tersebut. Sambungkan aplikasi lewat `DATABASE_URL` di `.env` atau variabel lingkungan. Gunakan [contoh konfigurasi](.env.example) untuk format URL.

```sh
npm ci
npm run dev
```

Buka [http://127.0.0.1:5173](http://127.0.0.1:5173). Satu proses menjalankan frontend dan API. Aplikasi membuat tabel dan mengisi data contoh pada penggunaan pertama jika database masih kosong.

Untuk menjalankan build lokal, gunakan `npm run build` lalu `npm start` dan buka [http://127.0.0.1:4173](http://127.0.0.1:4173). `BANK_SOAL_PORT` memilih port HTTP.

### Instance khusus Bank Soal di komputer ini

Konfigurasi lokal di `.env` memakai database `bank_soal` di `127.0.0.1:55432`. Direktori data instance tersebut ada di `storage/postgresql/`. Jika instance berhenti, jalankan dari root proyek di PowerShell:

```powershell
& 'C:/Program Files/PostgreSQL/16/bin/pg_ctl.exe' start -D 'storage/postgresql' -l 'storage/postgresql.log' -w
```

### Memigrasikan database SQLite lama

Hentikan backend lama agar penulisan selesai. Arahkan `DATABASE_URL` ke database PostgreSQL kosong, lalu jalankan migrasi sebelum `npm run dev` atau `npm start`.

```sh
npm run db:migrate:sqlite
```

Default sumbernya `storage/bank-soal.sqlite`. Gunakan `npm run db:migrate:sqlite -- "path/ke/bank-soal.sqlite"` untuk berkas lain. Migrasi membaca SQLite tanpa mengubahnya dan menyalin soal, versi, paket, relasi paket, serta audit dalam satu transaksi. Menjalankan ulang migrasi dari snapshot yang sama aman. Skrip migrasi ini memakai pembaca SQLite bawaan Node.js.

## Alur demo

- **Bank Soal** mendukung pencarian, filter, detail, dan penyuntingan draf.
- **Buat Soal** menyediakan editor manual dan satu contoh draf AI yang bisa dimuat ke editor.
- **Review Soal** mendukung persetujuan, permintaan revisi, dan penolakan. Catatan diperlukan untuk revisi dan penolakan.
- **Riwayat Soal** menampilkan versi lama dan aktif, catatan perubahan, keputusan review per versi, dan paket ujian yang memuat soal.
- **Paket Ujian** menautkan versi yang disetujui saat paket disimpan dan menampilkan cakupan topik serta level kognitif.
- **Audit Log** menampilkan 100 aktivitas backend terbaru, termasuk pembuatan atau penyuntingan soal, review, paket ujian, dan ekspor laporan.
- **Hasil Ujian** memeriksa format CSV, menampilkan pratinjau, dan mencatat nama file serta jumlah baris.
- **Analisis Kualitas** menggunakan hasil CTT contoh dan menampilkan keadaan kosong untuk hasil kalibrasi Rasch/IRT.
- **Laporan** mengunduh CSV dari backend. Ekspor memuat judul dan metadata, sementara isi soal serta kunci tersedia di detail soal.

Soal, paket, riwayat versi, dan audit tersimpan di PostgreSQL. Pratinjau CSV, riwayat impor contoh, dan pengaturan profil tampilan masih berjalan di browser. Soal dan paket dari prototipe browser dapat diunduh sebagai JSON lewat **Pengaturan Sistem** pada browser yang menyimpannya.

Backend lokal memakai satu identitas **Admin Demo**. Backlog mencakup autentikasi Unpad dan hak akses, pengelolaan pengguna dan data master, pemrosesan impor CSV/XLSX di server, generasi AI, serta perhitungan CTT dan kalibrasi Rasch/IRT.

## API

| Metode | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/workspace` | Daftar soal dan paket |
| POST | `/api/questions` | Simpan soal baru sebagai draf atau ajukan review |
| PUT | `/api/questions/:id` | Edit dan ajukan ulang soal menggunakan revisi data terakhir |
| POST | `/api/questions/:id/review` | Simpan keputusan review menggunakan revisi data terakhir |
| GET | `/api/questions/:id/history` | Versi soal, keputusan review, dan riwayat paket |
| POST | `/api/packages` | Buat paket dari soal yang sudah disetujui |
| GET | `/api/audit` | Audit log terbaru |
| POST | `/api/reports/questions` | Buat dan catat ekspor CSV berdasarkan filter mata kuliah |

## Referensi desain

- [Mockup Sistem Bank Soal Unpad](https://www.figma.com/design/VgNzWWKWqP4Ehk6si0j43y/Mockup-Sistem-Bank-Soal-Unpad?node-id=0-1)
- [Portal Students Unpad](https://v2-students.unpad.ac.id/)
- [Sumber berkas lambang Unpad](https://www.logorary.com/universitas-padjadjaran-unpad-logo)
