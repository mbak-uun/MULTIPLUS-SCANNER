# Skema Database Per Fitur/Tab - MultiPlus App

> **Dokumen ini menjelaskan relasi antara setiap fitur/tab/menu dengan tabel IndexedDB yang digunakan**

---

## 📊 Database Overview

- **Nama Database**: `MULTIPLUS_APP`
- **Versi**: `2`
- **Teknologi**: IndexedDB (Browser-based storage)
- **Total Tabel**: Dynamic (tergantung jumlah chain aktif)

---

## 🗂️ Tabel Database & Penggunaannya

### 1. **SETTING_GLOBAL**
**Deskripsi**: Menyimpan konfigurasi global aplikasi (hanya 1 record)

**Digunakan oleh**:
- ✅ **Menu Settings** (CRUD)
- ✅ **All Tabs** (Read - untuk validasi chain/CEX/DEX aktif)

**Struktur Data**:
```json
{
  "nickname": "string",
  "walletMeta": "0x...",
  "AnggotaGrup": 5,
  "jedaTimeGroup": 1000,
  "jedaPerAnggota": 200,
  "WaktuTunggu": 5000,
  "config_chain": {
    "bsc": { "status": true },
    "polygon": { "status": true },
    "ethereum": { "status": false }
  },
  "config_cex": {
    "BINANCE": { "status": true, "jeda": 30 },
    "GATE": { "status": true, "jeda": 50 },
    "MEXC": { "status": false, "jeda": 30 }
  },
  "config_dex": {
    "pancakeswap": { "status": true, "jeda": 20 },
    "uniswap": { "status": true, "jeda": 20 },
    "okxdex": { "status": true, "jeda": 30 }
  }
}
```

**Operasi**:
| Fitur | Create | Read | Update | Delete |
|-------|--------|------|--------|--------|
| Menu Settings | ✅ | ✅ | ✅ | ❌ |
| All Tabs | ❌ | ✅ | ❌ | ❌ |

---

### 2. **SETTING_FILTER_`<CHAIN>`**
**Deskripsi**: Menyimpan preferensi filter per chain (atau `MULTI` untuk mode multichain)

**Tabel yang dibuat**:
- `SETTING_FILTER_MULTI`
- `SETTING_FILTER_BSC`
- `SETTING_FILTER_POLYGON`
- `SETTING_FILTER_ETHEREUM`
- ... (sesuai chain aktif)

**Digunakan oleh**:
- ✅ **Tab Scanning** (Read/Write - untuk filter scan)
- ✅ **Tab Management** (Read - untuk filter tampilan)
- ✅ **Filter Bar Component** (Write - saat user ubah filter)

**Struktur Data**:
```json
{
  "chainKey": "bsc",
  "minPnl": 0.5,
  "sortDirection": "desc",
  "favoritOnly": false,
  "autorun": false,
  "autoscroll": false,
  "darkMode": false,
  "run": "stop",
  "cex": {
    "BINANCE": true,
    "GATE": false,
    "MEXC": true
  },
  "dex": {
    "pancakeswap": true,
    "uniswap": false,
    "okxdex": true
  },
  "chains": {
    "bsc": true,
    "polygon": false
  },
  "pairs": {
    "BNB": true,
    "USDT": false,
    "NON": true
  }
}
```

**Operasi**:
| Fitur | Create | Read | Update | Delete |
|-------|--------|------|--------|--------|
| Tab Scanning | ❌ | ✅ | ✅ | ❌ |
| Tab Management | ❌ | ✅ | ❌ | ❌ |
| Filter Bar | ❌ | ✅ | ✅ | ❌ |

---

### 3. **KOIN_`<CHAIN>`**
**Deskripsi**: Menyimpan master data koin yang akan dipantau untuk setiap chain

**Tabel yang dibuat**:
- `KOIN_MULTI`
- `KOIN_BSC`
- `KOIN_POLYGON`
- `KOIN_ETHEREUM`
- ... (sesuai chain aktif)

**Digunakan oleh**:
- ✅ **Tab Scanning** (Read - untuk scan price)
- ✅ **Tab Management** (CRUD - untuk manage koin)
- ✅ **Tab Sinkronisasi** (Create - saat import koin)
- ✅ **Tab Wallet Exchanger** (Update - untuk update fee/deposit/withdraw status)

