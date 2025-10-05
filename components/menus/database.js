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
    }
    
  },

  template: `
    <div>
      <!-- REFACTORED: Database Toolbar with Bootstrap -->
      <div class="card card-body mb-3">
        <div class="row g-2 align-items-center">
          <div class="col-12 col-md-6 col-lg">
            <h5 class="mb-0 d-flex align-items-center gap-2">
              <i class="bi bi-database"></i>
              Manajemen Database
            </h5>
          </div>
          <div class="col-12 col-md-6 col-lg-auto">
            <div class="d-flex justify-content-md-end">
              <div class="btn-group btn-group-sm" role="group" aria-label="Database actions">
                <button class="btn btn-sm btn-dark" @click="backupDB">
                  <i class="bi bi-download me-1"></i> Backup
                </button>

                <button class="btn btn-sm btn-info" @click="showRestoreModal = true">
                  <i class="bi bi-upload me-1"></i> Restore
                </button>

                <button class="btn btn-sm btn-danger" @click="confirmDeleteDB">
                  <i class="bi bi-trash-fill me-1"></i> Hapus DB
                </button>
              </div>
              
            </div>

          </div>
        </div>
      </div>

      <!-- REFACTORED: Daftar Store menggunakan Bootstrap Accordion -->
      <div class="accordion" id="dbStoreAccordion">
        <div v-for="(store, index) in filteredStores" :key="store.name" class="accordion-item">
          <h2 class="accordion-header" :id="'heading-' + index">
            <button 
              class="accordion-button collapsed" 
              type="button" 
              data-bs-toggle="collapse" 
              :data-bs-target="'#collapse-' + index" 
              aria-expanded="false" 
              :aria-controls="'collapse-' + index" 
              @click="loadStoreData(store.name)"
            >
              <div class="d-flex w-100 justify-content-between align-items-center pe-3">
                <span class="fw-bold">{{ store.name }}</span>
                <div class="d-none d-sm-block">
                  <span class="badge bg-primary me-2">Records: {{ store.count }}</span>
                  <span class="badge bg-secondary">Size: {{ store.size }}</span>
                </div>
              </div>
            </button>
          </h2>
          <div :id="'collapse-' + index" class="accordion-collapse collapse" :aria-labelledby="'heading-' + index" data-bs-parent="#dbStoreAccordion">
            <div class="accordion-body p-2 p-md-3">
              <div class="d-block d-sm-none mb-2 text-end">
                  <span class="badge bg-primary me-2">Records: {{ store.count }}</span>
                  <span class="badge bg-secondary">Size: {{ store.size }}</span>
              </div>

              <div v-if="loadingStore === store.name" class="text-center p-3">
                <div class="spinner-border spinner-border-sm" role="status"></div>
                <span class="ms-2">Memuat data...</span>
              </div>
              <div v-else-if="selectedStore === store.name">
                <div class="row g-2 align-items-center mb-3">
                  <!-- Search Bar di dalam kartu -->
                  <div class="col-12 col-lg">
                    <div class="input-group input-group-sm w-100" style="max-width: 420px;">
                      <span class="input-group-text"><i class="bi bi-search"></i></span>
                      <input type="text" class="form-control" v-model="searchQueries[store.name]" placeholder="Cari data di dalam tabel...">
                    </div>
                  </div>
                  <div class="col-12 col-lg-auto text-lg-end">
                    <div class="d-grid d-lg-inline-flex">
                      <button class="btn btn-sm btn-outline-danger" @click="clearStoreConfirm(store.name)">
                        <i class="bi bi-eraser-fill me-1"></i> Kosongkan Data Ini
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Tampilan Khusus untuk SYNC_KOIN -->
                <div v-if="store.name.startsWith('SYNC_KOIN_')" class="table-responsive" style="max-height: 60vh;">
                  <table class="table table-sm table-bordered table-hover small">
                    <thead class="table-dark">
                      <tr>
                        <th>NO</th>
                        <th>CEX</th>
                        <th>NAMA KOIN</th>
                        <th>TICKER</th>
                        <th>NAMA TOKEN</th>
                        <th>SC TOKEN</th>
                        <th>DES TOKEN</th>
                        <th class="text-center">TRADE</th>
                        <th class="text-center">WD</th>
                        <th class="text-center">DP</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(record, idx) in filteredRecordData" :key="record.id">
                        <td>{{ idx + 1 }}</td>
                        <td>{{ record.cex }}</td>
                        <td>{{ record.nama_koin }}</td>
                        <td class="fw-semibold">{{ record.cex_ticker }}</td>
                        <td>{{ record.nama_token }}</td>
                        <td class="font-monospace text-truncate" style="max-width: 150px;" :title="record.sc_token">{{ record.sc_token }}</td>
                        <td>{{ record.des_token }}</td>
                        <td class="text-center"><span :class="getDbBadgeClass(record.trade)">{{ getDbBadgeLabel(record.trade) }}</span></td>
                        <td class="text-center"><span :class="getDbBadgeClass(record.withdraw)">{{ getDbBadgeLabel(record.withdraw) }}</span></td>
                        <td class="text-center"><span :class="getDbBadgeClass(record.deposit)">{{ getDbBadgeLabel(record.deposit) }}</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Tampilan Khusus untuk KOIN -->
                <div v-else-if="store.name.startsWith('KOIN_')" class="table-responsive" style="max-height: 60vh;">
                  <table class="table table-sm table-bordered table-hover small">
                    <thead class="table-dark">
                      <tr>
                        <th>NO</th>
                        <th>NAMA KOIN</th>
                        <th>NAMA TOKEN</th>
                        <th>TICKER</th>
                        <th>CEX</th>
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
                        <td class="fw-semibold">{{ record.nama_koin }}</td>
                        <td class="fw-semibold">{{ record.nama_token }}</td>
                        <td class="fw-semibold">{{ record.cex_ticker_token }}</td>
                        <td class="fw-semibold">{{ record.cex_name }}</td>
                        <td class="font-monospace text-truncate" style="max-width: 150px;" :title="record.sc_token">{{ record.sc_token }}</td>
                        <td>{{ record.des_token }}</td>
                        <td class="text-center"><span :class="getDbBadgeClass(record.cex_withdraw_status)">{{ getDbBadgeLabel(record.cex_withdraw_status) }}</span></td>
                        <td class="text-center"><span :class="getDbBadgeClass(record.cex_deposit_status)">{{ getDbBadgeLabel(record.cex_deposit_status) }}</span></td>
                        <td class="fw-semibold">{{ record.nama_pair }}</td>
                        <td class="font-monospace text-truncate" style="max-width: 150px;" :title="record.sc_pair">{{ record.sc_pair }}</td>
                        <td>{{ record.des_pair }}</td>
                        <td class="text-center"><span :class="getDbBadgeClass(record.cex_pair_withdraw_status)">{{ getDbBadgeLabel(record.cex_pair_withdraw_status) }}</span></td>
                        <td class="text-center"><span :class="getDbBadgeClass(record.cex_pair_deposit_status)">{{ getDbBadgeLabel(record.cex_pair_deposit_status) }}</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Tampilan Khusus untuk RIWAYAT_AKSI -->
                <div v-else-if="store.name === 'RIWAYAT_AKSI'" class="table-responsive" style="max-height: 60vh;">
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
                <div v-else-if="store.name.startsWith('SETTING_') || store.name.startsWith('ASET_') || store.name === 'RIWAYAT_MODAL'" class="overflow-auto" style="max-height: 60vh;">
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
                <div v-else class="overflow-auto" style="max-height: 60vh;">
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
        <div v-if="filteredStores.length === 0" class="card card-body text-center text-muted py-4">
          <i class="bi bi-inbox fs-3"></i> <p class="mb-0 mt-2">Tidak ada tabel yang cocok dengan pencarian.</p>
        </div>
      </div>

      <!-- Modal Restore -->
      <div v-if="showRestoreModal" class="modal fade show d-block" style="background: rgba(0,0,0,0.5);" @click.self="showRestoreModal = false" tabindex="-1">
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
              <button type="button" class="btn btn-sm btn-outline-danger" @click="showRestoreModal = false">Batal</button>
              <button type="button" class="btn btn-sm btn-success" @click="restoreDB" :disabled="!restoreFileData">
                <i class="bi bi-upload"></i> Restore Sekarang
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};
