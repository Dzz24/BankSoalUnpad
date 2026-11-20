# Analisis CTT — Data Uji dan Hitungan Manual

Dokumen ini menjadi acuan untuk mencocokkan hasil `shared/ctt.js` dengan hitungan tangan. Angka di sini juga dipakai sebagai nilai harapan di `test/ctt.test.mjs`.

## Cara menjalankan

```sh
npm test                                    # test otomatis
npm run ctt:demo                            # laporan data contoh di terminal
npm run ctt:demo -- --out laporan-ctt.csv   # simpan laporan CSV
npm run ctt:demo -- --kosong exclude        # aturan kosong = tidak dihitung
npm run ctt:demo -- --respons respons.csv --kunci kunci.csv
```

File respons mengikuti template di halaman Hasil Ujian: `id_peserta, id_soal, versi_soal, respons`. File kunci berisi `id_soal, versi_soal, kunci, jumlah_opsi, format`. Di aplikasi, kunci disimpan sebagai indeks (`answer: 0, 1, 2, …`); backend mengubahnya ke huruf dengan `optionLabel()` (0 = A, 1 = B, dst.).

## Data uji

10 peserta, 5 soal. CTT-01 s.d. CTT-04 pilihan ganda 4 opsi, CTT-05 Benar/Salah (A = Benar, B = Salah). Data ada di `test/fixtures/`.

| Peserta | CTT-01 (A) | CTT-02 (B) | CTT-03 (C) | CTT-04 (D) | CTT-05 (A) | Skor total |
|---|---|---|---|---|---|---|
| P01 | A ✓ | B ✓ | C ✓ | D ✓ | A ✓ | 5 |
| P02 | A ✓ | B ✓ | C ✓ | D ✓ | B | 4 |
| P03 | A ✓ | B ✓ | C ✓ | C | A ✓ | 4 |
| P04 | A ✓ | B ✓ | A | C | A ✓ | 3 |
| P05 | A ✓ | A | C ✓ | A | A ✓ | 3 |
| P06 | A ✓ | B ✓ | B | C | A ✓ | 3 |
| P07 | A ✓ | C | B | A | A ✓ | 2 |
| P08 | B | A | D | A | A ✓ | 1 |
| P09 | A ✓ | D | E (tidak valid) | C | B | 1 |
| P10 | (kosong) | A | B | C | B | 0 |

Aturan bawaan: kosong dan tidak valid dihitung salah (skor 0).

## Kelompok atas dan bawah

27% × 10 = 2,7 → dibulatkan 3 peserta per kelompok. Urutkan skor total menurun:

- Kelompok atas (A): P01 (5), P02 (4), P03 (4)
- Kelompok bawah (B): P08 (1), P09 (1), P10 (0)

Batas kelompok tidak jatuh pada skor yang sama (peringkat 3 = 4 vs peringkat 4 = 3; peringkat 7 = 2 vs peringkat 8 = 1), jadi pembagiannya tidak ambigu.

## Proporsi benar (p) dan daya pembeda (D)

p = jumlah benar ÷ jumlah peserta. D = (benar di A ÷ 3) − (benar di B ÷ 3).

| Soal | Benar | p | Kategori | Benar di A | Benar di B | D |
|---|---|---|---|---|---|---|
| CTT-01 | 8 | 0,80 | Mudah | 3 | 1 | 2/3 = 0,667 |
| CTT-02 | 5 | 0,50 | Sedang | 3 | 0 | 1,000 |
| CTT-03 | 4 | 0,40 | Sedang | 3 | 0 | 1,000 |
| CTT-04 | 2 | 0,20 | Sulit | 2 | 0 | 2/3 = 0,667 |
| CTT-05 | 7 | 0,70 | Sedang | 2 | 1 | 1/3 = 0,333 |

Kategori kesukaran mengikuti Arikunto: Sulit (sukar) p ≤ 0,30; Sedang 0,31–0,70; Mudah p > 0,70. CTT-05 dengan p = 0,70 tepat di batas dan masuk Sedang. Rata-rata p = 2,6 ÷ 5 = 0,52. Rata-rata D = 3,667 ÷ 5 = 0,733. Tidak ada soal dengan D < 0,30.

## Point-biserial terkoreksi

Korelasi Pearson antara skor butir (0/1) dan skor sisa (skor total dikurangi skor butir itu). Contoh CTT-01:

- Skor butir: 1,1,1,1,1,1,1,0,1,0 (rata-rata 0,8)
- Skor sisa: 4,3,3,2,2,2,1,1,0,0 (rata-rata 1,8)
- Σ(x − x̄)(y − ȳ) = 2,6; Σ(x − x̄)² = 1,6; Σ(y − ȳ)² = 15,6
- r = 2,6 ÷ √(1,6 × 15,6) = 2,6 ÷ 4,996 = **0,520**

