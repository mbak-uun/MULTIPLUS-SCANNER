// assets/js/db.js
// Modul untuk pengelolaan IndexedDB

const DB = (() => {
  const APP_CONFIG = (typeof KONFIG_APLIKASI !== 'undefined' && KONFIG_APLIKASI.APP) ? KONFIG_APLIKASI.APP : {};
  const RAW_APP_NAME = APP_CONFIG.NAME || 'MULTIPLUS SCANNER';
  const SANITIZED_APP_NAME = RAW_APP_NAME
    .toString()
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase() || 'MULTIPLUS_SCANNER';
  const RAW_APP_VERSION = APP_CONFIG.VERSION || '1.0';
  const VERSION_SUFFIX = RAW_APP_VERSION
    .toString()
    .replace(/[^0-9A-Za-z]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase() || '1';
  const DB_NAME = `${SANITIZED_APP_NAME}_DB_V${VERSION_SUFFIX}`;
  const PARSED_DB_VERSION = parseInt(RAW_APP_VERSION.toString().replace(/[^0-9]/g, ''), 10);
  const REQUIRED_DB_VERSION = 12;
  const BASE_DB_VERSION = Number.isFinite(PARSED_DB_VERSION) && PARSED_DB_VERSION > 0 ? PARSED_DB_VERSION : 1;
  const DB_VERSION = Math.max(BASE_DB_VERSION, REQUIRED_DB_VERSION);
  let db;

  // Fungsi untuk menghasilkan daftar store dinamis berdasarkan KONFIG_APLIKASI
  function generateStores() {
    const stores = [
      { name: 'SETTING_GLOBAL' }, // Store untuk satu objek setting global. Key statis.
      { name: 'RIWAYAT_AKSI', options: { keyPath: 'id', autoIncrement: true }, indexes: [{ name: 'by_timestamp', keyPath: 'timestamp' }] }, // Store untuk log aktivitas
      { name: 'ASET_EXCHANGER', options: { keyPath: 'name_cex' } },
      { name: 'ASET_WALLET', options: { keyPath: 'key' } },
      { name: 'PORTFOLIO_SETTINGS', options: { keyPath: 'key' } },
      { name: 'PORTFOLIO_CREDENTIALS', options: { keyPath: 'id' } },
      { name: 'PORTFOLIO_PNL_HISTORY', options: { keyPath: 'timestamp' } }
    ];

    // Tambahkan store untuk mode 'MULTI' secara eksplisit
    // KOIN_MULTI dan SYNC_KOIN_MULTI tidak lagi digunakan. Data diambil dari agregasi KOIN_<CHAIN>.
    stores.push({ name: `SETTING_FILTER_MULTI` });

    // Generate store untuk setiap chain
    if (typeof KONFIG_APLIKASI !== 'undefined' && KONFIG_APLIKASI.CHAINS) {
      Object.keys(KONFIG_APLIKASI.CHAINS).forEach(chainKey => {
        const chainUpper = chainKey.toUpperCase();

        // KOIN_<CHAIN>
        stores.push({
          name: `KOIN_${chainUpper}`,
          options: { keyPath: 'id' }
        });

        // SYNC_KOIN_<CHAIN>
        stores.push({
          name: `SYNC_KOIN_${chainUpper}`,
          options: { keyPath: 'id' },
          indexes: [{ name: 'by_cex', keyPath: 'cex' }]
        });

        // SETTING_FILTER_<CHAIN>
        stores.push({
          name: `SETTING_FILTER_${chainUpper}`
        });

        // DIKEMBALIKAN: Hapus store SCAN_RESULTS_<CHAIN>
      });
    }

    return stores;
  }

  const STORES = generateStores();

  /**
   * Inisialisasi dan membuka koneksi ke database.
   * Membuat object store jika belum ada.
   * @returns {Promise<IDBDatabase>}
   */
  function initDB() {
    return new Promise((resolve, reject) => {
      // console.log('Membuka koneksi IndexedDB...');

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      // Event ini hanya berjalan jika database belum ada atau versi baru terdeteksi.
      request.onupgradeneeded = (event) => {
        // console.log('Upgrade IndexedDB diperlukan. Membuat object stores...');
        const dbInstance = event.target.result;

        STORES.forEach(storeConfig => {
          if (!dbInstance.objectStoreNames.contains(storeConfig.name)) {
            const store = dbInstance.createObjectStore(storeConfig.name, storeConfig.options);
            // console.log(`✅ Object store "${storeConfig.name}" berhasil dibuat.`);

            // Membuat index jika didefinisikan
            if (storeConfig.indexes) {
              storeConfig.indexes.forEach(index => {
                store.createIndex(index.name, index.keyPath, { unique: index.unique || false });
                // console.log(`   ➡️ Index "${index.name}" pada "${index.keyPath}" berhasil dibuat.`);
              });
            }
          }
        });
      };

      request.onsuccess = (event) => {
        db = event.target.result;
        // console.log('Koneksi IndexedDB berhasil dibuka.');
        resolve(db);
      };

      request.onerror = (event) => {
        // console.error('Error saat membuka IndexedDB:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Mendapatkan data dari object store.
   * @param {string} storeName Nama object store.
   * @param {any} key Kunci dari data yang ingin diambil.
   * @returns {Promise<any>}
   */
  function getData(storeName, key) {
    return new Promise((resolve, reject) => {
      if (!db) return reject('Database belum diinisialisasi.');
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  /**
   * Menyimpan atau memperbarui data di object store.
   * @param {string} storeName Nama object store.
   * @param {any} data Data yang akan disimpan.
   * @param {any} [key] Kunci untuk data (opsional, untuk out-of-line keys).
   * @returns {Promise<any>}
   */
  function saveData(storeName, data, key) {
    return new Promise((resolve, reject) => {
      if (!db) return reject('Database belum diinisialisasi.');
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = key ? store.put(data, key) : store.put(data);

      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  /**
   * Menghapus data dari object store.
   * @param {string} storeName Nama object store.
   * @param {any} key Kunci dari data yang ingin dihapus.
   * @returns {Promise<void>}
   */
  function deleteData(storeName, key) {
    return new Promise((resolve, reject) => {
      if (!db) return reject('Database belum diinisialisasi.');
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  }
  /**
   * Helper untuk mendapatkan nama store berdasarkan chain
   * @param {string} type - Tipe store: 'KOIN', 'SYNC_KOIN', 'SETTING_FILTER'
   * @param {string} chainKey - Key chain (lowercase): 'bsc', 'polygon', dll
   * @returns {string} - Nama store yang lengkap
   */
  function getStoreNameByChain(type, chainKey) {
    // Penanganan khusus untuk mode 'multi' agar konsisten
    if (chainKey.toLowerCase() === 'multi') {
      return `${type}_MULTI`;
    }
    return `${type}_${chainKey.toUpperCase()}`;
  }

  /**
   * Mendapatkan daftar semua store yang dibuat
   * @returns {Array<string>} - Array nama store
   */
  function getAllStoreNames() {
    if (!db) return [];
    return Array.from(db.objectStoreNames);
  }

  /**
   * Menghitung jumlah records di store
   * @param {string} storeName - Nama object store
   * @returns {Promise<number>}
   */
  function countRecords(storeName) {
    return new Promise((resolve, reject) => {
      if (!db) return reject('Database belum diinisialisasi.');
      try {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.count();

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
      } catch (error) {
        resolve(0); // Return 0 jika store tidak ada
      }
    });
  }

  /**
   * Mengosongkan semua data di store
   * @param {string} storeName - Nama object store
   * @returns {Promise<void>}
   */
  function clearStore(storeName) {
    return new Promise((resolve, reject) => {
      if (!db) return reject('Database belum diinisialisasi.');
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  }

  /**
   * Mendapatkan semua data dari store
   * @param {string} storeName - Nama object store
   * @returns {Promise<Array>}
   */
  function getAllData(storeName) {
    return new Promise((resolve, reject) => {
      if (!db) return reject('Database belum diinisialisasi.');
      try {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = (event) => reject(event.target.error);
      } catch (error) {
        resolve([]); // Return empty array jika store tidak ada
      }
    });
  }

  /**
   * Mendapatkan record pertama dari sebuah store sebagai sampel.
   * @param {string} storeName - Nama object store.
   * @returns {Promise<object|null>}
   */
  function getFirstRecord(storeName) {
    return new Promise((resolve, reject) => {
      if (!db) return reject('Database belum diinisialisasi.');
      try {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          resolve(cursor ? cursor.value : null);
        };
        request.onerror = (event) => reject(event.target.error);
      } catch (error) {
        resolve(null); // Return null jika store tidak ada
      }
    });
  }

  /**
   * Backup semua data database ke JSON
   * @returns {Promise<object>}
   */
  async function backupDatabase() {
    if (!db) throw new Error('Database belum diinisialisasi.');

    const backup = {
      dbName: DB_NAME,
      version: DB_VERSION,
      exportDate: new Date().toISOString(),
      stores: {}
    };

    const storeNames = getAllStoreNames();
    for (const storeName of storeNames) {
      try {
        const data = await getAllData(storeName);
        backup.stores[storeName] = data;
      } catch (error) {
        // console.warn(`Gagal backup store ${storeName}:`, error);
        backup.stores[storeName] = [];
      }
    }

    return backup;
  }

  /**
   * Restore database dari backup JSON
   * @param {object} backupData - Data backup dari backupDatabase()
   * @returns {Promise<void>}
   */
  async function restoreDatabase(backupData) {
    if (!db) throw new Error('Database belum diinisialisasi.');
    if (!backupData || !backupData.stores) throw new Error('Format backup tidak valid.');

    for (const [storeName, records] of Object.entries(backupData.stores)) {
      try {
        // Clear store terlebih dahulu
        await clearStore(storeName);

        // Insert semua records
        for (const record of records) {
          // Untuk store dengan out-of-line key (seperti SETTING_GLOBAL)
          if (storeName === 'SETTING_GLOBAL' || storeName.startsWith('SETTING_FILTER_') || storeName === 'SETTING_FILTER_MULTI') {
            await saveData(storeName, record, record.key || 'SETTING_GLOBAL');
          } else {
            await saveData(storeName, record);
          }
        }
        // console.log(`✅ Restored ${records.length} records ke ${storeName}`);
      } catch (error) {
        // console.warn(`⚠️ Gagal restore store ${storeName}:`, error);
      }
    }
  }

  /**
   * Menghapus database (untuk development/reset)
   * @returns {Promise<void>}
   */
  function deleteDatabase() {
    return new Promise((resolve, reject) => {
      if (db) {
        db.close();
        db = null;
      }

      const request = indexedDB.deleteDatabase(DB_NAME);

      request.onsuccess = () => {
        // console.log('Database berhasil dihapus');
        resolve();
      };

      request.onerror = (event) => {
        // console.error('Gagal menghapus database:', event.target.error);
        reject(event.target.error);
      };

      request.onblocked = () => {
        // console.warn('Penghapusan database diblokir. Tutup semua tab yang menggunakan database ini.');
      };
    });
  }

  function getDatabaseMeta() {
    return {
      name: DB_NAME,
      version: DB_VERSION
    };
  }

  // Expose public methods
  return {
    initDB,
    getData,
    saveData,
    deleteData, // Expose method baru
    getStoreNameByChain,
    getAllStoreNames,
    countRecords,
    clearStore,
    getAllData,
    getFirstRecord,
    backupDatabase,
    restoreDatabase,
    deleteDatabase,
    getDatabaseMeta
  };
})();

// Expose DB ke global scope
if (typeof window !== 'undefined') {
  window.DB = DB;
  // console.log('✅ DB Service exposed to window.DB');
}