**Struktur Data** (Per Record):
```json
{
  "id": "uuid-v4-string",
  "chain": "BSC",
  "nama_koin": "BNB",
  "sc_token": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  "des_token": 18,
  "nama_pair": "USDT",
  "sc_pair": "0x55d398326f99059fF775485246999027B3197955",
  "des_pair": 18,
  "status": true,
  "isFavorite": false,
  "cex": {
    "BINANCE": {
      "status": true,
      "feeWDToken": "0.0005",
      "feeWDPair": "1.0",
      "depositToken": true,
      "withdrawToken": true,
      "depositPair": true,
      "withdrawPair": true
    },
    "GATE": {
      "status": false,
      "feeWDToken": null,
      "feeWDPair": null,
      "depositToken": false,
      "withdrawToken": false,
      "depositPair": false,
      "withdrawPair": false
    }
  },
  "dex": {
    "pancakeswap": {
      "status": true,
      "left": 100,
      "right": 100
    },
    "uniswap": {
      "status": false,
      "left": 0,
      "right": 0
    }
  },
  "createdAt": "2025-10-03T04:12:49.977Z",
  "updatedAt": "2025-10-03T04:12:49.977Z"
}
```

**Operasi**:
| Fitur | Create | Read | Update | Delete |
|-------|--------|------|--------|--------|
| Tab Scanning | ❌ | ✅ | ✅ (favorite) | ✅ |
| Tab Management | ✅ | ✅ | ✅ | ✅ |
| Tab Sinkronisasi | ✅ (import) | ❌ | ❌ | ❌ |
| Tab Wallet | ❌ | ✅ | ✅ (CEX data) | ❌ |

---

### 4. **SYNC_KOIN_`<CHAIN>`**
**Deskripsi**: Cache/snapshot data koin dari API CEX (sebelum import ke KOIN)

**Tabel yang dibuat**:
- `SYNC_KOIN_MULTI`
- `SYNC_KOIN_BSC`
- `SYNC_KOIN_POLYGON`
- `SYNC_KOIN_ETHEREUM`
- ... (sesuai chain aktif)

**Digunakan oleh**:
- ✅ **Tab Sinkronisasi** (CRUD - untuk sync & import koin dari CEX)

**Struktur Data** (Per Record):
```json
{
  "id": "auto-increment-or-uuid",
  "cex": "BINANCE",
  "chain": "BSC",
  "nama_koin": "BNB",
  "nama_token": "BNB",
  "sc_token": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  "des_token": 18,
  "feeWD": "0.0005",
  "deposit": true,
  "withdraw": true,
  "trade": true,
  "price": 580.25,
  "isNew": true,
  "createdAt": "2025-10-03T04:00:00.000Z",
  "updatedAt": "2025-10-03T04:00:00.000Z"
}
```

**Index**: `by_cex` (untuk filter data per CEX)

**Operasi**:
| Fitur | Create | Read | Update | Delete |
|-------|--------|------|--------|--------|
| Tab Sinkronisasi | ✅ | ✅ | ✅ | ✅ |

**Workflow**:
1. User pilih CEX → Klik "Sync CEX"
2. Fetch data dari API CEX → Simpan ke `SYNC_KOIN_<CHAIN>`
3. Mark data baru dengan `isNew: true`
4. User pilih koin → Klik "Import ke Manajemen"
5. Data dipindah ke `KOIN_<CHAIN>` dengan struktur skema yang benar

---

### 5. **RIWAYAT_AKSI**
**Deskripsi**: Menyimpan log aktivitas user/sistem (audit trail)

**Digunakan oleh**:
- ✅ **Menu History** (Read/Delete)
- ✅ **All Features** (Create - saat ada aksi penting)

**Struktur Data**:
```json
{
  "id": "auto-increment",
  "timestamp": "2025-10-03T04:12:49.977Z",
  "action": "IMPORT_KOIN",
  "status": "success",
  "message": "Berhasil import 15 koin dari BINANCE ke BSC"
}
```

**Index**: `by_timestamp` (untuk sorting)

