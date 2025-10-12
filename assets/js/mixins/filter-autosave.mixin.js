/**
 * ===================================================================================
 * Filter Auto-Save Mixin
 * ===================================================================================
 *
 * Mixin untuk autosave dan autoload filter settings dari IndexedDB.
 * Digunakan oleh scanning-tab dan management-tab.
 *
 * FITUR:
 * - Auto-load filter settings saat component mounted
 * - Auto-save filter settings setiap kali ada perubahan
 * - Debounce untuk input field (500ms)
 * - Immediate save untuk checkbox
 * - Watch activeChain untuk reload settings
 */

const filterAutoSaveMixin = {
    data() {
        return {
            // Debounce timers untuk setiap field
            _filterSaveTimers: {},
            _isLoadingFilters: false
        };
    },

    computed: {
        // Akses ke settings repository
        settingsRepo() {
            return window.AppContainer?.get('settingsRepository') || null;
        },

        // Current active chain
        activeChain() {
            return this.$root.activeChain;
        },

        // Filter settings dari root
        filters() {
            return this.$root.filters || {};
        },

        filterSettings() {
            return this.$root.filterSettings || {};
        }
    },

    methods: {
        /**
         * Load filter settings dari IndexedDB
         */
        async loadFilterSettings() {
            // PERBAIKAN: Tambahkan guard untuk memastikan aplikasi dan DB sudah siap.
            // Ini mencegah race condition saat komponen dimuat sebelum DB diinisialisasi.
            if (!this.$root.isAppInitialized) {
                return;
            }
            if (!this.activeChain || this._isLoadingFilters) {
                return;
            }

            this._isLoadingFilters = true;

            try {
                let settings = null;

                // Gunakan repository jika tersedia
                if (this.settingsRepo) {
                    settings = await this.settingsRepo.getFilterSettings(this.activeChain);
                } else {
                    // Fallback ke DB langsung
                    const storeName = `SETTING_FILTER_${this.activeChain.toUpperCase()}`;
                    settings = await DB.getData(storeName, 'SETTING_FILTER');
                }

                if (settings) {
                    // Merge dengan default filters dari root
                    this.$root.filters = {
                        ...this.$root.filters,
                        ...settings
                    };

                    // Update filterSettings juga (untuk backward compatibility)
                    this.$root.filterSettings = {
                        ...this.$root.filterSettings,
                        ...settings
                    };

                } else {
                }
            } catch (error) {
                // console.error(`[FilterAutoSave] Error loading filter settings:`, error);
            } finally {
                this._isLoadingFilters = false;
            }
        },

        /**
         * Save filter settings ke IndexedDB dengan debounce
         * @param {string} field - Field yang berubah (untuk logging)
         * @param {boolean} immediate - Langsung save tanpa debounce
         */
        async saveFilterSettings(field = 'unknown', immediate = false) {
            if (!this.activeChain) {
                // console.warn(`[FilterAutoSave] Cannot save: no active chain`);
                return;
            }

            if (this.$root && typeof this.$root.scheduleFilterStatsRefresh === 'function') {
                this.$root.scheduleFilterStatsRefresh();
            }

            const debounceTime = immediate ? 0 : 500;

            // Clear existing timer untuk field ini
            if (this._filterSaveTimers[field]) {
                clearTimeout(this._filterSaveTimers[field]);
            }

            // Set timer baru
            this._filterSaveTimers[field] = setTimeout(async () => {

                try {
                    // PERBAIKAN: Clone data menggunakan JSON untuk menghilangkan Vue reactivity
                    const plainData = JSON.parse(JSON.stringify(this.filters));

                    const dataToSave = {
                        ...plainData,
                        chainKey: this.activeChain,
                        // FIX: Pastikan 'key' selalu ada sesuai skema DB
                        key: 'SETTING_FILTER'
                    };

                    // Gunakan repository jika tersedia
                    if (this.settingsRepo) {
                        await this.settingsRepo.saveFilterSettings(this.activeChain, dataToSave);
                    } else {
                        // Fallback ke DB langsung
                        const storeName = `SETTING_FILTER_${this.activeChain.toUpperCase()}`;
                        await DB.saveData(storeName, dataToSave);
                    }

                } catch (error) {
                    // console.error(`[FilterAutoSave] Error saving filter settings:`, error);
                    if (this.$root.showToast) {
                        this.$root.showToast('Gagal menyimpan pengaturan filter', 'danger');
                    }
                }
            }, debounceTime);
        },

        /**
         * Save filter change (wrapper untuk backward compatibility)
         * Checkbox akan langsung disave, input field akan di-debounce
         * @param {string} field
         */
        saveFilter(field) {
            // Tentukan apakah field ini adalah checkbox (immediate) atau input (debounced)
            const immediateFields = ['favoritOnly', 'autorun', 'autoscroll', 'darkMode', 'run'];
            const immediate = immediateFields.includes(field);

            if (this.$root && typeof this.$root.scheduleFilterStatsRefresh === 'function') {
                this.$root.scheduleFilterStatsRefresh();
            }

            this.saveFilterSettings(field, immediate);
        },

        /**
         * Reset filter ke default
         */
        async resetFilterSettings() {
            if (!confirm('Reset filter settings ke default?')) return;


            // Reset ke default dari root
            this.$root.filters = this.$root.getDefaultFilters();
            this.$root.filterSettings = this.$root.getDefaultFilters();

            // Save ke DB
            await this.saveFilterSettings('reset', true);

            if (this.$root.showToast) {
                this.$root.showToast('Filter settings telah direset', 'success');
            }

            if (this.$root && typeof this.$root.scheduleFilterStatsRefresh === 'function') {
                this.$root.scheduleFilterStatsRefresh();
            }
        }
    },

    watch: {
        // Auto-reload filter settings saat activeChain berubah oleh user
        activeChain: {
            immediate: false,
            handler(newChain, oldChain) {
                if (newChain && newChain !== oldChain) {
                    this.loadFilterSettings();
                }
            }
        },
        // PERBAIKAN: Tambahkan watcher untuk status inisialisasi aplikasi.
        // Jika komponen sudah dimuat tapi aplikasi belum siap, watcher ini akan
        // memicu pemuatan filter setelah aplikasi siap.
        '$root.isAppInitialized': {
            handler(isInitialized) {
                if (isInitialized) {
                    this.loadFilterSettings();
                }
            }
        }
    },

    mounted() {

        // FIX: Skip load jika sudah diload oleh settings.js (untuk menghindari double load)
        // Cek apakah filterSettings sudah ada dan populated (lebih dari 2 keys: key + chainKey)
        const isAlreadyLoaded = this.$root.filterSettings &&
                               Object.keys(this.$root.filterSettings).length > 2;

        if (isAlreadyLoaded) {
            return;
        }

        // Load filter settings saat component pertama kali dimuat
        this.loadFilterSettings();
    },

    beforeUnmount() {
        // Clear all timers
        Object.values(this._filterSaveTimers).forEach(timer => clearTimeout(timer));
        this._filterSaveTimers = {};
    }
};

// Export
if (typeof window !== 'undefined') {
    window.filterAutoSaveMixin = filterAutoSaveMixin;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { filterAutoSaveMixin };
}
