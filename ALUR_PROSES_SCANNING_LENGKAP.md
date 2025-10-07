# Alur Proses Scanning Lengkap - MultiPlus App

Dokumen ini menjelaskan secara rinci keseluruhan alur proses pemindaian (*scanning*) dari awal hingga akhir. Tujuannya adalah untuk secara sistematis mencari peluang keuntungan (arbitrase) dengan membandingkan harga sebuah token antara *Centralized Exchange* (CEX) dan berbagai *Decentralized Exchange* (DEX). Proses ini berjalan secara otomatis, menghitung potensi profit dan loss (PNL) setelah memperhitungkan semua biaya, dan mengirimkan notifikasi jika ditemukan peluang yang menguntungkan.

---

## 1. Data Apa Saja yang Digunakan?

Proses scanning mengandalkan 4 sumber data utama yang saling terkait:

### a. Data Koin dari Database (`KOIN_<CHAIN>`)
Ini adalah "master data" yang berisi daftar semua kombinasi trading yang akan dipindai. Data yang dipindai adalah hasil filter dari tabel ini berdasarkan pengaturan di `SETTING_FILTER_<CHAIN>`.
Setiap record mencakup:
- **Info On-Chain**: `chain`, `nama_token`, `sc_token`, `des_token`.
- **Info Spesifik CEX**: `cex_name`, `cex_ticker_token`, `cex_fee_wd`, `cex_deposit_status`, `cex_withdraw_status`.
- **Info Pair On-Chain**: `nama_pair`, `sc_pair`, `des_pair`.
- **Info DEX**: Objek `dex` yang berisi status aktif atau tidaknya DEX untuk token tersebut (misal: `{"flytrade": {"status": true}}`).

### b. Pengaturan Global (`SETTING_GLOBAL`)
Konfigurasi umum yang berlaku untuk semua proses scanning, diambil dari satu record di tabel `SETTING_GLOBAL`.
- **Modal**: `modalUsd` (misal: $100).
- **Jeda Waktu**: `jedaTimeGroup` (antar batch) dan `jedaPerAnggota` (antar request dalam satu token).
- **Konfigurasi API**: `config_dex` yang berisi jeda spesifik per DEX.
- **Info Notifikasi**: `telegram.botToken`, `telegram.chatId`, dan `nickname` pengguna.

### c. Pengaturan Filter (`SETTING_FILTER_<CHAIN>`)
Preferensi pengguna yang aktif saat itu, yang menentukan token mana yang akan dipindai dan bagaimana hasilnya dievaluasi.
- **Filter Aktif**: `chains`, `cex`, dan `dex` mana yang sedang diaktifkan.
- **Ambang Batas PNL**: `minPnl` (misal: 0.5 artinya min diatas 0.5$) sebagai syarat pengiriman notifikasi.
- **Mode Operasi**: `autorun`, `autoscroll`, dan `favoritOnly`.

### d. Konfigurasi Aplikasi (`KONFIG_APLIKASI`)
File konfigurasi statis (`config_app.js`) yang berisi detail teknis yang jarang berubah.
- **Endpoint**: URL RPC untuk setiap chain, URL API untuk setiap CEX dan DEX.
- **Proxy**: Daftar URL proxy untuk melakukan request ke API DEX.
- **Detail Teknis Lainnya**: Kode chain, warna, dll.

---

## 2. Proses Fetching Data (Pengambilan Data dari Luar)

Selama proses scanning, `PriceScanner` mengorkestrasi beberapa jenis pengambilan data (*fetching*) dari sumber eksternal:

### a. Fetch Data Real-time Awal (`RealtimeDataFetcher`)
- **Tujuan**: Mengambil data yang berubah-ubah namun digunakan bersama untuk semua perhitungan dalam satu sesi scan. Data ini di-cache selama 30 detik untuk efisiensi.
- **Proses**:
  1.  **Harga Gas (Gwei)**: Untuk setiap chain yang aktif di filter (misal: `bsc`, `polygon`), aplikasi memanggil endpoint RPC yang sesuai (dari `KONFIG_APLIKASI`) untuk mendapatkan harga gas (Gwei) saat ini.
  2.  **Harga Token Native**: Aplikasi memanggil API Binance (`/api/v3/ticker/price`) untuk mendapatkan harga token native yang digunakan untuk membayar gas (misal: harga `BNB` dalam `USDT`).
  3.  **Kurs USDT/IDR**: Aplikasi memanggil API Tokocrypto (atau Indodax sebagai fallback) untuk mendapatkan kurs Rupiah terbaru.

