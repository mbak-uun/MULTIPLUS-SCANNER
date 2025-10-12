/**
 * ===================================================================================
 * Filter Manager Mixin
 * ===================================================================================
 *
 * Mixin untuk mengelola filter dengan konsep sistematis:
 *
 * KONSEP FILTER:
 * 1. Chain Filter  : Sumber = KONFIG_APLIKASI, Pilihan = SETTING_GLOBAL, Status = SETTING_FILTER_<CHAIN>
 * 2. CEX Filter    : Sumber = KONFIG_APLIKASI, Pilihan = SETTING_GLOBAL, Status = SETTING_FILTER_<CHAIN>
 * 3. DEX Filter    : Sumber = KONFIG_APLIKASI, Pilihan = SETTING_GLOBAL, Status = SETTING_FILTER_<CHAIN>
 * 4. Pair Filter   : Sumber = KONFIG_APLIKASI, Data Real = KOIN_<CHAIN>, Status = SETTING_FILTER_<CHAIN>
 *
 * SIDEBAR = Sarana untuk update SETTING_FILTER_<NAMA-CHAIN>
 */

const filterManagerMixin = {
    data() {
        return {
            // Internal state untuk filter
            _filterCache: {
                availableChains: [],
                availableCEXs: [],
                availableDEXs: [],
                availablePairs: []
            },
            _pendingFilterInit: false,
            _lastInitializedChain: null
        };
    },

    computed: {
        /**
         * Get KONFIG_APLIKASI
         */
        config() {
            return this.$root.config || {};
        },

        /**
         * Get SETTING_GLOBAL
         */
        globalSettings() {
            return this.$root.globalSettings || {};
        },

        /**
         * Get current active chain
         */
        activeChain() {
            return this.$root.activeChain;
        },

        /**
         * Get current filter settings for active chain
         */
        currentFilterSettings() {
            if (!this.activeChain) return {};
            return this.$root.filterSettings || {};
        },

        // =================================================================
        // CHAIN FILTER
        // =================================================================

        /**
         * REVISI: Ambil daftar chain dari KONFIG_APLIKASI yang aktif di pengaturan global.
         * Sidebar hanya menampilkan chain yang ditandai aktif pada menu Setting Global.
         */
        availableChainFilters() {
            if (!this.config || !this.config.CHAINS) return [];
            // Hanya tampilkan chain yang aktif di pengaturan global
            // FIX: Case-insensitive comparison karena config_chain menggunakan lowercase key
            return Object.keys(this.config.CHAINS)
                .filter(chainKey => this.globalSettings?.config_chain?.[chainKey.toLowerCase()]?.status === true);
        },

        /**
         * Get checked status of chains from SETTING_FILTER_<CHAIN>
         * Status centang menentukan chain mana yang aktif untuk filtering
         */
        activeChainFilters() {
            const filters = this.currentFilterSettings;
            if (!filters.chains) return {};
            return filters.chains;
        },

        // =================================================================
        // CEX FILTER
        // =================================================================

        /**
         * REVISI: Ambil daftar CEX dari KONFIG_APLIKASI yang aktif di pengaturan global.
         * Sidebar hanya menampilkan CEX yang diperbolehkan oleh Setting Global.
         */
        availableCEXFilters() {
            if (!this.config || !this.config.CEX) return [];
            // Hanya tampilkan CEX yang aktif di pengaturan global
            // FIX: Case-insensitive comparison karena config_cex menggunakan lowercase key
            return Object.keys(this.config.CEX)
                .filter(cexKey => this.globalSettings?.config_cex?.[cexKey.toLowerCase()]?.status === true);
        },

        /**
         * Get checked status of CEXs from SETTING_FILTER_<CHAIN>
         * Status centang menentukan CEX mana yang aktif untuk filtering
         */
        activeCEXFilters() {
            const filters = this.currentFilterSettings;
            if (!filters.cex) return {};
            return filters.cex;
        },

        // =================================================================
        // DEX FILTER
        // =================================================================

        /**
         * REVISI: Ambil daftar DEX dari KONFIG_APLIKASI yang aktif di pengaturan global.
         * Sidebar hanya menampilkan DEX yang diperbolehkan oleh Setting Global.
         */
        availableDEXFilters() {
            if (!this.config || !this.config.DEXS) return [];
            // Hanya tampilkan DEX yang aktif di pengaturan global
            // FIX: Case-insensitive comparison karena config_dex menggunakan lowercase key
            return Object.keys(this.config.DEXS)
                .filter(dexKey => this.globalSettings?.config_dex?.[dexKey.toLowerCase()]?.status === true);
        },

        /**
         * Get checked status of DEXs from SETTING_FILTER_<CHAIN>
         * Status centang menentukan DEX mana yang aktif untuk filtering
         */
        activeDEXFilters() {
            const filters = this.currentFilterSettings;
            if (!filters.dex) return {};
            return filters.dex;
        },

        // =================================================================
        // PAIR FILTER
        // =================================================================

        /**
         * Get all possible pairs for active chain from KONFIG_APLIKASI
         */
        allPairsForActiveChain() {
            if (!this.activeChain) return [];

            const chainConfig = this.config.CHAINS?.[this.activeChain];
            if (!chainConfig || !chainConfig.PAIR_DEXS) return [];

            return Object.keys(chainConfig.PAIR_DEXS);
        },

        /**
         * REVISI: Get pairs that are actually used by coins in KOIN_<CHAIN>
         * Untuk PAIR, sidebar hanya menampilkan pair yang benar-benar digunakan
         * (berbeda dengan Chain/CEX/DEX yang tampilkan semua)
         */
        availablePairFilters() {
            // This will be populated by loadAvailablePairs() method
            return this._filterCache.availablePairs || [];
        },

        /**
         * Get checked status of pairs from SETTING_FILTER_<CHAIN>
         * Status centang menentukan pair mana yang aktif untuk filtering
         */
        activePairFilters() {
            const filters = this.currentFilterSettings;
            if (!filters.pairs) return {};
            return filters.pairs;
        }
    },

    methods: {
        // =================================================================
        // LOAD AVAILABLE PAIRS FROM KOIN_<CHAIN>
        // =================================================================

        /**
         * Load pairs that are actually used by coins in KOIN_<CHAIN>
         * This method should be called when:
         * - Component is mounted
         * - Active chain changes
         * - Coins are imported/deleted
         */
        async loadAvailablePairs() {
            // Guard: Pastikan aplikasi dan DB sudah siap
            if (!this.$root || !this.$root.isAppInitialized) {
                this._filterCache.availablePairs = [];
                return;
            }

            if (!this.activeChain) {
                this._filterCache.availablePairs = [];
                return;
            }

            try {
                const tokenSource = Array.isArray(this.$root?.allCoins) ? this.$root.allCoins : [];

                if (!tokenSource.length) {
                    this._filterCache.availablePairs = [];
                    return [];
                }

                const usedPairs = new Map();
                const chainConfigs = this.config?.CHAINS || {};

                const resolveChainConfig = (chainKey) => {
                    if (!chainKey) return null;
                    const lower = chainKey.toLowerCase();
                    return chainConfigs[lower] || chainConfigs[chainKey] || null;
                };

                tokenSource.forEach(token => {
                    if (!token || token.id === 'DATA_KOIN') return;
                    const rawPair = token.nama_pair || token.sc_pair;
                    if (!rawPair) return;

                    const normalizedPairKey = String(rawPair).toUpperCase();
                    if (usedPairs.has(normalizedPairKey)) return;

                    const chainConfig = resolveChainConfig(token.chainKey || token.chain);
                    const pairConfig = chainConfig?.PAIR_DEXS?.[normalizedPairKey];
                    usedPairs.set(normalizedPairKey, {
                        key: normalizedPairKey,
                        symbol: pairConfig?.SYMBOL_PAIR || normalizedPairKey,
                        address: pairConfig?.SC_ADDRESS_PAIR || '',
                        decimals: pairConfig?.DECIMALS_PAIR || ''
                    });
                });

                const availablePairs = Array.from(usedPairs.values())
                    .sort((a, b) => a.key.localeCompare(b.key));

                this._filterCache.availablePairs = availablePairs;

                return availablePairs;
            } catch (error) {
                // console.error('[FilterManager] Error loading available pairs:', error);
                this._filterCache.availablePairs = [];
                return [];
            }
        },

        // =================================================================
        // UPDATE FILTER SETTINGS (SIDEBAR ACTIONS)
        // =================================================================

        /**
         * Toggle chain filter status
         * Updates SETTING_FILTER_<CHAIN>.chains
         */
        async toggleChainFilter(chainKey, status = null) {
            if (!this.activeChain) return;

            const filters = this.currentFilterSettings;
            if (!filters.chains) filters.chains = {};

            // Toggle or set status
            if (status === null) {
                filters.chains[chainKey] = !filters.chains[chainKey];
            } else {
                filters.chains[chainKey] = status;
            }

            // Save to database
            await this.saveFilterSettings('chains');

        },

        /**
         * Toggle CEX filter status
         * Updates SETTING_FILTER_<CHAIN>.cex
         */
        async toggleCEXFilter(cexKey, status = null) {
            if (!this.activeChain) return;

            const filters = this.currentFilterSettings;
            if (!filters.cex) filters.cex = {};

            // Toggle or set status
            if (status === null) {
                filters.cex[cexKey] = !filters.cex[cexKey];
            } else {
                filters.cex[cexKey] = status;
            }

            // Save to database
            await this.saveFilterSettings('cex');

        },

        /**
         * Toggle DEX filter status
         * Updates SETTING_FILTER_<CHAIN>.dex
         */
        async toggleDEXFilter(dexKey, status = null) {
            if (!this.activeChain) return;

            const filters = this.currentFilterSettings;
            if (!filters.dex) filters.dex = {};

            // Toggle or set status
            if (status === null) {
                filters.dex[dexKey] = !filters.dex[dexKey];
            } else {
                filters.dex[dexKey] = status;
            }

            // Save to database
            await this.saveFilterSettings('dex');

        },

        /**
         * Toggle pair filter status
         * Updates SETTING_FILTER_<CHAIN>.pairs
         */
        async togglePairFilter(pairKey, status = null) {
            if (!this.activeChain) return;

            const filters = this.currentFilterSettings;
            if (!filters.pairs) filters.pairs = {};

            // Toggle or set status
            if (status === null) {
                filters.pairs[pairKey] = !filters.pairs[pairKey];
            } else {
                filters.pairs[pairKey] = status;
            }

            // Save to database
            await this.saveFilterSettings('pairs');

        },

        /**
         * Select all filters of a specific type
         */
        async selectAllFilters(filterType) {
            if (!this.activeChain) return;

            const filters = this.currentFilterSettings;

            switch (filterType) {
                case 'chains':
                    if (!filters.chains) filters.chains = {};
                    this.availableChainFilters.forEach(key => {
                        filters.chains[key] = true;
                    });
                    break;

                case 'cex':
                    if (!filters.cex) filters.cex = {};
                    this.availableCEXFilters.forEach(key => {
                        filters.cex[key] = true;
                    });
                    break;

                case 'dex':
                    if (!filters.dex) filters.dex = {};
                    this.availableDEXFilters.forEach(key => {
                        filters.dex[key] = true;
                    });
                    break;

                case 'pairs':
                    if (!filters.pairs) filters.pairs = {};
                    this.availablePairFilters.forEach(pair => {
                        filters.pairs[pair.key] = true;
                    });
                    break;
            }

            await this.saveFilterSettings(filterType);
        },

        /**
         * Deselect all filters of a specific type
         */
        async deselectAllFilters(filterType) {
            if (!this.activeChain) return;

            const filters = this.currentFilterSettings;

            switch (filterType) {
                case 'chains':
                    if (!filters.chains) filters.chains = {};
                    this.availableChainFilters.forEach(key => {
                        filters.chains[key] = false;
                    });
                    break;

                case 'cex':
                    if (!filters.cex) filters.cex = {};
                    this.availableCEXFilters.forEach(key => {
                        filters.cex[key] = false;
                    });
                    break;

                case 'dex':
                    if (!filters.dex) filters.dex = {};
                    this.availableDEXFilters.forEach(key => {
                        filters.dex[key] = false;
                    });
                    break;

                case 'pairs':
                    if (!filters.pairs) filters.pairs = {};
                    this.availablePairFilters.forEach(pair => {
                        filters.pairs[pair.key] = false;
                    });
                    break;
            }

            await this.saveFilterSettings(filterType);
        },

        // =================================================================
        // SAVE FILTER SETTINGS
        // =================================================================

        /**
         * Save filter settings to SETTING_FILTER_<CHAIN>
         * This is called by sidebar when user toggles filters
         */
        async saveFilterSettings(field = 'unknown') {
            // Guard: Pastikan aplikasi dan DB sudah siap
            if (!this.$root || !this.$root.isAppInitialized) {
                return;
            }

            if (!this.activeChain) {
                // console.warn('[FilterManager] Cannot save: no active chain');
                return;
            }

            try {
                const normalizedField = ['chains', 'cex', 'dex'].includes(field) ? field : null;
                const constraintsChanged = this.applyFilterConstraints(normalizedField);
                if (constraintsChanged) {
                }

                // Clone data to remove Vue reactivity
                const plainData = JSON.parse(JSON.stringify(this.currentFilterSettings));

                const dataToSave = {
                    ...plainData,
                    chainKey: this.activeChain,
                    key: 'SETTING_FILTER'
                };

                // Save to database - pass key as third parameter
                const storeName = DB.getStoreNameByChain('SETTING_FILTER', this.activeChain);
                await DB.saveData(storeName, dataToSave, 'SETTING_FILTER');


                // FIX: Tampilkan toast notification untuk user feedback
                // Skip toast untuk operasi internal (initialize, global-sync)
                if (this.$root && this.$root.showToast && !['unknown', 'initialize', 'global-sync'].includes(field)) {
                    const filterTypeLabel = {
                        'chains': 'Chain',
                        'cex': 'CEX',
                        'dex': 'DEX',
                        'pairs': 'Pair DEX'
                    };
                    const label = filterTypeLabel[field] || 'Filter';
                    this.$root.showToast(`✓ Pengaturan ${label} berhasil disimpan`, 'success', 2000);
                }
            } catch (error) {
                // console.error('[FilterManager] Error saving filter settings:', error);
                if (this.$root && this.$root.showToast) {
                    this.$root.showToast('Gagal menyimpan pengaturan filter', 'danger');
                }
            }
        },

        /**
         * Sinkronisasi state filter dengan opsi yang diperbolehkan oleh pengaturan global.
         * @param {('chains'|'cex'|'dex'|null)} filterType - Jenis filter yang ingin dinormalisasi. Null = semua.
         * @returns {boolean} - True jika ada perubahan pada state filter.
         */
        applyFilterConstraints(filterType = null) {
            if (!this.$root || !this.currentFilterSettings) {
                return false;
            }

            const allowedTypes = ['chains', 'cex', 'dex'];
            const typesToProcess = filterType
                ? (allowedTypes.includes(filterType) ? [filterType] : [])
                : allowedTypes;

            if (typesToProcess.length === 0) {
                return false;
            }

            const filterSettings = this.currentFilterSettings;
            const rootFilters = this.$root.filters || {};
            let hasChanges = false;

            const availableMap = {
                chains: this.availableChainFilters,
                cex: this.availableCEXFilters,
                dex: this.availableDEXFilters
            };

            const ensureMap = (container, key) => {
                if (!container[key] || typeof container[key] !== 'object') {
                    container[key] = {};
                }
                return container[key];
            };

            typesToProcess.forEach(type => {
                const allowedKeys = availableMap[type] || [];
                const allowedSet = new Set(allowedKeys);

                const targetMap = ensureMap(filterSettings, type);
                const rootMap = ensureMap(rootFilters, type);

                Object.keys(targetMap).forEach(key => {
                    if (!allowedSet.has(key)) {
                        delete targetMap[key];
                        hasChanges = true;
                    }
                });

                Object.keys(rootMap).forEach(key => {
                    if (!allowedSet.has(key)) {
                        delete rootMap[key];
                        hasChanges = true;
                    }
                });

                allowedKeys.forEach(key => {
                    if (!(key in targetMap)) {
                        targetMap[key] = true;
                        hasChanges = true;
                    }
                    if (!(key in rootMap)) {
                        rootMap[key] = targetMap[key];
                        hasChanges = true;
                    }
                });

                allowedKeys.forEach(key => {
                    if (rootMap[key] !== targetMap[key]) {
                        rootMap[key] = targetMap[key];
                    }
                });
            });

            return hasChanges;
        },

        // =================================================================
        // HELPER METHODS
        // =================================================================

        /**
         * Check if a filter is active
         */
        isFilterActive(filterType, key) {
            const filters = this.currentFilterSettings;

            switch (filterType) {
                case 'chains':
                    return filters.chains?.[key] === true;
                case 'cex':
                    return filters.cex?.[key] === true;
                case 'dex':
                    return filters.dex?.[key] === true;
                case 'pairs':
                    return filters.pairs?.[key] === true;
                default:
                    return false;
            }
        },

        /**
         * Get count of active filters
         */
        getActiveFilterCount(filterType) {
            const filters = this.currentFilterSettings;

            let filterObj = {};
            switch (filterType) {
                case 'chains':
                    filterObj = filters.chains || {};
                    break;
                case 'cex':
                    filterObj = filters.cex || {};
                    break;
                case 'dex':
                    filterObj = filters.dex || {};
                    break;
                case 'pairs':
                    filterObj = filters.pairs || {};
                    break;
            }

            return Object.values(filterObj).filter(v => v === true).length;
        },

        /**
         * Initialize filters with defaults if not exists
         */
        async initializeFilters() {
            // Guard: Pastikan aplikasi dan DB sudah siap
            if (!this.$root || !this.$root.isAppInitialized) {
                this._pendingFilterInit = true;
                return;
            }

            if (!this.activeChain) return;

            const filters = this.currentFilterSettings;
            const currentChain = this.activeChain;

            if (!filters || filters.chainKey !== currentChain || Object.keys(filters).length <= 2) {
                //     chain: currentChain,
                //     hasChainKey: !!filters?.chainKey
                // });
                this._pendingFilterInit = true;
                return;
            }

            if (!this._pendingFilterInit && this._lastInitializedChain === currentChain) {
                return;
            }

            let needsSave = false;

            // Initialize chains filter
            if (!filters.chains) {
                filters.chains = {};
                this.availableChainFilters.forEach(key => {
                    filters.chains[key] = true;
                });
                needsSave = true;
            }

            // Initialize CEX filter
            if (!filters.cex) {
                filters.cex = {};
                this.availableCEXFilters.forEach(key => {
                    filters.cex[key] = true;
                });
                needsSave = true;
            }

            // Initialize DEX filter
            if (!filters.dex) {
                filters.dex = {};
                this.availableDEXFilters.forEach(key => {
                    filters.dex[key] = true;
                });
                needsSave = true;
            }

            // Initialize pairs filter
            // REVISI: Cek juga pair baru yang belum ada di setting
            await this.loadAvailablePairs();
            if (!filters.pairs) filters.pairs = {};

            this.availablePairFilters.forEach(pair => {
                // Jika pair ini belum ada di setting filter,
                // maka default-kan menjadi tercentang (true).
                if (filters.pairs[pair.key] === undefined) {
                    filters.pairs[pair.key] = true;
                    needsSave = true;
                }
            });

            const constraintsSynced = this.applyFilterConstraints();
            if (constraintsSynced) {
                needsSave = true;
            }

            if (needsSave) {
                await this.saveFilterSettings('initialize');
            }

            this._pendingFilterInit = false;
            this._lastInitializedChain = currentChain;
        }
    },

    watch: {
        // Reload available pairs when active chain changes
        activeChain: {
            immediate: false,
            handler(newChain, oldChain) {
                if (newChain && newChain !== oldChain) {
                    this._pendingFilterInit = true;
                    this._lastInitializedChain = null;
                    this.loadAvailablePairs();
                }
            }
        },

    // REVISI: Tambahkan watcher untuk allCoins untuk mengatasi race condition.
    // Ini memastikan filter pair diinisialisasi ulang setelah data koin selesai dimuat.
    '$root.allCoins': {
      deep: false, // Tidak perlu deep watch, hanya perlu tahu saat array berubah
      handler(newCoins, oldCoins) {
        if (newCoins.length > 0 && oldCoins.length === 0) {
          // Panggil kembali inisialisasi filter, yang sekarang akan memiliki
          // akses ke `availablePairFilters` yang sudah terisi.
          this.initializeFilters();
        }
      }
    },

        // Watch untuk status inisialisasi aplikasi
        '$root.isAppInitialized': {
            handler(isInitialized) {
                if (isInitialized) {
                    this.loadAvailablePairs();
                    this.initializeFilters();
                }
            }
        },

        '$root.filterSettings': {
            deep: true,
            handler(newSettings) {
                if (!this.$root || !this.$root.isAppInitialized) return;
                if (!newSettings) return;

                const currentChain = this.activeChain;
                if (!currentChain) return;

                if (newSettings.chainKey !== currentChain) {
                    // Chain lain sedang dimuat, mark agar chain aktif diinisialisasi ulang nanti.
                    this._pendingFilterInit = true;
                    return;
                }

                if (this._pendingFilterInit || this._lastInitializedChain !== currentChain) {
                    this.initializeFilters();
                }
            }
        },

        // Sinkronkan filter saat pengaturan global berubah
        '$root.globalSettings': {
            deep: true,
            handler(newSettings) {
                if (!this.$root || !this.$root.isAppInitialized) return;
                if (!newSettings) return;

                const hasFilterState = this.currentFilterSettings && Object.keys(this.currentFilterSettings).length > 0;
                if (!hasFilterState) return;

                const changed = this.applyFilterConstraints();
                if (changed) {
                    this.saveFilterSettings('global-sync').catch(error => {
                        // console.error('[FilterManager] Gagal menyimpan filter setelah sinkron global:', error);
                    });
                }
            }
        }
    },

    async mounted() {

        // Hanya load jika aplikasi sudah siap
        if (this.$root && this.$root.isAppInitialized) {
            // Load available pairs for current chain
            await this.loadAvailablePairs();

            // Initialize filters if needed
            await this.initializeFilters();
        } else {
        }
    }
};

// Export
if (typeof window !== 'undefined') {
    window.filterManagerMixin = filterManagerMixin;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { filterManagerMixin };
}