| Soal | CTT-01 | CTT-02 | CTT-03 | CTT-04 | CTT-05 |
|---|---|---|---|---|---|
| r pbis terkoreksi | 0,520 | 0,616 | 0,560 | 0,429 | 0,111 |

## Distribusi pilihan dan pengecoh

Pengecoh berfungsi bila dipilih ≥ 5% peserta (≥ 0,5 orang, jadi minimal 1) **dan** lebih banyak dipilih kelompok bawah daripada kelompok atas.

| Soal | Opsi | Dipilih | di A | di B | Berfungsi? |
|---|---|---|---|---|---|
| CTT-01 | B | 1 | 0 | 1 | Ya |
| | C, D | 0 | 0 | 0 | Tidak (tidak dipilih) |
| | kosong | 1 | 0 | 1 | — dilaporkan terpisah |
| CTT-02 | A | 3 | 0 | 2 | Ya |
| | C | 1 | 0 | 0 | Tidak (hanya kelompok tengah) |
| | D | 1 | 0 | 1 | Ya |
| CTT-03 | A | 1 | 0 | 0 | Tidak |
| | B | 3 | 0 | 1 | Ya |
| | D | 1 | 0 | 1 | Ya |
| | tidak valid (E) | 1 | 0 | 1 | — dilaporkan terpisah |
| CTT-04 | A | 3 | 0 | 1 | Ya |
| | B | 0 | 0 | 0 | Tidak |
| | C | 5 | 1 | 2 | Ya |
| CTT-05 | — | | | | Tidak berlaku (dua opsi) |

Pengecoh efektif = (1 + 2 + 2 + 2) ÷ (4 soal × 3 pengecoh) = 7/12 = **58%**. Soal Benar/Salah tidak ikut dihitung.

## Reliabilitas KR-20

KR-20 = k/(k − 1) × (1 − Σpq ÷ σ²), dengan σ² variansi skor total berpembagi N.

- Σpq = 0,16 + 0,25 + 0,24 + 0,16 + 0,21 = 1,02
- Skor total: 5,4,4,3,3,3,2,1,1,0 → rata-rata 2,6; σ² = 22,4 ÷ 10 = 2,24
- KR-20 = 5/4 × (1 − 1,02 ÷ 2,24) = 1,25 × 0,5446 = **0,681**

## Varian: kosong tidak dihitung (`--kosong exclude`)

- CTT-01: P10 (kosong) keluar dari pembagi → n = 9.
- CTT-03: P09 (tidak valid) keluar dari pembagi → n = 9.
- Dengan batas minimal 10 respons, kedua soal berstatus **data belum memadai**: indeks tidak dihitung, distribusi pilihan tetap ditampilkan.
- KR-20 tidak dihitung karena matriks skor tidak lengkap.

## Status kecukupan data

| Status | Syarat bawaan | Perilaku |
|---|---|---|
| `insufficient` | n < 10 | Indeks tidak dihitung; hanya distribusi pilihan |
| `indicative` | 10 ≤ n < 30 | Indeks dihitung dengan keterangan "indikatif" |
| `adequate` | n ≥ 30 | Indeks dihitung |

Semua soal di data uji berstatus `indicative` (n = 10).

## Penanda, interpretasi, dan rekomendasi

Setiap soal mendapat `interpretation` (penjelasan bahasa sederhana) dan `recommendations` (saran pemeriksaan), sesuai BRD 2.1 dan bab 8. Hasil statistik hanya bahan pertimbangan dan tidak otomatis menghapus atau mengesahkan soal (RB-12-2).

| Penanda | Muncul bila | Rekomendasi yang ditampilkan |
|---|---|---|
| `key-check` | D < 0, **atau** ada opsi lain yang lebih banyak dipilih kelompok atas daripada kunci (point-biserial negatif dipakai bila D tidak dapat dihitung) | Periksa kunci jawaban; mungkin keliru atau ada lebih dari satu jawaban yang dapat dibenarkan |
| `low-discrimination` | 0 ≤ D < 0,20 (jelek menurut Ebel) | Revisi besar atau ganti soal |
| `marginal-discrimination` | 0,20 ≤ D < 0,30 (perlu perbaikan menurut Ebel) | Tinjau redaksi dan pengecoh |
| `extreme-difficulty` | p ≥ 0,90 atau p ≤ 0,20 | Hampir selalu benar → pertimbangkan perlunya; sangat sedikit yang benar → periksa redaksi, kunci, kesesuaian materi |
| `high-blank` | Respons kosong ≥ 10% peserta | Periksa kecukupan waktu ujian atau kejelasan redaksi |
| `distractor-review` | Ada pengecoh yang belum berfungsi | Opsi tidak dipilih → ganti pengecoh; opsi lebih banyak dipilih kelompok atas → periksa kemiripan dengan jawaban benar; opsi jarang menarik kelompok bawah → buat lebih masuk akal |
| `data-check` | Ada respons di luar opsi soal | Periksa file hasil ujian sebelum mengambil keputusan (masalah data, bukan masalah soal) |

