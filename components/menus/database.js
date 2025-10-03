// components/menus/database.js
// Vue Component untuk Menu Database

const DatabaseMenu = {
  name: 'DatabaseMenu',

  data() {
    return {
      showRestoreModal: false,
      searchQuery: '',
      // Data untuk detail store yang sedang dibuka
      selectedStore: null,
      selectedStoreData: [],
      searchQueries: {}, // Objek untuk menyimpan query pencarian per store
      loadingStore: null,
    };
  },

  computed: {
    // Akses state global dari root instance ($root)
    dbInfo() {
      // REVISI: dbInfo dari root sekarang hanya berisi summary
      return this.$root.dbInfo || { stores: [] };
    },
    dbStatus() {
      return this.$root.dbStatus;
    },
    restoreFileData() {
      return this.$root.restoreFileData;
    },
    filteredStores() {
      if (!this.dbInfo.stores) return [];
      if (!this.searchQuery.trim()) { // Gunakan dbInfo.stores dari root
        return this.dbInfo.stores; // Gunakan dbInfo.stores dari root
      }
      const query = this.searchQuery.toLowerCase();
      return this.dbInfo.stores.filter(store => // Gunakan dbInfo.stores dari root
        store.name.toLowerCase().includes(query)
      );
    },
    // Data yang difilter berdasarkan pencarian di dalam kartu
    filteredRecordData() {
      if (!this.selectedStore || !this.selectedStoreData.length) {
        return this.selectedStoreData;
      }
      const query = (this.searchQueries[this.selectedStore] || '').toLowerCase().trim();
      if (!query) {
        return this.selectedStoreData;
      }

      return this.selectedStoreData.filter(record => {
        // Konversi seluruh record menjadi string JSON untuk pencarian universal
        try {
          const recordString = JSON.stringify(record).toLowerCase();
          return recordString.includes(query);
        } catch (e) {
          return false;
        }
      });
    },
    // Helper untuk format timestamp
    formatTimestamp() {
      return this.$root.formatDateTime ? this.$root.formatDateTime(...arguments) : String(arguments[0] || '');
    }
  },

  methods: {
    // Panggil method dari root instance ($root)
    loadDatabaseInfo() {
      this.$root.loadDatabaseInfo();
    },
    backupDB() {
      this.$root.backupDB();
    },
    confirmDeleteDB() {
      this.$root.confirmDeleteDB();
    },
    restoreDB() {
      this.$root.restoreDB();
      this.showRestoreModal = false; // Close modal after action
    },
    handleRestoreFile(event) {
      this.$root.handleRestoreFile(event);
    },
    // Helper untuk mendapatkan data CEX utama dari record KOIN
    getPrimaryCexData(record) {
      if (!record || !record.cex || typeof record.cex !== 'object') return null;
      const primaryCexKey = Object.keys(record.cex)[0];
      return primaryCexKey ? record.cex[primaryCexKey] : null;
    },
    // Helper untuk mendapatkan key CEX utama dari record KOIN
    getPrimaryCexKey(record) {
      if (!record || !record.cex || typeof record.cex !== 'object') return '-';
      const primaryCexKey = Object.keys(record.cex)[0];
      return primaryCexKey || '-';
    },
    // Helper untuk class badge status WD/DP
    getDbBadgeClass(status) {
      return status ? 'badge bg-success' : 'badge bg-danger';
    },
    // Helper untuk label badge status WD/DP
    getDbBadgeLabel(status) {
      return status ? 'ON' : 'OFF';
    },
    // Muat data detail untuk store yang dipilih
    async loadStoreData(storeName) {
      if (this.selectedStore === storeName) {
        // Jika sudah dipilih, tutup saja (toggle)
        // this.selectedStore = null;
        // this.selectedStoreData = [];
        return;
      }
      this.loadingStore = storeName;
      this.selectedStore = null; // Reset dulu
      try {
        const data = await DB.getAllData(storeName);
        this.selectedStoreData = data;
        this.selectedStore = storeName;
      } catch (error) {
        this.$root.showToast(`Gagal memuat data untuk ${storeName}`, 'danger');
      } finally {
        this.loadingStore = null;
      }
    },
    async clearStoreConfirm(storeName) {
      if (confirm(`Anda yakin ingin menghapus semua data dari tabel "${storeName}"?`)) {
        try {
          await DB.clearStore(storeName);
          this.$root.showToast(`Tabel "${storeName}" berhasil dikosongkan.`, 'success');
          this.loadDatabaseInfo(); // Refresh info
        } catch (error) {
          console.error(`Gagal mengosongkan tabel ${storeName}:`, error);
          this.$root.showToast(`Gagal mengosongkan tabel.`, 'danger');
        }
      }
    },
    async deleteDbRecord(storeName, key) {
      if (!storeName || key === undefined) {
        this.$root.showToast('Store atau key tidak valid.', 'warning');
        return;
      }
      if (confirm(`Anda yakin ingin menghapus record dengan key "${key}" dari store "${storeName}"?`)) {
        try {
          await DB.deleteData(storeName, key);
          this.$root.showToast(`Record dengan key "${key}" berhasil dihapus.`, 'success');
          await this.loadStoreData(storeName); // Muat ulang data di kartu
        } catch (error) {
          this.$root.showToast(`Gagal menghapus record: ${error.message}`, 'danger');
        }
      }
    },
    async cleanupLegacyRecords() {
      if (!confirm('Anda yakin ingin menghapus semua record legacy "DATA_KOIN" dari semua tabel KOIN? \n\nRecord ini sudah tidak digunakan lagi dan aman untuk dihapus.')) {
        return;
      }

      let deletedCount = 0;
      let errorCount = 0;
      const koinStores = this.dbInfo.stores.filter(store => store.name.startsWith('KOIN_'));

      for (const store of koinStores) {
        try {
          const data = await DB.getAllData(store.name);
          const legacyRecord = data.find(record => record.id === 'DATA_KOIN');

          if (legacyRecord) {
            await DB.deleteData(store.name, 'DATA_KOIN');
            deletedCount++;
            console.log(`✓ Deleted DATA_KOIN from ${store.name}`);
          }
        } catch (error) {
          errorCount++;
          console.error(`✗ Failed to clean ${store.name}:`, error);
        }
      }

      if (deletedCount > 0) {
        this.$root.showToast(`Cleanup selesai: ${deletedCount} record legacy berhasil dihapus, ${errorCount} gagal`, 'success');
        this.loadDatabaseInfo(); // Refresh database info
        if (this.selectedStore) {
          await this.loadStoreData(this.selectedStore); // Refresh current view
        }
      } else {
        this.$root.showToast('Tidak ada record legacy "DATA_KOIN" yang ditemukan', 'info');
      }
    }
  },

  template: `
    <div>
      <!-- Toolbar & Info -->
      <div class="card card-soft mb-3">
        <div class="card-body p-2">
          <div class="d-flex flex-wrap gap-2 justify-content-between align-items-center">
            <h5 class="mb-0 ps-2">Manajemen Database</h5>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-warning" @click="cleanupLegacyRecords" title="Hapus record legacy DATA_KOIN yang sudah tidak digunakan">
                <i class="bi bi-broom me-1"></i> Cleanup Legacy
              </button>
              <button class="btn btn-sm btn-primary" @click="backupDB"><i class="bi bi-download me-1"></i> Backup</button>
              <button class="btn btn-sm btn-success" @click="showRestoreModal = true"><i class="bi bi-upload me-1"></i> Restore</button>
              <button class="btn btn-sm btn-danger" @click="confirmDeleteDB"><i class="bi bi-trash-fill me-1"></i> Hapus DB</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Daftar Store dalam Accordion -->
      <div class="accordion" id="dbStoreAccordion">
        <div v-for="(store, index) in filteredStores" :key="store.name" class="accordion-item">
          <h2 class="accordion-header" :id="'heading-' + index">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" :data-bs-target="'#collapse-' + index" aria-expanded="false" :aria-controls="'collapse-' + index" @click="loadStoreData(store.name)">
              <div class="d-flex w-100 justify-content-between align-items-center pe-3">
                <span class="fw-bold">{{ store.name }}</span>
                <div>
                  <span class="badge bg-primary me-2">Records: {{ store.count }}</span>
                  <span class="badge bg-secondary">Size: {{ store.size }}</span>
                </div>
              </div>
            </button>
          </h2>
          <div :id="'collapse-' + index" class="accordion-collapse collapse" :aria-labelledby="'heading-' + index" data-bs-parent="#dbStoreAccordion">
            <div class="accordion-body">
              <div v-if="loadingStore === store.name" class="text-center p-3">
                <div class="spinner-border spinner-border-sm" role="status"></div>
                <span class="ms-2">Memuat data...</span>
              </div>
              <div v-else-if="selectedStore === store.name">
                <div class="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
                  <!-- Search Bar di dalam kartu -->
                  <div class="input-group input-group-sm" style="max-width: 300px;">
                    <span class="input-group-text"><i class="bi bi-search"></i></span>
                    <input type="text" class="form-control" v-model="searchQueries[store.name]" placeholder="Cari data di dalam tabel...">
                  </div>
                  <div>
                    <button class="btn btn-sm btn-outline-danger" @click="clearStoreConfirm(store.name)">
                      <i class="bi bi-eraser-fill me-1"></i> Kosongkan Store Ini
                    </button>
                  </div>
                </div>

                <!-- Tampilan Khusus untuk SYNC_KOIN -->
                <div v-if="store.name.startsWith('SYNC_KOIN_')" class="table-responsive">
                  <table class="table table-sm table-bordered table-hover small">
                    <thead class="table-dark">
                      <tr>
                        <th>NO</th>
                        <th>CEX</th>
                        <th>NAMA KOIN</th>
                        <th>NAMA TOKEN</th>
                        <th>SC TOKEN</th>
                        <th>DES TOKEN</th>
                        <th class="text-center">WD</th>
                        <th class="text-center">DP</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(record, idx) in filteredRecordData" :key="record.id">
                        <td>{{ idx + 1 }}</td>
                        <td>{{ record.cex }}</td>
                        <td>{{ record.nama_koin }}</td>
                        <td class="fw-semibold">{{ record.nama_token }}</td>
                        <td class="font-monospace text-truncate" style="max-width: 150px;" :title="record.sc_token">{{ record.sc_token }}</td>
                        <td>{{ record.des_token }}</td>
                        <td class="text-center"><span :class="getDbBadgeClass(record.withdraw)">{{ getDbBadgeLabel(record.withdraw) }}</span></td>
                        <td class="text-center"><span :class="getDbBadgeClass(record.deposit)">{{ getDbBadgeLabel(record.deposit) }}</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Tampilan Khusus untuk KOIN -->
                <div v-else-if="store.name.startsWith('KOIN_')" class="table-responsive">
                  <table class="table table-sm table-bordered table-hover small">
                    <thead class="table-dark">
                      <tr>
                        <th>NO</th>
                        <th>CEX</th>
                        <th>NAMA TOKEN</th>
                        <th>SC TOKEN</th>
                        <th>DES TOKEN</th>
                        <th class="text-center">WD</th>
                        <th class="text-center">DP</th>
                        <th>NAMA PAIR</th>
                        <th>SC PAIR</th>
                        <th>DES PAIR</th>
                        <th class="text-center">WD</th>
                        <th class="text-center">DP</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(record, idx) in filteredRecordData.filter(r => r.id !== 'DATA_KOIN')" :key="record.id">
                        <td>{{ idx + 1 }}</td>
                        <td>{{ getPrimaryCexKey(record) }}</td>
                        <td class="fw-semibold">{{ record.nama_token || record.nama_koin }}</td>
                        <td class="font-monospace text-truncate" style="max-width: 150px;" :title="record.sc_token">{{ record.sc_token }}</td>
                        <td>{{ record.des_token }}</td>
                        <td class="text-center"><span :class="getDbBadgeClass(getPrimaryCexData(record)?.withdrawToken)">{{ getDbBadgeLabel(getPrimaryCexData(record)?.withdrawToken) }}</span></td>
                        <td class="text-center"><span :class="getDbBadgeClass(getPrimaryCexData(record)?.depositToken)">{{ getDbBadgeLabel(getPrimaryCexData(record)?.depositToken) }}</span></td>
                        <td class="fw-semibold">{{ record.nama_pair }}</td>
                        <td class="font-monospace text-truncate" style="max-width: 150px;" :title="record.sc_pair">{{ record.sc_pair }}</td>
                        <td>{{ record.des_pair }}</td>
                        <td class="text-center"><span :class="getDbBadgeClass(getPrimaryCexData(record)?.withdrawPair)">{{ getDbBadgeLabel(getPrimaryCexData(record)?.withdrawPair) }}</span></td>
                        <td class="text-center"><span :class="getDbBadgeClass(getPrimaryCexData(record)?.depositPair)">{{ getDbBadgeLabel(getPrimaryCexData(record)?.depositPair) }}</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Tampilan Khusus untuk RIWAYAT_AKSI -->
                <div v-else-if="store.name === 'RIWAYAT_AKSI'" class="table-responsive">
                  <table class="table table-sm table-bordered table-hover small">
                    <thead class="table-dark">
                      <tr>
                        <th>WAKTU</th>
                        <th>AKSI</th>
                        <th>STATUS</th>
                        <th>PESAN</th>
                        <th class="text-center">HAPUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="record in filteredRecordData" :key="record.id">
                        <td class="text-nowrap">{{ formatTimestamp(record.timestamp, 'datetime') }}</td>
                        <td><span class="badge bg-primary">{{ record.action }}</span></td>
                        <td><span class="badge" :class="'bg-' + record.status">{{ record.status }}</span></td>
                        <td style="white-space: pre-wrap; word-break: break-word;">{{ record.message }}</td>
                        <td class="text-center">
                          <button class="btn btn-sm btn-outline-danger py-0 px-1" @click="deleteDbRecord(store.name, record.id)">
                            <i class="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Tampilan Ringkasan untuk SETTING_GLOBAL, SETTING_FILTER, ASET, RIWAYAT_MODAL -->
                <div v-else-if="store.name.startsWith('SETTING_') || store.name.startsWith('ASET_') || store.name === 'RIWAYAT_MODAL'">
                   <div v-if="!filteredRecordData || filteredRecordData.length === 0" class="alert alert-secondary text-center">
                    Tidak ada data yang cocok dengan pencarian.
                  </div>
                  <div v-else v-for="record in filteredRecordData" :key="record.id || record.key" class="card card-body mb-2">
                     <h6 class="card-title font-monospace text-primary">{{ record.id || record.key }}</h6>
                     <ul class="list-group list-group-flush">
                        <li v-for="(value, prop) in record" :key="prop" class="list-group-item d-flex justify-content-between align-items-start">
                           <div class="ms-2 me-auto">
                              <div class="fw-bold">{{ prop }}</div>
                              <div class="text-muted small" style="white-space: pre-wrap; word-break: break-all;">
                                {{ typeof value === 'object' ? JSON.stringify(value, null, 2) : value }}
                              </div>
                           </div>
                        </li>
                     </ul>
                  </div>
                </div>

                <!-- Tampilan Default (JSON) -->
                <div v-else>
                  <div v-if="!filteredRecordData || filteredRecordData.length === 0" class="alert alert-secondary text-center">
                    Tidak ada data yang cocok dengan pencarian.
                  </div>
                  <div v-else v-for="record in filteredRecordData" :key="record.id || record.key" class="mb-2">
                    <strong class="font-monospace text-primary">{{ record.id || record.key }}</strong>
                    <pre class="bg-light p-2 rounded small mb-0 mt-1">{{ JSON.stringify(record, null, 2) }}</pre>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
        <div v-if="filteredStores.length === 0" class="text-center text-muted py-4">
          <i class="bi bi-inbox"></i> Tidak ada tabel yang cocok dengan pencarian
        </div>
      </div>

      <!-- Modal Restore -->
      <div v-if="showRestoreModal" class="modal d-block" style="background: rgba(0,0,0,0.5);" @click.self="showRestoreModal = false">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-upload"></i> Restore Database</h5>
              <button type="button" class="btn-close" @click="showRestoreModal = false"></button>
            </div>
            <div class="modal-body">
              <p>Pilih file backup (JSON) untuk restore database:</p>
              <input type="file" class="form-control" accept=".json" @change="handleRestoreFile" ref="restoreFileInput">
              <div class="alert alert-warning mt-3 mb-0">
                <i class="bi bi-exclamation-triangle"></i> Perhatian: Semua data saat ini akan diganti dengan data dari backup!
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="showRestoreModal = false">Batal</button>
              <button type="button" class="btn btn-success" @click="restoreDB" :disabled="!restoreFileData">
                <i class="bi bi-upload"></i> Restore Sekarang
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};
