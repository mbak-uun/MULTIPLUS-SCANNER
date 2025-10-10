// components/tabs/scanning-tab.js
// Komponen Vue mandiri untuk Tab Scanning

// REKOMENDASI REFAKTOR: Impor store dari Pinia
// import { useAppStore } from '@/stores/app';
// import { useFilterStore } from '@/stores/filter';
// import { useScanStore } from '@/stores/scan';
// import { useTokenStore } from '@/stores/token';

// Utility untuk membuat ID anchor konsisten antara kartu sinyal dan tabel
const buildSignalCellId = (tokenId, dexKey, direction) => {
  const sanitize = (value, fallback) => {
    const safe = String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return safe || fallback;
  };

  const tokenSlug = sanitize(tokenId, 'token');
  const dexSlug = sanitize(dexKey, 'dex');
  const directionSlug = direction === 'CEXtoDEX' ? 'cextodex' : 'dextocex';

  return `signal-cell-${tokenSlug}-${dexSlug}-${directionSlug}`;
};

// Komponen baris token untuk tabel scanning
const TokenRow = {
  name: 'TokenRow',
  props: {
    token: { type: Object, required: true },
    index: { type: Number, required: true },
    activeDexList: { type: Array, required: true },
    scanResult: {
      type: Object,
      default: () => null
    },
    helpers: { type: Object, required: true },
    usdtRate: { type: Number, default: 15800 },
    modalUsd: { type: Number, default: 0 },
    isScanRunning: { type: Boolean, default: false },
    chainColors: { type: Function, required: true },
    dexStatusMap: {
      type: Object,
      default: () => ({})
    },
    isMultiChainMode: { type: Boolean, default: false }
  },
  computed: {
    rowNumber() {
      return this.index + 1;
    },
    primaryCex() {
      return this.helpers.getTokenPrimaryCEX
        ? (this.helpers.getTokenPrimaryCEX(this.token) || 'N/A')
        : 'N/A';
    },
    tokenStatus() {
      return this.helpers.getTokenCexStatus
        ? this.helpers.getTokenCexStatus(this.token, 'token')
        : { deposit: false, withdraw: false };
    },
    pairStatus() {
      return this.helpers.getTokenCexStatus
        ? this.helpers.getTokenCexStatus(this.token, 'pair')
        : { deposit: false, withdraw: false };
    },
    tokenTradeLink() {
      const symbol = this.token.cex_ticker_token || this.token.nama_token;
      return this.helpers.getCexTradeLink ? this.helpers.getCexTradeLink(this.token, symbol) : '#';
    },
    pairTradeLink() {
      const symbol = this.token.cex_ticker_pair || this.token.nama_pair;
      return this.helpers.getCexTradeLink ? this.helpers.getCexTradeLink(this.token, symbol) : '#';
    },
    tokenExplorerLink() {
      return this.helpers.getExplorerLink
        ? this.helpers.getExplorerLink(this.token, this.token.sc_token)
        : '#';
    },
    pairExplorerLink() {
      return this.helpers.getExplorerLink
        ? this.helpers.getExplorerLink(this.token, this.token.sc_pair)
        : '#';
    },
    tokenWithdrawLink() {
      const symbol = this.token.nama_token || this.token.cex_ticker_token;
      return this.helpers.getCexWithdrawLink ? this.helpers.getCexWithdrawLink(this.token, symbol) : '#';
    },
    tokenDepositLink() {
      const symbol = this.token.nama_token || this.token.cex_ticker_token;
      return this.helpers.getCexDepositLink ? this.helpers.getCexDepositLink(this.token, symbol) : '#';
    },
    pairWithdrawLink() {
      const symbol = this.token.nama_pair;
      return this.helpers.getCexWithdrawLink ? this.helpers.getCexWithdrawLink(this.token, symbol) : '#';
    },
    pairDepositLink() {
      const symbol = this.token.nama_pair;
      return this.helpers.getCexDepositLink ? this.helpers.getCexDepositLink(this.token, symbol) : '#';
    },
    tokenWalletLink() {
      return this.helpers.getCexWalletBalanceLink
        ? this.helpers.getCexWalletBalanceLink(this.token, this.token.sc_token, 1)
        : '#';
    },
    pairWalletLink() {
      return this.helpers.getCexWalletBalanceLink
        ? this.helpers.getCexWalletBalanceLink(this.token, this.token.sc_pair, 1)
        : '#';
    },
    chainStyle() {
      return this.chainColors('chain', this.token.chain, 'solid');
    },
    cexStyle() {
      return this.chainColors('cex', this.token.cex_name, 'solid');
    },
    chainShortName() {
      if (!this.helpers.getChainConfig) return this.token.chain.toUpperCase();
      const config = this.helpers.getChainConfig(this.token.chain);
      return config?.NAMA_PENDEK || this.token.chain.toUpperCase();
    }
  },
  methods: {
    getSignalCellId(dexKey, direction) {
      return buildSignalCellId(this.token.id, dexKey, direction);
    },
    formatOrderbook(side) {
      // Jika scanResult belum ada atau cex belum ada, tampilkan loading dengan icon kunci
      const cexData = this.scanResult?.cex;
      return ScanningFormatters.formatOrderbookCell(cexData, side, { token: this.token, cexName: this.primaryCex });
    },
    isDexActive(dexKey) {
      return !!(this.token.dex && this.token.dex[dexKey] && this.token.dex[dexKey].status);
    },
    getDexModalValue(dexKey, direction) {
      const dexConfig = this.token.dex?.[dexKey];
      if (!dexConfig) return 0;
      const raw = direction === 'CEXtoDEX' ? dexConfig.left : dexConfig.right;
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    },
    getDexCellClass(dexKey, direction) {
      if (!this.isDexActive(dexKey)) return 'dex-cell--inactive';

      const status = this.dexStatusMap?.[dexKey];
      if (status === 'error') return 'dex-cell--error';

      const result = this.scanResult?.pnl?.[dexKey];
      if (result) {
        const directionResult = direction === 'CEXtoDEX' ? result?.cexToDex : result?.dexToCex;
        if (directionResult?.error || result?.error) {
          return 'dex-cell--error';
        }
      }

      const modalValue = this.getDexModalValue(dexKey, direction);
      if (modalValue > 0) return null;

      if (result) {
        const directionResult = direction === 'CEXtoDEX' ? result?.cexToDex : result?.dexToCex;
        const dynamicModal = Number(directionResult?.modal ?? result?.modal);
        if (Number.isFinite(dynamicModal) && dynamicModal > 0) {
          return null;
        }
      }

      return 'dex-cell--muted';
    },
    getDexLabel(dex) {
      if (!dex) return '';
      if (typeof dex === 'string') {
        return dex.toUpperCase();
      }
      return (dex.name || dex.label || dex.key || '').toString().toUpperCase();
    },
    formatDexCell(dex, direction) {
      const dexKey = typeof dex === 'string' ? dex : dex?.key;
      if (!dexKey) return '';
      const dexLabel = this.getDexLabel(dex);

      // Jika scanResult belum ada, tampilkan loading dengan icon kunci
      const dexResult = this.scanResult?.pnl?.[dexKey];
      const tokenSymbol = this.token.cex_ticker_token || this.token.nama_token;
      const pairSymbol = this.token.cex_ticker_pair || this.token.nama_pair;
      const tokenTradeLink = this.helpers.getCexTradeLink ? this.helpers.getCexTradeLink(this.token, tokenSymbol) : '#';
      const pairTradeLink = this.helpers.getCexTradeLink ? this.helpers.getCexTradeLink(this.token, pairSymbol) : '#';
      const dexTradeLink = this.helpers.getDexTradeLink ? this.helpers.getDexTradeLink(this.token, dexKey, direction) : '#';

      // Ambil modal khusus DEX dari database token (left/right), fallback ke modal token/global
      const dexConfig = this.token.dex?.[dexKey] || {};
      const directionModalRaw = direction === 'CEXtoDEX' ? dexConfig.left : dexConfig.right;
      const parseModal = (value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      };
      const directionModal = parseModal(directionModalRaw);
      const tokenLevelModal = parseModal(this.token.modal) ?? parseModal(this.token.modalUsd);
      const globalModal = parseModal(this.modalUsd);
      const tokenModal = directionModal ?? tokenLevelModal ?? globalModal ?? 0;
      const dexStatus = this.dexStatusMap?.[dexKey] || null;

      const formatterOptions = {
        usdtRate: this.usdtRate,
        modalUsd: tokenModal,
        isScanning: this.isScanRunning,
        dexKey,
        dexLabel,
        dexStatus,
        cexBuyLink: direction === 'CEXtoDEX' ? tokenTradeLink : pairTradeLink,
        cexSellLink: direction === 'CEXtoDEX' ? pairTradeLink : tokenTradeLink,
        dexLink: dexTradeLink,
        actionLink: direction === 'CEXtoDEX' ? this.tokenWithdrawLink : this.pairDepositLink,
        actionLabel: direction === 'CEXtoDEX'
          ? (this.tokenStatus.withdraw ? 'WD' : 'WX')
          : (this.pairStatus.deposit ? 'DP' : 'DX'),
        actionTitle: direction === 'CEXtoDEX'
          ? `Buka halaman withdraw ${this.token.nama_token || 'token'} di ${this.primaryCex}`
          : `Buka halaman deposit ${this.token.nama_pair || 'pair'} di ${this.primaryCex}`
      };

      // Jika tidak ada hasil DEX, return null untuk loading state
      if (!dexResult) {
        return ScanningFormatters.formatDexCell(null, this.token, direction, formatterOptions);
      }

      // Pilih data PNL berdasarkan arah
      const pnl = direction === 'CEXtoDEX' ? dexResult?.cexToDex : dexResult?.dexToCex;
      if (!pnl) {
        return ScanningFormatters.formatDexCell(null, this.token, direction, formatterOptions);
      }

      return ScanningFormatters.formatDexCell(pnl, this.token, direction, formatterOptions);
    },
    // Generate link DEX aggregator alternatif
    getDexAggregatorLink(token, aggregator) {
      const chainId = this.helpers.getChainId(token.chain);
      const scTokenIn = token.sc_token;
      const scTokenOut = token.sc_pair;

      switch(aggregator.toUpperCase()) {
        case 'UNX':
          return `https://app.unidex.exchange/?chain=${token.chain}&from=${scTokenIn}&to=${scTokenOut}`;
        case 'OKX':
          return `https://web3.okx.com/dex-swap?chain=${token.chain},${token.chain}&token=${scTokenIn},${scTokenOut}`;
        case 'DFL':
          return `https://swap.defillama.com/?chain=${token.chain}&from=${scTokenIn}&to=${scTokenOut}`;
        case 'JMX':
          return `https://jumper.exchange/?fromChain=${chainId}&fromToken=${scTokenIn}&toChain=${chainId}&toToken=${scTokenOut}`;
        default:
          return '#';
      }
    },
    toggleFavorite() {
      if (this.helpers.toggleTokenFavorit) {
        this.helpers.toggleTokenFavorit(this.token);
      }
    },
    openChart() {
      if (this.helpers.openEditModal) {
        this.helpers.openEditModal(this.token);
      }
    },
    deleteToken() {
      if (this.helpers.deleteToken) {
        this.helpers.deleteToken(this.token);
      }
    }
  },
  template: `
    <tr class="token-row">
      <td class="text-center orderbook-cell">
        <div v-html="formatOrderbook('left')"></div>
      </td>
      <td
        v-for="dex in activeDexList"
        :key="'left-' + dex.key + '-' + token.id"
        :class="['text-center', 'dex-cell', getDexCellClass(dex.key, 'CEXtoDEX')]">
        <div
          v-if="isDexActive(dex.key)"
          :id="getSignalCellId(dex.key, 'CEXtoDEX')"
          v-html="formatDexCell(dex, 'CEXtoDEX')"
        ></div>
        <div v-else class="small text-muted">-</div>
      </td>
      <td class="token-detail">
        <div class="d-flex flex-column align-items-center">
          <div class="mb-1 small fw-bold">
           <span class=" me-1">#{{ rowNumber }}</span>
            <a v-if="(token.nama_token || '').toUpperCase() !== 'USDT'" :href="tokenTradeLink" target="_blank" class="text-primary text-decoration-none" :title="'Trade ' + (token.nama_token || 'N/A') + ' di ' + primaryCex">
              {{ token.nama_token || 'N/A' }}
            </a>
            <span v-else class="text-primary">
              {{ token.nama_token || 'N/A' }}
            </span>
            <span class="text-muted mx-1">VS</span>
            <a v-if="(token.nama_pair || '').toUpperCase() !== 'USDT'" :href="pairTradeLink" target="_blank" class="text-primary text-decoration-none" :title="'Trade ' + (token.nama_pair || 'N/A') + ' di ' + primaryCex">
              {{ token.nama_pair || 'N/A' }}
            </a>
            <span v-else class="text-primary">
              {{ token.nama_pair || 'N/A' }}
            </span>
          </div>

          <div v-if="!isMultiChainMode" class="small mb-1" role="group">
            <button class="btn btn-sm py-0 px-2" :class="(token.isFavorite || token.isFavorit) ? 'btn-warning' : 'btn-outline-secondary'" @click="toggleFavorite" title="Toggle Favorit"><i class="bi bi-star-fill"></i></button>
            <button class="btn btn-sm btn-outline-secondary py-0 px-2" @click="openChart" title="Edit Token" :disabled="isScanRunning"><i class="bi bi-pencil-square"></i></button>
            <button class="btn btn-sm btn-outline-danger py-0 px-2" @click="deleteToken" title="Delete"><i class="bi bi-trash"></i></button>
          </div>
          <div class="small mb-2"  >
            <span class="badge" :style="cexStyle">{{ primaryCex }}</span> on
            <span class="badge" :style="chainStyle">{{ chainShortName.toUpperCase() }}</span>
          </div>
          <div class="mb-1 small">
            <a :href="tokenExplorerLink" target="_blank" class="fw-semibold me-1 text-decoration-none" :title="'Lihat di Explorer: ' + (token.nama_token || 'Token')">
              {{ token.nama_token || 'Token' }}
            </a>
            <a v-if="primaryCex !== 'N/A'"
               :href="tokenWithdrawLink" target="_blank"
               class="badge me-1 text-decoration-none small"
               :class="tokenStatus.withdraw ? 'bg-success' : 'bg-danger'"
               :title="'Withdraw ' + (token.nama_token || 'Token')">
              {{ tokenStatus.withdraw ? 'WD' : 'WX' }}
            </a>
            <a v-if="primaryCex !== 'N/A'"
               :href="tokenDepositLink" target="_blank"
               class="badge me-1 text-decoration-none small"
               :class="tokenStatus.deposit ? 'bg-success' : 'bg-danger'"
               :title="'Deposit ' + (token.nama_token || 'Token')">
              {{ tokenStatus.deposit ? 'DP' : 'DX' }}
            </a>
            <a :href="tokenWalletLink" target="_blank" class="badge bg-info text-dark me-1 text-decoration-none small" :title="'Cek Saldo ' + (token.nama_token || 'Token') + ' di Wallet ' + primaryCex + ' #1'">
              <i class="bi bi-wallet2"></i>
            </a>
          </div>
          <div class="mb-2 small">
            <a :href="pairExplorerLink" target="_blank" class="fw-semibold me-1 text-decoration-none" :title="'Explorer: ' + (token.nama_pair || 'Pair')">
              {{ token.nama_pair || 'Pair' }}
            </a>
            <a v-if="primaryCex !== 'N/A'"
               :href="pairWithdrawLink" target="_blank"
               class="badge me-1 text-decoration-none small"
               :class="pairStatus.withdraw ? 'bg-success' : 'bg-danger'"
               :title="'Withdraw ' + (token.nama_pair || 'Pair')">
              {{ pairStatus.withdraw ? 'WD' : 'WX' }}
            </a>
            <a v-if="primaryCex !== 'N/A'"
               :href="pairDepositLink" target="_blank"
               class="badge me-1 text-decoration-none small"
               :class="pairStatus.deposit ? 'bg-success' : 'bg-danger'"
               :title="'Deposit ' + (token.nama_pair || 'Pair')">
              {{ pairStatus.deposit ? 'DP' : 'DX' }}
            </a>
            <a :href="pairWalletLink" target="_blank" class="badge bg-info text-dark me-1 text-decoration-none small" :title="'Cek Saldo ' + (token.nama_pair || 'Pair') + ' di Wallet ' + primaryCex + ' #1'">
              <i class="bi bi-wallet2"></i>
            </a>
          </div>
          <div class="token-aggregator-links d-flex mb-2 small">
            <a :href="getDexAggregatorLink(token, 'UNX')" target="_blank" class="text-decoration-none text-info" title="Swap di Unidex">
              #UNX
            </a>
            <a :href="getDexAggregatorLink(token, 'OKX')" target="_blank" class="text-decoration-none text-dark" title="Swap di OKX DEX">
              #OKX
            </a>
            <a :href="getDexAggregatorLink(token, 'DFL')" target="_blank" class="text-decoration-none text-primary" title="Swap di DefiLlama">
              #DFL
            </a>
            <a :href="getDexAggregatorLink(token, 'JMX')" target="_blank" class="text-decoration-none text-success" title="Swap di Jumper Exchange">
              #JMX
            </a>
          </div>
        </div>
      </td>
      <td
        v-for="dex in activeDexList"
        :key="'right-' + dex.key + '-' + token.id"
        :class="['text-center', 'dex-cell', getDexCellClass(dex.key, 'DEXtoCEX')]">
        <div
          v-if="isDexActive(dex.key)"
          :id="getSignalCellId(dex.key, 'DEXtoCEX')"
          v-html="formatDexCell(dex, 'DEXtoCEX')"
        ></div>
        <div v-else class="small text-muted">-</div>
      </td>
      <td class="text-center orderbook-cell">
        <div v-html="formatOrderbook('right')"></div>
      </td>
    </tr>
  `
};

