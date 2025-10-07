# Alur Proses Sinkronisasi CEX Lengkap

**File Terkait**: `components/tabs/sync-tab.js`

Dokumen ini menjelaskan alur proses teknis yang terjadi di latar belakang saat pengguna mengklik tombol **"Sync CEX"** pada tab "Sinkronisasi Koin". Proses ini diorkestrasi oleh metode `syncSelectedCex` dan bertujuan untuk mengambil data koin terbaru dari *Centralized Exchange* (CEX), memperkayanya dengan data on-chain, dan menyimpannya ke dalam cache IndexedDB.

---

## 1. Data Apa Saja yang Digunakan?

Proses sinkronisasi mengandalkan 3 sumber data utama:

### a. Data dari API CEX (Sumber Eksternal)
- **Daftar Koin**: Semua koin yang didukung oleh CEX pada chain yang aktif, beserta informasi seperti Smart Contract (SC), status deposit/withdraw, dan biaya penarikan.
- **Status Perdagangan**: Informasi apakah sebuah koin dapat diperdagangkan atau sedang dalam maintenance.
- **Harga Terkini**: Harga terakhir untuk semua pasangan dagang (misalnya, CAKE/USDT).

### b. Data dari Blockchain (Sumber Eksternal)
- **Desimal Token**: Jumlah desimal dari sebuah Smart Contract. Diambil melalui panggilan RPC ke node blockchain jika tidak disediakan oleh API CEX.

### c. Data dari Database Lokal (IndexedDB)
- **`SYNC_KOIN_<CHAIN>`**: Cache hasil sinkronisasi sebelumnya. Digunakan untuk mempertahankan `id` unik dan `createdAt` dari koin yang sudah pernah disinkronkan.
- **`KOIN_<CHAIN>`**: Master data koin yang ada di tab "Manajemen Koin". Digunakan untuk menentukan apakah sebuah koin yang baru diambil dari CEX berstatus "NEW" atau tidak.

---

## 2. Alur Proses (Langkah demi Langkah)

Proses ini dipicu saat pengguna memilih satu atau lebih CEX dan menekan tombol "Sync CEX".

### Tahap 1: Inisiasi (`syncSelectedCex`)

1.  **UI Loading**: Aplikasi menampilkan *loading overlay* untuk memberikan feedback visual kepada pengguna.
2.  **Looping CEX**: Aplikasi memulai loop untuk setiap CEX yang dipilih di filter (misalnya, BINANCE, GATE).
3.  **Panggilan Fungsi Inti**: Untuk setiap CEX, metode inti `fetchAndMergeCex(cex)` dipanggil.

### Tahap 2: Persiapan di dalam `fetchAndMergeCex`

1.  **Membaca Database Lokal**: Sebelum mengambil data dari luar, aplikasi membaca semua data yang sudah ada dari dua tabel di IndexedDB:
    - `SYNC_KOIN_<CHAIN>` (cache sinkronisasi).
    - `KOIN_<CHAIN>` (data manajemen).

2.  **Membuat Peta Cepat (Map)**: Untuk optimasi pencarian, data yang dibaca diubah menjadi struktur data `Map` di memori:
    - **`syncMap`**: Kunci: `CEX|CHAIN|SC_TOKEN`. Nilai: Objek koin dari cache. Digunakan untuk menemukan record lama dan mempertahankan `id`-nya.
    - **`koinMap`**: Kunci: `CEX|SC_TOKEN`. Nilai: Objek koin dari manajemen. Digunakan untuk memeriksa status "NEW".

### Tahap 3: EXTRACT - Mengambil Data dari API CEX

1.  **Inisialisasi Fetcher**: Sebuah instance dari `CheckWalletExchanger` dibuat.
2.  **Pengambilan Data Paralel**: Tiga jenis data penting diambil dari API CEX secara bersamaan untuk efisiensi:
    - **Daftar Koin (`fetchCoinList`)**: Mendapatkan daftar lengkap koin.
    - **Harga Terkini (`fetchPrices`)**: Mendapatkan semua harga pasar.
    - **Status Perdagangan (`fetchTradeStatus`)**: Mendapatkan status trading untuk setiap koin.
3.  **Error Handling**: Jika salah satu dari panggilan API ini gagal, proses untuk CEX tersebut akan berhenti dan menampilkan notifikasi error.

### Tahap 4: TRANSFORM & LOAD - Memproses Setiap Koin

Aplikasi melakukan loop untuk setiap koin yang didapat dari API CEX (`rawList`). Untuk setiap koin:

1.  **Normalisasi**: Data mentah dari API diubah menjadi format `record` yang standar.

2.  **Filter Awal**:
    - Koin yang **tidak memiliki Smart Contract** (`sc_token`) akan dilewati.

