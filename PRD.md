# PRD REMINDRA V2.0

Product Requirement Document untuk sistem retensi konsumen dan follow-up otomatis AHASS.

## Metadata Produk

| Item | Keterangan |
| --- | --- |
| Nama Proyek | REMINDRA V2.0 |
| Tahun | 2026 |
| Unit Kerja | AHASS PT. Sanprima Sentosa (12802) |
| Kategori | SS (Sumbang Saran) / QCC |
| Target Implementasi | Dealer & AHASS Network |
| Status Dokumen | Updated, alur kerja berbasis AI |

## 1. Pendahuluan & Latar Belakang

Dalam operasional AHASS, menjaga hubungan baik dengan konsumen setelah mereka meninggalkan bengkel adalah kunci untuk mempertahankan dan meningkatkan omzet penjualan suku cadang serta jasa. REMINDRA dibuat untuk menutup celah operasional yang selama ini menyebabkan potensi pendapatan hilang.

### A. Inefisiensi Proses Pengelolaan Hotline Order

Pemantauan konsumen saat barang pesanan khusus atau Hotline Order telah tiba masih membutuhkan pengecekan manual yang konstan. Petugas Part Counter harus memantau status di Portal HO, menyalin data berulang, dan memproses pesanan satu per satu.

Dampaknya:

- Waktu operasional tersita untuk pekerjaan administratif berulang.
- Risiko keterlambatan follow-up meningkat.
- Human error dapat terjadi karena data harus disalin dan dipetakan manual.
- Potensi penjualan hilang ketika pesanan tidak segera ditindaklanjuti.

### B. Penguapan Data Saran Mekanik Pasca-Servis

Rekomendasi perbaikan lanjutan dari mekanik, misalnya kondisi V-Belt mulai retak dan disarankan diganti bulan depan, biasanya tercatat di Greensys dan lembar Work Order fisik.

Masalah utama:

- Data rekomendasi spesifik tidak otomatis terbawa saat transaksi servis diekspor ke Excel atau XML.
- Catatan potensi omzet menumpuk di arsip WO fisik.
- Tidak ada pengingat terjadwal ke konsumen.
- Follow-up pasca-servis bergantung pada ingatan dan proses manual.

## 2. Tujuan Produk

REMINDRA bertujuan menjadi alat kerja Part Counter dan manajemen AHASS untuk mengubah data follow-up yang tercecer menjadi sistem retensi yang terstruktur, terukur, dan mudah dijalankan.

Tujuan utama:

- **Otomatisasi alur kerja berbasis AI**: memangkas waktu sortir, pencarian, dan input data manual hingga lebih dari 80% melalui AI-powered clipboard parser.
- **Sentralisasi data & potensi omzet**: mengubah hasil salinan Portal HO dan catatan saran mekanik menjadi data internal yang siap dimonitor.
- **Analisis keuangan terukur**: menyediakan rekap finansial bulanan untuk melihat volume, nilai transaksi, dan potensi omzet yang terselamatkan.
- **Peningkatan layanan konsumen**: memastikan komunikasi lebih personal, transparan, dan tepat waktu.

## 3. Profil Pengguna

### Primary User: Part Counter / Frontline

Bertanggung jawab untuk:

- Mengoperasikan sistem REMINDRA harian.
- Mengunggah atau memasukkan data transaksi.
- Mengekstrak data Hotline Order dari clipboard Portal HO menggunakan AI.
- Memverifikasi hasil ekstraksi sebelum disimpan.
- Menginput cepat saran mekanik dari WO fisik.
- Menindaklanjuti konsumen melalui pesan WhatsApp.

### Secondary User: Kepala Bengkel / Manajemen AHASS

Bertanggung jawab untuk:

- Memantau metrik efektivitas sistem.
- Melihat antrean pesanan dan follow-up.
- Mengevaluasi performa retensi konsumen.
- Mengekspor rekap bulanan untuk laporan dan analisis bisnis.

## 4. Kebutuhan Fitur

### Fitur 1: AI-Powered Portal Hotline Parser & Database Storage

Fitur ini menggunakan API Google AI Studio / Gemini untuk membaca teks mentah hasil copy-paste dari Portal Hotline Order yang sering tidak rapi, dempet, atau kehilangan struktur tabel.

#### Alur Kerja Pengguna

1. Pengguna memblok seluruh teks informasi pesanan di Portal HO.
2. Pengguna menyalin teks ke clipboard.
3. Pengguna membuka REMINDRA dan menempelkan teks ke kotak input parser.
4. Pengguna menekan tombol **Proses**.
5. Sistem menampilkan form konfirmasi berisi data hasil ekstraksi AI.
6. Pengguna memverifikasi atau mengedit data jika diperlukan.
7. Pengguna menekan **Simpan ke Database**.

#### Logika Sistem

- Backend mengirim teks mentah ke Gemini dengan system instruction yang ketat.
- AI mengekstrak entitas secara semantik, bukan hanya regex statis.
- Respons AI wajib berbentuk JSON valid.
- Sistem melakukan validasi struktur JSON sebelum menampilkan hasil.
- Data tidak langsung disimpan sebelum diverifikasi manusia.
- Jika parsing gagal, pengguna harus bisa masuk ke mode input manual.

