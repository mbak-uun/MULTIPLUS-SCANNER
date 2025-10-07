# Skema Database Rinci - MultiPlus App (v2)

Dokumen ini memberikan rincian teknis untuk setiap *Object Store* (tabel) dalam database IndexedDB `MULTIPLUS_APP`. Skema ini telah diperbarui berdasarkan analisis kode aplikasi terbaru untuk mencerminkan struktur data yang sebenarnya digunakan.

**Prinsip Desain Utama**:
- **Satu Item, Satu Record**: Setiap entitas data (misal: satu koin, satu log) disimpan sebagai record terpisah dengan `id` unik sebagai `keyPath`. Ini adalah praktik terbaik untuk performa dan skalabilitas IndexedDB.
- **Tabel Dinamis**: Nama tabel sering kali menyertakan `<NAMA-CHAIN>` (misalnya, `KOIN_BSC`, `KOIN_POLYGON`), memungkinkan pemisahan data per-blockchain.

---

## `SETTING_GLOBAL`

- **Tujuan**: Menyimpan semua konfigurasi global yang berlaku di seluruh aplikasi. Pengaturan ini dimuat saat aplikasi pertama kali dijalankan.
- **Struktur**: Hanya ada **satu record** dalam tabel ini. Record tersebut selalu menggunakan `key` statis `"SETTING_GLOBAL"`.
- **Interaksi Fitur**:
  - **Ditulis oleh**: Menu `Settings` (`settings.js`) saat pengguna menyimpan perubahan.
  - **Dibaca oleh**: Hampir semua komponen aplikasi untuk mengetahui chain, CEX, dan DEX mana yang aktif, serta pengaturan waktu dan API.
- **Contoh Record**:
  ```json
  {
    "key": "SETTING_GLOBAL",
    "nickname": "TraderPro",
    "walletMeta": "0x1234...abcd",
  "AnggotaGrup": 3,
    "jedaTimeGroup": 1000,
    "jedaPerAnggota": 200,
    "WaktuTunggu": 5000,
    "config_chain": {
      "bsc": { "status": true },
      "polygon": { "status": true },
      "arbitrum": { "status": false }
    },
    "config_cex": {
      "GATE": { "status": true, "jeda": 30 },
      "BINANCE": { "status": true, "jeda": 30 },
      "KUCOIN": { "status": false, "jeda": 30 }
    },
    "config_dex": {
      "flytrade": { "status": true, "jeda": 100 },
      "okxdex": { "status": true, "jeda": 100 },
      "kyber": { "status": false, "jeda": 100 }
    },
  "telegram": { // REVISI: Menambahkan field telegram
    "botToken": "7853809693:AAHl8e_hjRyLgbKQw3zoUSR_aqCbGDg6nHo",
    "chatId": "-1002079288809"
  }
  }
  ```

---

## `SETTING_FILTER_<NAMA-CHAIN>`

- **Tujuan**: Menyimpan preferensi filter pengguna (seperti mode favorit, urutan, CEX/DEX yang aktif) untuk setiap mode chain (`multi`, `bsc`, `polygon`, dll.).
- **Struktur**: Hanya ada **satu record** per tabel. Record tersebut menggunakan `key` statis `"SETTING_FILTER"`. Nama tabelnya sendiri dinamis, contoh: `SETTING_FILTER_BSC`, `SETTING_FILTER_MULTI`.
- **Interaksi Fitur**:
  - **Ditulis oleh**: Komponen `filter-settings.js` setiap kali pengguna mengubah filter.
  - **Dibaca oleh**: `scanning-tab.js` dan `management-tab.js` untuk menerapkan filter dan urutan pada data yang ditampilkan.
- **Contoh Record (`SETTING_FILTER_MULTI`)**:
  ```json
  {
    "key": "SETTING_FILTER",
    "chainKey": "multi",
    "minPnl": 0.5,
    "sortDirection": "desc",
    "favoritOnly": false,
    "autorun": false,
    "autoscroll": false,
    "darkMode": true,
    "run": "stop",
    "cex": {
      "BINANCE": true,
      "GATE": true,
      ...
    },
    "dex": {
      "odos": true,
      "kyber": true,
       ...
    },
    "chains": {
      "bsc": true,
      "polygon": false,
       ...
    },
    "pairs": {
      "bsc.BNB": true,
      "bsc.USDT": true,
      "polygon.USDT": false,
       ...
    }
  }
  ```

---

## `SYNC_KOIN_<NAMA-CHAIN>`

- **Tujuan**: Berfungsi sebagai *cache* atau area sementara untuk data koin yang diambil dari API CEX. Ini memungkinkan aplikasi membandingkan data baru dengan data yang ada dan menandai koin yang baru ditemukan.
- **Struktur**: Setiap koin disimpan sebagai **record individual**. `keyPath` adalah `id` (UUID).
- **Interaksi Fitur**:
  - **Ditulis oleh**: `sync-tab.js` saat pengguna menekan tombol "Sync CEX". Data dari API CEX diolah dan disimpan/diperbarui di sini.
  - **Dibaca oleh**: `sync-tab.js` untuk menampilkan daftar koin yang tersedia untuk diimpor ke manajemen.