// REVISI: Komponen ini digabungkan kembali menjadi satu unit mandiri
// untuk menyederhanakan alur data dan memperbaiki fungsionalitas.
const ScanningTab = {
  name: 'ScanningTab',
  components: {
    'token-row': TokenRow,
    'filter-toolbar': FilterToolbar // REVISI: Daftarkan FilterToolbar secara lokal
  },
  mixins: [filterMixin, scannerMixin, filterAutoSaveMixin], // REFACTOR: Tambahkan filterAutoSaveMixin
  // Mendeklarasikan event yang akan di-emit ke parent (app.js)
  emits: ['show-toast', 'set-scanning-status'],

  // REKOMENDASI REFAKTOR: Gunakan setup() dengan Composition API untuk Pinia
  // setup() {
  //   const appStore = useAppStore();
  //   const filterStore = useFilterStore();
  //   const scanStore = useScanStore();
  //   const tokenStore = useTokenStore();
  //
  //   return { appStore, filterStore, scanStore, tokenStore };
  // },

  // Logika dari scanning.js dipindahkan ke sini
  data() {
    return {
      // Data 'tokens' sekarang akan dimuat dari IndexedDB, bukan dummy data.
      tokens: [],
      // REVISI: Data sampel untuk sinyal dan statistik dihapus.
      // Data ini akan diisi oleh logika pemindaian di masa mendatang.
      signals: [],
      notificationAudio: null,
      audioPrimed: false,

      // REVISI: State dari management-tab untuk modal edit
      showFormModal: false,
      formMode: 'edit',
      editingToken: null,
      formData: {
        selectedPairType: '',
        selectedDex: [],
        dexModals: {},
        nonData: { symbol: '', sc: '', des: 18 },
        tokenData: { name: '', sc: '', decimals: 18 },
        selectedCex: [],
        cex_tickers: {},
      }

    };
  },

  computed: {
    // Mengakses data dari root instance (app.js)
    // REFAKTOR: Ganti this.$root dengan akses ke store Pinia
    coinRepo() {
      return window.AppContainer.get('coinRepository');
    },
    filterSettings() {
      return this.$root.filterSettings; // SEBELUM: this.$root.filterSettings -> SESUDAH: this.filterStore.settings
    },
    filters() {
      return this.$root.filters; // SEBELUM: this.$root.filters -> SESUDAH: this.filterStore.filters
    },
    searchQuery: {
      get() { return this.$root.searchQuery; },
      set(value) { this.$root.searchQuery = value; }
    },
    activeTab() {
      return this.$root.activeTab;
    },
    isFilterLocked() {
      return Boolean(this.$root?.isFilterLocked);
    },
    isScanning() {
      // REVISI: Gunakan `scanningInProgress` dari scannerMixin untuk status yang lebih akurat.
      // `this.scanningInProgress` akan disediakan oleh scannerMixin.
      return this.scanningInProgress;
    },
    isScanningRoot: {
      get() { return this.$root.isScanning; },
      set(value) {
        this.$emit('set-scanning-status', value);
      }
    },
    isMultiChainMode() {
      return this.$root.activeChain === 'multi';
    },
    // Mengambil daftar DEX yang aktif dari root instance
    activeDexList() {
      // REVISI: Menggunakan filterSettings.dex sebagai sumber data yang benar.
      // REVISI 2: Gunakan this.filters.dex agar reaktif terhadap UI.
      if (!this.filters || !this.filters.dex) return []; // SEBELUM: this.filters -> SESUDAH: this.filterStore.filters

      return Object.keys(this.filters.dex)
        // 1. Filter hanya DEX yang dicentang (statusnya true)
        .filter(dexKey => this.filters.dex[dexKey])
        // 2. Ubah format agar sesuai dengan yang dibutuhkan template
      .map(dexKey => ({ key: dexKey, name: dexKey.toUpperCase() }))
    },
    // Tambahkan properti ini untuk memperbaiki warning di template
    columnCount() {
      // 1 (orderbook kiri) + activeDex*2 + 1 (detail) + 1 (orderbook kanan)
      return 1 + (this.activeDexList.length * 2) + 1 + 1;
    },

    scanStatusText() {
      if (this.isScanning) {
        // Gabungkan progress percentage dengan pesan detail
        const progressPercent = this.scanProgress.toFixed(0);
        const detailMessage = this.currentProgressMessage || 'Processing...';
        return `Scanning in progress... (${progressPercent}%) - ${detailMessage}`;
      }
      if (this.scanProgress >= 100) {
        return `Scan completed successfully!`;
      }
      return this.lastScanTime
        ? `Last scan completed at ${new Date(this.lastScanTime).toLocaleTimeString()}`
        : 'Ready to scan';
    },
    scanStats() {
      // Mengakses stats dari scanner instance via mixin
      if (this.scanner && this.scanner.scanStats) {
        return this.scanner.scanStats;
      }
      // Fallback untuk stats default
      return {
        totalTokens: 0,
        processedTokens: 0,
        successCount: 0,
        errorCount: 0,
        profitableSignals: 0
      };
    },
    estimatedTimeRemaining() {
      if (!this.isScanning || !this.scanStats.startTime || this.scanStats.processedTokens === 0) {
        return null;
      }

      const elapsed = Date.now() - this.scanStats.startTime;
      const avgTimePerToken = elapsed / this.scanStats.processedTokens;
      const remainingTokens = this.scanStats.totalTokens - this.scanStats.processedTokens;
      const estimatedMs = avgTimePerToken * remainingTokens;

      const seconds = Math.floor(estimatedMs / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;

      if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
      }
      return `${seconds}s`;
    },
    tokenRowHelpers() {
      return {
        getTokenPrimaryCEX: token => this.getTokenPrimaryCEX(token),
        getTokenCexStatus: (token, type) => this.getTokenCexStatus(token, type),
        getCexTradeLink: (token, symbol) => this.getCexTradeLink(token, symbol),
        getDexTradeLink: (token, dexKey, direction) => this.getDexTradeLink(token, dexKey, direction),
        getChainId: chain => this.getChainId(chain),
        getExplorerLink: (token, address) => this.getExplorerLink(token, address),
        getCexWithdrawLink: (token, symbol) => this.getCexWithdrawLink(token, symbol),
        getCexDepositLink: (token, symbol) => this.getCexDepositLink(token, symbol),
        getCexWalletBalanceLink: (token, address, index) => this.getCexWalletBalanceLink(token, address, index),
        getDexAggregatorLink: (token, code) => this.getDexAggregatorLink(token, code),
        getChainConfig: chain => this.getChainConfig(chain),
        getChainId: chain => this.getChainId(chain), // REVISI: Teruskan method getChainId ke helper
        toggleTokenFavorit: token => this.toggleTokenFavorit(token),
        formatPriceWithZeros: price => this.formatPriceWithZeros(price), // REVISI: Teruskan formatter
        openChart: token => this.openChart(token),
        openEditModal: token => this.openEditModal(token), // REVISI: Tambahkan helper untuk edit
        deleteToken: token => this.deleteToken(token)
      };
    },
    chainColorFn() {
      return (category, key, variant) => this.$root.getColorStyles(category, key, variant);
    },
    tableHeaderStyle() {
      const baseStyle = this.$root.getColorStyles?.('chain', this.$root.activeChain, 'solid') || {};
      const backgroundColor = baseStyle.backgroundColor || baseStyle['background-color'] || '';
      return {
        ...baseStyle,
        '--table-header-bg': backgroundColor || 'rgba(248, 249, 250, 0.95)'
      };
    },

    // REVISI: Computed properties dari management-tab untuk modal
    config() {
      return this.$root.config || {};
    },
    activeCEXs() {
      return this.$root.activeCEXs || [];
    },
    availablePairOptions() {
      // REVISI: Gunakan `editingToken` dan tambahkan guard untuk mencegah error saat modal tertutup.
      if (!this.editingToken || !this.editingToken.chain) return [];
      const chainConf = this.config.CHAINS?.[this.editingToken.chain.toLowerCase()];
      if (!chainConf || !chainConf.PAIR_DEXS) return [];
      return Object.entries(chainConf.PAIR_DEXS).map(([key, info]) => ({
        key,
        symbol: info.SYMBOL_PAIR,
        address: info.SC_ADDRESS_PAIR,
        decimals: Number(info.DECIMALS_PAIR ?? 18)
      }));
    },
    availableDexOptions() {
      return Object.keys(this.config.DEXS || {}).map(dexKey => ({
        key: dexKey,
        name: dexKey.toUpperCase(),
        color: this.config.DEXS[dexKey]?.WARNA || '#0d6efd'
      }));
    },
    isNonPair() {
      return this.formData.selectedPairType === 'NON';
    },
    selectedPairInfo() {
      if (this.isNonPair) return null;
      const pair = this.availablePairOptions.find(p => p.key === this.formData.selectedPairType);
      return pair || null;
    }
    ,
    // REVISI: Tambahkan computed property baru untuk sorting
    sortedAndFilteredTokens() {
      // Ambil token yang sudah difilter dari mixin
      let tokens = this.filteredTokens;

      // Terapkan sorting
      const direction = this.filters.sortDirection === 'asc' ? 1 : -1;
      
      // Urutkan berdasarkan 'id' atau properti lain yang konsisten, misal 'nama_koin'
      // Di sini kita gunakan 'id' sebagai contoh.
      tokens.sort((a, b) => {
        const valA = a.nama_koin || '';
        const valB = b.nama_koin || '';
        return valA.localeCompare(valB) * direction;
      });

      return tokens;
    }
  },

  methods: {
    // REFACTOR: Method saveFilter sekarang disediakan oleh filterAutoSaveMixin
    // Hapus method saveFilter yang lama yang memanggil this.$root.saveFilterChange

    async toggleScan() {
      if (this.isScanning) {
        // console.log('🔴 Proses pemindaian dihentikan oleh pengguna.');
        this.stopScanning();
        this.$root.isFilterLocked = false;
        this.isScanningRoot = false; // Update root state
        this.filters.run = 'stop';
        this.saveFilter('run'); // REFACTOR: Gunakan method dari mixin
        window.location.reload(); // PERMINTAAN: Reload halaman saat stop
      } else {
        // console.clear();
        // console.log('🚀 Memulai proses pemindaian...');

        // REVISI: Kosongkan hasil scan sebelumnya dan sinyal saat scan baru dimulai
        this.signals = [];
        this.clearScanResults();

        this.$root.isFilterLocked = true;
        this.isScanningRoot = true; // Update root state
        this.filters.run = 'run';
        this.saveFilter('run'); // REFACTOR: Gunakan method dari mixin

        try {
          this.primeNotificationAudio();
          await this.startScanning();
        } catch (error) {
          // console.error('❌ Terjadi kesalahan pada tahap inisiasi:', error);
          this.$root.isFilterLocked = false;
          this.isScanningRoot = false; // Update root state on error
          this.filters.run = 'stop';
          this.saveFilter('run'); // REFACTOR: Gunakan method dari mixin
        }
      }
    },
    // REFACTORED: Mengambil nama CEX dari config untuk konsistensi
    getTokenPrimaryCEX(token) {
      const cexKey = token.cex_name;
      if (!cexKey) return 'N/A';

      // Ambil nama dari config jika tersedia
      const cexConfig = this.config?.CEX?.[cexKey.toUpperCase()];
      if (cexConfig && cexConfig.NAMA) {
        return cexConfig.NAMA;
      }

      // Fallback ke cex_name dari token
      return cexKey.toUpperCase();
    },

    // REVISI: Method baru untuk menangani hasil PNL dan menambahkannya ke kartu sinyal
    handlePnlForSignalCard(pnlData) {
      if (!pnlData || !pnlData.token || !pnlData.pnl) return;

      const { token, dexKey, pnl } = pnlData;
      const minPnlThreshold = Number(this.filters?.minPnl ?? 0);

      // Helper untuk format angka dengan 2 desimal
      const formatCurrency = (value, prefix = '$') => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return `${prefix}0.00`;
        return `${prefix}${numeric.toFixed(2)}`;
      };

      const resolveSymbol = (preferred, fallback) => {
        const raw = preferred || fallback || '';
        return raw.toString().toUpperCase();
      };

      const processDirection = (pnlDirection, directionCode) => {
        if (!pnlDirection || pnlDirection.error || !(pnlDirection.pnl > 0)) return;

        const directionLabel = directionCode === 'CEXtoDEX' ? 'CEX->DEX' : 'DEX->CEX';
        const tokenIn = directionCode === 'CEXtoDEX'
          ? resolveSymbol(token.nama_token, token.cex_ticker_token)
          : resolveSymbol(token.nama_pair, token.cex_ticker_pair);
        const tokenOut = directionCode === 'CEXtoDEX'
          ? resolveSymbol(token.nama_pair, token.cex_ticker_pair)
          : resolveSymbol(token.nama_token, token.cex_ticker_token);

        const pnlUsd = Number(pnlDirection.pnl) || 0;
        const modalUsd = Number(pnlDirection.modal) || 0;
        const baseSymbol = resolveSymbol(token.nama_token, token.cex_ticker_token);
        const pairSymbol = resolveSymbol(token.nama_pair, token.cex_ticker_pair);
        const totalFeeUsd = Number(pnlDirection.costs?.total) || 0;

        const cexKeyRaw = token.cex_name || token.cex || '';
        const cexKey = cexKeyRaw.toString().toUpperCase() || 'CEX';
        const cexConfig = this.config?.CEX?.[cexKey];
        const cexDisplayName =   cexConfig?.NAMA || cexKey;
        const cexColor = cexConfig?.WARNA || null;
        
        const chainConfig = this.getChainConfig(token.chain);
        const chainShortName = chainConfig?.NAMA_PENDEK || token.chain.toUpperCase();
        const chainStyle = this.chainColorFn('chain', token.chain, 'solid');

        const targetId = buildSignalCellId(token.id, dexKey, directionCode);

        const signal = {
          id: `${token.id}-${dexKey}-${directionCode}-${Date.now()}`,
          tokenId: token.id,
          dex: dexKey,
          direction: directionCode,
          cexKey,
          cexName: cexDisplayName,
          cexColor,
          chainName: chainShortName,
          chainStyle,
          modal: modalUsd,
          modalDisplay: formatCurrency(modalUsd, ''), // Tanpa simbol $
          pnlUsd,
          pnlUsdFormatted: formatCurrency(pnlUsd),
          totalFeeUsd,
          totalFeeDisplay: formatCurrency(totalFeeUsd),
          pairLabel: `${baseSymbol} ➡️ ${pairSymbol}`,
          meetsThreshold: pnlUsd >= minPnlThreshold,
          targetId,
          directionClass: directionCode === 'CEXtoDEX' ? 'text-success' : 'text-danger',
          pnlClass: 'text-success'
        };

        // Hapus sinyal lama untuk kombinasi token/dex/direction agar selalu menampilkan yang terbaru
        this.signals = this.signals.filter(existing => {
          return !(
            existing.tokenId === signal.tokenId &&
            existing.dex === signal.dex &&
            existing.direction === signal.direction
          );
        });

        // Tambahkan sinyal terbaru ke awal array
        this.signals.unshift(signal);
        this.triggerSignalAlert(signal);
      };

      processDirection(pnl.cexToDex, 'CEXtoDEX');
      processDirection(pnl.dexToCex, 'DEXtoCEX');
    },

    async loadTokensFromDB() {
      /* // console.log('[ScanningTab] loadTokensFromDB() dipanggil.', {
        activeChain: this.$root.activeChain,
        isAppInitialized: this.$root.isAppInitialized
      // }); */

      if (!this.$root.activeChain || !this.$root.isAppInitialized) {
        /* // console.log('[ScanningTab] Guard terpanggil, root belum siap. Tokens dikosongkan.'); */
        this.tokens = [];
        return;
      }

      await this.$root.loadCoinsForFilter();
      this.tokens = this.$root.allCoins.map(token => ({ ...token }));

      /* // console.log('[ScanningTab] Tokens dimuat:', {
        activeChain: this.$root.activeChain,
        total: this.tokens.length,
        sample: this.tokens.slice(0, 5)
      // }); */
    },
    // Method untuk mengubah arah sorting
    toggleSortDirection() {
      if (this.isFilterLocked) return;
      const newDirection = this.filters.sortDirection === 'desc' ? 'asc' : 'desc';
      this.filters.sortDirection = newDirection;
      this.saveFilter('sortDirection'); // Simpan perubahan
      this.$emit('show-toast', `Urutan diubah menjadi ${newDirection.toUpperCase()}`, 'info'); // Tampilkan notifikasi
    },
    toggleFavoritFilter() {
      if (this.isFilterLocked) return;
      this.filters.favoritOnly = !this.filters.favoritOnly;
      this.saveFilter('favoritOnly');
      this.$emit('show-toast', `Filter Favorit ${this.filters.favoritOnly ? 'diaktifkan' : 'dinonaktifkan'}`, 'info');
    },
    toggleAutorun() {
      if (this.isFilterLocked) return;
      if (!this.isMultiChainMode) return;
      this.filters.autorun = !this.filters.autorun;
      this.saveFilter('autorun');
    },
    toggleAutoscroll() {
      if (this.isFilterLocked) return;
      this.filters.autoscroll = !this.filters.autoscroll;
      this.saveFilter('autoscroll');
    },
    handleMinPnlChange() {
      if (this.isFilterLocked) return;
      this.saveFilter('minPnl');
      this.$emit('show-toast', `Min PnL diatur ke ${this.filters.minPnl}`, 'info');
    },
    triggerSignalAlert(signal) {
      this.playNotificationSound();
    },
    ensureNotificationAudio() {
      if (!this.notificationAudio) {
        const audio = new Audio('audio.mp3');
        audio.preload = 'auto';
        audio.volume = 1;
        audio.loop = false;
        this.notificationAudio = audio;
      }
      return this.notificationAudio;
    },
    playNotificationSound() {
      try {
        const audio = this.ensureNotificationAudio();
        if (!audio) return;
        audio.pause();
        audio.currentTime = 0;
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            // Playback can fail if the browser blocks autoplay; ignore silently.
          });
        }
      } catch (error) {
        // console.warn('Gagal memutar audio notifikasi:', error);
      }
    },
    primeNotificationAudio() {
      if (this.audioPrimed) return;

      const audio = this.ensureNotificationAudio();
      if (!audio) return;

      const originalVolume = audio.volume;
      audio.volume = 0;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = originalVolume;
          this.audioPrimed = true;
        }).catch(() => {
          audio.volume = originalVolume;
        });
      } else {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = originalVolume;
        this.audioPrimed = true;
      }
    },
    openTradeLink(result) {
      this.$emit('show-toast', `Membuka tautan perdagangan untuk ${result.token}/${result.pair}`, 'info');
    },
    async copyAddress(address) {
      if (!address) {
        return;
      }

      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(address);
        } else {
          const tempInput = document.createElement('textarea');
          tempInput.value = address;
          tempInput.style.position = 'fixed';
          tempInput.style.opacity = '0';
          document.body.appendChild(tempInput);
          tempInput.focus();
          tempInput.select();
          document.execCommand('copy');
          document.body.removeChild(tempInput);
        }
        this.$emit('show-toast', 'Alamat berhasil disalin.', 'success');
      } catch (error) {
        // console.error('Gagal menyalin alamat kontrak:', error);
        this.$emit('show-toast', 'Gagal menyalin alamat.', 'danger');
      }
    },
    showCoinDetail(result) {
      this.$emit('show-toast', `Detail untuk ${result.token}:\nKontrak: ${result.sc_token}\nPnL: ${result.pnl}%`, 'info', 5000);
    },

    // --- LOGIKA DARI SIGNAL-CARDS ---
    // REFACTORED: Background mengikuti chain theme, warna DEX hanya untuk teks
    getDexHeaderStyles(dexKey) {
      // Gunakan getColorStyles dengan variant 'soft' agar background mengikuti chain theme
      // Warna DEX dari config hanya digunakan untuk teks/border, bukan background
      return this.$root.getColorStyles('dex', dexKey, 'soft');
    },
    getSignalsForDex(dexKey) {
      return this.signals.filter(signal => {
        return signal.dex && signal.dex.toLowerCase() === dexKey.toLowerCase();
      }).slice(0, 5);
    },
    goToSignal(signal) {
      if (!signal?.targetId) return;
      const element = document.getElementById(signal.targetId);
      if (!element) return;

      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

      element.classList.add('signal-cell-focus');
      setTimeout(() => element.classList.remove('signal-cell-focus'), 800);
    },

    // --- LOGIKA DARI SCANNING-TABLE ---
    // REFACTOR: Baca status langsung dari root object token.
    getTokenCexStatus(token, type) {
      if (type === 'token') {
        return { deposit: token.cex_deposit_status, withdraw: token.cex_withdraw_status };
      }
      if (type === 'pair') {
        return { deposit: token.cex_pair_deposit_status, withdraw: token.cex_pair_withdraw_status };
      }
      return { deposit: false, withdraw: false };
    },
    // === HELPER FUNCTIONS UNTUK GENERATE LINK ===

    // Generate link trade CEX untuk token/pair
    getCexTradeLink(token, symbol) {
      const cexKey = this.getTokenPrimaryCEX(token);
      if (!cexKey) return '#';

      const cexConfig = this.$root.config?.CEX?.[cexKey.toUpperCase()];
      if (!cexConfig || !cexConfig.URLS) return '#';

      // Gunakan template TRADE yang generic
      const urlTemplate = cexConfig.URLS.TRADE;
      if (!urlTemplate) return '#';

      // PERBAIKAN: Logika disederhanakan untuk memastikan simbol yang benar digunakan.
      // `symbol` yang dioper dari computed property sudah benar (nama_token atau nama_pair).
      // Kita hanya perlu memastikan base dan quote-nya.

      const isForToken = (symbol === (token.cex_ticker_token || token.nama_token));
      const isForPair = (symbol === (token.cex_ticker_pair || token.nama_pair));

      let baseSymbol = '';
      let pairSymbol = 'USDT'; // Default pair

      if (isForToken) {
        // Jika ini untuk token, base-nya adalah token itu sendiri.
        baseSymbol = token.nama_token;
        // Pair-nya bisa dari nama_pair atau default USDT.
        pairSymbol = token.nama_pair || 'USDT';
      } else if (isForPair) {
        // Jika ini untuk pair, base-nya adalah pair itu sendiri.
        baseSymbol = token.nama_pair;
        // Pair-nya selalu USDT dalam konteks ini.
        pairSymbol = 'USDT';
      } else {
        // Fallback jika `symbol` tidak cocok dengan keduanya.
        baseSymbol = symbol;
      }

      if (!baseSymbol) return '#';
      const effectivePairSymbol = pairSymbol || 'USDT';

      const replacements = {
        symbol: baseSymbol,
        token: baseSymbol,
        base: baseSymbol,
        pair: effectivePairSymbol,
        quote: effectivePairSymbol,
        symbolpair: `${baseSymbol}${effectivePairSymbol}`,
        pairtoken: `${effectivePairSymbol}${baseSymbol}`,
        basequote: `${baseSymbol}${effectivePairSymbol}`,
        quotebase: `${effectivePairSymbol}${baseSymbol}`,
        'symbol_pair': `${baseSymbol}_${effectivePairSymbol}`,
        'pair_symbol': `${effectivePairSymbol}_${baseSymbol}`,
        'symbol-pair': `${baseSymbol}-${effectivePairSymbol}`,
        'pair-symbol': `${effectivePairSymbol}-${baseSymbol}`,
        'symbolpairdash': `${baseSymbol}-${effectivePairSymbol}`
      };

      return urlTemplate.replace(/{([^{}]+)}/g, (match, key) => {
        const normalized = key.trim();
        const lowerNormalized = normalized.toLowerCase();

        if (replacements.hasOwnProperty(normalized)) {
          return replacements[normalized];
        }

        if (replacements.hasOwnProperty(lowerNormalized)) {
          return replacements[lowerNormalized];
        }

        const simplified = lowerNormalized.replace(/[^a-z]/g, '');
        if (replacements.hasOwnProperty(simplified)) {
          return replacements[simplified];
        }

        return '';
      });
    },

    // Generate link explorer berdasarkan chain dan smart contract
    getExplorerLink(token, contractAddress) {
      if (!contractAddress || !token || !token.chain) return '#';

      const chainKey = token.chain.toLowerCase();
      const chainConfig = this.$root.config?.CHAINS?.[chainKey];

      // Gunakan template URL untuk TOKEN, karena ini lebih spesifik untuk smart contract.
      // Fallback ke template ADDRESS jika TOKEN tidak ada.
      const urlTemplate = chainConfig?.LINKS?.EXPLORER?.TOKEN || chainConfig?.LINKS?.EXPLORER?.ADDRESS;

      if (!urlTemplate) return '#';

      return urlTemplate.replace('{address}', contractAddress);
    },

    // Generate link cek saldo token di wallet CEX
    getCexWalletBalanceLink(token, contractAddress, walletIndex = 1) {
      if (!contractAddress) return '#';

      const cex = this.getTokenPrimaryCEX(token);
      if (!cex) return this.getExplorerLink(token, contractAddress);

      const chain = token.chain.toLowerCase();
      const config = this.$root.config;

      // Ambil wallet address dari config
      const cexConfig = config?.CEX?.[cex.toUpperCase()];
      if (!cexConfig || !cexConfig.WALLETS || !cexConfig.WALLETS[chain]) {
        return this.getExplorerLink(token, contractAddress);
      }

      const walletData = cexConfig.WALLETS[chain];
      let walletAddress = null;

      // Pilih wallet berdasarkan index
      if (walletIndex === 1) {
        walletAddress = walletData.address;
      } else if (walletIndex === 2) {
        walletAddress = walletData.address2 || walletData.address;
      } else if (walletIndex === 3) {
        walletAddress = walletData.address3 || walletData.address2 || walletData.address;
      }

      if (!walletAddress) {
        return this.getExplorerLink(token, contractAddress);
      }

      // Ambil template URL dari config
      const chainConfig = config?.CHAINS?.[chain];
      const urlTemplate = chainConfig?.LINKS?.EXPLORER?.TOKEN;

      if (!urlTemplate) {
        // Fallback jika template tidak ditemukan
        return `https://etherscan.io/token/${contractAddress}?a=${walletAddress}`;
      }

      // Ganti placeholder dan tambahkan parameter wallet address
      return `${urlTemplate.replace('{address}', contractAddress)}?a=${walletAddress}`;
    },

    // Generate link deposit CEX
    getCexDepositLink(token, symbol) {
      const cexKey = this.getTokenPrimaryCEX(token);
      if (!cexKey || !symbol) return '#';

      const cexConfig = this.$root.config?.CEX?.[cexKey.toUpperCase()];
      const urlTemplate = cexConfig?.URLS?.DEPOSIT;

      if (!urlTemplate) return '#';

      // REVISI: Ganti placeholder {token} dengan simbol yang relevan.
      // Placeholder {pair} juga diganti dengan simbol untuk fleksibilitas template.
      return urlTemplate
        .replace(/{token}/g, symbol)
        .replace(/{pair}/g, symbol);
    },

    getDexTradeLink(token, dexKey, direction = 'CEXtoDEX') {
      if (!token || !dexKey) return '#';

      const dexConfig = this.$root.config?.DEXS?.[String(dexKey || '').toLowerCase()];
      const urlTemplate = dexConfig?.URL_DEX;
      if (!urlTemplate) return '#';

      const chainKey = String(token.chain || '').toLowerCase();
      const chainConfig = this.$root.config?.CHAINS?.[chainKey] || {};

      const chainNameOriginal = chainConfig.NAMA_CHAIN || chainConfig.NAMA_PENDEK || token.chain || '';
      const chainNameLower = String(chainNameOriginal || '').toLowerCase();

      const chainCodeSource = chainConfig.NAMA_PENDEK || chainConfig.KODE_CHAIN || chainNameOriginal;
      const chainCodeString = typeof chainCodeSource === 'number'
        ? String(chainCodeSource)
        : String(chainCodeSource || '').toLowerCase();
      const chainCodeUpper = typeof chainCodeSource === 'number'
        ? String(chainCodeSource)
        : String(chainCodeSource || '').toUpperCase();

      const sanitizeSymbol = (value) => {
        if (!value) return '';
        const raw = value.toString().trim();
        if (!raw) return '';
        const symbolPart = raw.includes('/') ? raw.split('/')[0] : raw.includes('_') ? raw.split('_')[0] : raw;
        return symbolPart.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      };

      const sanitizePairSymbol = (value) => {
        if (!value) return '';
        const raw = value.toString().trim();
        if (!raw) return '';
        const parts = raw.includes('/') ? raw.split('/') : raw.includes('_') ? raw.split('_') : [raw];
        const segment = parts[parts.length - 1];
        return segment.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      };

      const tokenSymbol = sanitizeSymbol(token.cex_ticker_token || token.nama_token);
      const pairSymbol = sanitizePairSymbol(token.cex_ticker_pair || token.nama_pair);

      const tokenAddress = String(token.sc_token || '').toLowerCase();
      const pairAddress = String(token.sc_pair || '').toLowerCase();

      const replacements = {
        chainName: chainNameLower,
        chain: chainNameLower,
        chainLower: chainNameLower,
        chainUpper: String(chainNameOriginal || '').toUpperCase(),
        chainOriginal: chainNameOriginal,
        chainCode: chainCodeString,
        chaincode: chainCodeString,
        chainCodeUpper: chainCodeUpper,
        chainCodeLower: chainCodeString,
        tokenSymbol,
        baseSymbol: tokenSymbol,
        tokenSymbolLower: tokenSymbol.toLowerCase(),
        pairSymbol: pairSymbol || 'USDT',
        quoteSymbol: pairSymbol || 'USDT',
        pairSymbolLower: (pairSymbol || 'USDT').toLowerCase(),
        tokenAddress,
        pairAddress,
        fromAddress: direction === 'CEXtoDEX' ? tokenAddress : pairAddress,
        toAddress: direction === 'CEXtoDEX' ? pairAddress : tokenAddress,
        direction
      };

      const escapeValue = (value) => value === undefined || value === null ? '' : String(value);

      return urlTemplate.replace(/{([^{}]+)}/g, (match, key) => {
        const normalized = key.trim();
        if (replacements.hasOwnProperty(normalized)) {
          return escapeValue(replacements[normalized]);
        }
        const lower = normalized.toLowerCase();
        if (replacements.hasOwnProperty(lower)) {
          return escapeValue(replacements[lower]);
        }
        const compact = lower.replace(/[^a-z]/g, '');
        if (replacements.hasOwnProperty(compact)) {
          return escapeValue(replacements[compact]);
        }
        return '';
      });
    },

    // Generate link withdraw CEX
    getCexWithdrawLink(token, symbol) {
      const cexKey = this.getTokenPrimaryCEX(token);
      if (!cexKey || !symbol) return '#';

      const cexConfig = this.$root.config?.CEX?.[cexKey.toUpperCase()];
      const urlTemplate = cexConfig?.URLS?.WITHDRAW;

      if (!urlTemplate) return '#';

      // REVISI: Ganti placeholder {token} dan {pair} dengan simbol yang relevan.
      return urlTemplate
        .replace(/{token}/g, symbol)
        .replace(/{pair}/g, symbol);
    },

    // Generate link DEX aggregator alternatif
    getDexAggregatorLink(token, aggregator) {
      const chainId = this.getChainId(token.chain);
      const scTokenIn = token.sc_token;
      const scTokenOut = token.sc_pair;

      switch(aggregator.toUpperCase()) {
        case 'UNX':
          return `https://app.unidex.exchange/?chain=${token.chain}&from=${scTokenIn}&to=${scTokenOut}`;
        case 'OKX':
          return `https://www.okx.com/web3/dex-swap?inputChain=${chainId}&inputCurrency=${scTokenIn}&outputChain=${chainId}&outputCurrency=${scTokenOut}`;
        case 'DFL':
          return `https://swap.defillama.com/?chain=${token.chain}&from=${scTokenIn}&to=${scTokenOut}`;
        case 'JMX':
          return `https://jumper.exchange/?fromChain=${chainId}&fromToken=${scTokenIn}&toChain=${chainId}&toToken=${scTokenOut}`;
        default:
          return '#';
      }
    },

    // Helper: Get chain ID untuk OKX
    getChainId(chain) {
      const chainKey = String(chain || '').toLowerCase();
      const chainConfig = this.$root.config?.CHAINS?.[chainKey];
      // Fallback ke '1' (Ethereum) jika tidak ditemukan
      return chainConfig?.KODE_CHAIN || '1';
    },
    getChainConfig(chain) {
      if (!chain) return null;
      const chainKey = String(chain).toLowerCase();
      return this.$root.config?.CHAINS?.[chainKey] || null;
    },
    // --- END LOGIKA DARI SCANNING-TABLE ---
    getWXBadgeClass(token, type) {
      const wx = type === 'from' ? token.fromWX : token.toWX;
      if (wx === 'WX') return 'bg-danger';
      if (wx === 'WD') return 'bg-warning text-dark';
      return 'bg-secondary';
    },
    getDexLeft(token, dexKey) {
      // Cek hasil scan yang disimpan
      const scanResult = this.scanResults?.[token.id];
      if (scanResult?.pnl?.[dexKey]?.cexToDex) {
        return scanResult.pnl[dexKey].cexToDex;
      }
      return null;
    },
    getDexRight(token, dexKey) {
      // Cek hasil scan yang disimpan
      const scanResult = this.scanResults?.[token.id];
      if (scanResult?.pnl?.[dexKey]?.dexToCex) {
        return scanResult.pnl[dexKey].dexToCex;
      }
      return null;
    },
    formatPriceWithZeros(price) {
      return ScanningFormatters.formatPriceWithZeros(price);
    },
    formatDexCell(pnlData, token, direction, usdtRate) {
      // Delegate ke ScanningFormatters
      return ScanningFormatters.formatDexCell(pnlData, token, direction, {
        usdtRate,
        modalUsd: this.$root.globalSettings?.modalUsd || 0,
        isScanning: this.isScanning
      });
    },
    updateTokenDisplay(tokenId, pnlResults) {
      // Method ini akan dipanggil dari scanner mixin
      // untuk memicu Vue reactivity
      this.$forceUpdate();
    },
    isDexActive(token, dexKey) {
      // Cek apakah DEX aktif untuk token ini
      if (!token.dex || !token.dex[dexKey]) return false;
      return token.dex[dexKey].status === true;
    },
    formatOrderbookCell(token, side) {
      const scanResult = this.scanResults?.[token.id];
      if (!scanResult?.cex) {
        return '<div class="text-muted small">Loading...</div>';
      }

      const cexPrices = scanResult.cex;

      // Delegate ke ScanningFormatters dengan full orderbook data
      return ScanningFormatters.formatOrderbookCell(cexPrices, side);
    },
    openOrderbook(token, side) {
      const cexKey = this.getTokenPrimaryCEX(token);
      const symbol = side === 'left' ? token.cex_ticker_token : token.cex_ticker_pair;
      this.$emit('show-toast', `Membuka orderbook ${cexKey} ${symbol}`, 'info');
    },
     async toggleTokenFavorit(token) {
      // Baca dari kedua properti untuk backward compatibility
      const currentFavorite = Boolean(token.isFavorite || token.isFavorit);
      const newFavoriteStatus = !currentFavorite;
      
      // Update state lokal
      token.isFavorite = newFavoriteStatus;
      token.isFavorit = newFavoriteStatus;
      
      // Clone token dan bersihkan properti lama sebelum menyimpan
      let cleanToken = JSON.parse(JSON.stringify(token));
      cleanToken.isFavorite = newFavoriteStatus;
      delete cleanToken.isFavorit;

      // Simpan perubahan ke DB menggunakan repository
      // REVISI: Gunakan coinRepository
      const coinRepo = window.AppContainer.get('coinRepository');
      await coinRepo.save(cleanToken);
      await this.loadTokensFromDB();
      this.$emit('show-toast', `${token.nama_token || token.nama_koin} ${newFavoriteStatus ? 'ditambahkan ke' : 'dihapus dari'} favorit.`, 'success');
    },
    openChart(token) {
      this.$emit('show-toast', `Membuka chart untuk ${token.from}`, 'info');
    },
    async deleteToken(token) {
      if (confirm(`Anda yakin ingin menghapus token ${token.nama_koin || token.from}?`)) {
        // Hapus dari state lokal 
        this.tokens = this.tokens.filter(t => t.id !== token.id);
        // REVISI: Hapus dari DB menggunakan repository
        const coinRepo = window.AppContainer.get('coinRepository');
        await coinRepo.delete(token.id, token.chain);
        await this.loadTokensFromDB();
        this.$emit('show-toast', `Token ${token.from} dihapus`, 'danger');
      }
    }
    ,

    // REVISI: Methods dari management-tab untuk modal edit
    openEditModal(token) {
      this.formMode = 'edit';
      this.editingToken = { ...token };
      this.formData.selectedCex = [token.cex_name];
      this.formData.cex_tickers[token.cex_name] = token.cex_ticker_token;
      this.formData.tokenData = {
        name: token.nama_koin,
        sc: token.sc_token,
        decimals: token.des_token
      };
      this.formData.selectedPairType = token.nama_pair || this.availablePairOptions[0]?.key;
      this.formData.selectedDex = Object.keys(token.dex || {});
      this.formData.dexModals = {};
      Object.keys(token.dex || {}).forEach(dexKey => {
        this.formData.dexModals[dexKey] = {
          modalKiri: token.dex[dexKey]?.left || 100,
          modalKanan: token.dex[dexKey]?.right || 100
        };
      });
      this.showFormModal = true;
    },
    closeFormModal() {
      this.editingToken = null;
      this.showFormModal = false;
      this.resetFormData();
    },
    resetFormData() {
      this.formData = {
        selectedPairType: '',
        selectedDex: [],
        dexModals: {},
        nonData: { symbol: '', sc: '', des: 18 },
        tokenData: { name: '', sc: '', decimals: 18 },
        selectedCex: [],
        cex_tickers: {},
      };
    },
    toggleDexSelection(dexKey) {
      const index = this.formData.selectedDex.indexOf(dexKey);
      if (index > -1) {
        this.formData.selectedDex.splice(index, 1);
      } else {
        this.formData.selectedDex.push(dexKey);
        if (!this.formData.dexModals[dexKey]) {
          this.formData.dexModals[dexKey] = { modalKiri: 100, modalKanan: 100 };
        }
      }
    },
    updateDexModal(dexKey, field, value) {
      if (!this.formData.dexModals[dexKey]) {
        this.formData.dexModals[dexKey] = { modalKiri: 100, modalKanan: 100 };
      }
      this.formData.dexModals[dexKey][field] = value;
    },
    async handleFormSave() {
      await this.saveEditToken();
    },
    async saveEditToken() {
      if (!this.editingToken || this.formData.selectedCex.length !== 1) return;

      let pairInfo;
      if (this.isNonPair) {
        pairInfo = {
          symbol: this.formData.nonData.symbol,
          address: this.formData.nonData.sc,
          decimals: Number(this.formData.nonData.des || 18)
        };
      } else {
        const pair = this.availablePairOptions.find(p => p.key === this.formData.selectedPairType);
        pairInfo = {
          symbol: pair.symbol,
          address: pair.address,
          decimals: Number(pair.decimals || 18)
        };
      }

      const dexConfig = this.formData.selectedDex.reduce((acc, dexKey) => {
        const modal = this.formData.dexModals[dexKey] || { modalKiri: 100, modalKanan: 100 };
        acc[dexKey] = {
          status: true,
          left: Number(modal.modalKiri || 0),
          right: Number(modal.modalKanan || 0)
        };
        return acc;
      }, {});

      const updatedToken = {
        ...this.editingToken,
        nama_koin: this.formData.tokenData.name.toUpperCase(),
        sc_token: this.formData.tokenData.sc,
        des_token: Number(this.formData.tokenData.decimals || 18),
        cex_name: this.formData.selectedCex[0].toUpperCase(),
        cex_ticker_token: this.formData.cex_tickers[this.formData.selectedCex[0]].toUpperCase(),
        nama_pair: pairInfo.symbol,
        sc_pair: pairInfo.address,
        des_pair: pairInfo.decimals,
        dex: dexConfig
      };

      await this.coinRepo.save(updatedToken);
      this.$emit('show-toast', `Token ${updatedToken.nama_koin} berhasil diupdate.`, 'success');
      this.closeFormModal();
      await this.loadTokensFromDB(); // Reload data
    }
  },

  // REFACTOR: Watcher untuk activeChain sekarang dihandle oleh filterAutoSaveMixin
  // Hanya perlu watch untuk reload tokens
  watch: {
    '$root.activeChain': {
      immediate: true, // Muat data saat komponen pertama kali dimuat
      handler(newChain) {
        if (newChain !== 'multi' && this.filters?.autorun) {
          this.filters.autorun = false;
          this.saveFilter('autorun');
        }
        this.loadTokensFromDB();
      }
    },
    // SOLUSI: Tambahkan watcher untuk status inisialisasi aplikasi.
    // Ini untuk menangani race condition di mana `loadTokensFromDB` dipanggil
    // oleh watcher `activeChain` sebelum aplikasi siap.
    '$root.isAppInitialized': {
      handler(isInitialized) {
        // Jika aplikasi sudah siap dan tabel masih kosong, coba muat ulang data.
        if (isInitialized && this.tokens.length === 0) {
          /* // console.log('[ScanningTab] Aplikasi terinisialisasi, memuat ulang data token...'); */
          this.loadTokensFromDB();
        }
      }
    },
    // REVISI: Tambahkan watcher untuk membersihkan hasil scan saat filter berubah
    // untuk mencegah tampilan data yang tidak relevan.
    filteredTokens: {
      handler(newTokens, oldTokens) {
        // Jika daftar token yang akan ditampilkan berubah, bersihkan hasil scan lama.
        if (this.scanResults && Object.keys(this.scanResults).length > 0) {
          // // console.log('Daftar token berubah, membersihkan hasil scan lama dari tampilan.');

        // REVISI: Jika scan sedang berjalan, jangan bersihkan hasil.
        // Ini mencegah hasil scan hilang saat user mengetik di search box.
        if (this.isScanning) {
          return;
        }

          this.clearScanResults(); // Panggil method dari scannerMixin
        }
      }
    },
    // REVISI: Tambahkan watcher untuk scanResults agar bisa memproses sinyal
    scanResults: {
      deep: true,
      handler(newResults, oldResults) { this.handlePnlForSignalCard(this.lastPnlResult); }
    }
  },
  async activated() {
    // REVISI: Tambahkan guard untuk menunggu inisialisasi aplikasi selesai.
    // Ini akan mencegah race condition dengan DB.
    // ... (logika guard bisa tetap ada jika diperlukan untuk race condition lain)
    await this.loadTokensFromDB();
    await this.loadFilterSettings(); // Muat filter terlebih dahulu
  },

  // REVISI: Template digabungkan menjadi satu.
  template: `
    <div class="scanning-tab">

      <filter-toolbar
        title="Scanning Control"
        icon="bi-broadcast"
        :filters="filters"
        v-model:searchQuery="$root.searchQuery"
        :filtered-tokens-count="filteredTokens.length"
        :disabled="isFilterLocked"
        :show-favorite-button="$root.activeChain !== 'multi'"
        :show-autorun-button="isMultiChainMode"
        :show-min-pnl-input="true"
        :show-autoscroll-button="true"
        @update:filters="newFilters => $root.filters = newFilters"
        @toggle-favorite="toggleFavoritFilter"
        @toggle-autoscroll="toggleAutoscroll"
        @toggle-autorun="toggleAutorun"
        @handle-min-pnl-change="handleMinPnlChange"
      >
        <!-- Slot untuk tombol Start/Stop Scan -->
        <template #actions>
          <button class="btn btn-sm"
                  :class="isScanning ? 'btn-danger' : 'btn-success'"
                  @click="toggleScan"
                  :disabled="!isScanning && filteredTokens.length === 0"
                  title="Tombol aktif jika ada koin di tabel">
            <i :class="isScanning ? 'bi bi-stop-circle-fill' : 'bi bi-play-circle-fill'"></i> {{ isScanning ? 'Stop Scan' : 'Start Scan' }}
          </button>
        </template>
        <template #footer>
          <div v-if="isScanning || scanProgress > 0" class="mt-3 pt-2 border-top">
            <div class="d-flex justify-content-between align-items-center small mb-1">
              <div class="text-muted small">
                <i class="bi bi-hourglass-split me-1"></i>
                <span class="fw-semibold">{{ scanStatusText }}</span>
              </div>
              <div class="text-end small">
                <span class="badge bg-primary">{{ scanProgress.toFixed(0) }}%</span>
                <span class="badge bg-secondary ms-1" v-if="currentBatch > 0">Batch {{ currentBatch }}/{{ totalBatches }}</span>
                <span class="badge bg-info text-dark ms-1" v-if="isScanning && estimatedTimeRemaining">ETA: {{ estimatedTimeRemaining }}</span>
              </div>
            </div>
            <div class="progress" style="height: 6px;">
              <div class="progress-bar progress-bar-striped progress-bar-animated"
                   :class="isScanning ? 'bg-success' : 'bg-primary'"
                   role="progressbar"
                   :style="{ width: scanProgress + '%' }"
                   :aria-valuenow="scanProgress"
                   aria-valuemin="0"
                   aria-valuemax="100">
              </div>
            </div>
          </div>
        </template>
      </filter-toolbar>

      <!-- TEMPLATE DARI SIGNAL-CARDS -->
      <div v-if="activeDexList.length > 0" class="row g-2 mb-3">
        <div v-for="dex in activeDexList" :key="dex.key" class="col-xl col-md-6">
          <div class="card card-soft h-100">
            <div class="card-header p-2 text-center" :style="getDexHeaderStyles(dex.key)">
              <h6 class="mb-0 small fw-bold text-uppercase" :style="$root.getColorStyles('dex', dex.key, 'text')">
                {{ dex.name }}
              </h6>
            </div>
            <div class="card-body p-2">
              <div v-if="getSignalsForDex(dex.key).length === 0" class="text-center text-muted small py-3">
                <span class="d-block">Belum Ada Selisih</span>
              </div>
              <div v-else class="list-group list-group-flush">
                <div v-for="signal in getSignalsForDex(dex.key)" :key="signal.id"
                     class="list-group-item list-group-item-action p-1 signal-item"
                     :class="{ 'signal-item-success': signal.meetsThreshold, 'signal-item-light': !signal.meetsThreshold }"
                     @click="goToSignal(signal)"
                     :title="'Klik untuk scroll ke ' + signal.pairLabel">
                  <div class="signal-card-content">
                    <div class="d-flex justify-content-between align-items-center flex-wrap">
                      <span class="fw-semibold text-uppercase signal-pair" :class="signal.directionClass">
                        {{ signal.pairLabel }}
                      </span>
                      <span class="text-muted small mx-1">|</span>
                      <span class="fw-semibold text-dark small">{{ signal.modalDisplay }}$</span>
                      <span class="fw-semibold signal-pnl ms-auto" :class="signal.pnlClass">PNL: {{ signal.pnlUsdFormatted }}</span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center small mt-1">
                      <span class="fw-semibold text-uppercase" :style="signal.cexColor ? { color: signal.cexColor } : null">{{ signal.cexName }} on <span class="badge" :style="signal.chainStyle">{{ signal.chainName }}</span></span>
                      <span class="signal-fee fw-semibold text-dark">Fee: {{ signal.totalFeeDisplay }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TEMPLATE DARI SCANNING-TABLE -->
      <div class="table-responsive scanning-table-container">
        <table class="table table-sm table-hover table-bordered align-middle scanning-table">
          <thead class="sticky-top">
            <tr class="text-center" :style="tableHeaderStyle">
              <th class="text-dark fw-bold">ORDERBOOK</th>
              <th v-for="dex in activeDexList" :key="'left-' + dex.key" class="text-dark fw-bold">{{ dex.name }}</th>
              <th class="text-dark fw-bold" style="cursor: pointer;" @click="toggleSortDirection">
                DETAIL TOKEN
                <i class="bi" :class="{
                  'bi-arrow-down': filters.sortDirection === 'desc',
                  'bi-arrow-up': filters.sortDirection === 'asc',
                  'ms-1': true
                }"></i>
              </th>
              <th v-for="dex in activeDexList" :key="'right-' + dex.key" class="text-dark fw-bold">{{ dex.name }}</th>
              <th class="text-dark fw-bold">ORDERBOOK</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredTokens.length === 0">
              <td :colspan="columnCount" class="text-center text-muted py-5">
                <i class="bi bi-inbox-fill fs-1 d-block mb-2"></i>
                <span>Tidak ada data token. Silakan tambahkan di menu Manajemen Koin.</span>
              </td>
            </tr>
            <token-row
              v-for="(token, index) in sortedAndFilteredTokens"
              :key="token.id"
              :token="token"
              :index="index"
              :active-dex-list="activeDexList"
              :scan-result="scanResults[token.id] || null"
              :dex-status-map="dexScanStatus[token.id] || {}"
              :helpers="tokenRowHelpers"
              :usdt-rate="$root.globalSettings?.usdtRate || 15800"
              :modal-usd="$root.globalSettings?.modalUsd || 0"
              :is-scan-running="isScanning"
              :chain-colors="chainColorFn"
              :is-multi-chain-mode="isMultiChainMode"
            ></token-row>
          </tbody>
        </table>
      </div>

      <!-- REVISI: Modal Add/Edit dari management-tab -->
      <div v-if="showFormModal" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
        <div class="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable management-form-modal">
          <div class="modal-content">
            <div class="modal-header py-2" :style="$root.getColorStyles('chain', editingToken.chain, 'soft')">
              <h5 class="modal-title fw-bolder fs-5" :style="$root.getColorStyles('chain', editingToken.chain, 'text')">
                <i class="me-2 bi-pencil"></i>
                Edit Token
              </h5>
              <button type="button" class="btn-close" @click="closeFormModal"></button>
            </div>
            <div class="modal-body p-3">
              <div class="row g-4">
                <!-- Kolom Kiri -->
                <div class="col-lg-5" :style="$root.getColorStyles('chain', editingToken.chain, 'soft-bg')">
                  <h6 class="mb-3 fw-bold"><i class="bi bi-coin me-2"></i>Informasi Dasar Token</h6>
                  <div class="mb-3">
                    <label class="form-label small fw-semibold">Nama Token</label>
                    <input type="text" class="form-control form-control-sm" v-model="formData.tokenData.name" placeholder="Contoh: PancakeSwap">
                  </div>
                  <div class="mb-3">
                    <label class="form-label small fw-semibold">Smart Contract</label>
                    <input type="text" class="form-control form-control-sm" v-model="formData.tokenData.sc" placeholder="0x...">
                  </div>
                  <div class="mb-3">
                    <label class="form-label small fw-semibold">Decimals</label>
                    <input type="number" class="form-control form-control-sm" v-model.number="formData.tokenData.decimals" min="0" max="32">
                  </div>
                </div>

                <!-- Kolom Kanan -->
                <div class="col-lg-7" :style="$root.getColorStyles('chain', editingToken.chain, 'soft-bg')">
                  <h6 class="mb-3 fw-bold"><i class="bi bi-arrow-left-right me-2"></i>Konfigurasi Pair</h6>
                  <div class="mb-2">
                    <label class="form-label small fw-semibold">Pilih Pair</label>
                    <select class="form-select form-select-sm" v-model="formData.selectedPairType">
                      <option v-for="pair in availablePairOptions" :key="'form-pair-' + pair.key" :value="pair.key">{{ pair.symbol }}</option>
                    </select>
                  </div>
                  <div v-if="isNonPair" class="bg-info bg-opacity-10 border border-info rounded p-3 mb-4">
                      <div class="row g-2 align-items-end">
                        <div class="col-12 col-md-12 col-lg-12">
                          <label class="form-label small fw-semibold">Nama Token (Symbol)</label>
                          <div class="input-group input-group-sm">
                            <input
                              type="text"
                              class="form-control"
                              v-model="formData.nonData.symbol"
                              placeholder="USDT"
                              style="text-transform: uppercase;"
                            >
                            <span class="input-group-text px-2">Dec</span>
                            <input
                              type="number"
                              class="form-control"
                              v-model.number="formData.nonData.des"
                              min="0"
                              max="32"
                              style="max-width: 80px;"
                            >
                          </div>
                        </div>
                        <div class="col-12 col-md-12 col-lg-12">
                          <label class="form-label small fw-semibold">Smart Contract</label>
                          <input
                            type="text"
                            class="form-control form-control-sm"
                            v-model="formData.nonData.sc"
                            placeholder="0x..."
                          >
                        </div>
                      </div>
                    </div>


                  <h6 class="mb-3 fw-bold"><i class="bi bi-grid me-2"></i>Konfigurasi DEX</h6>
                  <div class="p-3 border rounded">
                    <div class="vstack gap-2">
                      <div v-for="dex in availableDexOptions" :key="'form-dex-' + dex.key" 
                           class="d-flex align-items-center gap-2 border rounded p-2" 
                           :style="formData.selectedDex.includes(dex.key) ? $root.getColorStyles('chain', editingToken.chain, 'solid') : {}">
                        <div class="form-check flex-grow-1">
                          <input class="form-check-input" type="checkbox" :id="'form-dex-' + dex.key"
                                 :checked="formData.selectedDex.includes(dex.key)"
                                 @change="toggleDexSelection(dex.key)">
                          <label class="form-check-label fw-semibold small" :for="'form-dex-' + dex.key" :style="{ color: dex.color }">
                            {{ dex.name }}
                          </label>
                        </div>
                        <div v-if="formData.selectedDex.includes(dex.key)" class="d-flex gap-2" style="width: 240px;">
                          <div class="input-group input-group-sm">
                            <span class="input-group-text">$</span>
                            <input type="number" class="form-control" placeholder="100"
                                   :value="formData.dexModals[dex.key]?.modalKiri"
                                   @input="updateDexModal(dex.key, 'modalKiri', parseInt($event.target.value) || 0)">
                          </div>
                          <div class="input-group input-group-sm">
                            <span class="input-group-text">$</span>
                            <input type="number" class="form-control" placeholder="100"
                                   :value="formData.dexModals[dex.key]?.modalKanan"
                                   @input="updateDexModal(dex.key, 'modalKanan', parseInt($event.target.value) || 0)">
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div> <!-- end row -->
            </div>
            <div class="modal-footer py-2">
              <button type="button" class="btn btn-sm btn-danger" 
                      :style="$root.getColorStyles('chain', editingToken.chain, 'outline')" 
                      @click="closeFormModal">Batal</button>
              <button type="button" class="btn btn-sm btn-primary" 
                      :style="$root.getColorStyles('chain', editingToken.chain, 'solid')" 
                      @click="handleFormSave">
                <i class="bi bi-save me-1"></i>Update Token
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  `
};
