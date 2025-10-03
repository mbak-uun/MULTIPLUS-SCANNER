// components/menus/portfolio.js
// Vue Component untuk Menu Portfolio - Refactored from asset.html

const PortfolioMenu = {
  name: 'PortfolioMenu',

  data() {
    return {
      // --- Data from asset.html ---
      isOperationBusy: false,
      busyStatusMessage: 'Loading...',
      isDarkMode: false,
      lastRefresh: null,
      exchanges: [],
      wallets: [],
      pnl: {
        modalAwal: 0,
        history: []
      },
      portfolioBreakdown: {
        cex: 0,
        wallet: 0,
        total: 0
      },
      portfolioPerformance: {
        pnl: 0
      },
      busy: {
        exchange: false,
        wallet: false,
        pnl: false
      },
      toasts: [],
      rates: {
        idr: 0,
        BTC: 0,
        ETH: 0,
        BNB: 0,
        MATIC: 0,
        SOL: 0,
        AVAX: 0,
        customSymbol: '',
        customPrice: 0
      },
      calculatorInputs: [
        { id: 'usdt', label: 'USDT Amount', help: '' },
        { id: 'idr', label: 'IDR Amount', help: '' },
        { id: 'btc', label: 'BTC Amount', help: '' },
        { id: 'eth', label: 'ETH Amount', help: '' },
        { id: 'bnb', label: 'BNB Amount', help: '' }
      ],
      calculatorCustom: {
        symbol: '',
        amount: 0
      },
      customPriceEditable: false,
      activeExchangeCount: 0,
      totalExchangeCount: 0,
      activeWalletCount: 0,
      totalWalletCount: 0,
      activeExchangeSummaries: [],
      inactiveExchanges: [],
      activeWalletResults: [],
      inactiveWallets: [],
      totalWalletAssets: 0,
      totalWalletGas: 0,
      totalCexWithCurrency: '0.00 $',
      totalWalletWithCurrency: '0.00 $',
      // --- End of data from asset.html ---
      portfolioReady: false,
      _refreshingExchanges: null,
      _refreshingWallets: null,
    };
  },

  computed: {
    // --- Computed properties from asset.html ---
    config() {
      return this.$root.config; // Access global config from root
    },
    globalSettings() {
      return this.$root.globalSettings; // Access global settings from root
    },
    lastRefreshLabel() {
      return this.formatPnlTimestamp(this.lastRefresh);
    },
    isPnlPositive() {
      return this.portfolioPerformance.pnl >= 0;
    },
    idrRateSummary() {
      const idr = Number(this.rates.idr || 0);
      if (!idr) return 'Rp -';
      return `Rp ${idr.toLocaleString('id-ID')}`;
    },
    displayRates() {
      return [
        { label: 'USDT/IDR', value: this.rates.idr ? this.rates.idr.toLocaleString('id-ID') : '-' },
        { label: 'BTC', value: this.rates.BTC ? this.rates.BTC.toFixed(2) : '-' },
        { label: 'ETH', value: this.rates.ETH ? this.rates.ETH.toFixed(2) : '-' },
        { label: 'BNB', value: this.rates.BNB ? this.rates.BNB.toFixed(2) : '-' },
        { label: 'MATIC', value: this.rates.MATIC ? this.rates.MATIC.toFixed(4) : '-' },
        { label: 'SOL', value: this.rates.SOL ? this.rates.SOL.toFixed(2) : '-' },
        { label: this.rates.customSymbol ? `${this.rates.customSymbol.toUpperCase()}/USDT` : 'Custom', value: this.rates.customPrice ? this.rates.customPrice.toFixed(6) : '-' }
      ];
    },
    calculatorInputsMap() {
      return this.calculatorInputs.reduce((acc, item) => { acc[item.id] = item; return acc; }, {});
    },

    // --- Exchange Handler Mapping (Moved from methods to computed) ---
    exchangeHandlers() {
      return {
        'binance': this.handleBinance,
        'gate': this.handleGate,
        'bybit': this.handleBybit,
        'kucoin': this.handleKucoin,
        'mexc': this.handleMexc,
        'indodax': this.handleIndodax,
        'bitget': this.handleBitget
      };
    },
    enabledCexKeys() {
      const cfg = this.globalSettings?.config_cex;
      if (!cfg) return [];
      return Object.keys(cfg).filter(key => cfg[key]?.status === true);
    },
    enabledChainKeys() {
      const cfg = this.globalSettings?.config_chain;
      if (!cfg) return [];
      return Object.keys(cfg).filter(key => cfg[key]?.status === true);
    },
    summaryPanelStyles() {
      const activeChainKey = this.$root?.activeChain || 'multi';
      return this.buildAccentStyle('chain', activeChainKey, {
        includeBackground: true,
        backgroundAlpha: 0.05,
        borderAlpha: 0.35,
        fallback: '#0ea5e9'
      });
    },
    cardHeaderStyles() {
      const activeChainKey = this.$root?.activeChain || 'multi';
      const info = this.resolveEntityColorInfo('chain', activeChainKey, '#198754');
      return {
        background: `linear-gradient(135deg, rgba(${info.rgb}, 0.85) 0%, rgba(${info.rgb}, 0.6) 100%)`,
        color: info.contrast,
        borderColor: info.color,
        boxShadow: `inset 0 -1px 0 rgba(${info.rgb}, 0.45)`
      };
    }
  },

  watch: {
    enabledCexKeys(newKeys, oldKeys) {
      this._handleActiveCexConfigChange(newKeys, oldKeys);
    },
    enabledChainKeys(newKeys, oldKeys) {
      this._handleActiveChainConfigChange(newKeys, oldKeys);
    }
  },

  methods: {
    summaryMetricClass(section) {
      const base = 'summary-metric--accent';
      const map = {
        cex: `${base} summary-metric--cex`,
        wallet: `${base} summary-metric--wallet`,
        total: `${base} summary-metric--total`
      };
      return map[section] || base;
    },
    // --- Methods from asset.html ---

    // --- IndexedDB Helpers (Now using global DB object) ---
    async dbGet(storeName, key) {
      return DB.getData(storeName, key);
    },
    async dbSet(storeName, value, key = null) {
      // The global DB.saveData has signature (storeName, data, key)
      // We adapt to it. For stores with keyPath, key is null.
      return DB.saveData(storeName, value, key);
    },

    // --- Formatting Helpers ---
    formatUsd(amount) {
      const value = Number(amount || 0);
      return `${value.toFixed(2)} $`;
    },
    formatIdrEquivalent(amount) {
      const usd = Number(amount || 0);
      const rate = Number(this.rates.idr || 0);
      if (!rate) return 'Rp -';
      const idr = usd * rate;
      return `Rp ${idr.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;
    },
    formatTokenAmount(amount) {
      const value = Number(amount || 0);
      if (!Number.isFinite(value)) return '0';
      if (Math.abs(value) >= 1000) {
        return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
      }
      if (Math.abs(value) >= 1) {
        return value.toFixed(2);
      }
      return value.toFixed(4);
    },
    formatPnlTimestamp(raw) {
      if (!raw) return '-';
      const date = new Date(raw);
      const pad = n => n.toString().padStart(2, '0');
      const datePart = `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
      const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
      return `${datePart} ${timePart}`;
    },
    formatChainLabel(chainId) {
      return String(chainId || '').toUpperCase();
    },

    // --- Style and UI Helpers ---
    textStyleForExchange(id) {
      const exchange = this.exchanges.find(e => e.id === id);
      return exchange && exchange.color ? { color: exchange.color, fontWeight: 'bold' } : { color: '#0d6efd' };
    },
    textStyleForChain(id) {
      const wallet = this.wallets.find(w => w.id === id);
      return wallet && wallet.color ? { color: wallet.color, fontWeight: 'bold' } : { color: '#0ea5e9' };
    },
    resolveEntityColorInfo(entityType, key, fallback = '#0ea5e9') {
      const root = this.$root;
      if (root && typeof root.getColorInfo === 'function' && key) {
        try {
          const info = root.getColorInfo(entityType, key);
          if (info?.color) return info;
        } catch (error) {
          console.warn('Failed to resolve color info for', entityType, key, error);
        }
      }
      const normalized = this.normalizeHexLocal(fallback);
      return {
        color: normalized,
        rgb: this.hexToRgbLocal(normalized),
        contrast: this.getContrastYiqLocal(normalized)
      };
    },
    buildAccentStyle(entityType, key, options = {}) {
      const fallback = options.fallback || (entityType === 'cex' ? '#0d6efd' : '#0ea5e9');
      const info = this.resolveEntityColorInfo(entityType, key, fallback);
      const borderAlpha = typeof options.borderAlpha === 'number' ? options.borderAlpha : 0.45;
      const backgroundAlpha = typeof options.backgroundAlpha === 'number' ? options.backgroundAlpha : 0.08;
      const style = {
        borderColor: info.color,
        boxShadow: `0 0 0 1px rgba(${info.rgb}, ${borderAlpha})`
      };
      if (options.includeBackground) {
        style.backgroundColor = `rgba(${info.rgb}, ${backgroundAlpha})`;
      }
      if (options.includeTextColor) {
        style.color = info.color;
      }
      return style;
    },
    entityCardStyle(entityType, key, isHighlighted = false) {
      return this.buildAccentStyle(entityType, key, {
        includeBackground: isHighlighted,
        backgroundAlpha: isHighlighted ? 0.12 : 0.05,
        borderAlpha: isHighlighted ? 0.55 : 0.35
      });
    },
    getExchangeFieldIcon(fieldKey) {
      const map = {
        apiKey: 'bi-key-fill',
        secretKey: 'bi-shield-lock-fill',
        passphrase: 'bi-lock-fill'
      };
      return `bi ${map[fieldKey] || 'bi-gear-fill'}`;
    },
    getWalletInputIcon(wallet) {
      if (wallet?.icon) return 'bi-wallet2';
      return 'bi-link-45deg';
    },
    normalizeHexLocal(hex) {
      if (!hex) return '#0ea5e9';
      let value = hex.toString().trim();
      if (!value.startsWith('#')) value = `#${value}`;
      if (value.length === 4) {
        value = `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
      } else if (value.length === 5) {
        value = `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
      } else if (value.length === 9) {
        value = value.slice(0, 7);
      }
      return value.toLowerCase();
    },
    hexToRgbLocal(hex) {
      const normalized = this.normalizeHexLocal(hex);
      const r = parseInt(normalized.substr(1, 2), 16) || 0;
      const g = parseInt(normalized.substr(3, 2), 16) || 0;
      const b = parseInt(normalized.substr(5, 2), 16) || 0;
      return `${r}, ${g}, ${b}`;
    },
    getContrastYiqLocal(hex) {
      const normalized = this.normalizeHexLocal(hex);
      const r = parseInt(normalized.substr(1, 2), 16) || 0;
      const g = parseInt(normalized.substr(3, 2), 16) || 0;
      const b = parseInt(normalized.substr(5, 2), 16) || 0;
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return yiq >= 128 ? '#111' : '#fff';
    },
    getDefaultGasSymbol(chainId) {
      const lower = String(chainId || '').toLowerCase();
      const chainConfig = this.config?.CHAINS?.[lower] || {};
      const baseFeeDex = chainConfig.BASE_FEE_DEX || '';
      const gasSymbol = baseFeeDex.replace(/USDT$/, '').toUpperCase();
      return gasSymbol || 'ETH';
    },
    buildWalletLink(chainId, address) {
      if (!chainId || !address) return '#';
      const lower = String(chainId).toLowerCase();
      const explorer = this.config?.CHAINS?.[lower]?.LINKS?.EXPLORER?.ADDRESS;
      if (explorer) {
        return explorer.replace('{address}', address);
      }
      return '#';
    },
    buildWalletResult(wallet, source = {}) {
      const chainId = String(wallet?.id || source.chain || '').toLowerCase();
      const address = wallet?.address || source.address || '';
      const rawAssets = Array.isArray(source.raw_assets) ? source.raw_assets : [];
      const primaryAsset = rawAssets.length > 0 ? rawAssets[0] : {};

      const tokenSymbol = (source.tokenSymbol || primaryAsset.symbol || 'USDT').toUpperCase();
      const assetAmount = Number(source.assetAmount ?? primaryAsset.amount ?? 0);
      let assetValue = Number(source.assetValue ?? primaryAsset.value ?? 0);
      const assetRate = source.assetRate != null ? Number(source.assetRate) : null;
      if ((!assetValue || Number.isNaN(assetValue)) && assetAmount) {
        const impliedRate = assetRate != null ? assetRate : (tokenSymbol === 'USDT' ? 1 : null);
        if (impliedRate != null) {
          assetValue = assetAmount * impliedRate;
        }
      }

      const gasAmount = Number(source.gasAmount ?? 0);
      let gasValue = Number(source.gasValue ?? 0);
      const gasRate = source.gasRate != null ? Number(source.gasRate) : null;
      const gasSymbol = (source.gasSymbol || this.getDefaultGasSymbol(chainId)).toUpperCase();
      if ((!gasValue || Number.isNaN(gasValue)) && gasAmount) {
        const ratesMap = this.rates || {};
        const impliedGasRate = gasRate != null ? gasRate : ratesMap[gasSymbol] ?? null;
        if (impliedGasRate != null) {
          gasValue = gasAmount * impliedGasRate;
        }
      }

      const total = Number(source.total ?? (assetValue + gasValue));
      const walletLink = source.walletLink || this.buildWalletLink(chainId, address);

      return {
        chain: chainId,
        address,
        tokenSymbol,
        tokenAddress: source.tokenAddress || primaryAsset.contract || null,
        assetAmount,
        assetValue,
        assetRate,
        gasAmount,
        gasValue,
        gasRate,
        gasSymbol,
        total,
        walletLink,
        raw_assets: rawAssets,
        fetchedAt: source.fetchedAt || new Date().toISOString()
      };
    },
    exchangeStatusLabel(status) {
      const labels = { success: 'OK', error: 'Error', loading: 'Checking…' };
      return labels[status] || '';
    },
    exchangeStatusBadgeClass(status) {
      const classes = { success: 'bg-success text-white', error: 'bg-danger text-white', loading: 'bg-warning text-dark' };
      return classes[status] || 'bg-secondary text-white';
    },
    walletStatusLabel(status) {
      const labels = { success: 'Connected', error: 'Error', loading: 'Checking…' };
      return labels[status] || '';
    },
    walletStatusBadgeClass(status) {
      const classes = { success: 'bg-success text-white', error: 'bg-danger text-white', loading: 'bg-warning text-dark' };
      return classes[status] || 'bg-secondary text-white';
    }, 
    openInNewTab() {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('mode', 'portfolio');
      window.open(currentUrl.toString(), '_blank', 'noopener,noreferrer');
      this.notify('Membuka modul portfolio di tab baru...');
    },
    handleIconError(event) {
      event.target.style.display = 'none';
      console.warn('Failed to load icon:', event.target.src);
    },
    reloadPage() {
      this.$root.reloadActiveTab();
    },
    notify(message, type = 'info') {
      this.$root.showToast(message, type);
    },

    _handleActiveCexConfigChange(newKeys, oldKeys) {
      if (!this._shouldReactToConfigChange(newKeys, oldKeys)) return;
      this._refreshExchangesFromSettings();
    },

    _handleActiveChainConfigChange(newKeys, oldKeys) {
      if (!this._shouldReactToConfigChange(newKeys, oldKeys)) return;
      this._refreshWalletsFromSettings();
    },

    _shouldReactToConfigChange(newKeys, oldKeys) {
      if (!this.portfolioReady) return false;
      if (!Array.isArray(newKeys)) return false;
      if (!Array.isArray(oldKeys)) return false;
      return !this._haveSameMembers(newKeys, oldKeys);
    },

    _haveSameMembers(a = [], b = []) {
      if (a.length !== b.length) return false;
      const normalize = list => list.map(item => String(item).toLowerCase()).sort();
      const aSorted = normalize(a);
      const bSorted = normalize(b);
      return aSorted.every((value, index) => value === bSorted[index]);
    },

    async _refreshExchangesFromSettings() {
      if (this._refreshingExchanges) {
        await this._refreshingExchanges;
        return;
      }
      const task = this._withBusyState('Memperbarui daftar exchange...', async () => {
        this._initializeExchanges();
        this._loadStateFromStorage();
        await this._loadDataFromDB();
      });
      this._refreshingExchanges = task;
      try {
        await task;
      } catch (error) {
        console.error('❌ Gagal memperbarui daftar exchange:', error);
        this.notify('Gagal memperbarui daftar exchange.', 'danger');
      } finally {
        this._refreshingExchanges = null;
      }
    },

    async _refreshWalletsFromSettings() {
      if (this._refreshingWallets) {
        await this._refreshingWallets;
        return;
      }
      const task = this._withBusyState('Memperbarui daftar wallet...', async () => {
        this._initializeWallets();
        this._loadStateFromStorage();
        await this._loadDataFromDB();
      });
      this._refreshingWallets = task;
      try {
        await task;
      } catch (error) {
        console.error('❌ Gagal memperbarui daftar wallet:', error);
        this.notify('Gagal memperbarui daftar wallet.', 'danger');
      } finally {
        this._refreshingWallets = null;
      }
    },

    async _withBusyState(message, task) {
      const wasBusy = this.isOperationBusy;
      const previousMessage = this.busyStatusMessage;
      if (!wasBusy) {
        this.isOperationBusy = true;
        if (message) this.busyStatusMessage = message;
      } else if (message) {
        this.busyStatusMessage = message;
      }
      try {
        return await task();
      } finally {
        if (!wasBusy) {
          this.isOperationBusy = false;
        }
        this.busyStatusMessage = previousMessage;
      }
    },

    // --- State Management ---
    handleExchangeToggle(exchange) {
      this.saveExchangeState(exchange);

      // Auto-update daftar exchange
      if (exchange.enabled) {
        // Tambahkan ke daftar aktif jika belum ada
        const existingIndex = this.activeExchangeSummaries.findIndex(e => e.id === exchange.id);
        if (existingIndex === -1) {
          this.activeExchangeSummaries.push({
            id: exchange.id,
            name: exchange.name,
            total: 0,
            display: '<span class="text-muted">Belum dicek</span>'
          });
        }
      } else {
        // Hapus dari daftar aktif
        this.activeExchangeSummaries = this.activeExchangeSummaries.filter(e => e.id !== exchange.id);
        this.activeExchangeCount = this.activeExchangeSummaries.length;
      }

      // Update counter dan daftar inactive
      this.activeExchangeCount = this.activeExchangeSummaries.length;
      this.inactiveExchanges = this.exchanges.filter(e => !e.enabled);
    },
    handleExchangeFieldInput(exchange, field) {
      clearTimeout(this._exchangeSaveTimer);
      this._exchangeSaveTimer = setTimeout(() => {
        this.saveExchangeState(exchange);
      }, 700);
    },
    handleWalletToggle(wallet) {
      this.saveWalletState(wallet);

      // Auto-update daftar wallet
      if (wallet.enabled && wallet.address) {
        // Tambahkan ke daftar aktif jika belum ada
        const existingIndex = this.activeWalletResults.findIndex(w => w.chain === wallet.id);
        if (existingIndex === -1) {
          const emptyResult = {
            chain: wallet.id,
            address: wallet.address,
            tokenSymbol: 'USDT',
            tokenAddress: null,
            assetAmount: 0,
            assetValue: 0,
            assetRate: 1,
            gasAmount: 0,
            gasValue: 0,
            gasRate: 0,
            gasSymbol: this.getDefaultGasSymbol(wallet.id),
            total: 0,
            walletLink: this.buildWalletLink(wallet.id, wallet.address),
            raw_assets: [],
            fetchedAt: new Date().toISOString(),
            status: 'pending' // Belum dicek
          };
          this.activeWalletResults.push(emptyResult);
        }
      } else {
        // Hapus dari daftar aktif
        this.activeWalletResults = this.activeWalletResults.filter(w => w.chain !== wallet.id);
      }

      // Update counter dan daftar inactive
      this.activeWalletCount = this.activeWalletResults.length;
      this.inactiveWallets = this.wallets.filter(w => !w.enabled);
    },
    handleWalletFieldInput(wallet, fieldKey) {
      clearTimeout(this._walletSaveTimer);
      this._walletSaveTimer = setTimeout(() => {
        this.saveWalletState(wallet);

        // Jika wallet enabled dan ada address, auto-update daftar
        if (wallet.enabled && wallet.address) {
          const existingIndex = this.activeWalletResults.findIndex(w => w.chain === wallet.id);
          if (existingIndex === -1) {
            const emptyResult = {
              chain: wallet.id,
              address: wallet.address,
              tokenSymbol: 'USDT',
              tokenAddress: null,
              assetAmount: 0,
              assetValue: 0,
              assetRate: 1,
              gasAmount: 0,
              gasValue: 0,
              gasRate: 0,
              gasSymbol: this.getDefaultGasSymbol(wallet.id),
              total: 0,
              walletLink: this.buildWalletLink(wallet.id, wallet.address),
              raw_assets: [],
              fetchedAt: new Date().toISOString(),
              status: 'pending'
            };
            this.activeWalletResults.push(emptyResult);
            this.activeWalletCount = this.activeWalletResults.length;
          } else {
            // Update address jika sudah ada
            this.activeWalletResults[existingIndex].address = wallet.address;
            this.activeWalletResults[existingIndex].walletLink = this.buildWalletLink(wallet.id, wallet.address);
          }
        }
      }, 700);
    },
    saveExchangeState(exchange) {
      try {
        const state = {
          enabled: exchange.enabled,
          fields: exchange.fields.map(f => ({ key: f.key, value: f.value }))
        };
        localStorage.setItem(`portfolio_exchange_${exchange.id}`, JSON.stringify(state));
        this.notify(`Pengaturan ${exchange.name} tersimpan`, 'success');
      } catch (error) {
        console.warn('Failed to save exchange state:', error);
      }
    },
    saveWalletState(wallet) {
      try {
        const state = {
          enabled: wallet.enabled,
          address: wallet.address
        };
        localStorage.setItem(`portfolio_wallet_${wallet.id}`, JSON.stringify(state));
        this.notify(`Pengaturan ${wallet.name} tersimpan`, 'success');
      } catch (error) {
        console.warn('Failed to save wallet state:', error);
      }
    },

    // --- Core Logic (Asset Checking) ---
    async checkSelectedExchanges() {
      const enabledExchanges = this.exchanges.filter(e => e.enabled);
      if (enabledExchanges.length === 0) {
        this.notify('Tidak ada exchange yang diaktifkan', 'info');
        return;
      }

      this.busy.exchange = true;
      this.isOperationBusy = true;
      this.busyStatusMessage = 'Mengecek exchange...';

      try {
        const rates = await this.fetchRates(this.config);
        const idrRate = await this.fetchIndodaxRate(this.config);

        Object.assign(this.rates, rates);
        this.rates.idr = idrRate;

        this.activeExchangeSummaries = [];
        let totalCex = 0;

        for (const exchange of enabledExchanges) {
          exchange.status = 'loading';
          exchange.error = null;

          try {
            const handler = this.exchangeHandlers[exchange.id];
            if (!handler) {
              throw new Error(`Handler not found for ${exchange.id}`);
            }

            let result;
            let activeConfig = this.config;
            if (exchange.id === 'gate' && this.config.proxies?.rosyPrefix) {
              activeConfig = JSON.parse(JSON.stringify(this.config));
              activeConfig.exchangeEndpoints.gateBase = `${this.config.proxies.rosyPrefix}${this.config.exchangeEndpoints.gateBase}`;
            }
            
            if (exchange.id === 'indodax') {
                result = await handler(exchange, activeConfig, rates, idrRate);
            } else {
                result = await handler(exchange, activeConfig);
            }

            exchange.status = 'success';
            exchange.lastResult = result;

            const dbData = {
              name_cex: exchange.id,
              snapshot: { totalBalance: result.total, assets: result.raw_assets || [] },
              lastUpdated: new Date().toISOString()
            };
            await this.dbSet('ASET_EXCHANGER', dbData);

            this.activeExchangeSummaries.push({
              id: exchange.id,
              name: exchange.name,
              total: result.total,
              display: result.display
            });

            totalCex += result.total;
            console.log(`✅ ${exchange.name}: $${result.total.toFixed(2)}`);
          } catch (error) {
            exchange.status = 'error';
            exchange.error = error.message;
            console.error(`❌ ${exchange.name}:`, error);
          }
        }

        this.portfolioBreakdown.cex = totalCex;
        this.portfolioBreakdown.total = totalCex + this.portfolioBreakdown.wallet;
        this.portfolioPerformance.pnl = this.portfolioBreakdown.total - this.pnl.modalAwal;
        this.totalCexWithCurrency = `${totalCex.toFixed(2)} $`;
        this.activeExchangeCount = this.activeExchangeSummaries.length;
        this.inactiveExchanges = this.exchanges.filter(e => !e.enabled);
        this.lastRefresh = Date.now();
        this.notify(`✅ Berhasil cek ${enabledExchanges.length} exchange`, 'success');
      } catch (error) {
        console.error('Exchange check failed:', error);
        this.notify(`❌ Gagal cek exchange: ${error.message}`, 'danger');
      } finally {
        this.busy.exchange = false;
        this.isOperationBusy = false;
      }
    },
    async checkWalletBalances(walletToCheck = null) {
      const enabledWallets = this.wallets.filter(w => w.enabled && w.address);
      const walletsToProcess = walletToCheck ? [walletToCheck] : enabledWallets;

      if (walletsToProcess.length === 0) {
        this.notify('Tidak ada wallet yang diaktifkan', 'info');
        return;
      }

      // Check if portfolioWeb3Helper is initialized
      if (!window.portfolioWeb3Helper) {
        this.notify('⚠️ Portfolio Web3 Helper belum siap. Silakan refresh halaman.', 'danger');
        console.error('❌ portfolioWeb3Helper not initialized');
        return;
      }

      // Check if Web3 is loaded
      if (typeof Web3 === 'undefined') {
        this.notify('⚠️ Web3.js belum dimuat. Silakan refresh halaman.', 'danger');
        console.error('❌ Web3.js not loaded');
        return;
      }

      this.busy.wallet = true;
      this.isOperationBusy = true;
      this.busyStatusMessage = `Mengecek ${walletsToProcess.length} wallet...`;

      try {
        const rates = await this.fetchRates(this.config, this.config.priceSymbols);
        Object.assign(this.rates, rates);

        const promises = walletsToProcess.filter(w => w && w.id).map(async (wallet) => {
          wallet.status = 'loading';
          wallet.error = null;
          try {
            const fetched = await window.portfolioWeb3Helper.getBalances({
              chain: wallet.id,
              address: wallet.address,
              rates: this.rates
            });
            wallet.status = 'success';

            const walletResult = this.buildWalletResult(wallet, fetched);

            const dbWalletData = {
              key: wallet.id,
              name: wallet.id,
              label: wallet.name,
              address: wallet.address,
              lastResult: walletResult,
              lastChecked: new Date().toISOString()
            };
            await this.dbSet('ASET_WALLET', dbWalletData);

            return { status: 'fulfilled', value: walletResult, walletId: wallet.id };
          } catch (error) {
            wallet.status = 'error';
            wallet.error = error.message;
            console.error(`❌ ${wallet.name}:`, error);
            error.walletId = wallet.id;
            throw error;
          }
        });
    
        const results = await Promise.allSettled(promises);

        const processedWalletIds = new Set(walletsToProcess.map(w => w.id));
        this.activeWalletResults = this.activeWalletResults.filter(r => !processedWalletIds.has(r.chain));

        const newResults = [];

        for (const res of results) {
          if (res.status === 'fulfilled') {
            const resultData = res.value?.value;
            const walletId = res.value?.walletId;

            if (!resultData || !walletId) {
              console.warn('⚠️ Invalid result data:', res.value);
              continue;
            }

            const wallet = this.wallets.find(w => w.id === walletId);
            if (wallet) {
              wallet.status = 'success';
              if (!resultData.walletLink || resultData.walletLink === '#') {
                resultData.walletLink = this.buildWalletLink(walletId, wallet.address);
              }
              if (!resultData.address) {
                resultData.address = wallet.address;
              }
            }

            // Hapus status 'pending' karena sudah berhasil di-fetch
            delete resultData.status;

            if (walletId && resultData.total !== undefined) {
              newResults.push(resultData);
            }
          } else {
            const walletId = res.reason?.walletId;
            const wallet = this.wallets.find(w => w.id === walletId);
            if (wallet) {
              wallet.status = 'error';
              wallet.error = res.reason?.message || 'Unknown error';
            }
          }
        }

        this.activeWalletResults.push(...newResults);

        const walletOrderMap = this.wallets.reduce((acc, w, idx) => {
          acc[w.id] = idx;
          return acc;
        }, {});
        this.activeWalletResults.sort((a, b) => {
          const aIdx = walletOrderMap[a?.chain] ?? Number.MAX_SAFE_INTEGER;
          const bIdx = walletOrderMap[b?.chain] ?? Number.MAX_SAFE_INTEGER;
          return aIdx - bIdx;
        });

        let totalAssets = this.activeWalletResults.reduce((sum, r) => sum + (r.assetValue || 0), 0);
        let totalGas = this.activeWalletResults.reduce((sum, r) => sum + (r.gasValue || 0), 0);

        this.totalWalletAssets = totalAssets;
        this.totalWalletGas = totalGas;
        const totalWallet = totalAssets + totalGas;
        this.portfolioBreakdown.wallet = totalWallet;
        this.portfolioBreakdown.total = this.portfolioBreakdown.cex + totalWallet;
        this.portfolioPerformance.pnl = this.portfolioBreakdown.total - this.pnl.modalAwal;
        this.totalWalletWithCurrency = this.formatUsd(totalWallet);
        this.activeWalletCount = this.activeWalletResults.length;
        this.inactiveWallets = this.wallets.filter(w => !w.enabled);
    
        this.lastRefresh = Date.now();
        this.notify(`✅ Selesai cek ${walletsToProcess.length} wallet`, 'success');
      } catch (error) {
        console.error('Wallet check failed:', error);
        this.notify(`❌ Gagal cek wallet: ${error.message}`, 'danger');
      } finally {
        this.busy.wallet = false;
        this.isOperationBusy = false;
      }
    },
    async checkModalCombined() {
      this.isOperationBusy = true;
      this.busyStatusMessage = 'Mengecek semua aset...';

      try {
        const results = await Promise.allSettled([
          this.checkSelectedExchanges(),
          this.checkWalletBalances()
        ]);

        const failedPromises = results.filter(r => r.status === 'rejected');

        if (failedPromises.length === 0) {
          this.notify('✅ Berhasil cek semua aset', 'success');
        } else {
          console.error('Combined check failed:', failedPromises);
          const errorMessage = failedPromises.map(p => p.reason.message || 'Unknown error').join('; ');
          this.notify(`❌ Gagal cek beberapa aset: ${errorMessage}`, 'danger');
        }
      } finally {
        this.isOperationBusy = false;
      }
    },

    // --- PNL and History Methods ---
    async saveModal() {
      if (!this.pnl.modalAwal || this.pnl.modalAwal <= 0) {
        this.notify('⚠️ Masukkan modal awal yang valid', 'danger');
        return;
      }

      this.busy.pnl = true;
      try {
        localStorage.setItem('portfolio_modal_awal', this.pnl.modalAwal.toString());
        this.portfolioPerformance.pnl = this.portfolioBreakdown.total - this.pnl.modalAwal;
        this.notify(`✅ Modal awal $${this.pnl.modalAwal.toFixed(2)} berhasil disimpan`, 'success');
      } catch (error) {
        console.error('Save modal failed:', error);
        this.notify('❌ Gagal menyimpan modal awal', 'danger');
      } finally {
        this.busy.pnl = false;
      }
    },
    async resetModal() {
      this.busy.pnl = true;
      try {
        const total = this.portfolioBreakdown.total;
        this.pnl.modalAwal = total;
        this.portfolioPerformance.pnl = 0;

        const entry = {
          timestamp: Date.now(),
          awal: total,
          akhir: total,
          pnl: 0,
          action: 'reset'
        };

        this.pnl.history.unshift(entry);
        if (this.pnl.history.length > 100) {
          this.pnl.history = this.pnl.history.slice(0, 100);
        }

        localStorage.setItem('portfolio_modal_awal', this.pnl.modalAwal.toString());
        localStorage.setItem('portfolio_pnl_history', JSON.stringify(this.pnl.history));

        this.notify(`✅ Modal reset ke portfolio saat ini: $${total.toFixed(2)}`, 'success');
      } catch (error) {
        console.error('Reset modal failed:', error);
        this.notify('❌ Gagal reset modal', 'danger');
      } finally {
        this.busy.pnl = false;
      }
    },
    async updateHistoryWithRefresh() {
      if (!this.pnl.modalAwal || this.pnl.modalAwal <= 0) {
        this.notify('⚠️ Set modal awal terlebih dahulu', 'danger');
        return;
      }

      this.busy.pnl = true;
      this.isOperationBusy = true;
      this.busyStatusMessage = 'Memperbarui PNL history...';

      try {
        await this.checkModalCombined();
        const entry = {
          timestamp: Date.now(),
          awal: this.pnl.modalAwal,
          akhir: this.portfolioBreakdown.total,
          pnl: this.portfolioBreakdown.total - this.pnl.modalAwal,
          action: 'update'
        };

        this.pnl.history.unshift(entry);
        if (this.pnl.history.length > 100) {
          this.pnl.history = this.pnl.history.slice(0, 100);
        }
        
        localStorage.setItem('portfolio_pnl_history', JSON.stringify(this.pnl.history));

        this.notify(`✅ PNL history updated: ${entry.pnl >= 0 ? '+' : ''}$${entry.pnl.toFixed(2)}`, 'success');
      } catch (error) {
        console.error('Update history failed:', error);
        this.notify('❌ Gagal update PNL history', 'danger');
      } finally {
        this.busy.pnl = false;
        this.isOperationBusy = false;
      }
    },

    // --- Calculator Methods ---
    openCalculatorModal() {
      const modalEl = document.getElementById('calculator-modal');
      if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
      }
    },
    handleCalculatorInput(id) {
      const inputs = this.calculatorInputsMap;
      const input = inputs[id];
      if (!input) return;
      const baseValue = Number(input.value || 0);
      if (!baseValue || baseValue <= 0) {
        return;
      }
      switch (id) {
        case 'usdt': {
          input.value = baseValue;
          inputs.idr.value = this.rates.idr ? baseValue * this.rates.idr : null;
          inputs.btc.value = this.rates.BTC ? baseValue / this.rates.BTC : null;
          inputs.eth.value = this.rates.ETH ? baseValue / this.rates.ETH : null;
          inputs.bnb.value = this.rates.BNB ? baseValue / this.rates.BNB : null;
          if (this.rates.customPrice) {
            this.customPriceEditable = true;
            this.calculatorCustom.amount = baseValue / this.rates.customPrice;
          }
          break;
        }
        case 'idr': {
          inputs.usdt.value = this.rates.idr ? baseValue / this.rates.idr : null;
          this.handleCalculatorInput('usdt');
          return;
        }
        case 'btc': {
          inputs.usdt.value = this.rates.BTC ? baseValue * this.rates.BTC : null;
          this.handleCalculatorInput('usdt');
          return;
        }
        case 'eth': {
          inputs.usdt.value = this.rates.ETH ? baseValue * this.rates.ETH : null;
          this.handleCalculatorInput('usdt');
          return;
        }
        case 'bnb': {
          inputs.usdt.value = this.rates.BNB ? baseValue * this.rates.BNB : null;
          this.handleCalculatorInput('usdt');
          return;
        }
        default:
          break;
      }
    },
    handleCustomSymbolInput() {
      this.customPriceEditable = this.rates.customSymbol.length > 0;
      if (!this.rates.customSymbol) {
        this.calculatorCustom.amount = 0;
        this.rates.customPrice = 0;
      }
    },
    handleCustomAmountInput() {
      if (!this.customPriceEditable) {
        return;
      }
      const amount = Number(this.calculatorCustom.amount || 0);
      if (!amount || !this.rates.customPrice) {
        return;
      }
      const inputs = this.calculatorInputsMap;
      const usdtValue = amount * this.rates.customPrice;
      if (inputs.usdt) inputs.usdt.value = usdtValue;
      if (inputs.idr) inputs.idr.value = this.rates.idr ? usdtValue * this.rates.idr : null;
      if (inputs.btc) inputs.btc.value = this.rates.BTC ? usdtValue / this.rates.BTC : null;
      if (inputs.eth) inputs.eth.value = this.rates.ETH ? usdtValue / this.rates.ETH : null;
      if (inputs.bnb) inputs.bnb.value = this.rates.BNB ? usdtValue / this.rates.BNB : null;
    },
    async fetchCustomTokenPrice() {
      if (!this.rates.customSymbol) return;

      this.isOperationBusy = true;
      this.busyStatusMessage = `Mengecek harga ${this.rates.customSymbol}...`;

      try {
        const symbol = this.rates.customSymbol.toUpperCase();
        const response = await fetch(`https://api-gcp.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`);
        const data = await response.json();

        if (data.price) {
          this.rates.customPrice = parseFloat(data.price);
          this.calculatorCustom.amount = this.rates.customPrice;
          this.notify(`Harga ${symbol}: $${this.rates.customPrice}`, 'info');
        } else {
          this.notify(`Token ${symbol} tidak ditemukan`, 'danger');
        }
      } catch (error) {
        console.error('Error fetching token price:', error);
        this.notify('Gagal mengambil harga token', 'danger');
      } finally {
        this.isOperationBusy = false;
      }
    },
    async refreshRates() {
      this.isOperationBusy = true;
      this.busyStatusMessage = 'Memperbarui harga...';

      try {
        const rates = await this.fetchRates(this.config);
        const idrRate = await this.fetchIndodaxRate(this.config);
        Object.assign(this.rates, rates);
        this.rates.idr = idrRate;

        this.notify('Harga berhasil diperbarui', 'success');
      } catch (error) {
        console.error('Error refreshing rates:', error);
        this.notify('Gagal memperbarui harga', 'danger');
      } finally {
        this.isOperationBusy = false;
      }
    },

    // --- Initialization Methods ---
    _initializeExchanges() {
      const allCexConfig = this.config?.CEX;
      if (!allCexConfig) return;

      // Ambil semua CEX dari config (sumber utama)
      const allCexKeys = Object.keys(allCexConfig);

      // Debug logging
      console.log('🔍 Portfolio._initializeExchanges()');
      console.log('  - Total CEX di config:', allCexKeys.length);
      console.log('  - globalSettings ada?', !!this.globalSettings);
      console.log('  - globalSettings.config_cex:', this.globalSettings?.config_cex);

      // Filter berdasarkan status di globalSettings (jika ada)
      const enabledCexKeys = this.globalSettings?.config_cex
        ? allCexKeys.filter(key => {
            const isEnabled = this.globalSettings.config_cex[key]?.status === true;
            console.log(`    - ${key}: ${isEnabled ? '✅' : '❌'}`);
            return isEnabled;
          })
        : allCexKeys; // Fallback: tampilkan semua jika globalSettings belum ada

      console.log('  - CEX yang akan ditampilkan:', enabledCexKeys);

      this.exchanges = enabledCexKeys.map(cexKey => {
        const cex = allCexConfig[cexKey];
        const fields = [];
        if (cexKey === 'KUCOIN') {
          fields.push(
            { key: 'apiKey', placeholder: 'API Key', value: '', type: 'text' },
            { key: 'secretKey', placeholder: 'Secret Key', value: '', type: 'password' },
            { key: 'passphrase', placeholder: 'Passphrase', value: '', type: 'password' }
          );
        } else {
          fields.push(
            { key: 'apiKey', placeholder: 'API Key', value: '', type: 'text' },
            { key: 'secretKey', placeholder: 'Secret Key', value: '', type: 'password' }
          );
        }
        return {
          id: cexKey.toLowerCase(),
          name: cexKey.charAt(0) + cexKey.slice(1).toLowerCase(),
          shortName: cex.SHORT_NAME || cexKey,
          color: cex.WARNA || '#333',
          enabled: false, status: 'idle', error: null, lastResult: null, fields: fields
        };
      });

      this.totalExchangeCount = this.exchanges.length;
      this.inactiveExchanges = [...this.exchanges];
    },
    _initializeWallets() {
      const allChainsConfig = this.config?.CHAINS;
      if (!allChainsConfig) return;

      // Ambil semua Chain dari config (sumber utama)
      const allChainKeys = Object.keys(allChainsConfig);

      // Debug logging
      console.log('🔍 Portfolio._initializeWallets()');
      console.log('  - Total Chain di config:', allChainKeys.length);
      console.log('  - globalSettings ada?', !!this.globalSettings);
      console.log('  - globalSettings.config_chain:', this.globalSettings?.config_chain);

      // Filter berdasarkan status di globalSettings (jika ada)
      const enabledChainKeys = this.globalSettings?.config_chain
        ? allChainKeys.filter(key => {
            const isEnabled = this.globalSettings.config_chain[key]?.status === true;
            console.log(`    - ${key}: ${isEnabled ? '✅' : '❌'}`);
            return isEnabled;
          })
        : allChainKeys; // Fallback: tampilkan semua jika globalSettings belum ada

      console.log('  - Chain yang akan ditampilkan:', enabledChainKeys);

      this.wallets = enabledChainKeys.map(chainKey => {
        const chain = allChainsConfig[chainKey];
        let iconPath = chain.ICON || '';
        // No need to change path, it's relative to index.html now
        return {
          id: chainKey, name: chain.NAMA_CHAIN, short: chain.NAMA_PENDEK.toUpperCase(),
          color: chain.WARNA || '#333', enabled: false, status: 'idle', error: null,
          address: '', icon: iconPath, placeholder: `Enter ${chain.NAMA_CHAIN} Address`,
          chainCode: chain.KODE_CHAIN, rpc: chain.RPC, gasLimit: chain.GASLIMIT
        };
      });

      this.totalWalletCount = this.wallets.length;
      this.inactiveWallets = [...this.wallets];
    },
    _loadStateFromStorage() {
      try {
        const savedModalAwal = localStorage.getItem('portfolio_modal_awal');
        if (savedModalAwal) this.pnl.modalAwal = parseFloat(savedModalAwal);

        const savedHistory = localStorage.getItem('portfolio_pnl_history');
        if (savedHistory) this.pnl.history = JSON.parse(savedHistory);

        this.exchanges.forEach(exchange => {
          const savedState = localStorage.getItem(`portfolio_exchange_${exchange.id}`);
          if (savedState) {
            const state = JSON.parse(savedState);
            exchange.enabled = state.enabled || false;
            if (state.fields && exchange.fields) {
              state.fields.forEach(savedField => {
                const field = exchange.fields.find(f => f.key === savedField.key);
                if (field) field.value = savedField.value;
              });
            }
          }
        });

        this.wallets.forEach(wallet => {
          const savedState = localStorage.getItem(`portfolio_wallet_${wallet.id}`);
          if (savedState) {
            const state = JSON.parse(savedState);
            wallet.enabled = state.enabled || false;
            wallet.address = state.address || '';
          }
        });
        console.log('✅ Loaded portfolio saved data from localStorage');
      } catch (error) {
        console.warn('Failed to load portfolio saved data:', error);
      }
    },
    _initializeTheme() {
      const savedTheme = localStorage.getItem('portfolioDarkMode') === 'true';
      if (savedTheme) {
        this.isDarkMode = true;
        document.documentElement.setAttribute('data-bs-theme', 'dark');
      }
    },
    async _loadDataFromDB() {
      try {
        console.log('Attempting to load portfolio data from IndexedDB...');
        let totalCex = 0;
        let totalWallet = 0;
        let totalWalletAssets = 0;
        let totalWalletGas = 0;

        this.activeExchangeSummaries = [];
        this.activeWalletResults = [];

        for (const exchange of this.exchanges) {
          if (exchange.enabled) {
            const data = await this.dbGet('ASET_EXCHANGER', exchange.id);
            if (data && data.snapshot) {
              const total = data.snapshot.totalBalance || 0;
              this.activeExchangeSummaries.push({ id: exchange.id, name: exchange.name, total: total, display: this.formatUsd(total) });
              totalCex += total;
            }
          }
        }
        this.portfolioBreakdown.cex = totalCex;
        this.totalCexWithCurrency = this.formatUsd(totalCex);
        this.activeExchangeCount = this.activeExchangeSummaries.length;
        this.inactiveExchanges = this.exchanges.filter(e => !e.enabled);

        for (const wallet of this.wallets) {
          if (wallet.enabled) {
            const data = await this.dbGet('ASET_WALLET', wallet.id);
            if (data && data.lastResult) {
              if (!wallet.address && data.address) {
                wallet.address = data.address;
              }
              const result = this.buildWalletResult(wallet, data.lastResult);
              this.activeWalletResults.push(result);
              totalWallet += result.total || 0;
              totalWalletAssets += result.assetValue || 0;
              totalWalletGas += result.gasValue || 0;
            }
          }
        }
        const walletOrderMap = this.wallets.reduce((acc, w, idx) => {
          acc[w.id] = idx;
          return acc;
        }, {});
        this.activeWalletResults.sort((a, b) => {
          const aIdx = walletOrderMap[a?.chain] ?? Number.MAX_SAFE_INTEGER;
          const bIdx = walletOrderMap[b?.chain] ?? Number.MAX_SAFE_INTEGER;
          return aIdx - bIdx;
        });

        this.portfolioBreakdown.wallet = totalWallet;
        this.totalWalletWithCurrency = this.formatUsd(totalWallet);
        this.totalWalletAssets = totalWalletAssets;
        this.totalWalletGas = totalWalletGas;
        this.activeWalletCount = this.activeWalletResults.length;
        this.inactiveWallets = this.wallets.filter(w => !w.enabled);

        console.log('✅ Successfully loaded persisted asset data.');
      } catch (error) {
        console.warn('Could not load data from IndexedDB on mount:', error);
      }
    },

    // --- Asset Helpers (from asset_helpers.js) ---
    async fetchRates(config) {
        const rateSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'MATICUSDT', 'AVAXUSDT', 'SOLUSDT'];
        const endpoint = config.priceSources?.binanceDataApi || 'https://api-gcp.binance.com/api/v3/ticker/price';
        const url = `${endpoint}?symbols=${encodeURIComponent(JSON.stringify(rateSymbols))}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch token rates');

        const data = await response.json();
        const mapSymbol = (symbol) => data.find(item => item.symbol === symbol)?.price;

        return {
            BTC: parseFloat(mapSymbol('BTCUSDT') || 0),
            ETH: parseFloat(mapSymbol('ETHUSDT') || 0),
            BNB: parseFloat(mapSymbol('BNBUSDT') || 0),
            MATIC: parseFloat(mapSymbol('MATICUSDT') || 0),
            AVAX: parseFloat(mapSymbol('AVAXUSDT') || 0),
            SOL: parseFloat(mapSymbol('SOLUSDT') || 0)
        };
    },
    async fetchIndodaxRate(config) {
        const endpoint = config.priceSources?.indodaxLower || 'https://indodax.com/api/ticker/usdtidr';
        const proxy = config.LIST_PROXY?.SERVERS?.[0] || '';
        const url = proxy ? `${proxy}${endpoint}` : endpoint;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch IDR rate');

        const data = await response.json();
        return parseFloat((data.ticker && data.ticker.last) || data.last || 0);
    },
    findField(exchange, key) {
        return exchange.fields?.find(f => f.key === key);
    },
    async handleBinance(exchange, config) {
        const apiKey = this.findField(exchange, 'apiKey')?.value || '';
        const secretKey = this.findField(exchange, 'secretKey')?.value || '';
        if (!apiKey || !secretKey) throw new Error('Missing API credentials');

        const endpoint = config.exchangeEndpoints?.binanceAccount || 'https://api-gcp.binance.com/api/v3/account';
        const timestamp = Date.now();
        const query = `timestamp=${timestamp}`;
        const signature = CryptoJS.HmacSHA256(query, secretKey).toString(CryptoJS.enc.Hex);
        const url = `${endpoint}?${query}&signature=${signature}`;

        const response = await fetch(url, { headers: { 'X-MBX-APIKEY': apiKey } });
        const data = await response.json();
        if (!response.ok || data.code) throw new Error(data.msg || 'Binance API error');

        const usdt = parseFloat(data.balances?.find(b => b.asset === 'USDT')?.free || 0);
        return { total: usdt, display: `<span class="text-secondary">${usdt.toFixed(2)} USDT</span>` };
    },
    async handleGate(exchange, config) {
        const apiKey = this.findField(exchange, 'apiKey')?.value || '';
        const secretKey = this.findField(exchange, 'secretKey')?.value || '';
        if (!apiKey || !secretKey) throw new Error('Missing API credentials');

        const timestamp = Math.floor(Date.now() / 1000).toString();
        const method = 'GET';
        const requestPath = '/api/v4/spot/accounts';
        const signString = `${method}\n${requestPath}\n\n${CryptoJS.SHA512('').toString(CryptoJS.enc.Hex)}\n${timestamp}`;
        const signature = CryptoJS.HmacSHA512(signString, secretKey).toString(CryptoJS.enc.Hex);

        const baseUrl = config.exchangeEndpoints?.gateBase || 'https://api.gateio.ws';
        const directUrl = `${baseUrl}${requestPath}`;

        // Gunakan proxy untuk Gate.io (CORS bypass)
        const proxyUrl = `https://vercel-proxycors.vercel.app/?url=${encodeURIComponent(directUrl)}`;

        const response = await fetch(proxyUrl, { headers: { 'KEY': apiKey, 'SIGN': signature, 'Timestamp': timestamp } });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Gate.io API error');

        const usdt = parseFloat(data.find(item => item.currency === 'USDT')?.available || 0);
        return { total: usdt, display: `<span class="text-secondary">${usdt.toFixed(2)} USDT</span>` };
    },
    async handleBybit(exchange, config) {
        const apiKey = this.findField(exchange, 'apiKey')?.value || '';
        const secretKey = this.findField(exchange, 'secretKey')?.value || '';
        if (!apiKey || !secretKey) throw new Error('Missing API credentials');

        const host = config.exchangeEndpoints?.bybitHost || 'https://api.bybit.com';
        const recvWindow = 5000;
        const timestamp = Date.now().toString();
        const query = 'accountType=UNIFIED';
        const signPayload = `${timestamp}${apiKey}${recvWindow}${query}`;
        const sign = CryptoJS.HmacSHA256(signPayload, secretKey).toString(CryptoJS.enc.Hex);
        const url = `${host}/v5/account/wallet-balance?${query}`;

        const response = await fetch(url, { headers: { 'X-BAPI-API-KEY': apiKey, 'X-BAPI-TIMESTAMP': timestamp, 'X-BAPI-RECV-WINDOW': recvWindow.toString(), 'X-BAPI-SIGN': sign } });
        const data = await response.json();
        if (!response.ok || data.retCode !== 0) throw new Error(data.retMsg || 'Bybit API error');

        const usdt = parseFloat(data.result?.list?.[0]?.coin?.find(item => item.coin === 'USDT')?.equity || 0);
        return { total: usdt, display: `<span class="text-secondary">${usdt.toFixed(2)} USDT</span>` };
    },
    async handleKucoin(exchange, config) {
        const apiKey = this.findField(exchange, 'apiKey')?.value || '';
        const secretKey = this.findField(exchange, 'secretKey')?.value || '';
        const passphrase = this.findField(exchange, 'passphrase')?.value || '';
        if (!apiKey || !secretKey || !passphrase) throw new Error('Missing API credentials');

        const endpoint = config.exchangeEndpoints?.kucoinAccounts || 'https://api.kucoin.com/api/v1/accounts';
        const timestamp = Date.now().toString();
        const preSign = `${timestamp}GET/api/v1/accounts`;
        const sign = CryptoJS.HmacSHA256(preSign, secretKey).toString(CryptoJS.enc.Base64);
        const passphraseEnc = CryptoJS.HmacSHA256(passphrase, secretKey).toString(CryptoJS.enc.Base64);

        const response = await fetch(endpoint, { headers: { 'KC-API-KEY': apiKey, 'KC-API-SIGN': sign, 'KC-API-TIMESTAMP': timestamp, 'KC-API-PASSPHRASE': passphraseEnc, 'KC-API-KEY-VERSION': '3' } });
        const data = await response.json();
        if (!response.ok || data.code !== '200000') throw new Error(data.msg || 'Kucoin API error');

        const usdt = parseFloat((data.data || []).find(item => item.currency === 'USDT')?.available || 0);
        return { total: usdt, display: `<span class="text-secondary">${usdt.toFixed(2)} USDT</span>` };
    },
    async handleMexc(exchange, config) {
        const apiKey = this.findField(exchange, 'apiKey')?.value || '';
        const secretKey = this.findField(exchange, 'secretKey')?.value || '';
        if (!apiKey || !secretKey) throw new Error('Missing API credentials');

        const recvWindow = 5000;
        const timestamp = Date.now();
        const query = `recvWindow=${recvWindow}&timestamp=${timestamp}`;
        const signature = CryptoJS.HmacSHA256(query, secretKey).toString(CryptoJS.enc.Hex);
        const mexcEndpoint = config.exchangeEndpoints?.mexcAccount || 'https://api.mexc.com/api/v3/account';
        const url = `${mexcEndpoint}?${query}&signature=${signature}`;
 // Gunakan proxy untuk Gate.io (CORS bypass)
        const proxyUrl = `https://vercel-proxycors.vercel.app/?url=${encodeURIComponent(url)}`;

//        const response = await fetch(url, { headers: { 'X-MEXC-APIKEY': apiKey, 'Content-Type': 'application/json' } });
        const response = await fetch(proxyUrl, { headers: { 'X-MEXC-APIKEY': apiKey, 'Content-Type': 'application/json' } });
        const data = await response.json();
        if (!response.ok || (data && data.code)) throw new Error(`MEXC error: ${data?.msg || 'Unknown error'}`);

        const usdt = parseFloat((data.balances || []).find(c => c.asset === 'USDT')?.free || 0);
        return { total: usdt, display: `<span class="text-secondary">${usdt.toFixed(2)} USDT</span>` };
    },
    async handleIndodax(exchange, config, rates, idrRate) {
        const apiKey = this.findField(exchange, 'apiKey')?.value || '';
        const secretKey = this.findField(exchange, 'secretKey')?.value || '';
        if (!apiKey || !secretKey) throw new Error('Missing API credentials');

        const endpoint = config.exchangeEndpoints?.indodaxTapi || 'https://indodax.com/tapi';
        const requestBody = `method=getInfo&timestamp=${Date.now()}&recvWindow=5000`;
        const sign = CryptoJS.HmacSHA512(requestBody, secretKey).toString();
        const url = config.proxies?.workersProxyAlt ? `${config.proxies.workersProxyAlt}${endpoint}` : endpoint;

        const response = await fetch(url, { method: 'POST', headers: { 'Key': apiKey, 'Sign': sign, 'Content-Type': 'application/x-www-form-urlencoded' }, body: requestBody });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Indodax API error');

        const balance = data.return?.balance || {};
        const idr = parseFloat(balance.idr || 0);
        const usdt = parseFloat(balance.usdt || 0);
        const eth = parseFloat(balance.eth || 0);
        const bnb = parseFloat(balance.bnb || 0);

        const ethUsd = eth * (rates.ETH || 0);
        const bnbUsd = bnb * (rates.BNB || 0);
        const idrUsd = idr / (idrRate || 1);
        const total = usdt + ethUsd + bnbUsd + idrUsd;

        return {
            total,
            display: [
                `<span class="text-primary">${eth.toFixed(4)} ETH</span> ≈ ${ethUsd.toFixed(2)}$`,
                `<span class="text-warning">${bnb.toFixed(4)} BNB</span> ≈ ${bnbUsd.toFixed(2)}$`,
                `<span class="text-danger">RP. ${idr.toLocaleString('id-ID')}</span> ≈ ${idrUsd.toFixed(2)}$`,
                `<span class="text-secondary">${usdt.toFixed(2)} USDT</span>`
            ].join('<br/>')
        };
    },
    async handleBitget(exchange, config) {
        const apiKey = this.findField(exchange, 'apiKey')?.value || '';
        const secretKey = this.findField(exchange, 'secretKey')?.value || '';
        const passphrase = this.findField(exchange, 'passphrase')?.value || '';
        if (!apiKey || !secretKey || !passphrase) throw new Error('Missing API credentials');

        const endpoint = config.exchangeEndpoints?.bitgetAssets || 'https://api.bitget.com/api/v2/spot/account/assets';
        const timestamp = Date.now().toString();
        const preSign = `${timestamp}GET/api/v2/spot/account/assets`;
        const sign = CryptoJS.HmacSHA256(preSign, secretKey).toString(CryptoJS.enc.Base64);

        const response = await fetch(endpoint, { headers: { 'ACCESS-KEY': apiKey, 'ACCESS-SIGN': sign, 'ACCESS-TIMESTAMP': timestamp, 'ACCESS-PASSPHRASE': passphrase } });
        const data = await response.json();
        if (!response.ok || data.code !== '00000') throw new Error(data.msg || 'Bitget API error');

        const usdt = parseFloat((data.data || []).find(item => item.coin === 'USDT')?.available || 0);
        return { total: usdt, display: `<span class="text-secondary">${usdt.toFixed(2)} USDT</span>` };
    },

  },

  // The template is now a very large string.
  // It's the entire content of the <body> from asset.html.
  template: `
    <div v-cloak>
      <!-- Loading Overlay -->
      <div v-if="isOperationBusy" class="global-busy-overlay">
        <div class="global-busy-card">
          <div class="spinner-border text-light mb-3" role="status"></div>
          <div class="message mb-1">{{ busyStatusMessage }}</div>
          <div class="hint">Mohon tunggu, proses masih berjalan...</div>
        </div>
      </div>

      <!-- Summary Panel -->
      <div class="summary-panel mb-4 portfolio-summary-panel" :style="summaryPanelStyles">
        <div class="row g-3">
          <!-- Metrics -->
          <div class="col-md-3 col-6">
            <div class="summary-metric" :class="summaryMetricClass('cex')">
              <div class="summary-metric__label">Exchanger Assets</div>
              <div class="summary-metric__value">{{ formatUsd(portfolioBreakdown?.cex || 0) }}</div>
              <small class="d-block mt-1">{{ formatIdrEquivalent(portfolioBreakdown?.cex || 0) }}</small>
            </div>
          </div>
          <div class="col-md-3 col-6">
            <div class="summary-metric" :class="summaryMetricClass('wallet')">
              <div class="summary-metric__label">Wallet Assets</div>
              <div class="summary-metric__value">{{ formatUsd(portfolioBreakdown?.wallet || 0) }}</div>
              <small class="d-block mt-1">{{ formatIdrEquivalent(portfolioBreakdown?.wallet || 0) }}</small>
            </div>
          </div>
          <div class="col-md-3 col-6">
            <div class="summary-metric" :class="summaryMetricClass('total')">
              <div class="summary-metric__label">Total Asset</div>
              <div class="summary-metric__value">{{ formatUsd(portfolioBreakdown?.total || 0) }}</div>
              <small class="d-block mt-1">{{ formatIdrEquivalent(portfolioBreakdown?.total || 0) }}</small>
            </div>
          </div>
          <div class="col-md-3 col-6">
            <div class="summary-metric" :class="isPnlPositive ? 'bg-success-subtle' : 'bg-danger-subtle'">
              <div class="summary-metric__label">PNL</div>
              <div class="summary-metric__value" :class="isPnlPositive ? 'text-success' : 'text-danger'">
                {{ formatUsd(portfolioPerformance?.pnl || 0) }}
              </div>
              <small class="d-block mt-1" :class="isPnlPositive ? 'text-success' : 'text-danger'">
                {{ formatIdrEquivalent(portfolioPerformance?.pnl || 0) }}
              </small>
            </div>
          </div>
        </div>
        <!-- Controls -->
          <div class="row g-3 mt-2 ">
            <div class="col-12">
               <div class="d-flex flex-wrap justify-content-end gap-2">
                 <!-- Info text -->
                <span class="fs-6 text-dark py-1 align-middle">Last Update: {{ lastRefreshLabel }}</span>
                <span class="fs-6 fw-bold py-1 align-middle">Rate USDT: {{ idrRateSummary }}</span>
                  <button class="btn btn-danger btn-sm"
                  @click="resetModal"
                  :disabled="busy.exchange || busy.wallet || busy.pnl">
                  <i class="bi bi-arrow-counterclockwise me-1"></i> RESET MODAL
                </button>

                <button class="btn btn-primary btn-sm"
                  @click="checkModalCombined"
                  :disabled="busy.exchange || busy.wallet">
                  <i class="bi bi-wallet me-1"></i> CHECK ASSET
                </button>

                <button class="btn btn-success btn-sm"
                  @click="updateHistoryWithRefresh"
                  :disabled="busy.pnl">
                  <i class="bi bi-currency-dollar me-1"></i> UPDATE PNL
                </button>

                <button type="button" class="btn btn-secondary btn-sm"
                  @click="openCalculatorModal">
                  <i class="bi bi-calculator me-1"></i> KALKULATOR
                </button>

                <button type="button" class="btn btn-info btn-sm"
                  @click="openInNewTab"
                  title="Open in New Tab">
                  <i class="bi bi-box-arrow-up-right"></i>
                </button>

                
              </div>
            </div>
          </div>

      </div>

      <!-- Main Content -->
      <div class="row g-3">
        <!-- CEX Column -->
        <div class="col-lg-4">
          <div class="card border-success mb-3">
          <div class="card-header portfolio-card-header d-flex align-items-center justify-content-between" :style="cardHeaderStyles">
            <h6 class="mb-0" style="cursor: pointer;" data-bs-toggle="collapse" data-bs-target="#cexSettingsCollapse">
                <i class="bi bi-gear me-2"></i>Exchanger Settings
                <i class="bi bi-chevron-down ms-2 small"></i>
              </h6>
            
            </div>
            <div id="cexSettingsCollapse" class="collapse show">
              <div class="card-body">
                <div class="vstack gap-2">
                  <div
                    v-for="exchange in exchanges"
                    :key="exchange.id"
                    class="border rounded p-2 portfolio-entity-card"
                    :style="entityCardStyle('cex', exchange.id, exchange.enabled)"
                  >
                    <div class="form-check mb-2">
                      <input class="form-check-input" type="checkbox" :id="exchange.id" v-model="exchange.enabled" @change="handleExchangeToggle(exchange)">
                      <label class="form-check-label fw-semibold text-uppercase" :style="textStyleForExchange(exchange.id)" :for="exchange.id">
                        {{ exchange.name }}
                      </label>
                      <span v-if="exchange.enabled && exchange.status !== 'idle'" class="badge-status ms-2" :class="exchangeStatusBadgeClass(exchange.status)">
                        {{ exchangeStatusLabel(exchange.status) }}
                      </span>
                    </div>
                    <div v-if="exchange.enabled">
                      <div
                        v-for="field in exchange.fields"
                        :key="field.key"
                        class="input-group input-group-sm portfolio-input-group mb-2"
                      >
                        <span class="input-group-text">
                          <i :class="getExchangeFieldIcon(field.key)"></i>
                        </span>
                        <input
                          :type="field.type || 'text'"
                          class="form-control text-uppercase"
                          :placeholder="field.placeholder"
                          v-model.trim="field.value"
                          @input="handleExchangeFieldInput(exchange, field)"
                        >
                      </div>
                    </div>
                    
                    <div class="text-danger small" v-if="exchange.error">{{ exchange.error }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="card border-success">
            <div class="card-header portfolio-card-header d-flex justify-content-between align-items-center" :style="cardHeaderStyles">
              <h6 class="mb-0"><i class="bi bi-currency-dollar "></i>Saldo Exchanger</h6>
              
              <span class="badge bg-light text-success">{{ activeExchangeCount }}/{{ totalExchangeCount }}
               <button class="btn btn-primary btn-sm" @click="checkSelectedExchanges" :disabled="busy.exchange">
                  CHECK
              </button></span>
            </div>
            <div class="card-body">
              <div class="tableFixHead">
                <table class="table table-sm table-hover mb-0">
                  <thead class="table-success">
                    <tr class="text-center">
                      <th class="small">EXCHANGE</th>
                      <th class="small">STATUS</th>
                      <th class="small">BALANCE</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in activeExchangeSummaries" :key="'active-' + row.id" class="table-light">
                      <td class="small fw-bold">
                        <span class="text-uppercase" :style="textStyleForExchange(row.id)">{{ row.id }}</span>
                      </td>
                      <td class="text-center">
                        <span v-if="row.total > 0" class="badge bg-success">Checked</span>
                        <span v-else class="badge bg-warning text-dark">Pending</span>
                      </td>
                      <td class="text-end small" v-html="row.display"></td>
                    </tr>
                    <tr class="table-success" v-if="activeExchangeCount > 0">
                      <td class="small fw-bold">TOTAL</td>
                      <td class="text-center">
                        
                      </td>
                      <td class="text-end fw-bold small">{{ totalCexWithCurrency }}</td>
                    </tr>
                    <tr v-if="activeExchangeCount === 0">
                      <td colspan="3" class="py-3 text-center text-muted small">
                        <i class="bi bi-exclamation-triangle me-2"></i>No active exchanges
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Wallet Column -->
        <div class="col-lg-4">
          <div class="card border-success mb-3">
          <div class="card-header portfolio-card-header d-flex align-items-center justify-content-between" :style="cardHeaderStyles">
            <h6 class="mb-0" style="cursor: pointer;" data-bs-toggle="collapse" data-bs-target="#walletSettingsCollapse">
                <i class="bi bi-wallet2 me-2"></i>Wallet Settings
                <i class="bi bi-chevron-down ms-2 small"></i>
              </h6>
           
            </div>
            <div id="walletSettingsCollapse" class="collapse show">
              <div class="card-body">
                <div class="vstack gap-2">
                  <div
                    v-for="wallet in wallets"
                    :key="wallet.id"
                    class="border rounded p-2 portfolio-entity-card"
                    :style="entityCardStyle('chain', wallet.id, wallet.enabled)"
                  >
                    <div class="form-check mb-2">
                      <input class="form-check-input" type="checkbox" :id="wallet.id" v-model="wallet.enabled" @change="handleWalletToggle(wallet)">
                      <label class="form-check-label fw-semibold text-uppercase" :style="textStyleForChain(wallet.id)" :for="wallet.id">
                        <img v-if="wallet.icon" :src="wallet.icon" :alt="wallet.name" class="wallet-icon me-1" @error="handleIconError">
                        {{ wallet.short || wallet.name }}
                      </label>
                      <span v-if="wallet.enabled && wallet.status !== 'idle'" class="badge-status ms-2" :class="walletStatusBadgeClass(wallet.status)">
                        {{ walletStatusLabel(wallet.status) }}
                      </span>
                    </div>
                    <div v-if="wallet.enabled">
                      <div class="input-group input-group-sm portfolio-input-group">
                        <span class="input-group-text">
                          <i :class="getWalletInputIcon(wallet)"></i>
                        </span>
                        <input
                          type="text"
                          class="form-control text-uppercase"
                          :placeholder="wallet.placeholder || 'Enter wallet address'"
                          v-model.trim="wallet.address"
                          @input="handleWalletFieldInput(wallet, 'address')"
                        >
                      </div>
                    </div>
                    <div class="text-danger small" v-if="wallet.error">{{ wallet.error }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="card border-success">
            <div class="card-header portfolio-card-header d-flex justify-content-between align-items-center" :style="cardHeaderStyles">
              <h6 class="mb-0"><i class="bi bi-currency-dollar"></i>Saldo Wallet</h6>
              
              <span class="badge bg-light text-success">{{ activeWalletCount }}/{{ totalWalletCount }} 
              <button class="btn btn-primary btn-sm" @click="checkWalletBalances" :disabled="busy.wallet">
                  CHECK
              </button>
              </span>
            </div>
            <div class="card-body">
              <div class="tableFixHead">
                <table class="table table-sm table-hover mb-0">
                  <thead class="table-success">
                    <tr class="text-center">
                      <th class="small">CHAIN</th>
                      <th class="small">ASSET</th>
                      <th class="small">GAS</th>
                      <th class="small">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in activeWalletResults" :key="'active-' + (row?.chain || 'unknown')" :class="row.status === 'pending' ? 'table-warning' : 'table-light'">
                      <td class="small fw-bold">
                        <a :href="row.walletLink" target="_blank" rel="noopener" class="text-decoration-none">
                          <span class="text-uppercase" :style="textStyleForChain(row.chain)">{{ formatChainLabel(row.chain) }}</span>
                        </a>
                        <span v-if="row.status === 'pending'" class="badge bg-warning text-dark ms-1" style="font-size: 0.65rem;">Pending</span>
                      </td>
                      <td class="text-end small">
                        <div :class="row.status === 'pending' ? 'text-warning' : 'text-muted'">{{ formatUsd(row.assetValue) }}</div>
                      </td>
                      <td class="text-end small">
                        <div :class="row.status === 'pending' ? 'text-warning' : 'text-muted'">{{ formatUsd(row.gasValue) }}</div>
                      </td>
                      <td class="text-end fw-bold small" :class="row.status === 'pending' ? 'text-warning' : ''">{{ formatUsd(row.total) }}</td>
                    </tr>
                    <tr class="table-success" v-if="activeWalletCount > 0">
                      <td class="small fw-bold">TOTAL</td>
                      <td class="text-end fw-bold small">{{ formatUsd(totalWalletAssets) }}</td>
                      <td class="text-end fw-bold small">{{ formatUsd(totalWalletGas) }}</td>
                      <td class="text-end fw-bold small">{{ totalWalletWithCurrency }}</td>
                    </tr>
                    <tr v-if="activeWalletCount === 0">
                      <td colspan="4" class="py-3 text-center text-muted small">
                        <i class="bi bi-exclamation-triangle me-2"></i>No active wallets
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- History Column -->
        <div class="col-lg-4">
          <div class="card border-success mb-3">
            <div class="card-header portfolio-card-header d-flex justify-content-between align-items-center" :style="cardHeaderStyles" style="cursor: pointer;" data-bs-toggle="collapse" data-bs-target="#modalSettingsCollapse">
              <h6 class="mb-0">
                <i class="bi bi-currency-dollar me-2"></i>Modal Settings
                <i class="bi bi-chevron-down ms-2 small"></i>
              </h6>
              <div class="d-flex align-items-center gap-3">
                <button class="btn btn-warning btn-sm" @click="resetModal" :disabled="busy.pnl">
                  <i class="bi bi-arrow-clockwise me-1"></i>RESET
                </button>
              </div>
            </div>
           <div id="modalSettingsCollapse" class="collapse show">
            <div class="card-body">
              <div class="mb-3">
                <label class="form-label small fs-5 text-uppercase fw-bold mb-1">Modal Awal</label>
                <div class="row g-2">
                  <div class="col">
                    <input
                      type="number"
                      class="form-control form-control-sm"
                      placeholder="Modal Awal"
                      v-model.number="pnl.modalAwal"
                    />
                  </div>
                  <div class="col-auto">
                    <button  class="btn btn-success btn-sm" @click="saveModal"  :disabled="busy.pnl" >
                      <i class="bi bi-save me-1"></i> Simpan
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          </div>

          <div class="card border-success h-100">
          <div class="card-header portfolio-card-header" :style="cardHeaderStyles">
            <h6 class="mb-0"><i class="bi bi-graph-up me-2"></i>PNL History</h6>
          </div>
            <div class="card-body">
              <div class="tableFixHead" style="max-height: 600px;">
                <table class="table table-sm table-hover table-striped mb-0">
                  <thead class="table-success">
                    <tr class="text-center">
                      <th class="small text-left">DATE & TIME</th>
                      <th class="small">START</th>
                      <th class="small">FINAL</th>
                      <th class="small">PNL</th>
                      <th class="small">ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="!pnl.history.length">
                      <td colspan="5" class="py-3 text-center text-muted small">No history yet</td>
                    </tr>
                    <tr v-for="entry in pnl.history" :key="entry.timestamp">
                      <td class="small">{{ formatPnlTimestamp(entry.timestamp) }}</td>
                      <td class="text-end small">{{ formatUsd(entry.awal) }}</td>
                      <td class="text-end small">{{ formatUsd(entry.akhir) }}</td>
                      <td class="text-end small fw-bold" :class="entry.pnl >= 0 ? 'text-success' : 'text-danger'">
                        {{ formatUsd(entry.pnl) }}
                      </td>
                      <td class="text-center">
                        <span class="badge small" :class="entry.pnl >= 0 ? 'bg-success' : 'bg-danger'">
                          {{ entry.action.toUpperCase() }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Calculator Modal -->
      <div class="modal fade" id="calculator-modal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered calculator-modal-dialog">
          <div class="modal-content calculator-modal">
            <div class="modal-header">
              <div class="calculator-modal__title">
                <i class="bi bi-calculator-fill"></i>
                <span>Kalkulator Crypto</span>
              </div>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div class="calc-fields">
                <div class="calc-field" v-for="input in calculatorInputs" :key="input.id">
                  <label :for="input.id">{{ input.label }}</label>
                  <input
                    type="number"
                    class="form-control"
                    :id="input.id"
                    :placeholder="input.label"
                    v-model.number="input.value"
                    @input="handleCalculatorInput(input.id)"
                  >
                  <small class="text-muted" v-if="input.help">{{ input.help }}</small>
                </div>
              </div>

              <div class="calc-custom mt-4">
                <div class="calc-custom-label">Custom Token</div>
                <div class="calc-custom-inputs">
                  <input
                    type="text"
                    id="random1symbol"
                    placeholder="Symbol TOKEN"
                    class="form-control"
                    v-model.trim="rates.customSymbol"
                    maxlength="12"
                    @input="handleCustomSymbolInput"
                  >
                  <input
                    type="number"
                    id="random1price"
                    placeholder="Harga Token"
                    step="0.00000001"
                    class="form-control"
                    v-model.number="calculatorCustom.amount"
                    :disabled="!customPriceEditable"
                    @input="handleCustomAmountInput"
                  >
                </div>
              </div>

              <div class="calc-action-buttons">
                <button class="btn btn-danger flex-fill" id="cekTokensBtn" @click="fetchCustomTokenPrice" :disabled="!rates.customSymbol || isOperationBusy">
                  Cek Tokens
                </button>
                <button class="btn btn-primary flex-fill" @click="refreshRates" :disabled="isOperationBusy">
                  Update Price
                </button>
              </div>
   
            </div>
          </div>
        </div>
      </div>
    </div>
  `,

  async mounted() {
    console.log('Portfolio component mounted');

    // PENTING: Tunggu globalSettings ter-load dari root
    // Maksimal tunggu 5 detik, polling setiap 100ms
    let attempts = 0;
    const maxAttempts = 50; // 50 x 100ms = 5 detik

    while (!this.globalSettings && attempts < maxAttempts) {
      console.log(`⏳ Menunggu globalSettings... (${attempts + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!this.globalSettings) {
      console.error('❌ globalSettings tidak tersedia setelah 5 detik!');
      this.notify('⚠️ Gagal memuat pengaturan. Silakan refresh halaman.', 'danger');
      return;
    }

    console.log('✅ globalSettings berhasil dimuat, inisialisasi Portfolio...');

    this._initializeExchanges();
    this._initializeWallets();
    console.log(`✅ Portfolio initialized with ${this.exchanges.length} exchanges and ${this.wallets.length} chains.`);

    this._loadStateFromStorage();
    this._initializeTheme();

    // Auto-load rates on mount
    this.refreshRates();

    // Load data from IndexedDB on mount
    await this._loadDataFromDB();

    // Initialize PortfolioWeb3Helper if not already present
    console.log('🔍 Checking Web3.js availability...');
    console.log('  - typeof Web3:', typeof Web3);
    console.log('  - window.PortfolioWeb3Helper:', typeof window.PortfolioWeb3Helper);

    if (typeof Web3 === 'undefined') {
        console.error('❌ Web3.js not loaded! Please refresh the page.');
        this.notify('⚠️ Web3.js belum dimuat. Silakan refresh halaman.', 'danger');
        return;
    }

    if (typeof window.PortfolioWeb3Helper === 'undefined') {
        console.error('❌ PortfolioWeb3Helper class not found! Check if portfolio-web3-helper.js is loaded.');
        this.notify('⚠️ Portfolio Web3 Helper tidak ditemukan. Silakan refresh halaman.', 'danger');
        return;
    }

    if (this.config && !window.portfolioWeb3Helper) {
        window.portfolioWeb3Helper = new window.PortfolioWeb3Helper(this.config);
        console.log('✅ Portfolio Web3 Helper initialized.');
        console.log('  - Instance:', window.portfolioWeb3Helper);
    } else if (window.portfolioWeb3Helper) {
        console.log('✅ Portfolio Web3 Helper already initialized.');
    }

    this.portfolioReady = true;
  }
};
