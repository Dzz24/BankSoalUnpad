# Panduan demo: generator AI + alur penuh analisis CTT

Branch `exp/ctt-ai-generate` menggabungkan generator soal AI (`feat/ai-generate`) dengan alur penuh CTT (`exp/ctt-alur-penuh`): impor respons, analisis, lalu tindak lanjut per soal. Panduan ini menjelaskan cara menyiapkan dan menjalankan demo dari awal sampai akhir dalam sekitar 15 menit.

> Status: eksperimen. Belum ada pembagian peran, setiap impor hanya bisa dianalisis sekali, dan angka batas CTT masih default yang menunggu persetujuan ahli asesmen (lihat `docs/rencana-tindak-lanjut-analisis.md`).

## 1. Persiapan (sekali saja)

1. Pasang dependensi:

   ```powershell
   npm ci
   ```

2. Pakai **database eksperimen** supaya database utama tidak terisi data uji. Nama database harus berakhiran `_exp`, karena skrip seed menolak database lain. Contoh `.env`:

   ```dotenv
   DATABASE_URL=postgresql://bank_soal:PASSWORD@127.0.0.1:55432/bank_soal_exp

   AI_PROVIDER=gemini
   GEMINI_API_KEY=isi_kunci_api
   GEMINI_MODEL=gemini-3.5-flash
   ```

   Tabel dibuat otomatis saat server pertama kali jalan (`server/schema.sql`).

3. Buat akun login bila database eksperimen masih kosong:

   ```powershell
   npm.cmd run auth:create-user -- <nama_pengguna> --name '<Nama Tampilan>' --credentials-file storage/kredensial-<nama_pengguna>.txt
   ```

   Ganti `<nama_pengguna>` (3–40 karakter: huruf, angka, titik, garis bawah, atau tanda hubung) dan `<Nama Tampilan>` sesuai akun yang ingin dibuat. Kata sandi dibuat acak dan disimpan di file `--credentials-file` (folder `storage/` tidak ikut ke Git). Di macOS/Linux, pakai `npm` sebagai ganti `npm.cmd`.

4. Siapkan soal, paket, dan CSV respons uji:

   ```powershell
   node scripts/seed-uji-ctt.mjs          # 10 soal, 40 peserta → storage/uji-ctt-exp/
   node scripts/seed-uji-ctt-besar.mjs    # opsional: 100 soal, 200 peserta → storage/uji-ctt-besar/
   ```

   Tambahkan `--actor <nama_pengguna>` agar aktivitas di Audit Log tercatat atas nama akun kamu (bawaan: `rizki`).

   Skrip ini aman dijalankan ulang: soal dan paket yang sudah ada dipakai lagi. Hasilnya:

   | File | Isi |
   | --- | --- |
   | `storage/uji-ctt-exp/respons-uji-ctt.csv` | 40 peserta × 10 soal, siap diimpor |
   | `storage/uji-ctt-exp/respons-uji-ctt-salah.csv` | Sengaja salah (respons E, soal asing, jawaban ganda, versi salah) untuk demo validasi |
   | `storage/uji-ctt-besar/respons-uji-100-soal-200-peserta.csv` | 20.000 baris untuk demo skala (NFR-03) |

5. Jalankan aplikasi lalu buka `http://127.0.0.1:5173`:

   ```powershell
   npm run dev
   ```

## 2. Skenario demo

### Bagian A — Membuat soal dengan AI (sekitar 3 menit)

1. Buka **Buat Soal**, lalu pilih **Buat Draf dengan AI**.
2. Pilih **AI dari Topik**. Isi Mata Kuliah *Basis Data* dan Topik *Normalisasi*, lalu set **Jumlah Soal 1–2** dan Level Kognitif *Memahami*. Klik **Buat Draf Soal**.
3. Draf hasil AI tersimpan berstatus **Draf**. Buka draf itu, rapikan bila perlu, lalu klik **Ajukan Review**.
4. Buka **Review Soal**, lalu klik **Setujui**. Soal kini berstatus **Disetujui** dan siap masuk paket.

> Kalau muncul *"Pembuatan soal melewati batas waktu"*: server memutus panggilan AI setelah 45 detik. Pakai 1–2 soal dan topik singkat saat demo. Penjelasan lengkapnya ada di bagian **Masalah umum**.

Poin yang perlu disampaikan: AI hanya menyusun **draf**. Soal tetap harus lewat review manusia sebelum bisa dipakai di paket ujian.

### Bagian B — Impor hasil ujian (sekitar 3 menit)

1. Buka **Hasil Ujian**, lalu pilih paket **UTS Basis Data – Uji CTT**.
2. Pilih periode dari daftar **Semester** dan **Tahun akademik**. Periode tidak bisa diketik bebas.
3. **Demo validasi dulu:** unggah `respons-uji-ctt-salah.csv`, lalu klik **Validasi & Simpan**. File ditolak, dan daftar kesalahan per baris tampil (opsi E, ID soal yang tidak ada di paket, jawaban ganda, versi soal yang tidak cocok).
4. Unggah `respons-uji-ctt.csv`, lalu klik **Validasi & Simpan**. Impor tersimpan: 40 peserta, 400 baris.

