// components/menus/history.js
// Vue Component untuk Menu History

const HistoryMenu = {
  name: 'HistoryMenu',

  data() {
    return {
      riwayat: [],
      searchQuery: '',
      startDate: '',
      endDate: '',
      currentPage: 1,
      itemsPerPage: 20,
      isLoading: true,
    };
  },

  computed: {
    // Get repository from container
    historyRepo() {
      return window.AppContainer.get('historyRepository');
    },

    formatters() {
      return window.Formatters;
    },
    filteredRiwayat() {
      let filtered = this.riwayat;

      // Filter by search query
      if (this.searchQuery) {
        const lowerCaseQuery = this.searchQuery.toLowerCase();
        filtered = filtered.filter(item => {
          const message = (item.message || '').toLowerCase();
          const action = (item.action || '').toLowerCase();
          return message.includes(lowerCaseQuery) || action.includes(lowerCaseQuery);
        });
      }

      // Filter by start date
      if (this.startDate) {
        try {
          const start = new Date(this.startDate);
          start.setHours(0, 0, 0, 0); // Set to start of the day
          filtered = filtered.filter(item => new Date(item.timestamp) >= start);
        } catch (e) { console.error("Invalid start date"); }
      }

      // Filter by end date
      if (this.endDate) {
        try {
          const end = new Date(this.endDate);
          end.setHours(23, 59, 59, 999); // Set to end of the day
          filtered = filtered.filter(item => new Date(item.timestamp) <= end);
        } catch (e) { console.error("Invalid end date"); }
      }

      return filtered;
    },
    totalPages() {
      return Math.ceil(this.filteredRiwayat.length / this.itemsPerPage);
    },
    paginatedRiwayat() {
      const start = (this.currentPage - 1) * this.itemsPerPage;
      const end = start + this.itemsPerPage;
      return this.filteredRiwayat.slice(start, end);
    },
    columnCount() {
      return 5;
    }
  },

  methods: {
    async loadRiwayat() {
      this.isLoading = true;
      try {
        // ✅ REFACTORED: Using repository instead of direct DB access
        this.riwayat = await this.historyRepo.getRecent(1000); // Get last 1000 records
      } catch (error) {
        console.error('Gagal memuat riwayat aksi:', error);
        this.$root.showToast('Gagal memuat riwayat.', 'danger');
      } finally {
        this.isLoading = false;
      }
    },

    async deleteAksi(aksi) {
      if (confirm(`Anda yakin ingin menghapus log ini? "${aksi.message}"`)) {
        try {
          // ✅ REFACTORED: Using repository
          await this.historyRepo.delete('RIWAYAT_AKSI', aksi.id);
          this.riwayat = this.riwayat.filter(item => item.id !== aksi.id);
          this.$root.showToast('Log berhasil dihapus.', 'success');
        } catch (error) {
          console.error('Gagal menghapus aksi:', error);
          this.$root.showToast('Gagal menghapus log.', 'danger');
        }
      }
    },

    async clearAllRiwayat() {
      if (confirm('Anda yakin ingin menghapus SEMUA riwayat aksi? Aksi ini tidak dapat dibatalkan.')) {
        try {
          // ✅ REFACTORED: Using repository
          await this.historyRepo.clearAllHistory();
          this.riwayat = [];
          this.$root.showToast('Semua riwayat berhasil dihapus.', 'success');
        } catch (error) {
          console.error('Gagal membersihkan riwayat:', error);
          this.$root.showToast('Gagal membersihkan riwayat.', 'danger');
        }
      }
    },

    formatTimestamp(timestamp) {
      // ✅ REFACTORED: Using Formatters utility
      return this.formatters.datetime(timestamp);
    },

    getStatusBadgeClass(status) {
      switch (status) {
        case 'success': return 'bg-success';
        case 'danger':
        case 'error': return 'bg-danger';
        case 'warning': return 'bg-warning text-dark';
        case 'info': return 'bg-info text-dark';
        default: return 'bg-secondary';
      }
    }
  },

  watch: {
    // Reset ke halaman pertama jika filter berubah
    searchQuery() {
      this.currentPage = 1;
    },
    startDate() {
      this.currentPage = 1;
    },
    endDate() {
      this.currentPage = 1;
    },
    // ... (watcher lama)
  },

  watch: {
    // Tunggu sampai database di app utama siap
    '$root.dbStatus': {
      handler(newStatus) {
        if (newStatus === 'success') {
          this.loadRiwayat();
        }
      },
      immediate: true // Jalankan handler segera saat komponen dibuat
    }
  },

  template: `
    <div>
      <!-- REFACTORED: History Toolbar with Bootstrap -->
      <div class="card card-body mb-3">
        <div class="row g-2 align-items-center">
          <!-- Grup Kiri: Judul dan Total -->
          <div class="col-12 col-lg d-flex align-items-center gap-3">
            <h5 class="mb-0">
              <i class="bi bi-clock-history"></i>
              Riwayat Aksi
            </h5>
            <span class="badge bg-light text-dark border">
              Total: {{ filteredRiwayat.length }} Data Riwayat
            </span>
          </div>

          <!-- Grup Kanan: Pencarian dan Tombol Aksi -->
          <div class="col-12 col-lg-auto">
            <div class="row g-2 align-items-center justify-content-lg-end">
              <div class="col-12 col-sm-auto">
                <div class="input-group input-group-sm">
                  <span class="input-group-text small">Dari</span>
                  <input type="date" class="form-control" v-model="startDate" title="Tanggal Mulai">
                </div>
              </div>
              <div class="col-12 col-sm-auto">
                <div class="input-group input-group-sm">
                  <span class="input-group-text small">Sampai</span>
                  <input type="date" class="form-control" v-model="endDate" title="Tanggal Akhir">
                </div>
              </div>
              <div class="col-12 col-sm">
                <div class="input-group input-group-sm w-100" style="max-width: 260px;">
                  <span class="input-group-text"><i class="bi bi-search"></i></span>
                  <input type="text" class="form-control" placeholder="Cari riwayat..." v-model="searchQuery">
                </div>
              </div>

              <div class="col-12 col-sm-auto">
                <div class="d-grid d-sm-inline-flex">
                  <button class="btn btn-sm btn-danger" @click="clearAllRiwayat" title="Hapus Semua Riwayat">
                    <i class="bi bi-trash"></i> <span class="d-inline d-sm-inline">Kosongkan Riwayat</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


      <div class="table-responsive" style="max-height: calc(100vh - 250px);">
        <table class="table table-hover table-sm align-middle">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Aksi</th>
              <th>Status</th>
              <th>Pesan</th>
              <th class="text-end">Tindakan</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td :colspan="columnCount" class="text-center p-5"><span class="spinner-border spinner-border-sm"></span> Memuat data...</td>
            </tr>
            <tr v-else-if="filteredRiwayat.length === 0">
              <td :colspan="columnCount" class="text-center p-5 text-muted">
                <i class="bi bi-inbox fs-2 d-block mb-2"></i>
                Tidak ada data riwayat.
              </td>
            </tr>
            <tr v-for="item in paginatedRiwayat" :key="item.id">
              <td class="small text-muted">{{ formatTimestamp(item.timestamp) }}</td>
              <td class="text-uppercase"><span class="badge bg-primary bg-opacity-75">{{ item.action }}</span></td>
              <td><span class="badge" :class="getStatusBadgeClass(item.status)">{{ item.status }}</span></td>
              <td>{{ item.message }}</td>
              <td class="text-end">
                <button class="btn btn-sm btn-outline-danger" @click="deleteAksi(item)" title="Hapus Log">
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Controls -->
      <div v-if="totalPages > 1" class="d-flex justify-content-between align-items-center mt-3">
        <span class="text-muted small">
          Halaman {{ currentPage }} dari {{ totalPages }}
        </span>
        <nav>
          <ul class="pagination pagination-sm mb-0">
            <li class="page-item" :class="{ disabled: currentPage === 1 }">
              <a class="page-link" href="#" @click.prevent="currentPage--">Sebelumnya</a>
            </li>
            <li class="page-item" :class="{ disabled: currentPage === totalPages }">
              <a class="page-link" href="#" @click.prevent="currentPage++">Berikutnya</a>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  `
};