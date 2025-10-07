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
    normalizeSymbolCandidates(rawSymbol) {
      if (!rawSymbol && rawSymbol !== 0) return [];
      const rawString = String(rawSymbol).trim();
      if (!rawString) return [];

      const sanitized = rawString
        .replace(/[\s]+/g, ' ')
        .replace(/[|,:]/g, ' ')
        .replace(/[_\-\/]/g, ' ');

      const parts = sanitized.split(' ').filter(Boolean);
      const candidates = new Set();

      parts.forEach(part => {
        const upper = part.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        if (!upper) return;
        candidates.add(upper);

        if (upper.endsWith('USDT') && upper.length > 4) {
          candidates.add(upper.slice(0, -4));
        }

        if (upper.startsWith('W') && upper.length > 1) {
          candidates.add(upper.slice(1));
        }

        if (upper === 'POL') {
          candidates.add('MATIC');
        }
      });

      return Array.from(candidates);
    },
    collectSymbolsFromAssets(assets = []) {
      const symbols = new Set();
      if (!Array.isArray(assets)) return symbols;

      assets.forEach(asset => {
        if (!asset) return;
        const candidates = [
          asset.symbol,
          asset.tokenSymbol,
          asset.asset,
          asset.currency,
          asset.code,
          asset.token,
          asset.baseSymbol,
          asset.quoteSymbol,
          asset.baseAsset,
          asset.quoteAsset
        ];
        candidates.forEach(candidate => {
          this.normalizeSymbolCandidates(candidate).forEach(sym => symbols.add(sym));
        });
      });

      return Array.from(symbols);
    },
    collectSymbolsFromExchangeResult(result = {}) {
      const symbols = new Set();

      const arraysToCheck = [
        result.assets,
        result.raw_assets,
        result.tokens,
        result.snapshot?.assets
      ];

      arraysToCheck.forEach(list => {
        this.collectSymbolsFromAssets(list).forEach(sym => symbols.add(sym));
      });

      const singleCandidates = [
        result.symbol,
        result.baseAsset,
        result.quoteAsset,
        result.primarySymbol
      ];
      singleCandidates.forEach(candidate => {
        this.normalizeSymbolCandidates(candidate).forEach(sym => symbols.add(sym));
      });

      return Array.from(symbols);
    },
    collectSymbolsFromWalletSource(source = {}, wallet = {}) {
      const symbols = new Set();

      this.collectSymbolsFromAssets(source.raw_assets).forEach(sym => symbols.add(sym));

      const singleCandidates = [
        source.tokenSymbol,
        source.gasSymbol,
        wallet?.tokenSymbol,
        wallet?.symbol,
        wallet?.gasSymbol
      ];
      singleCandidates.forEach(candidate => {
        this.normalizeSymbolCandidates(candidate).forEach(sym => symbols.add(sym));
      });

      // Pastikan native chain symbol juga ikut dicek
      if (wallet?.id) {
        this.normalizeSymbolCandidates(this.getDefaultGasSymbol(wallet.id)).forEach(sym => symbols.add(sym));
      }

      return Array.from(symbols);
    },
    async ensureRatesForSymbols(symbols = []) {
      if (!Array.isArray(symbols) || symbols.length === 0) return;
      const fetcher = this.$root?.realtimeDataFetcher;
      if (!fetcher || typeof fetcher.fetchRates !== 'function') return;

      const normalizedSymbols = new Set();
      symbols.forEach(symbol => {
        this.normalizeSymbolCandidates(symbol).forEach(sym => normalizedSymbols.add(sym));
      });

      const stableCoins = new Set(['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USD', 'IDR']);
      const missingSymbols = Array.from(normalizedSymbols).filter(symbol => {
        if (!symbol || stableCoins.has(symbol)) return false;
        const direct = Number(this.rates[symbol]);
        if (!Number.isNaN(direct) && direct > 0) return false;
        const pairKey = `${symbol}USDT`;
        const pairValue = Number(this.rates[pairKey]);
        if (!Number.isNaN(pairValue) && pairValue > 0) return false;
        return true;
      });

      if (missingSymbols.length === 0) return;

      const requestSymbols = missingSymbols.map(symbol => `${symbol}USDT`);

      try {
        const fetched = await fetcher.fetchRates(requestSymbols);
        missingSymbols.forEach(symbol => {
          const pairKey = `${symbol}USDT`;
          const altKeys = [pairKey];

          if (symbol === 'POL') {
            altKeys.push('MATICUSDT');
          }
          if (symbol === 'MATIC') {
            altKeys.push('POLUSDT');
          }

          const fetchedValue = altKeys.reduce((value, key) => {
            if (value != null) return value;
            return fetched?.[key] != null ? Number(fetched[key]) : null;
          }, null);

          if (fetchedValue != null && !Number.isNaN(fetchedValue) && fetchedValue > 0) {
            this.rates[symbol] = fetchedValue;
            this.rates[pairKey] = fetchedValue;
          }
        });
      } catch (error) {
        console.error('[Portfolio] Gagal memuat rate dinamis:', error);
      }
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
    async handleExchangeToggle(exchange) {
      await this.saveExchangeState(exchange);

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
      }

      // Update counter dan daftar inactive
      this.activeExchangeCount = this.activeExchangeSummaries.length;
      this.inactiveExchanges = this.exchanges.filter(e => !e.enabled);
    },
    async handleExchangeFieldInput(exchange, field) {
      clearTimeout(this._exchangeSaveTimer);
      this._exchangeSaveTimer = setTimeout(async () => {
        await this.saveExchangeState(exchange);
      }, 700);
    },
    async handleWalletToggle(wallet) {
      await this.saveWalletState(wallet);

      // Auto-update daftar wallet
      if (wallet.enabled && wallet.address) {
        // Tambahkan ke daftar aktif jika belum ada
        const existingIndex = this.activeWalletResults.findIndex(w => w.chain === wallet.id);
        if (existingIndex === -1) {
          await this._savePendingWalletToDB(wallet); // Simpan ke DB sebagai pending
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
    async handleWalletFieldInput(wallet, fieldKey) {
      clearTimeout(this._walletSaveTimer);
      this._walletSaveTimer = setTimeout(async () => {
        await this.saveWalletState(wallet);

        // Jika wallet enabled dan ada address, auto-update daftar
        if (wallet.enabled && wallet.address) {
          const existingIndex = this.activeWalletResults.findIndex(w => w.chain === wallet.id);
          if (existingIndex === -1) {
            await this._savePendingWalletToDB(wallet); // Simpan ke DB sebagai pending
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
            await this._savePendingWalletToDB(wallet); // Update juga di DB
            this.activeWalletResults[existingIndex].walletLink = this.buildWalletLink(wallet.id, wallet.address);
          }
        }
      }, 700);
    },
    async saveExchangeState(exchange) {
      try {
        const state = {
          id: `exchange_${exchange.id}`,
          type: 'exchange',
          enabled: exchange.enabled,
          fields: exchange.fields.map(f => ({ key: f.key, value: f.value }))
        };
        await this.dbSet('PORTFOLIO_CREDENTIALS', state);
        this.notify(`Pengaturan ${exchange.name} tersimpan`, 'success');
      } catch (error) {
        console.warn('Failed to save exchange state:', error);
        this.notify(`Gagal menyimpan pengaturan ${exchange.name}`, 'danger');
      }
    },
    async saveWalletState(wallet) {
      try {
        const state = {
          id: `wallet_${wallet.id}`,
          type: 'wallet',
          enabled: wallet.enabled,
          address: wallet.address
        };
        await this.dbSet('PORTFOLIO_CREDENTIALS', state);
        this.notify(`Pengaturan ${wallet.name} tersimpan`, 'success');
      } catch (error) {
        console.warn('Failed to save wallet state:', error);
        this.notify(`Gagal menyimpan pengaturan ${wallet.name}`, 'danger');
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

    // REVISI: Fungsi ini disalin dari sync-tab.js untuk memperbaiki error.
    // Fungsi ini mengumpulkan kredensial API dari config untuk CheckWalletExchanger.
    buildSecretsFromConfig() {
      const secrets = {};
      const cexConfig = this.config?.CEX || {};

      Object.keys(cexConfig).forEach(cexKey => {
        const cex = cexConfig[cexKey];
        const dataApi = cex?.DATA_API || {};

        // Map field names sesuai yang diharapkan CheckWalletExchanger
        const upperCex = cexKey.toUpperCase();

        const sanitize = value => {
          if (value === null || value === undefined) return undefined;
          if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed ? trimmed : undefined;
          }
          return value;
        };

        const assignSecrets = (fields) => {
          const entry = Object.entries(fields).reduce((acc, [sourceKey, targetKey]) => {
            const raw = sanitize(dataApi[sourceKey]);
            if (raw !== undefined && raw !== '') {
              acc[targetKey] = raw;
            }
            return acc;
          }, {});
          if (Object.keys(entry).length) {
            secrets[upperCex] = entry;
          }
        };

        if (upperCex === 'BINANCE' || upperCex === 'MEXC') {
          assignSecrets({ API_KEY: 'ApiKey', API_SECRET: 'ApiSecret' });
        } else if (upperCex === 'GATE') {
          assignSecrets({ API_KEY: 'ApiKey', API_SECRET: 'ApiSecret' });
        } else if (upperCex === 'BYBIT') {
          assignSecrets({ API_KEY: 'ApiKey', API_SECRET: 'ApiSecret' });
        } else if (upperCex === 'INDODAX') {
          assignSecrets({ API_KEY: 'ApiKey', API_SECRET: 'ApiSecret' });
        } else if (upperCex === 'KUCOIN' || upperCex === 'BITGET') {
          assignSecrets({ API_KEY: 'ApiKey', API_SECRET: 'ApiSecret', PASSPHRASE_API: 'Passphrase' });
        }
      });

      return secrets;
    },

    // REFACTOR: Satu handler untuk semua CEX
    async handleExchange(exchange) {
      const mapFieldKey = (rawKey = '', exchangeId = '') => {
        const key = String(rawKey).toLowerCase();
        switch (key) {
          case 'apikey':
          case 'api_key':
            return 'ApiKey';
          case 'secretkey':
          case 'secret':
          case 'apisecret':
          case 'api_secret':
            return 'ApiSecret';
          case 'passphrase':
          case 'passphrase_api':
            return 'Passphrase';
          case 'uid':
            return 'Uid';
          default:
            console.warn(`[Portfolio] Tidak mengenal field credential "${rawKey}" untuk exchange ${exchangeId}.`);
            return null;
        }
      };

      // 1. Ambil kredensial dari form dan normalisasi ke format yang diharapkan CheckWalletExchanger
      const userCredentials = exchange.fields.reduce((acc, field) => {
        const mappedKey = mapFieldKey(field.key, exchange.id);
        if (!mappedKey) return acc;
        const value = typeof field.value === 'string' ? field.value.trim() : field.value;
        if (value) {
          acc[mappedKey] = value;
        }
        return acc;
      }, {});

      // 2. Gabungkan dengan kredensial default dari konfigurasi (jika ada)
      if (!this.checkWalletExchanger) {
        this.checkWalletExchanger = new CheckWalletExchanger(this.buildSecretsFromConfig(), this.config, window.Http);
      }
      const defaultCredentials = this.checkWalletExchanger?.secrets?.[exchange.id.toUpperCase()] || {};
      const mergedCredentials = { ...defaultCredentials, ...userCredentials };
      const hasCredentials = Object.values(mergedCredentials).some(value => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.trim().length > 0;
        return true;
      });
      const credentialsToUse = hasCredentials ? mergedCredentials : null;

      // 3. Panggil service CheckWalletExchanger
      const result = await this.checkWalletExchanger.fetchAccountBalance(exchange.id, credentialsToUse);

      // 4. Proses hasil (sama seperti sebelumnya)
      const assets = this.buildAssetsFromTokenMap(result.raw_assets, this.rates, this.rates.idr, { limit: 6 });
      const total = assets.reduce((sum, asset) => sum + (asset.usdValue || 0), 0);

      return { total, assets, raw_assets: result.raw_assets };
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
        const rateSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'MATICUSDT', 'AVAXUSDT', 'SOLUSDT'];
        const ratesData = await this.$root.realtimeDataFetcher.fetchRates(rateSymbols);
        const idrRate = await this.$root.realtimeDataFetcher.getUSDTtoIDRRate();

        Object.assign(this.rates, { BTC: ratesData.BTCUSDT, ETH: ratesData.ETHUSDT, BNB: ratesData.BNBUSDT, MATIC: ratesData.MATICUSDT, AVAX: ratesData.AVAXUSDT, SOL: ratesData.SOLUSDT });
        this.rates.idr = idrRate;

        this.activeExchangeSummaries = [];
        let totalCex = 0;

        for (const exchange of enabledExchanges) {
          exchange.status = 'loading';
          exchange.error = null;

          try {
            // REFACTOR: Panggil satu handler universal
            const result = await this.handleExchange(exchange);

            const symbolsToEnsure = this.collectSymbolsFromExchangeResult(result);
            if (symbolsToEnsure.length > 0) {
              await this.ensureRatesForSymbols(symbolsToEnsure);
            }

            exchange.status = 'success';
            exchange.lastResult = result;

            const normalized = this.normalizeExchangeResult(exchange.id, result, this.rates, idrRate);

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

    // REVISI: Gunakan service dari root
    if (!this.$root.web3Service) {
        this.notify('⚠️ Portfolio Web3 Helper belum siap. Silakan refresh halaman.', 'danger');
        console.error('❌ this.$root.web3Service is not available.');
        return;
      }

      this.busy.wallet = true;
      this.$root.isLoading = true;
      this.$root.loadingText = `Mengecek ${walletsToProcess.length} wallet...`;

      try {
        const rateSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'MATICUSDT', 'AVAXUSDT', 'SOLUSDT'];
        const ratesData = await this.$root.realtimeDataFetcher.fetchRates(rateSymbols);
        const idrRate = await this.$root.realtimeDataFetcher.getUSDTtoIDRRate();
        Object.assign(this.rates, { BTC: ratesData.BTCUSDT, ETH: ratesData.ETHUSDT, BNB: ratesData.BNBUSDT, MATIC: ratesData.MATICUSDT, AVAX: ratesData.AVAXUSDT, SOL: ratesData.SOLUSDT });
        if (idrRate) this.rates.idr = idrRate;

        const promises = walletsToProcess.filter(w => w && w.id).map(async (wallet) => {
          wallet.status = 'loading';
          wallet.error = null;
          try {
            const sanitizedAddress = (wallet.address || '').trim();
            if (!sanitizedAddress) {
              throw new Error('Alamat wallet tidak valid atau kosong.');
            }
            if (sanitizedAddress !== wallet.address) {
              wallet.address = sanitizedAddress;
            }

            const chainKey = String(wallet.id || '').toLowerCase();
            const chainConfig = this.config?.CHAINS?.[chainKey];
            if (chainConfig?.PAIR_DEXS) {
              const configuredSymbols = Object.values(chainConfig.PAIR_DEXS)
                .map(pair => pair?.SYMBOL_PAIR || '')
                .filter(symbol => symbol && symbol.toUpperCase() !== 'NON');
              configuredSymbols.push(this.getDefaultGasSymbol(chainKey));
              await this.ensureRatesForSymbols(configuredSymbols);
            }

            const fetched = await this.$root.web3Service.getBalances({
              chain: wallet.id,
              address: sanitizedAddress,
              rates: this.rates
            });

            const walletSymbols = this.collectSymbolsFromWalletSource(fetched, wallet);
            if (walletSymbols.length > 0) {
              await this.ensureRatesForSymbols(walletSymbols);
            }

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
       // this.notify(`✅ Selesai cek ${walletsToProcess.length} wallet`, 'success');
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
         // this.notify('✅ Berhasil cek semua aset', 'success');
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
        await this.dbSet('PORTFOLIO_SETTINGS', {
          key: 'modal_awal',
          value: this.pnl.modalAwal
        });
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

        await this.dbSet('PORTFOLIO_SETTINGS', {
          key: 'modal_awal',
          value: this.pnl.modalAwal
        });

        await this.dbSet('PORTFOLIO_PNL_HISTORY', entry);

        // Muat ulang riwayat untuk menampilkan data baru
        await this._loadPnlHistoryFromDB();

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

        await this.dbSet('PORTFOLIO_PNL_HISTORY', entry);

        // Muat ulang riwayat untuk menampilkan data baru
        await this._loadPnlHistoryFromDB();

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
        const symbol = this.rates.customSymbol.toUpperCase() + 'USDT';
        const price = await this.$root.realtimeDataFetcher.fetchTokenPrice(symbol);
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
        const rateSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'MATICUSDT', 'AVAXUSDT', 'SOLUSDT'];
        const ratesData = await this.$root.realtimeDataFetcher.fetchRates(rateSymbols);
        const idrRate = await this.$root.realtimeDataFetcher.getUSDTtoIDRRate();
        Object.assign(this.rates, { BTC: ratesData.BTCUSDT, ETH: ratesData.ETHUSDT, BNB: ratesData.BNBUSDT, MATIC: ratesData.MATICUSDT, AVAX: ratesData.AVAXUSDT, SOL: ratesData.SOLUSDT });
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
    async _loadStateFromStorage() {
      try {
        // Muat Modal Awal
        const modalSetting = await this.dbGet('PORTFOLIO_SETTINGS', 'modal_awal');
        if (modalSetting && modalSetting.value) {
          this.pnl.modalAwal = parseFloat(modalSetting.value);
        }

        // Muat Riwayat PNL
        await this._loadPnlHistoryFromDB();

        // Muat Kredensial
        const credentials = await DB.getAllData('PORTFOLIO_CREDENTIALS');
        credentials.forEach(cred => {
          if (cred.type === 'exchange') {
            const exchange = this.exchanges.find(e => `exchange_${e.id}` === cred.id);
            if (exchange) {
              exchange.enabled = cred.enabled || false;
              if (cred.fields && exchange.fields) {
                cred.fields.forEach(savedField => {
                  const field = exchange.fields.find(f => f.key === savedField.key);
                  if (field) field.value = savedField.value;
                });
              }
            }
          } else if (cred.type === 'wallet') {
            const wallet = this.wallets.find(w => `wallet_${w.id}` === cred.id);
            if (wallet) {
              wallet.enabled = cred.enabled || false;
              wallet.address = cred.address || '';
            }
          }
        });

        console.log('✅ Loaded portfolio saved data from IndexedDB');
      } catch (error) {
        console.warn('Failed to load portfolio saved data:', error);
      }
    },
    async _loadPnlHistoryFromDB() {
      const historyData = await DB.getAllData('PORTFOLIO_PNL_HISTORY');
      this.pnl.history = historyData.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
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

    findField(exchange, key) {
        return exchange.fields?.find(f => f.key === key);
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
        <div class="col-lg-4 d-flex flex-column gap-2">
          <div class="card portfolio-card">
            <div class="card-header">
              <h6 class="mb-0 d-flex align-items-center gap-2">
                <i class="bi bi-gear"></i>
                Exchanger Settings
              </h6>
            </div>
            <div class="card-body p-2">
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

          <div class="card portfolio-card">
            <div class="card-header">
              <h6 class="mb-0 d-flex align-items-center gap-2">
                <i class="bi bi-wallet2"></i>
                Wallet Settings
              </h6>
            </div>
            <div class="card-body p-2">
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
                      <td class="text-end">
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
                      <td colspan="2" class="fs-6 fw-bold">TOTAL</td>
                      <td class="text-end fw-bold fs-6">{{ totalCexWithCurrency }}</td>
                    </tr>
                    <tr v-if="activeExchangeCount === 0">
                      <td colspan="3" class="py-3 text-center text-muted ">
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
                      <td class="  fw-bold">
                        <a :href="row.walletLink" target="_blank" rel="noopener" class="text-decoration-none">
                          <span class="text-uppercase fs-6" :style="getEntityTextStyle('chain', row.chain)">{{ formatChainLabel(row.chain) }}</span>
                          <button class="btn btn-sm btn-link py-0 px-1" @click.prevent.stop="checkWalletBalances(wallets.find(w => w.id === row.chain))" title="Refresh this wallet">
                            <i class="bi bi-arrow-repeat"></i>
                          </button>
                        </a>
                        <span v-if="row.status === 'pending'" class="badge bg-warning text-dark ms-1" style="font-size: 0.65rem;">Pending</span>
                      </td>
                      <td class="text-end  ">
                        <div v-if="row.raw_assets && row.raw_assets.length" class="d-flex flex-column gap-1">
                          <div v-for="asset in row.raw_assets" :key="row.chain + '-' + (asset.symbol || row.tokenSymbol || 'asset')" class="portfolio-asset-line">
                            <span class="fw-semibold" :class="tokenColorClass(asset.symbol)">{{ formatTokenAmount(asset.amount) }} {{ (asset.symbol || row.tokenSymbol || 'USDT').toUpperCase() }}</span>
                            <span class="text-muted">≈ {{ formatUsd(asset.value) }}</span>
                          </div>
                        </div>
                        <div v-else :class="row.status === 'pending' ? 'text-warning' : 'text-muted'">{{ formatUsd(row.assetValue) }}</div>
                      </td>
                      <td class="text-end  ">
                        <div class="portfolio-asset-line" :class="row.status === 'pending' ? 'text-warning' : ''">
                          <span class="fw-semibold">{{ formatTokenAmount(row.gasAmount) }} {{ row.gasSymbol }}</span>
                          <span class="text-muted">≈ {{ formatUsd(row.gasValue) }}</span>
                        </div>
                      </td>
                      <td class="text-end fw-bold small" :class="row.status === 'pending' ? 'text-warning' : ''">{{ formatUsd(row.total) }}</td>
                    </tr>
                    <tr   v-if="activeWalletCount > 0">
                      <td class="fs-6 fw-bold">TOTAL</td> 
                      <td class="text-end fw-bold fs-6">{{ formatUsd(totalWalletAssets) }}</td> 
                      <td class="text-end fw-bold fs-6">{{ formatUsd(totalWalletGas) }}</td>
                      <td class="text-end fw-bold fs-6">{{ totalWalletWithCurrency }}</td>
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
        <div class="col-lg-4 d-flex flex-column gap-2">
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

    await this._loadStateFromStorage();

    // Auto-load rates on mount
    this.refreshRates();

    // Load data from IndexedDB on mount
    await this._loadDataFromDB();

    // REVISI: Hapus inisialisasi lokal. Gunakan service dari root.
    // Tunggu web3Service siap di root.
    let web3Attempts = 0;
    while (!this.$root.web3Service && web3Attempts < 50) {
      console.log(`⏳ Portfolio menunggu web3Service... (${web3Attempts + 1}/50)`);
      await new Promise(resolve => setTimeout(resolve, 100));
      web3Attempts++;
    }

    if (!this.$root.web3Service) {
      console.error('❌ Gagal mendapatkan web3Service dari root instance.');
      this.notify('⚠️ Gagal memuat Web3 Service. Silakan refresh halaman.', 'danger');
      return;
    }
    console.log('✅ Portfolio mendapatkan web3Service dari root.');
    this.portfolioReady = true;

    // Tunggu realtimeDataFetcher siap
    if (!this.$root.realtimeDataFetcher) {
      console.error('❌ Gagal mendapatkan realtimeDataFetcher dari root instance.');
      this.notify('⚠️ Gagal memuat Price Fetcher Service. Silakan refresh halaman.', 'danger');
      return;
    }

    // --- PERMINTAAN: Autoload Aset ---
    // Secara otomatis memanggil pengecekan aset gabungan setelah semua inisialisasi selesai.
    console.log('🚀 Memulai autoload aset portofolio...');
    this.checkModalCombined();
  }
};
