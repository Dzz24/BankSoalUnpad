# Bank Soal Unpad

Aplikasi web untuk mengelola bank soal Universitas Padjadjaran, mulai dari penyusunan dan peninjauan akademik hingga pelacakan versi soal dan penyusunan paket ujian.

Prototipe Bank Soal responsif dengan React, TypeScript, Vite, Express, dan PostgreSQL. Struktur layar mengikuti mockup Figma Bank Soal, dengan header putih dan aksen kuning dari Portal Students Unpad.

## Menjalankan proyek

Gunakan Node.js 22.18 atau lebih baru dan server PostgreSQL yang berjalan. Siapkan database khusus proyek dan role yang memiliki database tersebut. Sambungkan aplikasi lewat `DATABASE_URL` di `.env` atau variabel lingkungan. Gunakan [contoh konfigurasi](.env.example) untuk format URL.

```sh
npm ci
npm run auth:create-user -- admin --name "Admin Bank Soal"
npm run dev
```

Buat akun sekali per pengguna. Perintah di atas membuat kata sandi acak dan menampilkannya di terminal. Gunakan `--credentials-file storage/login-lokal.txt` untuk menyimpannya ke berkas lokal baru yang dikecualikan dari Git. Akun `admin` yang sudah disiapkan di komputer ini dapat memakai kredensial dari berkas tersebut.

