// components/tabs/wallet-tab.js

const WalletTab = {
  name: 'WalletTab',
  emits: ['show-toast', 'copy-to-clipboard'],

  data() {
    return {
      walletStatusMessage: 'Siap cek dompet',
      selectedCEXs: [],
      isChecking: false,
      fetchProgress: 0,
      fetchedCoinData: {} // { CEX_KEY: { count: Number, error: String, disabledCoins: Array } }
    };
  },

  computed: {
    activeChain() { return this.$root.activeChain; },
    cexConfig() { return this.$root?.config?.CEX || {}; },
    chainConfig() { return this.$root?.config?.CHAINS || {}; },
    globalSettings() { return this.$root?.globalSettings || null; },

    // Daftar CEX yang aktif dari SETTING_GLOBAL
    activeCEXKeys() {
      if (!this.globalSettings || !this.globalSettings.config_cex) {
        return [];
      }
      return Object.keys(this.globalSettings.config_cex)
        .filter(key => this.globalSettings.config_cex[key].status);
    },

    chainKeysToShow() {
      if (this.activeChain === 'multi') {
        return Object.keys(this.chainConfig);
      }
      return this.chainConfig[this.activeChain] ? [this.activeChain] : [];
    },

    walletCards() {
      const chainKeys = this.chainKeysToShow;
      const chainConfig = this.chainConfig;

      // REVISI: Hanya tampilkan CEX yang aktif di SETTING_GLOBAL
      return this.activeCEXKeys.map(cexKey => {
        const cexData = this.cexConfig[cexKey];
        if (!cexData) return null;

        const chainEntries = chainKeys.reduce((entries, chainKey) => {
          const walletInfo = cexData.WALLETS?.[chainKey];
          if (!walletInfo) return entries;

          const addresses = Object.entries(walletInfo)
            .filter(([, value]) => typeof value === 'string' && value.trim() !== '')
            .map(([addressKey, value]) => ({
              key: `${chainKey}-${addressKey}`,
              label: this.formatAddressLabel(addressKey),
              address: value.trim()
            }));

          if (addresses.length === 0) return entries;

          entries.push({
            chainKey,
            chainLabel: chainConfig[chainKey]?.NAMA_CHAIN?.toUpperCase() || chainKey.toUpperCase(),
            addresses
          });
          return entries;
        }, []);

        return {
          key: cexKey,
          label: cexKey,
          displayName: cexKey.toUpperCase(),
          chainEntries
        };
      }).filter(card => card && card.chainEntries.length > 0);
    },
    totalSelected() { return this.selectedCEXs.length; }
  },

  watch: {
    walletCards: {
      immediate: true,
      handler(cards) {
        const availableKeys = cards.map(card => card.key);
        this.selectedCEXs = this.selectedCEXs.filter(key => availableKeys.includes(key));
      }
    },
    activeChain() {
      this.walletStatusMessage = 'Siap cek dompet';
      this.fetchedCoinData = {}; // Reset hasil saat ganti chain
    }
  },

  methods: {
    formatAddressLabel(rawKey) {
      if (!rawKey) return 'ADDRESS';
      const key = rawKey.toString();
      if (key.toLowerCase().startsWith('address')) {
        const suffix = key.slice(7);
        return `ADDRESS${suffix ? suffix.toUpperCase() : ''}`;
      }
      return key.toUpperCase();
    },
    getCexBadgeStyle(cexKey) {
      if (!this.$root?.getColorInfo) return {};
      const info = this.$root.getColorInfo('cex', cexKey);
      return {
        backgroundColor: info.color,
        color: info.contrast,
        borderColor: info.color
      };
    },
    getChainBadgeStyle(chainKey) {
      if (!this.$root?.getColorInfo) return {};
      const info = this.$root.getColorInfo('chain', chainKey);
      return {
        backgroundColor: `rgba(${info.rgb}, 0.18)`,
        color: info.color,
        borderColor: `rgba(${info.rgb}, 0.35)`
      };
    },
    getAddressPillStyle(chainKey) {
      if (!this.$root?.getColorInfo) return {};
      const info = this.$root.getColorInfo('chain', chainKey);
      return {
        backgroundColor: `rgba(${info.rgb}, 0.12)`,
        borderColor: `rgba(${info.rgb}, 0.28)`,
        color: info.color
      };
    },
    copyAddress(address) { this.$emit('copy-to-clipboard', address, 'Alamat'); },

    // Helper untuk normalisasi status (diambil dari sync-tab.js)
    normalizeFlag(value) {
      if (typeof value === 'boolean') return value;
      if (value === null || value === undefined) return false;
      const text = String(value).trim().toUpperCase();
      return ['ON', 'YES', 'TRUE', 'AKTIF', 'Y', '1'].includes(text);
    },
    hasDeposit(item) {
      if (Array.isArray(item.networks) && item.networks.length) {
        return item.networks.some(net => this.normalizeFlag(net.deposit));
      }
      return this.normalizeFlag(item.deposit);
    },
    hasWithdraw(item) {
      if (Array.isArray(item.networks) && item.networks.length) {
        return item.networks.some(net => this.normalizeFlag(net.withdraw));
      }
      return this.normalizeFlag(item.withdraw);
    },
    // Build secrets object dari config CEX
    buildSecretsFromConfig() {
      const secrets = {};
      const cexConfig = this.cexConfig;

      Object.keys(cexConfig).forEach(cexKey => {
        const cex = cexConfig[cexKey];
        if (cex && cex.DATA_API) {
          // DATA_API bisa berupa object atau array
          const apiData = Array.isArray(cex.DATA_API) ? cex.DATA_API[0] : cex.DATA_API;

          if (apiData) {
            // Format sesuai yang diharapkan CheckWalletExchanger (PascalCase)
            secrets[cexKey.toUpperCase()] = {
              ApiKey: apiData.API_KEY || apiData.API_KEY_OKX || null,
              ApiSecret: apiData.API_SECRET || apiData.SECRET_KEY_OKX || null,
              Passphrase: apiData.PASSPHRASE || apiData.PASSPHRASE_OKX || null
            };
          }
        }
      });

      return secrets;
    },
    async handleCheckWallets() {
      if (this.totalSelected === 0) {
        this.$emit('show-toast', 'Pilih exchanger terlebih dahulu.', 'warning');
        return;
      }

      if (!window.CheckWalletExchanger) {
        this.$emit('show-toast', 'Modul CheckWalletExchanger tidak ditemukan.', 'danger');
        return;
      }

      this.isChecking = true;
      this.fetchProgress = 0;
      this.fetchedCoinData = {}; // Kosongkan hasil sebelumnya
      const names = this.selectedCEXs.map(key => key.toUpperCase()).join(', ');
      const totalCEX = this.selectedCEXs.length;
      this.walletStatusMessage = `Mengecek: ${names}...`;
      this.$emit('show-toast', `Memulai pengecekan data koin untuk: ${names}`, 'info');

      // Build secrets object dari config CEX
      const secrets = this.buildSecretsFromConfig();
      const fetcher = new CheckWalletExchanger(secrets, this.$root.config, window.Http);
      const storeName = DB.getStoreNameByChain('KOIN', this.activeChain);

      for (let i = 0; i < this.selectedCEXs.length; i++) {
        const cex = this.selectedCEXs[i];
        try {
          // 1. Fetch coin list dari CEX
          this.walletStatusMessage = `Mengambil data dari ${cex}... (${i + 1}/${totalCEX})`;
          this.fetchProgress = Math.round(((i / totalCEX) * 100));
          const coinList = await fetcher.fetchCoinList(cex, this.activeChain);

          // 2. Load semua koin dari tabel KOIN
          this.walletStatusMessage = `Memeriksa tabel KOIN_${this.activeChain}... (${i + 1}/${totalCEX})`;
          this.fetchProgress = Math.round(((i + 0.3) / totalCEX) * 100);
          const allCoinsInDB = await DB.getAllData(storeName);
          const coinsByKey = new Map();

          // Build index: key = "cex|sc_token" atau "cex|symbol" (menggunakan skema nested)
          allCoinsInDB.forEach(coin => {
            if (coin.id === 'DATA_KOIN') return; // Skip snapshot

            // Extract CEX dari nested structure
            const cexList = coin.cex && typeof coin.cex === 'object' ? Object.keys(coin.cex) : [];
            const chain = String(coin.chain || this.activeChain).toUpperCase();
            const sc = String(coin.sc_token || coin.sc || '').toLowerCase();
            const symbol = String(coin.nama_token || '').toUpperCase();

            // Buat index untuk setiap CEX yang ada di token
            cexList.forEach(upperCex => {
              if (sc) {
                coinsByKey.set(`${upperCex.toUpperCase()}|${chain}|${sc}`, coin);
              }
              coinsByKey.set(`${upperCex.toUpperCase()}|${chain}|${symbol}`, coin);
            });
          });

          // 3. Proses setiap koin dari CEX
          this.walletStatusMessage = `Memproses ${coinList.length} koin dari ${cex}... (${i + 1}/${totalCEX})`;
          this.fetchProgress = Math.round(((i + 0.5) / totalCEX) * 100);
          let updatedCount = 0;
          const coinsInDB = []; // Semua koin yang ada di DB
          const problematicCoins = []; // Koin yang ada di DB dan bermasalah

          for (const fetchedCoin of coinList) {
            const upperCex = String(cex).toUpperCase();
            const chain = String(fetchedCoin.chain || this.activeChain).toUpperCase();
            const sc = String(fetchedCoin.sc || fetchedCoin.sc_token || '').toLowerCase();
            const symbol = String(fetchedCoin.nama_token || fetchedCoin.symbol || '').toUpperCase();

            const hasDeposit = this.hasDeposit(fetchedCoin);
            const hasWithdraw = this.hasWithdraw(fetchedCoin);
            const isProblematic = !hasDeposit || !hasWithdraw;

            // Cari koin di DB
            let coinInDB = null;
            if (sc) {
              coinInDB = coinsByKey.get(`${upperCex}|${chain}|${sc}`);
            }
            if (!coinInDB && symbol) {
              coinInDB = coinsByKey.get(`${upperCex}|${chain}|${symbol}`);
            }

            // Jika koin ada di DB, update data di nested CEX structure
            if (coinInDB) {
              // Pastikan struktur cex ada
              if (!coinInDB.cex) {
                coinInDB.cex = {};
              }

              // Update atau create CEX entry
              if (!coinInDB.cex[upperCex]) {
                coinInDB.cex[upperCex] = {
                  status: true,
                  feeWDToken: null,
                  feeWDPair: null,
                  depositToken: false,
                  withdrawToken: false,
                  depositPair: false,
                  withdrawPair: false
                };
              }

              // Update data CEX
              coinInDB.cex[upperCex].feeWDToken = fetchedCoin.feeWD ?? fetchedCoin.withdrawFee ?? coinInDB.cex[upperCex].feeWDToken ?? null;
              coinInDB.cex[upperCex].depositToken = hasDeposit;
              coinInDB.cex[upperCex].withdrawToken = hasWithdraw;
              coinInDB.updatedAt = new Date().toISOString();

              await DB.saveData(storeName, coinInDB);
              updatedCount++;

              // Tambahkan ke list koin yang ada di DB
              const coinData = {
                // REVISI: Pastikan Nama Koin diambil dari DB atau API, dan Nama Token adalah ticker.
                nama_koin: coinInDB.nama_koin || fetchedCoin.nama_koin || symbol, // Nama lengkap
                nama_token: symbol, // Selalu gunakan ticker untuk kolom ini
                sc_token: coinInDB.sc_token || fetchedCoin.sc_token || sc, // Smart Contract
                symbol: symbol,
                deposit: hasDeposit,
                withdraw: hasWithdraw,
                feeWD: fetchedCoin.feeWD,
                isProblematic: isProblematic
              };

              coinsInDB.push(coinData);

              // Tambahkan ke list problematic jika bermasalah
              if (isProblematic) {
                problematicCoins.push(coinData);
              }
            }
          }

          // 4. Simpan hasil
          this.fetchProgress = Math.round(((i + 1) / totalCEX) * 100);
          this.fetchedCoinData[cex] = {
            count: coinList.length,
            updated: updatedCount,
            coinsInDB: coinsInDB, // Semua koin yang ada di DB
            problematicCoins: problematicCoins, // Koin bermasalah yang ada di DB
            error: null
          };

          this.$emit('show-toast', `✓ ${cex}: ${coinList.length} koin dari API, ${coinsInDB.length} ada di DB, ${problematicCoins.length} bermasalah`, 'success');
        } catch (error) {
          console.error(`Gagal mengambil data untuk ${cex}:`, error);
          this.fetchedCoinData[cex] = {
            count: 0,
            updated: 0,
            coinsInDB: [],
            problematicCoins: [],
            error: error.message || 'Gagal mengambil data'
          };
          this.$emit('show-toast', `✗ ${cex}: ${error.message || 'Error'}`, 'danger');
        }
      }

      this.isChecking = false;
      this.fetchProgress = 100;
      this.walletStatusMessage = 'Pengecekan selesai.';
    }
  },
  activated() {
    // REVISI: Setiap kali tab ini aktif, reset tampilan hasil pengecekan sebelumnya.
    // Ini memastikan pengguna tidak melihat data usang dari sesi sebelumnya.
    this.fetchedCoinData = {};
    this.walletStatusMessage = 'Siap cek dompet';
  },

  template: `
    <div class="wallet-tab position-relative">
      <!-- Loading Overlay -->
      <div v-if="isChecking" class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style="background: rgba(0,0,0,0.5); z-index: 9999;">
        <div class="card shadow-lg" style="max-width: 400px;">
          <div class="card-body text-center">
            <div class="spinner-border text-primary mb-3" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <h5 class="mb-2">Mengecek Data Koin</h5>
            <p class="text-muted mb-0">{{ walletStatusMessage }}</p>
            <div class="progress mt-3" style="height: 8px;">
              <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" :style="{ width: fetchProgress + '%' }"></div>
            </div>
            <small class="text-muted mt-2 d-block">{{ fetchProgress }}% selesai</small>
          </div>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="card card-soft mb-3">
        <div class="card-body p-2">
          <div class="d-flex flex-wrap align-items-center gap-3">
            <div class="flex-grow-1 ps-1">
              <h6 class="mb-0">Daftar Dompet Deposit Exchanger</h6>
              <small class="text-muted">
                Menampilkan {{ activeCEXKeys.length }} Exchanger yang aktif dari Setting Global.
              </small>
            </div>
            <div class="text-muted small">{{ walletStatusMessage }}</div>
            <button type="button" class="btn btn-primary btn-sm" @click="handleCheckWallets" :disabled="totalSelected === 0 || isChecking">
              <i class="bi bi-arrow-repeat me-1"></i>
              Cek Data Koin ({{ totalSelected }})
            </button>
          </div>
        </div>
      </div>

      <!-- Grid of Wallet Cards -->
      <div v-if="walletCards.length" class="row g-3">
        <div v-for="card in walletCards" :key="card.key" class="col-md-6 col-lg-4">
          <div class="card card-soft h-100">
            <div class="card-header d-flex align-items-center gap-2">
              <div class="form-check mb-0">
                <input class="form-check-input" type="checkbox" :id="'wallet-cex-' + card.key" :value="card.key" v-model="selectedCEXs">
                <label class="form-check-label" :for="'wallet-cex-' + card.key">
                  <span class="fw-semibold" :style="{ color: getCexBadgeStyle(card.key).backgroundColor }">{{ card.displayName }}</span>
                </label>
              </div>
            </div>
            <div class="card-body">
              <div class="vstack gap-3">
                <div v-for="chain in card.chainEntries" :key="chain.chainKey" class="wallet-chain-block">
                  <div class="small text-muted text-uppercase fw-semibold mb-1" :style="{ color: getChainBadgeStyle(chain.chainKey).color }">{{ chain.chainLabel }}</div>
                  <div class="vstack gap-2">
                    <div
                      v-for="address in chain.addresses"
                      :key="address.key"
                      class="input-group input-group-sm"
                    >
                      <span class="input-group-text" :style="getChainBadgeStyle(chain.chainKey)">{{ address.label }}</span>
                      <input type="text" class="form-control" :value="address.address" readonly>
                      <button class="btn btn-outline-secondary" type="button" @click="copyAddress(address.address)" :title="'Salin ' + address.address">
                        <i class="bi bi-clipboard"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Hasil Pengecekan -->
              <div v-if="fetchedCoinData[card.key]" class="mt-3 pt-3 border-top">
                 <div v-if="fetchedCoinData[card.key].error" class="alert alert-danger p-2 small mb-0">
                   <i class="bi bi-exclamation-triangle-fill me-1"></i>
                   <strong>Error:</strong> {{ fetchedCoinData[card.key].error }}
                 </div>
                 <div v-else>
                   <div class="alert alert-info p-2 small mb-2">
                     <i class="bi bi-info-circle-fill me-1"></i>
                     <strong>{{ fetchedCoinData[card.key].count }}</strong> koin dari API,
                     <strong>{{ fetchedCoinData[card.key].coinsInDB?.length || 0 }}</strong> ada di DB,
                     <strong>{{ fetchedCoinData[card.key].problematicCoins?.length || 0 }}</strong> bermasalah
                   </div>

                   <!-- Tab Navigation untuk menampilkan Semua atau Bermasalah -->
                   <ul class="nav nav-tabs nav-tabs-sm mb-2" role="tablist">
                     <li class="nav-item">
                       <a class="nav-link active" :id="'tab-all-' + card.key" data-bs-toggle="tab" :href="'#all-coins-' + card.key" role="tab">
                         Semua Koin ({{ fetchedCoinData[card.key].coinsInDB?.length || 0 }})
                       </a>
                     </li>
                     <li class="nav-item">
                       <a class="nav-link" :id="'tab-problem-' + card.key" data-bs-toggle="tab" :href="'#problem-coins-' + card.key" role="tab">
                         Bermasalah ({{ fetchedCoinData[card.key].problematicCoins?.length || 0 }})
                       </a>
                     </li>
                   </ul>

                   <div class="tab-content">
                     <!-- Tab Semua Koin -->
                     <div class="tab-pane fade show active" :id="'all-coins-' + card.key" role="tabpanel">
                       <div v-if="fetchedCoinData[card.key].coinsInDB?.length > 0" class="table-responsive" style="max-height: 300px; overflow-y: auto;">
                         <table class="table table-sm table-bordered table-hover small mb-0">
                           <thead class="table-dark sticky-top">
                             <tr>
                               <th style="width: 30%;">Nama Koin</th>
                               <th style="width: 15%;">Token (Ticker)</th>
                               <th style="width: 35%;">Smart Contract</th>
                               <th class="text-center" style="width: 10%;">Depo</th>
                               <th class="text-center" style="width: 10%;">WD</th>
                             </tr>
                           </thead>
                           <tbody>
                             <tr v-for="coin in fetchedCoinData[card.key].coinsInDB" :key="coin.sc_token || coin.symbol" :class="{ 'table-warning': coin.isProblematic }">
                               <td class="fw-semibold">{{ coin.nama_koin || coin.symbol }}</td>
                               <td class="text-primary">{{ coin.nama_token }}</td>
                               <td class="text-truncate font-monospace small" :title="coin.sc_token">
                                 {{ coin.sc_token || '-' }}
                               </td>
                               <td class="text-center">
                                 <span v-if="coin.deposit" class="badge bg-success">ON</span>
                                 <span v-else class="badge bg-danger">OFF</span>
                               </td>
                               <td class="text-center">
                                 <span v-if="coin.withdraw" class="badge bg-success">ON</span>
                                 <span v-else class="badge bg-danger">OFF</span>
                               </td>
                             </tr>
                           </tbody>
                         </table>
                       </div>
                       <div v-else class="alert alert-secondary p-2 small mb-0">
                         <i class="bi bi-inbox"></i> Tidak ada koin yang tersedia di tabel KOIN
                       </div>
                     </div>

                     <!-- Tab Koin Bermasalah -->
                     <div class="tab-pane fade" :id="'problem-coins-' + card.key" role="tabpanel">
                       <div v-if="fetchedCoinData[card.key].problematicCoins?.length > 0" class="table-responsive" style="max-height: 300px; overflow-y: auto;">
                         <table class="table table-sm table-bordered table-hover small mb-0">
                           <thead class="table-dark sticky-top">
                             <tr>
                               <th style="width: 30%;">Nama Koin</th>
                               <th style="width: 15%;">Token (Ticker)</th>
                               <th style="width: 35%;">Smart Contract</th>
                               <th class="text-center" style="width: 10%;">Depo</th>
                               <th class="text-center" style="width: 10%;">WD</th>
                             </tr>
                           </thead>
                           <tbody>
                             <tr v-for="coin in fetchedCoinData[card.key].problematicCoins" :key="coin.sc_token || coin.symbol" class="table-warning">
                               <td class="fw-semibold">{{ coin.nama_koin || coin.symbol }}</td>
                               <td class="text-primary">{{ coin.nama_token }}</td>
                               <td class="text-truncate font-monospace small" :title="coin.sc_token">
                                 {{ coin.sc_token || '-' }}
                               </td>
                               <td class="text-center">
                                 <span v-if="coin.deposit" class="badge bg-success">ON</span>
                                 <span v-else class="badge bg-danger">OFF</span>
                               </td>
                               <td class="text-center">
                                 <span v-if="coin.withdraw" class="badge bg-success">ON</span>
                                 <span v-else class="badge bg-danger">OFF</span>
                               </td>
                             </tr>
                           </tbody>
                         </table>
                       </div>
                       <div v-else class="alert alert-success p-2 small mb-0">
                         <i class="bi bi-check-circle-fill me-1"></i>
                         Semua koin dalam kondisi baik (Depo & WD ON)
                       </div>
                     </div>
                   </div>
                 </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <div v-else class="text-center py-5 text-muted">
          <i class="bi bi-inbox fs-1"></i>
          <h6 v-if="activeCEXKeys.length === 0">Tidak ada CEX yang aktif</h6>
          <h6 v-else>Tidak ada data dompet untuk chain ini</h6>
          <p class="mb-0" v-if="activeCEXKeys.length === 0">
            Aktifkan minimal 1 CEX di <strong>Setting Global</strong> untuk melihat daftar dompet exchanger.
          </p>
          <p class="mb-0" v-else>
            Pilih chain lain atau pastikan wallet address sudah dikonfigurasi di <code>config_app.js</code>
          </p>
      </div>
    </div>
  `
};