#### Data Monitor Utama

| No | No PO Dealer | Nama Konsumen | No Tlp | No Part | ETA | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | PO-12802-2026-001 | AULIYAA RAYYANESTA YASIN | 6287884207640 | 35121K1ZNA0 | 2026-05-31 | Booked |
| 2 | PO-12802-2026-002 | BUDI SETIAWAN | 6281234567890 | 23100K97T01 | 2026-06-05 | Arrived |

### Fitur 2: Greensys Sync & Quick WO Checklist

Fitur ini mendigitalisasi data saran mekanik yang masih tertinggal di kertas WO fisik.

Alur kerja:

1. Pengguna mengunggah file Excel/XML hasil ekspor harian transaksi Greensys.
2. Sistem membaca biodata konsumen dan kendaraan dari ekspor tersebut.
3. Sistem menampilkan daftar antrean kendaraan hari itu.
4. Petugas membuka data konsumen sambil memegang WO fisik.
5. Petugas mencentang komponen yang direkomendasikan mekanik, seperti V-Belt, ban, kampas rem, oli, atau komponen lain.
6. Petugas memilih estimasi waktu follow-up, misalnya 1 minggu, 1 bulan, atau tanggal tertentu.
7. Sistem menyimpan rekomendasi sebagai antrean follow-up.

### Fitur 3: Dynamic WhatsApp Engine & Template Management

Sistem menyediakan pengaturan template pesan WhatsApp yang dapat dipersonalisasi menggunakan parameter dinamis dari database.

Contoh parameter:

- `{{nama_konsumen}}`
- `{{no_po_dealer}}`
- `{{nama_part}}`
- `{{no_part}}`
- `{{eta}}`
- `{{status}}`
- `{{rekomendasi_mekanik}}`
- `{{tanggal_follow_up}}`

Perilaku yang diharapkan:

- Pesan dapat dibuat otomatis berdasarkan status atau tanggal target.
- Pesan HO siap dikirim ketika status berubah menjadi `Arrived`.
- Pesan saran mekanik siap dikirim sesuai jadwal follow-up.
- Pengguna tetap dapat meninjau pesan sebelum dikirim.

### Fitur 4: Dasbor Dampak Bisnis

Dashboard menyediakan ringkasan visual bagi manajemen untuk menilai dampak REMINDRA terhadap performa bengkel.

Metrik utama:

- Total pengingat terkirim.
- Rasio konversi konsumen yang datang kembali.
- Estimasi omzet terselamatkan.
- Jumlah Hotline Order aktif.
- Jumlah saran mekanik yang menunggu follow-up.
- Total nilai part dan jasa dari transaksi yang berhasil dikonversi.

### Fitur 5: Rekap Bulanan & Financial Export

Menu rekap bulanan menyajikan data Hotline Order harian secara kumulatif dalam periode bulan tertentu.

Kegunaan:

- Audit internal.
- Laporan keuangan.
- Evaluasi performa penjualan part.
- Analisis potensi omzet dan konversi follow-up.

Kolom export minimal:

| No | No PO Dealer | Tgl PO | Nama Konsumen | No Tlp | No Part | Price |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | PO-12802-2026-001 | 2026-05-10 | AULIYAA RAYYANESTA YASIN | 6287884207640 | 35121K1ZNA0 | Rp350.000 |
| 2 | PO-12802-2026-002 | 2026-05-12 | BUDI SETIAWAN | 6281234567890 | 23100K97T01 | Rp145.000 |

Export harus mendukung format spreadsheet, seperti Excel atau CSV.

## 5. Arsitektur Teknis & Spesifikasi Non-Fungsional

### Frontend

- Antarmuka harus ringan, responsif, dan nyaman digunakan di PC desktop maupun smartphone.
- Tampilan utama harus mendukung pekerjaan cepat di area bengkel.
- Semua proses AI yang membutuhkan waktu wajib memiliki loading state berupa spinner, skeleton loader, atau indikator setara.

### Backend

- Backend bertanggung jawab untuk parsing AI, validasi JSON, penyimpanan database, dan integrasi WhatsApp.
- Backend harus menjaga API key Gemini dan kredensial database agar tidak terekspos ke frontend.
- Sistem dapat dijalankan di lingkungan cloud seperti Google Cloud Run atau platform backend lain yang setara.

### AI Processing

- Model rujukan PRD: Google AI Studio / Gemini Flash.
- AI digunakan untuk memahami data tidak terstruktur dari Portal HO.
- Output AI wajib dikunci ke format JSON.
- Backend wajib memvalidasi field penting sebelum data dapat disimpan.

### Database

Database menyimpan data terstruktur untuk:

- Hotline Order.
- Data konsumen.
- Data kendaraan.
- Saran mekanik.
- Reminder queue.
- Template WhatsApp.
- Riwayat pengiriman dan status follow-up.
- Rekap finansial.

### Error Handling & Fallback

