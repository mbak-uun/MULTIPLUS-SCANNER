/**
 * ===================================================================================
 * Coin Repository
 * ===================================================================================
 *
 * Mengelola data koin di IndexedDB (KOIN_<CHAIN>).
 * Abstraksi untuk semua operasi CRUD koin.
 */
class CoinRepository extends BaseRepository {
    constructor(dbService) {
        super(dbService);
    }

    /**
     * Get store name untuk chain tertentu
     * @param {string} chainKey
     * @returns {string}
     */
    _getStoreName(chainKey) {
        const normalizedChain = String(chainKey || '').toUpperCase();
        if (!normalizedChain) {
            throw new Error('[CoinRepository] Chain key is required to resolve store name.');
        }

        if (normalizedChain === 'MULTI') {
            return 'KOIN_MULTI';
        }
        return `KOIN_${normalizedChain}`;
    }

    /**
     * Get coin by ID
     * @param {string} chainKey
     * @param {string} id
     * @returns {Promise<object|null>}
     */
    async getCoinById(chainKey, id) {
        const storeName = this._getStoreName(chainKey);
        return await this.getById(storeName, id);
    }

    /**
     * Save or update a coin record.
     * This method normalizes the chain key and calls the base save method with correct arguments.
     * @param {object} data The coin data to save. Must contain a 'chain' property.
     * @returns {Promise<object>}
     */
    async save(data) {
        // PERBAIKAN: Pastikan chain ada dan dalam format yang benar.
        const chainKey = String(data.chain || data.chainKey || '').toUpperCase();
        if (!chainKey) {
            throw new Error("Coin data must have a 'chain' property.");
        }
        const storeName = this._getStoreName(chainKey);
        const payload = {
            ...data,
            chain: chainKey
        };

        // PERBAIKAN: Argumen untuk super.save adalah (storeName, data), bukan sebaliknya.
        return super.save(storeName, payload);
    }

    /**
     * Delete coin by ID and chain.
     * This method overrides the base delete to provide a more specific interface for coins.
     * @param {string} id
     * @param {string} chainKey
     * @returns {Promise<boolean>}
     */
    async delete(id, chainKey) {
        const storeName = this._getStoreName(chainKey);
        return await super.delete(storeName, id);
    }

    /**
     * Find coin by CEX, token SC, and pair SC
     * @param {string} chainKey
     * @param {string} cexName
     * @param {string} scToken
     * @param {string} scPair
     * @returns {Promise<object|null>}
     */
    async findByCexAndTokenPair(chainKey, cexName, scToken, scPair) {
        const coins = await this.getAllByChain(chainKey);
        const normalizedCex = String(cexName || '').toUpperCase();
        const normalizedScToken = String(scToken || '').toLowerCase();
        const normalizedScPair = String(scPair || '').toLowerCase();

        return coins.find(c =>
            String(c.cex_name || '').toUpperCase() === normalizedCex &&
            String(c.sc_token || '').toLowerCase() === normalizedScToken &&
            String(c.sc_pair || '').toLowerCase() === normalizedScPair
        ) || null;
    }

    /**
     * Find coins by CEX
     * @param {string} chainKey
     * @param {string} cexName
     * @returns {Promise<Array>}
     */
    async findByCex(chainKey, cexName) {
        const coins = await this.getAllByChain(chainKey);
        const normalizedCex = String(cexName || '').toUpperCase();

        return coins.filter(c =>
            String(c.cex_name || '').toUpperCase() === normalizedCex
        );
    }

    /**
     * Get all coins for a specific chain.
     * @param {string} chainKey
     * @returns {Promise<Array>}
     */
    async getAllByChain(chainKey) {
        const storeName = this._getStoreName(chainKey);
        // Panggil getAll dari BaseRepository
        return await super.getAll(storeName);
    }


    /**
     * Find favorite coins
     * @param {string} chainKey
     * @returns {Promise<Array>}
     */
    async findFavorites(chainKey) {
        const coins = await this.getAllByChain(chainKey);
        return coins.filter(c => c.isFavorite === true);
    }

    /**
     * Toggle favorite status
     * @param {string} chainKey
     * @param {string} id
     * @returns {Promise<object>}
     */
    async toggleFavorite(chainKey, id) {
        const coin = await this.getById(this._getStoreName(chainKey), id);
        if (!coin) {
            throw new Error(`Coin not found: ${id}`);
        }
        coin.isFavorite = !coin.isFavorite;
        return await this.save(coin);
    }

    /**
     * Update coin status
     * @param {string} chainKey
     * @param {string} id
     * @param {boolean} status
     * @returns {Promise<object>}
     */
    async updateStatus(chainKey, id, status) {
        const coin = await this.getById(this._getStoreName(chainKey), id);
        if (!coin) {
            throw new Error(`Coin not found: ${id}`);
        }
        coin.status = status;
        return await this.save(coin);
    }

    /**
     * Batch save coins
     * @param {string} chainKey
     * @param {Array} coins
     * @returns {Promise<Array>}
     */
    async batchSave(chainKey, coins) {
        const results = [];
        for (const coin of coins) {
            try {
                const saved = await this.save({ ...coin, chain: chainKey });
                results.push({ success: true, coin: saved });
            } catch (error) {
                results.push({ success: false, error: error.message, coin });
            }
        }
        return results;
    }

    /**
     * Count coins by chain
     * @param {string} chainKey
     * @returns {Promise<number>}
     */
    async countByChain(chainKey) {
        const storeName = this._getStoreName(chainKey);
        return await this.count(storeName);
    }
}

// Export
if (typeof window !== 'undefined') {
    window.CoinRepository = CoinRepository;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CoinRepository };
}
