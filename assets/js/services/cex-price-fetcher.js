/**
 * ===================================================================================
 * CEX Price Fetcher Service
 * ===================================================================================
 *
 * Tanggung Jawab:
 * - Mengambil data orderbook (bids & asks) dari CEX (Binance, Gate.io, dll)
 * - Mendapatkan harga terbaik untuk buy/sell
 * - Mengelola rate-limiting untuk API CEX
 */
class CexPriceFetcher {
    constructor(config, httpModule, globalSettings) {
        this.config = config;
        this.Http = httpModule;
        // REVISI: Gunakan jeda dari globalSettings, dengan fallback ke nilai default.
        this.delayPerCall = globalSettings?.jedaPerAnggota || 200;
        // Sekarang akan membaca langsung dari this.config.CEX.
    }

    /**
     * Mengambil orderbook dari CEX untuk token tertentu
     * @param {string} cexKey - Nama CEX (binance, gateio, dll)
     * @param {string} symbol - Trading pair symbol (contoh: BTC/USDT)
     * @returns {Promise<object>} - { bestBid, bestAsk, bids, asks }
     */
    async getOrderbook(cexKey, symbol) {
        // REVISI: Jika simbol adalah USDT, tidak perlu fetch. Langsung kembalikan data mock.
        if (symbol && symbol.toUpperCase() === 'USDT') {
            // console.log(`[CexPriceFetcher] Skipping orderbook fetch for USDT. Returning mock data.`);
            return {
                bestBid: 1,
                bestAsk: 1,
                bids: [{ price: 1, quantity: 10000 }],
                asks: [{ price: 1, quantity: 10000 }]
            };
        }

        // REVISI: Mengambil konfigurasi langsung dari this.config (config_app.js)
        const cexConfig = this.config.CEX?.[cexKey.toUpperCase()];
        // REVISI: Path yang benar adalah di dalam URLS.
        const orderbookUrl = cexConfig?.URLS?.ORDERBOOK;

        if (!orderbookUrl) {
            console.warn(`[CexPriceFetcher] Konfigurasi ORDERBOOK untuk CEX '${cexKey}' tidak ditemukan di config_app.js`);
            return null;
        }

        try {
            // REVISI: URL dibangun dengan mengganti placeholder {symbol} dengan ticker yang sudah diformat.
            const url = orderbookUrl.replace('{symbol}', symbol);
            // REVISI: Dapatkan tipe parser dari helper internal untuk konsistensi.
            const parserType = this._getParserType(cexKey);

            const response = await this.Http.request({
                url,
                method: 'GET',
                responseType: 'json',
                timeout: 10000
            });

            // REVISI: Parser ditentukan oleh config, bukan switch-case.
            return this._parseOrderbook(response, parserType);

        } catch (error) {
            console.error(`[CexPriceFetcher] Failed to fetch orderbook from ${cexKey}:`, error.message);
            return null;
        }
    }

    /**
     * Menentukan tipe parser berdasarkan konfigurasi CEX.
     * @private
     */
    _getParserType(cexKey) {
        const cex = cexKey.toUpperCase();
        // Logika ini dibuat untuk kompatibilitas dengan berbagai format API
        switch (cex) {
            case 'KUCOIN':
                return 'kucoin';
            case 'BITGET':
            case 'MEXC': // MEXC v3 punya struktur data yang mirip
                return 'bitget';
            case 'BYBIT':
                return 'bybit';
            case 'INDODAX':
                // Indodax memiliki format { buy: [[price, amount]], sell: [[price, amount]] }
                return 'indodax';
            case 'BINANCE':
            case 'GATE': // Gate.io v4 API
                return 'standard';
            default:
                return 'standard';
        }
    }

    /**
     * Parse orderbook response dari berbagai CEX
     * @private
     * @param {object} response - Data JSON dari API CEX.
     * @param {string} parserType - Tipe parser dari config (e.g., 'standard', 'kucoin', 'bybit').
     */
    _parseOrderbook(response, parserType) {
        let bids = [];
        let asks = [];

        // REVISI: Menggunakan parserType dari config untuk menentukan cara parsing.
        switch (parserType) {
            case 'standard': // Gate.io juga menggunakan 'standard'
                bids = response.bids || [];
                asks = response.asks || [];
                break;
            case 'kucoin':
            case 'bitget':
            case 'mexc': // MEXC API v3 memiliki struktur yang sama dengan Kucoin/Bitget
                // Parser untuk KuCoin dan Bitget yang memiliki struktur { data: { bids: [], asks: [] } }
                bids = response.data?.bids || [];
                asks = response.data?.asks || [];
                break;
            case 'bybit':
                // Parser untuk Bybit yang memiliki struktur { result: { b: [], a: [] } }
                bids = response.result?.b || [];
                asks = response.result?.a || [];
                break;

            case 'indodax':
                bids = response.bids || response.buy || []; // 'bids' adalah format baru, 'buy' adalah fallback untuk API lama
                asks = response.asks || response.sell || []; // 'asks' adalah format baru, 'sell' adalah fallback
                break;

            default:
                bids = response.bids || [];
                asks = response.asks || [];
        }

        // Konversi ke format standar: array of objects { price, quantity }
        const parsedBids = bids.map(b => ({
            price: parseFloat(b[0]),
            quantity: parseFloat(b[1])
        }));

        const parsedAsks = asks.map(a => ({
            price: parseFloat(a[0]), // Harga jual
            quantity: parseFloat(a[1]) // Jumlah
        }));

        return {
            bestBid: parsedBids[0]?.price || 0,  // Harga beli tertinggi
            bestAsk: parsedAsks[0]?.price || 0,  // Harga jual terendah
            bids: parsedBids,
            asks: parsedAsks
        };
    }

    /**
     * Delay helper untuk rate limiting
     * @private
     */
    async _delay() {
        return new Promise(resolve => setTimeout(resolve, this.delayPerCall));
    }
}

// Export untuk digunakan di window global
if (typeof window !== 'undefined') {
    window.CexPriceFetcher = CexPriceFetcher;
}