Buka [http://127.0.0.1:5173](http://127.0.0.1:5173) dan masuk dengan akun Bank Soal. Satu proses menjalankan frontend dan API. Aplikasi membuat tabel dan mengisi data contoh pada penggunaan pertama jika database masih kosong.

Untuk menjalankan build lokal, gunakan `npm run build` lalu `npm start` dan buka [http://127.0.0.1:4173](http://127.0.0.1:4173). `BANK_SOAL_PORT` memilih port HTTP.

## Deploy ke Vercel

1. Impor repo di Vercel dengan **Root Directory** di root proyek. File `vercel.json` menetapkan preset **Vite**, build `npm run build`, dan hasil frontend di `dist`. Vercel Function di `api/handler.js` melayani Express di jalur `/api`. [Vite di Vercel](https://vercel.com/docs/frameworks/frontend/vite)
2. Isi **Settings → Environment Variables → DATABASE_URL** dengan URL PostgreSQL cloud sesuai lingkungan deployment. Jika Supabase dipasang melalui Vercel Marketplace, fungsi Vercel memakai `POSTGRES_URL` dari integrasi saat `DATABASE_URL` kosong. Untuk koneksi Supabase manual, gunakan URL **Transaction pooler** dari menu **Connect**. Isi `DATABASE_CA_CERT` dengan seluruh isi sertifikat CA yang diunduh dari pengaturan database Supabase agar Node.js dapat memverifikasi sertifikat dan hostname. Pada proyek Supabase khusus Bank Soal, batasi akses Data API ke tabel aplikasi atau nonaktifkan Data API agar data hanya dapat diakses melalui backend. [Vercel Marketplace](https://supabase.com/docs/guides/integrations/vercel-marketplace) · [Sertifikat TLS](https://supabase.com/docs/guides/platform/ssl-enforcement) · [Pengaturan Data API](https://supabase.com/docs/guides/api/securing-your-api)
3. Deploy commit yang memuat konfigurasi ini, lalu buka `/api/health` pada domain Vercel. Respons `{"status":"ok","database":"postgresql"}` menandakan API dan PostgreSQL bisa dihubungi.

Database cloud baru diisi data contoh. Untuk membuat akun pada database cloud, buka PowerShell baru dan jalankan perintah berikut. Masukkan string koneksi cloud saat diminta, lalu gunakan kata sandi dari output untuk masuk ke website.

```powershell
$cloudUrl = Read-Host 'DATABASE_URL PostgreSQL cloud' -AsSecureString
$env:DATABASE_URL = [System.Net.NetworkCredential]::new('', $cloudUrl).Password
npm.cmd run auth:create-user -- admin --name 'Admin Bank Soal'
```

Kalau ingin membawa data dan akun yang sudah ada, pulihkan backup PostgreSQL lokal ke database cloud sebelum pertama kali membuka aplikasi. Kredensial database disimpan di pengaturan deployment Vercel.

## Instance khusus Bank Soal di komputer ini

Konfigurasi lokal di `.env` memakai database `bank_soal` di `127.0.0.1:55432`. Direktori data instance tersebut ada di `storage/postgresql/`. Jika instance berhenti, jalankan dari root proyek di PowerShell:

```powershell
& 'C:/Program Files/PostgreSQL/16/bin/pg_ctl.exe' start -D 'storage/postgresql' -l 'storage/postgresql.log' -w
```

## Memigrasikan database SQLite lama

Hentikan backend lama agar penulisan selesai. Arahkan `DATABASE_URL` ke database PostgreSQL kosong, lalu jalankan migrasi sebelum `npm run dev` atau `npm start`.

```sh
npm run db:migrate:sqlite
```

Default sumbernya `storage/bank-soal.sqlite`. Gunakan `npm run db:migrate:sqlite -- "path/ke/bank-soal.sqlite"` untuk berkas lain. Migrasi membaca SQLite tanpa mengubahnya dan menyalin soal, versi, paket, relasi paket, serta audit dalam satu transaksi. Menjalankan ulang migrasi dari snapshot yang sama aman. Skrip migrasi ini memakai pembaca SQLite bawaan Node.js.

## Alur demo

- **Bank Soal** mendukung pencarian, filter, detail, dan penyuntingan draf.
- **Buat Soal** menyediakan editor manual dan generator AI dari topik saja atau materi rujukan, dengan jumlah soal dan level C1–C6. Hasil yang valid disimpan sebagai draf dan dapat dibuka satu per satu di editor. Contoh statis juga tersedia untuk mencoba penyuntingan.
- **Review Soal** mendukung persetujuan, permintaan revisi, dan penolakan. Catatan diperlukan untuk revisi dan penolakan.
- **Riwayat Soal** menampilkan versi lama dan aktif, catatan perubahan, keputusan review per versi, dan paket ujian yang memuat soal.
- **Paket Ujian** menautkan versi yang disetujui saat paket disimpan dan menampilkan cakupan topik serta level kognitif.
- **Audit Log** menampilkan 100 aktivitas backend terbaru, termasuk pembuatan atau penyuntingan soal, review, paket ujian, dan ekspor laporan.
- **Hasil Ujian** memeriksa format CSV, menampilkan pratinjau, dan mencatat nama file serta jumlah baris.
- **Analisis Kualitas** menggunakan hasil CTT contoh dan menampilkan keadaan kosong untuk hasil kalibrasi Rasch/IRT.
- **Laporan** mengunduh CSV dari backend. Ekspor memuat judul dan metadata, sementara isi soal serta kunci tersedia di detail soal.

Soal, paket, riwayat versi, dan audit tersimpan di PostgreSQL. Pratinjau CSV, riwayat impor contoh, dan pengaturan profil tampilan masih berjalan di browser. Soal dan paket dari prototipe browser dapat diunduh sebagai JSON lewat **Pengaturan Sistem** pada browser yang menyimpannya.

Backend memakai akun lokal. Sesi berlaku delapan jam dan dapat ditutup melalui **Profil Akun → Keluar**. Audit log mencatat nama pengguna dari sesi yang aktif. Backlog mencakup integrasi login Unpad dan hak akses per role, pengelolaan pengguna dan data master, pemrosesan impor CSV/XLSX di server, serta perhitungan CTT dan kalibrasi Rasch/IRT.

## Generator soal AI

Pilih penyedia melalui `AI_PROVIDER` di `.env` untuk penggunaan lokal atau di environment backend Vercel untuk deployment. Untuk Gemini, isi `AI_PROVIDER=gemini`, `GEMINI_API_KEY`, dan `GEMINI_MODEL=gemini-4-hydrogen`. Untuk OpenAI, isi `AI_PROVIDER=openai`, `OPENAI_API_KEY`, dan `OPENAI_MODEL=gpt-4.1-mini`. Jika `AI_PROVIDER` kosong, aplikasi memakai OpenAI. Model Gemini dapat diganti dengan model yang mendukung Interactions API serta JSON Schema. Restart server setelah memperbarui `.env`, atau deploy ulang kode terbaru di Vercel setelah environment diperbarui. Kunci API digunakan oleh backend.

Masuk ke **Buat Soal → Bantuan AI**. Pilihan awal **AI dari Topik** membuat soal dari pengetahuan model berdasarkan topik, mata kuliah, jumlah soal, dan level kognitif. Pilih **Dari Materi Rujukan** jika ingin soal berdasarkan materi yang kamu tempelkan. Klik **Buat Draf Soal**. Tiga soal yang diminta akan muncul sebagai tiga draf tersimpan dengan tombol **Soal 1**, **Soal 2**, dan **Soal 3** di atas editor. Simpan perubahan sebelum berpindah soal. Semua draf juga tersedia di Bank Soal setelah halaman dimuat ulang.

Jalankan `npm run test:ai` untuk memeriksa kontrak keluaran dan penanganan kegagalan. [Kontrak integrasi dan panduan demo](docs/ai-generator.md) memuat pembagian file, contoh input-output, dan pemetaan untuk backend serta Risyam. [Contoh tiga soal](examples/ai-generation.json) merupakan fixture statis untuk integrasi dan pengujian.

## API

| Metode | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/auth/session` | Periksa sesi aktif |
| POST | `/api/auth/login` | Masuk dengan nama pengguna dan kata sandi |
| POST | `/api/auth/logout` | Akhiri sesi aktif |
| GET | `/api/workspace` | Daftar soal dan paket |
| POST | `/api/questions` | Simpan soal baru sebagai draf atau ajukan review |
| POST | `/api/questions/generate` | Buat 1–10 soal AI dan simpan seluruh hasil valid sebagai draf |
| PUT | `/api/questions/:id` | Edit dan ajukan ulang soal menggunakan revisi data terakhir |
| POST | `/api/questions/:id/review` | Simpan keputusan review menggunakan revisi data terakhir |
| GET | `/api/questions/:id/history` | Versi soal, keputusan review, dan riwayat paket |
| POST | `/api/packages` | Buat paket dari soal yang sudah disetujui |
| GET | `/api/audit` | Audit log terbaru |
| POST | `/api/reports/questions` | Buat dan catat ekspor CSV berdasarkan filter mata kuliah |

Endpoint fitur Bank Soal memerlukan cookie sesi dari login. Endpoint pemeriksaan kesehatan server bisa diakses tanpa akun.

## Referensi desain

- [Mockup Sistem Bank Soal Unpad](https://www.figma.com/design/VgNzWWKWqP4Ehk6si0j43y/Mockup-Sistem-Bank-Soal-Unpad?node-id=0-1)
- [Portal Students Unpad](https://v2-students.unpad.ac.id/)
- [Sumber berkas lambang Unpad](https://www.logorary.com/universitas-padjadjaran-unpad-logo)
