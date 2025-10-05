// assets/js/mixins/theme.js

const themeMixin = {
  data() {
    return {
      multiChainColor: '#48d693',
    }
  },
  computed: {
    // isDarkMode sekarang menjadi computed property yang merefleksikan setting dari chain aktif
    isDarkMode() {
      return this.filterSettings ? this.filterSettings.darkMode : false;
    },

    // Menghasilkan style untuk indikator chain aktif
    activeChainColor() {
      return this.getColorStyles('chain', this.activeChain, 'soft');
    }
  },
  methods: {
    async toggleTheme() {
      if (!this.filterSettings) return;

      const nextValue = !this.filterSettings.darkMode;
      this.filterSettings.darkMode = nextValue;

      if (this.filters) {
        this.filters.darkMode = nextValue;
      }

      const theme = nextValue ? 'dark' : 'light';
      document.documentElement.setAttribute('data-bs-theme', theme);

      const chainKey = this.filterSettings.chainKey;
      if (!chainKey) {
        console.warn('Chain key tidak ditemukan saat menyimpan preferensi tema.');
        return;
      }

      try {
        const storeName = DB.getStoreNameByChain('SETTING_FILTER', chainKey);
        const storeKey = 'SETTING_FILTER';
        const cleanSettings = this.cleanDataForDB(this.filterSettings);
        await DB.saveData(storeName, cleanSettings, storeKey);

        if (typeof this.showToast === 'function') {
          this.showToast(`Mode ${nextValue ? 'gelap' : 'terang'} diaktifkan.`, 'success', 2000);
        }

        if (typeof this.logAction === 'function') {
          this.logAction('UPDATE_THEME', {
            chain: chainKey,
            darkMode: nextValue
          });
        }
      } catch (error) {
        console.error('❌ Error saving theme preference:', error);
        if (typeof this.showToast === 'function') {
          this.showToast('Gagal menyimpan preferensi tema.', 'danger');
        }
      }
    },
    normalizeHex(hex) {
      if (!hex) return '#6c757d';
      let value = hex.trim();
      if (!value.startsWith('#')) value = `#${value}`;
      if (value.length === 4) value = `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
      else if (value.length === 5) value = `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
      else if (value.length === 9) value = value.slice(0, 7);
      return value.toLowerCase();
    },
    hexToRgb(hex) {
      const normalized = this.normalizeHex(hex);
      const r = parseInt(normalized.substr(1, 2), 16) || 0;
      const g = parseInt(normalized.substr(3, 2), 16) || 0;
      const b = parseInt(normalized.substr(5, 2), 16) || 0;
      return `${r}, ${g}, ${b}`;
    },
    getContrastYIQ(hex) {
      const normalized = this.normalizeHex(hex);
      const r = parseInt(normalized.substr(1, 2), 16) || 0;
      const g = parseInt(normalized.substr(3, 2), 16) || 0;
      const b = parseInt(normalized.substr(5, 2), 16) || 0;
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return yiq >= 128 ? '#111' : '#fff';
    },
    getColorConfig(entityType, rawKey) {
      if (!rawKey) return null;
      const type = entityType.toLowerCase();
      if (type === 'chain') return this.config.CHAINS[rawKey.toLowerCase()] || null;
      if (type === 'cex') return this.config.CEX[rawKey.toUpperCase()] || null;
      if (type === 'dex') return this.config.DEXS[rawKey.toLowerCase()] || null;
      return null;
    },
    getColorInfo(entityType, key) {
      let colorSource = null;
      const type = entityType.toLowerCase();
      if (type === 'chain' && (!key || key === 'multi')) {
        colorSource = { WARNA: this.multiChainColor };
      } else {
        colorSource = this.getColorConfig(entityType, key);
      }
      const color = this.normalizeHex(colorSource?.WARNA || '#6c757d');
      return { color, contrast: this.getContrastYIQ(color), rgb: this.hexToRgb(color) };
    },
    createSoftTone(rgbString, alphaBackground = 0.18, alphaBorder = 0.32) {
      return { backgroundColor: `rgba(${rgbString}, ${alphaBackground})`, borderColor: `rgba(${rgbString}, ${alphaBorder})` };
    },
    getColorStyles(entityType, key, variant = 'solid') {
      // 1. Dapatkan warna teks dari entitas itu sendiri (CEX, DEX, Chain)
      // Jika tidak ada warna di config, default-nya adalah hitam (#111)
      const entityColorInfo = this.getColorInfo(entityType, key);
      const textColor = entityColorInfo.color === '#6c757d' ? '#111' : entityColorInfo.color;

      // 2. Dapatkan warna tema dari chain yang aktif untuk background
      const themeColorInfo = this.getColorInfo('chain', this.activeChain);

      // Hanya kembalikan warna teks jika varian adalah 'text'
      if (variant === 'text') return { color: textColor };

      // Untuk varian 'outline', gunakan warna teks sebagai border
      if (variant === 'outline') return { color: textColor, borderColor: textColor, backgroundColor: 'transparent' };

      // 3. Tentukan gaya background dan border
      // Background diatur ke transparan agar menggunakan warna default dari card.
      // Border akan selalu menggunakan warna tema chain.
      //console.log(`[DEBUG getColorStyles] Menerapkan background: var(--brand-soft-bg) dan border: ${themeColorInfo.color}`);
      const backgroundStyles = {
        backgroundColor: 'var(--brand-soft-bg)', // REVISI: Gunakan variabel latar belakang tema
        borderColor: themeColorInfo.color
      };

      // 4. Untuk varian 'soft' (tidak dicentang), buat warna teks sedikit lebih pudar
      // dan border lebih tipis. Untuk 'solid' (dicentang), buat lebih tegas.
      if (variant === 'soft') {
        return { ...backgroundStyles, color: textColor, borderWidth: '1px' };
      }

      // Untuk 'solid' (dicentang), gunakan warna teks yang lebih kuat dan border lebih tebal.
      return { ...backgroundStyles, color: textColor, borderWidth: '2px' };
    },
    getPairColorStyles(uniquePairKey, isChecked) {
      if (!uniquePairKey) return {};
      const chainKey = uniquePairKey.split('.')[0];
      const variant = isChecked ? 'solid' : 'soft';
      // Panggil getColorStyles dengan entityType 'chain'
      return this.getColorStyles('chain', chainKey, variant);
    },
    resolveChainKeyByName(label) {
      if (!label) return null;
      const upperLabel = label.toString().toUpperCase();
      return Object.entries(this.config.CHAINS).find(([key, chain]) => {
        const candidates = [key.toUpperCase(), chain.NAMA_CHAIN?.toUpperCase(), chain.NAMA_PENDEK?.toUpperCase()];
        if (candidates.some(c => c && (c === upperLabel || upperLabel.includes(c)))) return true;
        if (Array.isArray(chain.SYNONYMS)) {
          return chain.SYNONYMS.some(synonym => {
            const upperSyn = synonym.toUpperCase();
            return upperLabel === upperSyn || upperLabel.includes(upperSyn) || upperSyn.includes(upperLabel);
          });
        }
        return false;
      })?.[0] || null;
    },
    getNetworkBadgeStyle(networkName) {
      const chainKey = this.resolveChainKeyByName(networkName);
      if (!chainKey) return {};
      const isActiveMatch = this.activeChain !== 'multi' && chainKey === this.activeChain;
      const variant = isActiveMatch ? 'solid' : 'soft';
      return this.getColorStyles('chain', chainKey, variant);
    },
    updateThemeColor() {
      const root = document.documentElement;
      let brandColor = this.multiChainColor;
      let isMulti = true;

      if (this.activeChain !== 'multi' && this.config.CHAINS[this.activeChain]) {
        brandColor = this.config.CHAINS[this.activeChain].WARNA;
        isMulti = false;
      }

      const normalizedBrand = this.normalizeHex(brandColor);
      const brandRgb = this.hexToRgb(normalizedBrand);
      const contrastColor = this.getContrastYIQ(normalizedBrand);

      // ===== DEBUGGING LOG =====
      console.group(`[DEBUG updateThemeColor] Chain: ${this.activeChain.toUpperCase()}`);
      console.log(`🎨 Warna dasar diambil: ${brandColor} (dinormalisasi menjadi ${normalizedBrand})`);
      console.log(`🎨 Variabel CSS --brand-soft-bg diatur ke: rgba(${brandRgb}, 0.15)`);

      // Brand colors
      root.style.setProperty('--brand', normalizedBrand);
      root.style.setProperty('--brand-rgb', brandRgb);
      root.style.setProperty('--brand-contrast', contrastColor);
      root.style.setProperty('--brand-soft-bg', `rgba(${brandRgb}, 0.15)`); /* REVISI: Tingkatkan opasitas dari 0.12 */
      root.style.setProperty('--brand-soft-border', `rgba(${brandRgb}, 0.40)`); /* REVISI: Tingkatkan opasitas dari 0.32 */
      root.style.setProperty('--brand-soft-text', normalizedBrand);
      root.style.setProperty('--brand-strong-bg', normalizedBrand);
      root.style.setProperty('--brand-strong-text', contrastColor);
      root.style.setProperty('--brand-soft-gradient', `linear-gradient(135deg, rgba(${brandRgb}, 0.22) 0%, rgba(${brandRgb}, 0.06) 100%)`);

      // Background colors with chain theme
      root.style.setProperty('--bg-chain-primary', `rgba(${brandRgb}, 0.08)`); /* REVISI: Tingkatkan opasitas dari 0.03 */
      root.style.setProperty('--bg-chain-secondary', `rgba(${brandRgb}, 0.12)`); /* REVISI: Tingkatkan opasitas dari 0.08 */
      root.style.setProperty('--bg-chain-soft', `rgba(${brandRgb}, 0.10)`); /* REVISI: Tingkatkan opasitas dari 0.05 */
      root.style.setProperty('--bg-chain-accent', `rgba(${brandRgb}, 0.20)`); /* REVISI: Tingkatkan opasitas dari 0.15 */

      document.body.classList.toggle('theme-multi-chain', isMulti);
      document.body.classList.toggle('theme-single-chain', !isMulti);

      console.groupEnd();
    },
    getChainColor(chainKey) { return this.getColorInfo('chain', chainKey).color; },
    getCexColor(cexKey) { return this.getColorInfo('cex', cexKey).color; },
    getDexColor(dexKey) { return this.getColorInfo('dex', dexKey).color; },
  }
};
