// components/tabs/sync-tab.js
// Tab Sinkronisasi Koin dengan dukungan cache IndexedDB dan import ke manajemen

// REFACTOR: Logika dirombak total untuk alur kerja yang lebih cerdas dan otomatis.

const SyncTab = {
  name: 'SyncTab',
  emits: ['show-toast'],

  data() {
    return {
      syncCache: {},
      syncData: [],
      cexDataStatus: {},
      selectedCexFilters: [],
      syncSelectedTokens: [], // array of token.id
      syncSelectAll: false,
      syncSearchQuery: '',
      syncStatusFilter: 'all', // 'all', 'new'


      showImportModal: false,
      importConfig: {
        selectedPairType: '',        // Key pair yang dipilih atau 'NON'
        selectedDex: [],              // Array DEX yang dipilih ['uniswap', 'pancakeswap']
        dexModals: {},                // Object untuk modal per DEX: { uniswap: { modalKiri: 1000, modalKanan: 100 } }
        nonData: {                    // Data untuk input manual NON
          symbol: '',                 // Symbol token (contoh: BTC)
          sc: '',                     // Smart contract address
          des: 18                     // Decimals (default 18)
        },
        isSubmitting: false
      }
    };
  },

  computed: {
    // =================================================================
    // Computed Properties - Dependencies & UI State
    // =================================================================

    activeCEXs() {
      return this.$root.activeCEXs || [];
    },
    activeChain() {
      return this.$root.activeChain;
    },
    config() {
      return this.$root.config || {};
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
      // REVISI: Ambil daftar DEX yang aktif dari SETTING_GLOBAL, bukan dari filter chain.
      const dexGlobalConfig = this.$root.globalSettings?.config_dex;
      const activeDexKeys = dexGlobalConfig
        ? Object.keys(dexGlobalConfig).filter(key => dexGlobalConfig[key]?.status === true)
        : [];

      // Console log untuk debugging
      console.log('[SyncTab] DEX aktif dari SETTING_GLOBAL:', activeDexKeys);

      // Bangun opsi berdasarkan DEX yang aktif
      return activeDexKeys.map(dexKey => ({
          key: dexKey,
          name: dexKey.toUpperCase(),
          color: this.config.DEXS?.[dexKey]?.WARNA || '#0d6efd'
      }));
    },

    // =================================================================
    // Computed Properties - Data & Filtering
    // =================================================================
    filteredSyncData() {
      let result = Array.isArray(this.syncData) ? [...this.syncData] : [];

      const query = this.syncSearchQuery.trim().toLowerCase();
      if (query) {
        result = result.filter(item => {
          const fields = [
            item.nama_koin,
            item.nama_token,
            item.sc_token,
            item.name,
            item.chain
          ];
          return fields.filter(Boolean).some(field => String(field).toLowerCase().includes(query));
        });
      }

      if (this.syncStatusFilter !== 'all') {
        if (this.syncStatusFilter === 'new') {
          result = result.filter(item => item.isNew);
        }
      }

      return result;
    },

    displayedTotal() {
      return this.filteredSyncData.length;
    },

    newCoinCount() {
      return this.syncData.filter(token => token.isNew).length;
    },

    selectedTokenCount() {
      return this.syncSelectedTokens.length;
    },

    // =================================================================
    // Computed Properties - Button States
    // =================================================================
    isLoading() {
      return this.$root.isLoading;
    },
    loadingMessage() {
      return this.$root.loadingText;
    },
    canSyncCex() {
      return this.selectedCexFilters.length > 0 && !this.isLoading;
    },
    canManageSelection() {
      return this.selectedTokenCount > 0 && !this.isLoading; // Tetap menggunakan isLoading dari computed
    },

    // =================================================================
    // Computed Properties - Modal Import
    // =================================================================
    isNonPair() {
      return this.importConfig.selectedPairType === 'NON';
    },

    nonInputState() {
      if (!this.isNonPair) return { valid: true, missing: [] };

      const missing = [];

      // Validasi symbol
      if (!String(this.importConfig.nonData.symbol || '').trim()) {
        missing.push('symbol');
      }

      // Validasi smart contract
      if (!String(this.importConfig.nonData.sc || '').trim()) {
        missing.push('sc');
      }

      // Validasi decimals
      const decimals = this.importConfig.nonData.des;
      if (decimals === '' || decimals === null || decimals === undefined || Number.isNaN(Number(decimals))) {
        missing.push('des');
      }

      return {
        valid: missing.length === 0,
        missing
      };
    },

    selectedPairInfo() {
      if (this.isNonPair) return null;

      const pair = this.availablePairOptions.find(p => p.key === this.importConfig.selectedPairType);
      return pair || null;
    },

    pairDisplayInfo() {
      if (this.isNonPair) {
        return {
          isNon: true,
          available: false,
          symbol: 'NON',
          sc: '-',
          decimals: '-'
        };
      }

      const pairConfig = this.selectedPairInfo;

      if (pairConfig) {
        return {
          available: true,
          symbol: pairConfig.symbol || this.importConfig.selectedPairType,
          sc: pairConfig.address || '-',
          decimals: pairConfig.decimals ?? 18
        };
      }

      return {
        available: false,
        symbol: this.importConfig.selectedPairType || '?',
        sc: '-',
        decimals: '?'
      };
    },

    selectedCexSummary() {
      const selectedTokens = this.getSelectedTokenObjects();
      const cexSet = new Set(selectedTokens.map(t => this.normalizeCex(t.cex)));
      return Array.from(cexSet).join(', ') || '-';
    },

    dexByCategory() {
      // Group DEX by category (untuk sekarang semua kategori DEX)
      return {
        DEX: this.availableDexOptions
      };
    },

    dexModalSummary() {
      // Summary DEX + Modal untuk ringkasan
      if (!this.importConfig || !Array.isArray(this.importConfig.selectedDex)) {
        return '';
      }

      return this.importConfig.selectedDex.map(dexKey => {
        const modal = this.importConfig.dexModals[dexKey];
        if (!modal) {
          return `${dexKey}: $0 | $0`;
        }
        return `${dexKey}: $${modal.modalKiri || 0} | $${modal.modalKanan || 0}`;
      }).join('\n');
    }
  },

  watch: {
    // REFACTOR: Menggunakan `activated()` hook untuk re-inisialisasi saat tab aktif.
    // Watcher pada `activeChain` tidak lagi diperlukan karena `activated` lebih andal.
    /*
    activeChain: {
      immediate: true,
      // Handler ini akan dipanggil saat komponen dibuat dan setiap kali activeChain berubah
      async handler() {
        await this.initialize();
      }
    }
    */
  },

  methods: {
    getColorStyles(type, key, variant) {
      return this.$root.getColorStyles(type, key, variant);
    },

    // =================================================================
    // Utility & Formatting Methods
    // =================================================================

    normalizeCex(cex) {
      return String(cex || '').toUpperCase();
    },

    normalizeFlag(value) {
      if (typeof value === 'boolean') return value;
      if (value === null || value === undefined) return false;
      const text = String(value).trim().toUpperCase();
      return ['ON', 'YES', 'TRUE', 'AKTIF', 'Y', '1'].includes(text);
    },

    hasDeposit(item) {
      if (Array.isArray(item.networks) && item.networks.length) {
        return item.networks.some(net => this.normalizeFlag(net.deposit));
      }
      return this.normalizeFlag(item.deposit);
    },

    hasWithdraw(item) {
      if (Array.isArray(item.networks) && item.networks.length) {
        return item.networks.some(net => this.normalizeFlag(net.withdraw));
      }
      return this.normalizeFlag(item.withdraw);
    },

    hasTrade(item) {
      if (Array.isArray(item.networks) && item.networks.length) {
        return item.networks.some(net => this.normalizeFlag(net.trade));
      }
      return this.normalizeFlag(item.trade);
    },

    chainLabel(item) {
      if (item.chain) return String(item.chain).toUpperCase();
      if (item.network) return String(item.network).toUpperCase();
      if (Array.isArray(item.networks) && item.networks.length) {
        return String(item.networks[0].network || '').toUpperCase();
      }
      return this.activeChain ? this.activeChain.toUpperCase() : '-';
    },

    statusPillClass(flag) {
      return this.normalizeFlag(flag) ? 'status-pill status-pill--on' : 'status-pill status-pill--off';
    },
    statusPillLabel(flag, fallback = 'OFF') {
      return this.normalizeFlag(flag) ? 'ON' : fallback;
    },

    formatDecimal(value) {
      if (value === undefined || value === null || value === '') return '-';
      const num = Number(value);
      if (Number.isNaN(num)) return String(value);
      return num.toLocaleString('id-ID', { maximumFractionDigits: 8 });
    },

    formatPrice(value) {
      if (value === undefined || value === null || value === '') return '-';
      const num = Number(value);
      if (Number.isNaN(num)) return String(value);
      if (Math.abs(num) >= 1) {
        return num.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
      }
      return num.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
    },

    buildTokenKey(token) {
      const cex = this.normalizeCex(token.cex);
      const chain = this.chainLabel(token);
      const contract = (token.sc_token || token.contract || '').toLowerCase();
      const ticker = String(token.nama_token || token.symbol || '').toLowerCase();
      return [cex, chain, contract || ticker].join('|');
    },

    // REFACTOR: Fungsi ini ditambahkan kembali untuk memperbaiki error.
    // Fungsi ini memformat ticker sesuai aturan CEX dari config.json.
    _formatCexTicker(cex, baseTicker) {
      if (!cex || !baseTicker) return (baseTicker || '').toUpperCase();

      const cexConfig = this.config.CEX?.[cex.toUpperCase()];
      const tradeUrl = cexConfig?.URLS?.TRADE_TOKEN;

      if (!tradeUrl) return `${baseTicker.toUpperCase()}USDT`; // Fallback jika URL tidak ada

      // Ekstrak format dari URL
      if (tradeUrl.includes('{token}_USDT')) {
        return `${baseTicker.toUpperCase()}_USDT`;
      }
      if (tradeUrl.includes('{token}-USDT')) {
        return `${baseTicker.toUpperCase()}-USDT`;
      }
      if (tradeUrl.includes('{token}IDR')) {
        return `${baseTicker.toUpperCase()}IDR`;
      }
      // Default ke format tanpa pemisah (paling umum untuk USDT)
      return `${baseTicker.toUpperCase()}USDT`;
    },

    // =================================================================
    // Core Initialization & Data Loading Logic
    // =================================================================

    async initialize() {
      if (!this.activeChain || this.$root.isLoading) return;
      this.$root.isLoading = true;
      this.$root.loadingText = 'Inisialisasi data sinkronisasi...';

      try {
        await this.loadCacheFromDB();
        await this.ensureCacheAvailability();
        await this.updateSyncDataView();
      } finally {
        this.$root.isLoading = false;
      }
    },

    // Langkah 1: Muat semua data dari IndexedDB ke `syncCache`
    async loadCacheFromDB(options = { resetFilters: false }) {
      const storeName = DB.getStoreNameByChain('SYNC_KOIN', this.activeChain);
      let records = [];
      try {
        records = await DB.getAllData(storeName);
      } catch (error) {
        console.warn('Gagal membaca cache sinkronisasi:', error);
      }

      const grouped = {};
      records.forEach(raw => {
        const cex = this.normalizeCex(raw.cex);
        if (!grouped[cex]) grouped[cex] = [];
        grouped[cex].push({
          ...raw,
          cex,
          chain: raw.chain || this.activeChain?.toUpperCase(),
          isNew: !!raw.isNew
        });
      });

      this.syncCache = grouped;
      this.cexDataStatus = this.activeCEXs.reduce((acc, cexKey) => {
        const upper = this.normalizeCex(cexKey);
        const list = grouped[upper] || [];
        acc[upper] = { hasData: list.length > 0, count: list.length };
        return acc;
      }, {});

      // REVISI: Hanya reset filter jika diminta (saat inisialisasi tab).
      // Ini mencegah filter terhapus setelah proses sync manual.
      if (options.resetFilters) {
        this.selectedCexFilters = [];
      }
    },

    // Langkah 2: Auto-fetch JSON untuk CEX yang cache-nya masih kosong
    async ensureCacheAvailability() {
      const cexWithoutData = this.activeCEXs.filter(cex => {
        const status = this.cexDataStatus[this.normalizeCex(cex)];
        return !status || !status.hasData;
      });

      if (cexWithoutData.length === 0) return;

      this.$root.isLoading = true;
      this.$root.loadingText = `Cache kosong, mengambil data awal dari server...`;

      let successCount = 0;
      let errorCount = 0;

      try {
        const remoteData = await this.fetchRemoteJsonData();

        for (const cex of cexWithoutData) {
          try {
            const upperCex = this.normalizeCex(cex);
            // REVISI: Ganti pemanggilan fungsi yang sudah dihapus dengan filter array standar.
            // Ini sesuai dengan struktur JSON baru yang berupa array datar.
            const dataForCex = remoteData.filter(item => this.normalizeCex(item.cex) === upperCex);

            if (dataForCex.length > 0) {
              // Normalisasi data dan simpan
              const normalized = dataForCex.map(item => this._normalizeJsonToken(item, upperCex));
              await this.saveToCache(normalized, { isNew: false });
              successCount++;
              this.$emit('show-toast', `✓ Auto-fetch ${upperCex}: ${dataForCex.length} koin berhasil disimpan`, 'success');
            }
            // else {
            //   this.$emit('show-toast', `⚠ Auto-fetch ${upperCex}: Tidak ada data dari JSON`, 'warning');
            // }
          } catch (cexError) {
            errorCount++;
            this.$emit('show-toast', `✗ Auto-fetch ${cex}: ${cexError.message}`, 'danger');
          }
        }

        if (successCount > 0) {
          this.$emit('show-toast', `Auto-fetch selesai: ${successCount} CEX berhasil, ${errorCount} gagal`, successCount > errorCount ? 'success' : 'warning');
          // REVISI: Setelah auto-fetch selesai, muat ulang cache dari DB
          // untuk memperbarui jumlah koin di UI.
          await this.loadCacheFromDB();
        }
      } catch (error) {
        this.$emit('show-toast', `Auto-fetch gagal: ${error.message}`, 'danger');
      } finally {
        this.$root.isLoading = false;
      }
    },

    // REFACTOR: Metode ini adalah implementasi alur baru.
    // Fetch dari CEX -> Cek & Lengkapi Desimal via Web3 -> Bandingkan dengan KOIN -> Simpan ke SYNC_KOIN.
    async fetchAndMergeCex(cex) {
      const upperCex = this.normalizeCex(cex);
      const syncStoreName = DB.getStoreNameByChain('SYNC_KOIN', this.activeChain);
      const koinStoreName = DB.getStoreNameByChain('KOIN', this.activeChain);

      // Muat data dari SYNC_KOIN (untuk mempertahankan ID) dan KOIN (untuk cek isNew)
      let syncData = [];
      let koinData = [];
      try {
        syncData = await DB.getAllData(syncStoreName);
        koinData = await DB.getAllData(koinStoreName);
      } catch (error) {
        console.warn('Gagal membaca data dari database:', error);
      }

      // Buat Map untuk pencarian cepat
      // Kunci untuk syncData: 'CEX|CHAIN|SC_TOKEN'
      const syncMap = new Map(syncData.map(item => [this.buildTokenKey(item), item]));
      // Kunci untuk koinData: 'CEX|SC_TOKEN'
      const koinMap = new Map(
        koinData
          .filter(c => c.id !== 'DATA_KOIN')
          .map(c => [`${(c.cex_name || '').toUpperCase()}|${(c.sc_token || '').toLowerCase()}`, c])
      );


      // Langkah 1: EXTRACT - Ambil data dari API CEX
      let rawList = [];
      let getPrice = null;
      let hasTrade = null;

      try {
        if (!window.CheckWalletExchanger) {
          throw new Error("Modul CheckWalletExchanger tidak ditemukan.");
        }
        const secrets = this.buildSecretsFromConfig();
        const fetcher = new CheckWalletExchanger(secrets, this.config, window.Http);

        // Fetch semua data detail dari CEX (list, price, trade status)
        rawList = await fetcher.fetchCoinList(upperCex, this.activeChain);
        getPrice = await fetcher.fetchPrices([upperCex]);
        hasTrade = await fetcher.fetchTradeStatus([upperCex]);
      } catch (error) {
        console.error(`Gagal mengambil data remote untuk ${upperCex}:`, error);
        this.$emit('show-toast', `Gagal mengambil data ${upperCex}: ${error.message || error}`, 'danger');
        return;
      }

      const now = new Date().toISOString();
      let processedCount = 0;
      let savedCount = 0;

      // Langkah 2: TRANSFORM & LOAD - Proses setiap koin dari hasil fetch
      for (const remoteItem of rawList) {
        processedCount++;
        this.$root.loadingText = `[${upperCex}] Memproses ${processedCount}/${rawList.length}...`;

        const record = this.normalizeRemoteToken(remoteItem, upperCex);

        // Filter awal: Hanya proses koin yang punya Smart Contract
        if (!record.sc_token) {
          continue;
        }

        // Tambahkan price dan trade status
        record.price = getPrice(upperCex, record.nama_token);
        record.trade = hasTrade(upperCex, record.nama_token);

        // REVISI: Filter utama. Hanya simpan koin yang bisa ditradingkan.
        // Ini mencegah tabel SYNC dipenuhi oleh koin yang tidak relevan.
        if (!record.trade) {
          continue; // Lewati koin ini jika tidak bisa ditradingkan
        }

        // Tambahkan ticker CEX
        record.cex_ticker = this._formatCexTicker(upperCex, record.nama_token);

        // Cek desimal. Jika tidak ada atau 0, coba fetch dari web3.
        if (!record.des_token && record.sc_token) {
          if (window.web3Fetcher) {
            try {
              this.$root.loadingText = `[${upperCex}] Mencari desimal untuk ${record.nama_token}...`;
              record.des_token = await window.web3Fetcher.getDecimals(this.activeChain, record.sc_token);
            } catch (decError) {
              console.warn(`Gagal fetch desimal untuk ${record.nama_token}:`, decError.message);
              record.des_token = 18; // Fallback
            }
          } else {
            record.des_token = 18; // Fallback jika web3Fetcher tidak ada
          }
        }

        // Tentukan status 'isNew' dengan membandingkan ke tabel KOIN
        const koinKey = `${upperCex}|${(record.sc_token || '').toLowerCase()}`;
        record.isNew = !koinMap.has(koinKey);

        // Pertahankan ID dan createdAt dari cache sinkronisasi sebelumnya jika ada
        const syncKey = this.buildTokenKey(record);
        const existingSync = syncMap.get(syncKey);
        if (existingSync) {
          record.id = existingSync.id;
          record.createdAt = existingSync.createdAt;
        } else {
          record.id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
          record.createdAt = now;
        }
        record.updatedAt = now;

        // Simpan ke database SYNC_KOIN
        try {
          await DB.saveData(syncStoreName, record);
          savedCount++;
        } catch (error) {
          console.warn(`Gagal menyimpan token ${record.nama_token} ke SYNC_KOIN:`, error);
        }
      }

      this.$emit('show-toast', `[${upperCex}] Sinkronisasi selesai. ${savedCount} koin disimpan/diperbarui.`, 'success');

      // Muat ulang cache dari database untuk memperbarui UI
      await this.loadCacheFromDB();
    },

    // Helper untuk fetch dari API CEX (menggunakan CheckWalletExchanger)
    normalizeRemoteToken(item, cex) {
      const chain = (item.chain || item.network || this.activeChain || '').toUpperCase();
      const baseTicker = String(item.nama_token || item.symbol || '').replace(/USDT|IDR|BUSD/g, '');
      return {
        ...item,
        cex,
        chain: String(chain),
        nama_koin: String(item.nama_koin || item.name || ''),
        nama_token: baseTicker,
        sc_token: String(item.sc_token || item.sc || item.contract || ''),
        des_token: Number(item.des_token ?? item.des ?? item.decimals ?? 0), // Default 0 agar Web3 fetch terpicu
        feeWD: item.feeWD ?? item.fee_wd ?? null,
        deposit: item.deposit,
        withdraw: item.withdraw,
        trade: item.trade,
        price: item.price
      };
    },

    // Helper untuk normalisasi data dari JSON (untuk auto-fetch awal)
    _normalizeJsonToken(item, cex) {
      const chain = this.activeChain.toUpperCase();
      // REFACTOR: Gunakan 'nama_token' dari JSON sebagai base ticker (e.g., "SLP")
      const baseTicker = String(item.nama_token || item.ticker || item.symbol || '').toUpperCase();

      return {
        cex,
        chain: String(chain),
        nama_koin: String(item.nama_koin || item.name || ''), // 'nama_koin' adalah nama lengkap
        nama_token: baseTicker, // Ticker dasar (e.g., "CAKE")
        cex_ticker: this._formatCexTicker(cex, baseTicker), // REFACTOR: Gunakan format ticker yang benar dari config
        sc_token: String(item.sc || item.contract || ''),
        des_token: Number(item.des ?? item.decimals ?? 0),
        // Default values as requested
        feeWD: 0,
        deposit: false,
        withdraw: false,
        trade: true,
        price: 0,
        ...item // Keep other fields if any
      };
    },

    // Helper untuk fetch dari JSON (untuk auto-fetch awal)
    async fetchRemoteJsonData() {
      const url = this.config.CHAINS?.[this.activeChain]?.DATAJSON;
      this.$root.loadingText = `Mengambil data dari ${url}...`;
      if (!url) {
        throw new Error(`URL DATAJSON tidak ditemukan untuk chain ${this.activeChain}`);
      }

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        return data || {};
      } catch (error) {
        this.$emit('show-toast', `Gagal mengambil data JSON: ${error.message}`, 'danger');
        throw error;
      }
    },

    // Build secrets object dari config CEX
    buildSecretsFromConfig() {
      const secrets = {};
      const cexConfig = this.config?.CEX || {};

      Object.keys(cexConfig).forEach(cexKey => {
        const cex = cexConfig[cexKey];
        const dataApi = cex?.DATA_API || {};

        // Map field names sesuai yang diharapkan CheckWalletExchanger
        const upperCex = cexKey.toUpperCase();

        if (upperCex === 'BINANCE' || upperCex === 'MEXC') {
          secrets[upperCex] = {
            ApiKey: dataApi.API_KEY,
            ApiSecret: dataApi.API_SECRET
          };
        } else if (upperCex === 'BYBIT') {
          secrets[upperCex] = {
            ApiKey: dataApi.API_KEY,
            ApiSecret: dataApi.API_SECRET
          };
        } else if (upperCex === 'INDODAX') {
          secrets[upperCex] = {
            ApiKey: dataApi.API_KEY,
            ApiSecret: dataApi.API_SECRET
          };
        } else if (upperCex === 'KUCOIN') {
          secrets[upperCex] = {
            ApiKey: dataApi.API_KEY,
            ApiSecret: dataApi.API_SECRET,
            Passphrase: dataApi.PASSPHRASE_API
          };
        } else if (upperCex === 'BITGET') {
          secrets[upperCex] = {
            ApiKey: dataApi.API_KEY,
            ApiSecret: dataApi.API_SECRET,
            Passphrase: dataApi.PASSPHRASE_API
          };
        }
      });

      return secrets;
    },

    // Langkah 3: Tampilkan data dari cache ke UI berdasarkan CEX yang dipilih
    async updateSyncDataView() {
      const aggregated = [];

      console.log('[updateSyncDataView] selectedCexFilters:', this.selectedCexFilters);
      console.log('[updateSyncDataView] syncCache keys:', Object.keys(this.syncCache));

      // Hanya tampilkan data dari CEX yang dipilih
      for (const cex of this.selectedCexFilters) {
        if (Array.isArray(this.syncCache[cex])) {
          aggregated.push(...this.syncCache[cex]);
          console.log(`[updateSyncDataView] Menambahkan ${this.syncCache[cex].length} koin dari ${cex}`);
        } else {
          console.log(`[updateSyncDataView] ${cex} tidak ada di cache atau bukan array`);
        }
      }

      aggregated.sort((a, b) => {
        const nameA = String(a.nama_koin || a.nama_token || '').toLowerCase();
        const nameB = String(b.nama_koin || b.nama_token || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      this.syncData = aggregated;
      const validIds = new Set(aggregated.map(item => item.id));
      this.syncSelectedTokens = this.syncSelectedTokens.filter(id => validIds.has(id));
      this.syncSelectAll = aggregated.length > 0 && this.syncSelectedTokens.length === aggregated.length;
    },

    // =================================================================
    // User Interaction Methods
    // =================================================================

    isCexSelected(cex) {
      return this.selectedCexFilters.includes(this.normalizeCex(cex));
    },

    async toggleCexSelection(cex) {
      const upper = this.normalizeCex(cex);
      if (this.isCexSelected(upper)) {
        this.selectedCexFilters = this.selectedCexFilters.filter(item => item !== upper);
      } else {
        this.selectedCexFilters.push(upper);
      }
      this.syncSelectedTokens = [];
      this.syncSelectAll = false;
      await this.updateSyncDataView();
    },

    // Handler untuk checkbox "select all"
    toggleSelectAll() {
      if (this.syncSelectAll) {
        this.syncSelectedTokens = this.filteredSyncData.map(item => item.id).filter(Boolean);
      } else {
        this.syncSelectedTokens = [];
      }
    },

    // Helper untuk mendapatkan objek token yang dipilih
    getSelectedTokenObjects() {
      const byId = new Map(this.syncData.map(item => [item.id, item]));
      return this.syncSelectedTokens
        .map(id => byId.get(id))
        .filter(Boolean);
    },

    // Handler untuk tombol "Sync CEX"
    async syncSelectedCex() {
      if (!this.canSyncCex) return;

      this.$root.isLoading = true;
      this.$root.loadingText = 'Sinkronisasi data CEX...';

      let successCount = 0;
      let errorCount = 0;

      try {
        for (const cexKey of this.selectedCexFilters) {
          try {
            this.$root.loadingText = `Memproses CEX: ${cexKey}...`;
            await this.fetchAndMergeCex(cexKey); // Panggil metode baru
            successCount++;
          } catch (cexError) {
            errorCount++;
            this.$emit('show-toast', `✗ CEX ${cexKey}: ${cexError.message || 'Error'}`, 'danger');
          }
        }

        // REVISI: Muat ulang cache dari DB setelah semua CEX selesai disinkronkan.
        await this.loadCacheFromDB({ resetFilters: false });

        // Update tampilan dengan data dari database
        await this.updateSyncDataView();

        if (errorCount === 0) {
          this.$emit('show-toast', `Sinkronisasi selesai: ${successCount} CEX berhasil, ${errorCount} gagal. Data sudah tersimpan ke database.`, successCount > errorCount ? 'success' : 'warning');
        }
      } catch (error) {
        this.$emit('show-toast', `Sinkronisasi CEX gagal: ${error.message}`, 'danger');
      } finally {
        this.$root.isLoading = false;
        this.$root.loadingText = '';
      }
    },

    // Handler untuk tombol "Simpan"
    async saveSelectedTokens() {
      const selectedTokens = this.getSelectedTokenObjects();
      if (!selectedTokens.length) {
        this.$emit('show-toast', 'Pilih token yang ingin disimpan.', 'warning');
        return;
      }

      this.$root.loadingText = `Menyimpan ${selectedTokens.length} token...`;
      const storeName = DB.getStoreNameByChain('SYNC_KOIN', this.activeChain);
      const now = new Date().toISOString();

      for (const token of selectedTokens) {
        if (!token.id) continue;
        token.isNew = false;
        token.updatedAt = now;
        try {
          await DB.saveData(storeName, token);
        } catch (error) {
          console.warn('Gagal menyimpan token:', error);
        }
      }

      await this.loadCacheFromDB();
      await this.updateSyncDataView();
      this.$emit('show-toast', `${selectedTokens.length} token disimpan ke cache.`, 'success');
    },

    async removeSelectedTokens() {
      const selectedTokens = this.getSelectedTokenObjects();
      if (!selectedTokens.length) {
        this.$emit('show-toast', 'Tidak ada token yang dipilih untuk dihapus.', 'warning');
        return;
      }

      if (!confirm(`Hapus ${selectedTokens.length} token dari cache sinkronisasi?`)) return;

      this.$root.loadingText = `Menghapus ${selectedTokens.length} token...`;
      const storeName = DB.getStoreNameByChain('SYNC_KOIN', this.activeChain);
      for (const token of selectedTokens) {
        if (!token.id) continue;
        try {
          await DB.deleteData(storeName, token.id);
        } catch (error) {
          console.warn('Gagal menghapus token:', error);
        }
      }

      this.syncSelectedTokens = [];
      this.syncSelectAll = false;
      await this.loadCacheFromDB();
      await this.updateSyncDataView();
      this.$emit('show-toast', `${selectedTokens.length} token dihapus dari cache.`, 'info');
    },

    // Helper untuk menyimpan data ke cache (IndexedDB)
    async saveToCache(tokens, options = { isNew: true }) {
      if (!tokens || tokens.length === 0) return;
      const storeName = DB.getStoreNameByChain('SYNC_KOIN', this.activeChain);
      for (const token of tokens) {
        // REVISI: Pastikan setiap record memiliki 'id' sebelum disimpan.
        // Ini memperbaiki error "key path did not yield a value" saat auto-fetch dari JSON.
        const record = {
          ...token,
          isNew: options.isNew,
          // Tambahkan id jika tidak ada
          id: token.id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)
        };
        await DB.saveData(storeName, record); // 'put' operation
      }
    },

    // Handler untuk tombol "Bersihkan Pilihan"
    clearSelection() {
      this.syncSelectedTokens = [];
      this.syncSelectAll = false;
    },

    // Handler untuk tombol "Import ke Manajemen"
    openImportModal() {
      if (!this.syncSelectedTokens.length) {
        this.$emit('show-toast', 'Pilih token yang ingin diimport ke manajemen.', 'warning');
        return;
      }

      // Reset konfigurasi ke default
      this.importConfig = {
        selectedPairType: this.availablePairOptions?.[0]?.key || '',
        selectedDex: this.availableDexOptions.map(dex => dex.key), // Select all DEX by default
        dexModals: {},
        nonData: {
          sc: '',
          symbol: '',
          des: 18
        },
        isSubmitting: false
      };

      // Inisialisasi modal default untuk semua DEX
      this.availableDexOptions.forEach(dex => {
        this.initDexModal(dex.key);
      });

      this.showImportModal = true;
    },

    // Menutup modal import
    closeImportModal() {
      if (this.importConfig.isSubmitting) return;
      this.showImportModal = false;
    },

    initDexModal(dexKey) {
      // Inisialisasi modal default untuk DEX baru
      if (!this.importConfig.dexModals[dexKey]) {
        // Vue 3: Direct assignment is reactive
        this.importConfig.dexModals[dexKey] = {
          modalKiri: 100,
          modalKanan: 100
        };
      }
      return this.importConfig.dexModals[dexKey];
    },

    getDexModal(dexKey) {
      // Ambil modal untuk DEX tertentu, buat jika belum ada
      if (!this.importConfig.dexModals[dexKey]) {
        // Return default values tanpa mutasi
        return { modalKiri: 100, modalKanan: 100 };
      }
      return this.importConfig.dexModals[dexKey];
    },

    updateDexModal(dexKey, field, value) {
      // Update modal tertentu untuk DEX
      if (!this.importConfig.dexModals[dexKey]) {
        this.initDexModal(dexKey);
      }
      // Vue 3: Direct assignment is reactive
      this.importConfig.dexModals[dexKey][field] = value;
    },

    toggleDexSelection(dexKey) {
      const index = this.importConfig.selectedDex.indexOf(dexKey);
      if (index > -1) {
        this.importConfig.selectedDex.splice(index, 1);
      } else {
        this.importConfig.selectedDex.push(dexKey);
        // Init modal jika belum ada
        if (!this.importConfig.dexModals[dexKey]) {
          this.initDexModal(dexKey);
        }
      }
    },

    selectAllDex() {
      this.importConfig.selectedDex = this.availableDexOptions.map(dex => dex.key);
      // Init modal untuk semua DEX
      this.availableDexOptions.forEach(dex => {
        if (!this.importConfig.dexModals[dex.key]) {
          this.initDexModal(dex.key);
        }
      });
    },

    clearAllDex() {
      this.importConfig.selectedDex = [];
    },

    onPairChange() {
      // Handler saat pair berubah (bisa digunakan untuk validasi)
      // Reset NON data jika bukan NON
      if (!this.isNonPair) {
        this.importConfig.nonData = {
          symbol: '',
          sc: '',
          des: 18
        };
      }
    },

    // Handler untuk tombol "Import Sekarang" di dalam modal
    async importNow() {
      const selectedTokens = this.getSelectedTokenObjects();
      if (!selectedTokens.length) {
        this.$emit('show-toast', 'Tidak ada token yang dipilih.', 'warning');
        return;
      }

      // VALIDASI: Jika NON, pastikan input pair manual lengkap
      if (this.isNonPair && !this.nonInputState.valid) {
        this.$emit('show-toast', 'Lengkapi detail pair manual (Symbol, SC, Decimals) sebelum melakukan import.', 'warning');
        return;
      }

      // VALIDASI: Pastikan ada DEX dipilih (untuk semua, termasuk NON)
      if (!this.importConfig.selectedDex.length) {
        this.$emit('show-toast', 'Pilih minimal satu DEX untuk diaktifkan.', 'warning');
        return;
      }

      if (!this.activeChain) {
        this.$emit('show-toast', 'Chain tidak tersedia.', 'warning');
        return;
      }

      this.importConfig.isSubmitting = true;
      const storeName = DB.getStoreNameByChain('KOIN', this.activeChain);
      const now = new Date().toISOString();

      // Load existing coins untuk cek duplikat
      const existingCoins = await DB.getAllData(storeName);
      const existingByKey = new Map();

      // REFACTOR: Kunci duplikat sekarang berdasarkan kombinasi CEX, SC Token, dan SC Pair.
      existingCoins.forEach(coin => {
        if (coin.id === 'DATA_KOIN') return; // Skip snapshot
        const key = `${(coin.cex_name || '').toUpperCase()}|${(coin.sc_token || '').toLowerCase()}|${(coin.sc_pair || '').toLowerCase()}`;
        existingByKey.set(key, coin);
      });
      let imported = 0;
      let updated = 0;

      // Tentukan pair yang akan digunakan
      let pairInfo = null;

      if (this.isNonPair) {
        // CASE NON: Gunakan data pair manual dari input user
        pairInfo = {
          symbol: this.importConfig.nonData.symbol,
          address: this.importConfig.nonData.sc,
          decimals: Number(this.importConfig.nonData.des || 18)
        };
      } else {
        // CASE Regular: Gunakan pair yang dipilih
        const pair = this.availablePairOptions.find(p => p.key === this.importConfig.selectedPairType);
        if (!pair) {
          this.$emit('show-toast', 'Pair tidak ditemukan.', 'warning');
          this.importConfig.isSubmitting = false;
          return;
        }
        pairInfo = {
          symbol: pair.symbol,
          address: pair.address,
          decimals: Number(pair.decimals || 18)
        };
      }

      // Build dex config (sesuai skema: left/right, bukan modalKiri/modalKanan)
      const dexConfig = this.importConfig.selectedDex.reduce((acc, dexKey) => {
        const dexModal = this.getDexModal(dexKey);
        acc[dexKey] = {
          status: true,
          left: Number(dexModal.modalKiri || 0),
          right: Number(dexModal.modalKanan || 0)
        };
        return acc;
      }, {});

      // ========================================
      // Import Token (Regular & NON sama prosesnya)
      // ========================================
      for (const token of selectedTokens) {
          const cexName = this.normalizeCex(token.cex);

          // Cek apakah sudah ada
          const dupKey = `${cexName.toUpperCase()}|${(token.sc_token || '').toLowerCase()}|${(pairInfo.address || '').toLowerCase()}`;
          const existing = existingByKey.get(dupKey);

          // REFACTOR: Membuat record "flat" sesuai skema baru.
          const record = {
            // Info Aset On-Chain
            chain: this.activeChain.toUpperCase(),
            nama_koin: (token.nama_koin || token.name || token.nama_token || '').toUpperCase(),
            nama_token: (token.nama_token || '').toUpperCase(), // REVISI: Tambahkan nama_token
            sc_token: token.sc_token || '',
            des_token: Number(token.des_token ?? token.decimals ?? 18),
            // Info Spesifik CEX
            cex_name: cexName,
            cex_ticker_token: (token.cex_ticker || token.nama_token || '').toUpperCase(), // Gunakan cex_ticker dari SYNC_KOIN, fallback ke nama_token
            cex_fee_wd: token.feeWD ?? null,
            cex_deposit_status: this.normalizeFlag(token.deposit),
            cex_withdraw_status: this.normalizeFlag(token.withdraw),
            // Info Pair On-Chain
            nama_pair: pairInfo.symbol || '',
            sc_pair: pairInfo.address,
            des_pair: Number(pairInfo.decimals ?? 18),
            cex_pair_deposit_status: false, // Default, akan diupdate oleh Wallet Tab
            cex_pair_withdraw_status: false, // Default, akan diupdate oleh Wallet Tab
            // Konfigurasi & Metadata
            status: true,
            isFavorite: existing ? (existing.isFavorite || existing.isFavorit) : false, // Preserve favorit status
            dex: dexConfig,
            updatedAt: now
          };

          if (existing) {
            // UPDATE: Gunakan ID lama, preserve createdAt
            record.id = existing.id;
            record.createdAt = existing.createdAt;
            updated += 1;
          } else {
            // INSERT: Generate ID baru
            record.id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
            record.createdAt = now;
            imported += 1;
          }

          try {
            await DB.saveData(storeName, record);
          } catch (error) {
            console.warn('Gagal import token ke manajemen:', error);
          }
        }

      this.importConfig.isSubmitting = false;
      this.showImportModal = false;
      this.clearSelection();

      // Toast dengan info lengkap
      if (imported > 0 && updated > 0) {
        this.$emit('show-toast', `Import selesai: ${imported} token baru ditambahkan, ${updated} token diupdate`, 'success');
      } else if (imported > 0) {
        this.$emit('show-toast', `${imported} token baru berhasil diimport ke manajemen`, 'success');
      } else if (updated > 0) {
        this.$emit('show-toast', `${updated} token berhasil diupdate`, 'success');
      } else {
        this.$emit('show-toast', 'Tidak ada perubahan', 'info');
      }

      // Catat ke riwayat aksi
      if (imported > 0 || updated > 0) {
          this.logAction('IMPORT_KOIN', {
            message: `Berhasil import ${imported} koin baru dan update ${updated} koin dari Sync ke Manajemen (Chain: ${this.activeChain.toUpperCase()}).`,
            chain: this.activeChain,
            imported,
            updated
          });
      }
    },

    // Helper untuk mencatat aksi ke riwayat global
    async logAction(action, details) {
      try {
          await DB.saveData('RIWAYAT_AKSI', {
              timestamp: new Date().toISOString(),
              action,
              status: 'success',
              ...details
          });
      } catch (error) {
          console.error('Gagal mencatat riwayat aksi:', error);
      }
    }
  },

  async activated() {
    await this.initialize();
    //this.$emit('show-toast', 'Tab Sinkronisasi dimuat.', 'info');
  },

  template: `
    <div class="sync-tab">
      <!-- REFACTORED: Sync Toolbar with Bootstrap -->
      <div class="card card-body p-2 mb-3">
        <div class="row g-2 align-items-center">
          <div class="col-12 col-lg">
            <h6 class="mb-0 d-flex align-items-center gap-2">
              <i class="bi bi-arrow-repeat"></i>
              Sinkronisasi Koin Exchanger
            </h6>
          </div>
          <div class="col-12 col-lg-auto">
            <div class="d-grid d-sm-inline-flex gap-2 justify-content-sm-end">
                <button class="btn btn-sm btn-success" @click="syncSelectedCex" :disabled="!canSyncCex">
                  <i class="bi bi-lightning-charge-fill"></i> Sync CEX
                </button>
                <button class="btn btn-sm" :class="syncStatusFilter === 'new' ? 'btn-light' : 'btn-info'"
                        @click="syncStatusFilter = (syncStatusFilter === 'new' ? 'all' : 'new')" :disabled="isLoading">
                  <i class="bi bi-stars"></i> NEW
                  <span class="badge bg-dark ms-1">{{ newCoinCount }}</span>
                </button>
            </div>
          </div>
          
        </div>
      </div>

      <!-- CEX Filter Bar -->
      <div class="card card-body p-2 mb-3">
        <div class="row g-2 align-items-center">
          <div v-for="cex in activeCEXs" :key="cex" class="col-6 col-md-auto">
            <div class="form-check form-check-inline m-0">
              <input class="form-check-input" type="checkbox" :id="'cex-filter-' + cex" :value="normalizeCex(cex)" :checked="isCexSelected(cex)" @change="toggleCexSelection(cex)" :disabled="isLoading" autocomplete="off">
              <label class="form-check-label fw-semibold" :for="'cex-filter-' + cex" :style="getColorStyles('cex', cex, 'text')">
                {{ normalizeCex(cex) }} <span class="badge bg-light text-dark border ms-1">{{ (cexDataStatus[normalizeCex(cex)]?.count) || 0 }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Table Actions -->
      <div class="row g-2 align-items-center mb-2">
        <div class="col-12 col-lg">
          <div class="input-group input-group-sm w-100" style="max-width: 320px;">
            <span class="input-group-text">
              <i class="bi bi-search"></i>
            </span>
            <input type="text" class="form-control" placeholder="Cari token..."
                   v-model="syncSearchQuery" :disabled="isLoading">
          </div>
        </div>
        <div class="col-12 col-lg-auto">
          <div class="d-grid d-sm-inline-flex align-items-center gap-2 justify-content-sm-end">
            <span v-if="selectedTokenCount > 0" class="text-danger small d-inline-flex align-items-center gap-1">
              <i class="bi bi-check-square"></i> {{ selectedTokenCount }} Koin dipilih
            </span>
            <div class="vr mx-2 d-none d-sm-block"></div>
            <button class="btn btn-sm btn-outline-primary" @click="openImportModal" :disabled="!canManageSelection">
              <i class="bi bi-box-arrow-in-down"></i> Import
            </button>
            <button class="btn btn-sm btn-outline-success" @click="saveSelectedTokens" :disabled="!canManageSelection">
              <i class="bi bi-save"></i> Save
            </button>
            <button class="btn btn-sm btn-outline-danger" @click="removeSelectedTokens" :disabled="!canManageSelection">
              <i class="bi bi-trash"></i> Delete
            </button>
          </div>
        </div>
      </div>

      <!-- Table -->
      <div class="table-responsive sync-table-wrapper" style="max-height: calc(100vh - 350px);">
        <table class="table table-sm align-middle sync-table">
          <thead class="sticky-top">
            <tr>
              <th style="width: 30px;"><input type="checkbox" class="form-check-input" v-model="syncSelectAll" @change="toggleSelectAll" :disabled="isLoading || filteredSyncData.length === 0"></th>
              <th style="width: 40px;">No</th>
              <th>CEX</th>
              <th>Chain</th>
              <th>Nama KOIN</th>
              <th>Ticker CEX</th>
              <th>Nama Token</th>
              <th>Smart Contract</th>
              <th class="text-center">Decimals</th>
              <th>Fee WD</th>
              <th>Trade</th>
              <th>Deposit</th>
              <th>Withdraw</th>
              <th class="text-end">Price</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in filteredSyncData" :key="item.id || buildTokenKey(item)" :class="{ 'table-light': index % 2 === 0 }">
              <td><input type="checkbox" class="form-check-input" :value="item.id" v-model="syncSelectedTokens" :disabled="isLoading"></td>
              <td>{{ index + 1 }}</td>
              <td><span class="sync-chip" :style="getColorStyles('cex', item.cex, 'solid')">{{ normalizeCex(item.cex) }}</span></td>
              <td class="text-uppercase fw-semibold">{{ chainLabel(item) }}</td>
              <td class="fw-semibold">
                {{ item.nama_koin || item.name || item.nama_token || '-' }}
                <span v-if="item.isNew" class="badge bg-warning text-dark ms-2" title="Koin baru yang belum ada di cache">NEW</span>
              </td>
              <td class="fw-bold">{{ item.cex_ticker || item.nama_token || '-' }}</td>
              <td>{{ item.nama_token || '-' }}</td>
              <td class="text-truncate" style="max-width: 220px;">{{ item.sc_token || '-' }}</td>
              <td class="text-center">{{ item.des_token ?? '-' }}</td>
              <td>{{ formatDecimal(item.feeWD) }}</td>
              <td><span :class="statusPillClass(hasTrade(item))">{{ statusPillLabel(hasTrade(item)) }}</span></td>
              <td><span :class="statusPillClass(hasDeposit(item))">{{ statusPillLabel(hasDeposit(item)) }}</span></td>
              <td><span :class="statusPillClass(hasWithdraw(item))">{{ statusPillLabel(hasWithdraw(item)) }}</span></td>
              <td class="text-end fw-semibold">{{ formatPrice(item.price) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!filteredSyncData.length && !isLoading" class="text-center py-5 text-muted">
        <i class="bi bi-cloud-download fs-1"></i>
        <p class="mt-2 mb-0">Tidak ada data untuk ditampilkan. Pilih CEX di atas untuk melihat data dari cache.</p>
      </div>

      <!-- Modal Import ke Manajemen -->
      <div v-if="showImportModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
          <div class="modal-content">

            <!-- Header -->
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="bi bi-arrow-right-circle me-2"></i>Import ke Manajemen Koin
              </h5>
              <button type="button" class="btn-close" @click="closeImportModal"></button>
            </div>

            <!-- Body -->
            <div class="modal-body">
              

              <!-- Konfigurasi Pair -->
              <div class="card mb-3">
                <div class="card-header">
                  <h6 class="mb-0"><i class="bi bi-gear me-1"></i>Konfigurasi Pair</h6>
                </div>
                <div class="card-body p-3">
                  <div class="row g-3">
                    <div class="col-12">
                      <label class="form-label small fw-semibold">Pilih Pair</label>
                      <select class="form-select form-select-sm" v-model="importConfig.selectedPairType" @change="onPairChange">
                        <option v-for="pair in availablePairOptions" :key="pair.key" :value="pair.key">{{ pair.symbol }}</option>
                       
                      </select>
                    </div>

                    <!-- Detail Pair (Non-NON) -->
                    <div class="col-12" v-if="!isNonPair">
                      <label class="form-label small fw-semibold d-flex align-items-center gap-1">
                        <i class="bi bi-info-circle text-primary"></i>
                        Detail Pair
                      </label>
                      <div class="p-3 bg-light border rounded small d-flex gap-4 flex-wrap">
                        <div>
                          <div class="text-muted small">Symbol</div>
                          <div class="fw-semibold">{{ pairDisplayInfo.symbol }}</div>
                        </div>
                        <div>
                          <div class="text-muted small">Smart Contract</div>
                          <div>
                            <code v-if="pairDisplayInfo.sc && pairDisplayInfo.sc !== '-'">{{ pairDisplayInfo.sc }}</code>
                            <span v-else class="text-muted">-</span>
                          </div>
                        </div>
                        <div>
                          <div class="text-muted small">Decimals</div>
                          <div>{{ pairDisplayInfo.decimals }}</div>
                        </div>
                      </div>
                      <div v-if="!pairDisplayInfo.available" class="text-warning mt-2 small">
                        <i class="bi bi-exclamation-triangle me-1"></i>
                        Detail pair tidak ditemukan di konfigurasi chain.
                      </div>
                    </div>

                    <!-- Input NON (Pair Manual) -->
                    <div class="col-12" v-if="isNonPair">
                      <div class="bg-info bg-opacity-10 border border-info rounded p-3">
                        <div class="d-flex align-items-center mb-3">
                          <i class="bi bi-pencil-square text-info me-2 fs-5"></i>
                          <div>
                            <div class="fw-semibold">Input Detail Pair Manual</div>
                            <small class="text-muted">Masukkan detail pair yang tidak tersedia di daftar. Token tetap dari CEX yang dipilih.</small>
                          </div>
                        </div>
                        <div class="row g-3">
                          <div class="col-md-4">
                            <label class="form-label small fw-semibold">Symbol Pair <span class="text-danger">*</span></label>
                            <input type="text" class="form-control form-control-sm"
                                   :class="{ 'is-invalid': nonInputState.missing.includes('symbol') }"
                                   v-model="importConfig.nonData.symbol"
                                   placeholder="Contoh: BUSD, DAI" style="text-transform: uppercase;">
                            <div class="invalid-feedback">Symbol pair wajib diisi.</div>
                          </div>
                          <div class="col-md-4">
                            <label class="form-label small fw-semibold">Smart Contract Pair <span class="text-danger">*</span></label>
                            <input type="text" class="form-control form-control-sm"
                                   :class="{ 'is-invalid': nonInputState.missing.includes('sc') }"
                                   v-model="importConfig.nonData.sc"
                                   placeholder="0x..." maxlength="42">
                            <div class="invalid-feedback">Alamat smart contract pair wajib diisi.</div>
                          </div>
                          <div class="col-md-4">
                            <label class="form-label small fw-semibold">Decimals Pair <span class="text-danger">*</span></label>
                            <input type="number" class="form-control form-control-sm"
                                   :class="{ 'is-invalid': nonInputState.missing.includes('des') }"
                                   v-model.number="importConfig.nonData.des"
                                   placeholder="18" min="0" max="32">
                            <div class="invalid-feedback">Masukkan nilai decimals yang valid.</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Pilih DEX (Untuk semua termasuk NON) -->
              <div class="mb-3">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <label class="form-label mb-0 fw-semibold">Pilih DEX untuk Trading</label>
                  <div>
                    <button type="button" class="btn btn-sm btn-outline-primary me-1" @click="selectAllDex">
                      Pilih Semua DEX
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-secondary" @click="clearAllDex">
                      Clear All
                    </button>
                  </div>
                </div>

                <div class="border rounded p-3" style="max-height: 300px; overflow-y: auto;">
                  <div class="row">
                    <div class="col-12" v-for="dex in dexByCategory.DEX" :key="dex.key">
                      <div class="d-flex align-items-center gap-2 border rounded p-2 mb-2" :class="{ 'border-primary bg-primary-subtle': importConfig.selectedDex.includes(dex.key) }">
                        <!-- Checkbox dan Label -->
                        <div class="form-check flex-grow-1">
                          <input class="form-check-input" type="checkbox" :id="'dex-' + dex.key"
                                 :checked="importConfig.selectedDex.includes(dex.key)"
                                 @change="toggleDexSelection(dex.key)">
                          <label class="form-check-label fw-semibold small" :for="'dex-' + dex.key" :style="{ color: dex.color }">
                            {{ dex.name }}
                          </label>
                        </div>
                        <!-- Grup Input Modal -->
                        <div v-if="importConfig.selectedDex.includes(dex.key)" class="d-flex gap-2" style="width: 200px;">
                          <div class="input-group input-group-sm">
                            <span class="input-group-text">$</span>
                            <input type="number" class="form-control"
                                   :value="getDexModal(dex.key).modalKiri"
                                   @input="updateDexModal(dex.key, 'modalKiri', parseInt($event.target.value) || 100)"
                                   placeholder="100" min="1">
                          </div>
                          <div class="input-group input-group-sm">
                            <span class="input-group-text">$</span>
                            <input type="number" class="form-control"
                                   :value="getDexModal(dex.key).modalKanan"
                                   @input="updateDexModal(dex.key, 'modalKanan', parseInt($event.target.value) || 100)"
                                   placeholder="100" min="1">
                            </div>
                          </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Ringkasan Import -->
              <div class="card">
                <div class="card-header">
                  <h6 class="mb-0"><i class="bi bi-list-check me-1"></i>Ringkasan Import</h6>
                </div>
                <div class="card-body p-3">
                  <div v-if="syncSelectedTokens.length > 0 && (importConfig.selectedDex.length > 0 || isNonPair)">
                    <div class="row">
                      <div class="col-md-8">
                        <div class="mb-2">
                          <strong>CEX:</strong> <span class="text-primary">{{ selectedCexSummary }}</span><br>
                          <strong>Chain:</strong> <span class="text-success">{{ activeChain ? activeChain.toUpperCase() : '-' }}</span><br>
                          <strong>Pair:</strong>
                          <span class="text-info">
                            <span v-if="isNonPair">
                              {{ importConfig.nonData.symbol || '?' }}/USDT
                            </span>
                            <span v-else>
                              {{ pairDisplayInfo.symbol }}
                            </span>
                          </span>
                        </div>
                        <div>
                          <strong>Total:</strong>
                          <strong class="text-success">{{ syncSelectedTokens.length }} koin</strong> akan diimport
                        </div>
                      </div>
                      <div class="col-md-4">
                        <small class="text-muted" style="white-space: pre-line;">
                          <strong>DEX + Modal:</strong><br>
                          {{ dexModalSummary }}
                          <span v-if="isNonPair" class="d-block text-warning mt-1">
                            NON: {{ importConfig.nonData.symbol || '?' }}/USDT
                          </span>
                        </small>
                      </div>
                    </div>
                  </div>
                  <div v-else class="text-muted text-center py-2">
                    <i class="bi bi-info-circle me-1"></i>
                    Pilih koin dan konfigurasi untuk melihat ringkasan
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="modal-footer">
              <button type="button" class="btn btn-sm btn-danger" @click="closeImportModal" :disabled="importConfig.isSubmitting">
                <i class="bi bi-x-lg me-1"></i>Batal
              </button>
              <button type="button" class="btn btn-sm btn-success" @click="importNow"
                      :disabled="syncSelectedTokens.length === 0 || (importConfig.selectedDex.length === 0 && !isNonPair) || importConfig.isSubmitting">
                <span v-if="importConfig.isSubmitting" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="bi bi-download me-1"></i>Import Sekarang
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  `,

  async activated() {
    await this.initialize();
    //this.$emit('show-toast', 'Tab Sinkronisasi dimuat.', 'info');
  }
};
