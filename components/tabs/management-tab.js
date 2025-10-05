// components/tabs/management-tab.js
// Komponen Vue untuk Tab Manajemen Koin

const ID_NUMBER_FORMAT = new Intl.NumberFormat('id-ID');

const ManagementTab = {
  name: 'ManagementTab',
  emits: ['show-toast', 'show-add-token-modal', 'import-tokens', 'export-tokens'],
  mixins: [filterMixin], // Gunakan filter mixin

  data() {
    return {
      tokens: [],

      // Modal states
      showDeleteModal: false,
      tokenToDelete: null,
      showAddModal: false,
      showEditModal: false,
      editingToken: null,

      // Add/Edit form data
      formData: {
        selectedPairType: '',
        selectedDex: [],
        dexModals: {},
        nonData: { symbol: '', sc: '', des: 18 },
        tokenData: { name: '', ticker: '', sc: '', decimals: 18 },
        selectedCex: [],
        cexConfig: {}
      }
    };
  },

  computed: {
    activeChain() {
      return this.$root.activeChain;
    },
    // REVISI: Gunakan `filters` yang reaktif dari root, bukan `filterSettings` yang statis.
    filters() {
      return this.$root.filters;
    },
    // REVISI: Ambil dan set searchQuery dari root component
    searchQuery: {
      get() { return this.$root.searchQuery; },
      set(value) { this.$root.searchQuery = value; }
    },
    columnCount() {
      // NO, TOKEN, EXCHANGER, DEX, ACTION
      return 5;
    },

    // Computed untuk modal
    config() {
      return this.$root.config || {};
    },
    activeCEXs() {
      return this.$root.activeCEXs || [];
    },
    availablePairOptions() {
      const chainConf = this.config.CHAINS?.[this.activeChain];
      if (!chainConf || !chainConf.PAIR_DEXS) return [];
      return Object.entries(chainConf.PAIR_DEXS).map(([key, info]) => ({
        key,
        symbol: info.SYMBOL_PAIR,
        address: info.SC_ADDRESS_PAIR,
        decimals: Number(info.DECIMALS_PAIR ?? 18)
      }));
    },
    availableDexOptions() {
      return Object.keys(this.config.DEXS || {}).map(dexKey => ({
        key: dexKey,
        name: dexKey.toUpperCase(),
        color: this.config.DEXS[dexKey]?.WARNA || '#0d6efd'
      }));
    },
    isNonPair() {
      return this.formData.selectedPairType === 'NON';
    },
    selectedPairInfo() {
      if (this.isNonPair) return null;
      const pair = this.availablePairOptions.find(p => p.key === this.formData.selectedPairType);
      return pair || null;
    },
  },

  methods: {
    // Helper untuk mendapatkan CEX utama dari sebuah token
    getTokenPrimaryCEX(token) {
      const cexList = this.getTokenCEXList(token);
      return cexList.length > 0 ? cexList[0] : null;
    },
    getDexLeft(token, dexKey) {
      return (token.dex && token.dex[dexKey] && token.dex[dexKey].left) || '0';
    },
    getDexRight(token, dexKey) {
      return (token.dex && token.dex[dexKey] && token.dex[dexKey].right) || '0';
    },
    getContractEntries(token) {
      if (!token || typeof token !== 'object') return [];
      return Object.keys(token)
        .filter(key => key.startsWith('sc_') && token[key])
        .map(key => {
          const decimalsKey = key.replace('sc_', 'des_');
          return {
            key,
            label: key.replace('sc_', '').toUpperCase(),
            address: token[key],
            decimals: token[decimalsKey]
          };
        });
    },
    getPrimaryCexInfo(token) {
      const key = this.getTokenPrimaryCEX(token);
      if (!key) return null;
      return {
        key,
        label: key.toUpperCase(),
        status: this.getTokenCexStatus(token, key)
      };
    },
    // Memuat semua token dari semua chain di IndexedDB
    async loadTokensFromDB() {
      if (!this.activeChain) return;
      console.log(`Memuat token untuk tab manajemen (Chain: ${this.activeChain})...`);
      
      let chainsToLoad = [];
      if (this.activeChain === 'multi') {
        chainsToLoad = this.$root.activeChains;
      } else if (this.activeChain) {
        chainsToLoad = [this.activeChain];
      } else {
        this.tokens = [];
        return;
      }

      let allTokens = [];
      for (const chainKey of chainsToLoad) {
        const storeName = DB.getStoreNameByChain('KOIN', chainKey);
        const chainTokens = await DB.getAllData(storeName) || [];
        // Filter record 'DATA_KOIN' dan tambahkan properti 'chain' jika belum ada
        const validTokens = chainTokens.filter(t => t.id !== 'DATA_KOIN').map(t => ({ ...t, chain: t.chain || chainKey.toUpperCase() }));
        allTokens.push(...validTokens);
      }

      this.tokens = allTokens;
      console.log(`Total ${this.tokens.length} token dimuat untuk manajemen.`);
    },

    // Mengubah arah pengurutan
    toggleSortDirection() {
      const newDirection = (this.$root.filterSettings.sortDirection || 'asc') === 'desc' ? 'asc' : 'desc';
      this.$root.filterSettings.sortDirection = newDirection;
    },
    // Menandai/menghapus token sebagai favorit
    async toggleTokenFavorit(token) {
      const currentFavorite = token.isFavorite || token.isFavorit || false;
      token.isFavorite = !currentFavorite;
      // Sync field lama untuk backward compatibility
      if (token.isFavorit !== undefined) {
        token.isFavorit = token.isFavorite;
      }
      const storeName = DB.getStoreNameByChain('KOIN', token.chain);
      await DB.saveData(storeName, token);

      await this.logAction('TOGGLE_FAVORITE', {
        tokenName: token.nama_koin || token.from,
        tokenTicker: token.nama_token,
        chain: token.chain,
        isFavorite: token.isFavorite
      });

      this.$emit('show-toast', `${token.nama_token || token.from} ${token.isFavorite ? 'ditambahkan ke' : 'dihapus dari'} favorit`, 'success');
    },
    // Menghapus token dengan modal konfirmasi
    showDeleteConfirmation(token) {
      this.tokenToDelete = token;
      this.showDeleteModal = true;
    },
    closeDeleteModal() {
      this.showDeleteModal = false;
      this.tokenToDelete = null;
    },
    async confirmDelete() {
      if (!this.tokenToDelete) return;

      const token = this.tokenToDelete;
      const storeName = DB.getStoreNameByChain('KOIN', token.chain);

      try {
        // Delete dari database
        await DB.deleteData(storeName, token.id);

        // Remove dari list
        this.tokens = this.tokens.filter(t => t.id !== token.id);

        // Log aksi dengan pesan yang lebih baik
        const tokenIdentifier = token.nama_koin || token.from;
        await this.logAction('DELETE_TOKEN', {
          message: `Token '${tokenIdentifier}' dihapus dari chain ${token.chain.toUpperCase()}.`,
          chain: token.chain
        });

        this.$emit('show-toast', `Token ${token.nama_koin || token.from} berhasil dihapus.`, 'success');
        this.closeDeleteModal();
      } catch (error) {
        console.error('Error deleting token:', error);
        this.$emit('show-toast', 'Gagal menghapus token.', 'danger');
      }
    },
    // Menampilkan modal untuk menambah token baru
    showAddTokenModal() {
      this.$emit('show-add-token-modal', null); // null berarti mode 'tambah baru'
    },
    // Menampilkan modal untuk mengedit token yang ada
    showEditTokenModal(token) {
      this.$emit('show-add-token-modal', token); // Mengirim data token untuk diedit
    },
    // Badge class untuk status WX/WD
    getTokenCexStatus(token, cexKey) {
      const cexData = token.cex?.[cexKey.toUpperCase()];
      if (!cexData) return { deposit: false, withdraw: false };
      return {
        deposit: cexData.depositToken,
        withdraw: cexData.withdrawToken
      };
    },
    async toggleTokenStatus(tokenId) {
      const tokenIndex = this.tokens.findIndex(t => t.id === tokenId);
      if (tokenIndex === -1) return;

      const token = this.tokens[tokenIndex];
      const originalStatus = token.status;
      const newStatus = !originalStatus;

      // Update state secara optimis
      this.tokens[tokenIndex].status = newStatus;

      // Simpan ke DB
      try {
        const storeName = DB.getStoreNameByChain('KOIN', token.chain);
        // REVISI: Konversi objek reaktif Vue ke objek biasa sebelum menyimpan ke DB
        await DB.saveData(storeName, JSON.parse(JSON.stringify(this.tokens[tokenIndex])));
        this.$emit('show-toast', `Status ${token.nama_koin} ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}.`, 'success');
        // Panggil method root untuk refresh data count
        this.$root.loadCoinsForFilter();
      } catch (error) {
        console.error('Gagal memperbarui status token:', error);
        // Kembalikan jika gagal
        this.tokens[tokenIndex].status = originalStatus;
        this.$emit('show-toast', 'Gagal memperbarui status token.', 'danger');
      }
    },
    async toggleTokenFavorit(tokenId) {
      const tokenIndex = this.tokens.findIndex(t => t.id === tokenId);
      if (tokenIndex === -1) return;

      const token = this.tokens[tokenIndex];
      const originalIsFavorite = token.isFavorite || token.isFavorit || false;
      const newFavoriteStatus = !originalIsFavorite;

      this.tokens[tokenIndex].isFavorite = newFavoriteStatus;
      if (this.tokens[tokenIndex].hasOwnProperty('isFavorit')) {
        this.tokens[tokenIndex].isFavorit = newFavoriteStatus;
      }

      try {
        const storeName = DB.getStoreNameByChain('KOIN', token.chain);
        // REVISI: Konversi objek reaktif Vue ke objek biasa sebelum menyimpan ke DB
        await DB.saveData(storeName, JSON.parse(JSON.stringify(this.tokens[tokenIndex])));
        this.$emit('show-toast', `${token.nama_koin} ${newFavoriteStatus ? 'ditambahkan ke' : 'dihapus dari'} favorit.`, 'success');
        this.$root.loadCoinsForFilter();
      } catch (error) {
        console.error('Gagal memperbarui status favorit:', error);
        this.tokens[tokenIndex].isFavorite = originalIsFavorite;
        if (this.tokens[tokenIndex].hasOwnProperty('isFavorit')) {
          this.tokens[tokenIndex].isFavorit = originalIsFavorite;
        }
        this.$emit('show-toast', 'Gagal memperbarui status favorit.', 'danger');
      }
    },
    getDexEntries(token) {
      if (!token || !token.dex || typeof token.dex !== 'object' || !this.filters.dex) return [];

      // REVISI: Hanya tampilkan DEX yang aktif di token DAN aktif di filter.
      return Object.keys(token.dex)
        .filter(dexKey => {
          const isDexActiveInToken = token.dex[dexKey]?.status !== false;
          const isDexActiveInFilter = this.filters.dex[dexKey] === true;
          return isDexActiveInToken && isDexActiveInFilter;
        })
        .map(dexKey => ({
          key: dexKey,
          name: dexKey.toUpperCase(),
          left: this.getDexLeft(token, dexKey),
          right: this.getDexRight(token, dexKey)
        }));
    },
    formatDexValue(value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return value ?? '0';
      if (Math.abs(numeric) >= 1000) {
        return ID_NUMBER_FORMAT.format(Math.round(numeric));
      }
      return numeric % 1 === 0 ? numeric.toString() : numeric.toFixed(2);
    },

    // Method untuk save filter
    saveFilter(field) {
      this.$root.saveFilterChange(field);
    },

    // ===== MODAL ADD/EDIT METHODS =====
    openAddModal() {
      this.resetFormData();
      this.formData.selectedPairType = this.availablePairOptions[0]?.key || '';
      this.formData.selectedDex = this.availableDexOptions.map(d => d.key);
      this.availableDexOptions.forEach(dex => {
        this.formData.dexModals[dex.key] = { modalKiri: 100, modalKanan: 100 };
      });
      this.showAddModal = true;
    },
    closeAddModal() {
      this.showAddModal = false;
      this.resetFormData();
    },
    openEditModal(token) {
      this.editingToken = { ...token };
      // Populate form dengan data token yang ada
      this.formData.tokenData = {
        name: token.nama_koin,
        ticker: token.nama_token,
        sc: token.sc_token,
        decimals: token.des_token
      };
      this.formData.selectedPairType = token.nama_pair || this.availablePairOptions[0]?.key;
      this.formData.selectedDex = Object.keys(token.dex || {});
      this.formData.dexModals = {};
      Object.keys(token.dex || {}).forEach(dexKey => {
        this.formData.dexModals[dexKey] = {
          modalKiri: token.dex[dexKey]?.left || 100,
          modalKanan: token.dex[dexKey]?.right || 100
        };
      });
      this.formData.selectedCex = this.getTokenCEXList(token);
      this.formData.cexConfig = {};
      // Populate CEX config
      this.formData.selectedCex.forEach(cexKey => {
        const cexKeyUpper = cexKey.toUpperCase();
        const cexData = token.cex?.[cexKeyUpper] || {};
        this.formData.cexConfig[cexKey] = {
          feeWD: cexData.feeWDToken || 0,
          deposit: cexData.depositToken || false,
          withdraw: cexData.withdrawToken || false
        };
      });
      this.showEditModal = true;
    },
    closeEditModal() {
      this.showEditModal = false;
      this.editingToken = null;
      this.resetFormData();
    },
    resetFormData() {
      this.formData = {
        selectedPairType: '',
        selectedDex: [],
        dexModals: {},
        nonData: { symbol: '', sc: '', des: 18 },
        tokenData: { name: '', ticker: '', sc: '', decimals: 18 },
        selectedCex: [],
        cexConfig: {}
      };
    },
    toggleDexSelection(dexKey) {
      const index = this.formData.selectedDex.indexOf(dexKey);
      if (index > -1) {
        this.formData.selectedDex.splice(index, 1);
      } else {
        this.formData.selectedDex.push(dexKey);
        if (!this.formData.dexModals[dexKey]) {
          this.formData.dexModals[dexKey] = { modalKiri: 100, modalKanan: 100 };
        }
      }
    },
    updateDexModal(dexKey, field, value) {
      if (!this.formData.dexModals[dexKey]) {
        this.formData.dexModals[dexKey] = { modalKiri: 100, modalKanan: 100 };
      }
      this.formData.dexModals[dexKey][field] = value;
    },
    toggleCexSelection(cexKey) {
      console.log(`[Toggle CEX] ${cexKey}, current selected:`, this.formData.selectedCex);
      const index = this.formData.selectedCex.indexOf(cexKey);
      if (index > -1) {
        this.formData.selectedCex.splice(index, 1);
        delete this.formData.cexConfig[cexKey];
        console.log(`[Toggle CEX] Removed ${cexKey}`);
      } else {
        this.formData.selectedCex.push(cexKey);
        if (!this.formData.cexConfig[cexKey]) {
          this.formData.cexConfig[cexKey] = {
            feeWD: 0,
            deposit: false,
            withdraw: false
          };
        }
        console.log(`[Toggle CEX] Added ${cexKey}`, this.formData.cexConfig[cexKey]);
      }
      console.log(`[Toggle CEX] New selected:`, this.formData.selectedCex);
    },
    updateCexConfig(cexKey, field, value) {
      if (!this.formData.cexConfig[cexKey]) {
        this.formData.cexConfig[cexKey] = { feeWD: 0, deposit: false, withdraw: false };
      }
      this.formData.cexConfig[cexKey][field] = value;
      console.log(`[CEX Config Update] ${cexKey}.${field} = ${value}`, this.formData.cexConfig[cexKey]);
    },
    async saveNewToken() {
      if (!this.formData.tokenData.name || !this.formData.tokenData.sc) {
        this.$emit('show-toast', 'Nama token dan smart contract wajib diisi.', 'warning');
        return;
      }

      const storeName = DB.getStoreNameByChain('KOIN', this.activeChain);
      const now = new Date().toISOString();

      // Build pair info
      let pairInfo;
      if (this.isNonPair) {
        pairInfo = {
          symbol: this.formData.nonData.symbol,
          address: this.formData.nonData.sc,
          decimals: Number(this.formData.nonData.des || 18)
        };
      } else {
        const pair = this.availablePairOptions.find(p => p.key === this.formData.selectedPairType);
        pairInfo = {
          symbol: pair.symbol,
          address: pair.address,
          decimals: Number(pair.decimals || 18)
        };
      }

      // Build DEX config
      const dexConfig = this.formData.selectedDex.reduce((acc, dexKey) => {
        const modal = this.formData.dexModals[dexKey] || { modalKiri: 100, modalKanan: 100 };
        acc[dexKey] = {
          status: true,
          left: Number(modal.modalKiri || 0),
          right: Number(modal.modalKanan || 0)
        };
        return acc;
      }, {});

      // Build CEX config
      const cexConfig = this.formData.selectedCex.reduce((acc, cexKey) => {
        const config = this.formData.cexConfig[cexKey] || { feeWD: 0, deposit: false, withdraw: false };
        const cexKeyUpper = cexKey.toUpperCase();
        console.log(`[Add Token] Building CEX config for ${cexKey} -> ${cexKeyUpper}:`, config);
        acc[cexKeyUpper] = {
          status: true,
          feeWDToken: Number(config.feeWD || 0),
          feeWDPair: null,
          depositToken: Boolean(config.deposit),
          withdrawToken: Boolean(config.withdraw),
          depositPair: false,
          withdrawPair: false
        };
        return acc;
      }, {});

      console.log('[Add Token] Final CEX config:', cexConfig);
      console.log('[Add Token] Selected CEX:', this.formData.selectedCex);
      console.log('[Add Token] CEX Config form data:', this.formData.cexConfig);

      const record = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        chain: this.activeChain.toUpperCase(),
        nama_koin: this.formData.tokenData.name.toUpperCase(),
        nama_token: this.formData.tokenData.ticker.toUpperCase(),
        sc_token: this.formData.tokenData.sc,
        des_token: Number(this.formData.tokenData.decimals || 18),
        nama_pair: pairInfo.symbol,
        sc_pair: pairInfo.address,
        des_pair: pairInfo.decimals,
        status: true,
        isFavorite: false,
        cex: cexConfig,
        dex: dexConfig,
        createdAt: now,
        updatedAt: now
      };

      try {
        await DB.saveData(storeName, record);
        // Log aksi dengan pesan yang lebih baik
        await this.logAction('ADD_TOKEN', {
            message: `Token '${record.nama_koin}' ditambahkan ke chain ${record.chain.toUpperCase()}.`,
            chain: record.chain
        });

        this.tokens.push(record);
        this.$emit('show-toast', `Token ${record.nama_koin} berhasil ditambahkan.`, 'success');
        this.closeAddModal();
      } catch (error) {
        console.error('Error saving token:', error);
        this.$emit('show-toast', 'Gagal menyimpan token.', 'danger');
      }
    },
    async saveEditToken() {
      if (!this.editingToken) return;

      const storeName = DB.getStoreNameByChain('KOIN', this.activeChain);
      const now = new Date().toISOString();

      // Build pair info
      let pairInfo;
      if (this.isNonPair) {
        pairInfo = {
          symbol: this.formData.nonData.symbol,
          address: this.formData.nonData.sc,
          decimals: Number(this.formData.nonData.des || 18)
        };
      } else {
        const pair = this.availablePairOptions.find(p => p.key === this.formData.selectedPairType);
        pairInfo = {
          symbol: pair.symbol,
          address: pair.address,
          decimals: Number(pair.decimals || 18)
        };
      }

      // Build DEX config
      const dexConfig = this.formData.selectedDex.reduce((acc, dexKey) => {
        const modal = this.formData.dexModals[dexKey] || { modalKiri: 100, modalKanan: 100 };
        acc[dexKey] = {
          status: true,
          left: Number(modal.modalKiri || 0),
          right: Number(modal.modalKanan || 0)
        };
        return acc;
      }, {});

      // Build CEX config
      const cexConfig = this.formData.selectedCex.reduce((acc, cexKey) => {
        const config = this.formData.cexConfig[cexKey] || { feeWD: 0, deposit: false, withdraw: false };
        const cexKeyUpper = cexKey.toUpperCase();
        console.log(`[Edit Token] Building CEX config for ${cexKey} -> ${cexKeyUpper}:`, config);
        acc[cexKeyUpper] = {
          status: true,
          feeWDToken: Number(config.feeWD || 0),
          feeWDPair: null,
          depositToken: Boolean(config.deposit),
          withdrawToken: Boolean(config.withdraw),
          depositPair: false,
          withdrawPair: false
        };
        return acc;
      }, {});

      console.log('[Edit Token] Final CEX config:', cexConfig);
      console.log('[Edit Token] Selected CEX:', this.formData.selectedCex);
      console.log('[Edit Token] CEX Config form data:', this.formData.cexConfig);

      const updatedToken = {
        ...this.editingToken,
        nama_koin: this.formData.tokenData.name.toUpperCase(),
        nama_token: this.formData.tokenData.ticker.toUpperCase(),
        sc_token: this.formData.tokenData.sc,
        des_token: Number(this.formData.tokenData.decimals || 18),
        nama_pair: pairInfo.symbol,
        sc_pair: pairInfo.address,
        des_pair: pairInfo.decimals,
        cex: cexConfig,
        dex: dexConfig,
        updatedAt: now
      };

      try {
        await DB.saveData(storeName, updatedToken);
        // Log aksi dengan pesan yang lebih baik
        await this.logAction('EDIT_TOKEN', {
            message: `Token '${updatedToken.nama_koin}' di chain ${updatedToken.chain.toUpperCase()} telah diubah.`,
            chain: updatedToken.chain
        });

        // Update in list
        const index = this.tokens.findIndex(t => t.id === updatedToken.id);
        if (index > -1) {
          this.tokens.splice(index, 1, updatedToken);
        }

        this.$emit('show-toast', `Token ${updatedToken.nama_koin} berhasil diupdate.`, 'success');
        this.closeEditModal();
      } catch (error) {
        console.error('Error updating token:', error);
        this.$emit('show-toast', 'Gagal mengupdate token.', 'danger');
      }
    },

    // ===== CSV EXPORT/IMPORT =====
    async exportToCSV() {
      if (this.filteredTokens.length === 0) {
        this.$emit('show-toast', 'Tidak ada data untuk di-export.', 'warning');
        return;
      }

      try {
        // Header CSV
        const headers = ['Nama Koin', 'Ticker', 'Smart Contract', 'Decimals', 'Chain', 'Pair', 'CEX', 'DEX', 'DEX Modals', 'Status', 'Favorite'];

        // Data rows
        const rows = this.filteredTokens.map(token => {
          // Build DEX modals string
          const dexModals = Object.keys(token.dex || {}).map(dexKey => {
            const left = token.dex[dexKey]?.left || 0;
            const right = token.dex[dexKey]?.right || 0;
            return `${dexKey}:${left}|${right}`;
          }).join(';');

          return [
            token.nama_koin || '',
            token.nama_token || '',
            token.sc_token || '',
            token.des_token || '',
            token.chain || '',
            token.nama_pair || '',
            this.getTokenCEXList(token).join(';'),
            Object.keys(token.dex || {}).join(';'),
            dexModals,
            token.status ? 'Active' : 'Inactive',
            (token.isFavorite || token.isFavorit) ? 'Yes' : 'No'
          ];
        });

        // Combine headers and rows
        const csvContent = [headers, ...rows]
          .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
          .join('\n');

        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const filename = `tokens_${this.activeChain}_${new Date().toISOString().slice(0, 10)}.csv`;

        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Log aksi dengan pesan yang lebih baik
        await this.logAction('EXPORT_CSV', {
            message: `Export ${this.filteredTokens.length} token ke CSV dari chain ${this.activeChain.toUpperCase()}.`,
            chain: this.activeChain
        });

        this.$emit('show-toast', `${this.filteredTokens.length} token berhasil di-export ke ${filename}`, 'success');
      } catch (error) {
        console.error('Error exporting CSV:', error);
        this.$emit('show-toast', 'Gagal export CSV.', 'danger');
      }
    },
    async importFromCSV() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv';

      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          const text = await file.text();
          const lines = text.split('\n').filter(line => line.trim());

          if (lines.length < 2) {
            this.$emit('show-toast', 'File CSV kosong atau tidak valid.', 'warning');
            return;
          }

          // Skip header
          const dataLines = lines.slice(1);
          const storeName = DB.getStoreNameByChain('KOIN', this.activeChain);
          let imported = 0;
          let errors = 0;

          for (const line of dataLines) {
            try {
              const cols = line.split(',').map(col => col.replace(/^"|"$/g, '').replace(/""/g, '"'));

              if (cols.length < 6) continue; // Skip invalid rows

              const [namaKoin, ticker, sc, decimals, chain, pair, cex, dex, dexModals, status, favorite] = cols;

              // Build basic record
              const record = {
                id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                chain: (chain || this.activeChain).toUpperCase(),
                nama_koin: namaKoin.toUpperCase(),
                nama_token: ticker.toUpperCase(),
                sc_token: sc,
                des_token: Number(decimals || 18),
                nama_pair: pair,
                sc_pair: '',
                des_pair: 18,
                status: status === 'Active',
                isFavorite: favorite === 'Yes',
                cex: {},
                dex: {},
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };

              // Parse DEX with modals
              if (dexModals) {
                // Format: "dex1:100|200;dex2:150|250"
                dexModals.split(';').forEach(dexEntry => {
                  if (dexEntry) {
                    const [dexKey, modals] = dexEntry.split(':');
                    if (dexKey && modals) {
                      const [left, right] = modals.split('|').map(v => Number(v) || 100);
                      record.dex[dexKey.toLowerCase()] = {
                        status: true,
                        left,
                        right
                      };
                    }
                  }
                });
              } else if (dex) {
                // Fallback untuk format lama (tanpa modal)
                dex.split(';').forEach(dexKey => {
                  if (dexKey) {
                    record.dex[dexKey.toLowerCase()] = {
                      status: true,
                      left: 100,
                      right: 100
                    };
                  }
                });
              }

              await DB.saveData(storeName, record);
              imported++;
            } catch (err) {
              console.error('Error importing row:', err);
              errors++;
            }
          }

          // Log aksi dengan pesan yang lebih baik
          await this.logAction('IMPORT_CSV', {
              message: `Import ${imported} token dari CSV ke chain ${this.activeChain.toUpperCase()}. Gagal: ${errors}.`,
              chain: this.activeChain
          });

          await this.loadTokensFromDB();
          this.$emit('show-toast', `Import selesai: ${imported} token berhasil, ${errors} gagal.`, 'success');
        } catch (error) {
          console.error('Error reading CSV:', error);
          this.$emit('show-toast', 'Gagal membaca file CSV.', 'danger');
        }
      };

      input.click();
    },

    // ===== ACTION LOGGING =====
    async logAction(actionType, details) {
      try {
        const storeName = 'RIWAYAT_AKSI'; // Gunakan nama tabel global yang benar
        const record = {
          timestamp: new Date().toISOString(),
          action: actionType,
          status: 'success', // Tambahkan status default
          message: details.message || `${actionType} action performed`, // Fallback message
          // Gabungkan detail ke dalam record utama
          ...details
        };
        await DB.saveData(storeName, record);
      } catch (error) {
        console.error('Error logging action:', error);
      }
    }
  },

  watch: {
    activeChain: {
      immediate: true,
      handler() { this.loadTokensFromDB(); }
    }
  },
  activated() {
    this.loadTokensFromDB(); // Muat ulang data saat tab diaktifkan kembali
  },

  template: `
    <div class="management-tab">
      <!-- Management Toolbar -->
      <div class="card card-body p-2 mb-3">
        <div class="row g-2 align-items-center">
          <!-- Grup Kiri: Judul, Pencarian, Filter -->
          <div class="col-12 col-xl">
            <div class="row g-2 align-items-center">
              <div class="col-12 col-md-auto">
                <h6 class="mb-0 d-flex align-items-center gap-2">
                  <i class="bi bi-kanban"></i>
                  Koin Manajemen
                </h6>
              </div>
              <div class="col-12 col-sm-auto">
                <div class="input-group input-group-sm w-100" style="min-width: 180px; max-width: 240px;">
                  <span class="input-group-text">
                    <i class="bi bi-search"></i>
                  </span>
                  <input type="text" class="form-control" placeholder="Cari token..." v-model="searchQuery">
                </div>
              </div>
              <div class="col-12 col-sm-auto">
                <label class="form-check form-check-inline mb-0 align-items-center d-flex gap-1">
                  <input class="form-check-input" type="checkbox" v-model="filters.favoritOnly" @change="saveFilter('favoritOnly')">
                  <span class="small fw-semibold text-warning"><i class="bi bi-star-fill"></i> Favorite</span>
                </label>
              </div>
              <div class="col-12 col-sm-auto">
                <span class="badge bg-light text-dark border w-100 text-center">
                  Total: {{ filteredTokens.length }}
                </span>
              </div>
            </div>
          </div>
          <!-- Grup Kanan: Tombol Aksi -->
          <div class="col-12 col-xl-auto">
            <div class="d-grid d-sm-inline-flex gap-2 justify-content-sm-end">
             <button class="btn btn-sm btn-success" @click="openAddModal">
                <i class="bi bi-plus-circle-fill"></i> Add Token
              </button>
              <div class="btn-group" role="group">
                <button class="btn btn-sm btn-info" @click="importFromCSV">
                  <i class="bi bi-upload"></i> Import CSV
                </button>
                <button class="btn btn-sm btn-danger" @click="exportToCSV">
                  <i class="bi bi-download"></i> Export CSV
                </button>
              </div>

             
            </div>
          </div>
        </div>
      </div>

      <!-- Tabel Manajemen Koin -->
      <div class="table-responsive">
        <table class="table table-sm table-hover align-middle management-table">
          <thead class="sticky-top">
            <tr class="text-center text-uppercase small" :style="$root.getColorStyles('chain', $root.activeChain, 'solid')">
              <th class="text-nowrap">No</th>
              <th class="text-nowrap" @click="toggleSortDirection" style="cursor: pointer;">
                Token / Pair
                <i class="bi ms-1" :class="{
                  'bi-arrow-down': $root.filterSettings?.sortDirection === 'desc',
                  'bi-arrow-up': $root.filterSettings?.sortDirection === 'asc'
                }"></i>
              </th>
              <th class="text-nowrap">Exchanger</th>
              <th class="text-nowrap">Dex & Modal</th>
              <th class="text-nowrap" style="width: 150px;">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredTokens.length === 0">
              <td :colspan="columnCount" class="text-center text-muted py-5">
                <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                <span>Tidak ada data token yang cocok dengan filter.</span>
              </td>
            </tr>
            <tr v-for="(token, index) in filteredTokens" :key="token.id">
              <td class="text-center fw-semibold">{{ index + 1 }}</td>
              <td>
                <div class="d-flex flex-column">
                  <div class="fw-bold">
                    <span class="text-primary">{{ token.nama_koin || token.from }} [ {{ token.nama_token }} / {{ token.nama_pair }} ]</span>
                  </div>
                  <div class="small text-muted">
                    {{ token.sc_token }}
                  </div>
                </div>
              </td>
              <td v-if="getPrimaryCexInfo(token)" class="text-center">
                <div class="d-flex flex-column align-items-center gap-1">
                  <div v-for="cexKey in getTokenCEXList(token)" :key="cexKey" class="d-flex align-items-center gap-2">
                    <span class="badge" :style="$root.getColorStyles('cex', cexKey, 'soft')">
                      {{ cexKey.toUpperCase() }}
                    </span>
                    <div class="small">
                      <span class="badge" :class="getTokenCexStatus(token, cexKey).deposit ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'">
                        {{ getTokenCexStatus(token, cexKey).deposit ? 'DP' : 'DX' }}
                      </span>
                      <span class="badge" :class="getTokenCexStatus(token, cexKey).withdraw ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'">
                        {{ getTokenCexStatus(token, cexKey).withdraw ? 'WD' : 'WX' }}
                      </span>
                    </div>
                  </div>
                </div>
              </td>
              <td v-else class="text-center text-muted">-</td>
              <td class="text-center">
                <div v-if="getDexEntries(token).length" class="d-flex flex-wrap gap-2 justify-content-center">
                  <span v-for="dex in getDexEntries(token)" :key="dex.key" class="badge" :style="$root.getColorStyles('dex', dex.key, 'soft')">
                    {{ dex.name }}
                    <span class="text-muted small">({{ formatDexValue(dex.left) }}|{{ formatDexValue(dex.right) }})</span>
                  </span>
                </div>
                <span v-else class="text-muted small">-</span>
              </td>
              <td class="text-center">
                <div class="btn-group btn-group-sm">
                  <div class="form-check form-switch form-check-inline me-2" title="Aktifkan/Nonaktifkan Token">
                    <input class="form-check-input" type="checkbox" role="switch" :id="'status-' + token.id"
                      :checked="Boolean(token.status)" @change="toggleTokenStatus(token.id)">
                  </div>
                  <button class="btn btn-sm btn-icon" :class="(token.isFavorite || token.isFavorit) ? 'btn-warning' : 'btn-outline-secondary'"
                    @click="toggleTokenFavorit(token.id)" title="Toggle Favorit">
                    <i class="bi" :class="(token.isFavorite || token.isFavorit) ? 'bi-star-fill' : 'bi-star'"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-primary btn-icon" @click="openEditModal(token)" title="Edit Token">
                    <i class="bi bi-pencil-fill"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-danger btn-icon" @click="showDeleteConfirmation(token)" title="Hapus Token">
                    <i class="bi bi-trash-fill"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Modal Delete Confirmation -->
      <div v-if="showDeleteModal && tokenToDelete" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-danger text-white">
              <h5 class="modal-title">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>Konfirmasi Hapus Token
              </h5>
              <button type="button" class="btn-close btn-close-white" @click="closeDeleteModal"></button>
            </div>
            <div class="modal-body">
              <p class="mb-3">Anda yakin ingin menghapus token berikut?</p>
              <div class="card bg-light">
                <div class="card-body">
                  <table class="table table-sm mb-0">
                    <tbody>
                      <tr>
                        <th class="text-end" style="width: 35%;">Nama Token:</th>
                        <td><strong>{{ tokenToDelete.nama_koin || tokenToDelete.from }}</strong></td>
                      </tr>
                      <tr>
                        <th class="text-end">Ticker:</th>
                        <td>{{ tokenToDelete.nama_token }}</td>
                      </tr>
                      <tr>
                        <th class="text-end">Pair:</th>
                        <td>{{ tokenToDelete.nama_pair }}</td>
                      </tr>
                      <tr>
                        <th class="text-end">Chain:</th>
                        <td><span class="badge" :style="$root.getColorStyles('chain', tokenToDelete.chain, 'soft')">{{ tokenToDelete.chain }}</span></td>
                      </tr>
                      <tr>
                        <th class="text-end">CEX:</th>
                        <td>{{ getTokenCEXList(tokenToDelete).join(', ') || '-' }}</td>
                      </tr>
                      <tr>
                        <th class="text-end">DEX:</th>
                        <td>{{ Object.keys(tokenToDelete.dex || {}).join(', ') || '-' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <p class="text-danger mt-3 mb-0 small">
                <i class="bi bi-info-circle me-1"></i>
                Data yang dihapus tidak dapat dikembalikan!
              </p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-sm btn-outline-danger" @click="closeDeleteModal">Batal</button>
              <button type="button" class="btn btn-sm btn-danger" @click="confirmDelete">
                <i class="bi bi-trash-fill me-1"></i>Hapus Token
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Add Token -->
      <div v-if="showAddModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
        <div class="modal-dialog modal-dialog-centered modal-md modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header py-2">
              <h5 class="modal-title fs-5">
                <i class="bi bi-plus-circle me-2"></i>Tambah Token Baru
              </h5>
              <button type="button" class="btn-close" @click="closeAddModal"></button>
            </div>
            <div class="modal-body p-3">
              <!-- Token Info -->
              <div class="card mb-2">
                <div class="card-header py-2">
                  <h6 class="mb-0 fs-6"><i class="bi bi-coin me-1"></i>Informasi Token</h6>
                </div>
                <div class="card-body p-2">
                  <div class="row g-2">
                    <div class="col-md-6">
                      <label class="form-label small fw-semibold">Nama Token <span class="text-danger">*</span></label>
                      <input type="text" class="form-control form-control-sm" v-model="formData.tokenData.name" placeholder="Contoh: Bitcoin">
                    </div>
                    <div class="col-md-6">
                      <label class="form-label small fw-semibold">Ticker <span class="text-danger">*</span></label>
                      <input type="text" class="form-control form-control-sm" v-model="formData.tokenData.ticker" placeholder="Contoh: BTC" style="text-transform: uppercase;">
                    </div>
                    <div class="col-md-8">
                      <label class="form-label small fw-semibold">Smart Contract <span class="text-danger">*</span></label>
                      <input type="text" class="form-control form-control-sm" v-model="formData.tokenData.sc" placeholder="0x...">
                    </div>
                    <div class="col-md-4">
                      <label class="form-label small fw-semibold">Decimals</label>
                      <input type="number" class="form-control form-control-sm" v-model.number="formData.tokenData.decimals" min="0" max="32">
                    </div>
                  </div>
                </div>
              </div>

              <!-- Pair Config -->
              <div class="card mb-2">
                <div class="card-header py-2">
                  <h6 class="mb-0 fs-6"><i class="bi bi-arrow-left-right me-1"></i>Konfigurasi Pair</h6>
                </div>
                <div class="card-body p-2">
                  <div class="row g-2">
                    <div class="col-12">
                      <label class="form-label small fw-semibold">Pilih Pair</label>
                      <select class="form-select form-select-sm" v-model="formData.selectedPairType">
                        <option v-for="pair in availablePairOptions" :key="pair.key" :value="pair.key">{{ pair.symbol }}</option>
                        <option value="NON">NON (Input Manual)</option>
                      </select>
                    </div>
                    <div class="col-12" v-if="isNonPair">
                      <div class="bg-info bg-opacity-10 border border-info rounded p-2">
                        <div class="row g-2">
                          <div class="col-md-4">
                            <label class="form-label small fw-semibold">Symbol Pair</label>
                            <input type="text" class="form-control form-control-sm" v-model="formData.nonData.symbol" placeholder="USDT" style="text-transform: uppercase;">
                          </div>
                          <div class="col-md-4">
                            <label class="form-label small fw-semibold">SC Pair</label>
                            <input type="text" class="form-control form-control-sm" v-model="formData.nonData.sc" placeholder="0x...">
                          </div>
                          <div class="col-md-4">
                            <label class="form-label small fw-semibold">Decimals</label>
                            <input type="number" class="form-control form-control-sm" v-model.number="formData.nonData.des" min="0" max="32">
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- CEX Selection -->
              <div class="card mb-2">
                <div class="card-header py-2">
                  <h6 class="mb-0 fs-6"><i class="bi bi-building me-1"></i>Pilih CEX</h6>
                </div>
                <div class="card-body p-3">
                  <div class="d-flex flex-wrap gap-2">
                    <label v-for="cex in activeCEXs" :key="cex"
                           class="filter-item"
                           :class="{checked: formData.selectedCex.includes(cex)}"
                           :style="$root.getColorStyles('cex', cex, formData.selectedCex.includes(cex) ? 'solid' : 'soft')">
                      <input type="checkbox"
                             :checked="formData.selectedCex.includes(cex)"
                             @change="toggleCexSelection(cex)">
                      <span>{{ cex.toUpperCase() }}</span>
                    </label>
                  </div>
                </div>
              </div>

              <!-- DEX Selection -->
              <div class="card mb-2">
                <div class="card-header py-2">
                  <h6 class="mb-0 fs-6"><i class="bi bi-grid me-1"></i>Pilih DEX</h6>
                </div>
                <div class="card-body p-2">
                  <div class="row g-2">
                    <div class="col-md-6" v-for="dex in availableDexOptions" :key="dex.key">
                      <div class="card h-100" :class="{ 'border-primary': formData.selectedDex.includes(dex.key) }">
                        <div class="card-body p-2">
                          <div class="form-check mb-2">
                            <input class="form-check-input" type="checkbox" :id="'dex-add-' + dex.key"
                                   :checked="formData.selectedDex.includes(dex.key)"
                                   @change="toggleDexSelection(dex.key)">
                            <label class="form-check-label fw-semibold small" :for="'dex-add-' + dex.key" :style="{ color: dex.color }">
                              {{ dex.name }}
                            </label>
                          </div>
                          <div v-if="formData.selectedDex.includes(dex.key)" class="row g-1">
                            <div class="col-6">
                              <div class="input-group input-group-sm">
                                <span class="input-group-text">$</span>
                                <input type="number" class="form-control"
                                       :value="formData.dexModals[dex.key]?.modalKiri || 100"
                                       @input="updateDexModal(dex.key, 'modalKiri', parseInt($event.target.value) || 100)">
                              </div>
                            </div>
                            <div class="col-6">
                              <div class="input-group input-group-sm">
                                <span class="input-group-text">$</span>
                                <input type="number" class="form-control"
                                       :value="formData.dexModals[dex.key]?.modalKanan || 100"
                                       @input="updateDexModal(dex.key, 'modalKanan', parseInt($event.target.value) || 100)">
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer py-2">
              <button type="button" class="btn btn-sm btn-danger" @click="closeAddModal">Batal</button>
              <button type="button" class="btn btn-sm btn-success" @click="saveNewToken">
                <i class="bi bi-save me-1"></i>Simpan Token
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Edit Token -->
      <div v-if="showEditModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="bi bi-pencil me-2"></i>Edit Token
              </h5>
              <button type="button" class="btn-close" @click="closeEditModal"></button>
            </div>
            <div class="modal-body">
              <!-- Token Info -->
              <div class="card mb-3">
                <div class="card-header">
                  <h6 class="mb-0"><i class="bi bi-coin me-1"></i>Informasi Token</h6>
                </div>
                <div class="card-body p-3">
                  <div class="row g-3">
                    <div class="col-md-6">
                      <label class="form-label small fw-semibold">Nama Token</label>
                      <input type="text" class="form-control form-control-sm" v-model="formData.tokenData.name">
                    </div>
                    <div class="col-md-6">
                      <label class="form-label small fw-semibold">Ticker</label>
                      <input type="text" class="form-control form-control-sm" v-model="formData.tokenData.ticker" style="text-transform: uppercase;">
                    </div>
                    <div class="col-md-8">
                      <label class="form-label small fw-semibold">Smart Contract</label>
                      <input type="text" class="form-control form-control-sm" v-model="formData.tokenData.sc" placeholder="0x...">
                    </div>
                    <div class="col-md-4">
                      <label class="form-label small fw-semibold">Decimals</label>
                      <input type="number" class="form-control form-control-sm" v-model.number="formData.tokenData.decimals" min="0" max="32">
                    </div>
                  </div>
                </div>
              </div>

              <!-- Pair Config -->
              <div class="card mb-3">
                <div class="card-header">
                  <h6 class="mb-0"><i class="bi bi-arrow-left-right me-1"></i>Konfigurasi Pair</h6>
                </div>
                <div class="card-body p-3">
                  <div class="row g-3">
                    <div class="col-12">
                      <label class="form-label small fw-semibold">Pilih Pair</label>
                      <select class="form-select form-select-sm" v-model="formData.selectedPairType">
                        <option v-for="pair in availablePairOptions" :key="pair.key" :value="pair.key">{{ pair.symbol }}</option>
                        <option value="NON">NON (Input Manual)</option>
                      </select>
                    </div>
                    <div class="col-12" v-if="isNonPair">
                      <div class="bg-info bg-opacity-10 border border-info rounded p-3">
                        <div class="row g-3">
                          <div class="col-md-4">
                            <label class="form-label small fw-semibold">Symbol Pair</label>
                            <input type="text" class="form-control form-control-sm" v-model="formData.nonData.symbol" placeholder="USDT" style="text-transform: uppercase;">
                          </div>
                          <div class="col-md-4">
                            <label class="form-label small fw-semibold">SC Pair</label>
                            <input type="text" class="form-control form-control-sm" v-model="formData.nonData.sc" placeholder="0x...">
                          </div>
                          <div class="col-md-4">
                            <label class="form-label small fw-semibold">Decimals</label>
                            <input type="number" class="form-control form-control-sm" v-model.number="formData.nonData.des" min="0" max="32">
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- CEX Selection -->
              <div class="card mb-3">
                <div class="card-header">
                  <h6 class="mb-0"><i class="bi bi-building me-1"></i>Pilih CEX</h6>
                </div>
                <div class="card-body p-3">
                  <div class="row">
                    <div class="col-md-6" v-for="cex in activeCEXs" :key="cex">
                      <div class="card mb-2" :class="{ 'border-primary': formData.selectedCex.includes(cex) }">
                        <div class="card-body p-2">
                          <div class="form-check mb-2">
                            <input class="form-check-input" type="checkbox" :id="'cex-edit-' + cex"
                                   :checked="formData.selectedCex.includes(cex)"
                                   @change="toggleCexSelection(cex)">
                            <label class="form-check-label fw-semibold small" :for="'cex-edit-' + cex" :style="$root.getColorStyles('cex', cex, 'solid')">
                              {{ cex.toUpperCase() }}
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- DEX Selection -->
              <div class="card mb-3">
                <div class="card-header">
                  <h6 class="mb-0"><i class="bi bi-grid me-1"></i>Pilih DEX</h6>
                </div>
                <div class="card-body p-3">
                  <div class="row">
                    <div class="col-md-6" v-for="dex in availableDexOptions" :key="dex.key">
                      <div class="card mb-2" :class="{ 'border-primary': formData.selectedDex.includes(dex.key) }">
                        <div class="card-body p-2">
                          <div class="form-check mb-2">
                            <input class="form-check-input" type="checkbox" :id="'dex-edit-' + dex.key"
                                   :checked="formData.selectedDex.includes(dex.key)"
                                   @change="toggleDexSelection(dex.key)">
                            <label class="form-check-label fw-semibold small" :for="'dex-edit-' + dex.key" :style="{ color: dex.color }">
                              {{ dex.name }}
                            </label>
                          </div>
                          <div v-if="formData.selectedDex.includes(dex.key)" class="row g-1">
                            <div class="col-6">
                              <div class="input-group input-group-sm">
                                <span class="input-group-text">$</span>
                                <input type="number" class="form-control"
                                       :value="formData.dexModals[dex.key]?.modalKiri || 100"
                                       @input="updateDexModal(dex.key, 'modalKiri', parseInt($event.target.value) || 100)">
                              </div>
                            </div>
                            <div class="col-6">
                              <div class="input-group input-group-sm">
                                <span class="input-group-text">$</span>
                                <input type="number" class="form-control"
                                       :value="formData.dexModals[dex.key]?.modalKanan || 100"
                                       @input="updateDexModal(dex.key, 'modalKanan', parseInt($event.target.value) || 100)">
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-sm btn-outline-danger" @click="closeEditModal">Batal</button>
              <button type="button" class="btn btn-sm btn-success" @click="saveEditToken">
                <i class="bi bi-save me-1"></i>Update Token
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};
