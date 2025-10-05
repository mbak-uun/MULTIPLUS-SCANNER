// ====== MAIN VUE APPLICATION ======

// --- Logika Aplikasi Utama ---
const { createApp } = Vue;

const app = createApp({
  // Gunakan mixins untuk menggabungkan logika dari file lain
  mixins: [
    // Mixin utilitas
    utilitiesMixin,
    notificationsMixin,
    telegramMixin,
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
      } else {
        console.log('🟢 [CHECK OK] Pengaturan global valid.');
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

    // Tandai bahwa inisialisasi selesai
    this.isAppInitialized = true;
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
      const groupedPairs = {};

      if (this.activeChain !== 'multi') {
        // Mode single-chain: hanya tampilkan pair untuk chain yang aktif
        const chainConf = this.config.CHAINS[this.activeChain];
        if (chainConf && chainConf.PAIR_DEXS) {
          // KONSISTENSI: Gunakan format 'chain.pair' juga untuk single-chain
          groupedPairs[this.activeChain] = Object.keys(chainConf.PAIR_DEXS)
            .map(pairKey => `${this.activeChain}.${pairKey}`);
        }
      } else {
        // Mode multi-chain: kelompokkan pair berdasarkan chain yang dipilih di filter
        // REVISI: Gunakan `this.filters.chains` agar reaktif terhadap UI secara langsung.
        for (const chainKey in this.filters.chains) {
          const isChainSelectedInFilter = this.filters.chains[chainKey];
          // Tampilkan grup pair jika chain tersebut dipilih di filter
          if (isChainSelectedInFilter) {
            const chainConf = this.config.CHAINS[chainKey];
            if (chainConf && chainConf.PAIR_DEXS) {
              // Buat daftar pair dengan format unik: 'chain.pair'
              groupedPairs[chainKey] = Object.keys(chainConf.PAIR_DEXS)
                .map(pairKey => `${chainKey}.${pairKey}`);
            }
          }
        }
      }
      return groupedPairs;
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
      const counts = {};

      // 1. Dapatkan daftar semua pair yang terdefinisi per chain (tidak termasuk 'NON')
      const definedPairsByChain = {};
      if (this.config && this.config.CHAINS) {
        Object.keys(this.config.CHAINS).forEach(chainKey => {
          const chainConf = this.config.CHAINS[chainKey];
          if (chainConf && chainConf.PAIR_DEXS) {
            definedPairsByChain[chainKey.toLowerCase()] = Object.values(chainConf.PAIR_DEXS)
              .map(p => p.SYMBOL_PAIR.toLowerCase())
              .filter(p => p !== 'non');
          }
        });
      }

      // 2. Iterasi semua koin untuk menghitung
      this.allCoins.forEach(coin => {
        if (coin.id === 'DATA_KOIN') return;
        const chain = String(coin.chain || '').toLowerCase();
        const pair = String(coin.nama_pair || '').toLowerCase();

        if (chain && pair) {
          const definedPairs = definedPairsByChain[chain] || [];
          // Jika pair token tidak ada di daftar pair terdefinisi, hitung sebagai 'NON'
          if (!definedPairs.includes(pair)) {
            const nonPairKey = `${chain}.non`;
            counts[nonPairKey] = (counts[nonPairKey] || 0) + 1;
          } else {
            // Jika terdefinisi, hitung sebagai pair biasa
            const pairKey = `${chain}.${pair}`;
            counts[pairKey] = (counts[pairKey] || 0) + 1;
          }
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

      let chainsToLoad = [];
      if (this.activeChain === 'multi') {
        // Multi mode: load semua chain yang aktif
        chainsToLoad = this.activeChains || [];
      } else {
        // Single mode: load chain saat ini
        chainsToLoad = [this.activeChain];
      }

      let allCoins = [];
      for (const chainKey of chainsToLoad) {
        const storeName = DB.getStoreNameByChain('KOIN', chainKey);
        try {
          const chainCoins = await DB.getAllData(storeName);
          // REVISI: Tambahkan properti 'chain' ke setiap koin.
          // Ini penting agar computed properties (coinCountByCex, coinCountByPair) bisa bekerja.
          const coinsWithChain = chainCoins.map(coin => {
            // SOLUSI: Pastikan `nama_token` ada untuk konsistensi, ambil dari `cex_ticker_token`.
            // Skema baru tidak memiliki `nama_token` di root, jadi kita buat dari ticker.
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

    // REVISI: Method ini sekarang ada di root component agar bisa diakses global
    async saveFilterChange(filterType) {
      if (!this.filterSettings || !this.filterSettings.chainKey) {
        console.warn('Chain key tidak ditemukan di filterSettings');
        return;
      }

      const chainKey = this.filterSettings.chainKey;

      // Sinkronisasi dari filters (UI) ke filterSettings (state untuk DB)
      this.filterSettings.cex = this.filters.cex;
      this.filterSettings.dex = this.filters.dex;
      this.filterSettings.chains = this.filters.chains;
      this.filterSettings.pairs = this.filters.pairs;
      this.filterSettings.favoritOnly = this.filters.favoritOnly;
      this.filterSettings.autorun = this.filters.autorun;
      this.filterSettings.autoscroll = this.filters.autoscroll;
      this.filterSettings.minPnl = this.filters.minPnl;
      this.filterSettings.run = this.filters.run;

      const storeName = DB.getStoreNameByChain('SETTING_FILTER', chainKey);
      const storeKey = 'SETTING_FILTER';

      try {
        const cleanSettings = this.cleanDataForDB(this.filterSettings);
        await DB.saveData(storeName, cleanSettings, storeKey);

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
