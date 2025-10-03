# Skema Database Rinci - MultiPlus App

Dokumen ini memberikan rincian teknis untuk setiap *Object Store* (tabel) dalam database IndexedDB `MULTIPLUS_APP`. Skema ini didasarkan pada analisis kode aplikasi dan mencerminkan struktur data yang sebenarnya digunakan, menggantikan informasi yang mungkin sudah usang di dokumen lain.

**Prinsip Desain Utama**:
- **Satu Item, Satu Record**: Setiap entitas data (misal: satu koin, satu log) disimpan sebagai record terpisah dengan `id` unik sebagai `keyPath`. Ini adalah praktik terbaik untuk performa dan skalabilitas IndexedDB.
- **Tabel Dinamis**: Nama tabel sering kali menyertakan `<NAMA-CHAIN>` (misalnya, `KOIN_BSC`, `KOIN_POLYGON`), memungkinkan pemisahan data per-blockchain.

---

## `SETTING_GLOBAL`

- **Tujuan**: Menyimpan semua konfigurasi global yang berlaku di seluruh aplikasi. Pengaturan ini dimuat saat aplikasi pertama kali dijalankan.
- **Struktur**: Hanya ada **satu record** dalam tabel ini. Record tersebut selalu menggunakan `key` statis `"SETTING_GLOBAL"`.
- **Interaksi Fitur**:
  - **Ditulis oleh**: Menu `Settings` (`settings.js` & `settings-menu.js`) saat pengguna menyimpan perubahan.
  - **Dibaca oleh**: Hampir semua komponen aplikasi untuk mengetahui chain, CEX, dan DEX mana yang aktif, serta pengaturan waktu.
- **Contoh Record**:
  ```json
  {
    "key": "SETTING_GLOBAL",
    "nickname": "TraderPro",
    "walletMeta": "0x1234...abcd",
    "AnggotaGrup": 1,
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
    "telegram": {
      "botToken": "",
      "chatId": ""
    }
  }
  ```

---

## `SETTING_FILTER_<NAMA-CHAIN>`

