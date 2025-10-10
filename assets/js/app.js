// ====== MAIN VUE APPLICATION ======

// --- Logika Aplikasi Utama ---
const { createApp } = Vue;

const app = createApp({
  // Gunakan mixins untuk menggabungkan logika dari file lain
  mixins: [
    // Mixin utilitas
    utilitiesMixin,
    notificationsMixin, // Tetap ada untuk toast, dll.
    historyLoggerMixin,
    routerMixin,
    themeMixin,
    // Mixin untuk fitur/menu
    settingsMixin,
    databaseMixin // Logika untuk menu database
  ],

  // Registrasi komponen
  components: {
    // Menu components
    'settings-menu': SettingsMenu,
    'database-menu': DatabaseMenu,
    'history-menu': HistoryMenu,
    'portfolio-menu': PortfolioMenu,
    // Tab Components
    'scanning-tab': ScanningTab,
    'management-tab': ManagementTab,
    'sync-tab': SyncTab,
    'wallet-tab': WalletTab,
    // Common components
    'filter-settings': FilterSettings, // Sidebar
    'tab-navigation': TabNavigation,   // Navigasi tab (Scan, Manajemen, dll)
    'filter-toolbar': FilterToolbar    // Toolbar di atas tabel (Search, Min PNL, dll)
    // Komponen anak scanning sudah digabung ke dalam scanning-tab
  },

  data() {
    return {
      // --- Core Application Data ---
      config: KONFIG_APLIKASI, // Load entire configuration
      // Menu & Navigation
      activeMenu: 'mode',
      activeTab: 'scan',
      // REVISI: Inisialisasi activeChain langsung dari parameter URL.
      // Ini adalah perbaikan kunci untuk mencegah infinite reload.
      // Watcher tidak akan terpicu karena nilai ini ditetapkan sebelum mounted.
      activeChain: (() => {
        const params = new URLSearchParams(window.location.search);
        const chainParam = params.get('chain') || 'multi';
        // Validasi chainParam terhadap KONFIG_APLIKASI
        if (KONFIG_APLIKASI.CHAINS[chainParam] || chainParam === 'multi') {
          return chainParam;
        }
        // Jika tidak valid, default ke 'multi'
        return 'multi';
      })(),
      showFilterSidebar: true, // Untuk toggle filter sidebar

      // Loading States
      searchQuery: '', // REVISI: Dipindahkan ke root untuk bisa diakses global
      isLoading: true, // Start with true untuk boot overlay
      isScanning: false, // REVISI: Tambahkan state untuk status scanning global
      isBooting: true, // Flag untuk boot state
      loadingText: 'Menyiapkan aplikasi...',

      // Database Status
      dbStatus: 'pending', // 'pending', 'success', 'error'

      // Initialization flag
      isAppInitialized: false,

      // Global services
      web3Service: null,
      realtimeDataFetcher: null, // Tambahkan service baru di sini

      // Filters
      filters: {
        chains: {},
        cex: {},
        dex: {},
        pairs: {},
        favoritOnly: false,
        autorun: false,
        autoscroll: false,
        minPnl: 0,
        run: 'stop'
      },

      // Coin data untuk filtering count dan stats
      allCoins: [], // Loaded dari tabel KOIN_<chain> sesuai mode aktif
      filteredCoins: [],
      filterStats: {
        chains: {},
        cex: {},
        dex: {},
        pairs: {}
      },
      isFilterLocked: false,
      _filterStatsTimer: null
    };
  },

  async mounted() {
    // Inisialisasi Database
    try {
      /* // console.log('⚙️ [1/5] Menginisialisasi Database...'); */
      await DB.initDB();
      this.dbStatus = 'success';

      // FIX: Tandai bahwa inisialisasi selesai SEBELUM memuat pengaturan.
      // Ini akan memberi sinyal ke komponen anak (seperti scanning-tab) bahwa DB sudah siap.
      this.isAppInitialized = true;
      /* // console.log('🚀 [PRE-INIT] Database siap, aplikasi siap untuk memuat data.'); */

      const allStores = DB.getAllStoreNames();
    //  // console.log('📦 Database berhasil dimuat dengan stores:', allStores);
     // // console.log(`✅ Total ${allStores.length} stores dibuat`);

     // this.showToast('Database berhasil dimuat.', 'success');

      // Muat semua pengaturan setelah DB siap
      /* // console.log('⚙️ [2/5] Memuat semua pengaturan...'); */
      // REVISI: Panggil loadAllSettings dan TUNGGU hingga selesai.
      // Ini memastikan globalSettings dan filterSettings sudah terisi penuh
      // sebelum melanjutkan ke langkah berikutnya.
      // REVISI: Panggil loadAllSettings dengan chain yang sudah diinisialisasi dari URL.
      const initialChain = this.activeChain;
      /* // console.log(`⚙️ [2.1/5] Memuat pengaturan untuk chain awal: "${initialChain}"`); */
      await this.loadAllSettings(initialChain);

      // Proses parameter URL untuk mengatur state awal
      /* // console.log('⚙️ [3/5] Memproses parameter URL...'); */
      this.processURLParams();
      this.updateThemeColor();

      // Sembunyikan boot overlay SEKARANG, jangan tunggu data koin
      this.isBooting = false;
      this.isLoading = false;
      document.body.classList.remove('app-loading');
      /* // console.log('✅ [UI RENDERED] Antarmuka aplikasi ditampilkan.'); */

      // ⚠️ GUARD: Jika global settings tidak valid, tampilkan modal
      if (!this.isGlobalSettingsValid) {
        // console.warn('🔴 [CHECK FAILED] Pengaturan global tidak lengkap atau tidak valid. Menampilkan modal.');
        this.isGlobalSettingsRequired = true;
        // PERBAIKAN UX: Tampilkan notifikasi yang jelas
        setTimeout(() => {
          this.showToast('⚠️ Pengaturan Global belum lengkap! Silakan isi Wallet Address, Chain, dan CEX terlebih dahulu.', 'warning', 8000);
        }, 1000);
      } else {
        /* // console.log('🟢 [CHECK OK] Pengaturan global valid.'); */

        // Inisialisasi service setelah UI tampil
        if (window.Web3Service && !this.web3Service) this.web3Service = new window.Web3Service(this.config);
        if (window.RealtimeDataFetcher && !this.realtimeDataFetcher) this.realtimeDataFetcher = new window.RealtimeDataFetcher(this.config, window.Http);

        // Muat data koin di latar belakang
        /* // console.log('⚙️ [4/5] Memuat data koin untuk filter di latar belakang...'); */
        this.loadCoinsForFilter(); // Tidak perlu 'await'
      }

    } catch (error) {
      this.dbStatus = 'error';
      // console.error('Gagal menginisialisasi database dari app.js:', error);
      this.showToast('Gagal memuat database.', 'danger');
      this.isBooting = false;
      this.isLoading = false;
    }

    // isAppInitialized sudah dipindahkan ke atas setelah DB init.
    /* // console.log('🚀 [5/5] Aplikasi selesai dimuat!'); */
  },

  watch: {
    activeChain: {
      // REVISI: Jadikan watcher ini lebih sederhana. Logika reload halaman
      // akan menangani pemuatan ulang data secara konsisten.
      async handler(newChain, oldChain) {
        if (!this.isAppInitialized || !oldChain || newChain === oldChain) {
          return;
        }

        /* // console.log(`🔄 [WATCHER-CHAIN] Chain berubah dari '${oldChain}' ke '${newChain}'. Memuat ulang...`); */

        // Guard: Jika global settings tidak valid, block navigasi
        if (!this.isGlobalSettingsValid) {
          // console.warn('⚠️ Global settings belum valid, navigasi diblokir.');
          // Kembalikan ke chain sebelumnya secara visual jika memungkinkan
          this.activeChain = oldChain;
          return;
        }

        // REVISI: Gunakan metode terpusat untuk reload halaman.
        // Metode ini akan menangani overlay, update URL, dan reload.
        await this.performPageReload({
          chain: newChain,
          loadingText: `Memuat data untuk ${newChain.toUpperCase()}...`
        });
      }
    },

    // REVISI: Watcher ini sekarang mengawasi seluruh objek filterSettings.
    // Ini memastikan tema diperbarui baik saat properti darkMode diubah (toggle)
    // maupun saat seluruh objek diganti (berpindah chain).
    filterSettings: {
        deep: true,
        handler(newSettings) {
            const theme = newSettings.darkMode ? 'dark' : 'light';
            document.documentElement.setAttribute('data-bs-theme', theme);
            this.scheduleFilterStatsRefresh();
        }
    },
    searchQuery(newValue, oldValue) {
      if (newValue !== oldValue) {
        this.scheduleFilterStatsRefresh();
      }
    },

    activeMenu(newValue) {
      if (newValue === 'settings') {
        this.loadSettingsForm();
      } else if (newValue === 'db') {
        this.loadDatabaseInfo();
      }
    },
    appTitle: {
      immediate: true,
      handler(newTitle) {
        if (newTitle) {
          document.title = newTitle;
        }
      }
    }

  },

  beforeUnmount() {
    if (this._filterStatsTimer) {
      clearTimeout(this._filterStatsTimer);
      this._filterStatsTimer = null;
    }
  },

  computed: {
    // --- Computed untuk info chain aktif ---
    activeChainInfo() {
      if (!this.config) return { key: '...', name: '...' };
      if (!this.activeChain || !this.config.CHAINS) return { key: 'multi', name: 'Multi Chain' };
      if (this.activeChain === 'multi') return { key: 'multi', name: 'Multi Chain' };

      const chainConfig = this.config.CHAINS[this.activeChain];
      return chainConfig ? { key: this.activeChain, name: chainConfig.NAMA_CHAIN } : { key: this.activeChain, name: this.activeChain.toUpperCase() };
    },
    appName() {
      return (this.config?.APP?.NAME || 'MultiPlus Scanner').toString();
    },
    appVersion() {
      const version = this.config?.APP?.VERSION;
      return version ? version.toString() : '';
    },
    appDisplayName() {
      const suffix = this.appVersion ? ` v${this.appVersion}` : '';
      return `${this.appName}${suffix}`;
    },
    appTitle() {
      return `${this.appDisplayName} — CEX ⇄ DEX`;
    },

    // --- Computed Properties untuk Konten Dinamis ---
    chainList() {
      return Object.keys(this.config.CHAINS).map(key => ({
        key: key,
        ...this.config.CHAINS[key]
      }));
    },
    cexList() {
      return Object.keys(this.config.CEX);
    },
    dexList() {
      return Object.keys(this.config.DEXS);
    },
    pairList() {
      const chainConfigs = this.config?.CHAINS || {};
      const availableChains = Object.keys(chainConfigs);
      if (!availableChains.length) return [];

      const chainResolver = availableChains.reduce((acc, key) => {
        acc[key.toLowerCase()] = key;
        return acc;
      }, {});

      const resolveChainKey = (chainKey) => {
        if (!chainKey) return null;
        return chainResolver[String(chainKey).toLowerCase()] || null;
      };

      const tokenSource = this.filteredCoins.length ? this.filteredCoins : this.allCoins;
      if (!tokenSource.length) return [];

      const activeChainSet = new Set();
      tokenSource.forEach(token => {
        const resolvedChainKey = resolveChainKey(token.chainKey || token.chain);
        if (resolvedChainKey) {
          activeChainSet.add(resolvedChainKey);
        }
      });

      if (!activeChainSet.size) return [];

      const pairMap = new Map();

      const ensurePairEntry = (pairKey) => {
        const normalizedPair = String(pairKey || 'NON').toUpperCase();
        if (!pairMap.has(normalizedPair)) {
          pairMap.set(normalizedPair, {
            key: normalizedPair,
            chains: {}
          });
        }
        return pairMap.get(normalizedPair);
      };

      // Pre-populate entries berdasarkan konfigurasi chain aktif
      activeChainSet.forEach(chainKey => {
        const chainConfig = chainConfigs[chainKey];
        if (!chainConfig) return;

        const chainLabel = chainConfig.NAMA_CHAIN || chainKey.toUpperCase();
        const chainIcon = chainConfig.ICON || null;

        Object.keys(chainConfig.PAIR_DEXS || {}).forEach(pairKey => {
          const entry = ensurePairEntry(pairKey);
          if (!entry.chains[chainKey]) {
            entry.chains[chainKey] = {
              key: chainKey,
              label: chainLabel,
              icon: chainIcon,
              count: 0
            };
          }
        });
      });

      // Hitung jumlah berdasarkan token yang lolos filter
      tokenSource.forEach(rawCoin => {
        if (!rawCoin) return;

        const resolvedChainKey = resolveChainKey(rawCoin.chainKey || rawCoin.chain);
        if (!resolvedChainKey || !activeChainSet.has(resolvedChainKey)) return;

        const chainConfig = chainConfigs[resolvedChainKey];
        const chainLabel = chainConfig?.NAMA_CHAIN || resolvedChainKey.toUpperCase();
        const chainIcon = chainConfig?.ICON || null;
        const pairKey = String(rawCoin.nama_pair || rawCoin.sc_pair || 'NON').toUpperCase();

        const entry = ensurePairEntry(pairKey);
        if (!entry.chains[resolvedChainKey]) {
          entry.chains[resolvedChainKey] = {
            key: resolvedChainKey,
            label: chainLabel,
            icon: chainIcon,
            count: 0
          };
        }
        entry.chains[resolvedChainKey].count += 1;
      });

      const pairList = Array.from(pairMap.values())
        .map(entry => {
          const chains = Object.values(entry.chains)
            .sort((a, b) => a.label.localeCompare(b.label));
          const totalCount = chains.reduce((sum, chain) => sum + (Number(chain.count) || 0), 0);
          return {
            key: entry.key,
            chains,
            totalCount
          };
        })
        .sort((a, b) => a.key.localeCompare(b.key));

      return pairList;
    },

    // REVISI: Logika visibility sidebar yang baru
    sidebarColumnClass() {
      // Sidebar selalu ada (MODE CHAIN selalu tampil), hanya bisa di-toggle
      return this.showFilterSidebar ? 'col-lg-10' : 'col-lg-12';
    },

    // Computed property untuk dynamic component
    activeTabComponent() {
      switch (this.activeTab) {
        case 'scan':
          return 'scanning-tab';
        case 'manajemen':
          return 'management-tab';
        case 'sync':
          return 'sync-tab';
        case 'wallet':
          return 'wallet-tab';
        default:
          return null; // or a default component
      }
    },

    // Filter statistics (sudah dihitung di refreshFilterStats)
    coinCountByChain() {
      return this.filterStats.chains || {};
    },
    coinCountByCex() {
      return this.filterStats.cex || {};
    },
    coinCountByDex() {
      return this.filterStats.dex || {};
    },
    coinCountByPair() {
      return this.filterStats.pairs || {};
    }
  },
  methods: {
    // REVISI: Method baru untuk menangani klik pada ikon chain di header
    setActiveChain(chainKey) {
      if (this.activeChain !== chainKey) {
        this.activeChain = chainKey;
      }
    },
    // REVISI: Method untuk update status scanning dari komponen anak
    setScanningStatus(status) {
      this.isScanning = status;
    },
    // Handler untuk tombol "Mulai Isi Setting" di modal
    handleStartSettings() {
      /* // console.log('🔘 Tombol "Mulai Isi Setting" diklik.'); */
      this.isGlobalSettingsRequired = false; // Sembunyikan modal
      this.activeMenu = 'settings'; // Tampilkan menu settings
      this.loadSettingsForm(); // Pastikan form settings dimuat
      /* // console.log('➡️ Mengarahkan ke menu pengaturan.'); */
    },

    // Initialize Filters
    initializeFilters() {
      // REVISI: Fungsi ini sekarang hanya me-reset struktur objek filter.
      // Nilai-nilai (true/false) akan diisi sepenuhnya oleh `loadFilterSettings`
      // untuk memastikan data dari DB yang digunakan (autoload).
      this.filters.chains = {};
      this.filters.cex = {};
      this.filters.dex = {};
      this.filters.pairs = {};
      /* // console.log('Filter diinisialisasi ulang untuk chain:', this.activeChain); */
    },

    reloadActiveTab() {
      /* // console.log('Reloading active tab:', this.activeTab); */
      this.isLoading = true;
      this.loadingText = 'Refreshing data...';

      setTimeout(() => {
        // Di sini Anda bisa menambahkan logika refresh yang spesifik untuk setiap tab
        // Contoh:
        // if (this.activeTab === 'scan') this.fetchScanData();
        // if (this.activeTab === 'management') this.loadCoins();
        /* // console.log(`Data untuk tab ${this.activeTab} di-refresh.`); */
        this.isLoading = false;
      }, 1000);
    },

    // Load token dataset untuk mode aktif dan perbarui statistik filter
    async loadCoinsForFilter() {
      if (!this.activeChain || !this.config?.CHAINS) {
        this.allCoins = [];
        this.filteredCoins = [];
        this.scheduleFilterStatsRefresh();
        return;
      }

      const isMultiChainMode = this.activeChain === 'multi';
      /* // console.log(`📊 Memuat dataset token untuk mode "${this.activeChain}"...`); */

      const allChainKeys = Object.keys(this.config.CHAINS || {});
      const chainsToLoad = isMultiChainMode
        ? allChainKeys
        : allChainKeys.filter(key => key.toLowerCase() === this.activeChain.toLowerCase());

      const aggregatedTokens = [];

      const parseFavoriteFlag = (value) => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value === 1;
        if (typeof value === 'string') {
          const normalized = value.trim().toLowerCase();
          if (['1', 'true', 'yes', 'y', 'favorit', 'fav'].includes(normalized)) return true;
          if (['0', 'false', 'no', 'n', ''].includes(normalized)) return false;
        }
        return false;
      };

      for (const rawChainKey of chainsToLoad) {
        const chainKeyLower = rawChainKey.toLowerCase();
        const storeName = DB.getStoreNameByChain('KOIN', chainKeyLower);
        try {
          const chainCoins = await DB.getAllData(storeName);

          for (const coin of chainCoins) {
            if (!coin || coin.id === 'DATA_KOIN') continue;

            const normalizedChainLower = String(coin.chain || chainKeyLower).toLowerCase();
            const normalizedChainUpper = normalizedChainLower.toUpperCase();
            const namaTokenFallback = coin.nama_token || coin.nama_koin || (coin.cex_ticker_token || '').replace(/(USDT|IDR|BUSD)/gi, '');

            const isFavorite = parseFavoriteFlag(
              coin.isFavorite !== undefined ? coin.isFavorite : coin.isFavorit
            );

            // Mode multichain hanya menampilkan token favorit
            if (isMultiChainMode && !isFavorite) continue;

            aggregatedTokens.push({
              ...coin,
              chain: normalizedChainUpper,
              chainKey: normalizedChainLower,
              nama_token: namaTokenFallback,
              isFavorite,
              isFavorit: isFavorite
            });
          }
        } catch (error) {
          // console.warn(`⚠️ Gagal memuat data dari ${storeName}:`, error);
        }
      }

      this.allCoins = aggregatedTokens;
      /* // console.log(`✅ Dataset token dimuat (${aggregatedTokens.length} entri) untuk mode "${this.activeChain}".`); */

      // Perbarui statistik dan cache token terfilter
      this.refreshFilterStats();
    },

    refreshFilterStats() {
      if (this._filterStatsTimer) {
        clearTimeout(this._filterStatsTimer);
        this._filterStatsTimer = null;
      }

      const sourceTokens = Array.isArray(this.allCoins) ? this.allCoins : [];
      // REFAKTOR: Panggil applyFiltersToTokens dari filterMixin
      const filtered = filterMixin.methods.applyFiltersToTokens(sourceTokens, {
        filters: this.filters,
        searchQuery: this.searchQuery
      });

      this.filteredCoins = filtered;

      const stats = {
        chains: {},
        cex: {},
        dex: {},
        pairs: {}
      };

      filtered.forEach(token => {
        const chainKey = String(token.chainKey || token.chain || '').toLowerCase();
        if (chainKey) {
          stats.chains[chainKey] = (stats.chains[chainKey] || 0) + 1;
        }

        const cexKey = String(token.cex_name || '').toLowerCase();
        if (cexKey) {
          stats.cex[cexKey] = (stats.cex[cexKey] || 0) + 1;
        }

        if (token.dex && typeof token.dex === 'object') {
          Object.keys(token.dex).forEach(dexKey => {
            if (token.dex[dexKey]?.status) {
              const normalizedDex = dexKey.toLowerCase();
              stats.dex[normalizedDex] = (stats.dex[normalizedDex] || 0) + 1;
            }
          });
        }

        const pairKey = String(token.nama_pair || 'NON').toLowerCase();
        stats.pairs[pairKey] = (stats.pairs[pairKey] || 0) + 1;
      });

      this.filterStats = stats;

      const chainKey = this.filterSettings?.chainKey || this.activeChain || 'unknown';
      /* // console.log(`[FilterStats] Updated for "${chainKey}". Filtered tokens: ${filtered.length}`); */
      // if (filtered.length) {
      //   // console.table(filtered.map(token => ({
      //     id: token.id,
      //     chain: token.chain,
      //     token: token.nama_token || token.nama_koin,
      //     pair: token.nama_pair,
      //     cex: token.cex_name,
      //     favorite: Boolean(token.isFavorite || token.isFavorit)
      //   // })));
      // } else {
      //   console.log('[FilterStats] Tidak ada token setelah filter diterapkan.');
      // }
    },

    scheduleFilterStatsRefresh() {
      if (this._filterStatsTimer) {
        clearTimeout(this._filterStatsTimer);
      }
      this._filterStatsTimer = setTimeout(() => {
        this._filterStatsTimer = null;
        this.refreshFilterStats();
      }, 150);
    },

    // REFACTOR: Method ini digantikan oleh filterAutoSaveMixin
    // Tetap dipertahankan untuk backward compatibility dan untuk akses dari $root
    async saveFilterChange(filterType) {
      if (!this.filterSettings || !this.filterSettings.chainKey) {
        // console.warn('[App] Chain key tidak ditemukan di filterSettings');
        return;
      }

      const chainKey = this.filterSettings.chainKey;
      /* // console.log(`[App] Menyimpan perubahan filter "${filterType}" untuk chain: ${chainKey}`); */

      try {
        // PERBAIKAN: Clone data menggunakan JSON untuk menghilangkan Vue reactivity
        const plainFilterSettings = JSON.parse(JSON.stringify(this.filterSettings));
        const plainFilters = JSON.parse(JSON.stringify(this.filters));

        // Gabungkan nilai lama dan baru
        const mergedSettings = {
          ...plainFilterSettings,
          ...plainFilters,
          key: 'SETTING_FILTER',
          chainKey
        };

        // Gunakan repository jika tersedia
        const settingsRepo = window.AppContainer?.get('settingsRepository');
        if (settingsRepo) {
          await settingsRepo.saveFilterSettings(chainKey, mergedSettings);
        } else {
          // Fallback ke DB langsung
          const storeName = DB.getStoreNameByChain('SETTING_FILTER', chainKey);
          await DB.saveData(storeName, mergedSettings, 'SETTING_FILTER');
        }

        // Sinkronkan state lokal
        this.filterSettings = mergedSettings;
        this.filters = {
          ...this.filters,
          ...mergedSettings
        };

        const message = this.getFilterChangeMessage(filterType);
        this.showToast(message, 'success', 2000);

        /* // console.log(`✅ Filter ${filterType} disimpan untuk ${chainKey}`); */
        const filterTableName = `SETTING_FILTER_${String(chainKey).toUpperCase()}`;
        // // console.groupCollapsed(`[Setting Filter] Menyimpan data ke tabel "${filterTableName}" melalui aksi "${filterType}"`);
        // // console.table([{
        //   chainKey,
        //   minPnl: this.filterSettings.minPnl,
        //   favoritOnly: this.filterSettings.favoritOnly,
        //   autorun: this.filterSettings.autorun,
        //   autoscroll: this.filterSettings.autoscroll,
        //   run: this.filterSettings.run,
        //   sortDirection: this.filterSettings.sortDirection,
        //   darkMode: this.filterSettings.darkMode
        // // }]);
        // console.table(Object.entries(this.filterSettings.cex || {}).map(([key, value]) => ({ kategori: 'CEX', kunci: key.toUpperCase(), aktif: Boolean(value) })));
        // console.table(Object.entries(this.filterSettings.dex || {}).map(([key, value]) => ({ kategori: 'DEX', kunci: key.toUpperCase(), aktif: Boolean(value) })));
        // console.table(Object.entries(this.filterSettings.chains || {}).map(([key, value]) => ({ kategori: 'CHAIN', kunci: key.toUpperCase(), aktif: Boolean(value) })));
        // console.table(Object.entries(this.filterSettings.pairs || {}).map(([key, value]) => ({ kategori: 'PAIR', kunci: key.toUpperCase(), aktif: Boolean(value) })));
        /* // console.log(`[Setting Filter] Data JSON lengkap (${filterTableName}):\n`, JSON.stringify(this.filterSettings, null, 2)); */
        // console.groupEnd();

        // Log aksi perubahan filter
        if (['cex', 'dex', 'chains', 'pairs'].includes(filterType)) {
          this.logAction('UPDATE_FILTER', {
            message: `Filter '${filterType}' untuk chain '${chainKey.toUpperCase()}' telah diubah.`,
            chain: chainKey
          });
        }

        this.scheduleFilterStatsRefresh();
      } catch (error) {
        // console.error('❌ Error saving filter:', error);
        this.showToast('Gagal menyimpan filter!', 'danger');
      }
    },

    getFilterChangeMessage(filterType) {
      const filterData = this.filters[filterType];
      if (typeof filterData === 'boolean') {
        return `Filter ${filterType} ${filterData ? 'diaktifkan' : 'dinonaktifkan'}`;
      }      return `Filter ${filterType} berhasil diubah`;
    },

    updateCoinDataInRoot(updatedToken) {
      const index = this.allCoins.findIndex(c => c.id === updatedToken.id);
      if (index !== -1) {
        this.allCoins.splice(index, 1, updatedToken);
        this.scheduleFilterStatsRefresh();
      }
    },

    // REVISI: Metode terpusat untuk menangani semua aksi yang memerlukan reload halaman.
    // Ini mencegah duplikasi logika dan race condition pada overlay.
    async performPageReload({ chain = null, toggleTheme = false, loadingText = 'Memuat ulang...' }) {
      // 1. Terapkan perubahan state SEBELUM menampilkan overlay
      let newTheme = null;

      if (toggleTheme) {
        const newDarkModeStatus = !this.filterSettings.darkMode;
        this.filterSettings.darkMode = newDarkModeStatus;
        if (this.filters) this.filters.darkMode = newDarkModeStatus;
        newTheme = newDarkModeStatus ? 'dark' : 'light';

        // Simpan perubahan darkMode ke DB agar permanen setelah reload
        await this.saveFilterChange('darkMode');
      }

      if (chain) {
        // Sinkronkan parameter URL dengan chain yang dipilih agar state bertahan setelah reload.
        const currentChainParam = new URL(window.location).searchParams.get('chain');
        if (currentChainParam !== chain) {
          this.updateURL('chain', chain);
        }
      }

      // 2. Terapkan tema ke DOM secara langsung untuk mencegah "flash"
      // Jika tema tidak di-toggle, gunakan tema saat ini.
      const finalTheme = newTheme || (this.filterSettings.darkMode ? 'dark' : 'light');
      document.documentElement.setAttribute('data-bs-theme', finalTheme);
      this.updateThemeColor(); // Update meta tag warna

      // 3. Sekarang, tampilkan overlay. Warnanya akan konsisten dengan tema akhir.
      this.isLoading = true;
      this.loadingText = loadingText;

      // 4. Beri jeda singkat agar UI (overlay) sempat ditampilkan sebelum reload
      await new Promise(resolve => setTimeout(resolve, 300));

      // 5. Reload halaman
      window.location.reload();
    },

    // REVISI: Method lama diubah untuk memanggil metode terpusat.
    async reloadAndToggleTheme() {
      await this.performPageReload({ toggleTheme: true, loadingText: 'Mengganti tema...' });
    },

    // Method global untuk mencatat riwayat aksi
    async logAction(actionType, details) {
      try {
        await DB.saveData('RIWAYAT_AKSI', {
          timestamp: new Date().toISOString(),
          action: actionType,
          status: 'success',
          message: details.message || `${actionType} action performed`,
          ...details
        });
      } catch (error) {
        // console.error('Error logging action:', error);
      }
    }
  }
});

// Mount the app
app.mount('#app');