**Operasi**:
| Fitur | Create | Read | Update | Delete |
|-------|--------|------|--------|--------|
| Menu History | ❌ | ✅ | ❌ | ✅ |
| All Features | ✅ (log) | ❌ | ❌ | ❌ |

---

### 6. **ASET_EXCHANGER**
**Deskripsi**: Menyimpan kredensial API dan snapshot balance untuk setiap CEX

**Digunakan oleh**:
- ✅ **Menu Portfolio** (CRUD - untuk manage exchanger portfolio)

**Struktur Data**:
```json
{
  "name_cex": "BINANCE",
  "enabled": true,
  "data_api": {
    "apiKey": "your-api-key",
    "secretKey": "your-secret-key",
    "passphrase": null
  },
  "snapshot": {
    "totalBalance": 5000.50,
    "assets": [
      { "symbol": "BTC", "balance": 0.05, "usdValue": 2500.25 },
      { "symbol": "ETH", "balance": 1.5, "usdValue": 2500.25 }
    ]
  },
  "lastUpdated": "2025-10-03T04:12:49.977Z"
}
```

**KeyPath**: `name_cex`

**Operasi**:
| Fitur | Create | Read | Update | Delete |
|-------|--------|------|--------|--------|
| Menu Portfolio | ✅ | ✅ | ✅ | ✅ |

---

### 7. **ASET_WALLET**
**Deskripsi**: Menyimpan alamat wallet per chain dan snapshot balance

**Digunakan oleh**:
- ✅ **Menu Portfolio** (CRUD - untuk manage wallet portfolio)

**Struktur Data**:
```json
{
  "key": "BSC",
  "name": "BSC Wallet",
  "enabled": true,
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "lastChecked": "2025-10-03T04:12:49.977Z",
  "lastResult": {
    "total": 1500.75,
    "assets": [
      { "symbol": "BNB", "balance": 2.5, "usdValue": 1450.50 },
      { "symbol": "USDT", "balance": 50.25, "usdValue": 50.25 }
    ]
  }
}
```

**KeyPath**: `key`

**Operasi**:
| Fitur | Create | Read | Update | Delete |
|-------|--------|------|--------|--------|
| Menu Portfolio | ✅ | ✅ | ✅ | ✅ |

---

### 8. **RIWAYAT_MODAL**
**Deskripsi**: Menyimpan histori perhitungan PNL dari portfolio

**Digunakan oleh**:
- ✅ **Menu Portfolio** (CRUD - untuk track PNL)

**Struktur Data**:
```json
{
  "id": "auto-increment",
  "timestamp": "2025-10-03T04:12:49.977Z",
  "awal": 10000,
  "akhir": 12500,
  "pnl": 2500,
  "action": "MANUAL_REFRESH"
}
```

**Index**: `by_timestamp` (untuk sorting)

**Operasi**:
| Fitur | Create | Read | Update | Delete |
|-------|--------|------|--------|--------|
| Menu Portfolio | ✅ | ✅ | ❌ | ✅ |

---

## 📋 Ringkasan Penggunaan Tabel per Fitur

### **Tab Scanning**
| Tabel | Operasi | Tujuan |
|-------|---------|--------|
| `SETTING_GLOBAL` | Read | Validasi CEX/DEX/Chain aktif |
| `SETTING_FILTER_<CHAIN>` | Read/Write | Filter & sorting data scan |
| `KOIN_<CHAIN>` | Read, Update (favorite), Delete | Data koin untuk scan price |

---

### **Tab Management Koin**
| Tabel | Operasi | Tujuan |
|-------|---------|--------|
| `SETTING_GLOBAL` | Read | Validasi CEX/DEX aktif |
| `SETTING_FILTER_<CHAIN>` | Read | Filter tampilan koin |
| `KOIN_<CHAIN>` | CRUD | Manage master data koin |
| `RIWAYAT_AKSI` | Create | Log aktivitas |

---

### **Tab Sinkronisasi Koin**
| Tabel | Operasi | Tujuan |
|-------|---------|--------|
| `SETTING_GLOBAL` | Read | Validasi CEX aktif & API config |
| `SYNC_KOIN_<CHAIN>` | CRUD | Cache data dari API CEX |
| `KOIN_<CHAIN>` | Create | Import koin terpilih |
| `RIWAYAT_AKSI` | Create | Log sync & import |

