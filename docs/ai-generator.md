# Generator soal AI

Modul Dzikri membuat soal dari topik saja atau dari materi rujukan, dengan jumlah soal dan level kognitif yang dipilih dosen. Backend memanggil Gemini Interactions API atau OpenAI Responses API menggunakan JSON Schema. Validasi aplikasi memeriksa kelengkapan hasil sebelum backend menyimpan draf.

## File implementasi

| File | Kegunaan |
| --- | --- |
| `server/generate-questions.mjs` | Fungsi `generateQuestions`, prompt, JSON Schema, validasi, dan konversi ke editor |
| `shared/question-fields.js` | Definisi level C1–C6 yang dipakai backend dan frontend |
| `server/application.mjs` | Endpoint yang memerlukan login |
| `server/workspace.mjs` | Penyimpanan beberapa draf dalam satu transaksi PostgreSQL |
| `src/QuestionGenerator.tsx` | Pilihan sumber soal, topik, materi, dan parameter pembuatan soal |
| `examples/ai-generation.json` | Contoh input dan tiga keluaran statis untuk backend dan Risyam |

## Konfigurasi

Tambahkan konfigurasi berikut ke `.env`, kemudian jalankan `npm run dev`.

Untuk Gemini, buat kunci API di [Google AI Studio](https://aistudio.google.com/api-keys).

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=isi_kunci_api_anda
GEMINI_MODEL=gemini-4-hydrogen
```

Untuk OpenAI, gunakan konfigurasi berikut.

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=isi_kunci_api_anda
OPENAI_MODEL=gpt-4.1-mini
```

Pada Vercel, tambahkan variabel penyedia yang dipilih ke environment yang digunakan, kemudian deploy kode terbaru. Backend memakai API key sesuai `AI_PROVIDER`. Nilai default penyedia adalah `openai`. Model Gemini dapat diganti melalui `GEMINI_MODEL` dengan model yang mendukung Interactions API dan JSON Schema. Materi dikirim ke penyedia yang dipilih dengan `store: false`. Aplikasi menyimpan soal hasil validasi, saran metadata, riwayat versi, dan aktivitas pembuatannya di PostgreSQL.

## Fungsi untuk backend

```js
import { generateQuestions, generatedQuestionFields } from './server/generate-questions.mjs'

const result = await generateQuestions({
  material: 'Materi kuliah sebagai sumber soal...',
  topic: 'Normalisasi basis data',
  count: 3,
  cognitiveLevel: 'penerapan',
})

const fields = generatedQuestionFields(result.questions[0], 'Basis Data')
```

`generateQuestions` mengembalikan `{questions: [...]}` setelah seluruh hasil lolos validasi. Fungsi ini dapat dipanggil dari proses Node.js yang telah memuat environment. Pada server aplikasi, `.env` dimuat oleh modul database.

## Kontrak HTTP

`POST /api/questions/generate` memerlukan cookie sesi login dan body JSON berikut.

```json
{
  "material": "Materi kuliah sebagai sumber soal...",
  "topic": "Normalisasi basis data",
  "count": 3,
  "cognitiveLevel": "penerapan",
  "course": "Basis Data"
}
```

Materi dibatasi 20.000 karakter, topik 180 karakter, dan jumlah soal 1–10. `course` mengikuti daftar mata kuliah aplikasi.

Field `mode` memilih sumber pembuatan soal. `material` memakai materi rujukan dan wajib menyertakan teks `material`. Jika `mode` dihilangkan, backend memakai `material` untuk menjaga kompatibilitas dengan pemanggil sebelumnya. `topic` membuat soal dari pengetahuan model berdasarkan topik dan mata kuliah. Pada mode `topic`, backend mengabaikan materi yang mungkin tertinggal dari formulir sebelumnya.

Contoh request untuk membuat soal tanpa materi berikut memakai endpoint dan format respons yang sama.

```json
{
  "mode": "topic",
  "topic": "Normalisasi basis data",
  "count": 3,
  "cognitiveLevel": "penerapan",
  "course": "Basis Data"
}
```

Pilihan awal pada formulir adalah **AI dari Topik**. Pilih **Dari Materi Rujukan** untuk menampilkan kotak materi. Hasil kedua mode disimpan sebagai draf dan perlu diperiksa dosen, termasuk kesesuaian konsep dengan materi perkuliahan.

| Level | Nilai `cognitiveLevel` | Label editor |
| --- | --- | --- |
| C1 | `mengingat` | Mengingat |
| C2 | `memahami` | Memahami |
| C3 | `penerapan` | Penerapan |
| C4 | `analisis` | Analisis |
| C5 | `evaluasi` | Mengevaluasi |
| C6 | `mencipta` | Mencipta |

Input juga menerima kode seperti `C3` dan label editor seperti `Penerapan`. Keluaran memakai nilai pada kolom kedua. Untuk C6, pilihan ganda digunakan untuk membandingkan rancangan solusi. Penilaian kemampuan mencipta secara langsung memerlukan tugas dengan respons terbuka.

Respons sukses memakai HTTP 201 dan memuat `questions` serta `drafts`. `questions` berisi keluaran generator yang sudah divalidasi. `drafts` berisi soal tersimpan dengan ID, status, versi, dan revisi untuk editor. Jumlah keduanya mengikuti `count`.

Setiap anggota `questions` memakai struktur berikut. Contoh tiga soal lengkap ada di `examples/ai-generation.json`.

```json
{
  "stem": "Tabel KRS memiliki kunci gabungan (NIM, kode_mk). Nama mahasiswa hanya bergantung pada NIM. Bagaimana tabel diubah agar sesuai 2NF?",
  "options": [
    {"id": "A", "text": "Pisahkan nama mahasiswa ke tabel Mahasiswa dengan NIM sebagai kunci."},
    {"id": "B", "text": "Pindahkan nama mahasiswa ke tabel MataKuliah dengan kode_mk sebagai kunci."},
    {"id": "C", "text": "Tambahkan nama mahasiswa ke kunci gabungan KRS."},
    {"id": "D", "text": "Hapus kode_mk dari kunci KRS tanpa memisahkan data."}
  ],
  "correctOptionId": "A",
  "explanation": "Pemisahan nama mahasiswa menghilangkan ketergantungan pada sebagian kunci gabungan KRS.",
  "topic": "Normalisasi basis data",
  "cognitiveLevel": "penerapan",
  "suggestedMetadata": {
    "title": "Menghilangkan ketergantungan parsial",
    "tags": ["2NF", "normalisasi"]
  }
}
```

## Pemetaan ke editor dan serah terima Risyam

| Keluaran generator | Draf editor |
| --- | --- |
| `stem` | `stem` |
| `options[].text` | `options[]`, diurutkan A–D |
| `correctOptionId` | `answer`, indeks 0–3 |
| `explanation` | `explanation` |
| `topic` | `topic` |
| `cognitiveLevel` | `level`, label pada tabel level |
| `suggestedMetadata.title` | `title` |
| `suggestedMetadata.tags` | `suggestedMetadata.tags` |
| Sumber generator | `source` bernilai `ai` |

Backend menetapkan `format` menjadi `Pilihan Ganda`, `status` menjadi `draft`, serta pemilik berdasarkan sesi login. Setiap draf memiliki riwayat versi awal dan audit pembuatan. Risyam dapat menggunakan `questions` dalam fixture sebagai masukan pemeriksaan kualitas dan ID pada `drafts` untuk menautkan hasil pemeriksaan ke soal tersimpan. Validasi otomatis memeriksa struktur, jumlah, dan konsistensi dasar. Dosen memeriksa kebenaran akademik serta kecocokan level kognitif.

## Penanganan kegagalan

Kesalahan HTTP menggunakan `{message, code}` untuk kegagalan generator. Validasi field umum menggunakan `message`.

| HTTP | Kode | Kondisi |
| --- | --- | --- |
| 400 | `AI_INVALID_INPUT` atau validasi field | Input wajib kosong, jumlah di luar batas, atau level tidak tersedia |
| 401 | Sesi aplikasi | Pengguna perlu masuk kembali |
| 422 | `AI_REFUSAL` | Model menolak permintaan |
| 503 | `AI_NOT_CONFIGURED` | API key belum tersedia |
| 503 | `AI_INVALID_CONFIG` | `AI_PROVIDER` berisi penyedia yang belum didukung |
| 503 | `AI_ACCESS_DENIED` | API key atau akses model ditolak |
| 503 | `AI_RATE_LIMITED` | Kuota habis atau provider membatasi permintaan |
| 503 | `AI_UNAVAILABLE` | Layanan AI sedang sibuk atau sementara tidak tersedia |
| 502 | `AI_PROVIDER_ERROR` / `AI_CONNECTION_ERROR` | Provider gagal atau respons tidak dapat dibaca |
| 502 | `AI_INCOMPLETE` | Respons model terhenti |
| 502 | `AI_INVALID_OUTPUT` | Jumlah soal salah, opsi atau kunci tidak valid, soal berulang, atau metadata tidak lengkap |
| 504 | `AI_TIMEOUT` | Permintaan model melewati 45 detik |

Generator melakukan satu panggilan model per permintaan. Setelah hasil valid, penyimpanan draf, riwayat, dan audit dilakukan dalam satu transaksi agar kegagalan di tengah proses membatalkan seluruh batch. Jika koneksi browser terputus setelah penyimpanan, periksa Bank Soal sebelum mengirim permintaan baru. Kegagalan validasi menampilkan pesan yang meminta pengguna memperbaiki materi atau mencoba kembali.

## Target demo

1. Isi API key dan jalankan server serta PostgreSQL.
2. Masuk ke aplikasi, lalu buka **Buat Soal → Bantuan AI**.
3. Pilih **AI dari Topik**, isi **Normalisasi basis data**, lalu pilih **Basis Data**, **3 soal**, dan **C3 · Penerapan**. Untuk demo memakai fixture materi, ganti sumber menjadi **Dari Materi Rujukan** dan isi `material` dari fixture.
4. Klik **Buat Draf Soal**. Setelah selesai, editor membuka draf pertama.
5. Buka **Soal 1**, **Soal 2**, dan **Soal 3**. Periksa opsi, kunci, pembahasan, dan saran tag. Simpan setiap penyuntingan sebelum berpindah soal.
6. Muat ulang halaman dan pastikan ketiga draf tersedia di Bank Soal.

`npm run test:ai` menguji generator dengan respons provider yang dikendalikan untuk memeriksa kondisi sukses dan gagal. Pengujian model sungguhan memerlukan API key dan kuota yang aktif.

## Referensi integrasi

- [OpenAI Responses API quickstart](https://developers.openai.com/api/docs/quickstart)
- [Structured Outputs dan penanganan respons tidak lengkap](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Model GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini)
- [Gemini Interactions API](https://aistudio.google.com/docs/interactions-overview)
- [Gemini Structured Outputs](https://aistudio.google.com/docs/structured-output)
- [Model Gemini 4 Hydrogen](https://aistudio.google.com/docs/models/gemini-4-hydrogen)
