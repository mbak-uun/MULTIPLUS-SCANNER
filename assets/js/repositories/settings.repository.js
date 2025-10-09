/**
 * ===================================================================================
 * Settings Repository
 * ===================================================================================
 *
 * Mengelola settings global dan filter settings di IndexedDB.
 */
class SettingsRepository extends BaseRepository {
    constructor(dbService) {
        super(dbService);
        this.GLOBAL_STORE = 'SETTING_GLOBAL';
        this.GLOBAL_KEY = 'SETTING_GLOBAL';
    }

    /**
     * Get global settings
     * @returns {Promise<object|null>}
     */
    async getGlobal() {
        try {
            return await this.db.getData(this.GLOBAL_STORE, this.GLOBAL_KEY);
        } catch (error) {
            console.error('[SettingsRepository] getGlobal error:', error);
            return null;
        }
    }

    /**
     * Save global settings
     * @param {object} settings
     * @returns {Promise<object>}
     */
    async saveGlobal(settings) {
        const dataToSave = {
            ...settings,
            key: this.GLOBAL_KEY
        };
        // FIX: Teruskan kunci statis sebagai argumen ketiga
        return await this.save(this.GLOBAL_STORE, dataToSave, this.GLOBAL_KEY);
    }

    /**
     * Get filter settings untuk chain tertentu
     * @param {string} chainKey
     * @returns {Promise<object|null>}
     */
    async getFilterSettings(chainKey) {
        const storeName = DB.getStoreNameByChain('SETTING_FILTER', chainKey);
        try {
            return await this.db.getData(storeName, 'SETTING_FILTER');
        } catch (error) {
            console.error(`[SettingsRepository] getFilterSettings(${chainKey}) error:`, error);
            return null;
        }
    }

    /**
     * Save filter settings untuk chain tertentu
     * @param {string} chainKey
     * @param {object} filterSettings
     * @returns {Promise<object>}
     */
    async saveFilterSettings(chainKey, filterSettings) {
        const storeName = DB.getStoreNameByChain('SETTING_FILTER', chainKey);
        const dataToSave = {
            ...filterSettings,
            key: 'SETTING_FILTER',
            chainKey: chainKey
        };
        // FIX: Teruskan kunci statis "SETTING_FILTER" sebagai argumen ketiga ke metode save.
        return await this.save(storeName, dataToSave, 'SETTING_FILTER');
    }

    /**
     * Check if global settings exists
     * @returns {Promise<boolean>}
     */
    async hasGlobalSettings() {
        const settings = await this.getGlobal();
        return settings !== null && settings !== undefined;
    }

    /**
     * Get active chains dari global settings
     * @returns {Promise<Array<string>>}
     */
    async getActiveChains() {
        const settings = await this.getGlobal();
        if (!settings || !settings.config_chain) {
            return [];
        }

        return Object.keys(settings.config_chain)
            .filter(key => settings.config_chain[key]?.status === true);
    }

    /**
     * Get active CEXs dari global settings
     * @returns {Promise<Array<string>>}
     */
    async getActiveCexs() {
        const settings = await this.getGlobal();
        if (!settings || !settings.config_cex) {
            return [];
        }

        return Object.keys(settings.config_cex)
            .filter(key => settings.config_cex[key]?.status === true);
    }

    /**
     * Get active DEXs dari global settings
     * @returns {Promise<Array<string>>}
     */
    async getActiveDexs() {
        const settings = await this.getGlobal();
        if (!settings || !settings.config_dex) {
            return [];
        }

        return Object.keys(settings.config_dex)
            .filter(key => settings.config_dex[key]?.status === true);
    }
}

// Export
if (typeof window !== 'undefined') {
    window.SettingsRepository = SettingsRepository;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SettingsRepository };
}