---

### **Tab Wallet Exchanger**
| Tabel | Operasi | Tujuan |
|-------|---------|--------|
| `SETTING_GLOBAL` | Read | Validasi CEX aktif & wallet address |
| `KOIN_<CHAIN>` | Read, Update (CEX data) | Update fee WD, deposit/withdraw status |
| `RIWAYAT_AKSI` | Create | Log pengecekan wallet |

---

### **Menu Settings**
| Tabel | Operasi | Tujuan |
|-------|---------|--------|
| `SETTING_GLOBAL` | CRUD | Manage konfigurasi global |
| `RIWAYAT_AKSI` | Create | Log perubahan settings |

---

### **Menu Database**
| Tabel | Operasi | Tujuan |
|-------|---------|--------|
| **All Tables** | Read, Delete | View & manage semua data |
| `RIWAYAT_AKSI` | Create | Log operasi database |

---

### **Menu History**
| Tabel | Operasi | Tujuan |
|-------|---------|--------|
| `RIWAYAT_AKSI` | Read, Delete | View & manage log aktivitas |

---

### **Menu Portfolio**
| Tabel | Operasi | Tujuan |
|-------|---------|--------|
| `SETTING_GLOBAL` | Read | Validasi config |
| `ASET_EXCHANGER` | CRUD | Manage exchanger accounts |
| `ASET_WALLET` | CRUD | Manage wallet addresses |
| `RIWAYAT_MODAL` | CRUD | Track PNL history |
| `RIWAYAT_AKSI` | Create | Log portfolio updates |

---

## 🔄 Alur Data Utama

### **1. Setup Awal**
```
Menu Settings → SETTING_GLOBAL (Create/Update)
└─> Aktifkan Chain, CEX, DEX yang akan digunakan
```

### **2. Sinkronisasi Koin dari CEX**
```
Tab Sinkronisasi → Pilih CEX → Fetch API
└─> SYNC_KOIN_<CHAIN> (Create)
    └─> Pilih koin → Import
        └─> KOIN_<CHAIN> (Create dengan skema nested CEX & DEX)
```

### **3. Manage & Scan Koin**
```
Tab Management → KOIN_<CHAIN> (CRUD)
└─> Tab Scanning → KOIN_<CHAIN> (Read) + SETTING_FILTER (Read/Write)
    └─> Scan price dari CEX & DEX
```

### **4. Update Status Wallet/Deposit/Withdraw**
```
Tab Wallet → Pilih CEX → Fetch Wallet API
└─> KOIN_<CHAIN> (Update: cex.{CEX_NAME}.feeWDToken, depositToken, withdrawToken)
```

### **5. Monitor Portfolio**
```
Menu Portfolio → ASET_EXCHANGER + ASET_WALLET (Read)
└─> Fetch balance → Update snapshot
    └─> RIWAYAT_MODAL (Create untuk track PNL)
```

---

## 📝 Catatan Penting

### **Skema Nested untuk CEX & DEX**
✅ **Struktur yang BENAR** (sesuai update terbaru):
```json
{
  "cex": {
    "BINANCE": { "status": true, "feeWDToken": "0.01", ... },
    "GATE": { "status": false, ... }
  },
  "dex": {
    "pancakeswap": { "status": true, "left": 100, "right": 100 },
    "uniswap": { "status": false, "left": 0, "right": 0 }
  }
}
```

❌ **Struktur LAMA yang SALAH**:
```json
{
  "exchange": "BINANCE",  // Flat, bukan nested
  "feeWDToken": "0.01",   // Flat
  "dex": {
    "pancakeswap": { "modalKiri": 100, "modalKanan": 100 }  // Salah field name
  }
}
```

### **Backward Compatibility**
- Field `isFavorite` (baru) dan `isFavorit` (lama) keduanya di-support
- Saat save, update kedua field untuk compatibility
- Saat filter, cek kedua field: `token.isFavorite || token.isFavorit`

---

**Terakhir diupdate**: 2025-10-03
**Versi Dokumen**: 1.0
