# Skema Database IndexedDB Aplikasi

Dokumen ini menjelaskan struktur (skema) dari database IndexedDB yang digunakan oleh aplikasi. Nama database utama dibuat secara dinamis berdasarkan nama dan versi aplikasi, contohnya: `MULTIPLUS_CHATGPT_DB_V1_4`.

## Ringkasan Tabel (Object Stores)

Berikut adalah daftar tabel yang dibuat dan dikelola oleh aplikasi:

### Tabel Global
- `SETTING_GLOBAL`: Menyimpan pengaturan global aplikasi.
- `RIWAYAT_AKSI`: Mencatat semua aktivitas penting yang dilakukan pengguna.
- `ASET_EXCHANGER`: Menyimpan data aset yang ada di CEX.
- `ASET_WALLET`: Menyimpan data aset yang ada di Wallet.
- `PORTFOLIO_SETTINGS`: Pengaturan untuk fitur portfolio.
- `PORTFOLIO_CREDENTIALS`: Kredensial untuk fitur portfolio.
- `PORTFOLIO_PNL_HISTORY`: Riwayat Profit and Loss (PNL) dari portfolio.

### Tabel Dinamis (Berdasarkan Chain)
Tabel-tabel berikut dibuat untuk setiap `chain` yang terdefinisi di `KONFIG_APLIKASI.CHAINS` (contoh: `bsc`, `polygon`, dll). `{CHAIN}` akan diganti dengan nama chain dalam huruf kapital (misal: `KOIN_BSC`).

- `KOIN_{CHAIN}`: Tabel utama yang berisi daftar koin yang dikelola pengguna untuk setiap chain.
- `SYNC_KOIN_{CHAIN}`: Tabel sementara (cache) untuk menyimpan data koin yang disinkronkan dari API CEX sebelum diimpor ke tabel `KOIN_{CHAIN}`.
- `SETTING_FILTER_{CHAIN}`: Menyimpan pengaturan filter (pencarian, CEX, DEX, dll) spesifik untuk setiap chain.

### Tabel Mode Multi-Chain
- `SETTING_FILTER_MULTI`: Menyimpan pengaturan filter khusus untuk mode "Multi Chain".

---

## Detail Skema per Tabel

### 1. `SETTING_GLOBAL`
- **Tujuan**: Menyimpan konfigurasi global yang dapat diubah oleh pengguna, seperti kunci API, alamat wallet, dan pengaturan umum lainnya.
- **Kunci Utama**: `key` (string, out-of-line). Biasanya hanya ada satu record dengan `key: 'SETTING_GLOBAL'`.
- **Struktur Record**:
  ```json
  {
    "key": "SETTING_GLOBAL",
    "walletAddress": "string",
    "selectedChains": { "bsc": true, "polygon": false, ... },
    "selectedCEXs": { "BINANCE": true, "GATE": false, ... },
    "config_cex": {
      "BINANCE": { "status": true, "jeda": 300, "api_key": "...", "api_secret": "..." },
      ...
    },
    "config_dex": {
      "pancakeswap": { "status": true, "jeda": 400 },
      ...
    },
    "jedaTimeGroup": "number",
    "jedaKoin": "number",
    "dexTimeout": "number"
  }
  ```

### 2. `RIWAYAT_AKSI`
- **Tujuan**: Log audit untuk melacak aktivitas pengguna, seperti import/export, perubahan pengaturan, dan error.
- **Kunci Utama**: `id` (number, auto-increment).
- **Indeks**: `by_timestamp` pada field `timestamp`.
- **Struktur Record**:
  ```json
  {
    "id": "number (auto)",
    "timestamp": "string (ISO 8601)",
    "action": "string (e.g., 'IMPORT_KOIN', 'DELETE_DB')",
    "status": "string ('success' atau 'error')",
    "message": "string",
    "details": "object (konteks tambahan)"
  }
  ```

