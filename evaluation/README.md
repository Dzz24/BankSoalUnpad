# Evaluasi CTT 1 dan CTT 2 — Kontribusi Risyam

## Tujuan

Folder ini membantu Risyam:
1. Membaca hasil CTT 1 yang sudah dihitung Rizki.
2. Membuat catatan awal butir yang perlu ditinjau, termasuk distribusi pengecoh.
3. Mencatat rekomendasi perbaikan untuk Dzikri/dosen.
4. Membandingkan CTT 1 dengan CTT 2 setelah butir hasil revisi diuji kembali.

**Script ini tidak menghitung CTT.** Perhitungan proporsi benar, daya pembeda, dan distribusi jawaban tetap menjadi tanggung jawab Rizki.

## Struktur folder

```text
evaluation/
├── ctt_evaluator.py
├── README.md
├── templates/
│   ├── ctt1_template.csv
│   ├── ctt2_template.csv
│   ├── item_mapping_template.csv
│   └── evaluation_notes_template.csv
├── sample_data/
│   ├── ctt1_dummy.csv
│   ├── ctt2_dummy.csv
│   └── mapping_dummy.csv
└── tests/
    └── test_ctt_evaluator.py
```

## Format input dari Rizki

Satu baris mewakili satu butir soal pada satu hasil/periode CTT.

| Kolom | Makna |
|---|---|
| `question_id` | ID butir |
| `item_version` | Versi butir |
| `total_responses` | Jumlah respons yang menjadi dasar distribusi |
| `difficulty_index` | Proporsi jawaban benar (diasumsikan 0–1; konfirmasi dengan Rizki) |
| `discrimination_index` | Nilai daya pembeda sesuai metode Rizki |
| `correct_option` | Kunci A/B/C/D |
| `option_A_count` sampai `option_D_count` | Jumlah peserta yang memilih setiap opsi |

**Sebelum menggunakan data asli:** konfirmasi dengan Rizki nama kolom, definisi indeks kesulitan, metode daya pembeda, aturan respons kosong, dan apakah distribusi opsi menghitung respons kosong atau tidak. Format ini adalah usulan awal, belum dikonfirmasi oleh Rizki.

Template mengasumsikan indeks kesulitan berupa proporsi 0–1, bukan persen 0–100. Jika format output Rizki berbeda, sesuaikan pemetaan input sebelum menjalankan script.

Data di `sample_data/` adalah data dummy untuk mencoba program, bukan hasil ujian sesungguhnya.

## Cara menjalankan

Gunakan Python 3. Tidak perlu memasang library eksternal.

Jalankan perintah dari folder `evaluation/`.

### 1. Evaluasi awal CTT 1

```bash
python ctt_evaluator.py --ctt1 sample_data/ctt1_dummy.csv --out hasil_evaluasi_ctt1
```

Keluaran:
- `evaluasi_awal_ctt1.csv`: data CTT dan catatan awal untuk ditinjau.
- `ringkasan.json`: ringkasan jumlah soal.

### 2. Perbandingan CTT 1 dan CTT 2

Jika ID soal tetap sama:

```bash
python ctt_evaluator.py --ctt1 sample_data/ctt1_dummy.csv --ctt2 sample_data/ctt2_dummy.csv --out hasil_perbandingan
```

Jika ID soal berubah, gunakan mapping:

```bash
python ctt_evaluator.py --ctt1 hasil_ctt1.csv --ctt2 hasil_ctt2.csv --mapping mapping_soal.csv --out hasil_perbandingan
```

Mapping berisi `ctt1_question_id`, `ctt2_question_id`, `relation`, dan `notes` (opsional). `relation` hanya boleh `revised` atau `replacement`:
- `revised`: butir yang sama direvisi dan identitas/tujuan butir dipertahankan.
- `replacement`: butir lama diganti dengan butir baru. Jangan menyimpulkan bahwa butir yang sama meningkat; kesetaraan materi dan tujuan perlu ditinjau.

Keluaran perbandingan:
- `perbandingan_ctt1_ctt2.csv`: nilai CTT1, CTT2, dan perubahan CTT2 dikurangi CTT1.
- `soal_tidak_berpasangan.csv`: butir yang tidak memiliki pasangan.
- `ringkasan.json`.

### 3. Menjalankan unit test

```bash
python -m unittest discover -s tests -v
```

## Cara membaca hasil dengan hati-hati

- Indeks kesulitan yang lebih tinggi berarti proporsi benar lebih tinggi (soal relatif lebih mudah). Nilai lebih tinggi tidak otomatis berarti kualitas lebih baik.
- Daya pembeda harus diinterpretasikan sesuai metode dan konvensi indeks yang dipakai Rizki.
- Pengecoh yang tidak dipilih peserta ditandai untuk ditinjau, bukan otomatis dinyatakan gagal. Perhatikan jumlah dan karakteristik peserta.
- Jika jumlah peserta atau kondisi ujian berbeda, catat sebagai keterbatasan perbandingan.
- Script tidak menetapkan cut-off, kategori bagus/buruk, atau keputusan otomatis. Interpretasi akhir dilakukan evaluator/dosen/pakar.

## Alur kerja tim

1. Rizki menghasilkan ekspor CTT 1.
2. Risyam menjalankan evaluasi awal dan meninjau isi soal serta distribusi opsi.
3. Risyam mengisi rekomendasi pada kolom `recommendation_to_dzikri` atau `evaluation_notes_template.csv`.
4. Dzikri dan dosen memperbaiki atau membuat butir berdasarkan rekomendasi.
5. Butir hasil revisi diuji kembali dan menghasilkan respons baru.
6. Rizki menghitung CTT 2.
7. Risyam membandingkan CTT 1 dan CTT 2 serta menyusun interpretasi before-after.

**CTT 2 memerlukan data respons baru setelah soal revisi diuji.** Hasil generasi AI saja belum cukup untuk menghasilkan CTT 2.