- **Contoh Record (Setelah proses `fetchAndMergeCex`)**:
  ```json
  {
    "id": "uuid-sync-1", // Primary Key
    "cex": "BINANCE",
    "chain": "BSC",
    "nama_koin": "PancakeSwap",
    "nama_token": "CAKE",
    "cex_ticker": "CAKEUSDT", // Ticker yang sudah diformat untuk CEX
    "sc_token": "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
    "des_token": 18,
    "feeWD": 0.1, // Biaya penarikan dari CEX
    "price": 2.5, // Harga terakhir dari CEX
    "deposit": true,
    "withdraw": true,
    "trade": true,
    "isNew": true, // Ditandai 'true' jika koin ini belum ada di tabel KOIN_<CHAIN>
    "createdAt": "2023-10-27T10:00:00Z",
    "updatedAt": "2023-10-27T10:05:00Z"
  }
  ```

---

## `KOIN_<NAMA-CHAIN>`

- **Tujuan**: Menyimpan "master data" dari semua *kombinasi trading* yang akan dipantau. Setiap record merepresentasikan **satu aset di satu CEX, yang dipasangkan dengan satu pair on-chain**. Ini memungkinkan fleksibilitas untuk ticker dan fee yang berbeda per CEX.
- **Struktur**: Setiap koin disimpan sebagai **record individual**. `keyPath` adalah `id` (UUID).
- **Interaksi Fitur**:
  - **Ditulis oleh**:
    - `sync-tab.js`: Saat "Import ke Manajemen", record baru dibuat/diperbarui di sini.
    - `management-tab.js`: Saat mengubah `isFavorite` atau menghapus koin.
  - **Dibaca oleh**: `management-tab.js` dan `scanning-tab.js` sebagai sumber data utama mereka.
- **Contoh Record (Skema Baru)**:
  ```json
  // REVISI: Skema diubah menjadi lebih granular. Tidak ada lagi objek 'cex' nested.
  {
    "id": "uuid-master-1", // Primary Key
    // Info Aset On-Chain
    "chain": "BSC",
    "nama_koin": "PANCAKESWAP",
    "nama_token": "CAKE",
    "sc_token": "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
    "des_token": 18,
    // Info Spesifik CEX
    "cex_name": "BINANCE",
    "cex_ticker_token": "CAKEUSDT", // REVISI: Ticker spesifik CEX, sudah diformat.
    "cex_fee_wd": 0.1,
    "cex_deposit_status": true,
    "cex_withdraw_status": true,
    // Info Pair On-Chain
    "nama_pair": "BNB",
    "sc_pair": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    "des_pair": 18,
    "cex_pair_deposit_status": true,
    "cex_pair_withdraw_status": true,
    // Konfigurasi DEX
    "dex": {
      "flytrade": { "status": true, "left": 100, "right": 100 },
      "odos": { "status": true, "left": 100, "right": 100 }
    },
    // Metadata
    "status": true,
    "isFavorite": false,
    "createdAt": "2023-10-27T10:05:00Z",
    "updatedAt": "2023-10-27T10:05:00Z"
  }
  ```

---

## Store Portofolio (`ASET_*` & `RIWAYAT_*`)

Tabel-tabel ini digunakan oleh fitur Portofolio (`portfolio.js`) untuk melacak aset dan PNL.

### `ASET_EXCHANGER`
- **Tujuan**: Menyimpan snapshot saldo terakhir untuk setiap CEX yang terhubung ke portofolio. Kredensial API tidak disimpan di DB, melainkan di `localStorage`.
- **Struktur**: Setiap CEX adalah **record individual**. `keyPath` adalah `name_cex`.
- **Contoh Record**:
  ```json
  // REVISI: Menambahkan raw_assets
  {
    "name_cex": "binance", // Primary Key (lowercase)
    "snapshot": {
      "totalBalance": 1234.56,
      "assets": [
        { "symbol": "BTC", "amount": 0.01, "usdValue": 300.00 },
        { "symbol": "ETH", "amount": 0.5, "usdValue": 900.00 }
      ],
      "raw_assets": [
        { "asset": "BTC", "free": "0.01", "locked": "0" },
        { "asset": "ETH", "free": "0.5", "locked": "0" }
      ]
    },
    "lastUpdated": "2023-10-27T11:00:00Z"
  }
  ```

