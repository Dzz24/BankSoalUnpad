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
| CTT-05 | 7 | 0,70 | Mudah | 2 | 1 | 1/3 = 0,333 |

Kategori mengikuti halaman Analisis Kualitas: Mudah p ≥ 0,70; Sedang 0,40 ≤ p < 0,70; Sulit p < 0,40. Rata-rata p = 2,6 ÷ 5 = 0,52. Rata-rata D = 3,667 ÷ 5 = 0,733. Tidak ada soal dengan D < 0,25.

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

## Hal yang perlu disepakati dengan pakar assessment

Semua dibuat sebagai parameter di `defaultCttOptions`, jadi bisa diubah tanpa mengubah rumus.

1. Aturan respons kosong: dihitung salah (bawaan) atau tidak dihitung.
2. Ukuran daya pembeda yang dipakai untuk penanda: indeks D 27% (bawaan) atau point-biserial terkoreksi; batas penanda (bawaan D < 0,25).
3. Batas jumlah peserta minimal (10) dan memadai (30).
4. Kriteria pengecoh berfungsi (≥ 5% dan lebih banyak dipilih kelompok bawah).
5. Batas kategori Mudah/Sedang/Sulit (bawaan mengikuti UI: 0,70 dan 0,40).
6. Penanganan skor sama di batas kelompok atas/bawah (bawaan: diurutkan menurut ID peserta dan diberi catatan).
