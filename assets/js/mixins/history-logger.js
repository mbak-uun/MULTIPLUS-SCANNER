// assets/js/mixins/history-logger.js
// Mixin untuk logging semua aksi ke RIWAYAT_AKSI

const historyLoggerMixin = {
  methods: {
    /**
     * Log aksi ke tabel RIWAYAT_AKSI
     * @param {string} action - Nama aksi (UPPERCASE dengan underscore)
     * @param {string} status - Status: 'success', 'error', 'warning', 'info'
     * @param {string} message - Pesan detail
     * @param {object} details - Data tambahan (optional)
     */
    async logHistory(action, status, message, details = null) {
      try {
        const logEntry = {
          timestamp: new Date().toISOString(),
          action: action.toUpperCase(),
          status: status.toLowerCase(),
          message: message,
          details: details,
          chain: this.$root?.activeChain || 'unknown',
          user_agent: navigator.userAgent
        };

        await DB.saveData('RIWAYAT_AKSI', logEntry);
        // console.log(`📝 [HISTORY LOG] ${action}: ${message}`);
      } catch (error) {
        // console.error('❌ Gagal menyimpan log riwayat:', error);
      }
    },

    /**
     * Log untuk Settings
     */
    async logSettings(action, status, message, details = null) {
      const actionMap = {
        'save_global': 'SAVE_SETTINGS_GLOBAL',
        'update_global': 'UPDATE_SETTINGS_GLOBAL',
        'save_chain': 'SAVE_SETTINGS_CHAIN',
        'update_chain': 'UPDATE_SETTINGS_CHAIN'
      };
      await this.logHistory(actionMap[action] || action, status, message, details);
    },

    /**
     * Log untuk Database Operations
     */
    async logDatabase(action, status, message, details = null) {
      const actionMap = {
        'backup': 'BACKUP_DATABASE',
        'restore': 'RESTORE_DATABASE',
        'delete_store': 'DELETE_STORE',
        'clear_store': 'CLEAR_STORE',
        'export': 'EXPORT_DATABASE',
        'import': 'IMPORT_DATABASE'
      };
      await this.logHistory(actionMap[action] || action, status, message, details);
    },

    /**
     * Log untuk Management Tab
     */
    async logManagement(action, status, message, details = null) {
      const actionMap = {
        'add_coin': 'ADD_COIN',
        'edit_coin': 'EDIT_COIN',
        'delete_coin': 'DELETE_COIN',
        'import_csv': 'IMPORT_CSV_COINS',
        'export_csv': 'EXPORT_CSV_COINS',
        'bulk_delete': 'BULK_DELETE_COINS'
      };
      await this.logHistory(actionMap[action] || action, status, message, details);
    },

    /**
     * Log untuk Sync Tab
     */
    async logSync(action, status, message, details = null) {
      const actionMap = {
        'fetch_cex': 'FETCH_CEX_DATA',
        'save_sync': 'SAVE_SYNC_DATA',
        'import_to_management': 'IMPORT_SYNC_TO_MANAGEMENT',
        'clear_sync': 'CLEAR_SYNC_DATA',
        'auto_sync': 'AUTO_SYNC_CEX'
      };
      await this.logHistory(actionMap[action] || action, status, message, details);
    },

    /**
     * Log untuk Wallet Tab
     */
    async logWallet(action, status, message, details = null) {
      const actionMap = {
        'check_cex': 'CHECK_CEX_WALLET',
        'update_cex': 'UPDATE_CEX_DATA',
        'check_coin': 'CHECK_COIN_IN_CEX'
      };
      await this.logHistory(actionMap[action] || action, status, message, details);
    },

    /**
     * Log untuk Portfolio
     */
    async logPortfolio(action, status, message, details = null) {
      const actionMap = {
        'fetch_balance': 'FETCH_PORTFOLIO_BALANCE',
        'save_modal': 'SAVE_MODAL_HISTORY',
        'update_balance': 'UPDATE_PORTFOLIO_BALANCE'
      };
      await this.logHistory(actionMap[action] || action, status, message, details);
    },

    /**
     * Helper untuk format message dengan count
     */
    formatCountMessage(action, count, itemName = 'item') {
      const actionText = {
        'add': 'Menambahkan',
        'edit': 'Mengubah',
        'delete': 'Menghapus',
        'import': 'Mengimpor',
        'export': 'Mengekspor',
        'sync': 'Menyinkronkan',
        'fetch': 'Mengambil'
      };
      return `${actionText[action] || action} ${count} ${itemName}`;
    }
  }
};
