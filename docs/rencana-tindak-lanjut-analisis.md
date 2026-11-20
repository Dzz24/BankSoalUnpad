# Rencana Tindak Lanjut Soal Setelah Analisis CTT

Status: **usulan untuk dibahas tim** (belum diimplementasikan, kecuali bagian yang ditandai "sudah ada").
Acuan: BRD Bank Soal (bab 6 alur langkah 6, bab 7.1, bab 8, 10.2), FSD v1.0 draft (FR-06, FR-11, FR-12, FR-14, FR-15, RB-02, RB-06-1 s.d. RB-06-3, RB-12-1 s.d. RB-12-3, validasi FR-08).

## 1. Tujuan

Hasil analisis CTT saat ini hanya dibaca. Dokumen ini merancang langkah lanjutnya: soal yang hasil analisisnya menunjukkan masalah ditandai, lalu dosen memutuskan tindakan. Prinsip yang dipegang dari dokumen:

- Statistik hanya bahan pertimbangan. Sistem **tidak boleh** menghapus, mengesahkan, atau mengubah status soal secara otomatis (RB-12-2, BRD 2.2).
- Riwayat versi, penggunaan, dan hasil analisis tidak boleh hilang saat soal direvisi atau dipensiunkan (RB-02, RB-06-3, RB-14-2).
- Hasil analisis selalu terikat ke versi soal yang dianalisis. Statistik versi lama tidak dipakai untuk versi baru (RB-12-1, BRD 10.2).

## 2. Keputusan sementara tim

| # | Hal | Keputusan |
|---|---|---|
| 1 | "Sudah dianalisis" | Dibuat sebagai **label tambahan** di samping status. Soal tetap berstatus Disetujui. FSD **tidak** direvisi sekarang; perbedaan ini dicatat di bagian 10 untuk revisi FSD berikutnya. |
| 2 | Siapa yang boleh memensiunkan soal | **Dosen pemilik soal dan admin prodi.** |
| 3 | Status "Ditolak" (ada di aplikasi, tidak ada di daftar status FSD) | **Dipertahankan.** |

## 3. Alur

```
Disetujui ──(dipakai di paket → respons diimpor → analisis CTT, data memadai)──► label "Sudah dianalisis"
                                                                                       │
                                                       ada prioritas tindak lanjut? ── tidak ──► tetap dipakai
                                                                                       │ ya
                                                                         masuk daftar "Perlu Ditinjau"
                                                                                       │
                                                         Dosen memutuskan (alasan wajib diisi):
              ┌──────────────────────────────┬──────────────────────────────────┐
         Pertahankan                 Revisi (buat versi baru)                Pensiunkan
   status tetap Disetujui,      versi baru → Draf → Review →          status Dipensiunkan,
   tindak lanjut ditutup        Disetujui (alur review yang ada).     tidak bisa dipilih untuk
   dengan alasan                Versi lama tetap menyimpan hasil      paket baru, riwayat tetap
                                analisisnya; versi baru belum
                                berlabel "Sudah dianalisis"
```

Soal hanya mendapat label "Sudah dianalisis" bila `analyzed = true` dari modul CTT (status data bukan *insufficient*), sesuai ALT-12-1 dan RB-06-2.

## 4. Prioritas tindak lanjut (sudah ada di `shared/ctt.js`)

| Prioritas | Penanda pemicu | Saran yang ditampilkan |
|---|---|---|
| Tinggi | `key-check` (D negatif atau opsi lain lebih menarik bagi kelompok atas), `low-discrimination` (D < 0,20) | Periksa kunci; revisi besar atau pensiunkan |
| Sedang | `marginal-discrimination` (D 0,20–0,29), `extreme-difficulty` (p ≥ 0,90 atau p ≤ 0,20), `high-blank` (kosong ≥ 10%) | Revisi redaksi atau pengecoh; cek waktu ujian |
| Rendah | `distractor-review` (ada pengecoh tidak berfungsi) | Ganti pengecoh saat revisi berikutnya |

`data-check` (respons di luar opsi) tidak memengaruhi prioritas karena menyangkut file, bukan soal. Semua batas adalah default sementara yang menunggu persetujuan pakar assessment (lihat `docs/ctt-hitung-manual.md`).

## 5. Aksi tindak lanjut

| Aksi | Siapa | Syarat | Efek | Dicatat |
|---|---|---|---|---|
| **Pertahankan** | Dosen pemilik | Ada hasil analisis dengan prioritas | Status tidak berubah; tindak lanjut untuk hasil itu ditutup | Keputusan + alasan + ID hasil analisis + versi, audit log |
| **Revisi** | Dosen pemilik | Soal Disetujui | Membuka editor dengan isi versi saat ini dan catatan hasil analisis sebagai konteks. Simpan → versi baru berstatus Draf → alur review yang ada. Versi lama tetap Disetujui sampai versi baru disetujui (perlu dikonfirmasi, lihat bagian 11). | Keputusan + alasan, audit log, riwayat versi |
| **Pensiunkan** | Dosen pemilik, admin prodi | Soal tidak sedang Menunggu Review | Status Dipensiunkan; soal tidak muncul di pilihan paket baru (validasi FR-08); tetap terlihat di Bank Soal dengan filter status | Keputusan + alasan, audit log |