### b. Fetch Order Book CEX (`CexPriceFetcher`)
- **Tujuan**: Mendapatkan harga beli dan jual terbaik dari CEX untuk token yang sedang dipindai.
- **Proses**:
  1.  `PriceScanner` memanggil `cexFetcher.getOrderbook(cexKey, ticker)`.
  2.  `CexPriceFetcher` menggunakan `cexKey` (misal: 'GATE') untuk menemukan URL API yang benar dari `KONFIG_APLIKASI`.
  3.  Aplikasi membuat request ke endpoint API *Order Book* CEX yang bersangkutan (misal: `https://api.gateio.ws/api/v4/spot/order_book`) dengan `ticker` sebagai parameter.
  4.  Respons dari API, yang berisi daftar harga penawaran (`bids`) dan permintaan (`asks`), di-parsing menjadi struktur data yang rapi, termasuk `bestBid`, `bestAsk`, dan beberapa level kedalaman (*depth*) order book.

### c. Fetch Quote DEX (`DexDataFetcher`)
- **Tujuan**: Mendapatkan simulasi harga swap di DEX.
- **Proses**: Aplikasi memanggil API dari aggregator DEX (seperti Kyber, Odos, 1inch) melalui proxy yang terkonfigurasi di `KONFIG_APLIKASI`. Panggilan ini menyertakan parameter seperti:
  - Token input (misal: `USDT`).
  - Token output (misal: `CAKE`).
  - Jumlah token input (dihitung berdasarkan modal).
  - Alamat wallet (`walletMeta` dari `SETTING_GLOBAL`).
- **Hasil**: API aggregator akan mengembalikan jumlah token output yang akan diterima setelah swap, beserta estimasi biaya gas.

---

## 3. Alur Proses dan Perhitungan (Step-by-Step)

Proses ini diorkestrasi oleh `PriceScanner` dan dipicu oleh `scannerMixin` dari UI.

### Tahap 1: Inisiasi
1.  **Pengguna Klik "Start Scan"**: Komponen `scanning-tab.js` memanggil `startScanning()`.
2.  **Kirim Status ONLINE**: `telegramService` mengirim pesan ke Telegram bahwa bot telah aktif, menggunakan `nickname` dari `SETTING_GLOBAL`.
3.  **Fetch Data Real-time**: `realtimeFetcher` dipanggil untuk mendapatkan `gasData` dan `usdtRate` yang akan digunakan di seluruh proses.

### Tahap 2: Pemrosesan Batch
1.  **Token Dibagi Menjadi Grup (Batch)**: Daftar token yang akan dipindai (setelah difilter) dibagi menjadi grup-grup kecil (misal: 3 token per batch, sesuai `tokensPerBatch`) untuk mengelola beban API.
2.  **Jeda Antar Batch**: Setelah satu batch selesai, ada jeda waktu (diambil dari `jedaTimeGroup` di `SETTING_GLOBAL`) sebelum melanjutkan ke batch berikutnya untuk menghindari *rate limiting*.

### Tahap 3: Pemrosesan per Token (Inti Proses)
Untuk setiap token di dalam batch, langkah-langkah berikut terjadi secara paralel:

1.  **Fetch Harga CEX**:
    -   `cexFetcher.getOrderbook()` dipanggil untuk mendapatkan harga order book token utama (misal: `CAKEUSDT`).
    -   Jika pair-nya bukan `USDT`, `cexFetcher.getOrderbook()` juga dipanggil untuk pair-nya (misal: `BNBUSDT`).
    -   Hasilnya adalah harga beli terbaik (`bestBid`) dan harga jual terbaik (`bestAsk`) di CEX.

