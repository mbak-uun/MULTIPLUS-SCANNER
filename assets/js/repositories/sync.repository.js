/**
 * ===================================================================================
 * Sync Repository
 * ===================================================================================
 *
 * Mengelola data sync koin di IndexedDB (SYNC_KOIN_<CHAIN>).
 * Cache sementara untuk koin dari API CEX sebelum di-import ke KOIN.
 */
class SyncRepository extends BaseRepository {
    constructor(dbService) {
        super(dbService);
    }

    /**
     * Get store name untuk chain tertentu
     * @param {string} chainKey
     * @returns {string}
     */
    _getStoreName(chainKey) {
        // Build store name directly (same logic as db.js)
        const normalizedChain = chainKey.toLowerCase();
        if (normalizedChain === 'multi') {
            return 'SYNC_KOIN_MULTI';
        }
        return `SYNC_KOIN_${chainKey.toUpperCase()}`;
    }

    /**
     * Get all sync coins untuk chain tertentu
     * @param {string} chainKey
     * @returns {Promise<Array>}
     */
    async getAllByChain(chainKey) {
        const storeName = this._getStoreName(chainKey);
        return await this.getAll(storeName);
    }

    /**
     * Save sync coin
     * @param {string} chainKey
     * @param {object} coin
     * @returns {Promise<object>}
     */
    async saveSyncCoin(chainKey, coin) {
        const storeName = this._getStoreName(chainKey);

        // Generate ID if not exists
        if (!coin.id) {
            coin.id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        }

        return await this.save(storeName, coin);
    }

    /**
     * Delete sync coin
     * @param {string} chainKey
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async deleteSyncCoin(chainKey, id) {
        const storeName = this._getStoreName(chainKey);
        return await this.delete(storeName, id);
    }

    /**
     * Get sync coins by CEX
     * @param {string} chainKey
     * @param {string} cexName
     * @returns {Promise<Array>}
     */
    async getByCex(chainKey, cexName) {
        const coins = await this.getAllByChain(chainKey);
        const normalizedCex = String(cexName || '').toUpperCase();

        return coins.filter(c =>
            String(c.cex || '').toUpperCase() === normalizedCex
        );
    }

    /**
     * Get new sync coins (isNew === true)
     * @param {string} chainKey
     * @returns {Promise<Array>}
     */
    async getNewCoins(chainKey) {
        const coins = await this.getAllByChain(chainKey);
        return coins.filter(c => c.isNew === true);
    }

    /**
     * Mark coins as not new
     * @param {string} chainKey
     * @param {Array<string>} ids
     * @returns {Promise<Array>}
     */
    async markAsNotNew(chainKey, ids) {
        const results = [];
        for (const id of ids) {
            try {
                const coin = await this.getById(this._getStoreName(chainKey), id);
                if (coin) {
                    coin.isNew = false;
                    await this.saveSyncCoin(chainKey, coin);
                    results.push({ success: true, id });
                }
            } catch (error) {
                results.push({ success: false, id, error: error.message });
            }
        }
        return results;
    }

    /**
     * Clear all sync data untuk chain tertentu
     * @param {string} chainKey
     * @returns {Promise<boolean>}
     */
    async clearAllByChain(chainKey) {
        const storeName = this._getStoreName(chainKey);
        return await this.deleteAll(storeName);
    }

    /**
     * Batch save sync coins
     * @param {string} chainKey
     * @param {Array} coins
     * @returns {Promise<Array>}
     */
    async batchSave(chainKey, coins) {
        const results = [];
        for (const coin of coins) {
            try {
                const saved = await this.saveSyncCoin(chainKey, coin);
                results.push({ success: true, coin: saved });
            } catch (error) {
                results.push({ success: false, error: error.message, coin });
            }
        }
        return results;
    }
}

// Export
if (typeof window !== 'undefined') {
    window.SyncRepository = SyncRepository;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SyncRepository };
}
