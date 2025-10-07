/**
 * ===================================================================================
 * Validators Utility
 * ===================================================================================
 *
 * Helper functions untuk validasi input
 */
const Validators = {
    /**
     * Validate ethereum address
     * @param {string} address
     * @returns {boolean}
     */
    isValidAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    },

    /**
     * Validate number
     * @param {any} value
     * @returns {boolean}
     */
    isNumber(value) {
        return !isNaN(parseFloat(value)) && isFinite(value);
    },

    /**
     * Validate positive number
     * @param {any} value
     * @returns {boolean}
     */
    isPositiveNumber(value) {
        return this.isNumber(value) && parseFloat(value) > 0;
    },

    /**
     * Validate email
     * @param {string} email
     * @returns {boolean}
     */
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    /**
     * Validate required field
     * @param {any} value
     * @returns {boolean}
     */
    required(value) {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.trim().length > 0;
        if (Array.isArray(value)) return value.length > 0;
        return true;
    },

    /**
     * Validate min length
     * @param {string} value
     * @param {number} min
     * @returns {boolean}
     */
    minLength(value, min) {
        if (!value) return false;
        return String(value).length >= min;
    },

    /**
     * Validate max length
     * @param {string} value
     * @param {number} max
     * @returns {boolean}
     */
    maxLength(value, max) {
        if (!value) return true;
        return String(value).length <= max;
    },

    /**
     * Validate range
     * @param {number} value
     * @param {number} min
     * @param {number} max
     * @returns {boolean}
     */
    inRange(value, min, max) {
        if (!this.isNumber(value)) return false;
        const num = parseFloat(value);
        return num >= min && num <= max;
    },

    /**
     * Validate coin data untuk save
     * @param {object} coin
     * @returns {{ valid: boolean, errors: string[] }}
     */
    validateCoin(coin) {
        const errors = [];

        if (!this.required(coin.nama_koin)) {
            errors.push('Nama koin wajib diisi');
        }

        if (!this.required(coin.nama_token)) {
            errors.push('Nama token wajib diisi');
        }

        if (!this.required(coin.sc_token)) {
            errors.push('Smart contract token wajib diisi');
        } else if (!this.isValidAddress(coin.sc_token)) {
            errors.push('Smart contract token tidak valid');
        }

        if (!this.required(coin.cex_name)) {
            errors.push('Nama CEX wajib diisi');
        }

        if (!this.required(coin.nama_pair)) {
            errors.push('Nama pair wajib diisi');
        }

        if (!this.required(coin.sc_pair)) {
            errors.push('Smart contract pair wajib diisi');
        } else if (!this.isValidAddress(coin.sc_pair)) {
            errors.push('Smart contract pair tidak valid');
        }

        if (!this.isNumber(coin.des_token)) {
            errors.push('Decimals token harus berupa angka');
        }

        if (!this.isNumber(coin.des_pair)) {
            errors.push('Decimals pair harus berupa angka');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
};

// Export
if (typeof window !== 'undefined') {
    window.Validators = Validators;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Validators };
}
