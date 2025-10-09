// components/tabs/wallet-tab.js

const WalletTab = {
  name: 'WalletTab',
  emits: ['show-toast'],

  data() {
    return {
      walletStatusMessage: 'Siap cek dompet',
      selectedCEXs: [],
      isChecking: false,
      fetchProgress: 0,
      fetchedCoinData: {}, // { CEX_KEY: { count, updated, coinsInDB, problematicCoins, perChain, error } }
      selectedChains: []
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

    availableChainKeys() {
      const chainKeys = Object.keys(this.chainConfig || {});
      if (!this.globalSettings || !this.globalSettings.config_chain) {
        return chainKeys;
      }
      const activeKeys = Object.keys(this.globalSettings.config_chain)
        .filter(key => this.globalSettings.config_chain[key]?.status)
        .map(key => this.normalizeChainKey(key))
        .filter(key => chainKeys.includes(key));
      return activeKeys.length ? activeKeys : chainKeys;
    },

    chainOptions() {
      return this.availableChainKeys.map(chainKey => ({
        key: chainKey,
        label: this.getChainLabel(chainKey)
      }));
    },

    chainKeysToShow() {
      if (this.activeChain === 'multi') {
        if (!this.selectedChains.length) return this.availableChainKeys;
        const selectedSet = new Set(this.selectedChains.map(chain => this.normalizeChainKey(chain)));
        return this.availableChainKeys.filter(key => selectedSet.has(key));
      }
      const normalized = this.normalizeChainKey(this.activeChain);
      return normalized ? [normalized] : [];
    },

    walletCards() {
      const chainKeys = this.chainKeysToShow;
      const chainConfig = this.chainConfig;

      // REVISI: Hanya tampilkan CEX yang aktif di SETTING_GLOBAL
      return this.activeCEXKeys.map(cexKey => {
        // FIX: Convert to uppercase untuk match dengan cexConfig keys
        const cexData = this.cexConfig[cexKey.toUpperCase()];
        if (!cexData) return null;

        const chainEntries = chainKeys.reduce((entries, chainKey) => {
          const walletInfo = cexData.WALLETS?.[chainKey.toLowerCase()]; // FIX: Gunakan lowercase key
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
            chainKey: chainKey.toLowerCase(), // Pastikan chainKey konsisten lowercase
            chainLabel: chainConfig[chainKey.toLowerCase()]?.NAMA_CHAIN?.toUpperCase() || chainKey.toUpperCase(),
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
    activeChain(newChain) {
      this.walletStatusMessage = 'Siap cek dompet';
      this.fetchedCoinData = {}; // Reset hasil saat ganti chain
      this.fetchProgress = 0;
      if (newChain === 'multi') {
        this.selectedChains = [...this.availableChainKeys];
      } else {
        this.selectedChains = [];
      }
    },
    availableChainKeys: {
      immediate: true,
      handler(newKeys) {
        if (this.activeChain !== 'multi') return;
        const allowed = new Set(newKeys);
        this.selectedChains = this.selectedChains.filter(key => allowed.has(key));
        if (!this.selectedChains.length) {
          this.selectedChains = [...newKeys];
        }
      }
    },
    selectedChains() {
      if (this.activeChain === 'multi') {
        this.fetchedCoinData = {};
        this.walletStatusMessage = 'Siap cek dompet';
        this.fetchProgress = 0;
      }
    }
  },

  methods: {
    normalizeChainKey(chainKey) {
      return (chainKey || '').toString().toLowerCase();
    },
    getChainLabel(chainKey) {
      const normalized = this.normalizeChainKey(chainKey);
      return this.chainConfig[normalized]?.NAMA_CHAIN?.toUpperCase() || normalized.toUpperCase();
    },
    selectAllChains() {
      if (!this.availableChainKeys.length) return;
      this.selectedChains = [...this.availableChainKeys];
    },
    clearSelectedChains() {
      this.selectedChains = [];
    },
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
        this.$emit('show-toast', 'Alamat dompet berhasil disalin.', 'success');
      } catch (error) {
        console.error('Gagal menyalin alamat dompet:', error);
        this.$emit('show-toast', 'Gagal menyalin alamat dompet.', 'danger');
      }
    },

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

      let chainsToProcess = this.activeChain === 'multi'
        ? (this.selectedChains.length ? Array.from(new Set(this.selectedChains.map(chain => this.normalizeChainKey(chain)))) : [])
        : [this.normalizeChainKey(this.activeChain)];

      chainsToProcess = chainsToProcess.filter(chain => !!chain);

      if (this.activeChain === 'multi' && chainsToProcess.length === 0) {
        this.$emit('show-toast', 'Pilih minimal satu chain sebelum mengeksekusi pengecekan.', 'warning');
        return;
      }

      if (!window.CheckWalletExchanger) {
        this.$emit('show-toast', 'Modul CheckWalletExchanger tidak ditemukan.', 'danger');
        return;
      }

      this.isChecking = true;
      this.fetchProgress = 0;
      this.fetchedCoinData = {};
      const names = this.selectedCEXs.map(key => key.toUpperCase()).join(', ');
      const totalCEX = this.selectedCEXs.length;
      this.walletStatusMessage = `Mengecek: ${names}...`;
      this.$emit('show-toast', `Memulai pengecekan data koin untuk: ${names}`, 'info');

      const secrets = this.buildSecretsFromConfig();
      const fetcher = new CheckWalletExchanger(secrets, this.$root.config, window.Http);

      const totalJobs = Math.max(totalCEX * chainsToProcess.length, 1);
      let jobIndex = 0;

      for (let i = 0; i < this.selectedCEXs.length; i++) {
        const cex = this.selectedCEXs[i];
        const upperCex = cex.toUpperCase();

        const aggregatedResult = {
          count: 0,
          updated: 0,
          coinsInDB: [],
          problematicCoins: [],
          perChain: {},
          error: null
        };

        for (const chainKeyRaw of chainsToProcess) {
          const chainKey = this.normalizeChainKey(chainKeyRaw);
          const chainLabel = this.getChainLabel(chainKey);

          this.walletStatusMessage = `Mengambil data ${upperCex} (${chainLabel})... (${i + 1}/${totalCEX})`;
          this.fetchProgress = Math.round((jobIndex / totalJobs) * 100);

          try {
            const coinList = await fetcher.fetchCoinList(cex, chainKey);
            aggregatedResult.count += coinList.length;

            const apiCoinMap = new Map();
            coinList.forEach(fetchedCoin => {
              const symbol = String(fetchedCoin.nama_token || fetchedCoin.symbol || '').toUpperCase();
              if (symbol) apiCoinMap.set(symbol, fetchedCoin);
            });

            const storeName = DB.getStoreNameByChain('KOIN', chainKey);
            const allCoinsInDB = await DB.getAllData(storeName);

            this.walletStatusMessage = `Memproses ${allCoinsInDB.length} koin (${chainLabel})... (${i + 1}/${totalCEX})`;

            let updatedCount = 0;
            const coinsInDB = [];
            const problematicCoins = [];
            const displayedCoinsTracker = new Set();

            for (const coinInDB of allCoinsInDB) {
              if (coinInDB.id === 'DATA_KOIN') continue;
              if ((coinInDB.cex_name || '').toUpperCase() !== upperCex) continue;

              const tokenSymbol = String(coinInDB.nama_token || '').toUpperCase();
              const pairSymbol = String(coinInDB.nama_pair || '').toUpperCase();
              const tokenDataFromApi = apiCoinMap.get(tokenSymbol);
              const pairDataFromApi = apiCoinMap.get(pairSymbol);

              let hasDepositToken = false;
              let hasWithdrawToken = false;
              let isProblematic = true;

              if (tokenDataFromApi) {
                hasDepositToken = this.hasDeposit(tokenDataFromApi);
                hasWithdrawToken = this.hasWithdraw(tokenDataFromApi);
                isProblematic = !hasDepositToken || !hasWithdrawToken;
                coinInDB.cex_deposit_status = hasDepositToken;
                coinInDB.cex_withdraw_status = hasWithdrawToken;
                coinInDB.cex_fee_wd = tokenDataFromApi.feeWD ?? tokenDataFromApi.withdrawFee ?? coinInDB.cex_fee_wd ?? null;
              } else {
                coinInDB.cex_deposit_status = false;
                coinInDB.cex_withdraw_status = false;
              }

              if (pairDataFromApi) {
                coinInDB.cex_pair_deposit_status = this.hasDeposit(pairDataFromApi);
                coinInDB.cex_pair_withdraw_status = this.hasWithdraw(pairDataFromApi);
              } else {
                coinInDB.cex_pair_deposit_status = false;
                coinInDB.cex_pair_withdraw_status = false;
              }

              coinInDB.updatedAt = new Date().toISOString();
              await DB.saveData(storeName, coinInDB);
              updatedCount++;

              const coinDataForDisplay = {
                nama_koin: coinInDB.nama_koin || tokenSymbol,
                nama_token: tokenSymbol,
                cex_ticker_token: coinInDB.cex_ticker_token || '',
                sc_token: coinInDB.sc_token,
                deposit: hasDepositToken,
                withdraw: hasWithdrawToken,
                isProblematic,
                chainKey,
                chainLabel
              };

              const displayKey = `${chainKey}:${coinDataForDisplay.sc_token || coinDataForDisplay.nama_token}`;
              if (displayKey && !displayedCoinsTracker.has(displayKey)) {
                coinsInDB.push(coinDataForDisplay);
                if (isProblematic) {
                  problematicCoins.push(coinDataForDisplay);
                }
                displayedCoinsTracker.add(displayKey);
              }
            }

            aggregatedResult.updated += updatedCount;
            aggregatedResult.coinsInDB.push(...coinsInDB);
            aggregatedResult.problematicCoins.push(...problematicCoins);
            aggregatedResult.perChain[chainKey] = {
              chainKey,
              chainLabel,
              count: coinList.length,
              updated: updatedCount,
              coinsInDB,
              problematicCoins,
              error: null
            };

            this.$emit('show-toast', `✓ ${upperCex} (${chainLabel}): ${coinList.length} koin dari API, ${coinsInDB.length} ada di DB, ${problematicCoins.length} bermasalah`, 'success');
          } catch (error) {
            const message = error?.message || 'Gagal mengambil data';
            this.walletStatusMessage = `Gagal mengambil data ${upperCex} (${chainLabel}): ${message}`;
            aggregatedResult.perChain[chainKey] = {
              chainKey,
              chainLabel,
              count: 0,
              updated: 0,
              coinsInDB: [],
              problematicCoins: [],
              error: message
            };
            aggregatedResult.error = aggregatedResult.error
              ? `${aggregatedResult.error}; ${chainLabel}: ${message}`
              : `${chainLabel}: ${message}`;
            this.$emit('show-toast', `✗ ${upperCex} (${chainLabel}): ${message}`, 'danger');
          } finally {
            jobIndex += 1;
            this.fetchProgress = Math.round((jobIndex / totalJobs) * 100);
          }
        }

        aggregatedResult.coinsInDB.sort((a, b) => {
          const chainCompare = (a.chainLabel || '').localeCompare(b.chainLabel || '');
          if (chainCompare !== 0) return chainCompare;
          return (a.nama_token || '').localeCompare(b.nama_token || '');
        });
        aggregatedResult.problematicCoins.sort((a, b) => {
          const chainCompare = (a.chainLabel || '').localeCompare(b.chainLabel || '');
          if (chainCompare !== 0) return chainCompare;
          return (a.nama_token || '').localeCompare(b.nama_token || '');
        });

        this.fetchedCoinData[cex] = aggregatedResult;
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
    if (this.activeChain === 'multi' && this.selectedChains.length === 0) {
      this.selectedChains = [...this.availableChainKeys];
    }
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
                      :disabled="totalSelected === 0 || isChecking || (activeChain === 'multi' && selectedChains.length === 0)">
                <i class="bi bi-arrow-repeat"></i>
                Cek Data Koin ({{ totalSelected }})
              </button>
            </div>
          </div>
        </div>
        <div v-if="activeChain === 'multi'" class="mt-2 pt-2 border-top">
          <div class="d-flex flex-wrap align-items-center gap-2">
            <span class="small fw-semibold text-uppercase text-muted">
              Pilih Chain:
            </span>
            <div class="d-flex flex-wrap gap-2">
              <label
                v-for="chain in chainOptions"
                :key="'wallet-chain-option-' + chain.key"
                class="form-check form-check-inline small mb-0">
                <input
                  class="form-check-input"
                  type="checkbox"
                  :value="chain.key"
                  v-model="selectedChains"
                  :disabled="isChecking">
                <span class="form-check-label">{{ chain.label }}</span>
              </label>
            </div>
            <div class="d-flex gap-1 ms-auto">
              <button type="button" class="btn btn-sm btn-outline-secondary" @click="selectAllChains" :disabled="isChecking || !chainOptions.length">Semua</button>
              <button type="button" class="btn btn-sm btn-outline-secondary" @click="clearSelectedChains" :disabled="isChecking">Kosongkan</button>
            </div>
          </div>
          <div v-if="selectedChains.length === 0" class="text-danger small mt-1">
            Pilih minimal satu chain untuk mengecek data exchanger.
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
                  <span class="fw-semibold small" :style="{ color: getCexBadgeStyle(card.key).backgroundColor }">{{ card.displayName }}</span>
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
                               <th style="width: 20%;">Nama Koin</th>
                               <th style="width: 12%;">Chain</th>
                               <th style="width: 15%;">Nama Token</th>
                               <th style="width: 15%;">Ticker CEX</th>
                               <th style="width: 23%;">Smart Contract</th>
                               <th class="text-center" style="width: 7%;">Deposit</th>
                               <th class="text-center" style="width: 8%;">Withdraw</th>
                             </tr>
                           </thead>
                           <tbody>
                             <tr v-for="coin in fetchedCoinData[card.key].coinsInDB" :key="coin.sc_token || coin.nama_token" :class="{ 'table-warning': coin.isProblematic }">
                               <td class="fw-semibold">{{ coin.nama_koin || coin.symbol }}</td>
                               <td>
                                 <span class="badge bg-light text-dark border">{{ coin.chainLabel || coin.chainKey?.toUpperCase() }}</span>
                               </td>
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
                               <th style="width: 20%;">Nama Koin</th>
                               <th style="width: 12%;">Chain</th>
                               <th style="width: 15%;">Nama Token</th>
                               <th style="width: 15%;">Ticker CEX</th>
                               <th style="width: 23%;">Smart Contract</th>
                               <th class="text-center" style="width: 7%;">Deposit</th>
                               <th class="text-center" style="width: 8%;">Withdraw</th>
                             </tr>
                           </thead>
                           <tbody>
                             <tr v-for="coin in fetchedCoinData[card.key].problematicCoins" :key="coin.sc_token || coin.nama_token" class="table-warning">
                               <td class="fw-semibold">{{ coin.nama_koin || coin.symbol }}</td>
                               <td>
                                 <span class="badge bg-light text-dark border">{{ coin.chainLabel || coin.chainKey?.toUpperCase() }}</span>
                               </td>
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
      <div v-else-if="activeChain === 'multi' && selectedChains.length === 0" class="alert alert-warning text-center py-4">
        <i class="bi bi-info-circle fs-4 d-block mb-2"></i>
        <span class="fw-semibold">Pilih minimal satu chain untuk menampilkan dompet exchanger.</span>
      </div>

      <div v-else class="text-center py-5 text-muted">
          <i class="bi bi-inbox fs-1"></i>
          <h6 v-if="activeCEXKeys.length === 0">Tidak ada CEX yang aktif</h6>
          <h6 v-else>Tidak ada data Exchanger untuk chain ini</h6>
          <p class="mb-0" v-if="activeCEXKeys.length === 0">
            Aktifkan minimal 1 CEX di <strong>Setting Global</strong> untuk melihat daftar dompet exchanger.
          </p> 
      </div>
    </div>
  `
};
