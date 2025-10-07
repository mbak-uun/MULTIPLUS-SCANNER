// components/tabs/scanning-tab.js
// Komponen Vue mandiri untuk Tab Scanning

// REKOMENDASI REFAKTOR: Impor store dari Pinia
// import { useAppStore } from '@/stores/app';
// import { useFilterStore } from '@/stores/filter';
// import { useScanStore } from '@/stores/scan';
// import { useTokenStore } from '@/stores/token';

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
    chainColors: { type: Function, required: true }
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
      const symbol = this.token.cex_ticker_token || this.token.nama_token;
      return this.helpers.getCexWithdrawLink ? this.helpers.getCexWithdrawLink(this.token, symbol) : '#';
    },
    tokenDepositLink() {
      const symbol = this.token.cex_ticker_token || this.token.nama_token;
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
    }
  },
  watch: {
    // Watch scanResult untuk memastikan UI update saat data berubah
    scanResult: {
      handler(newVal, oldVal) {
        // Force update saat scanResult berubah
        if (newVal !== oldVal) {
          this.$forceUpdate();
        }
      },
      deep: true // Watch nested properties
    }
  },
  methods: {
    formatOrderbook(side) {
      // Jika scanResult belum ada atau cex belum ada, tampilkan loading dengan icon kunci
      const cexData = this.scanResult?.cex;
      return ScanningFormatters.formatOrderbookCell(cexData, side, {
        token: this.token
      });
    },
    isDexActive(dexKey) {
      return !!(this.token.dex && this.token.dex[dexKey] && this.token.dex[dexKey].status);
    },
    formatDexCell(dexKey, direction) {
      // Jika scanResult belum ada, tampilkan loading dengan icon kunci
      const dexResult = this.scanResult?.pnl?.[dexKey];
      const tokenSymbol = this.token.cex_ticker_token || this.token.nama_token;
      const pairSymbol = this.token.cex_ticker_pair || this.token.nama_pair;
      const tokenTradeLink = this.helpers.getCexTradeLink ? this.helpers.getCexTradeLink(this.token, tokenSymbol) : '#';
      const pairTradeLink = this.helpers.getCexTradeLink ? this.helpers.getCexTradeLink(this.token, pairSymbol) : '#';
      const dexTradeLink = this.helpers.getDexTradeLink ? this.helpers.getDexTradeLink(this.token, dexKey, direction) : '#';

      const formatterOptions = {
        usdtRate: this.usdtRate,
        modalUsd: this.modalUsd,
        isScanning: this.isScanRunning,
        dexKey,
        cexBuyLink: direction === 'CEXtoDEX' ? tokenTradeLink : pairTradeLink,
        cexSellLink: direction === 'CEXtoDEX' ? pairTradeLink : tokenTradeLink,
        dexLink: dexTradeLink
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
          return `https://www.okx.com/web3/dex-swap?inputChain=${chainId}&inputCurrency=${scTokenIn}&outputChain=${chainId}&outputCurrency=${scTokenOut}`;
        case 'DFL':
          return `https://swap.defillama.com/?chain=${token.chain}&from=${scTokenIn}&to=${scTokenOut}`;
        case 'JMX':
          return `https://jumper.exchange/?fromChain=${chainId}&fromToken=${scTokenIn}&toChain=${chainId}&toToken=${scTokenOut}`;
        default:
          return '#';
      }
    },
    copyTokenAddress() {
      if (this.helpers.copyTokenAddress) {
        this.helpers.copyTokenAddress(this.token);
      }
    },
    toggleFavorite() {
      if (this.helpers.toggleTokenFavorit) {
        this.helpers.toggleTokenFavorit(this.token);
      }
    },
    openChart() {
      if (this.helpers.openChart) {
        this.helpers.openChart(this.token);
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
      <td class="text-center" style="min-width: 120px;">
        <div v-html="formatOrderbook('left')"></div>
        <a :href="tokenTradeLink" target="_blank"
           class="btn btn-sm btn-outline-primary text-uppercase mt-2"
           :title="'Trade ' + (token.cex_ticker_token || token.nama_token) + ' di ' + primaryCex">
          {{ primaryCex }}
        </a>
      </td>
      <td v-for="dex in activeDexList" :key="'left-' + dex.key + '-' + token.id" class="text-center" style="min-width: 150px;">
        <div v-if="isDexActive(dex.key)" v-html="formatDexCell(dex.key, 'CEXtoDEX')"></div>
        <div v-else class="small text-muted">-</div>
      </td>
      <td class="token-detail">
        <div class="d-flex flex-column align-items-center">
          <div class="mb-1 small fw-bold">
           <span class=" me-1">#{{ rowNumber }}</span>
            <a :href="tokenTradeLink" target="_blank" class="text-primary text-decoration-none" :title="'Trade ' + (token.nama_token || 'N/A') + ' di ' + primaryCex">
              {{ token.nama_token || 'N/A' }}
            </a>
            <span class="text-muted mx-1">VS</span>
            <a :href="pairTradeLink" target="_blank" class="text-primary text-decoration-none" :title="'Trade ' + (token.nama_pair || 'N/A') + ' di ' + primaryCex">
              {{ token.nama_pair || 'N/A' }}
            </a>
            <span v-if="token.isFavorite || token.isFavorit" class="ms-1">☆</span>
          </div>
          <div class="small mb-2"  >
            <span class="badge bg-warning text-dark">{{ primaryCex }}</span> on
            <span class="badge" :style="chainStyle">{{ token.chain.toUpperCase() }}</span>
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
           
           <div class="d-flex gap-1 mb-2 small ">
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
          <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-sm btn-outline-secondary py-0 px-2" @click="copyTokenAddress" title="Copy Address"><i class="bi bi-clipboard"></i></button>
            <button class="btn btn-sm py-0 px-2" :class="(token.isFavorite || token.isFavorit) ? 'btn-warning' : 'btn-outline-secondary'" @click="toggleFavorite" title="Toggle Favorit"><i class="bi bi-star-fill"></i></button>
            <button class="btn btn-sm btn-outline-secondary py-0 px-2" @click="openChart" title="Open Chart"><i class="bi bi-graph-up"></i></button>
            <button class="btn btn-sm btn-outline-danger py-0 px-2" @click="deleteToken" title="Delete"><i class="bi bi-trash"></i></button>
          </div>
        </div>
      </td>
      <td v-for="dex in activeDexList" :key="'right-' + dex.key + '-' + token.id" class="text-center" style="min-width: 150px;">
        <div v-if="isDexActive(dex.key)" v-html="formatDexCell(dex.key, 'DEXtoCEX')"></div>
        <div v-else class="small text-muted">-</div>
      </td>
      <td class="text-center" style="min-width: 120px;">
        <div v-html="formatOrderbook('right')"></div>
        <a :href="pairTradeLink" target="_blank"
           class="btn btn-sm btn-outline-primary text-uppercase mt-2"
           :title="'Trade ' + (token.cex_ticker_pair || token.nama_pair) + ' di ' + primaryCex">
          {{ primaryCex }}
        </a>
      </td>
    </tr>
  `
};

// REVISI: Komponen ini digabungkan kembali menjadi satu unit mandiri
// untuk menyederhanakan alur data dan memperbaiki fungsionalitas.
const ScanningTab = {
  name: 'ScanningTab',
  components: {
    'token-row': TokenRow
  },
  mixins: [filterMixin, scannerMixin, filterAutoSaveMixin], // REFACTOR: Tambahkan filterAutoSaveMixin
  // Mendeklarasikan event yang akan di-emit ke parent (app.js)
  emits: ['show-toast', 'copy-to-clipboard'],

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
      searchQuery: '', // Search query untuk filter mixin
    };
  },

  computed: {
    // Mengakses data dari root instance (app.js)
    // REFAKTOR: Ganti this.$root dengan akses ke store Pinia
    filterSettings() {
      return this.$root.filterSettings; // SEBELUM: this.$root.filterSettings -> SESUDAH: this.filterStore.settings
    },
    filters() {
      return this.$root.filters; // SEBELUM: this.$root.filters -> SESUDAH: this.filterStore.filters
    },
    activeTab() {
      return this.$root.activeTab;
    },
    isScanning() {
      // REVISI: Gunakan `scanningInProgress` dari scannerMixin untuk status yang lebih akurat.
      // `this.scanningInProgress` akan disediakan oleh scannerMixin.
      return this.scanningInProgress;
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
        copyTokenAddress: token => this.copyTokenAddress(token),
        getChainId: chain => this.getChainId(chain), // REVISI: Teruskan method getChainId ke helper
        toggleTokenFavorit: token => this.toggleTokenFavorit(token),
        openChart: token => this.openChart(token),
        deleteToken: token => this.deleteToken(token)
      };
    },
    chainColorFn() {
      return (category, key, variant) => this.$root.getColorStyles(category, key, variant);
    }
  },

  methods: {
    // REFACTOR: Method saveFilter sekarang disediakan oleh filterAutoSaveMixin
    // Hapus method saveFilter yang lama yang memanggil this.$root.saveFilterChange

    async toggleScan() {
      if (this.isScanning) {
        console.log('🔴 Proses pemindaian dihentikan oleh pengguna.');
        this.stopScanning();
        this.filters.run = 'stop';
        this.saveFilter('run'); // REFACTOR: Gunakan method dari mixin
      } else {
        console.clear();
        console.log('🚀 Memulai proses pemindaian...');

        this.filters.run = 'run';
        this.saveFilter('run'); // REFACTOR: Gunakan method dari mixin

        try {
          await this.startScanning();
        } catch (error) {
          console.error('❌ Terjadi kesalahan pada tahap inisiasi:', error);
          this.filters.run = 'stop';
          this.saveFilter('run'); // REFACTOR: Gunakan method dari mixin
        }
      }
    },
    getTokenPrimaryCEX(token) {
      return token.cex_name || 'N/A';
    },

    // REVISI: Method baru untuk menangani hasil PNL dan menambahkannya ke kartu sinyal
    handlePnlForSignalCard(pnlData) {
      if (!pnlData || !pnlData.token || !pnlData.pnl) return;

      const { token, dexKey, pnl } = pnlData;

      const processDirection = (pnlDirection, direction) => {
        if (pnlDirection && pnlDirection.pnl > 0) {
          const signal = {
            id: `${token.id}-${dexKey}-${direction}`,
            pair: `${token.nama_token}/${token.nama_pair}`,
            dex: dexKey,
            pnl: pnlDirection.pnlPercent,
            direction: direction,
            time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
          };

          // Tambahkan sinyal ke awal array agar muncul di atas
          this.signals.unshift(signal);
        }
      };

      processDirection(pnl.cexToDex, 'CEX → DEX');
      processDirection(pnl.dexToCex, 'DEX → CEX');
    },

    async loadTokensFromDB() {
      if (!this.$root.activeChain) return;

      let chainsToLoad = [];
      if (this.$root.activeChain === 'multi') {
        chainsToLoad = this.$root.activeChains || [];
      } else {
        chainsToLoad = [this.$root.activeChain];
      }

      if (chainsToLoad.length === 0) {
        this.tokens = [];
        return;
      }

      let allTokens = [];
      for (const chainKey of chainsToLoad) {
        const storeName = DB.getStoreNameByChain('KOIN', chainKey);
        try {
          const chainTokens = await DB.getAllData(storeName);
          const validTokens = chainTokens.filter(t => t.id !== 'DATA_KOIN').map(t => ({ ...t, chain: t.chain || chainKey.toUpperCase() }));
          allTokens.push(...validTokens);
        } catch (error) {
          console.warn(`Gagal memuat token dari ${storeName}:`, error);
        }
      }
      this.tokens = allTokens;
    },
    // Method untuk mengubah arah sorting
    toggleSortDirection() {
      const newDirection = this.filterSettings.sortDirection === 'desc' ? 'asc' : 'desc';
      this.filterSettings.sortDirection = newDirection;
    },
    openTradeLink(result) {
      this.$emit('show-toast', `Membuka tautan perdagangan untuk ${result.token}/${result.pair}`, 'info');
    },
    copyAddress(address) {
      this.$emit('copy-to-clipboard', address, 'Alamat kontrak');
    },
    showCoinDetail(result) {
      this.$emit('show-toast', `Detail untuk ${result.token}:\nKontrak: ${result.sc_token}\nPnL: ${result.pnl}%`, 'info', 5000);
    },

    // --- LOGIKA DARI SIGNAL-CARDS ---
    // REVISI: Mengambil style langsung dari config untuk pewarnaan dinamis
    getDexHeaderStyles(dexKey) {
      const dexConfig = this.$root.config.DEXS[dexKey.toLowerCase()];
      const color = dexConfig ? dexConfig.WARNA : '#6c757d'; // Fallback ke warna abu-abu
      return {
        backgroundColor: color,
      };
    },
    getSignalsForDex(dexKey) {
      return this.signals.filter(signal => {
        return signal.dex && signal.dex.toLowerCase() === dexKey.toLowerCase();
      }).slice(0, 5);
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

      const sanitize = value => {
        if (!value) return '';
        return value.toString().replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      };

      const extractBase = () => {
        const sources = [
          token?.cex_ticker_token,
          token?.nama_token,
          symbol
        ];
        for (const candidate of sources) {
          if (!candidate) continue;
          const raw = candidate.toString().trim();
          if (!raw) continue;
          if (raw.includes('/')) {
            return raw.split('/')[0];
          }
          if (raw.includes('_')) {
            return raw.split('_')[0];
          }
          return raw;
        }
        return '';
      };

      const extractPair = () => {
        const sources = [
          token?.cex_ticker_pair,
          token?.nama_pair,
          symbol
        ];
        for (const candidate of sources) {
          if (!candidate) continue;
          const raw = candidate.toString().trim();
          if (!raw) continue;
          if (raw.includes('/')) {
            const parts = raw.split('/');
            return parts[parts.length - 1];
          }
          if (raw.includes('_')) {
            const parts = raw.split('_');
            return parts[parts.length - 1];
          }
          return raw;
        }
        return '';
      };

      const baseSymbol = sanitize(extractBase());
      const pairSymbol = sanitize(extractPair());

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
    copyTokenAddress(token) { // Menggunakan emit yang sudah ada
      const address = token.sc_token || token.sc_pair || '';
      if (!address) {
        this.$emit('show-toast', 'Alamat token tidak tersedia.', 'warning');
        return;
      }
      this.$emit('copy-to-clipboard', address, 'Alamat Kontrak');
    },
    async toggleTokenFavorit(token) {
      // Baca dari kedua properti untuk backward compatibility
      const currentFavorite = token.isFavorite || token.isFavorit || false;
      const newFavoriteStatus = !currentFavorite;
      
      // Update state lokal
      token.isFavorite = newFavoriteStatus;
      
      // Clone token dan bersihkan properti lama sebelum menyimpan
      let cleanToken = JSON.parse(JSON.stringify(token));
      cleanToken.isFavorite = newFavoriteStatus;
      delete cleanToken.isFavorit;

      // Simpan perubahan ke DB menggunakan repository
      // REVISI: Gunakan coinRepository
      const coinRepo = window.AppContainer.get('coinRepository');
      await coinRepo.save(cleanToken);
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
        this.$emit('show-toast', `Token ${token.from} dihapus`, 'danger');
      }
    }
  },

  // REFACTOR: Watcher untuk activeChain sekarang dihandle oleh filterAutoSaveMixin
  // Hanya perlu watch untuk reload tokens
  watch: {
    '$root.activeChain': {
      immediate: true, // Muat data saat komponen pertama kali dimuat
      handler() { this.loadTokensFromDB(); }
    },
    // REVISI: Tambahkan watcher untuk membersihkan hasil scan saat filter berubah
    // untuk mencegah tampilan data yang tidak relevan.
    filteredTokens: {
      handler(newTokens, oldTokens) {
        // Jika daftar token yang akan ditampilkan berubah, bersihkan hasil scan lama.
        if (this.scanResults && Object.keys(this.scanResults).length > 0) {
          console.log('Daftar token berubah, membersihkan hasil scan lama dari tampilan.');
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
      
      <!-- REFACTORED: Scanning Toolbar dengan layout Bootstrap yang lebih baik -->
      <div class="card card-body p-2 mb-3">
        <div class="row g-2 align-items-center">
          <div class="col-12 col-xl">
            <div class="row g-2 align-items-center">
              <div class="col-12 col-md-auto">
                <h6 class="mb-0 d-flex align-items-center gap-2">
                  <i class="bi bi-broadcast"></i>
                  Scanning Control
                </h6>
              </div>
              <!-- REVISI: Mengembalikan input pencarian -->
              <div class="col-12 col-sm-auto">
                <div class="input-group input-group-sm w-100" style="max-width: 220px;">
                  <span class="input-group-text">
                    <i class="bi bi-search"></i>
                  </span>
                  <input type="text" class="form-control" placeholder="Cari token..."
                         v-model="searchQuery">
                </div>
              </div>
              <div class="col-12 col-sm-auto">
                <label class="form-check form-check-inline mb-0 align-items-center d-flex gap-1">
                  <input class="form-check-input" type="checkbox" v-model="filters.favoritOnly" @change="saveFilter('favoritOnly')">
                  <span class="small fw-semibold text-warning"><i class="bi bi-star-fill"></i> Favorite</span>
                </label>
              </div>
              <div class="col-12 col-sm-auto">
                <div class="input-group input-group-sm w-100" style="max-width: 150px;">
                  <span class="input-group-text">
                    <i class="bi bi-percent"></i>
                  </span>
                  <input type="number" class="form-control" placeholder="Min PNL"
                         v-model.number="filters.minPnl" @change="saveFilter('minPnl')"
                         step="0.1" min="0">
                </div>
              </div>
              <div class="col-6 col-sm-auto">
                <div class="form-check form-switch" title="Toggle Autorun">
                  <input class="form-check-input" type="checkbox" role="switch" id="autorunSwitch" v-model="filters.autorun" @change="saveFilter('autorun')">
                  <label class="form-check-label small" for="autorunSwitch">Autorun</label>
                </div>
              </div>
              <div class="col-6 col-sm-auto">
                <div class="form-check form-switch" title="Toggle Autoscroll">
                  <input class="form-check-input" type="checkbox" role="switch" id="autoscrollSwitch" v-model="filters.autoscroll" @change="saveFilter('autoscroll')">
                  <label class="form-check-label small" for="autoscrollSwitch">Autoscroll</label>
                </div>
              </div>
            </div>
          </div>
          <div class="col-12 col-xl-auto">
            <div class="d-grid d-sm-inline-flex gap-2 justify-content-sm-end">
              <button class="btn btn-sm" 
                      :class="isScanning ? 'btn-danger' : 'btn-success'" 
                      @click="toggleScan"
                      :disabled="!isScanning && filteredTokens.length === 0"
                      title="Tombol aktif jika ada koin di tabel">
                <i :class="isScanning ? 'bi bi-stop-circle-fill' : 'bi bi-play-circle-fill'"></i> {{ isScanning ? 'Stop Scan' : 'Start Scan' }} 
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- PROGRESS BAR SCANNING -->
      <div class="card card-body p-3 mb-3" v-if="isScanning || scanProgress > 0">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div>
            <h6 class="mb-0">
              <i class="bi bi-hourglass-split me-2"></i>
              {{ scanStatusText }}
            </h6>
          </div>
          <div class="text-end">
            <span class="badge bg-primary">{{ scanProgress.toFixed(0) }}%</span>
            <span class="badge bg-secondary ms-2" v-if="currentBatch > 0">Batch {{ currentBatch }}/{{ totalBatches }}</span>
          </div>
        </div>
        <div class="progress" style="height: 28px;">
          <div class="progress-bar progress-bar-striped progress-bar-animated"
               :class="isScanning ? 'bg-success' : 'bg-primary'"
               role="progressbar"
               :style="{ width: scanProgress + '%' }"
               :aria-valuenow="scanProgress"
               aria-valuemin="0"
               aria-valuemax="100">
            <span class="fw-bold">
              {{ scanProgress.toFixed(1) }}%
              <span v-if="isScanning && currentProgressMessage" class="ms-2" style="font-size: 0.85em;">
                | {{ currentProgressMessage }}
              </span>
            </span>
          </div>
        </div>
        <div class="mt-2 small text-muted" v-if="scanStats.processedTokens > 0">
          <div class="row g-2">
            <div class="col-12 col-md-auto">
              <i class="bi bi-info-circle me-1"></i>
              <strong>Processed:</strong> {{ scanStats.processedTokens }}/{{ scanStats.totalTokens }} tokens
            </div>
            <div class="col-12 col-md-auto" v-if="scanStats.successCount > 0">
              <i class="bi bi-check-circle text-success me-1"></i>
              <strong>Success:</strong> {{ scanStats.successCount }}
            </div>
            <div class="col-12 col-md-auto" v-if="scanStats.errorCount > 0">
              <i class="bi bi-x-circle text-danger me-1"></i>
              <strong>Errors:</strong> {{ scanStats.errorCount }}
            </div>
            <div class="col-12 col-md-auto" v-if="scanStats.profitableSignals > 0">
              <i class="bi bi-graph-up-arrow text-warning me-1"></i>
              <strong>Signals:</strong> {{ scanStats.profitableSignals }}
            </div>
            <div class="col-12 col-md-auto" v-if="isScanning && estimatedTimeRemaining">
              <i class="bi bi-clock me-1"></i>
              <strong>ETA:</strong> {{ estimatedTimeRemaining }}
            </div>
          </div>
        </div>
      </div>

      <!-- TEMPLATE DARI SIGNAL-CARDS -->
      <!-- Responsive grid: 2 cols mobile, 3 cols tablet, 4 cols desktop, 5+ cols wide -->
      <div class="row g-2 mb-3" v-if="activeDexList.length > 0">
        <div v-for="dex in activeDexList" :key="dex.key" class="col-6 col-md-4 col-lg-3 col-xl">
          <!-- REVISI: Struktur kartu diubah untuk header berwarna -->
          <div class="card h-100 shadow-sm">
            <div class="card-header p-2 text-white" :style="getDexHeaderStyles(dex.key)">
              <h6 class="card-title text-center mb-0 fw-bold">{{ dex.name }}</h6>
            </div>
            <div class="card-body p-2">
              <div v-if="getSignalsForDex(dex.key).length > 0">
                <div v-for="signal in getSignalsForDex(dex.key)" :key="signal.pair" class="signal-item mb-1 p-1 rounded" :class="signal.pnl > 0 ? 'bg-success bg-opacity-10' : 'bg-danger bg-opacity-10'">
                  <div class="d-flex justify-content-between align-items-center">
                    <small class="fw-bold">{{ signal.pair }}</small>
                    <span class="badge" :class="signal.pnl > 0 ? 'bg-success' : 'bg-danger'">
                      {{ signal.pnl > 0 ? '+' : '' }}{{ signal.pnl.toFixed(1) }}%
                    </span>
                  </div>
                  <div class="text-muted" style="font-size: 0.7rem;">{{ signal.time }}</div>
                </div>
              </div>
              <div v-else class="text-center text-muted py-3"><small>No signals</small></div>
            </div>
          </div>
        </div>
      </div>

      <!-- TEMPLATE DARI SCANNING-TABLE -->
      <div class="table-responsive" style="max-height: calc(100vh - 300px);">
        <table class="table table-sm table-hover align-middle">
          <thead class="sticky-top">
            <tr class="text-center" :style="$root.getColorStyles('chain', $root.activeChain, 'solid')">
              <th class="text-dark fw-bold">ORDERBOOK</th>
              <th v-for="dex in activeDexList" :key="'left-' + dex.key" class="text-dark fw-bold">{{ dex.name }}</th>
              <th class="text-dark fw-bold" style="cursor: pointer;" @click="toggleSortDirection">
                DETAIL TOKEN
                <i class="bi" :class="{
                  'bi-arrow-down': filterSettings.sortDirection === 'desc',
                  'bi-arrow-up': filterSettings.sortDirection === 'asc',
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
              v-for="(token, index) in filteredTokens"
              :key="token.id"
              :token="token"
              :index="index"
              :active-dex-list="activeDexList"
              :scan-result="scanResults[token.id] || null"
              :helpers="tokenRowHelpers"
              :usdt-rate="$root.globalSettings?.usdtRate || 15800"
              :modal-usd="$root.globalSettings?.modalUsd || 0"
              :is-scan-running="isScanning"
              :chain-colors="chainColorFn"
            ></token-row>
          </tbody>
        </table>
      </div>
    </div>
  `
};