- **Tujuan**: Menyimpan preferensi filter pengguna (seperti mode favorit, urutan, CEX/DEX yang aktif) untuk setiap mode chain (`multi`, `bsc`, `polygon`, dll.).
- **Struktur**: Hanya ada **satu record** per tabel. Record tersebut menggunakan `key` statis `"SETTING_FILTER"`. Nama tabelnya sendiri dinamis, contoh: `SETTING_FILTER_BSC`, `SETTING_FILTER_MULTI`.
- **Interaksi Fitur**:
  - **Ditulis oleh**: Komponen `scanning-filter-bar` dan `management-filter-bar` setiap kali pengguna mengubah filter.
  - **Dibaca oleh**: `scanning-tab` dan `management-tab` untuk menerapkan filter dan urutan pada data yang ditampilkan.
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
      "GATE": true
    },
    "dex": {
      "odos": true,
      "kyber": true
    },
    "chains": {
      "bsc": true,
      "polygon": false
    },
    "pairs": {
      "bsc.BNB": true,
      "bsc.USDT": true,
      "polygon.USDT": false
    }
  }
  ```

---

## `SYNC_KOIN_<NAMA-CHAIN>`

- **Tujuan**: Berfungsi sebagai *cache* atau area sementara untuk data koin yang diambil dari API CEX. Ini memungkinkan aplikasi membandingkan data baru dengan data yang ada dan menandai koin yang baru ditemukan.
- **Struktur**: Setiap koin disimpan sebagai **record individual**. `keyPath` adalah `id` (UUID).
- **Interaksi Fitur**:
  - **Ditulis oleh**: `sync-tab` saat pengguna menekan tombol "Sync CEX". Data dari API CEX diolah dan disimpan/diperbarui di sini.
  - **Dibaca oleh**: `sync-tab` untuk menampilkan daftar koin yang tersedia untuk diimpor ke manajemen.
- **Contoh Record**:
  ```json
  {
    "id": "uuid-sync-1", // Primary Key
    "cex": "BINANCE",
    "chain": "BSC",
    "nama_koin": "PancakeSwap",
    "nama_token": "CAKE", // Sebelumnya ticker_market
    "sc_token": "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
    "des_token": 18,
    "feeWD": 0.1,
    "deposit": true,
    "withdraw": true,
    "trade": true,
    "price": 2.5,
    "isNew": true, // Ditandai 'true' jika ini koin yang baru ditemukan
    "createdAt": "2023-10-27T10:00:00Z",
    "updatedAt": "2023-10-27T10:00:00Z"
  }
  ```

---

## `KOIN_<NAMA-CHAIN>`

- **Tujuan**: Menyimpan "master data" dari semua koin yang telah diimpor dan akan dipantau oleh aplikasi. Ini adalah sumber data utama untuk tab Manajemen dan Scanning.
- **Struktur**: Setiap koin disimpan sebagai **record individual**. `keyPath` adalah `id` (UUID).
  - *Catatan*: Tabel ini juga berisi satu record usang dengan `id: "DATA_KOIN"` yang merupakan snapshot. Record ini hanya untuk kompatibilitas dan **bukan** sumber data utama.
- **Interaksi Fitur**:
  - **Ditulis oleh**:
    - `sync-tab`: Saat "Import ke Manajemen", record baru dibuat/diperbarui di sini.
    - `management-tab` & `scanning-tab`: Saat mengubah `isFavorite` atau menghapus koin.
    - `wallet-tab`: Saat memperbarui status deposit/withdraw (`depositToken`, `withdrawToken`).
  - **Dibaca oleh**: `management-tab` dan `scanning-tab` sebagai sumber data utama mereka.
- **Contoh Record**:
  ```json
  {
    "id": "uuid-master-1", // Primary Key
    "chain": "BSC",
    "nama_koin": "PancakeSwap",
    "sc_token": "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
    "des_token": 18,
    "nama_pair": "BNB",
    "sc_pair": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    "des_pair": 18,
    "status": true,
    "isFavorite": false,
    "cex": {
      "BINANCE": {
        "status": true,
        "feeWDToken": "0.1",
        "feeWDPair": null,
        "depositToken": true,
        "withdrawToken": true,
        "depositPair": false,
        "withdrawPair": false
      }
    },
    "dex": {
      "flytrade": {
        "status": true,
        "left": 100, // Sebelumnya 'modalKiri'
        "right": 100 // Sebelumnya 'modalKanan'
      },
      "odos": {
        "status": true,
        "left": 100,
        "right": 100
      }
    },
    "createdAt": "2023-10-27T10:05:00Z",
    "updatedAt": "2023-10-27T10:05:00Z"
  }
  ```

---

## Store Portofolio (`ASET_*` & `RIWAYAT_*`)

Tabel-tabel ini digunakan oleh fitur Portofolio (`asset.html`) untuk melacak aset dan PNL.

### `ASET_EXCHANGER`
- **Tujuan**: Menyimpan kredensial API (terenkripsi jika diimplementasikan) dan snapshot saldo terakhir untuk setiap CEX yang terhubung ke portofolio.
- **Struktur**: Setiap CEX adalah **record individual**. `keyPath` bisa berupa `name_cex`.
- **Contoh Record**:
  ```json
  {
    "name_cex": "BINANCE",
    "enabled": true,
    "data_api": { "apiKey": "...", "secretKey": "..." },
    "snapshot": {
      "totalBalance": 1234.56,
      "assets": [ { "symbol": "BTC", "balance": 0.01, "usdValue": 300.00 } ]
    },
    "lastUpdated": "2023-10-27T11:00:00Z"
  }
  ```

### `ASET_WALLET`
- **Tujuan**: Menyimpan alamat wallet pengguna per-chain dan snapshot saldo terakhir.
- **Struktur**: Setiap chain adalah **record individual**. `keyPath` bisa berupa `name` (nama chain).
- **Contoh Record**:
  ```json
  {
    "name": "BSC",
    "enabled": true,
    "address": "0x1234...abcd",
    "lastChecked": "2023-10-27T11:05:00Z",
    "lastResult": {
      "total": 500.00,
      "assets": [ { "symbol": "CAKE", "balance": 100, "usdValue": 250.00 } ]
    }
  }
  ```

### `RIWAYAT_MODAL`
- **Tujuan**: Menyimpan histori perhitungan Profit and Loss (PNL) dari portofolio dari waktu ke waktu.
- **Struktur**: Setiap entri PNL adalah **record individual**. `keyPath` adalah `id` atau `timestamp`.
- **Contoh Record**:
  ```json
  {
    "id": "pnl-1",
    "timestamp": "2023-10-27T00:00:00Z",
    "awal": 1000.00,
    "akhir": 1234.56,
    "pnl": 234.56,
    "action": "DAILY_SNAPSHOT"
  }
  ```