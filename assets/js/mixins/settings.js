// assets/js/mixins/settings.js

const settingsMixin = {
  data() {
    return {
      // --- Settings Menu Data ---
      globalSettings: {},
      filterSettings: {}, // REVISI: Dipindahkan dari app.js ke mixin
      isGlobalSettingsRequired: false,
      isGlobalSettingsValid: false,
      settingsForm: {
        // Struktur default untuk form
        nickname: '',
        walletMeta: '',
        AnggotaGrup: 3,
        jedaTimeGroup: 1000,
        jedaPerAnggota: 200,
        WaktuTunggu: 5000,
        modalUsd: 100,
        usdtRate: 16000,
        config_chain: {},
        config_cex: {},
        config_dex: {},
        telegram: {
          botToken: '',
          chatId: ''
        }
      }
    };
  },
  computed: {
    activeChains() {
      if (!this.globalSettings || !this.globalSettings.config_chain) return [];
      return Object.keys(this.globalSettings.config_chain)
        .filter(key => this.globalSettings.config_chain[key]?.status);
    },
    activeCEXs() {
      if (!this.globalSettings || !this.globalSettings.config_cex) return [];
      return Object.keys(this.globalSettings.config_cex)
        .filter(key => this.globalSettings.config_cex[key]?.status);
    },
    activeDEXs() {
      if (!this.globalSettings || !this.globalSettings.config_dex) return [];
      return Object.keys(this.globalSettings.config_dex)
        .filter(key => this.globalSettings.config_dex[key]?.status);
    }
  },
  methods: {
    async loadAllSettings() {
      await this.loadGlobalSettings();
      this.initializeFilters(); // Inisialisasi struktur filter
      await this.loadFilterSettings(this.activeChain); // Muat data filter dari DB
    },

    async loadGlobalSettings() {
      try {
        const settingsRepo = window.AppContainer.get('settingsRepository');
        // REFACTOR: Menggunakan metode spesifik `getGlobal` yang sesuai dengan pola repository ini.
        const settings = await settingsRepo.getGlobal();

        if (settings && Object.keys(settings).length > 1) {
          this.globalSettings = settings;
          this.isGlobalSettingsValid = this.validateGlobalSettings(settings);
          this.isGlobalSettingsRequired = !this.isGlobalSettingsValid;
          console.log('⚙️ Global settings loaded:', { settings, isValid: this.isGlobalSettingsValid });
        } else {
          console.warn('⚠️ Global settings not found or empty. Applying defaults from config.');
          const defaultSettings = this.createDefaultGlobalSettings();
          await settingsRepo.saveGlobal(defaultSettings);
          this.globalSettings = defaultSettings;
          this.isGlobalSettingsValid = this.validateGlobalSettings(defaultSettings);
          this.isGlobalSettingsRequired = !this.isGlobalSettingsValid;
          console.log('🟢 Default global settings saved.', { settings: defaultSettings, isValid: this.isGlobalSettingsValid });
        }
      } catch (error) {
        console.error('❌ Error loading global settings:', error);
        this.isGlobalSettingsValid = false;
        this.isGlobalSettingsRequired = true;
      }
    },

    validateGlobalSettings(settings) {
      if (!settings) return false;
      const hasWallet = !!settings.walletMeta;
      const hasActiveChain = settings.config_chain && Object.values(settings.config_chain).some(c => c.status);
      const hasActiveCex = settings.config_cex && Object.values(settings.config_cex).some(c => c.status);
      return hasWallet && hasActiveChain && hasActiveCex;
    },

    async loadFilterSettings(chainKey) {
      const settingsRepo = window.AppContainer.get('settingsRepository');
      let loadedSettings = await settingsRepo.getFilterSettings(chainKey);

      // Jika tidak ada setting tersimpan, buat default
      if (!loadedSettings || Object.keys(loadedSettings).length <= 2) { // <=2 untuk handle {key, chainKey}
        console.log(`No saved filter for "${chainKey}". Creating default.`);
        loadedSettings = this.createDefaultFilterSettings(chainKey);
      }

      // **PERBAIKAN UTAMA**: Pastikan filter 'chains' diisi untuk mode multi-chain
      if (chainKey === 'multi' && (!loadedSettings.chains || Object.keys(loadedSettings.chains).length === 0)) {
        console.log("Multi-chain filter is empty. Initializing with all active chains.");
        loadedSettings.chains = this.activeChains.reduce((acc, key) => {
          acc[key] = true; // Aktifkan semua chain yang tersedia secara default
          return acc;
        }, {});
      }

      // Gabungkan default dengan yang dimuat untuk memastikan semua properti ada
      const defaultFilters = this.createDefaultFilterSettings(chainKey);
      const mergedSettings = {
        ...defaultFilters,
        ...loadedSettings,
        // Pastikan objek filter tidak undefined
        chains: { ...defaultFilters.chains, ...(loadedSettings.chains || {}) },
        cex: { ...defaultFilters.cex, ...(loadedSettings.cex || {}) },
        dex: { ...defaultFilters.dex, ...(loadedSettings.dex || {}) },
        pairs: { ...defaultFilters.pairs, ...(loadedSettings.pairs || {}) },
      };

      // Update state aplikasi
      this.filterSettings = mergedSettings;
      this.filters = {
        ...this.filters,
        ...mergedSettings
      };

      console.log(`✅ Filter settings for "${chainKey}" loaded and merged.`, this.filters);
    },

    createDefaultFilterSettings(chainKey) {
      const config = this.config;

      const createFilterObject = (list) => list.reduce((acc, key) => {
        acc[key.toLowerCase()] = true; // Default semua aktif
        return acc;
      }, {});

      return {
        key: 'SETTING_FILTER',
        chainKey: chainKey,
        minPnl: 0,
        sortDirection: 'desc',
        favoritOnly: false,
        autorun: false,
        autoscroll: false,
        darkMode: false,
        run: 'stop',
        chains: createFilterObject(this.activeChains),
        cex: createFilterObject(this.activeCEXs),
        dex: createFilterObject(this.activeDEXs),
        pairs: {} // Pair defaultnya kosong, akan diisi oleh UI
      };
    },

    async saveGlobalSettings() {
      try {
        // PERBAIKAN UX: Validasi sebelum save
        const hasWallet = !!this.settingsForm.walletMeta?.trim();
        const hasActiveChain = this.settingsForm.config_chain &&
          Object.values(this.settingsForm.config_chain).some(c => c.status);
        const hasActiveCex = this.settingsForm.config_cex &&
          Object.values(this.settingsForm.config_cex).some(c => c.status);

        // Tampilkan pesan error spesifik
        if (!hasWallet) {
          this.showToast('❌ Alamat Wallet wajib diisi!', 'danger', 5000);
          return;
        }
        if (!hasActiveChain) {
          this.showToast('❌ Pilih minimal 1 Chain (BSC/Polygon/Arbitrum/dll)!', 'danger', 5000);
          return;
        }
        if (!hasActiveCex) {
          this.showToast('❌ Pilih minimal 1 CEX (Binance/Gate/MEXC/dll)!', 'danger', 5000);
          return;
        }

        const settingsRepo = window.AppContainer.get('settingsRepository');
        const settingsToSave = JSON.parse(JSON.stringify(this.settingsForm));
        await settingsRepo.saveGlobal(settingsToSave);

        this.showToast('✅ Pengaturan global berhasil disimpan! Aplikasi akan reload...', 'success');
        this.logAction('SAVE_SETTINGS', { message: 'Pengaturan global telah diperbarui.' });

        // Reload halaman untuk menerapkan pengaturan baru
        this.isLoading = true;
        this.loadingText = 'Menerapkan pengaturan baru...';
        await new Promise(resolve => setTimeout(resolve, 500));
        window.location.reload();

      } catch (error) {
        console.error('❌ Error saving global settings:', error);
        this.showToast('Gagal menyimpan pengaturan!', 'danger');
      }
    },

    loadSettingsForm() {
      const settings = this.globalSettings;
      const config = this.config;

      // Fungsi untuk membuat objek konfigurasi dengan status dari data yang disimpan
      const mapConfig = (sourceConfig, savedConfig) => {
        return Object.keys(sourceConfig).reduce((acc, key) => {
          const lowerKey = key.toLowerCase();
          acc[lowerKey] = {
            status: savedConfig?.[lowerKey]?.status || false,
            jeda: savedConfig?.[lowerKey]?.jeda || (sourceConfig[key].JEDA_DEFAULT || 30)
          };
          return acc;
        }, {});
      };

      this.settingsForm = {
        key: 'SETTING_GLOBAL',
        nickname: settings.nickname || '',
        walletMeta: settings.walletMeta || '',
        AnggotaGrup: settings.AnggotaGrup || 3,
        jedaTimeGroup: settings.jedaTimeGroup || 1000,
        jedaPerAnggota: settings.jedaPerAnggota || 200,
        WaktuTunggu: settings.WaktuTunggu || 5000,
        modalUsd: settings.modalUsd || 100,
        usdtRate: settings.usdtRate || 16000,
        config_chain: mapConfig(config.CHAINS, settings.config_chain),
        config_cex: mapConfig(config.CEX, settings.config_cex),
        config_dex: mapConfig(config.DEXS, settings.config_dex),
        telegram: {
          botToken: settings.telegram?.botToken || '',
          chatId: settings.telegram?.chatId || ''
        }
      };
      console.log('Settings form loaded with data:', this.settingsForm);
    },

    createDefaultGlobalSettings() {
      const mapConfig = (sourceConfig, fallbackDelay = 30) => {
        if (!sourceConfig) return {};
        return Object.keys(sourceConfig).reduce((acc, key) => {
          const lowerKey = key.toLowerCase();
          const item = sourceConfig[key] || {};
          const delay =
            item.JEDA_DEFAULT ??
            item.JEDA ??
            item.jeda ??
            fallbackDelay;
          acc[lowerKey] = {
            status: true,
            jeda: Number(delay) || fallbackDelay
          };
          return acc;
        }, {});
      };

      return {
        key: 'SETTING_GLOBAL',
        nickname: 'DEFAULT_USER',
        walletMeta: 'DEFAULT_WALLET',
        AnggotaGrup: 3,
        jedaTimeGroup: 1000,
        jedaPerAnggota: 200,
        WaktuTunggu: 5000,
        modalUsd: 100,
        usdtRate: 16000,
        config_chain: mapConfig(this.config?.CHAINS),
        config_cex: mapConfig(this.config?.CEX),
        config_dex: mapConfig(this.config?.DEXS),
        telegram: {
          botToken: '',
          chatId: ''
        }
      };
    }
  }
};
