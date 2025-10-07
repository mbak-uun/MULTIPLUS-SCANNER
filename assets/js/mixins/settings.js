// assets/js/mixins/settings.js
// Mixin untuk mengelola Setting Global dan Setting Filter

const SETTING_GLOBAL_KEY = 'SETTING_GLOBAL';

const settingsMixin = {
  data() {
    return {
      // Setting Global - null berarti belum dimuat
      globalSettings: null,
      // Setting Filter - per chain
      filterSettings: {},
      // Form untuk edit settings
      settingsForm: null,
      // Validation flags
      isGlobalSettingsValid: false,
      isGlobalSettingsRequired: false, // Modal paksa setting
      // Loading state
      isLoadingSettings: false,
    };
  },

  computed: {
    // Check apakah setting global sudah lengkap
    isGlobalSettingsComplete() {
      if (!this.globalSettings) return false;

      const s = this.globalSettings;
      // Validasi field wajib
      if (!s.nickname || s.nickname.trim() === '') return false;
      if (!s.walletMeta || s.walletMeta.trim() === '') return false;
      if (!s.AnggotaGrup || s.AnggotaGrup < 1) return false;
      if (!s.jedaTimeGroup || s.jedaTimeGroup < 0) return false;
      if (!s.jedaPerAnggota || s.jedaPerAnggota < 0) return false;
      if (!s.WaktuTunggu || s.WaktuTunggu < 0) return false;

      // Minimal 1 chain aktif
      const activeChains = Object.values(s.config_chain || {}).filter(c => c.status);
      if (activeChains.length === 0) return false;

      // Minimal 1 CEX aktif
      const activeCEX = Object.values(s.config_cex || {}).filter(c => c.status);
      if (activeCEX.length === 0) return false;

      // Minimal 1 DEX aktif
      const activeDEX = Object.values(s.config_dex || {}).filter(c => c.status);
      if (activeDEX.length === 0) return false;

      return true;
    },

    // Daftar chain yang aktif
    activeChains() {
      if (!this.globalSettings || !this.globalSettings.config_chain) return [];
      return Object.keys(this.globalSettings.config_chain)
        .filter(key => this.globalSettings.config_chain[key].status);
    },

    // Daftar CEX yang aktif
    activeCEXs() {
      if (!this.globalSettings || !this.globalSettings.config_cex) return [];
      return Object.keys(this.globalSettings.config_cex)
        .filter(key => this.globalSettings.config_cex[key].status);
    },

    // Daftar DEX yang aktif
    activeDEXs() {
      if (!this.globalSettings || !this.globalSettings.config_dex) return [];
      return Object.keys(this.globalSettings.config_dex)
        .filter(key => this.globalSettings.config_dex[key].status);
    }
  },

  watch: {
    // Watcher dihapus - tidak ada auto-save
  },

  methods: {
    // ========== HELPER FUNCTIONS ==========

    // Clean data untuk IndexedDB (remove Vue reactivity & Proxy)
    cleanDataForDB(data) {
      if (!data) return data;

      // Convert Vue Proxy to plain object first
      const toRaw = (obj) => {
        // Check if it's a Vue 3 Proxy
        if (obj && typeof obj === 'object') {
          // Use Vue's toRaw if available
          if (window.Vue && window.Vue.toRaw) {
            return window.Vue.toRaw(obj);
          }
          // Otherwise return as-is
          return obj;
        }
        return obj;
      };

      try {
        // Convert to raw object first
        const rawData = toRaw(data);

        // Then JSON clone to ensure no circular refs
        const jsonString = JSON.stringify(rawData);
        return JSON.parse(jsonString);
      } catch (error) {
        console.error('❌ Error cleaning data with JSON:', error);

        // Fallback: Manual deep copy
        try {
          const deepCopy = (obj) => {
            if (obj === null || typeof obj !== 'object') return obj;

            // Handle Date
            if (obj instanceof Date) return new Date(obj);

            // Handle Array
            if (Array.isArray(obj)) {
              return obj.map(item => deepCopy(item));
            }

            // Handle Object
            const copy = {};
            for (const key in obj) {
              if (obj.hasOwnProperty(key)) {
                const value = obj[key];

                // Skip functions, symbols
                if (typeof value === 'function' || typeof value === 'symbol') {
                  continue;
                }

                copy[key] = deepCopy(value);
              }
            }
            return copy;
          };

          return deepCopy(toRaw(data));
        } catch (fallbackError) {
          console.error('❌ Fallback deep copy failed:', fallbackError);
          throw new Error('Tidak dapat membersihkan data untuk disimpan');
        }
      }
    },

    // ========== GENERATE DEFAULT SETTINGS ==========

    getDefaultGlobalSettings() {
      const config_cex = {};
      Object.keys(this.config.CEX).forEach(key => {
        config_cex[key] = { status: true, jeda: 30 };
      });

      const config_dex = {};
      Object.keys(this.config.DEXS).forEach(key => {
        config_dex[key] = { status: true, jeda: 100 };
      });

      const config_chain = {};
      Object.keys(this.config.CHAINS).forEach(key => {
        config_chain[key] = { status: true };
      });

      return {
        nickname: '',
        walletMeta: '',
        AnggotaGrup: 3,
        jedaTimeGroup: 1700,
        jedaPerAnggota: 600,
        WaktuTunggu: 5000,
        config_cex,
        config_dex,
        config_chain,
        telegram: {
          botToken: '',
          chatId: ''
        }
      };
    },

    getDefaultFilterSettings(chainKey) {
      // --- Penyesuaian untuk mode 'multi' ---
      if (chainKey === 'multi') {
        return {
          chainKey: 'multi',
          minPnl: 0.5,
          sortBy: 'pnl',
          sortDirection: 'desc',
          favoritOnly: false,
          autorun: false,
          autoscroll: false,
          run: 'stop', // 'run' atau 'stop'
          darkMode: false, // Default dark mode
          cex: this.activeCEXs.reduce((acc, key) => ({ ...acc, [key]: true }), {}),
          dex: this.activeDEXs.reduce((acc, key) => ({ ...acc, [key]: true }), {}),
          // 'chains' berisi status aktif untuk setiap chain di filter
          chains: this.activeChains.reduce((acc, cKey) => ({ ...acc, [cKey]: true }), {}),
          // 'pairs' berisi semua pair dari semua chain aktif, dengan format 'chain.pair'
          pairs: this.activeChains.reduce((acc, cKey) => {
            const chainConfig = this.config.CHAINS[cKey];
            if (chainConfig && chainConfig.PAIR_DEXS) {
              Object.keys(chainConfig.PAIR_DEXS).forEach(pKey => {
                acc[`${cKey}.${pKey}`] = true;
              });
            }
            return acc;
          }, {})
        };
      }

      const chainConfig = this.config.CHAINS[chainKey];
      if (!chainConfig) {
        console.error(`Chain ${chainKey} tidak ditemukan di config!`);
        return null;
      }
      return {
        chainKey: chainKey,
        minPnl: 0.5,
        sortBy: 'pnl',
        sortDirection: 'desc',
        favoritOnly: false,
        autorun: false,
        autoscroll: false,
        run: 'stop',
        darkMode: false, // Default dark mode
        cex: this.activeCEXs.reduce((acc, cKey) => ({ ...acc, [cKey]: true }), {}),
        dex: this.activeDEXs.reduce((acc, dKey) => ({ ...acc, [dKey]: true }), {}),
        // 'chains' tidak relevan untuk mode single-chain, bisa kosong
        chains: {},
        // 'pairs' hanya berisi pair dari chain ini, tapi dengan format 'chain.pair'
        pairs: Object.keys(chainConfig.PAIR_DEXS || {}).reduce((acc, pKey) => {
          acc[`${chainKey}.${pKey}`] = true;
          return acc;
        }, {})
      };
    },

    // ========== LOAD SETTINGS ==========

    async loadGlobalSettings() {
      try {
        let settings = await DB.getData('SETTING_GLOBAL', SETTING_GLOBAL_KEY);

        if (!settings) {
          console.warn('⚠️ Setting Global belum ada, generate default...');
          settings = this.getDefaultGlobalSettings();
          // JANGAN auto-save, biarkan user mengisi dulu
        } else {
          // MIGRATION: Sinkronkan dengan config terbaru
          let needsUpdate = false;

          // Tambahkan CEX baru yang belum ada di settings
          if (!settings.config_cex) settings.config_cex = {};
          Object.keys(this.config.CEX).forEach(key => {
            if (!settings.config_cex[key]) {
              settings.config_cex[key] = { status: true, jeda: 30 };
              needsUpdate = true;
              console.log(`✨ CEX baru ditambahkan: ${key}`);
            }
          });

          // Hapus CEX yang tidak ada di config (clean up)
          Object.keys(settings.config_cex).forEach(key => {
            if (!this.config.CEX[key]) {
              delete settings.config_cex[key];
              needsUpdate = true;
              console.log(`🗑️ CEX dihapus dari settings: ${key}`);
            }
          });

          // Tambahkan DEX baru yang belum ada di settings
          if (!settings.config_dex) settings.config_dex = {};
          Object.keys(this.config.DEXS).forEach(key => {
            if (!settings.config_dex[key]) {
              settings.config_dex[key] = { status: true, jeda: 100 };
              needsUpdate = true;
              console.log(`✨ DEX baru ditambahkan: ${key}`);
            }
          });

          // Hapus DEX yang tidak ada di config (clean up)
          Object.keys(settings.config_dex).forEach(key => {
            if (!this.config.DEXS[key]) {
              delete settings.config_dex[key];
              needsUpdate = true;
              console.log(`🗑️ DEX dihapus dari settings: ${key}`);
            }
          });

          // Tambahkan Chain baru yang belum ada di settings
          if (!settings.config_chain) settings.config_chain = {};
          Object.keys(this.config.CHAINS).forEach(key => {
            if (!settings.config_chain[key]) {
              settings.config_chain[key] = { status: true };
              needsUpdate = true;
              console.log(`✨ Chain baru ditambahkan: ${key}`);
            }
          });

          // Hapus Chain yang tidak ada di config (clean up)
          Object.keys(settings.config_chain).forEach(key => {
            if (!this.config.CHAINS[key]) {
              delete settings.config_chain[key];
              needsUpdate = true;
              console.log(`🗑️ Chain dihapus dari settings: ${key}`);
            }
          });

          // Auto-save jika ada perubahan
          if (needsUpdate) {
            console.log('💾 Auto-saving settings setelah migration...');
            await DB.saveData('SETTING_GLOBAL', this.cleanDataForDB(settings), SETTING_GLOBAL_KEY);
          }
        }

        this.globalSettings = settings;
        this.isGlobalSettingsValid = this.isGlobalSettingsComplete;
        // Pastikan status modal mengikuti validasi terbaru
        this.isGlobalSettingsRequired = !this.isGlobalSettingsValid;

        // Jika settings tidak lengkap, paksa user untuk mengisi
        // if (!this.isGlobalSettingsValid) {
        //   this.showToast('⚠️ Harap Setting Aplikasi terlebih dahulu!', 'warning', 8000);
        // }

        return settings;
      } catch (error) {
        console.error('❌ Error loading global settings:', error);
        this.showToast('Gagal memuat setting global!', 'danger');
        return null;
      }
    },

    async loadFilterSettings(chainKey) {
      try {
        const storeName = DB.getStoreNameByChain('SETTING_FILTER', chainKey);
        const storeKey = 'SETTING_FILTER';

        let loadedSettings = await DB.getData(storeName, storeKey);

        if (!loadedSettings) {
          console.log(`📋 Filter ${chainKey} belum ada, generate default...`);
          loadedSettings = this.getDefaultFilterSettings(chainKey);

          if (loadedSettings) {
            // Pastikan record selalu memiliki key dan chainKey sebelum disimpan
            loadedSettings.key = storeKey;
            loadedSettings.chainKey = chainKey;
            await DB.saveData(storeName, loadedSettings, storeKey);
          }
        } else if (!loadedSettings.key || loadedSettings.key !== storeKey) {
          // Normalisasi data lama yang belum memiliki properti key
          loadedSettings.key = storeKey;
          loadedSettings.chainKey = chainKey;
          await DB.saveData(storeName, loadedSettings, storeKey);
        }

        // REVISI: Langsung update state filterSettings DAN state filters (UI)
        // Ini adalah langkah kunci untuk memastikan UI selalu sinkron.
        let plainSettings = loadedSettings || {};
        try {
          plainSettings = JSON.parse(JSON.stringify(plainSettings));
        } catch (cloneError) {
          console.warn('⚠️ Gagal melakukan JSON clone pada filter settings, menggunakan data asli.', cloneError);
        }
        this.filterSettings = plainSettings;

        const {
          chains = {},
          cex = {},
          dex = {},
          pairs = {},
          key: _storeKey,
          chainKey: _storeChain,
          ...scalarFilters
        } = plainSettings;

        this.filters = {
          ...this.filters,
          ...scalarFilters,
          chains,
          cex,
          dex,
          pairs
        };

        // Auto-apply dark mode
        if (this.filterSettings.darkMode !== undefined) {
          const theme = this.filterSettings.darkMode ? 'dark' : 'light';
          document.documentElement.setAttribute('data-bs-theme', theme);
        }

        console.log(`✅ Filter settings loaded for ${chainKey}`);
        return this.filterSettings;
      } catch (error) {
        console.error(`❌ Error loading filter settings for ${chainKey}:`, error);
        return null;
      }
    },

    async loadAllSettings() {
      this.isLoadingSettings = true;
      this.isLoading = true;
      this.loadingText = 'Memuat pengaturan...';

      try {
        // 1. Load global settings dulu (WAJIB)
        await this.loadGlobalSettings();

        // 2. Jika global settings tidak valid, STOP di sini
        if (!this.isGlobalSettingsValid) {
          console.warn('⚠️ Global settings tidak valid, skip loading filter');
          this.isLoading = false;
          this.isLoadingSettings = false;
          return;
        }

        // 3. Load filter settings untuk chain aktif
        await this.loadFilterSettings(this.activeChain);

        console.log('✅ Semua pengaturan berhasil dimuat.');
      } catch (error) {
        console.error('❌ Error loading settings:', error);
        this.showToast('Gagal memuat pengaturan!', 'danger');
      } finally {
        this.isLoading = false;
        this.isLoadingSettings = false;
      }
    },

    // ========== SAVE SETTINGS ==========

    loadSettingsForm() {
      // Clone globalSettings untuk editing (clean copy)
      const source = this.globalSettings || this.getDefaultGlobalSettings();
      this.settingsForm = this.cleanDataForDB(source);

      console.log('📋 Settings form loaded:', this.settingsForm);
    },

    async saveGlobalSettings() {
      if (!this.settingsForm) return;

      const form = this.settingsForm;

      // Validasi field wajib
      if (!form.nickname || form.nickname.trim() === '') {
        return this.showToast('❌ Nickname tidak boleh kosong!', 'danger');
      }
      const walletMetaTrimmed = form.walletMeta ? form.walletMeta.trim() : '';
      if (!walletMetaTrimmed) {
        return this.showToast('❌ Alamat Wallet tidak boleh kosong!', 'danger');
      }
      // Validasi format alamat Ethereum
      const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
      if (!ethAddressRegex.test(walletMetaTrimmed)) {
        return this.showToast('❌ Format Alamat Wallet tidak valid. Format Alamat Walle (0x...).', 'danger');
      }

      // Validasi Anggota Grup
      const anggotaGrup = Number(form.AnggotaGrup);
      if (!anggotaGrup || anggotaGrup < 1 || anggotaGrup > 5) {
        return this.showToast('❌ Anggota Grup harus antara 1 sampai 5!', 'danger');
      }

      // Validasi field numerik
      const numericFields = {
        'Jeda Time Group': form.jedaTimeGroup,
        'Jeda Per Anggota': form.jedaPerAnggota,
        'Waktu Tunggu': form.WaktuTunggu
      };

      for (const [label, value] of Object.entries(numericFields)) {
        if (typeof value !== 'number' || value < 0) {
          return this.showToast(`❌ ${label} harus berupa angka positif!`, 'danger');
        }
      }

      // Validasi delay CEX dan DEX
      for (const [key, config] of Object.entries(form.config_cex || {})) {
        if (config.status && (typeof config.jeda !== 'number' || config.jeda < 0)) {
          return this.showToast(`❌ Jeda untuk ${key.toUpperCase()} harus berupa angka positif!`, 'danger');
        }
      }

      for (const [key, config] of Object.entries(form.config_dex || {})) {
        if (config.status && (typeof config.jeda !== 'number' || config.jeda < 0)) {
          return this.showToast(`❌ Jeda untuk ${key.toUpperCase()} harus berupa angka positif!`, 'danger');
        }
      }

      // Validasi minimal 1 aktif
      const activeChains = Object.values(form.config_chain || {}).filter(c => c.status);
      if (activeChains.length === 0) {
        return this.showToast('❌ Minimal 1 Chain harus aktif!', 'danger');
      }

      const activeCEX = Object.values(form.config_cex || {}).filter(c => c.status);
      if (activeCEX.length === 0) {
        return this.showToast('❌ Minimal 1 CEX harus aktif!', 'danger');
      }

      const activeDEX = Object.values(form.config_dex || {}).filter(c => c.status);
      if (activeDEX.length === 0) {
        return this.showToast('❌ Minimal 1 DEX harus aktif!', 'danger');
      }

      // Save
      this.isLoading = true;
      this.loadingText = 'Menyimpan pengaturan global...';

      try {
        // Clean data - hilangkan Vue reactivity
        const cleanData = this.cleanDataForDB(form);

        console.log('💾 Saving clean data:', cleanData);

        // Simpan ke database
        await DB.saveData('SETTING_GLOBAL', cleanData, SETTING_GLOBAL_KEY);

        // Update state lokal
        this.globalSettings = cleanData;
        this.isGlobalSettingsValid = true;
        this.isGlobalSettingsRequired = false;

        // Log ke riwayat
        await this.logSettings('save_global', 'success',
          `Pengaturan global berhasil disimpan dengan ${cleanData.activeCEXs?.length || 0} CEX aktif dan ${cleanData.activeDEXs?.length || 0} DEX aktif`,
          { chains: cleanData.activeChains, cexs: cleanData.activeCEXs, dexs: cleanData.activeDEXs }
        );

        this.showToast('✅ Pengaturan Global berhasil disimpan!', 'success');

        // Langsung arahkan kembali ke menu utama (mode) setelah berhasil menyimpan
        this.activeMenu = 'mode';
        console.log('✅ Pengaturan disimpan, mengarahkan ke menu utama.');

      } catch (error) {
        console.error('❌ Error saving global settings:', error);
        console.error('❌ Form data:', form);

        // Tampilkan error detail
        let errorMsg = error.message;
        if (error.name === 'DataCloneError') {
          errorMsg = 'Data mengandung nilai yang tidak bisa disimpan. Periksa console untuk detail.';
        }

        // Log error ke riwayat
        await this.logSettings('save_global', 'error',
          `Gagal menyimpan pengaturan: ${errorMsg}`,
          { error: error.message }
        );

        this.showToast('Gagal menyimpan pengaturan: ' + errorMsg, 'danger');
      } finally {
        this.isLoading = false;
      }
    },

  }
};