### `ASET_WALLET`
- **Tujuan**: Menyimpan alamat wallet pengguna per-chain dan snapshot saldo terakhir.
- **Struktur**: Setiap chain adalah **record individual**. `keyPath` adalah `key` (nama chain, e.g., 'bsc').
- **Contoh Record**:
  ```json
  // REVISI: Memperbarui struktur lastResult dan raw_assets
  {
    "key": "bsc", // Primary Key
    "name": "bsc",
    "label": "Binance Smart Chain",
    "address": "0x1234...abcd",
    "lastResult": {
      "chain": "bsc",
      "address": "0x1234...abcd",
      "tokenSymbol": "CAKE",
      "tokenAddress": "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
      "assetAmount": 100, // Alias untuk assetValue
      "assetValue": 100.00,
      "assetRate": 2.5,
      "gasAmount": 0.01,
      "gasValue": 5.80,
      "gasRate": 580.00,
      "gasSymbol": "BNB",
      "total": 105.80,
      "walletLink": "https://bscscan.com/address/0x1234...abcd",
      "raw_assets": [
        { "id": "CAKE-0", "symbol": "CAKE", "amount": 40, "value": 100.00, "rate": 2.5, "address": "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82" }
      ],
      "fetchedAt": "2023-10-27T11:05:00Z"
    },
    "lastChecked": "2023-10-27T11:05:00Z"
  }
  ```

### `RIWAYAT_MODAL`
- **Tujuan**: Menyimpan histori perhitungan Profit and Loss (PNL) dari portofolio. Data ini disimpan di `localStorage` (`portfolio_pnl_history`), bukan di IndexedDB. Tabel ini kemungkinan tidak digunakan lagi.
- **Status**: **TIDAK DIGUNAKAN**. Berdasarkan analisis kode `portfolio.js`, semua riwayat PNL dibaca dari dan ditulis ke `localStorage` dengan *key* `portfolio_pnl_history`. Tabel IndexedDB ini dapat diabaikan atau dihapus.
- **Struktur (Lama)**: Setiap entri PNL adalah **record individual**. `keyPath` adalah `id` (auto-increment).
- **Contoh Record**:
  ```json
  {
    "id": 1,
    "timestamp": 1672531200000, // Unix timestamp
    "awal": 1000.00,
    "akhir": 1234.56,
    "pnl": 234.56,
    "action": "update"
  },
   ...
  ```

---

## `RIWAYAT_AKSI`

- **Tujuan**: Menyimpan log dari berbagai aktivitas penting yang terjadi di dalam aplikasi, berfungsi sebagai jejak audit.
- **Struktur**: Setiap log adalah **record individual**. `keyPath` adalah `id` (auto-increment).
- **Interaksi Fitur**:
  - **Ditulis oleh**: Berbagai komponen saat melakukan aksi penting (misalnya: `sync-tab.js` saat import, `settings.js` saat menyimpan).
  - **Dibaca oleh**: `history.js` untuk ditampilkan di menu History.
- **Contoh Record**:
  ```json
  // REVISI: Menambahkan id dan status
  {
    "id": 1,
    "timestamp": "2023-10-27T12:00:00Z",
    "action": "IMPORT_KOIN",
    "status": "success",
    "message": "Berhasil mengimpor 50 koin dari BINANCE"
  },
   ...
  ```

---

## Alur Data Utama

1.  **Setup Awal**
    - Pengguna membuka **Menu Settings**.
    - Konfigurasi disimpan ke dalam satu record di tabel `SETTING_GLOBAL`.

2.  **Sinkronisasi & Import Koin**
    - Pengguna membuka **Tab Sinkronisasi**.
    - Klik "Sync CEX" → Data dari API CEX di-fetch dan disimpan ke `SYNC_KOIN_<CHAIN>`. Koin yang belum ada di `KOIN_<CHAIN>` ditandai `isNew: true`.
    - Pengguna memilih koin dari tabel `SYNC_KOIN` dan klik "Import".
    - Data koin yang dipilih diubah formatnya menjadi skema `KOIN` (dengan CEX dan DEX nested) dan disimpan ke tabel `KOIN_<CHAIN>`.

3.  **Manajemen & Scanning**
    - **Tab Management** membaca data dari `KOIN_<CHAIN>` untuk ditampilkan. Pengguna bisa melakukan CRUD (Create, Read, Update, Delete) di sini.
    - **Tab Scanning** membaca data dari `KOIN_<CHAIN>` yang sama untuk melakukan proses pemindaian harga.
    - Perubahan filter di `filter-settings.js` akan disimpan ke `SETTING_FILTER_<CHAIN>`.

4.  **Monitoring Portofolio**
    - Pengguna membuka **Menu Portfolio**.
    - Kredensial API (API Key, Secret) disimpan di `localStorage` (`portfolio_exchange_*`).
    - Alamat wallet disimpan di `localStorage` (`portfolio_wallet_*`).
    - Saat "Check Asset", data saldo di-fetch.
    - Hasil snapshot saldo disimpan ke `ASET_EXCHANGER` dan `ASET_WALLET`.
    - Histori PNL disimpan di `localStorage` (`portfolio_pnl_history`).

---

**Terakhir Diperbarui**: Berdasarkan analisis kode pada 24 Juli 2024