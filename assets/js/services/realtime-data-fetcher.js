/**
 * ===================================================================================
 * Real-time Data Fetcher Service
 * ===================================================================================
 *
 * Tanggung Jawab:
 * - Mengambil data Gas Price (Gwei) langsung dari blockchain RPC
 * - Mengambil harga token gas native (ETH, BNB, MATIC) dari CEX
 * - Mengambil kurs USDT/IDR dari exchange lokal (Tokocrypto/Indodax)
 */
class RealtimeDataFetcher {
    constructor(config, httpModule) {
        this.config = config;
        this.Http = httpModule;

        // Cache untuk mengurangi request
        this.cache = {
            gasData: {},
            usdtRate: null,
            lastUpdate: {
                gas: {},
                usdt: null
            }
        };

        this.cacheDuration = 30000; // 30 detik cache
    }

    /**
     * Mengambil semua data real-time yang diperlukan
     * @returns {Promise<object>} - { gasData, usdtRate }
     * @param {string[]} activeChains - Array berisi key chain yang aktif, e.g., ['bsc', 'polygon'].
     */
    async getAllRealtimeData(activeChains = []) {
        const [gasData, usdtRate] = await Promise.all([
            this.getGasData(activeChains),
            this.getUSDTtoIDRRate()
        ]);

        return { gasData, usdtRate };
    }

    /**
     * Mengambil harga untuk daftar simbol token tertentu.
     * @param {string[]} symbols - Array simbol (e.g., ['BTCUSDT', 'ETHUSDT']).
     * @returns {Promise<Object>} - Objek berisi harga, e.g., { BTCUSDT: 65000, ETHUSDT: 3500 }.
     */
    async fetchRates(symbols = []) {
        if (!symbols || symbols.length === 0) return {};

        // PERBAIKAN: Gunakan endpoint 'data-api.binance.vision' sebagai fallback yang benar.
        const endpoint = this.config.priceSources?.binanceDataApi || 'https://data-api.binance.vision/api/v3/ticker/price';
        
        // PERBAIKAN: Kirim parameter 'symbols' sebagai array JSON yang valid, bukan string.
        // API Binance mengharapkan format: ?symbols=["BTCUSDT","ETHUSDT"]
        const symbolsParam = `symbols=${JSON.stringify(symbols)}`;
        const url = `${endpoint}?${symbolsParam}`;

        try {
            const data = await this.Http.get(url, { responseType: 'json' });
            const rates = {};
            if (Array.isArray(data)) {
                data.forEach(item => {
                    rates[item.symbol] = parseFloat(item.price);
                });
            }
            return rates;
        } catch (error) {
            console.error('[RealtimeDataFetcher] Failed to fetch rates:', error);
            return {};
        }
    }

    /**
     * Mengambil data gas untuk semua chain yang aktif
     * @param {string[]} activeChains - Array berisi key chain yang aktif. Jika kosong, akan mengambil semua.
     * @returns {Promise<object>} - { bsc: { gwei: 3, price: 600 }, ... }
     */
    async getGasData(activeChains = []) {
        const gasData = {};
        // REVISI: Gunakan activeChains jika disediakan, jika tidak, fallback ke semua chain di config.
        const chainsToFetch = activeChains.length > 0 ? activeChains : Object.keys(this.config.CHAINS);

        for (const chainKey of chainsToFetch) {
            // Cek cache
            if (this._isCacheValid('gas', chainKey)) {
                gasData[chainKey] = this.cache.gasData[chainKey];
                continue;
            }

            const chainConfig = this.config.CHAINS[chainKey];

            // Fetch Gwei dari RPC
            const gwei = await this._fetchGasPrice(chainConfig.RPC);

            // Fetch harga token gas native dari Binance
            const price = await this.fetchTokenPrice(chainConfig.BASE_FEE_DEX);

            gasData[chainKey] = {
                gwei: gwei,
                price: price,
                symbol: chainConfig.BASE_FEE_DEX.replace('USDT', ''),
                gasLimit: chainConfig.GASLIMIT
            };

            // Update cache
            this.cache.gasData[chainKey] = gasData[chainKey];
            this.cache.lastUpdate.gas[chainKey] = Date.now();

            // Delay untuk menghindari rate limit
            await this._delay(200);
        }

        return gasData;
    }

    /**
     * Mengambil kurs USDT/IDR
     * @returns {Promise<number>} - Rate USDT ke IDR
     */
    async getUSDTtoIDRRate() {
        // Cek cache
        if (this._isCacheValid('usdt')) {
            return this.cache.usdtRate;
        }

        try {
            // Coba dari Tokocrypto terlebih dahulu
            let rate = await this._fetchFromTokocrypto();

            if (!rate) {
                // Fallback ke Indodax
                rate = await this._fetchFromIndodax();
            }

            // Update cache
            this.cache.usdtRate = rate || 15800; // Default fallback
            this.cache.lastUpdate.usdt = Date.now();

            return this.cache.usdtRate;

        } catch (error) {
            console.error('[RealtimeDataFetcher] Failed to fetch USDT/IDR rate:', error.message);
            return this.cache.usdtRate || 15800; // Return cache atau default
        }
    }

