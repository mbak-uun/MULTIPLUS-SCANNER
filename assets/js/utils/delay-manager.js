/**
 * ===================================================================================
 * Delay Manager
 * ===================================================================================
 *
 * Mengelola berbagai jenis jeda (delay) untuk proses scanning:
 *
 * 1. Jeda Koin: Delay antar koin dalam satu grup
 * 2. Jeda Grup: Delay antar grup/batch scanning
 * 3. Jeda CEX: Delay spesifik per CEX (Gate, Binance, dll)
 * 4. Jeda DEX: Delay spesifik per DEX (Kyber, Odos, 0x, dll)
 * 5. Timeout: Batas waktu maksimal untuk fetch CEX/DEX
 *
 * Hirarki Prioritas Konfigurasi:
 * 1. User Settings (globalSettings) - highest priority
 * 2. Config File (KONFIG_APLIKASI)
 * 3. Default Hardcoded - fallback
 */

class DelayManager {
    constructor(config, globalSettings = {}) {
        this.config = config;
        this.globalSettings = globalSettings;

        // Default delays (ms)
        this.defaults = {
            jedaKoin: 500,           // Delay antar koin dalam grup
            jedaGrup: 2000,          // Delay antar grup
            timeout: 10000,          // Default timeout untuk fetch
            cex: {
                default: 300,        // Default delay untuk CEX
                gate: 500,
                binance: 300,
                mexc: 400
            },
            dex: {
                default: 300,        // Default delay untuk DEX
                kyber: 300,
                odos: 400,
                '0x': 350,
                para: 300,
                '1inch': 400,
                okxdex: 500
            }
        };
    }

    /**
     * Update global settings (dari user)
     */
    updateGlobalSettings(globalSettings) {
        this.globalSettings = globalSettings || {};
    }

