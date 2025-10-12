// assets/js/core/api/centralized-api-service.js
// Centralized API Service dengan caching, deduplication, dan rate limiting

const CentralizedApiService = (() => {
  class ApiService {
    constructor() {
      // Shared cache storage
      this.cache = new Map();

      // Deduplication: track pending requests
      this.pendingRequests = new Map();

      // Rate limiting state per service
      this.rateLimits = new Map();

      // Cache statistics
      this.stats = {
        totalRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        deduplicatedRequests: 0
      };

      // Default TTL configurations (in milliseconds)
      this.defaultTTL = {
        price: 60000,           // 60s - Token prices
        quote: 30000,           // 30s - DEX quotes
        gas: 30000,             // 30s - Gas prices
        balance: 300000,        // 5min - Wallet balances
        orderbook: 60000,       // 60s - CEX orderbook
        ticker: 60000,          // 60s - Price tickers
        static: 86400000,       // 24h - Static data (chain config, etc)
        realtime: 10000         // 10s - Highly volatile data
      };

      // Auto cleanup expired cache every 5 minutes
      setInterval(() => this.cleanupExpiredCache(), 300000);
    }

    /**
     * Generate unique cache key from request parameters
     * @param {string} service - Service name (cex, dex, rpc, etc)
     * @param {string} endpoint - API endpoint or method
     * @param {object} params - Request parameters
     * @returns {string} - Unique cache key
     */
    generateCacheKey(service, endpoint, params = {}) {
      const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${key}=${JSON.stringify(params[key])}`)
        .join('&');

      return `${service}:${endpoint}:${sortedParams}`;
    }

    /**
     * Get data from cache if valid
     * @param {string} cacheKey - Cache key
     * @returns {any|null} - Cached data or null
     */
    getFromCache(cacheKey) {
      const cached = this.cache.get(cacheKey);

      if (!cached) {
        return null;
      }

      const now = Date.now();
      const isExpired = now - cached.timestamp > cached.ttl;

      if (isExpired) {
        this.cache.delete(cacheKey);
        return null;
      }

      this.stats.cacheHits++;
      logger.log(`[CentralizedApiService] Cache HIT: ${cacheKey} (Age: ${Math.round((now - cached.timestamp) / 1000)}s)`);

      return cached.data;
    }

    /**
     * Store data in cache with TTL
     * @param {string} cacheKey - Cache key
     * @param {any} data - Data to cache
     * @param {number} ttl - Time to live in milliseconds
     */
    setCache(cacheKey, data, ttl) {
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        ttl
      });

      logger.log(`[CentralizedApiService] Cache SET: ${cacheKey} (TTL: ${ttl / 1000}s)`);
    }

    /**
     * Clear specific cache entry or pattern
     * @param {string|RegExp} pattern - Cache key or pattern to clear
     */
    clearCache(pattern) {
      if (typeof pattern === 'string') {
        this.cache.delete(pattern);
        logger.log(`[CentralizedApiService] Cache cleared: ${pattern}`);
      } else if (pattern instanceof RegExp) {
        let cleared = 0;
        for (const key of this.cache.keys()) {
          if (pattern.test(key)) {
            this.cache.delete(key);
            cleared++;
          }
        }
        logger.log(`[CentralizedApiService] Cache cleared: ${cleared} entries matching ${pattern}`);
      }
    }

    /**
     * Clear all cache
     */
    clearAllCache() {
      const size = this.cache.size;
      this.cache.clear();
      logger.log(`[CentralizedApiService] All cache cleared (${size} entries)`);
    }

    /**
     * Cleanup expired cache entries
     */
    cleanupExpiredCache() {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > value.ttl) {
          this.cache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.log(`[CentralizedApiService] Cleaned ${cleaned} expired cache entries`);
      }
    }

    /**
     * Main fetch method with caching and deduplication
     * @param {object} config - Request configuration
     * @returns {Promise<any>}
     */
    async fetch(config) {
      const {
        service,           // Service identifier (e.g., 'binance', 'odos', 'rpc')
        endpoint,          // API endpoint or method name
        params = {},       // Request parameters
        ttl,               // Custom TTL (optional)
        ttlType = 'price', // TTL type from defaultTTL
        forceRefresh = false, // Skip cache
        fetchFn,           // Actual fetch function
        ...fetchOptions    // Additional options passed to fetchFn
      } = config;

      this.stats.totalRequests++;

      // Generate cache key
      const cacheKey = this.generateCacheKey(service, endpoint, params);

      // Check cache first (unless forceRefresh)
      if (!forceRefresh) {
        const cached = this.getFromCache(cacheKey);
        if (cached !== null) {
          return cached;
        }
      }

      this.stats.cacheMisses++;

      // Check for pending identical request (deduplication)
      if (this.pendingRequests.has(cacheKey)) {
        this.stats.deduplicatedRequests++;
        logger.log(`[CentralizedApiService] Deduplicating request: ${cacheKey}`);
        return this.pendingRequests.get(cacheKey);
      }

      // Execute the actual fetch
      const promise = (async () => {
        try {
          // Apply rate limiting if needed
          await this.applyRateLimit(service);

          // Execute the fetch function
          if (!fetchFn || typeof fetchFn !== 'function') {
            throw new Error('fetchFn is required and must be a function');
          }

          const result = await fetchFn(params, fetchOptions);

          // Determine TTL
          const effectiveTTL = ttl || this.defaultTTL[ttlType] || this.defaultTTL.price;

          // Store in cache
          this.setCache(cacheKey, result, effectiveTTL);

          return result;

        } catch (error) {
          logger.error(`[CentralizedApiService] Fetch error for ${cacheKey}:`, error);
          throw error;
        } finally {
          // Remove from pending requests
          this.pendingRequests.delete(cacheKey);
        }
      })();

      // Store pending promise for deduplication
      this.pendingRequests.set(cacheKey, promise);

      return promise;
    }

    /**
     * Apply rate limiting per service
     * @param {string} service - Service identifier
     */
    async applyRateLimit(service) {
      const limitState = this.rateLimits.get(service);

      if (!limitState) {
        // First request for this service
        this.rateLimits.set(service, {
          lastRequest: Date.now(),
          requestCount: 1
        });
        return;
      }

      const now = Date.now();
      const timeSinceLastRequest = now - limitState.lastRequest;

      // Default minimum interval: 100ms between requests
      const minInterval = 100;

      if (timeSinceLastRequest < minInterval) {
        const delay = minInterval - timeSinceLastRequest;
        logger.log(`[CentralizedApiService] Rate limiting ${service}: waiting ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Update state
      limitState.lastRequest = Date.now();
      limitState.requestCount++;
    }

    /**
     * Batch multiple fetch requests and execute them efficiently
     * @param {Array<object>} requests - Array of fetch configs
     * @returns {Promise<Array>}
     */
    async batchFetch(requests) {
      logger.log(`[CentralizedApiService] Batch fetching ${requests.length} requests`);

      // Execute all requests in parallel
      const promises = requests.map(config => this.fetch(config));

      return Promise.allSettled(promises);
    }

    /**
     * Get cache statistics
     * @returns {object}
     */
    getStats() {
      const cacheHitRate = this.stats.totalRequests > 0
        ? ((this.stats.cacheHits / this.stats.totalRequests) * 100).toFixed(2)
        : '0.00';

      return {
        ...this.stats,
        cacheSize: this.cache.size,
        pendingRequests: this.pendingRequests.size,
        cacheHitRate: `${cacheHitRate}%`
      };
    }

    /**
     * Reset statistics
     */
    resetStats() {
      this.stats = {
        totalRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        deduplicatedRequests: 0
      };
      logger.log('[CentralizedApiService] Statistics reset');
    }

    /**
     * Prefetch data to warm up cache
     * @param {Array<object>} configs - Array of fetch configs
     */
    async prefetch(configs) {
      logger.log(`[CentralizedApiService] Prefetching ${configs.length} endpoints`);

      const promises = configs.map(config =>
        this.fetch(config).catch(err => {
          logger.error(`[CentralizedApiService] Prefetch failed for ${config.endpoint}:`, err);
          return null;
        })
      );

      await Promise.allSettled(promises);
      logger.log('[CentralizedApiService] Prefetch completed');
    }

    /**
     * Invalidate cache for specific service
     * @param {string} service - Service identifier
     */
    invalidateServiceCache(service) {
      const pattern = new RegExp(`^${service}:`);
      this.clearCache(pattern);
    }

    /**
     * Get cache entries for inspection
     * @param {string} service - Optional service filter
     * @returns {Array}
     */
    getCacheEntries(service) {
      const entries = [];
      const now = Date.now();

      for (const [key, value] of this.cache.entries()) {
        if (!service || key.startsWith(`${service}:`)) {
          entries.push({
            key,
            age: Math.round((now - value.timestamp) / 1000),
            ttl: Math.round(value.ttl / 1000),
            remaining: Math.round((value.ttl - (now - value.timestamp)) / 1000)
          });
        }
      }

      return entries;
    }
  }

  // Create singleton instance
  const instance = new ApiService();

  // Expose public API
  return {
    fetch: (config) => instance.fetch(config),
    batchFetch: (requests) => instance.batchFetch(requests),
    prefetch: (configs) => instance.prefetch(configs),
    clearCache: (pattern) => instance.clearCache(pattern),
    clearAllCache: () => instance.clearAllCache(),
    invalidateServiceCache: (service) => instance.invalidateServiceCache(service),
    getStats: () => instance.getStats(),
    resetStats: () => instance.resetStats(),
    getCacheEntries: (service) => instance.getCacheEntries(service),

    // Direct cache access for advanced usage
    cache: instance.cache,

    // TTL configurations (read-only access)
    getTTL: (type) => instance.defaultTTL[type],

    // Utility to generate cache keys externally if needed
    generateCacheKey: (service, endpoint, params) =>
      instance.generateCacheKey(service, endpoint, params)
  };
})();

// Expose to global scope
if (typeof window !== 'undefined') {
  window.CentralizedApiService = CentralizedApiService;
  logger.log('✅ CentralizedApiService exposed to window');
}
