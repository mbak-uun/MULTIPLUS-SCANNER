// components/menus/history.js
// Vue Component untuk Menu History

const HistoryMenu = {
  name: 'HistoryMenu',

  data() {
    return {
      riwayat: [],
      searchQuery: '',
      isLoading: true,
    };
  },

  computed: {
    filteredRiwayat() {
      if (!this.searchQuery) {
        return this.riwayat;
      }
      const lowerCaseQuery = this.searchQuery.toLowerCase();
      return this.riwayat.filter(item => {
        const message = (item.message || '').toLowerCase();
        const action = (item.action || '').toLowerCase();
        return message.includes(lowerCaseQuery) || action.includes(lowerCaseQuery);
      });
    },
    columnCount() {
      return 5;
    }
  },

  methods: {
    async loadRiwayat() {
      this.isLoading = true;
      try {
        const data = await DB.getAllData('RIWAYAT_AKSI');
        // Urutkan dari yang terbaru
        this.riwayat = data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
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
          await DB.deleteData('RIWAYAT_AKSI', aksi.id);
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
          await DB.clearStore('RIWAYAT_AKSI');
          this.riwayat = [];
          this.$root.showToast('Semua riwayat berhasil dihapus.', 'success');
        } catch (error) {
          console.error('Gagal membersihkan riwayat:', error);
          this.$root.showToast('Gagal membersihkan riwayat.', 'danger');
        }
      }
    },

    formatTimestamp(timestamp) {
      if (!timestamp) return '-';
      return new Date(timestamp).toLocaleString('id-ID');
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
      <div class="card card-soft mb-3">
        <div class="card-body p-2">
          <div class="row g-2 align-items-center">
            <div class="col">
              <input type="text" class="form-control" placeholder="Cari riwayat..." v-model="searchQuery">
            </div>
            <div class="col-auto">
              <button class="btn btn-outline-danger" @click="clearAllRiwayat" title="Hapus Semua Riwayat">
                <i class="bi bi-trash me-1"></i> Hapus Semua
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="table-responsive">
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
            <tr v-for="item in filteredRiwayat" :key="item.id">
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
    </div>
  `
};
