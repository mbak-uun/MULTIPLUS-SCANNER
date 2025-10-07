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
    'filter-settings': FilterSettings,
    'tab-navigation': TabNavigation
    // Komponen anak scanning sudah digabung ke dalam scanning-tab
  },

  data() {
    return {
      // --- Core Application Data ---
      config: KONFIG_APLIKASI, // Load entire configuration
      // Menu & Navigation
      activeMenu: 'mode',
      activeTab: 'scan',
      activeChain: 'multi', // Default ke multi-chain
      showFilterSidebar: true, // Untuk toggle filter sidebar

      // Loading States
      searchQuery: '', // REVISI: Dipindahkan ke root untuk bisa diakses global
      isLoading: true, // Start with true untuk boot overlay
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

      // Coin data untuk filtering count
      allCoins: [] // Loaded dari tabel KOIN_<chain>
    };
  },

  async mounted() {
    // Inisialisasi Database
    try {
      console.log('⚙️ [1/5] Menginisialisasi Database...');
      await DB.initDB();
      this.dbStatus = 'success';

      // FIX: Tandai bahwa inisialisasi selesai SEBELUM memuat pengaturan.
      // Ini akan memberi sinyal ke komponen anak (seperti scanning-tab) bahwa DB sudah siap.
      this.isAppInitialized = true;
      console.log('🚀 [PRE-INIT] Database siap, aplikasi siap untuk memuat data.');

      const allStores = DB.getAllStoreNames();
    //  console.log('📦 Database berhasil dimuat dengan stores:', allStores);
     // console.log(`✅ Total ${allStores.length} stores dibuat`);

     // this.showToast('Database berhasil dimuat.', 'success');

      // Muat semua pengaturan setelah DB siap
      console.log('⚙️ [2/5] Memuat semua pengaturan...');
      await this.loadAllSettings();

      // ⚠️ GUARD: Jika global settings tidak valid, tampilkan modal
      if (!this.isGlobalSettingsValid) {
        console.warn('🔴 [CHECK FAILED] Pengaturan global tidak lengkap atau tidak valid. Menampilkan modal.');
        this.isGlobalSettingsRequired = true;

        // PERBAIKAN UX: Tampilkan notifikasi yang jelas
        setTimeout(() => {
          this.showToast('⚠️ Pengaturan Global belum lengkap! Silakan isi Wallet Address, Chain, dan CEX terlebih dahulu.', 'warning', 8000);
        }, 1000);
      } else {
        console.log('🟢 [CHECK OK] Pengaturan global valid.');

        // REFAKTOR: Inisialisasi Web3Service secara terpusat
        if (window.Web3Service && !this.web3Service) {
          this.web3Service = new window.Web3Service(this.config);
          console.log('✅ Web3Service initialized globally.');
        }
        // Inisialisasi RealtimeDataFetcher
        if (window.RealtimeDataFetcher && !this.realtimeDataFetcher) {
          this.realtimeDataFetcher = new window.RealtimeDataFetcher(this.config, window.Http);
          console.log('✅ RealtimeDataFetcher initialized globally.');
        }
      }

    } catch (error) {
      this.dbStatus = 'error';
      console.error('Gagal menginisialisasi database dari app.js:', error);
      this.showToast('Gagal memuat database.', 'danger');
    }

    // Proses parameter URL untuk mengatur state awal (hanya jika settings valid)
    console.log('⚙️ [3/5] Memproses parameter URL...');
    if (this.isGlobalSettingsValid) {
      this.processURLParams();
      // SOLUSI 1: Panggil updateThemeColor() secara eksplisit setelah URL diproses.
      // Ini memastikan tema diterapkan dengan benar saat halaman pertama kali dimuat dengan parameter chain.
      this.updateThemeColor();
      // Load coins untuk filter count
      console.log('⚙️ [4/5] Memuat data koin untuk filter...');
      await this.loadCoinsForFilter();
    } else {
      console.log('🟡 [SKIP] Melewatkan pemrosesan URL dan pemuatan koin karena pengaturan global tidak valid.');
    }

    // Hide boot overlay
    setTimeout(() => {
      this.isBooting = false;
      this.isLoading = false;
      document.body.classList.remove('app-loading');
    }, 500);

    // isAppInitialized sudah dipindahkan ke atas setelah DB init.
    console.log('🚀 [5/5] Aplikasi selesai dimuat!');
  },

  watch: {
    async activeChain(newValue, oldValue) {
      // Jangan jalankan watcher ini selama proses inisialisasi awal
      if (!this.isAppInitialized) {
        console.log('🔄 [WATCHER-CHAIN] Ditunda, aplikasi belum terinisialisasi.');
        return;
      }
      console.log(`🔄 [WATCHER-CHAIN] Chain berubah dari '${oldValue}' ke '${newValue}'.`);

      // Guard: Jika global settings tidak valid, block
      if (!this.isGlobalSettingsValid) {
        console.warn('⚠️ Global settings belum valid, block navigation');
        return;
      }

      // Skip reload jika:
      // 1. Inisialisasi pertama (oldValue undefined)
      // 2. Perubahan dari processURLParams (cek apakah sudah sesuai URL)
      const urlParams = new URLSearchParams(window.location.search);
      const urlChain = urlParams.get('chain') || 'multi';

      // Hanya reload jika user AKTIF ganti chain (bukan dari URL params)
      if (oldValue !== undefined && oldValue !== newValue && urlChain === oldValue) {
        // Reload halaman saat ganti chain untuk refresh data
        this.isLoading = true;
        this.loadingText = `Memuat data untuk ${newValue.toUpperCase()}...`;

        // SOLUSI 2: Panggil updateThemeColor() SEBELUM me-reload halaman.
        // Ini memberikan feedback visual instan kepada pengguna bahwa chain telah berganti.
        this.updateThemeColor();

        this.updateURL('chain', newValue);

        // Delay untuk smooth transition
        await new Promise(resolve => setTimeout(resolve, 300));

        // Reload halaman dengan parameter chain baru
        window.location.reload();
        return;
      }

      this.updateURL('chain', newValue);
      this.updateThemeColor();
      this.initializeFilters(); // Re-initialize filters for the new chain
      await this.loadFilterSettings(newValue);
      await this.loadCoinsForFilter(); // Load coins untuk filter count
    },

    // REVISI: Watcher ini sekarang mengawasi seluruh objek filterSettings.
    // Ini memastikan tema diperbarui baik saat properti darkMode diubah (toggle)
    // maupun saat seluruh objek diganti (berpindah chain).
    filterSettings: {
        deep: true,
        handler(newSettings) {
            const theme = newSettings.darkMode ? 'dark' : 'light';
            document.documentElement.setAttribute('data-bs-theme', theme);
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
      // REFAKTOR: Menghilangkan prefix 'chain.pair' dan menyajikan daftar pair yang unik.
      const uniquePairs = new Set();

      if (this.activeChain !== 'multi') {
        // Mode single-chain: hanya tampilkan pair untuk chain yang aktif
        const chainConf = this.config.CHAINS[this.activeChain];
        if (chainConf && chainConf.PAIR_DEXS) {
          Object.keys(chainConf.PAIR_DEXS).forEach(pairKey => uniquePairs.add(pairKey));
        }
      } else {
        // Mode multi-chain: kumpulkan semua pair dari chain yang dipilih di filter
        for (const chainKey in this.filters.chains) {
          const isChainSelectedInFilter = this.filters.chains[chainKey];
          if (isChainSelectedInFilter) {
            const chainConf = this.config.CHAINS[chainKey];
            if (chainConf && chainConf.PAIR_DEXS) {
              Object.keys(chainConf.PAIR_DEXS).forEach(pairKey => uniquePairs.add(pairKey));
            }
          }
        }
      }
      // Mengembalikan array dari pair unik, contoh: ['BNB', 'USDT', 'ETH', 'NON', 'USDC']
      return Array.from(uniquePairs);
    },

    // Computed property untuk menentukan apakah filter panel harus ditampilkan
    shouldShowFilterPanel() {
      const filterIsAvailableForTab = ['scan', 'manajemen'].includes(this.activeTab);
      // Tampilkan jika toggle aktif DAN tab saat ini adalah 'scan' atau 'manajemen'
      return this.showFilterSidebar && filterIsAvailableForTab;
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

    // Computed: Count koin per Chain
    coinCountByChain() {
      const counts = {};
      this.allCoins.forEach(coin => {
        if (coin.id === 'DATA_KOIN') return;
        const chain = String(coin.chain || '').toLowerCase();
        if (chain) counts[chain] = (counts[chain] || 0) + 1;
      });
      return counts;
    },

    // Computed: Count koin per CEX
    coinCountByCex() {
        const counts = {};
        this.allCoins.forEach(coin => {
            if (coin.id === 'DATA_KOIN' || !coin.cex_name) return;
            // REFACTOR: Langsung baca dari field cex_name
            const lowerCexKey = coin.cex_name.toLowerCase();
            counts[lowerCexKey] = (counts[lowerCexKey] || 0) + 1;
        });
        return counts;
    },

    // Computed: Count koin per DEX
    coinCountByDex() {
        const counts = {};
        this.allCoins.forEach(coin => {
            if (coin.id === 'DATA_KOIN' || !coin.dex || typeof coin.dex !== 'object') return;
            // Iterasi melalui semua DEX yang ada di dalam objek coin.dex
            // dan hanya hitung jika statusnya true
            Object.keys(coin.dex).forEach(dexKey => {
                // Cek apakah status DEX adalah true
                if (coin.dex[dexKey] && coin.dex[dexKey].status) {
                    const dex = dexKey.toLowerCase();
                    counts[dex] = (counts[dex] || 0) + 1;
                }
            });
        });
        return counts;
    },

    // Computed: Count koin per Pair (format: chain.pair)
    coinCountByPair() {
      // REFAKTOR: Inisialisasi semua pair yang valid dari `pairList` dengan hitungan 0.
      // Ini memastikan semua opsi pair dari config_app.js muncul di filter, bahkan jika hitungannya 0.
      const counts = this.pairList.reduce((acc, pairKey) => {
        acc[pairKey.toUpperCase()] = 0;
        return acc;
      }, {});

      // Sekarang, hitung jumlah koin dari data yang ada.
      this.allCoins.forEach(coin => {
        if (coin.id === 'DATA_KOIN') return;
        
        // Ambil nama pair dari data koin.
        // Jika tidak ada atau kosong, anggap sebagai 'NON'.
        let pairKey = String(coin.nama_pair || 'NON').toUpperCase();
        
        // Hanya hitung jika pairKey ada di dalam daftar counts (yang berasal dari pairList).
        if (counts.hasOwnProperty(pairKey)) {
          counts[pairKey] = (counts[pairKey] || 0) + 1;
        }
      });
      return counts;
    }
  },
  methods: {
    // Handler untuk tombol "Mulai Isi Setting" di modal
    handleStartSettings() {
      console.log('🔘 Tombol "Mulai Isi Setting" diklik.');
      this.isGlobalSettingsRequired = false; // Sembunyikan modal
      this.activeMenu = 'settings'; // Tampilkan menu settings
      this.loadSettingsForm(); // Pastikan form settings dimuat
      console.log('➡️ Mengarahkan ke menu pengaturan.');
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
      console.log('Filter diinisialisasi ulang untuk chain:', this.activeChain);
    },

    reloadActiveTab() {
      console.log('Reloading active tab:', this.activeTab);
      this.isLoading = true;
      this.loadingText = 'Refreshing data...';

      setTimeout(() => {
        // Di sini Anda bisa menambahkan logika refresh yang spesifik untuk setiap tab
        // Contoh:
        // if (this.activeTab === 'scan') this.fetchScanData();
        // if (this.activeTab === 'management') this.loadCoins();
        console.log(`Data untuk tab ${this.activeTab} di-refresh.`);
        this.isLoading = false;
      }, 1000);
    },

    // Load all coins untuk keperluan filter count
    async loadCoinsForFilter() {
      if (!this.activeChain) return;

      console.log(`📊 Memuat koin untuk filter count (Chain: ${this.activeChain})...`);

      const isMultiChainMode = this.activeChain === 'multi';

      // MULTICHAIN MODE: Load hanya favorit dari semua chain aktif
      if (isMultiChainMode) {
        console.log('🌟 [MULTICHAIN MODE] Memuat hanya koin favorit dari semua chain aktif...');
        let allFavorites = [];

        // Load dari chain yang aktif saja (yang dicentang di global settings)
        const chainsToLoad = this.activeChains || [];

        for (const chainKey of chainsToLoad) {
          const storeName = DB.getStoreNameByChain('KOIN', chainKey);
          try {
            const chainCoins = await DB.getAllData(storeName);
            // Filter hanya favorit
            const favoriteCoins = chainCoins
              .filter(coin => coin.id !== 'DATA_KOIN')
              .filter(coin => coin.isFavorite || coin.isFavorit)
              .map(coin => {
                const namaTokenFromTicker = (coin.cex_ticker_token || '').replace(/USDT|IDR|BUSD/g, '');
                return {
                  ...coin,
                  chain: coin.chain || chainKey.toUpperCase(),
                  nama_token: coin.nama_token || namaTokenFromTicker
                };
              });

            allFavorites.push(...favoriteCoins);
            console.log(`✅ ${favoriteCoins.length} favorit dari ${chainKey.toUpperCase()}`);
          } catch (error) {
            console.warn(`⚠️ Gagal memuat favorit dari ${chainKey}:`, error);
          }
        }

        this.allCoins = allFavorites;
        console.log(`🌟 [MULTICHAIN] Total ${this.allCoins.length} koin favorit dimuat dari ${chainsToLoad.length} chain.`);
        return;
      }

      // SINGLE CHAIN MODE: Load semua koin dari semua chain untuk filter count
      // REVISI: Selalu muat data dari SEMUA chain yang ada di config.
      // Ini memastikan `coinCountByChain` selalu memiliki data lengkap untuk ditampilkan di filter.
      const chainsToLoad = Object.keys(this.config.CHAINS || {});

      let allCoins = [];
      for (const chainKey of chainsToLoad) {
        const storeName = DB.getStoreNameByChain('KOIN', chainKey);
        try {
          const chainCoins = await DB.getAllData(storeName);
          // REVISI: Tambahkan properti 'chain' ke setiap koin.
          const coinsWithChain = chainCoins.map(coin => {
            const namaTokenFromTicker = (coin.cex_ticker_token || '').replace(/USDT|IDR|BUSD/g, '');
            return { ...coin,
              chain: coin.chain || chainKey,
              nama_token: coin.nama_token || namaTokenFromTicker
            };
          });
          allCoins.push(...coinsWithChain);

        } catch (error) {
          console.warn(`⚠️ Gagal memuat data dari ${storeName}:`, error);
        }
      }

      this.allCoins = allCoins;
      console.log(`✅ Total ${this.allCoins.length} koin dimuat untuk filter count.`);
    },

    // REFACTOR: Method ini digantikan oleh filterAutoSaveMixin
    // Tetap dipertahankan untuk backward compatibility dan untuk akses dari $root
    async saveFilterChange(filterType) {
      if (!this.filterSettings || !this.filterSettings.chainKey) {
        console.warn('[App] Chain key tidak ditemukan di filterSettings');
        return;
      }

      const chainKey = this.filterSettings.chainKey;
      console.log(`[App] Saving filter change "${filterType}" for chain: ${chainKey}`);

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

        console.log(`✅ Filter ${filterType} disimpan untuk ${chainKey}`);

        // Log aksi perubahan filter
        if (['cex', 'dex', 'chains', 'pairs'].includes(filterType)) {
          this.logAction('UPDATE_FILTER', {
            message: `Filter '${filterType}' untuk chain '${chainKey.toUpperCase()}' telah diubah.`,
            chain: chainKey
          });
        }
      } catch (error) {
        console.error('❌ Error saving filter:', error);
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
      }
    },

  // REVISI: Method baru untuk reload halaman dan ganti tema
  async reloadAndToggleTheme() {
    // 1. Toggle status darkMode di filterSettings
    const newDarkModeStatus = !this.filterSettings.darkMode;
    this.filterSettings.darkMode = newDarkModeStatus;
    if (typeof this.filters === 'object' && this.filters !== null) {
      this.filters.darkMode = newDarkModeStatus;
    }

    const theme = newDarkModeStatus ? 'dark' : 'light';

    // Apply theme immediately for visual feedback sebelum reload
    document.documentElement.setAttribute('data-bs-theme', theme);

    // PERBAIKAN: Sync tema ke localStorage untuk prevent flash saat refresh
    localStorage.setItem('darkMode_' + this.activeChain, theme);
    localStorage.setItem('darkMode', theme); // Fallback global
    console.log(`[Theme Reload] Saved theme to localStorage: ${theme} for chain: ${this.activeChain}`);

    // 2. Simpan perubahan filter (termasuk darkMode) ke DB
    // Ini memastikan tema yang baru akan dimuat setelah reload
    await this.saveFilterChange('darkMode');

      // 3. Tampilkan loading overlay
      this.isLoading = true;
      this.loadingText = 'Memuat ulang & mengganti tema...';

      // 4. Beri jeda singkat agar user melihat feedback
      await new Promise(resolve => setTimeout(resolve, 300));

      // 5. Reload halaman
      window.location.reload();
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
        console.error('Error logging action:', error);
      }
    }
  }
});

// Mount the app
app.mount('#app');