    /**
     * Fetch gas price dari RPC blockchain
     * @private - Tetap private karena ini adalah detail implementasi internal.
     */
    async _fetchGasPrice(rpcUrl) {
        try {
            // Menggunakan Http.js yang sudah ada
            const response = await this.Http.request({
                url: rpcUrl,
                method: 'POST',
                data: {
                    jsonrpc: '2.0',
                    method: 'eth_gasPrice',
                    params: [],
                    id: 1
                },
                responseType: 'json',
                timeout: 5000
            });

            if (response.result) {
                // Convert hex to decimal Gwei
                const gweiValue = parseInt(response.result, 16) / 1e9;
                return Math.round(gweiValue * 10) / 10; // Round to 1 decimal
            }

            return 0;

        } catch (error) {
            //console.warn(`[RealtimeDataFetcher] Failed to fetch gas price from ${rpcUrl}:`, error.message);
            return 0;
        }
    }

    /**
     * Fetch harga token dari Binance
     * @public - Dibuat public agar bisa digunakan oleh kalkulator di portfolio.js
     */
    async fetchTokenPrice(symbol) {
        try {
            // PERBAIKAN: Standarisasi endpoint agar konsisten dengan fetchRates.
            const endpoint = this.config.priceSources?.binanceDataApi || 'https://data-api.binance.vision/api/v3/ticker/price';
            const url = `${endpoint}?symbol=${symbol}`;
            const response = await this.Http.get(url, {
                method: 'GET',
                responseType: 'json',
                timeout: 5000
            });

            return parseFloat(response.price) || 0;

        } catch (error) {
            //console.warn(`[RealtimeDataFetcher] Failed to fetch ${symbol} price:`, error.message);
            return 0;
        }
    }

    /**
     * Fetch USDT/IDR dari Tokocrypto
     * @private - Detail implementasi, tidak perlu diakses dari luar.
     */
    async _fetchFromTokocrypto() {
        try {
            // Gunakan endpoint orderbook yang benar
            const url = 'https://cloudme-toko.2meta.app/api/v1/depth?symbol=USDTIDR&limit=5';
            const response = await this.Http.get(url, {
                url,
                method: 'GET',
                responseType: 'json',
                timeout: 5000
            });

            // Ambil harga dari bid tertinggi (top bid)
            if (response && response.bids && response.bids.length > 0) {
                const topBid = parseFloat(response.bids[0][0]);

                if (!isNaN(topBid) && topBid > 0) {
                    return topBid;
                }
            }

            //console.warn('[RealtimeDataFetcher] Invalid Tokocrypto data structure');
            return null;

        } catch (error) {
            //console.warn('[RealtimeDataFetcher] Tokocrypto fetch failed:', error.message);
            return null;
        }
    }

    /**
     * Fetch USDT/IDR dari Indodax
     * @private - Detail implementasi, tidak perlu diakses dari luar.
     */
    async _fetchFromIndodax() {
        try {
            const url = this.config.priceSources?.indodaxLower || 'https://indodax.com/api/ticker/usdtidr';
            const response = await this.Http.request({
                url,
                method: 'GET',
                responseType: 'json',
                timeout: 5000
            });

            return parseFloat(response.ticker?.last) || null;

        } catch (error) {
            //console.warn('[RealtimeDataFetcher] Indodax fetch failed:', error.message);
            return null;
        }
    }

    /**
     * Cek apakah cache masih valid
     * @private - Logika internal.
     */
    _isCacheValid(type, chainKey = null) {
        const now = Date.now();

        if (type === 'gas' && chainKey) {
            const lastUpdate = this.cache.lastUpdate.gas[chainKey];
            return lastUpdate && (now - lastUpdate) < this.cacheDuration;
        }

        if (type === 'usdt') {
            const lastUpdate = this.cache.lastUpdate.usdt;
            return lastUpdate && (now - lastUpdate) < this.cacheDuration;
        }

        return false;
    }

    /**
     * Delay helper
     * @private - Logika internal.
     */
    async _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Clear cache (untuk testing atau force refresh)
     */
    clearCache() {
        this.cache = {
            gasData: {},
            usdtRate: null,
            lastUpdate: {
                gas: {},
                usdt: null
            }
        };
    }
}

// Export untuk digunakan di window global
if (typeof window !== 'undefined') {
    window.RealtimeDataFetcher = RealtimeDataFetcher;
}
