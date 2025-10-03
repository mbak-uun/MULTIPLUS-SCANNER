// components/tabs/scanning-tab.js
// Komponen Vue mandiri untuk Tab Scanning

// REVISI: Komponen ini digabungkan kembali menjadi satu unit mandiri
// untuk menyederhanakan alur data dan memperbaiki fungsionalitas.
const ScanningTab = {
  name: 'ScanningTab',
  components: {
    'scanning-filter-bar': ScanningFilterBar,
  },
  // Mendeklarasikan event yang akan di-emit ke parent (app.js)
  emits: ['show-toast', 'copy-to-clipboard'],

  // Logika dari scanning.js dipindahkan ke sini
  data() {
    return {
      // Data 'tokens' sekarang akan dimuat dari IndexedDB, bukan dummy data.
      tokens: [],
      // REVISI: Data sampel untuk sinyal dan statistik dihapus.
      // Data ini akan diisi oleh logika pemindaian di masa mendatang.
      signals: [],
      scanStats: {
        totalCoins: 0,
        successCount: 0,
        avgResponseTime: 0
      },
    };
  },

  computed: {
    // Mengakses data dari root instance (app.js)
    filterSettings() {
      return this.$root.filterSettings; // Tetap ada untuk sorting direction
    },
    filters() {
      return this.$root.filters; // Gunakan ini untuk filtering
    },
    activeTab() {
      return this.$root.activeTab;
    },
    isScanning() {
      return this.filterSettings && this.filterSettings.run === 'run';
    },
    lastScanTime() {
        return this.$root.lastScanTime;
    },
    // Mengambil daftar DEX yang aktif dari root instance
    activeDexList() {
      // REVISI: Menggunakan filterSettings.dex sebagai sumber data yang benar.
      // REVISI 2: Gunakan this.filters.dex agar reaktif terhadap UI.
      if (!this.filters || !this.filters.dex) return [];

      return Object.keys(this.filters.dex)
        // 1. Filter hanya DEX yang dicentang (statusnya true)
        .filter(dexKey => this.filters.dex[dexKey])
        // 2. Ubah format agar sesuai dengan yang dibutuhkan template
        .map(dexKey => ({ key: dexKey, name: dexKey.toUpperCase() }));
    },

    // --- LOGIKA DARI SCANNING-TABLE ---
    columnCount() {
      // 1 (orderbook kiri) + activeDex*2 + 1 (detail) + 1 (orderbook kanan)
      return 1 + (this.activeDexList.length * 2) + 1 + 1;
    },
    filteredTokens() {
      if (!this.tokens || !this.filters) return [];

      let filtered = [...this.tokens];
      console.log(`[Scanning] 1. Initial tokens (${this.$root.activeChain}):`, filtered.length, JSON.parse(JSON.stringify(filtered)));

      // 1. Terapkan filter favorit (support both isFavorite dan isFavorit untuk backward compatibility)
      if (this.filters.favoritOnly) { // REVISI: Gunakan this.filters
        filtered = filtered.filter(token => token.isFavorite || token.isFavorit);
      }

      console.log('[Scanning] 2. After favorite filter:', filtered.length);

      // 2. Terapkan filter chain
      if (this.$root.activeChain === 'multi' && this.filters.chains) { // REVISI: Gunakan this.filters
        const activeChains = Object.keys(this.filters.chains).filter(
          chain => this.filters.chains[chain] === true
        );
        if (activeChains.length > 0) {
          filtered = filtered.filter(token =>
            activeChains.includes(token.chain.toLowerCase())
          );
        }
      } else if (this.$root.activeChain !== 'multi') {
        filtered = filtered.filter(token => token.chain.toLowerCase() === this.$root.activeChain);
      }

      console.log('[Scanning] 3. After chain filter:', filtered.length);

      // 3. Terapkan filter CEX (menggunakan skema nested token.cex)
      if (this.filters.cex) { // REVISI: Gunakan this.filters
        const activeCex = Object.keys(this.filters.cex).filter(
          cex => this.filters.cex[cex] === true
        );
        if (activeCex.length > 0) {
          filtered = filtered.filter(token => {
            const tokenCexList = this.getTokenCEXList(token);
            // REVISI: Ubah kedua sisi menjadi lowercase untuk perbandingan yang konsisten.
            const lowerActiveCex = activeCex.map(c => c.toLowerCase());
            return tokenCexList.some(cexKey =>
              lowerActiveCex.includes(cexKey.toLowerCase())
            );
          });
        }
      }

      console.log('[Scanning] 4. After CEX filter:', filtered.length);

      // 4. Terapkan pengurutan (sorting)
      if (this.filterSettings.sortDirection === 'asc') { // Sorting tetap dari filterSettings
        filtered.sort((a, b) => (a.from || a.nama_koin).localeCompare(b.from || a.nama_koin));
      } else { // 'desc'
        filtered.sort((a, b) => (b.from || b.nama_koin).localeCompare(a.from || a.nama_koin));
      }

      console.log('[Scanning] 5. Final sorted tokens:', filtered.length, JSON.parse(JSON.stringify(filtered)));

      return filtered;
    },

    scanStatusText() {
      if (this.isScanning) { // isScanning sudah computed property
        return `Memindai...`;
      }
      // REVISI: Menggunakan lastScanTime dari root
      return this.lastScanTime
        ? `Last scan completed at ${new Date(this.lastScanTime).toLocaleTimeString()}`
        : 'Ready to scan';
    }
  },

  methods: {
    // --- HELPER METHOD UNTUK EXTRACT DATA DARI SKEMA NESTED ---
    getTokenCEXList(token) {
      // Ambil list CEX dari object token.cex
      if (!token.cex || typeof token.cex !== 'object') return [];
      return Object.keys(token.cex);
    },
    getTokenPrimaryCEX(token) {
      // Ambil CEX pertama dari object token.cex
      const cexList = this.getTokenCEXList(token);
      return cexList.length > 0 ? cexList[0] : null;
    },
    getTokenCEXData(token, cexKey) {
      // Ambil data CEX tertentu dari token
      if (!token.cex || !token.cex[cexKey]) return null;
      return token.cex[cexKey];
    },

    // --- METHOD UNTUK MEMUAT DATA DARI DB ---
    async loadTokensFromDB() {
      if (!this.$root.activeChain) return;
      console.log(`Memuat token untuk tab scanning (Chain: ${this.$root.activeChain})...`);

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
          // Filter record 'DATA_KOIN' dan tambahkan properti 'chain' jika belum ada
          const validTokens = chainTokens.filter(t => t.id !== 'DATA_KOIN').map(t => ({ ...t, chain: t.chain || chainKey.toUpperCase() }));
          allTokens.push(...validTokens);
        } catch (error) {
          console.warn(`Gagal memuat token dari ${storeName}:`, error);
        }
      }
      this.tokens = allTokens;

      // TAMPILKAN DATA KOIN DALAM CONSOLE TABLE
      console.log(`\n========== DATA KOIN TAB SCANNING (${this.$root.activeChain.toUpperCase()}) ==========`);
      console.log(`Total tokens loaded: ${allTokens.length}`);

      if (allTokens.length > 0) {
        // Format data untuk console.table
        const tableData = allTokens.map((token, index) => {
          // Extract CEX list
          const cexList = token.cex ? Object.keys(token.cex).join(', ') : 'N/A';
          // Extract DEX list
          const dexList = token.dex ? Object.keys(token.dex).filter(dex => token.dex[dex].status).join(', ') : 'N/A';
          // Get primary CEX data
          const primaryCex = token.cex ? Object.keys(token.cex)[0] : null;
          const cexData = primaryCex ? token.cex[primaryCex] : null;

          return {
            '#': index + 1,
            'Chain': token.chain,
            'Nama Koin': token.nama_koin || 'N/A',
            'Token': token.nama_token || 'N/A',
            'Pair': token.nama_pair || 'N/A',
            'CEX': cexList,
            'DEX': dexList,
            'Favorit': token.isFavorite || token.isFavorit ? '⭐' : '-',
            'Status': token.status ? '✓' : '✗',
            'Deposit': cexData?.depositToken ? '✓' : '✗',
            'Withdraw': cexData?.withdrawToken ? '✓' : '✗'
          };
        });

        console.table(tableData);

        // Tampilkan detail lengkap 3 token pertama
        console.log('\n========== DETAIL 3 TOKEN PERTAMA ==========');
        allTokens.slice(0, 3).forEach((token, idx) => {
          console.log(`\n--- Token #${idx + 1}: ${token.nama_token}/${token.nama_pair} ---`);
          console.log('ID:', token.id);
          console.log('Chain:', token.chain);
          console.log('Nama Koin:', token.nama_koin);
          console.log('Smart Contract Token:', token.sc_token);
          console.log('Decimals Token:', token.des_token);
          console.log('Smart Contract Pair:', token.sc_pair);
          console.log('Decimals Pair:', token.des_pair);
          console.log('CEX Config:', JSON.stringify(token.cex, null, 2));
          console.log('DEX Config:', JSON.stringify(token.dex, null, 2));
          console.log('Created At:', token.createdAt);
          console.log('Updated At:', token.updatedAt);
        });
      } else {
        console.warn('⚠️ Tidak ada data token yang dimuat!');
      }
      console.log('========================================\n');
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
    getDexCardClass(dexKey) {
      const colorMap = {
        'okxdex': 'border-warning', 'dzap': 'border-warning', 'kyber': 'border-warning',
        'odos': 'border-warning', '0x': 'border-warning', 'para': 'border-warning'
      };
      return colorMap[dexKey] || 'border-secondary';
    },
    getSignalsForDex(dexKey) {
      return this.signals.filter(signal => {
        return signal.dex && signal.dex.toLowerCase() === dexKey.toLowerCase();
      }).slice(0, 5);
    },

    // --- LOGIKA DARI SCANNING-TABLE ---
    getTokenCexStatus(token, cexKey) {
      const cexData = token.cex && token.cex[cexKey.toUpperCase()];
      if (!cexData) return { deposit: false, withdraw: false };
      return {
        deposit: cexData.depositToken,
        withdraw: cexData.withdrawToken
      };
    },
    // REVISI: Tambahkan fungsi baru untuk mendapatkan status PAIR secara spesifik.
    getTokenPairCexStatus(token, cexKey) {
      const cexData = token.cex && token.cex[cexKey.toUpperCase()];
      if (!cexData) return { deposit: false, withdraw: false };
      // Baca field depositPair dan withdrawPair dari skema.
      return {
        deposit: cexData.depositPair,
        withdraw: cexData.withdrawPair
      };
    },

    // === HELPER FUNCTIONS UNTUK GENERATE LINK ===

    // Generate link trade CEX untuk token/pair
    getCexTradeLink(token, symbol) {
      const cexKey = this.getTokenPrimaryCEX(token);
      if (!cexKey) return '#';

      const cexConfig = this.$root.config?.CEX?.[cexKey.toUpperCase()];
      if (!cexConfig || !cexConfig.URLS) return '#';

      // Tentukan template URL yang akan digunakan
      // Jika simbol yang dikirim adalah nama_token, gunakan TRADE_TOKEN.
      // Jika bukan, asumsikan itu adalah pair dan gunakan TRADE_PAIR.
      const isMainToken = symbol.toUpperCase() === (token.nama_token || '').toUpperCase();
      const urlTemplate = isMainToken ? cexConfig.URLS.TRADE_TOKEN : cexConfig.URLS.TRADE_PAIR;

      if (!urlTemplate) return '#';

      // Ganti placeholder di template URL
      let finalUrl = urlTemplate
        .replace('{token}', token.nama_token || '')
        .replace('{pair}', token.nama_pair || '');

      return finalUrl;
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
    getCexDepositLink(token) {
      const cexKey = this.getTokenPrimaryCEX(token);
      if (!cexKey) return '#';

      const cexConfig = this.$root.config?.CEX?.[cexKey.toUpperCase()];
      const urlTemplate = cexConfig?.URLS?.DEPOSIT;

      if (!urlTemplate) return '#';

      // Ganti placeholder {token} dan {pair}
      return urlTemplate
        .replace('{token}', token.nama_token || '')
        .replace('{pair}', token.nama_pair || '');
    },

    // Generate link withdraw CEX
    getCexWithdrawLink(token) {
      const cexKey = this.getTokenPrimaryCEX(token);
      if (!cexKey) return '#';

      const cexConfig = this.$root.config?.CEX?.[cexKey.toUpperCase()];
      const urlTemplate = cexConfig?.URLS?.WITHDRAW;

      if (!urlTemplate) return '#';

      return urlTemplate
        .replace('{token}', token.nama_token || '')
        .replace('{pair}', token.nama_pair || '');
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
      const chainIds = {
        'bsc': '56',
        'polygon': '137',
        'arbitrum': '42161',
        'base': '8453',
        'ethereum': '1',
        'eth': '1'
      };
      return chainIds[chain.toLowerCase()] || '1';
    },
    // --- END LOGIKA DARI SCANNING-TABLE ---
    // Helper untuk mendapatkan warna CEX
    getCexColorStyles(cexKey, variant) {
      return this.$root.getColorStyles('cex', cexKey, variant);
    },

    getWXBadgeClass(token, type) {
      const wx = type === 'from' ? token.fromWX : token.toWX;
      if (wx === 'WX') return 'bg-danger';
      if (wx === 'WD') return 'bg-warning text-dark';
      return 'bg-secondary';
    },
    getDexLeft(token, dexKey) {
      // Cek apakah dex ada dan aktif
      if (!token.dex || !token.dex[dexKey]) return null;
      return token.dex[dexKey].left || 0;
    },
    getDexRight(token, dexKey) {
      // Cek apakah dex ada dan aktif
      if (!token.dex || !token.dex[dexKey]) return null;
      return token.dex[dexKey].right || 0;
    },
    isDexActive(token, dexKey) {
      // Cek apakah DEX aktif untuk token ini
      if (!token.dex || !token.dex[dexKey]) return false;
      return token.dex[dexKey].status === true;
    },
    openOrderbook(token, side) {
      this.$emit('show-toast', `Membuka orderbook ${side} untuk ${token.from}`, 'info');
    },
    copyTokenAddress(token) { // Menggunakan emit yang sudah ada
      this.$emit('copy-to-clipboard', `Address for ${token.from}`, 'Alamat Kontrak');
    },
    async toggleTokenFavorit(token) {
      // Support both isFavorite dan isFavorit
      const currentFavorite = token.isFavorite || token.isFavorit || false;
      const newFavoriteStatus = !currentFavorite;
      token.isFavorite = newFavoriteStatus;
      // Sync field lama untuk backward compatibility jika ada
      if (token.hasOwnProperty('isFavorit')) {
        token.isFavorit = newFavoriteStatus;
      }
      // Simpan perubahan ke DB
      const storeName = DB.getStoreNameByChain('KOIN', token.chain);
      await DB.saveData(storeName, token);
      this.$emit('show-toast', `${token.nama_koin || token.from} ${newFavoriteStatus ? 'ditambahkan ke' : 'dihapus dari'} favorit`, 'success');
    },
    openChart(token) {
      this.$emit('show-toast', `Membuka chart untuk ${token.from}`, 'info');
    },
    async deleteToken(token) {
      if (confirm(`Anda yakin ingin menghapus token ${token.nama_koin || token.from}?`)) {
        // Hapus dari state lokal
        this.tokens = this.tokens.filter(t => t.id !== token.id);
        // Hapus dari DB
        const storeName = DB.getStoreNameByChain('KOIN', token.chain);
        await DB.deleteData(storeName, token.id); // Asumsi DB.deleteData sudah ada
        this.$emit('show-toast', `Token ${token.from} dihapus`, 'danger');
      }
    }
  },

  // REVISI: Tambahkan watcher dan activated hook agar data dimuat ulang saat chain berubah atau tab aktif.
  watch: {
    '$root.activeChain': {
      immediate: true, // Muat data saat komponen pertama kali dimuat
      handler() { this.loadTokensFromDB(); }
    }
  },
  activated() {
    // Muat ulang data setiap kali tab ini menjadi aktif
    console.log('Scanning tab activated, reloading tokens...');
    this.loadTokensFromDB();
  },

  // REVISI: Template digabungkan menjadi satu.
  template: `
    <div class="scanning-tab">
      <!-- Bar Kontrol dan Filter -->
      <div class="card mb-3">
        <div class="card-body p-0">
          <!-- FIX: Memanggil komponen filter bar yang benar untuk tab scanning -->
          <!-- Komponen ini sudah memiliki card-nya sendiri, jadi kita tidak perlu membungkusnya lagi -->
          <scanning-filter-bar></scanning-filter-bar>
        </div>
      </div>

      <!-- TEMPLATE DARI SIGNAL-CARDS -->
      <!-- REVISI: Menghapus kelas row-cols-* agar lebar kolom diatur secara otomatis oleh flexbox -->
      <div class="row g-2 mb-3">
        <div v-for="dex in activeDexList" :key="dex.key" class="col">
          <div class="card h-100" :class="getDexCardClass(dex.key)">
            <div class="card-body p-2">
              <h6 class="card-title text-center mb-2 fw-bold">{{ dex.name }}</h6>
              <div v-if="getSignalsForDex(dex.key).length > 0" class="signals-list">
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
      <div class="table-responsive">
        <table class="table table-sm table-hover align-middle">
          <thead class="sticky-top">
            <tr class="text-center" style="background-color: var(--bs-warning);">
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
                <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                <span>Tidak ada data token. Silakan tambahkan di menu Manajemen Koin.</span>
              </td>
            </tr>
            <tr v-for="token in filteredTokens" :key="token.id" class="token-row">
              <td class="text-center">
                <a href="#" @click.prevent="openOrderbook(token, 'left')" 
                   class="text-decoration-none" 
                   :style="getCexColorStyles(getTokenPrimaryCEX(token), 'solid')"
                   :title="'Orderbook ' + getTokenPrimaryCEX(token)">
                  {{ getTokenPrimaryCEX(token) }}
                </a>
              </td>
              <td v-for="dex in activeDexList" :key="'left-' + dex.key + '-' + token.id" class="text-center">
                <div v-if="isDexActive(token, dex.key)">
                  <div class="small fw-semibold text-success">\${{ getDexLeft(token, dex.key) || 0 }}</div>
                </div>
                <div v-else class="small text-muted">-</div>
              </td>
              <td class="token-detail">
                <div class="d-flex flex-column align-items-center">
                  <!-- Header: Nomor urutan + Token/Pair (CLICKABLE LINK) -->
                  <div class="mb-1">
                    <span class="badge bg-secondary me-1">[{{ filteredTokens.indexOf(token) + 1 }}]</span>
                    <a :href="getCexTradeLink(token, token.nama_token)" target="_blank" class="fw-bold text-primary text-decoration-none" :title="'Trade ' + token.nama_token + ' di ' + getTokenPrimaryCEX(token)">
                      {{ token.nama_token }}
                    </a>
                    <i class="bi bi-arrow-left-right mx-1"></i>
                    <a v-if="token.nama_pair !== 'USDT'" :href="getCexTradeLink(token, token.nama_pair)" target="_blank" class="fw-bold text-warning text-decoration-none" :title="'Trade ' + token.nama_pair + ' di ' + getTokenPrimaryCEX(token)">
                      {{ token.nama_pair }}
                    </a>
                    <span v-else class="fw-bold text-warning">{{ token.nama_pair }}</span>
                  </div>

                  <!-- Baris 2: CEX on Chain + Status badges -->
                  <div class="small mb-1">
                    <span class="badge bg-warning text-dark me-1">{{ getTokenPrimaryCEX(token) || 'N/A' }}</span>
                    <span class="text-muted">on</span>
                    <span class="badge bg-secondary ms-1">{{ token.chain.toUpperCase() }}</span>
                  </div>

                  <!-- Baris 3: Status WD/Depo TOKEN + Badges (CLICKABLE) -->
                  <div class="mb-1 small">
                    <a :href="getExplorerLink(token, token.sc_token)" target="_blank" class="fw-semibold me-1 text-decoration-none" :title="'Explorer: ' + token.nama_koin">
                      {{ token.nama_koin }}
                    </a>
                    <a v-if="getTokenPrimaryCEX(token)"
                          :href="getCexWithdrawLink(token)" target="_blank"
                          class="badge me-1 text-decoration-none small"
                          :class="getTokenCexStatus(token, getTokenPrimaryCEX(token)).withdraw ? 'bg-success' : 'bg-danger'"
                          :title="'Withdraw ' + token.nama_token">
                      WD
                    </a>
                    <a v-if="getTokenPrimaryCEX(token)"
                          :href="getCexDepositLink(token)" target="_blank"
                          class="badge me-1 text-decoration-none small"
                          :class="getTokenCexStatus(token, getTokenPrimaryCEX(token)).deposit ? 'bg-success' : 'bg-danger'"
                          :title="'Deposit ' + token.nama_token">
                      DP
                    </a>
                    <a :href="getCexWalletBalanceLink(token, token.sc_token, 1)" target="_blank" class="badge bg-info text-dark me-1 text-decoration-none small" :title="'Cek Saldo ' + token.nama_token + ' di Wallet ' + getTokenPrimaryCEX(token) + ' #1'">
                      <i class="bi bi-wallet2"></i>
                    </a>
                  </div>

                  <!-- Baris 4: Status WD/Depo PAIR + Badges (CLICKABLE) -->
                  <div class="mb-2 small">
                    <a :href="getExplorerLink(token, token.sc_pair)" target="_blank" class="fw-semibold me-1 text-decoration-none" :title="'Explorer: ' + token.nama_pair">
                      {{ token.nama_pair }}
                    </a>
                    <a v-if="getTokenPrimaryCEX(token)"
                          :href="getCexWithdrawLink(token)" target="_blank"
                          class="badge me-1 text-decoration-none small"
                          :class="getTokenPairCexStatus(token, getTokenPrimaryCEX(token)).withdraw ? 'bg-success' : 'bg-danger'"
                          :title="'Withdraw ' + token.nama_pair">
                      WD
                    </a>
                    <a v-if="getTokenPrimaryCEX(token)"
                          :href="getCexDepositLink(token)" target="_blank"
                          class="badge me-1 text-decoration-none small"
                          :class="getTokenPairCexStatus(token, getTokenPrimaryCEX(token)).deposit ? 'bg-success' : 'bg-danger'"
                          :title="'Deposit ' + token.nama_pair">
                      DP
                    </a>
                    <a :href="getCexWalletBalanceLink(token, token.sc_pair, 1)" target="_blank" class="badge bg-info text-dark me-1 text-decoration-none small" :title="'Cek Saldo ' + token.nama_pair + ' di Wallet ' + getTokenPrimaryCEX(token) + ' #1'">
                      <i class="bi bi-wallet2"></i>
                    </a>
                  </div>

                  <!-- Baris 5: Hashtags DEX Alternatif (CLICKABLE LINK) -->
                  <div class="small mb-1">
                    <a :href="getDexAggregatorLink(token, 'UNX')" target="_blank" class="badge bg-light text-dark border  text-decoration-none" title="Swap di Unidex">
                      #UNX
                    </a>
                    <a :href="getDexAggregatorLink(token, 'OKX')" target="_blank" class="badge bg-light text-dark border text-decoration-none" title="Swap di OKX DEX">
                      #OKX
                    </a>
                    <a :href="getDexAggregatorLink(token, 'DFL')" target="_blank" class="badge bg-light text-dark border  text-decoration-none" title="Swap di DefiLlama">
                      #DFL
                    </a>
                    <a :href="getDexAggregatorLink(token, 'JMX')" target="_blank" class="badge bg-light text-dark border  text-decoration-none" title="Swap di Jumper Exchange">
                      #JMX
                    </a>
                  </div>

                  <!-- Baris 6: Action buttons -->
                  <div class="btn-group btn-group-sm" role="group">
                    <button class="btn btn-outline-secondary" @click="copyTokenAddress(token)" title="Copy Address"><i class="bi bi-clipboard"></i></button>
                    <button class="btn" :class="(token.isFavorite || token.isFavorit) ? 'btn-warning' : 'btn-outline-secondary'" @click="toggleTokenFavorit(token)" title="Toggle Favorit"><i class="bi bi-star-fill"></i></button>
                    <button class="btn btn-outline-success" @click="openChart(token)" title="Open Chart"><i class="bi bi-graph-up"></i></button>
                    <button class="btn btn-outline-danger" @click="deleteToken(token)" title="Delete"><i class="bi bi-trash"></i></button>
                  </div>
                </div>
              </td>
              <td v-for="dex in activeDexList" :key="'right-' + dex.key + '-' + token.id" class="text-center">
                <div v-if="isDexActive(token, dex.key)">
                  <div class="small fw-semibold text-warning">\${{ getDexRight(token, dex.key) || 0 }}</div>
                </div>
                <div v-else class="small text-muted">-</div>
              </td>
              <td class="text-center">
                <a href="#" @click.prevent="openOrderbook(token, 'right')" 
                   class="text-decoration-none" 
                   :style="getCexColorStyles(getTokenPrimaryCEX(token), 'solid')"
                   :title="'Orderbook ' + getTokenPrimaryCEX(token)">
                  {{ getTokenPrimaryCEX(token) }}
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
};