2.  **Fetch Harga DEX**:
    -   Aplikasi melakukan loop untuk setiap DEX yang aktif untuk token tersebut (misal: Kyber, Odos).
    -   Untuk setiap DEX, `dexFetcher.getQuotes()` dipanggil dua kali:
        -   **Arah CEX → DEX**: Simulasi swap dari `nama_pair` (misal: USDT) ke `nama_token` (misal: CAKE).
        -   **Arah DEX → CEX**: Simulasi swap dari `nama_token` (misal: CAKE) ke `nama_pair` (misal: USDT).
    -   Ada jeda singkat antar setiap panggilan DEX (diambil dari `config_dex[dex].jeda`).

3.  **Kalkulasi PNL (`PnlCalculator`)**: Setelah semua data harga terkumpul, `pnlCalculator` menghitung potensi keuntungan untuk kedua arah.

    #### Contoh Perhitungan Arah CEX → DEX (Beli di CEX, Jual di DEX):
    -   **Modal**: `$100` (dari `globalSettings.modalUsd`).
    -   **Langkah 1: Beli Token di CEX**
        -   `Jumlah Token Dibeli` = `Modal` / `Harga Jual CEX (bestAsk)`.
        -   `Biaya Trading Beli` = `Modal` * `Fee Trading CEX`.
    -   **Langkah 2: Withdraw dari CEX**
        -   `Biaya Withdraw` = `Fee Withdraw` (dalam token, dari DB) * `Harga Token`.
        -   `Jumlah Token di Wallet` = `Jumlah Token Dibeli` - `Fee Withdraw (dalam token)`.
    -   **Langkah 3: Swap di DEX**
        -   `Jumlah Token di Wallet` disimulasikan di-swap di DEX untuk mendapatkan `nama_pair` (misal: USDT). Hasilnya (`pairReceived`) didapat dari `dexFetcher`.
        -   `Biaya Gas DEX` = `Estimasi Gas dari API DEX` * `Harga Token Native (BNB)`.
    -   **Langkah 4: Jual Hasil Swap di CEX**
        -   `Hasil Jual Pair` = `pairReceived` * `Harga Beli Pair di CEX (bestBid)`.
        -   `Biaya Trading Jual` = `Hasil Jual Pair` * `Fee Trading CEX`.
    -   **Langkah 5: Hitung PNL**
        -   `Total Hasil` = `Hasil Jual Pair` - `Biaya Trading Jual`.
        -   `Total Biaya` = `Biaya Trading Beli` + `Biaya Withdraw` + `Biaya Gas DEX`.
        -   `PNL (Profit/Loss)` = `Total Hasil` - `Modal` - `Total Biaya`.
    -   **PNL %**: `(PNL / Modal) * 100`.
    -   Perhitungan serupa dilakukan untuk arah sebaliknya (DEX → CEX).

4.  **Update UI secara Real-time**:
    -   Setelah perhitungan PNL untuk satu DEX selesai, callback `onPnlResult` dipanggil.
    -   `scannerMixin` menerima data ini, memperbarui objek `scanResults` di memori, **dan menyimpannya ke tabel `SCAN_RESULTS_<CHAIN>` di IndexedDB**.
    -   Karena `scanResults` bersifat reaktif, sel tabel yang sesuai di `scanning-tab.js` akan langsung terisi dengan hasil PNL, memberikan kesan *real-time*.

5.  **Kirim Sinyal Telegram**:
    -   Jika `PNL %` yang dihitung melebihi ambang batas (`minPnl` dari filter), `telegramService` akan memformat pesan sinyal yang detail dan mengirimkannya ke Telegram.

### Tahap 4: Penyelesaian
1.  **Pembersihan**: Sebelum scan baru dimulai, data lama di tabel `SCAN_RESULTS_<CHAIN>` akan dibersihkan untuk memastikan tidak ada data basi.
1.  Setelah semua token dan batch selesai diproses, `PriceScanner` akan memanggil callback `onComplete`.
2.  **Kirim Status OFFLINE**: Pesan status "OFFLINE" dikirim ke Telegram.
3.  **UI Final**: Progress bar mencapai 100%, dan ringkasan statistik (jumlah token sukses, error, sinyal) ditampilkan di UI.