Alasan wajib diisi untuk ketiga aksi agar keputusan dapat ditelusuri (BR-07, FR-15). Tidak ada aksi yang berjalan otomatis.

## 6. Tampilan per halaman

| Halaman | Perubahan |
|---|---|
| Hasil Ujian | **Sudah ada (pratinjau):** tombol "Pratinjau Analisis CTT" menghitung di browser dari kunci versi soal di database, belum disimpan. Nanti: hasil disimpan setelah impor tervalidasi. |
| Analisis Kualitas | Kartu "Perlu Ditinjau" diisi dari hasil tersimpan, dikelompokkan menurut prioritas. Klik soal → detail hasil (indeks, distribusi pilihan, interpretasi, saran) + tiga tombol aksi. Batas kategori disamakan dengan modul (sulit ≤ 0,30, D rendah < 0,20). Kartu reliabilitas hanya tampil saat satu ujian dipilih. |
| Bank Soal | Filter dan kolom status menampilkan Dipensiunkan; lencana "Sudah dianalisis" dan "Perlu ditinjau". |
| Detail / Riwayat Soal | Hasil analisis per versi per ujian dan riwayat keputusan tindak lanjut. |
| Paket Ujian | Soal Dipensiunkan tidak bisa dipilih. Soal berprioritas Tinggi boleh dipilih tetapi diberi peringatan. |
| Dashboard | Jumlah soal yang perlu ditindaklanjuti per prioritas. |

## 7. Data (usulan untuk backend)

| Tabel | Kolom utama | Catatan |
|---|---|---|
| `exam_imports` | id, paket/ujian, periode, nama file, jumlah baris, status validasi, aktor, waktu | Satu impor = satu kali ujian |
| `exam_responses` | import_id, id_peserta (samaran), question_id, version, respons | Dibuat setelah lolos validasi FR-11 |
| `analysis_results` | id, import_id, question_id, version, metode + versi metode, parameter, hasil JSON dari `analyzeCtt()`, prioritas, waktu | Satu baris per versi soal per impor; tidak pernah ditimpa |
| `follow_up_decisions` | id, analysis_result_id, question_id, version, keputusan (keep/revise/retire), alasan, aktor, waktu | Menutup tindak lanjut untuk hasil tertentu |

Status `retired` (Dipensiunkan) perlu ditambahkan ke daftar status di `shared/question-fields.js` dan validasi server.

## 8. API (usulan)

| Metode | Endpoint | Fungsi |
|---|---|---|
| POST | `/api/imports` | Unggah dan validasi file respons, simpan bila valid |
| POST | `/api/imports/:id/analysis` | Jalankan `analyzeCtt()` untuk impor itu dan simpan hasil |
| GET | `/api/analysis?status=perlu-ditinjau` | Daftar hasil dengan prioritas yang belum diputuskan |
| GET | `/api/questions/:id/analysis` | Hasil analisis per versi soal |
| POST | `/api/analysis/:resultId/decision` | Simpan keputusan Pertahankan/Revisi/Pensiunkan |
| POST | `/api/questions/:id/retire` | Pensiunkan soal (dosen pemilik, admin prodi) |

## 9. Tahapan dan pembagian

| Tahap | Isi | Penanggung jawab | Status |
|---|---|---|---|
| 1 | Modul perhitungan CTT, data uji, hitungan manual | Rizki | Selesai (`shared/ctt.js`) |
| 2 | Pratinjau CTT di Hasil Ujian | Rizki | Selesai, menunggu persetujuan tim (branch `feat/ctt-preview`) |
| 3 | Validasi impor ke bank soal, penyimpanan respons dan hasil | Backend | Belum |
| 4 | Label "Sudah dianalisis", status Dipensiunkan, aksi tindak lanjut, audit | Backend + frontend | Belum |
| 5 | Analisis Kualitas memakai hasil tersimpan, detail per soal | Frontend | Belum |
| 6 | Persetujuan default oleh pakar assessment | Tim + pakar | Belum |

## 10. Catatan perbedaan dengan FSD (untuk revisi FSD berikutnya)

- FSD FR-06 menyebut "Sudah dianalisis" sebagai **status**. Rencana ini memakainya sebagai **label tambahan** agar soal yang sudah dianalisis tetap berstatus Disetujui dan tetap bisa dipakai di paket.
- Status "Ditolak" dipakai aplikasi tetapi belum tercantum di FR-06.
- FSD bagian 6.3 Notifikasi masih kosong; pemberitahuan "soal perlu ditinjau" ke dosen pemilik bisa diusulkan di revisi berikutnya.

## 11. Pertanyaan terbuka

1. Saat soal direvisi, apakah versi lama tetap boleh dipakai di paket baru sampai versi baru disetujui, atau langsung ditahan?
2. Apakah keputusan Pertahankan untuk soal berprioritas Tinggi perlu persetujuan reviewer?
3. Apakah soal Dipensiunkan boleh diaktifkan kembali (dengan alasan), atau permanen?
4. Siapa yang menjalankan analisis: Analis Assessment saja, atau juga dosen pemilik untuk mata kuliahnya?