3.  **Pengayaan Data**:
    - **Harga & Status Trade**: Harga dan status `trade` dari data yang sudah di-fetch sebelumnya ditambahkan ke dalam `record`.

4.  **Filter Utama**:
    - Koin yang **tidak bisa diperdagangkan** (`trade: false`) akan **dilewati**. Ini adalah optimasi penting untuk menyaring koin yang tidak relevan dan tidak akan bisa dieksekusi.

5.  **Pengambilan Desimal (Bagian yang Berpotensi Lambat)**:
    - Aplikasi memeriksa apakah data desimal koin sudah ada di dalam `record` (`if (!record.des_token)`).
    - **Jika tidak ada**, aplikasi akan memanggil `web3Service.getDecimals()` untuk mengambil data desimal langsung dari smart contract di blockchain.
    - Ini adalah panggilan `async` yang **menghentikan sementara** proses untuk koin ini (`await`) sampai mendapatkan jawaban dari RPC node. Jika banyak koin tidak memiliki data desimal, proses ini akan memakan waktu signifikan.

6.  **Pengecekan Status "NEW"**:
    - Sebuah kunci unik (`koinKey`) dibuat dari `NAMA_CEX` dan `SMART_CONTRACT`.
    - Aplikasi memeriksa apakah `koinKey` ini ada di dalam `koinMap` (data dari "Manajemen Koin").
    - Jika **tidak ada**, koin tersebut akan ditandai dengan `isNew: true`.

7.  **Manajemen ID Unik**:
    - Untuk menjaga konsistensi data di UI, aplikasi mencoba mempertahankan `id` dari record yang sama pada sinkronisasi sebelumnya.
    - Sebuah kunci (`syncKey`) dibuat dari `CEX|CHAIN|SC_TOKEN`.
    - Jika `syncKey` ditemukan di `syncMap`, `id` dan `createdAt` dari record lama akan digunakan kembali.
    - Jika tidak ditemukan, `id` (UUID) dan `createdAt` baru akan dibuat.

8.  **Penyimpanan ke Database**:
    - Koin yang sudah lengkap datanya (termasuk desimal, harga, dan status `isNew`) akan disimpan satu per satu ke dalam tabel `SYNC_KOIN_<CHAIN>` di IndexedDB menggunakan operasi `put` (insert atau update).

### Tahap 5: Finalisasi

1.  **Notifikasi Sukses**: Setelah loop untuk satu CEX selesai, sebuah notifikasi toast akan muncul memberitahukan bahwa proses sinkronisasi untuk CEX tersebut telah selesai.
2.  **Memuat Ulang Cache**: Aplikasi memanggil `loadCacheFromDB()` untuk membaca ulang semua data dari `SYNC_KOIN_<CHAIN>` ke dalam memori (`this.syncCache`).
3.  **Update Tampilan**: Metode `updateSyncDataView()` dipanggil. Metode ini akan:
    - Mengambil data dari `syncCache` berdasarkan CEX yang sedang dipilih di filter.
    - **Menyaring koin yang harganya `0` atau tidak valid**.
    - Mengurutkan hasilnya berdasarkan nama.
    - Memperbarui `this.syncData`, yang secara reaktif akan memperbarui tabel di UI.
4.  **Selesai**: Setelah semua CEX yang dipilih selesai diproses, *loading overlay* akan hilang.

---

## Pertanyaan Umum (FAQ)

#### Bagaimana jika sebuah koin ganti Smart Contract?

Sistem akan mendeteksinya sebagai **koin yang benar-benar baru**. Karena kunci unik untuk pengecekan status "NEW" adalah `CEX|SC_TOKEN`, koin dengan SC baru akan muncul di tabel sinkronisasi dengan label **"NEW"**, meskipun namanya sama. Pengguna kemudian dapat mengimpor koin baru ini dan menghapus data koin lama dari tab "Manajemen Koin".

#### Kenapa proses fetch desimal begitu lama?

Setiap panggilan untuk mengambil desimal adalah sebuah *request* jaringan ke node blockchain yang membutuhkan waktu. Karena proses ini dilakukan secara sekuensial (`await`) di dalam loop, total waktu akan terakumulasi. Jika 100 koin perlu dicek desimalnya dan setiap panggilan butuh 0.5 detik, maka total waktu hanya untuk fetch desimal adalah 50 detik.

#### Apakah semua desimal koin di-fetch dari Web3?

**Tidak**. Panggilan ke Web3 hanya dilakukan sebagai "upaya terakhir" jika API CEX **tidak menyediakan** informasi desimal. Ini adalah optimasi untuk meminimalkan panggilan ke blockchain yang lambat.