- Jika respons AI bukan JSON valid, backend melakukan retry maksimal 2 kali.
- Jika retry tetap gagal, sistem menampilkan pesan:

```text
Sistem gagal mengekstrak data otomatis, silakan gunakan mode input manual.
```

- Sistem tidak boleh menyimpan data hasil AI yang belum valid atau belum dikonfirmasi pengguna.
- Error jaringan, kuota API habis, atau kegagalan provider harus ditampilkan dengan bahasa yang jelas bagi pengguna operasional.

### UX Requirement

- Setelah tombol **Proses** diklik, UI harus menampilkan indikator bahwa AI sedang bekerja.
- Target latensi normal AI adalah sekitar 1-3 detik.
- Pengguna harus bisa mengoreksi hasil parsing sebelum menyimpan.
- Alur input manual harus tetap tersedia sebagai fallback.

## 6. Struktur Data Parser

Schema hasil parsing Hotline Order minimal:

```json
{
  "dealer_po_number": "PO-12802-2026-001",
  "customer_name": "AULIYAA RAYYANESTA YASIN",
  "phone_number": "6287884207640",
  "part_number": "35121K1ZNA0",
  "part_name": "SET, FOB ASSY",
  "eta_revision": "2026-05-31",
  "status": "Booked",
  "po_date": "2026-05-10",
  "price": 350000
}
```

Aturan data:

- `dealer_po_number` wajib unik jika tersedia.
- `customer_name`, `phone_number`, `part_number`, dan `status` wajib diverifikasi pengguna.
- `price` disimpan sebagai angka, bukan string Rupiah.
- `status` mengikuti status operasional seperti `Booked`, `Arrived`, `Followed Up`, `Converted`, atau status lain yang disepakati sistem.
- Tanggal menggunakan format ISO `YYYY-MM-DD`.

## 7. Matriks Dampak Operasional

| Parameter | Sebelum REMINDRA | Setelah REMINDRA |
| --- | --- | --- |
| Waktu input & sortir data | 2-3 menit per konsumen karena data dicari, disalin, dan diketik manual. | Sekitar 5 detik untuk ekstraksi teks berantakan via AI ke form verifikasi. |
| Risiko salah salin | Tinggi, terutama nomor telepon dan kode part. | Mendekati nihil karena data diekstrak secara semantik dan diverifikasi manual. |
| Tindak lanjut & monitoring | Minim karena WO fisik menumpuk dan data HO mudah terlewat. | Terekam di database, termonitor di dashboard, dan siap direkap bulanan. |
| Potensi kebocoran omzet | Tinggi karena momentum follow-up sering hilang. | Diminimalkan melalui retensi digital terstruktur dan laporan finansial. |

## 8. Acceptance Criteria

REMINDRA dinyatakan sesuai PRD jika:

- Pengguna dapat memasukkan teks mentah Portal HO dan mendapatkan form hasil ekstraksi.
- Data hasil AI selalu melewati konfirmasi manusia sebelum disimpan.
- Pengguna dapat mencatat saran mekanik dari WO fisik dengan cepat.
- Sistem dapat membuat antrean reminder untuk HO dan saran mekanik.
- Template WhatsApp mendukung parameter dinamis.
- Dashboard menampilkan indikator dampak bisnis.
- Rekap bulanan dapat diekspor untuk kebutuhan laporan.
- Fallback input manual tersedia saat AI gagal.
- Semua pengembangan fitur baru tetap mengacu pada tujuan retensi, follow-up, dan penyelamatan omzet.

## 9. Rekomendasi Demo / Presentasi

Saat demonstrasi, tampilkan masalah nyata operasional:

- Tumpukan kertas WO fisik yang berisi catatan mekanik.
- Tampilan Portal Hotline Order yang padat.
- Contoh teks portal yang dempet dan sulit diproses parser biasa.
- Perbandingan proses manual dengan proses AI di REMINDRA.

Alur demo yang disarankan:

1. Salin teks berantakan dari Portal HO.
2. Tempel ke REMINDRA.
3. Jalankan parser AI.
4. Tampilkan form verifikasi.
5. Simpan ke database.
6. Tampilkan antrean follow-up dan dashboard.
7. Export rekap bulanan.

Pesan utama demo: REMINDRA memangkas pekerjaan administratif berulang, mengurangi risiko data terlewat, dan mengubah potensi omzet yang sebelumnya tercecer menjadi follow-up yang terukur.

## 10. Prinsip Konsistensi Pengembangan

Dokumen ini harus menjadi guardrail utama project REMINDRA. Setiap penambahan fitur, perubahan UI, perubahan data model, atau integrasi baru harus menjawab salah satu tujuan berikut:

- Mempercepat pekerjaan Part Counter.
- Mengurangi human error.
- Menjaga data follow-up tetap terstruktur.
- Meningkatkan peluang konsumen kembali.
- Membuat dampak finansial lebih mudah diukur.

Jika sebuah perubahan tidak mendukung tujuan tersebut, perubahan tersebut perlu ditinjau ulang sebelum diimplementasikan.
