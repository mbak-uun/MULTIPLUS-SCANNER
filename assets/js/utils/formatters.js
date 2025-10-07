/**
 * ===================================================================================
 * Formatters Utility
 * ===================================================================================
 *
 * Helper functions untuk formatting data (numbers, currency, dates, etc.)
 */
const Formatters = {
    /**
     * Format number dengan locale Indonesia
     * @param {number} value
     * @param {number} decimals
     * @returns {string}
     */
    number(value, decimals = 2) {
        if (value === undefined || value === null || isNaN(value)) return '-';
        return Number(value).toLocaleString('id-ID', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },

    /**
     * Format price (auto-adjust decimals based on value)
     * @param {number} value
     * @returns {string}
     */
    price(value) {
        if (value === undefined || value === null || isNaN(value)) return '-';
        const num = Number(value);

        if (Math.abs(num) >= 1) {
            return num.toLocaleString('id-ID', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4
            });
        }

        return num.toLocaleString('id-ID', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 8
        });
    },

    /**
     * Format currency (USD)
     * @param {number} value
     * @returns {string}
     */
    usd(value) {
        if (value === undefined || value === null || isNaN(value)) return '$0.00';
        return `$${this.price(value)}`;
    },

    /**
     * Format currency (IDR)
     * @param {number} value
     * @returns {string}
     */
    idr(value) {
        if (value === undefined || value === null || isNaN(value)) return 'Rp 0';
        return `Rp ${this.number(value, 0)}`;
    },

    /**
     * Format percentage
     * @param {number} value
     * @param {number} decimals
     * @returns {string}
     */
    percent(value, decimals = 2) {
        if (value === undefined || value === null || isNaN(value)) return '0%';
        return `${this.number(value, decimals)}%`;
    },

    /**
     * Format token amount (dengan decimals)
     * @param {number} value
     * @param {number} maxDecimals
     * @returns {string}
     */
    tokenAmount(value, maxDecimals = 8) {
        if (value === undefined || value === null || isNaN(value)) return '0';
        const num = Number(value);

        // Remove trailing zeros
        return num.toLocaleString('id-ID', {
            minimumFractionDigits: 0,
            maximumFractionDigits: maxDecimals
        });
    },

    /**
     * Format date ke string readable
     * @param {string|Date} date
     * @returns {string}
     */
    date(date) {
        if (!date) return '-';
        try {
            return new Date(date).toLocaleDateString('id-ID', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (e) {
            return '-';
        }
    },

    /**
     * Format datetime
     * @param {string|Date} datetime
     * @returns {string}
     */
    datetime(datetime) {
        if (!datetime) return '-';
        try {
            return new Date(datetime).toLocaleString('id-ID', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return '-';
        }
    },

    /**
     * Format time
     * @param {string|Date} time
     * @returns {string}
     */
    time(time) {
        if (!time) return '-';
        try {
            return new Date(time).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch (e) {
            return '-';
        }
    },

    /**
     * Format address (shorten)
     * @param {string} address
     * @param {number} startChars
     * @param {number} endChars
     * @returns {string}
     */
    address(address, startChars = 6, endChars = 4) {
        if (!address || address.length <= startChars + endChars) return address || '-';
        return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
    },

    /**
     * Format file size
     * @param {number} bytes
     * @returns {string}
     */
    fileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },

    /**
     * Truncate text dengan ellipsis
     * @param {string} text
     * @param {number} maxLength
     * @returns {string}
     */
    truncate(text, maxLength = 50) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.slice(0, maxLength) + '...';
    }
};

// Export
if (typeof window !== 'undefined') {
    window.Formatters = Formatters;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Formatters };
}