Format CSV: kolom `id_peserta, id_soal, versi_soal, respons`. Respons kosong berarti tidak dijawab.

### Bagian C — Menjalankan analisis CTT (sekitar 3 menit)

1. Pada impor yang baru tersimpan, klik **Jalankan Analisis**. Pilih aturan respons kosong (bawaan: dihitung **salah**), lalu jalankan.
2. Buka **Analisis Kualitas**:
   - **Peta kualitas**: tiap titik adalah satu soal, dengan tingkat kesukaran (p) di satu sumbu dan daya pembeda (D) di sumbu lain. Kotak hijau menandai zona ideal.
   - **Status tindak lanjut**: bar bertumpuk berisi jumlah soal per prioritas (tinggi/sedang/rendah) dan statusnya.
   - **Tabel hasil**: p, kategori kesukaran, D, point-biserial, penanda (`key-check`, `low-discrimination`, dan lain-lain), dan prioritas. Dengan data uji ini, kira-kira 7 dari 10 soal ditandai perlu ditinjau, dan KR-20 paket sekitar 0,54.
3. Klik **Detail** pada salah satu soal untuk menunjukkan distribusi opsi dan analisis pengecoh.

Poin yang perlu disampaikan: angka **hanya memberi tanda**, tidak memutuskan apa pun secara otomatis (RB-12-2). Data di bawah 10 peserta ditandai *belum memadai*, dan 10–29 peserta ditandai *indikatif*.

### Bagian D — Tindak lanjut per soal (sekitar 4 menit)

1. Klik **Tinjau** pada soal berprioritas tinggi. Ada tiga pilihan, dan masing-masing wajib disertai alasan:
   - **Pertahankan**: soal tetap Disetujui.
   - **Revisi**: status berubah menjadi **Perlu Revisi**, dan konteks analisis (p, D, alasan) muncul di editor soal.
   - **Pensiunkan**: status berubah menjadi **Dipensiunkan**. Soal tidak bisa diedit atau dimasukkan ke paket baru.
2. Untuk soal yang direvisi, buka **Bank Soal**, lalu buka soal tersebut. Kotak **Konteks Analisis CTT** tampil. Edit soal, lalu klik **Ajukan Review**; versinya naik menjadi versi 2.
3. Di **Review Soal**, klik **Setujui**. Soal kembali Disetujui pada versi 2, dan konteks analisisnya dibersihkan. Hasil analisis lama tetap tercatat untuk versi 1.
4. Buka **Audit Log** untuk menunjukkan jejak lengkapnya: `import.created`, `analysis.completed`, `analysis.revision_requested`, `question.retired`, dan seterusnya.

### Bagian E (opsional) — Skala besar

Impor `respons-uji-100-soal-200-peserta.csv` ke paket **UTS Basis Data – Uji 100 Soal**, lalu jalankan analisis. Di laptop, impor dan analisis masing-masing selesai dalam hitungan detik, jauh di bawah target NFR-03 (≤ 2 menit). Soal yang sengaja diberi kunci keliru akan muncul dengan penanda `key-check`.

## 3. Cek angka secara manual (opsional)

Untuk menunjukkan bahwa perhitungan CTT bisa dicocokkan dengan hitungan tangan:

```powershell
npm test             # seluruh tes, termasuk CTT dan generator AI
npm run ctt:demo     # contoh 10 peserta × 5 soal, bandingkan dengan docs/ctt-hitung-manual.md
```

## 4. Masalah umum

| Gejala | Penyebab dan solusi |
| --- | --- |
| "Pembuatan soal melewati batas waktu" | Panggilan AI lewat 45 detik (`server/generate-questions.mjs`). Gemini 3.5 Flash berpikir di level *medium* secara bawaan. Kurangi jumlah soal atau persingkat materi. Perbaikan permanen (mis. `thinking_level: 'low'`) perlu dibahas dengan pemilik modul AI. |
| "Generator AI belum dikonfigurasi" | `AI_PROVIDER` atau API key di `.env` belum diisi. Restart `npm run dev` setelah mengubah `.env`. |
| Skrip seed berhenti dengan "bukan database eksperimen" | `DATABASE_URL` tidak mengarah ke database berakhiran `_exp`. |
| Impor ditolak karena periode | Periode wajib dipilih dari daftar Semester dan Tahun akademik. |
| `EADDRINUSE` saat `npm run dev` | Masih ada server lama yang berjalan. Hentikan semua proses `node server/index.mjs`, lalu jalankan ulang. |
| Tombol keputusan tidak muncul di dialog Tinjau | Soal sudah diputuskan, sedang direvisi, sudah dipensiunkan, atau versinya sudah berubah. Itu memang disengaja. |