### 3. `KOIN_{CHAIN}`
- **Tujuan**: Tabel inti yang menyimpan semua data token yang telah dikonfigurasi dan siap untuk di-scan.
- **Kunci Utama**: `id` (string, UUID).
- **Struktur Record**:
  ```json
  {
    "id": "string (UUID)",
    "chain": "string", // e.g., "BSC"
    "nama_koin": "string", // e.g., "PancakeSwap"
    "nama_token": "string", // e.g., "CAKE"
    "sc_token": "string (address)",
    "des_token": "number",
    "cex_name": "string", // e.g., "BINANCE"
    "cex_ticker_token": "string", // e.g., "CAKEUSDT"
    "cex_fee_wd": "number",
    "cex_deposit_status": "boolean",
    "cex_withdraw_status": "boolean",
    "nama_pair": "string", // e.g., "USDT"
    "sc_pair": "string (address)",
    "des_pair": "number",
    "cex_pair_deposit_status": "boolean",
    "cex_pair_withdraw_status": "boolean",
    "status": "boolean", // Aktif/nonaktif untuk scanning
    "isFavorite": "boolean",
    "dex": {
      "pancakeswap": { "status": true, "left": 100, "right": 100 },
      ...
    },
    "createdAt": "string (ISO 8601)",
    "updatedAt": "string (ISO 8601)"
  }
  ```

### 4. `SYNC_KOIN_{CHAIN}`
- **Tujuan**: Cache untuk data yang diambil dari API CEX. Data di sini bersifat sementara sebelum diproses dan diimpor ke `KOIN_{CHAIN}`.
- **Kunci Utama**: `id` (string, UUID).
- **Indeks**: `by_cex` pada field `cex`.
- **Struktur Record**:
  ```json
  {
    "id": "string (UUID)",
    "cex": "string", // e.g., "BINANCE"
    "chain": "string", // e.g., "BSC"
    "nama_koin": "string",
    "nama_token": "string", // Symbol/ticker
    "cex_ticker": "string", // Ticker lengkap untuk CEX, e.g., "CAKEUSDT"
    "sc_token": "string (address)",
    "des_token": "number",
    "feeWD": "number",
    "deposit": "boolean",
    "withdraw": "boolean",
    "trade": "boolean",
    "price": "number",
    "isNew": "boolean", // Tanda apakah koin ini baru (belum ada di tabel KOIN)
    "createdAt": "string (ISO 8601)",
    "updatedAt": "string (ISO 8601)"
  }
  ```

### 5. `SETTING_FILTER_{CHAIN}` dan `SETTING_FILTER_MULTI`
- **Tujuan**: Menyimpan preferensi filter pengguna untuk setiap chain dan untuk mode multi-chain.
- **Kunci Utama**: `key` (string, out-of-line). Biasanya hanya ada satu record dengan `key: 'SETTING_FILTER'`.
- **Struktur Record**:
  ```json
  {
    "key": "SETTING_FILTER",
    "chainKey": "string", // e.g., "bsc" atau "multi"
    "minPnl": "number",
    "favoritOnly": "boolean",
    "autorun": "boolean",
    "autoscroll": "boolean",
    "run": "string ('run' atau 'stop')",
    "darkMode": "boolean",
    "sortKey": "string",
    "sortDirection": "string ('asc' atau 'desc')",
    "chains": {
      "bsc": true,
      "polygon": false,
      ...
    },
    "cex": {
      "BINANCE": true,
      "GATE": false,
      ...
    },
    "dex": {
      "pancakeswap": true,
      "uniswap": false,
      ...
    },
    "pairs": {
      "USDT": true,
      "BNB": false,
      ...
    }
  }
  ```

### 6. Tabel Lainnya
- **`ASET_EXCHANGER`**: `keyPath: 'name_cex'`. Menyimpan ringkasan aset per CEX.
- **`ASET_WALLET`**: `keyPath: 'key'`. Menyimpan ringkasan aset per wallet/chain.
- **`PORTFOLIO_*`**: Tabel-tabel ini terkait dengan fitur portfolio yang lebih kompleks, menyimpan kredensial, pengaturan, dan data historis PNL. Strukturnya lebih spesifik untuk fitur tersebut.