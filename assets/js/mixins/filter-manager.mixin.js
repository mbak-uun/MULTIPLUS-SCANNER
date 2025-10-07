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
            }
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
         * REVISI: Get all chains from KONFIG_APLIKASI
         * Sidebar SELALU menampilkan SEMUA chain yang ada di config
         */
        availableChainFilters() {
            if (!this.config || !this.config.CHAINS) return [];
            // Hanya tampilkan chain yang aktif di pengaturan global
            return Object.keys(this.config.CHAINS)
                .filter(chainKey => this.globalSettings?.config_chain?.[chainKey]?.status === true);
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
         * REVISI: Get all CEXs from KONFIG_APLIKASI
         * Sidebar SELALU menampilkan SEMUA CEX yang ada di config
         */
        availableCEXFilters() {
            if (!this.config || !this.config.CEX) return [];
            // Hanya tampilkan CEX yang aktif di pengaturan global
            return Object.keys(this.config.CEX)
                .filter(cexKey => this.globalSettings?.config_cex?.[cexKey]?.status === true);
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
         * REVISI: Get all DEXs from KONFIG_APLIKASI
         * Sidebar SELALU menampilkan SEMUA DEX yang ada di config
         */
        availableDEXFilters() {
            if (!this.config || !this.config.DEXS) return [];
            // Hanya tampilkan DEX yang aktif di pengaturan global
            return Object.keys(this.config.DEXS)
                .filter(dexKey => this.globalSettings?.config_dex?.[dexKey]?.status === true);
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
                console.log('[FilterManager] Load pairs ditunda, aplikasi belum terinisialisasi.');
                this._filterCache.availablePairs = [];
                return;
            }

            if (!this.activeChain) {
                this._filterCache.availablePairs = [];
                return;
            }

            try {
                const storeName = DB.getStoreNameByChain('KOIN', this.activeChain);
                const coins = await DB.getAllData(storeName);

                // Get unique pairs that are used by coins
                const usedPairs = new Set();

                coins.forEach(coin => {
                    if (coin.id === 'DATA_KOIN') return; // Skip snapshot

                    // Get pair symbol from coin
                    const pairSymbol = coin.nama_pair || coin.sc_pair;
                    if (pairSymbol) {
                        usedPairs.add(pairSymbol);
                    }
                });

                // Convert to array and match with KONFIG_APLIKASI
                const availablePairs = [];
                const allPairs = this.allPairsForActiveChain;

                allPairs.forEach(pairKey => {
                    const pairConfig = this.config.CHAINS[this.activeChain].PAIR_DEXS[pairKey];
                    const pairSymbol = pairConfig?.SYMBOL_PAIR;

                    // Include pair if it's used by at least one coin
                    if (usedPairs.has(pairSymbol) || usedPairs.has(pairKey)) {
                        availablePairs.push({
                            key: pairKey,
                            symbol: pairSymbol,
                            address: pairConfig?.SC_ADDRESS_PAIR,
                            decimals: pairConfig?.DECIMALS_PAIR
                        });
                    }
                });

                this._filterCache.availablePairs = availablePairs;
                console.log(`[FilterManager] Loaded ${availablePairs.length} available pairs for ${this.activeChain}`);

                return availablePairs;
            } catch (error) {
                console.error('[FilterManager] Error loading available pairs:', error);
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

            console.log(`[FilterManager] Chain filter ${chainKey} = ${filters.chains[chainKey]}`);
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

            console.log(`[FilterManager] CEX filter ${cexKey} = ${filters.cex[cexKey]}`);
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

            console.log(`[FilterManager] DEX filter ${dexKey} = ${filters.dex[dexKey]}`);
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

            console.log(`[FilterManager] Pair filter ${pairKey} = ${filters.pairs[pairKey]}`);
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
            console.log(`[FilterManager] Selected all ${filterType} filters`);
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
            console.log(`[FilterManager] Deselected all ${filterType} filters`);
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
                console.log('[FilterManager] Save ditunda, aplikasi belum terinisialisasi.');
                return;
            }

            if (!this.activeChain) {
                console.warn('[FilterManager] Cannot save: no active chain');
                return;
            }

            try {
                const normalizedField = ['chains', 'cex', 'dex'].includes(field) ? field : null;
                const constraintsChanged = this.applyFilterConstraints(normalizedField);
                if (constraintsChanged) {
                    console.log(`[FilterManager] Filter constraints updated before saving (field: ${field})`);
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

                console.log(`[FilterManager] Filter settings saved for ${this.activeChain}, field: ${field}`);
            } catch (error) {
                console.error('[FilterManager] Error saving filter settings:', error);
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
                console.log('[FilterManager] Initialize filters ditunda, aplikasi belum terinisialisasi.');
                return;
            }

            if (!this.activeChain) return;

            const filters = this.currentFilterSettings;
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
            if (!filters.pairs) {
                filters.pairs = {};
                await this.loadAvailablePairs();
                this.availablePairFilters.forEach(pair => {
                    filters.pairs[pair.key] = true;
                });
                needsSave = true;
            }

            const constraintsSynced = this.applyFilterConstraints();
            if (constraintsSynced) {
                needsSave = true;
            }

            if (needsSave) {
                await this.saveFilterSettings('initialize');
                console.log('[FilterManager] Filters initialized with defaults');
            }
        }
    },

    watch: {
        // Reload available pairs when active chain changes
        activeChain: {
            immediate: false,
            handler(newChain, oldChain) {
                if (newChain && newChain !== oldChain) {
                    console.log(`[FilterManager] Chain changed to ${newChain}, reloading pairs`);
                    this.loadAvailablePairs();
                }
            }
        },

        // Watch untuk status inisialisasi aplikasi
        '$root.isAppInitialized': {
            handler(isInitialized) {
                if (isInitialized) {
                    console.log('[FilterManager] Aplikasi terinisialisasi, memuat filter data.');
                    this.loadAvailablePairs();
                    this.initializeFilters();
                }
            }
        }
    },

    async mounted() {
        console.log('[FilterManager] Mixin mounted');

        // Hanya load jika aplikasi sudah siap
        if (this.$root && this.$root.isAppInitialized) {
            // Load available pairs for current chain
            await this.loadAvailablePairs();

            // Initialize filters if needed
            await this.initializeFilters();
        } else {
            console.log('[FilterManager] Mounted, menunggu aplikasi siap...');
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
