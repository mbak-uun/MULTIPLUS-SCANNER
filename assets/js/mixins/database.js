// assets/js/mixins/database.js
// Mixin untuk mengelola fungsionalitas menu Database

const databaseMixin = {
  data() {
    return {
      dbInfo: {
        totalStores: 0,
        // totalRecords tidak lagi dihitung di sini
        // dbInfo sekarang hanya berisi ringkasan untuk daftar store
        stores: []
      },
      restoreFileData: null,
    };
  },
  methods: {
    /**
     * Menghitung ukuran perkiraan dari sebuah objek dalam bytes.
     * @param {any} object - Objek yang akan dihitung.
     * @returns {number} - Ukuran dalam bytes.
     */
    estimateObjectSize(object) {
      return new TextEncoder().encode(JSON.stringify(object)).length;
    },

    async loadDatabaseInfo() {
      if (this.$root.dbStatus !== 'success') {
        this.showToast('Database tidak aktif.', 'danger');
        return;
      }

      this.$root.isLoading = true;
      this.$root.loadingText = 'Memuat info database...';

      try {
        const storeNames = DB.getAllStoreNames();
        const storesInfo = [];
        let totalRecords = 0; // Deklarasikan variabel untuk menghitung total record

        for (const name of storeNames) {
          const count = await DB.countRecords(name);
          const allData = await DB.getAllData(name);
          const size = this.formatBytes(this.estimateObjectSize(allData));
          storesInfo.push({ name, count, size });
          totalRecords += count; // Tambahkan jumlah record dari store ini ke total
        }

        this.dbInfo = {
          totalStores: storeNames.length,
          totalRecords,
          stores: storesInfo.sort((a, b) => a.name.localeCompare(b.name))
        };

      } catch (error) {
        console.error('Gagal memuat info database:', error);
        this.showToast('Gagal memuat info database.', 'danger');
      } finally {
        this.$root.isLoading = false;
      }
    },

    async backupDB() {
      this.showToast('Memulai proses backup...', 'info');
      try {
        const backupData = await DB.backupDatabase();
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `multiplus_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('Backup database berhasil diunduh.', 'success');
      } catch (error) {
        console.error('Gagal melakukan backup:', error);
        this.showToast('Gagal melakukan backup database.', 'danger');
      }
    },

    handleRestoreFile(event) {
      const file = event.target.files[0];
      if (!file) {
        this.restoreFileData = null;
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          this.restoreFileData = JSON.parse(e.target.result);
          this.showToast('File backup siap untuk di-restore.', 'info');
        } catch (error) {
          this.showToast('File backup tidak valid (bukan format JSON).', 'danger');
          this.restoreFileData = null;
        }
      };
      reader.readAsText(file);
    },

    async restoreDB() {
      if (!this.restoreFileData) {
        this.showToast('Pilih file backup terlebih dahulu.', 'warning');
        return;
      }
      if (confirm('Anda yakin ingin me-restore database? Semua data saat ini akan ditimpa!')) {
        this.$root.isLoading = true;
        this.$root.loadingText = 'Me-restore database...';
        try {
          await DB.restoreDatabase(this.restoreFileData);
          this.showToast('Database berhasil di-restore. Muat ulang halaman...', 'success');
          setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
          console.error('Gagal me-restore database:', error);
          this.showToast('Gagal me-restore database.', 'danger');
          this.$root.isLoading = false;
        }
      }
    },

    async confirmDeleteDB() {
      if (prompt('Ini akan menghapus SEMUA data aplikasi. Ketik "HAPUS" untuk konfirmasi.') === 'HAPUS') {
        this.$root.isLoading = true;
        this.$root.loadingText = 'Menghapus database...';
        try {
          await DB.deleteDatabase();
          this.showToast('Database berhasil dihapus. Muat ulang halaman...', 'success');
          setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
          console.error('Gagal menghapus database:', error);
          this.showToast('Gagal menghapus database.', 'danger');
          this.$root.isLoading = false;
        }
      } else {
        this.showToast('Penghapusan dibatalkan.', 'info');
      }
    },

    // Method clearStoreConfirm dipindahkan ke komponen karena lebih relevan dengan UI
  }
};