// assets/js/core/api/price-cache.js
// Specialized price caching service for sharing price data across portfolio and scanner

const PriceCache = (() => {
  class PriceCacheService {
    constructor() {
      // Price cache storage
      this.prices = new Map();

      // Default TTL for prices: 60 seconds
      this.defaultTTL = 60000;

      // Track which tokens are being fetched to prevent duplicates
      this.fetchingTokens = new Map();

      // Statistics
      this.stats = {
        hits: 0,
        misses: 0,
        updates: 0
      };
    }

    /**
     * Generate price cache key
     * @param {string} chain - Chain key
     * @param {string} tokenId - Token ID or symbol
     * @param {string} cex - CEX name
     * @returns {string}
     */
    generateKey(chain, tokenId, cex) {
      return `${chain}:${tokenId}:${cex}`.toLowerCase();
    }

    /**
     * Get price from cache
     * @param {string} chain
     * @param {string} tokenId
     * @param {string} cex
     * @returns {object|null}
     */
    get(chain, tokenId, cex) {
      const key = this.generateKey(chain, tokenId, cex);
      const cached = this.prices.get(key);

      if (!cached) {
        this.stats.misses++;
        return null;
      }

      const now = Date.now();
      const isExpired = now - cached.timestamp > cached.ttl;

      if (isExpired) {
        this.prices.delete(key);
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      logger.log(`[PriceCache] HIT: ${key} (Age: ${Math.round((now - cached.timestamp) / 1000)}s)`);

      return cached.data;
    }

    /**
     * Set price in cache
     * @param {string} chain
     * @param {string} tokenId
     * @param {string} cex
     * @param {object} priceData
     * @param {number} ttl - Optional custom TTL
     */
    set(chain, tokenId, cex, priceData, ttl = null) {
      const key = this.generateKey(chain, tokenId, cex);

      this.prices.set(key, {
        data: priceData,
        timestamp: Date.now(),
        ttl: ttl || this.defaultTTL
      });

      this.stats.updates++;
      logger.log(`[PriceCache] SET: ${key}`);
    }

    /**
     * Get multiple prices at once
     * @param {Array<{chain, tokenId, cex}>} requests
     * @returns {Array<{cached: boolean, data: object|null}>}
     */
    getMultiple(requests) {
      return requests.map(req => {
        const data = this.get(req.chain, req.tokenId, req.cex);
        return {
          cached: data !== null,
          data: data,
          request: req
        };
      });
    }

    /**
     * Set multiple prices at once
     * @param {Array<{chain, tokenId, cex, priceData}>} entries
     */
    setMultiple(entries) {
      entries.forEach(entry => {
        this.set(entry.chain, entry.tokenId, entry.cex, entry.priceData, entry.ttl);
      });
    }

    /**
     * Check if token is currently being fetched
     * @param {string} chain
     * @param {string} tokenId
     * @param {string} cex
     * @returns {Promise|null}
     */
    getFetchingPromise(chain, tokenId, cex) {
      const key = this.generateKey(chain, tokenId, cex);
      return this.fetchingTokens.get(key) || null;
    }

    /**
     * Mark token as being fetched
     * @param {string} chain
     * @param {string} tokenId
     * @param {string} cex
     * @param {Promise} promise
     */
    setFetchingPromise(chain, tokenId, cex, promise) {
      const key = this.generateKey(chain, tokenId, cex);
      this.fetchingTokens.set(key, promise);

      // Auto-cleanup after promise resolves
      promise.finally(() => {
        this.fetchingTokens.delete(key);
      });
    }

    /**
     * Invalidate specific token price
     * @param {string} chain
     * @param {string} tokenId
     * @param {string} cex
     */
    invalidate(chain, tokenId, cex) {
      const key = this.generateKey(chain, tokenId, cex);
      this.prices.delete(key);
      logger.log(`[PriceCache] Invalidated: ${key}`);
    }

    /**
     * Invalidate all prices for a specific chain
     * @param {string} chain
     */
    invalidateChain(chain) {
      let count = 0;
      const prefix = `${chain}:`.toLowerCase();

      for (const key of this.prices.keys()) {
        if (key.startsWith(prefix)) {
          this.prices.delete(key);
          count++;
        }
      }

      logger.log(`[PriceCache] Invalidated ${count} entries for chain: ${chain}`);
    }

    /**
     * Invalidate all prices for a specific CEX
     * @param {string} cex
     */
    invalidateCex(cex) {
      let count = 0;
      const suffix = `:${cex}`.toLowerCase();

      for (const key of this.prices.keys()) {
        if (key.endsWith(suffix)) {
          this.prices.delete(key);
          count++;
        }
      }

      logger.log(`[PriceCache] Invalidated ${count} entries for CEX: ${cex}`);
    }

    /**
     * Clear all prices
     */
    clear() {
      const size = this.prices.size;
      this.prices.clear();
      logger.log(`[PriceCache] Cleared all ${size} entries`);
    }

    /**
     * Get cache statistics
     * @returns {object}
     */
    getStats() {
      const totalRequests = this.stats.hits + this.stats.misses;
      const hitRate = totalRequests > 0
        ? ((this.stats.hits / totalRequests) * 100).toFixed(2)
        : '0.00';

      return {
        ...this.stats,
        cacheSize: this.prices.size,
        fetchingCount: this.fetchingTokens.size,
        hitRate: `${hitRate}%`
      };
    }

    /**
     * Reset statistics
     */
    resetStats() {
      this.stats = {
        hits: 0,
        misses: 0,
        updates: 0
      };
    }

    /**
     * Cleanup expired entries
     */
    cleanup() {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, value] of this.prices.entries()) {
        if (now - value.timestamp > value.ttl) {
          this.prices.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.log(`[PriceCache] Cleaned ${cleaned} expired entries`);
      }

      return cleaned;
    }

    /**
     * Get all cached prices for inspection
     * @returns {Array}
     */
    getAll() {
      const now = Date.now();
      const entries = [];

      for (const [key, value] of this.prices.entries()) {
        const [chain, tokenId, cex] = key.split(':');
        entries.push({
          chain,
          tokenId,
          cex,
          age: Math.round((now - value.timestamp) / 1000),
          remaining: Math.round((value.ttl - (now - value.timestamp)) / 1000),
          data: value.data
        });
      }

      return entries;
    }

    /**
     * Fetch price with automatic caching and deduplication
     * @param {string} chain
     * @param {string} tokenId
     * @param {string} cex
     * @param {Function} fetchFn - Function that fetches the price
     * @param {number} ttl - Optional custom TTL
     * @returns {Promise<object>}
     */
    async fetchWithCache(chain, tokenId, cex, fetchFn, ttl = null) {
      // Check cache first
      const cached = this.get(chain, tokenId, cex);
      if (cached !== null) {
        return cached;
      }

      // Check if already fetching
      const existingPromise = this.getFetchingPromise(chain, tokenId, cex);
      if (existingPromise) {
        logger.log(`[PriceCache] Deduplicating fetch for ${chain}:${tokenId}:${cex}`);
        return existingPromise;
      }

      // Start fetch
      const promise = (async () => {
        try {
          const result = await fetchFn();
          this.set(chain, tokenId, cex, result, ttl);
          return result;
        } catch (error) {
          logger.error(`[PriceCache] Fetch error for ${chain}:${tokenId}:${cex}:`, error);
          throw error;
        }
      })();

      this.setFetchingPromise(chain, tokenId, cex, promise);

      return promise;
    }
  }

  // Create singleton instance
  const instance = new PriceCacheService();

  // Auto cleanup every 2 minutes
  setInterval(() => instance.cleanup(), 120000);

  // Expose public API
  return {
    get: (chain, tokenId, cex) => instance.get(chain, tokenId, cex),
    set: (chain, tokenId, cex, priceData, ttl) => instance.set(chain, tokenId, cex, priceData, ttl),
    getMultiple: (requests) => instance.getMultiple(requests),
    setMultiple: (entries) => instance.setMultiple(entries),
    fetchWithCache: (chain, tokenId, cex, fetchFn, ttl) =>
      instance.fetchWithCache(chain, tokenId, cex, fetchFn, ttl),
    invalidate: (chain, tokenId, cex) => instance.invalidate(chain, tokenId, cex),
    invalidateChain: (chain) => instance.invalidateChain(chain),
    invalidateCex: (cex) => instance.invalidateCex(cex),
    clear: () => instance.clear(),
    cleanup: () => instance.cleanup(),
    getStats: () => instance.getStats(),
    resetStats: () => instance.resetStats(),
    getAll: () => instance.getAll()
  };
})();

// Expose to global scope
if (typeof window !== 'undefined') {
  window.PriceCache = PriceCache;
  logger.log('✅ PriceCache exposed to window');
}
