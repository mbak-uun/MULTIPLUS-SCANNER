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

          // REVISI: Buat map dari hasil fetch API untuk memudahkan pencarian status pair.
          // Key: Symbol (uppercase), Value: Objek koin dari API
          const apiCoinMap = new Map();
          coinList.forEach(fetchedCoin => {
            const symbol = String(fetchedCoin.nama_token || fetchedCoin.symbol || '').toUpperCase();
            if (symbol) apiCoinMap.set(symbol, fetchedCoin);
          });

          // 2. Load semua koin dari tabel KOIN
          this.walletStatusMessage = `Memeriksa tabel KOIN_${this.activeChain}... (${i + 1}/${totalCEX})`;
          this.fetchProgress = Math.round(((i + 0.3) / totalCEX) * 100);
          const allCoinsInDB = await DB.getAllData(storeName);

          // 3. Proses setiap koin dari CEX
          this.walletStatusMessage = `Memproses ${allCoinsInDB.length} koin dari database... (${i + 1}/${totalCEX})`;
          this.fetchProgress = Math.round(((i + 0.5) / totalCEX) * 100);
          let updatedCount = 0;
          const coinsInDB = []; // Semua koin yang ada di DB
          const problematicCoins = []; // Koin yang ada di DB dan bermasalah

          // REVISI: Tambahkan Set untuk melacak koin yang sudah ditambahkan ke daftar tampilan
          // untuk mencegah duplikasi. Kunci bisa berupa sc_token atau nama_token.
          const displayedCoinsTracker = new Set();

          // REVISI: Iterasi melalui SEMUA koin di database, bukan hasil API.
          // Ini memastikan semua record di-update, bahkan jika token utamanya tidak muncul di API.
          for (const coinInDB of allCoinsInDB) {
            if (coinInDB.id === 'DATA_KOIN') continue; // Skip snapshot

            const upperCex = String(cex).toUpperCase();
            
            // Hanya proses jika record ini memiliki data untuk CEX yang sedang dicek
            if ((coinInDB.cex_name || '').toUpperCase() !== upperCex) continue;

            // 1. Cari status untuk TOKEN UTAMA dari hasil API
            const tokenSymbol = String(coinInDB.nama_token || '').toUpperCase();
            const tokenDataFromApi = apiCoinMap.get(tokenSymbol);

            let hasDepositToken = false;
            let hasWithdrawToken = false;
            let isProblematic = true;

            if (tokenDataFromApi) {
              hasDepositToken = this.hasDeposit(tokenDataFromApi);
              hasWithdrawToken = this.hasWithdraw(tokenDataFromApi);
              isProblematic = !hasDepositToken || !hasWithdrawToken;

              // Update status TOKEN UTAMA
              coinInDB.cex_deposit_status = hasDepositToken;
              coinInDB.cex_withdraw_status = hasWithdrawToken;
              coinInDB.cex_fee_wd = tokenDataFromApi.feeWD ?? tokenDataFromApi.withdrawFee ?? coinInDB.cex_fee_wd ?? null;
            } else {
              // Jika token utama tidak ditemukan di API, set statusnya ke false
              coinInDB.cex_deposit_status = false;
              coinInDB.cex_withdraw_status = false;
            }

            // 2. Cari status untuk PAIR dari hasil API
            const pairSymbol = String(coinInDB.nama_pair || '').toUpperCase();
            const pairDataFromApi = apiCoinMap.get(pairSymbol);

            if (pairDataFromApi) {
              // Update status PAIR
              coinInDB.cex_pair_deposit_status = this.hasDeposit(pairDataFromApi);
              coinInDB.cex_pair_withdraw_status = this.hasWithdraw(pairDataFromApi);
            } else {
              // Jika pair tidak ditemukan di API, set statusnya ke false
              coinInDB.cex_pair_deposit_status = false;
              coinInDB.cex_pair_withdraw_status = false;
            }

            // 3. Update timestamp dan simpan ke DB
            coinInDB.updatedAt = new Date().toISOString();
            await DB.saveData(storeName, coinInDB);
            updatedCount++;

            // 4. Siapkan data untuk ditampilkan di tabel hasil
            const coinDataForDisplay = {
              nama_koin: coinInDB.nama_koin || tokenSymbol,
              nama_token: tokenSymbol,
              cex_ticker_token: coinInDB.cex_ticker_token || '', // REVISI: Tambahkan ticker CEX
              sc_token: coinInDB.sc_token,
              deposit: hasDepositToken,
              withdraw: hasWithdrawToken,
              isProblematic: isProblematic
            };

            // REVISI: Cek duplikasi sebelum menambahkan ke daftar tampilan.
            const displayKey = coinDataForDisplay.sc_token || coinDataForDisplay.nama_token;
            if (displayKey && !displayedCoinsTracker.has(displayKey)) {
              coinsInDB.push(coinDataForDisplay);
              if (isProblematic) {
                problematicCoins.push(coinDataForDisplay);
              }
              // Tandai koin ini sudah ditampilkan
              displayedCoinsTracker.add(displayKey);
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

      <!-- Wallet Toolbar -->
      <div class="card card-body p-2 mb-3">
        <div class="row g-2 align-items-center">
          <div class="col-12 col-lg">
            <div class="d-flex align-items-center gap-3 flex-wrap">
              <h6 class="mb-0 d-flex align-items-center gap-2">
                <i class="bi bi-wallet2"></i>
                Dompet Exchanger
              </h6>
              <span class="badge bg-light text-dark border">
                <i class="bi bi-building"></i>
                {{ activeCEXKeys.length }} Exchanger aktif
              </span>
            </div>
          </div>
          <div class="col-12 col-lg-auto text-lg-end">
            <div class="d-grid d-sm-inline-flex justify-content-sm-end">
              <button class="btn btn-sm btn-success" @click="handleCheckWallets"
                      :disabled="totalSelected === 0 || isChecking">
                <i class="bi bi-arrow-repeat"></i>
                Cek Data Koin ({{ totalSelected }})
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Grid of Wallet Cards -->
      <div v-if="walletCards.length" class="row g-2">
        <div v-for="card in walletCards" :key="card.key" class="col-md-6 col-lg-4">
          <div class="card card-soft h-100">
            <div class="card-header d-flex align-items-center gap-2 p-2">
              <div class="form-check mb-0">
                <input class="form-check-input" type="checkbox" :id="'wallet-cex-' + card.key" :value="card.key" v-model="selectedCEXs">
                <label class="form-check-label fs-6" :for="'wallet-cex-' + card.key">
                  <span class="fw-semibold" :style="{ color: getCexBadgeStyle(card.key).backgroundColor }">{{ card.displayName }}</span>
                </label>
              </div>
            </div>
            <div class="card-body p-2">
              <div class="vstack gap-2">
                <div v-for="chain in card.chainEntries" :key="chain.chainKey" class="wallet-chain-block">
                  <div class="small text-muted text-uppercase fw-semibold" :style="{ color: getChainBadgeStyle(chain.chainKey).color }">{{ chain.chainLabel }}</div>
                  <div class="vstack gap-1">
                    <div
                      v-for="address in chain.addresses"
                      :key="address.key"
                      class="input-group input-group-sm"
                    >
                      <span class="input-group-text small" :style="getChainBadgeStyle(chain.chainKey)">{{ address.label }}</span>
                      <input type="text" class="form-control" :value="address.address" readonly>
                      <button class="btn btn-sm btn-outline-secondary" type="button" @click="copyAddress(address.address)" :title="'Salin ' + address.address">
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
                              <!-- REVISI: Tambahkan kolom Ticker CEX -->
                             <tr>
                               <th style="width: 25%;">Nama Koin</th>
                               <th style="width: 15%;">Nama Token</th>
                               <th style="width: 15%;">Ticker CEX</th>
                               <th style="width: 25%;">Smart Contract</th>
                               <th class="text-center" style="width: 10%;">Deposit</th>
                               <th class="text-center" style="width: 10%;">Withdraw</th>
                             </tr>
                           </thead>
                           <tbody>
                             <tr v-for="coin in fetchedCoinData[card.key].coinsInDB" :key="coin.sc_token || coin.nama_token" :class="{ 'table-warning': coin.isProblematic }">
                               <td class="fw-semibold">{{ coin.nama_koin || coin.symbol }}</td>
                               <td class="text-primary">{{ coin.nama_token }}</td>
                               <td class="fw-bold">{{ coin.cex_ticker_token }}</td>
                               <td class="text-truncate font-monospace small" :title="coin.sc_token">
                                 {{ coin.sc_token || '-' }}
                               </td>
                               <td class="text-center">
                                 <span class="badge" :class="coin.deposit ? 'bg-success' : 'bg-danger'">{{ coin.deposit ? 'DP' : 'DX' }}</span>
                               </td>
                               <td class="text-center">
                                 <span class="badge" :class="coin.withdraw ? 'bg-success' : 'bg-danger'">{{ coin.withdraw ? 'WD' : 'WX' }}</span>
                               </td>
                             </tr>
                           </tbody>
                         </table>
                       </div>
                       <div v-else class="alert alert-danger p-2 small mb-0">
                         <i class="bi bi-inbox"></i> Tidak data koin pada Manajemen Koin untuk exchanger ini.
                       </div>
                     </div>

                     <!-- Tab Koin Bermasalah -->
                     <div class="tab-pane fade" :id="'problem-coins-' + card.key" role="tabpanel">
                       <div v-if="fetchedCoinData[card.key].problematicCoins?.length > 0" class="table-responsive" style="max-height: 300px; overflow-y: auto;">
                         <table class="table table-sm table-bordered table-hover small mb-0">
                           <thead class="table-dark sticky-top">
                              <!-- REVISI: Tambahkan kolom Ticker CEX -->
                             <tr>
                               <th style="width: 25%;">Nama Koin</th>
                               <th style="width: 15%;">Nama Token</th>
                               <th style="width: 15%;">Ticker CEX</th>
                               <th style="width: 25%;">Smart Contract</th>
                               <th class="text-center" style="width: 10%;">Deposit</th>
                               <th class="text-center" style="width: 10%;">Withdraw</th>
                             </tr>
                           </thead>
                           <tbody>
                             <tr v-for="coin in fetchedCoinData[card.key].problematicCoins" :key="coin.sc_token || coin.nama_token" class="table-warning">
                               <td class="fw-semibold">{{ coin.nama_koin || coin.symbol }}</td>
                               <td class="text-primary">{{ coin.nama_token }}</td>
                               <td class="fw-bold">{{ coin.cex_ticker_token }}</td>
                               <td class="text-truncate font-monospace small" :title="coin.sc_token">
                                 {{ coin.sc_token || '-' }}
                               </td>
                               <td class="text-center">
                                 <span class="badge" :class="coin.deposit ? 'bg-success' : 'bg-danger'">{{ coin.deposit ? 'DP' : 'DX' }}</span>
                               </td>
                               <td class="text-center">
                                 <span class="badge" :class="coin.withdraw ? 'bg-success' : 'bg-danger'">{{ coin.withdraw ? 'WD' : 'WX' }}</span>
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