    /**
     * Normalisasi nilai delay agar selalu bilangan positif
     * @private
     */
    _sanitizeDelay(value, fallback = 0) {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric >= 0) {
            return numeric;
        }
        const fallbackNumeric = Number(fallback);
        return Number.isFinite(fallbackNumeric) && fallbackNumeric >= 0 ? fallbackNumeric : 0;
    }

    /**
     * Ambil delay antar koin
     * Priority: globalSettings > config > default
     */
    getCoinDelay() {
        // 1. Cek dari globalSettings
        if (this.globalSettings?.jedaKoin !== undefined) {
            return this._sanitizeDelay(this.globalSettings.jedaKoin);
        }

        // 2. Cek dari config
        if (this.config?.SCANNING_DELAYS?.jedaKoin !== undefined) {
            return this._sanitizeDelay(this.config.SCANNING_DELAYS.jedaKoin);
        }

        // 3. Default
        return this.defaults.jedaKoin;
    }

    /**
     * Ambil delay antar grup
     * Priority: globalSettings > config > default
     */
    getGroupDelay() {
        // 1. Cek dari globalSettings
        if (this.globalSettings?.jedaTimeGroup !== undefined) {
            return this._sanitizeDelay(this.globalSettings.jedaTimeGroup);
        }

        // 2. Cek dari config
        if (this.config?.SCANNING_DELAYS?.jedaTimeGroup !== undefined) {
            return this._sanitizeDelay(this.config.SCANNING_DELAYS.jedaTimeGroup);
        }

        // 3. Default
        return this.defaults.jedaGrup;
    }

    /**
     * Ambil delay untuk CEX spesifik
     * Priority: globalSettings.config_cex > config.SCANNING_DELAYS.JedaCexs > default
     *
     * @param {string} cexKey - Nama CEX (gate, binance, mexc, dll)
     */
    getCexDelay(cexKey) {
        if (!cexKey) return this.getCoinDelay();

        const lower = String(cexKey).toLowerCase();
        const upper = String(cexKey).toUpperCase();

        // 1. Cek dari globalSettings.config_cex
        const fromGlobal = this.globalSettings?.config_cex?.[lower]?.jeda;
        if (fromGlobal !== undefined) {
            return this._sanitizeDelay(fromGlobal);
        }

        // 2. Cek dari config.SCANNING_DELAYS.JedaCexs
        const fromConfig = this.config?.SCANNING_DELAYS?.JedaCexs?.[upper] ||
                          this.config?.SCANNING_DELAYS?.JedaCexs?.[lower];
        if (fromConfig !== undefined) {
            return this._sanitizeDelay(fromConfig);
        }

        // 3. Default spesifik CEX
        if (this.defaults.cex[lower] !== undefined) {
            return this.defaults.cex[lower];
        }

        // 4. Default umum CEX
        return this.defaults.cex.default;
    }

    /**
     * Ambil delay untuk DEX spesifik
     * Priority: globalSettings.config_dex > config.SCANNING_DELAYS.JedaDexs > default
     *
     * @param {string} dexKey - Nama DEX (kyber, odos, 0x, dll)
     */
    getDexDelay(dexKey) {
        if (!dexKey) return 0;

        const lower = String(dexKey).toLowerCase();
        const upper = String(dexKey).toUpperCase();

        // 1. Cek dari globalSettings.config_dex
        const fromGlobal = this.globalSettings?.config_dex?.[lower]?.jeda;
        if (fromGlobal !== undefined) {
            return this._sanitizeDelay(fromGlobal);
        }

        // 2. Cek dari config.SCANNING_DELAYS.JedaDexs
        const fromConfig = this.config?.SCANNING_DELAYS?.JedaDexs?.[lower] ||
                          this.config?.SCANNING_DELAYS?.JedaDexs?.[upper];
        if (fromConfig !== undefined) {
            return this._sanitizeDelay(fromConfig);
        }

        // 3. Default spesifik DEX
        if (this.defaults.dex[lower] !== undefined) {
            return this.defaults.dex[lower];
        }

        // 4. Default umum DEX
        return this.defaults.dex.default;
    }

    /**
     * Ambil timeout untuk fetch
     * Priority: globalSettings.WaktuTunggu > config > default
     */
    getTimeout() {
        // 1. Cek dari globalSettings
        if (this.globalSettings?.WaktuTunggu !== undefined) {
            return this._sanitizeDelay(this.globalSettings.WaktuTunggu);
        }

        // 2. Cek dari config
        if (this.config?.SCANNING_DELAYS?.timeout !== undefined) {
            return this._sanitizeDelay(this.config.SCANNING_DELAYS.timeout);
        }

        // 3. Default
        return this.defaults.timeout;
    }

    /**
     * Tunggu delay untuk koin dengan posisi tertentu dalam grup
     * @param {number} position - Posisi koin dalam grup (0-based index)
     */
    async waitCoinDelay(position) {
        const delay = this.getCoinDelay();
        if (!delay || position <= 0) return;

        // Delay bertambah sesuai posisi
        await this._delay(delay * position);
    }

    /**
     * Tunggu delay antar grup
     */
    async waitGroupDelay() {
        const delay = this.getGroupDelay();
        if (!delay) return;
        await this._delay(delay);
    }

    /**
     * Tunggu delay untuk CEX tertentu
     * @param {string} cexKey - Nama CEX
     */
    async waitCexDelay(cexKey) {
        const delay = this.getCexDelay(cexKey);
        if (!delay) return;
        await this._delay(delay);
    }

    /**
     * Tunggu delay untuk DEX tertentu
     * @param {string} dexKey - Nama DEX
     * @param {number} position - Posisi DEX dalam urutan (0-based)
     */
    async waitDexDelay(dexKey, position = 0) {
        const baseDelay = this.getDexDelay(dexKey);
        if (!baseDelay || position <= 0) return;

        // Delay bertambah sesuai posisi DEX untuk menghindari rate limit
        await this._delay(baseDelay * position);
    }

    /**
     * Tunggu delay untuk pergantian arah trading (CEX<->DEX)
     * Diterapkan hanya saat pindah dari CEXtoDEX ke DEXtoCEX atau sebaliknya
     * @param {string} exchangeKey - CEX atau DEX key
     * @param {string} type - 'cex' atau 'dex'
     */
    async waitDirectionChangeDelay(exchangeKey, type = 'dex') {
        const delay = type === 'cex'
            ? this.getCexDelay(exchangeKey)
            : this.getDexDelay(exchangeKey);

        if (!delay) return;
        await this._delay(delay);
    }

    /**
     * Helper untuk delay
     * @private
     */
    async _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get semua konfigurasi delay saat ini (untuk debugging/logging)
     */
    getCurrentConfig() {
        return {
            jedaKoin: this.getCoinDelay(),
            jedaGrup: this.getGroupDelay(),
            timeout: this.getTimeout(),
            cex: {
                gate: this.getCexDelay('gate'),
                binance: this.getCexDelay('binance'),
                mexc: this.getCexDelay('mexc')
            },
            dex: {
                kyber: this.getDexDelay('kyber'),
                odos: this.getDexDelay('odos'),
                '0x': this.getDexDelay('0x'),
                para: this.getDexDelay('para'),
                '1inch': this.getDexDelay('1inch'),
                okxdex: this.getDexDelay('okxdex')
            }
        };
    }
}

// Export untuk digunakan di window global
if (typeof window !== 'undefined') {
    window.DelayManager = DelayManager;
}