Kategori daya pembeda pada interpretasi mengikuti Ebel: negatif (< 0), jelek (< 0,20), perlu perbaikan (0,20–0,29), cukup (0,30–0,39), baik (≥ 0,40).

### Prioritas tindak lanjut

Field `followUp` berisi prioritas dan alasannya. Hanya diisi untuk soal yang datanya memadai (`analyzed = true`) dan hanya berupa saran; keputusan tetap di tangan dosen (RB-12-2).

| Prioritas | Penanda pemicu |
|---|---|
| Tinggi | `key-check`, `low-discrimination` |
| Sedang | `marginal-discrimination`, `extreme-difficulty`, `high-blank` |
| Rendah | `distractor-review` |

`data-check` tidak memengaruhi prioritas karena menyangkut kualitas file, bukan kualitas soal.

Hasil pada data uji: CTT-01 Sedang (10% kosong, pengecoh), CTT-02 Rendah, CTT-03 Rendah (+ `data-check`), CTT-04 Sedang (p = 0,20), CTT-05 tanpa tindak lanjut.

Pada data uji tidak ada soal yang memicu `key-check`. Contoh kasusnya ada di `test/ctt.test.mjs` (blok "penanda kunci perlu dicek"): kunci K1 = A, tetapi 2 dari 3 peserta kelompok atas memilih B, sehingga D = 1/3 − 2/3 = −0,333.

## Status "Sudah dianalisis"

Field `analyzed` bernilai `true` hanya bila status kecukupan bukan `insufficient`. Backend dapat memakai field ini sebagai syarat status soal "Sudah dianalisis" (BRD 7.1, RB-06-2), sehingga soal dengan data kurang tidak dinyatakan sudah dianalisis secara empiris (ALT-12-1).

## Ketelusuran, privasi, toleransi, dan kinerja

- **Metadata metode** (`result.method`): nama metode, versi (`CTT_METHOD_VERSION`, saat ini 1.2.0), waktu hitung, dan seluruh parameter yang dipakai. Disimpan bersama hasil agar hasil lama tetap dapat dijelaskan walau parameter berubah (BR-07, FSD FR-12 langkah 4). Naikkan versi bila rumus atau aturan penanda diubah.
- **Privasi**: daftar ID peserta kelompok atas/bawah tidak disertakan secara bawaan. Aktifkan `includeParticipantIds: true` hanya untuk pemeriksaan internal oleh analis (BRD 9.2).
- **Toleransi numerik** (NFR-14): `CTT_TOLERANCE = 0,001`. Hasil dianggap sesuai acuan bila selisihnya di bawah nilai ini; test memakai toleransi yang sama.
- **Kinerja** (NFR-03, ≤ 2 menit untuk 200 peserta × 100 soal): test "kinerja" menjalankan ukuran tersebut; pada uji lokal selesai dalam puluhan milidetik.

## Default sementara (menunggu persetujuan pakar assessment)

Semua dibuat sebagai parameter di `defaultCttOptions`, jadi bisa diubah tanpa mengubah rumus. Nilai di bawah dipilih karena paling umum dipakai dan mudah dipertanggungjawabkan.

| # | Hal | Default sementara | Acuan |
|---|---|---|---|
| 1 | Respons kosong | Dihitung salah; peringatan bila ≥ 10% per soal | Praktik umum ujian kelas (number-right scoring) |
| 2 | Ukuran daya pembeda untuk penanda | Indeks D kelompok 27%; point-biserial terkoreksi sebagai pembanding | Kelley (27%), Ebel (kategori D) |
| 3 | Jumlah peserta | Minimal 10, memadai 30 | Aturan praktis; di bawah 30 diberi label indikatif |
| 4 | Pengecoh berfungsi | Dipilih ≥ 5% peserta dan lebih banyak oleh kelompok bawah | Haladyna & Downing; Rodriguez (2005) |
| 5 | Kategori kesukaran | Sukar ≤ 0,30; sedang 0,31–0,70; mudah > 0,70 | Arikunto |
| 6 | Skor sama di batas kelompok | Diurutkan menurut ID peserta, diberi catatan | Hasil selalu dapat diulang |
| 7 | Penanda kunci | D < 0 atau opsi lain lebih menarik bagi kelompok atas | Anjuran pemeriksaan mis-key/double-key |
| 8 | Toleransi numerik | 0,001 | Laporan 3 desimal |
| 9 | Respons tidak valid | Seharusnya ditahan saat validasi impor (NFR-09); di modul dihitung salah sebagai cadangan dan diberi penanda `data-check` | NFR-09 |

Halaman Analisis Kualitas saat ini masih memakai batas lama (sulit < 0,40, daya pembeda rendah < 0,25). Batas itu perlu disamakan saat halaman disambungkan ke hasil sungguhan.
