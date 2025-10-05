// components/menus/portfolio.js
// Vue Component untuk Menu Portfolio - Refactored from asset.html

const PortfolioMenu = {
  name: 'PortfolioMenu',
  mixins: [themeMixin, databaseMixin], // Pastikan databaseMixin ada di sini

  data() {
    return {
      // --- Data from asset.html ---
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
    idrRateSummary() {
      if (!this.rates.idr) return 'Rp -';
      return `Rp ${this.rates.idr.toLocaleString('id-ID')}`;
    },
    activeChain() {
      return this.$root.activeChain;
    },
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
    pnlState() {
      const value = Number(this.portfolioPerformance?.pnl || 0);
      if (value > 0.0001) return 'positive';
      if (value < -0.0001) return 'negative';
      return 'neutral';
    },
    pnlCardClass() {
      return {
        'summary-pnl-card--positive': this.pnlState === 'positive',
        'summary-pnl-card--negative': this.pnlState === 'negative',
        'summary-pnl-card--neutral': this.pnlState === 'neutral'
      };
    },
    pnlValueClass() {
      return {
        'summary-pnl-value--positive': this.pnlState === 'positive',
        'summary-pnl-value--negative': this.pnlState === 'negative',
        'summary-pnl-value--neutral': this.pnlState === 'neutral'
      };
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
      // Sekarang menggunakan CSS variable, tidak perlu style object
      return {};
    },
    cardHeaderStyles() {
      // Sekarang menggunakan CSS variable, tidak perlu style object
      return {};
    }
  },

  methods: {
    summaryMetricClass(section) {
      // Dihapus, styling akan ditangani oleh CSS
      return '';
    },

    getEntityTextStyle(type, key) {
      return this.getColorStyles(type, key, 'text');
    },
    getEntityChipStyle(type, key) {
      return this.getColorStyles(type, key, 'solid');
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
    entityCardStyle(entityType, key, isHighlighted = false) {
      // Fungsi ini sekarang tidak digunakan, styling ditangani oleh CSS
      return {};
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
    resolveTokenRate(symbol, rates = {}, idrRate = null, fallbackRate = null) {
      const upper = String(symbol || '').toUpperCase();
      if (!upper) return null;

      if (fallbackRate != null && !Number.isNaN(fallbackRate)) {
        return Number(fallbackRate);
      }

      if (upper === 'USDT' || upper === 'USDC' || upper === 'BUSD') return 1;
      if (upper === 'IDR') {
        if (!idrRate || Number.isNaN(idrRate) || idrRate === 0) return null;
        return 1 / idrRate;
      }

      const direct = rates[upper];
      if (direct != null) return Number(direct);

      const pairKey = `${upper}USDT`;
      if (rates[pairKey] != null) return Number(rates[pairKey]);

      if (upper.startsWith('W')) {
        const stripped = upper.slice(1);
        if (rates[stripped] != null) return Number(rates[stripped]);
      }

      if (upper === 'POL') {
        if (rates.POL != null) return Number(rates.POL);
        if (rates.MATIC != null) return Number(rates.MATIC);
      }

      return null;
    },
    buildAssetsFromTokenMap(tokens = [], rates = {}, idrRate = null, options = {}) {
      const mapped = tokens
        .map((token, index) => {
          const symbol = String(token?.symbol || '').toUpperCase();
          const amount = Number(token?.amount ?? 0);
          if (!symbol) return null;

          const explicitRate = token?.rate != null ? Number(token.rate) : null;
          const explicitValue = token?.usdValue != null ? Number(token.usdValue) : null;
          const inferredRate = explicitRate != null
            ? explicitRate
            : (explicitValue != null && amount ? explicitValue / amount : null);

          const usdRate = this.resolveTokenRate(symbol, rates, idrRate, inferredRate);
          const usdValue = usdRate != null ? amount * usdRate : explicitValue;

          return {
            id: `${symbol}-${index}`,
            symbol,
            amount,
            usdRate,
            usdValue,
            rawValue: token?.value != null ? Number(token.value) : explicitValue,
            icon: token?.icon || null,
          };
        })
        .filter(Boolean)
        .sort((a, b) => (Number(b.usdValue || 0) - Number(a.usdValue || 0)) || (Number(b.amount || 0) - Number(a.amount || 0)));

      const limit = options.limit;
      if (Number.isFinite(limit) && limit > 0) {
        return mapped.slice(0, limit);
      }
      return mapped;
    },
    normalizeExchangeResult(exchangeId, result = {}, rates = {}, idrRate = null) {
      const fallbackAssets = Array.isArray(result.assets) ? result.assets : [];
      const rawAssetsInput = fallbackAssets.length ? fallbackAssets : (Array.isArray(result.raw_assets) ? result.raw_assets : []);
      const builtAssets = this.buildAssetsFromTokenMap(rawAssetsInput, rates, idrRate, { limit: 6 });

      // Jika handler tidak menyediakan assets mentah, coba gunakan properti helper
      let assets = builtAssets;
      if (!assets.length && Array.isArray(result.tokens)) {
        assets = this.buildAssetsFromTokenMap(result.tokens, rates, idrRate, { limit: 6 });
      }

      if (!assets.length && result.total != null) {
        const totalValue = Number(result.total) || 0;
        assets = [{ id: `${exchangeId}-fallback`, symbol: 'USDT', amount: totalValue, usdRate: 1, usdValue: totalValue }];
      }

      const total = assets.reduce((sum, asset) => sum + (Number(asset.usdValue) || 0), 0);

      return {
        total: Number.isFinite(total) && total >= 0 ? total : Number(result.total || 0),
        assets,
        raw_assets: rawAssetsInput,
        display: result.display || null,
      };
    },
    getDefaultGasSymbol(chainId) {
      const lower = String(chainId || '').toLowerCase();
      const chainConfig = this.$root.config?.CHAINS?.[lower] || {};
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
    tokenColorClass(symbol) {
      const upper = String(symbol || '').toUpperCase();
      switch (upper) {
        case 'ETH':
        case 'BTC':
        case 'WETH':
          return 'text-primary';
        case 'BNB':
        case 'SOL':
        case 'WBNB':
          return 'text-warning';
        case 'IDR':
          return 'text-danger';
        case 'USDT':
        case 'USDC':
        case 'BUSD':
        case 'DAI':
          return 'text-success';
        case 'MATIC':
        case 'POL':
        case 'ARB':
        case 'AVAX':
          return 'text-info';
        default:
          return 'text-secondary';
      }
    },
    buildWalletResult(wallet, source = {}) {
      const chainId = String(wallet?.id || source.chain || '').toLowerCase();
      const address = wallet?.address || source.address || '';
      const rawAssetsInput = Array.isArray(source.raw_assets) ? source.raw_assets : [];
      const primaryAsset = rawAssetsInput.length > 0 ? rawAssetsInput[0] : {};

      let normalizedAssets = rawAssetsInput
        .map((asset, index) => {
          const symbol = String(asset?.symbol || asset?.tokenSymbol || '').toUpperCase();
          if (!symbol) return null;
          const amount = Number(asset?.amount ?? asset?.qty ?? 0);
          const addressToken = asset?.address || asset?.tokenAddress || asset?.contract || null;
          let rate = asset?.rate != null ? Number(asset.rate) : null;
          let value = Number(asset?.value ?? asset?.usdValue ?? 0);

          if ((!value || Number.isNaN(value)) && amount) {
            const impliedRate = rate != null ? rate : this.resolveTokenRate(symbol, this.rates, this.rates?.idr);
            if (impliedRate != null) {
              rate = impliedRate;
              value = amount * impliedRate;
            }
          }

          return {
            id: asset?.id || `${symbol}-${index}`,
            symbol,
            amount,
            value: Number.isFinite(value) ? value : 0,
            rate: rate != null ? rate : null,
            address: addressToken
          };
        })
        .filter(asset => asset && (asset.amount > 0 || asset.value > 0));

      normalizedAssets.sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));

      if (!normalizedAssets.length) {
        const fallbackSymbol = (source.tokenSymbol || primaryAsset.symbol || 'USDT').toUpperCase();
        const fallbackAmount = Number(source.assetAmount ?? primaryAsset.amount ?? 0);
        let fallbackValue = Number(source.assetValue ?? primaryAsset.value ?? 0);
        let fallbackRate = source.assetRate != null ? Number(source.assetRate) : null;
        if ((!fallbackValue || Number.isNaN(fallbackValue)) && fallbackAmount) {
          const impliedRate = fallbackRate != null ? fallbackRate : this.resolveTokenRate(fallbackSymbol, this.rates, this.rates?.idr);
          if (impliedRate != null) {
            fallbackRate = impliedRate;
            fallbackValue = fallbackAmount * impliedRate;
          }
        }
        normalizedAssets = [{
          id: `${chainId}-${fallbackSymbol}-fallback`,
          symbol: fallbackSymbol,
          amount: fallbackAmount,
          value: Number.isFinite(fallbackValue) ? fallbackValue : 0,
          rate: fallbackRate,
          address: source.tokenAddress || primaryAsset.contract || null
        }];
      }

      const assetValue = normalizedAssets.reduce((sum, asset) => sum + (Number(asset.value) || 0), 0);

      const gasAmount = Number(source.gasAmount ?? 0);
      let gasValue = Number(source.gasValue ?? 0);
      let gasRate = source.gasRate != null ? Number(source.gasRate) : null;
      const gasSymbol = (source.gasSymbol || this.getDefaultGasSymbol(chainId)).toUpperCase();
      if ((!gasValue || Number.isNaN(gasValue)) && gasAmount) {
        const impliedGasRate = gasRate != null ? gasRate : this.resolveTokenRate(gasSymbol, this.rates, this.rates?.idr);
        if (impliedGasRate != null) {
          gasRate = impliedGasRate;
          gasValue = gasAmount * impliedGasRate;
        }
      }

      const total = assetValue + (Number.isFinite(gasValue) ? gasValue : 0);
      const walletLink = source.walletLink || this.buildWalletLink(chainId, address);

      return {
        chain: chainId,
        address,
        tokenSymbol: normalizedAssets[0]?.symbol || (source.tokenSymbol || 'USDT').toUpperCase(),
        tokenAddress: normalizedAssets[0]?.address || source.tokenAddress || primaryAsset.contract || null,
        assetAmount: assetValue,
        assetValue,
        assetRate: normalizedAssets[0]?.rate ?? null,
        gasAmount,
        gasValue,
        gasRate,
        gasSymbol,
        total,
        walletLink,
        raw_assets: normalizedAssets,
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
    // REVISI: Method baru untuk menentukan warna badge aksi PNL
    getPnlActionBadgeClass(action) {
      const actionLower = (action || '').toLowerCase();
      switch (actionLower) {
        case 'reset': return 'bg-danger';
        case 'update': return 'bg-success';
        default: return 'bg-secondary';
      }
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
      const wasBusy = this.$root.isLoading;
      const previousMessage = this.$root.loadingText;
      if (!wasBusy) {
        this.$root.isLoading = true;
        if (message) this.$root.loadingText = message;
      } else if (message) {
        this.$root.loadingText = message;
      }
      try {
        return await task();
      } finally {
        if (!wasBusy) {
          this.$root.isLoading = false;
        }
        this.$root.loadingText = previousMessage;
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
            assets: [],
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
          this._savePendingWalletToDB(wallet); // Simpan ke DB sebagai pending
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
            this._savePendingWalletToDB(wallet); // Simpan ke DB sebagai pending
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
            this._savePendingWalletToDB(wallet); // Update juga di DB
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
    async _savePendingWalletToDB(wallet) {
      if (!wallet || !wallet.id || !wallet.address) return;

      try {
        const dbWalletData = {
          key: wallet.id,
          name: wallet.id,
          label: wallet.name,
          address: wallet.address,
          lastResult: {
            chain: wallet.id,
            address: wallet.address,
            total: 0,
            status: 'pending' // Tandai sebagai pending
          },
          lastChecked: new Date().toISOString()
        };
        await this.dbSet('ASET_WALLET', dbWalletData);
        console.log(`✅ Data wallet pending untuk ${wallet.name} disimpan ke IndexedDB.`);
      } catch (error) {
        console.error(`❌ Gagal menyimpan data wallet pending untuk ${wallet.name}:`, error);
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
      this.$root.isLoading = true;
      this.$root.loadingText = 'Mengecek exchange...';

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
                result = await handler(exchange, activeConfig, rates, idrRate);
            }

            exchange.status = 'success';
            exchange.lastResult = result;

            const normalized = this.normalizeExchangeResult(exchange.id, result, rates, idrRate);

            const dbData = {
              name_cex: exchange.id,
              snapshot: { totalBalance: normalized.total, assets: normalized.raw_assets || [] },
              lastUpdated: new Date().toISOString()
            };
            await this.dbSet('ASET_EXCHANGER', dbData);

            this.activeExchangeSummaries.push({
              id: exchange.id,
              name: exchange.name,
              total: normalized.total,
              assets: normalized.assets,
              display: normalized.display
            });

            totalCex += normalized.total;
            console.log(`✅ ${exchange.name}: $${normalized.total.toFixed(2)}`);
          } catch (error) {
            exchange.status = 'error';
            exchange.error = error.message;
            console.error(`❌ ${exchange.name}:`, error);
          }
        }

        this.portfolioBreakdown.cex = totalCex;
        this.portfolioBreakdown.total = totalCex + this.portfolioBreakdown.wallet;
        this.portfolioPerformance.pnl = this.portfolioBreakdown.total - this.pnl.modalAwal;
        this.totalCexWithCurrency = this.formatUsd(totalCex);
        this.activeExchangeCount = this.activeExchangeSummaries.length;
        this.inactiveExchanges = this.exchanges.filter(e => !e.enabled);
        this.lastRefresh = Date.now();
        this.notify(`✅ Berhasil cek ${enabledExchanges.length} exchange`, 'success');
      } catch (error) {
        console.error('Exchange check failed:', error);
        this.notify(`❌ Gagal cek exchange: ${error.message}`, 'danger');
      } finally {
        this.busy.exchange = false;
        this.$root.isLoading = false;
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
      this.$root.isLoading = true;
      this.$root.loadingText = `Mengecek ${walletsToProcess.length} wallet...`;

      try {
        const rates = await this.fetchRates(this.config, this.config.priceSymbols);
        const idrRate = await this.fetchIndodaxRate(this.config);
        Object.assign(this.rates, rates);
        if (idrRate) this.rates.idr = idrRate;

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
        this.$root.isLoading = false;
      }
    },
    async checkModalCombined() {
      this.$root.isLoading = true;
      this.$root.loadingText = 'Mengecek semua aset...';

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
        this.$root.isLoading = false;
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
      this.$root.isLoading = true;
      this.$root.loadingText = 'Memperbarui PNL history...';

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
        this.$root.isLoading = false;
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

      this.$root.isLoading = true;
      this.$root.loadingText = `Mengecek harga ${this.rates.customSymbol}...`;

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
        this.$root.isLoading = false;
      }
    },
    async refreshRates() {
      this.$root.isLoading = true;
      this.$root.loadingText = 'Memperbarui harga...';

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
        this.$root.isLoading = false;
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

      // Ambil semua kunci Chain dari config (sumber utama)
      const allChainKeys = Object.keys(allChainsConfig);

      // Debug logging
      console.log('🔍 Portfolio._initializeWallets()');
      console.log('  - Total Chain di config:', allChainKeys.length);
      console.log('  - globalSettings ada?', !!this.globalSettings);
      console.log('  - globalSettings.config_chain:', this.globalSettings?.config_chain); // Untuk debugging

      // REVISI: Filter berdasarkan status di globalSettings (jika ada)
      const enabledChainKeys = this.globalSettings?.config_chain
        ? allChainKeys.filter(key => {
            const isEnabled = this.globalSettings.config_chain[key]?.status === true;
            // console.log(`    - ${key}: ${isEnabled ? '✅' : '❌'}`); // Uncomment untuk debug
            return isEnabled;
          })
        : allChainKeys; // Fallback: tampilkan semua jika globalSettings belum ada

      console.log('  - Chain yang akan ditampilkan:', enabledChainKeys);

      this.wallets = enabledChainKeys.map(chainKey => { // REVISI: Gunakan enabledChainKeys
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
              const assets = this.buildAssetsFromTokenMap(data.snapshot.assets || [], this.rates, this.rates?.idr, { limit: 6 });
              this.activeExchangeSummaries.push({
                id: exchange.id,
                name: exchange.name,
                total,
                assets,
                display: assets.length ? null : this.formatUsd(total)
              });
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
    async handleBinance(exchange, config, rates = {}, idrRate = null) {
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

        const tokens = (data.balances || [])
          .map(balance => ({
            symbol: balance.asset,
            amount: parseFloat(balance.free || 0) + parseFloat(balance.locked || 0)
          }))
          .filter(token => token.amount > 0);

        const assets = this.buildAssetsFromTokenMap(tokens, rates, idrRate, { limit: 6 });
        const total = assets.reduce((sum, asset) => sum + (asset.usdValue || 0), 0);

        return {
          total,
          assets,
          raw_assets: assets,
          display: assets.length ? null : `<span class="text-secondary">0.00 USDT</span>`
        };
    },
    async handleGate(exchange, config, rates = {}, idrRate = null) {
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

        const tokens = (data || [])
          .map(item => ({ symbol: item.currency, amount: parseFloat(item.available || 0) }))
          .filter(token => token.amount > 0);

        const assets = this.buildAssetsFromTokenMap(tokens, rates, idrRate, { limit: 6 });
        const total = assets.reduce((sum, asset) => sum + (asset.usdValue || 0), 0);

        return {
          total,
          assets,
          raw_assets: assets,
          display: assets.length ? null : `<span class="text-secondary">0.00 USDT</span>`
        };
    },
    async handleBybit(exchange, config, rates = {}, idrRate = null) {
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

        const coins = data.result?.list?.[0]?.coin || [];
        const tokens = coins
          .map(item => ({ symbol: item.coin, amount: parseFloat(item.equity || 0) }))
          .filter(token => token.amount > 0);

        const assets = this.buildAssetsFromTokenMap(tokens, rates, idrRate, { limit: 6 });
        const total = assets.reduce((sum, asset) => sum + (asset.usdValue || 0), 0);

        return {
          total,
          assets,
          raw_assets: assets,
          display: assets.length ? null : `<span class="text-secondary">0.00 USDT</span>`
        };
    },
    async handleKucoin(exchange, config, rates = {}, idrRate = null) {
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

        const tokens = (data.data || [])
          .map(item => ({ symbol: item.currency, amount: parseFloat(item.available || 0) }))
          .filter(token => token.amount > 0);

        const assets = this.buildAssetsFromTokenMap(tokens, rates, idrRate, { limit: 6 });
        const total = assets.reduce((sum, asset) => sum + (asset.usdValue || 0), 0);

        return {
          total,
          assets,
          raw_assets: assets,
          display: assets.length ? null : `<span class="text-secondary">0.00 USDT</span>`
        };
    },
    async handleMexc(exchange, config, rates = {}, idrRate = null) {
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

        const tokens = (data.balances || [])
          .map(item => ({ symbol: item.asset, amount: parseFloat(item.free || 0) }))
          .filter(token => token.amount > 0);

        const assets = this.buildAssetsFromTokenMap(tokens, rates, idrRate, { limit: 6 });
        const total = assets.reduce((sum, asset) => sum + (asset.usdValue || 0), 0);

        return {
          total,
          assets,
          raw_assets: assets,
          display: assets.length ? null : `<span class="text-secondary">0.00 USDT</span>`
        };
    },
    async handleIndodax(exchange, config, rates = {}, idrRate = null) {
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
        const tokens = [
            { symbol: 'ETH', amount: parseFloat(balance.eth || 0), rate: rates.ETH || null },
            { symbol: 'BNB', amount: parseFloat(balance.bnb || 0), rate: rates.BNB || null },
            { symbol: 'USDT', amount: parseFloat(balance.usdt || 0), rate: 1 },
            { symbol: 'IDR', amount: parseFloat(balance.idr || 0), rate: idrRate ? 1 / idrRate : null }
        ];

        const assets = this.buildAssetsFromTokenMap(tokens, rates, idrRate, { limit: 6 });
        const total = assets.reduce((sum, asset) => sum + (asset.usdValue || 0), 0);

        return {
            total,
            assets,
            raw_assets: assets
        };
    },
    async handleBitget(exchange, config, rates = {}, idrRate = null) {
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

        const tokens = (data.data || [])
          .map(item => ({ symbol: item.coin, amount: parseFloat(item.available || 0) }))
          .filter(token => token.amount > 0);

        const assets = this.buildAssetsFromTokenMap(tokens, rates, idrRate, { limit: 6 });
        const total = assets.reduce((sum, asset) => sum + (asset.usdValue || 0), 0);

        return {
          total,
          assets,
          raw_assets: assets,
          display: assets.length ? null : `<span class="text-secondary">0.00 USDT</span>`
        };
    },

  },

  // The template is now a very large string.
  // It's the entire content of the <body> from asset.html.
  template: `
    <div v-cloak class="portfolio-menu">
      <!-- REFACTORED: Portfolio Toolbar - Mirip HistoryMenu -->
      <div class="card card-body">
        <div class="row g-2 align-items-center">
          <!-- Grup Kiri: Judul dan Info -->
          <div class="col-12 col-lg d-flex align-items-center gap-3 flex-wrap">
            <h5 class="mb-0 d-flex align-items-center gap-2">
              <i class="bi bi-cash-stack"></i>
              Portofolio Aset
            </h5>
            <span class="badge bg-light text-dark border">
              Last Update: {{ lastRefreshLabel }}
            </span>
            <span class="badge bg-light text-dark border">
              Rate USDT: {{ idrRateSummary }}
            </span>
          </div>
          
        </div>
      </div>

      <!-- Summary Panel -->
      <div class="card card-body mb-2 pt-2 pb-2">
        <div class="row g-2">
          <!-- Metrics -->
          <div class="col-md-3 col-6 mb-2 mb-md-0">
            <div class="p-3 border rounded bg-light h-100">
              <div class="small text-muted text-uppercase fw-semibold">Exchanger Assets</div>
              <div class="fs-5 fw-bold">{{ formatUsd(portfolioBreakdown?.cex || 0) }}</div>
              <small class="d-block mt-1 text-muted">{{ formatIdrEquivalent(portfolioBreakdown?.cex || 0) }}</small>
            </div>
          </div>
          <div class="col-md-3 col-6 mb-2 mb-md-0">
            <div class="p-3 border rounded bg-light h-100">
              <div class="small text-muted text-uppercase fw-semibold">Wallet Assets</div>
              <div class="fs-5 fw-bold">{{ formatUsd(portfolioBreakdown?.wallet || 0) }}</div>
              <small class="d-block mt-1 text-muted">{{ formatIdrEquivalent(portfolioBreakdown?.wallet || 0) }}</small>
            </div>
          </div>
          <div class="col-md-3 col-6 mb-2 mb-md-0">
            <div class="p-3 border rounded bg-light h-100">
              <div class="small text-muted text-uppercase fw-semibold">Total Asset</div>
              <div class="fs-5 fw-bold">{{ formatUsd(portfolioBreakdown?.total || 0) }}</div>
              <small class="d-block mt-1 text-muted">{{ formatIdrEquivalent(portfolioBreakdown?.total || 0) }}</small>
            </div>
          </div>
          <div class="col-md-3 col-6 mb-2 mb-md-0">
            <div class="summary-pnl-card h-100 p-3" :class="pnlCardClass">
              <div class="summary-pnl-label">PNL</div>
              <div class="summary-pnl-value" :class="pnlValueClass">
                {{ formatUsd(portfolioPerformance?.pnl || 0) }}
              </div>
              <small class="summary-pnl-idr" :class="pnlValueClass">
                {{ formatIdrEquivalent(portfolioPerformance?.pnl || 0) }}
              </small>
            </div>
          </div>
          <div class="d-flex justify-content-end flex-wrap gap-2 mt-2">
            <button class="btn btn-sm btn-danger" @click="resetModal" :disabled="busy.exchange || busy.wallet || busy.pnl">
              <i class="bi bi-arrow-counterclockwise"></i> Reset Modal
            </button>
            <button class="btn btn-sm btn-primary" @click="checkModalCombined" :disabled="busy.exchange || busy.wallet">
              <i class="bi bi-wallet"></i> Check Asset
            </button>
            <button class="btn btn-sm btn-success" @click="updateHistoryWithRefresh" :disabled="busy.pnl">
              <i class="bi bi-currency-dollar"></i> Update PNL
            </button>
           
            <div class="d-grid d-sm-inline-flex gap-2 justify-content-lg-end">
              <button class="btn btn-sm btn-info" @click="openCalculatorModal" title="Calculator">
                <i class="bi bi-calculator"></i>
              </button>
              <button class="btn btn-sm btn-dark" @click="openInNewTab" title="Open in New Tab">
                <i class="bi bi-box-arrow-up-right"></i>
              </button>
            </div>
          </div>
        </div>
        
      </div>

      <!-- Main Content -->
      <div class="row g-2">
        <!-- Settings Column (Left) -->
        <div class="col-lg-4">
          <!-- REVISI: Exchanger Settings sebagai Card biasa -->
          <div class="card portfolio-card mb-2">
            <div class="card-header">
              <h6 class="mb-0"><i class="bi bi-gear me-2"></i>Exchanger Settings</h6>
            </div>
            <div class="card-body p-2" style="max-height: 280px; overflow-y: auto;">
              <div class="row g-2">
                <div v-for="exchange in exchanges" :key="exchange.id" class="col-12">
                  <div class="border rounded p-2" :class="{'entity-card--active': exchange.enabled}">
                    <div class="form-check mb-2">
                      <input class="form-check-input" type="checkbox" :id="exchange.id" v-model="exchange.enabled" @change="handleExchangeToggle(exchange)">
                      <label class="form-check-label fw-semibold text-uppercase" :for="exchange.id" :style="getEntityTextStyle('cex', exchange.id)">
                        {{ exchange.name }}
                      </label>
                      <span v-if="exchange.enabled && exchange.status !== 'idle'" class="badge ms-2" :class="exchangeStatusBadgeClass(exchange.status)">
                        {{ exchangeStatusLabel(exchange.status) }}
                      </span>
                    </div>
                    <div v-if="exchange.enabled">
                      <div v-for="field in exchange.fields" :key="field.key" class="input-group input-group-sm mb-2">
                        <span class="input-group-text"><i :class="getExchangeFieldIcon(field.key)"></i></span>
                        <input :type="field.type || 'text'" class="form-control text-uppercase" :placeholder="field.placeholder" v-model.trim="field.value" @input="handleExchangeFieldInput(exchange, field)">
                      </div>
                    </div>
                    <div class="text-danger small" v-if="exchange.error">{{ exchange.error }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- REVISI: Wallet Settings sebagai Card biasa -->
          <div class="card portfolio-card">
            <div class="card-header">
              <h6 class="mb-0"><i class="bi bi-gear me-2"></i>Wallet Settings</h6>
            </div>
            <div class="card-body p-2" style="max-height: 280px; overflow-y: auto;">
              <div class="row g-2">
                <div v-for="wallet in wallets" :key="wallet.id" class="col-12">
                  <div class="border rounded p-2" :class="{'entity-card--active': wallet.enabled}">
                    <div class="form-check mb-2">
                      <input class="form-check-input" type="checkbox" :id="wallet.id" v-model="wallet.enabled" @change="handleWalletToggle(wallet)">
                      <label class="form-check-label fw-semibold" :for="wallet.id" :style="getEntityTextStyle('chain', wallet.id)">
                        <img v-if="wallet.icon" :src="wallet.icon" :alt="wallet.name" class="wallet-icon me-1" @error="handleIconError">
                        {{ wallet.short || wallet.name }}
                      </label>
                      <span v-if="wallet.enabled && wallet.status !== 'idle'" class="badge ms-2" :class="walletStatusBadgeClass(wallet.status)">
                        {{ walletStatusLabel(wallet.status) }}
                      </span>
                    </div>
                    <div v-if="wallet.enabled">
                      <div class="input-group input-group-sm">
                        <span class="input-group-text"><i :class="getWalletInputIcon(wallet)"></i></span>
                        <input type="text" class="form-control text-uppercase" :placeholder="wallet.placeholder || 'Enter wallet address'" v-model.trim="wallet.address" @input="handleWalletFieldInput(wallet, 'address')">
                      </div>
                    </div>
                    <div class="text-danger small" v-if="wallet.error">{{ wallet.error }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Balances Column (Center) -->
        <div class="col-lg-4">
          <!-- Saldo Exchanger -->
          <div class="card portfolio-card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h6 class="mb-0"><i class="bi bi-currency-dollar me-2"></i>Saldo Exchanger</h6>
              <div class="btn-group btn-group-sm" role="group">
                <button class="btn btn-sm btn-success" @click="checkSelectedExchanges" :disabled="busy.exchange">
                  <i class="bi bi-arrow-repeat"></i> CHECK
                </button>
                <button class="btn btn-sm btn-light text-secondary" disabled>
                  {{ activeExchangeCount }}/{{ totalExchangeCount }}
                </button>
              </div>
            </div>
            <div class="card-body p-0">
              <div class="table-responsive" style="max-height: 400px;">
                <table class="table table-sm table-hover mb-0">
                  <thead>
                    <tr class="text-center">
                      <th class="small">EXCHANGE</th>
                      <th class="small">STATUS</th>
                      <th class="small">BALANCE</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in activeExchangeSummaries" :key="'active-' + row.id" class="table-light">
                      <td class="small fw-bold">
                        <span class="badge" :style="getEntityChipStyle('cex', row.id)">{{ row.id.toUpperCase() }}</span>
                      </td>
                      <td class="text-center">
                        <span v-if="row.total > 0" class="badge bg-success">Checked</span>
                        <span v-else class="badge bg-warning text-dark">Pending</span>
                      </td>
                      <td class="text-end small">
                        <div v-if="row.assets && row.assets.length" class="d-flex flex-column gap-1">
                          <div v-for="asset in row.assets" :key="row.id + '-' + (asset.symbol || 'token') + '-' + (asset.id || 'idx')" class="portfolio-asset-line">
                            <span class="fw-semibold" :class="tokenColorClass(asset.symbol)">
                              {{ formatTokenAmount(asset.amount) }} {{ asset.symbol }}
                            </span>
                            <span class="text-muted">≈ {{ formatUsd(asset.usdValue) }}</span>
                          </div>
                        </div>
                        <div v-else-if="row.display" v-html="row.display"></div>
                        <div v-else class="text-muted">-</div>
                      </td>
                    </tr>
                    <tr   v-if="activeExchangeCount > 0">
                      <td colspan="2" class="small fw-bold">TOTAL</td>
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

          <!-- Saldo Wallet -->
          <div class="card portfolio-card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h6 class="mb-0"><i class="bi bi-wallet me-2"></i>Saldo Wallet</h6>
              <div class="btn-group btn-group-sm" role="group">
                <button class="btn btn-sm btn-success" @click="checkWalletBalances" :disabled="busy.wallet">
                  <i class="bi bi-arrow-repeat"></i> CHECK
                </button>
                <button class="btn btn-sm btn-light text-secondary" disabled>
                  {{ activeWalletCount }}/{{ totalWalletCount }}
                </button>
              </div>
            </div>
            <div class="card-body p-0">
              <div class="table-responsive" style="max-height: 400px;">
                <table class="table table-sm table-hover mb-0">
                  <thead>
                    <tr class="text-center">
                      <th class="small">CHAIN</th>
                      <th class="small">ASSET</th>
                      <th class="small">GAS CHAIN</th>
                      <th class="small">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in activeWalletResults" :key="'active-' + (row?.chain || 'unknown')" :class="row.status === 'pending' ? 'table-warning' : 'table-light'">
                      <td class="small fw-bold">
                        <a :href="row.walletLink" target="_blank" rel="noopener" class="text-decoration-none">
                          <span class="text-uppercase" :style="getEntityTextStyle('chain', row.chain)">{{ formatChainLabel(row.chain) }}</span>
                          <button class="btn btn-sm btn-link py-0 px-1" @click.prevent.stop="checkWalletBalances(wallets.find(w => w.id === row.chain))" title="Refresh this wallet">
                            <i class="bi bi-arrow-repeat"></i>
                          </button>
                        </a>
                        <span v-if="row.status === 'pending'" class="badge bg-warning text-dark ms-1" style="font-size: 0.65rem;">Pending</span>
                      </td>
                      <td class="text-end small">
                        <div v-if="row.raw_assets && row.raw_assets.length" class="d-flex flex-column gap-1">
                          <div v-for="asset in row.raw_assets" :key="row.chain + '-' + (asset.symbol || row.tokenSymbol || 'asset')" class="portfolio-asset-line">
                            <span class="fw-semibold" :class="tokenColorClass(asset.symbol)">{{ formatTokenAmount(asset.amount) }} {{ (asset.symbol || row.tokenSymbol || 'USDT').toUpperCase() }}</span>
                            <span class="text-muted">≈ {{ formatUsd(asset.value) }}</span>
                          </div>
                        </div>
                        <div v-else :class="row.status === 'pending' ? 'text-warning' : 'text-muted'">{{ formatUsd(row.assetValue) }}</div>
                      </td>
                      <td class="text-end small">
                        <div class="portfolio-asset-line" :class="row.status === 'pending' ? 'text-warning' : ''">
                          <span class="fw-semibold">{{ formatTokenAmount(row.gasAmount) }} {{ row.gasSymbol }}</span>
                          <span class="text-muted">≈ {{ formatUsd(row.gasValue) }}</span>
                        </div>
                      </td>
                      <td class="text-end fw-bold small" :class="row.status === 'pending' ? 'text-warning' : ''">{{ formatUsd(row.total) }}</td>
                    </tr>
                    <tr   v-if="activeWalletCount > 0">
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

        <!-- History Column (Right) -->
        <div class="col-lg-4">
          <!-- Modal Settings Card -->
          <div class="card portfolio-card">
            <div class="card-header">
              <h6 class="mb-0"><i class="bi bi-cash-coin me-2"></i>Modal Settings</h6>
            </div>
            <div class="card-body">
              <label class="form-label small fw-semibold mb-1 fs-6">Modal Awal</label>
              <div class="input-group input-group-sm">
                <span class="input-group-text">$</span>
                <input type="number" class="form-control" placeholder="Modal Awal" v-model.number="pnl.modalAwal"/>
                <button class="btn btn-sm btn-success" @click="saveModal" :disabled="busy.pnl" title="Simpan Modal">
                  Simpan
                </button>
                <button class="btn btn-sm btn-danger" @click.stop="resetModal" :disabled="busy.pnl" title="Reset Modal ke Total Aset">
                  Reset
                </button>
              </div>
              <div class="text-muted small mt-1">
                Setara dengan: <strong>{{ formatIdrEquivalent(pnl.modalAwal) }}</strong>
              </div>
            </div>
          </div>

          <!-- PNL History Card -->
          <div class="card portfolio-card">
            <div class="card-header">
              <h6 class="mb-0"><i class="bi bi-graph-up me-2"></i>PNL History</h6>
            </div>
            <div class="card-body p-0">
              <div class="table-responsive" style="max-height: 600px;">
                <table class="table table-sm table-hover table-striped mb-0">
                  <thead>
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
                      <td class="text-center" style="width: 1%;">
                        <span class="badge badge-sm" :class="getPnlActionBadgeClass(entry.action)">
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

      <!-- Calculator Modal -->
      <div class="modal fade" id="calculator-modal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered calculator-modal-dialog">
          <div class="modal-content calculator-modal">
            <div class="modal-header">
              <div class="calculator-modal__title">
                <i class="bi bi-calculator-fill"></i>
                <span class="fs-5 ms-3">Kalkulator Crypto</span>
              </div>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div class="calc-fields">
                <div class="input-group mb-2" v-for="input in calculatorInputs" :key="input.id">
                   <span class="input-group-text" :for="input.id" style="width: 120px;">{{ input.label }}</span>
                   <input
                     type="number"
                     class="form-control"
                     :id="input.id"
                     :placeholder="input.label"
                     v-model.number="input.value"
                     @input="handleCalculatorInput(input.id)"
                   >
                </div>
              </div>

              <div class="calc-custom mt-4 mb-4">
                <div class="calc-custom-label">Custom Token</div>
                <div class="input-group">
                  <input
                    type="text"
                    id="random1symbol"
                    placeholder="Symbol TOKEN"
                    class="form-control" style="flex-grow: 0.5;"
                    v-model.trim="rates.customSymbol"
                    maxlength="12"
                    @input="handleCustomSymbolInput"
                  >
                  <input
                    type="number"
                    id="random1amount"
                    placeholder="Harga Token"
                    step="0.00000001"
                    class="form-control"
                    v-model.number="calculatorCustom.amount"
                    :disabled="!customPriceEditable"
                    @input="handleCustomAmountInput"
                  >
                  <span class="input-group-text" v-if="rates.customPrice > 0">{{ formatUsd(calculatorCustom.amount * rates.customPrice) }}</span>
                </div>
              </div>

              <div class="calc-action-buttons ms-2 text-end">
                <button class="btn btn-sm btn-info flex-fill" id="cekTokensBtn" @click="fetchCustomTokenPrice" :disabled="!rates.customSymbol || $root.isLoading">
                  Cek Tokens
                </button>
                <button class="btn btn-sm btn-success flex-fill" @click="refreshRates" :disabled="$root.isLoading">
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

    // --- PERMINTAAN: Autoload Aset ---
    // Secara otomatis memanggil pengecekan aset gabungan setelah semua inisialisasi selesai.
    console.log('🚀 Memulai autoload aset portofolio...');
    this.checkModalCombined();
  }
};
