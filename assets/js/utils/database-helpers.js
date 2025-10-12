/**
 * ===================================================================================
 * Database Helper Utilities
 * ===================================================================================
 *
 * Utilities untuk standarisasi operasi database IndexedDB.
 * Memastikan konsistensi struktur data "Satu Entitas, Satu Baris/Record".
 *
 * FITUR:
 * - Auto-generate UUID untuk primary key
 * - Auto-add/update timestamps (createdAt, updatedAt)
 * - Validasi struktur record
 * - Clone data untuk menghilangkan Vue reactivity
 */

const DatabaseHelpers = {
    /**
     * Generate UUID untuk primary key
     * Menggunakan crypto.randomUUID() jika tersedia, fallback ke method lain
     * @returns {string} UUID v4
     */
    generateUUID() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // Fallback untuk browser lama
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    /**
     * Dapatkan timestamp ISO 8601 saat ini
     * @returns {string} ISO timestamp
     */
    getCurrentTimestamp() {
        return new Date().toISOString();
    },

    /**
     * Tambahkan timestamps ke record (untuk record baru)
     * @param {Object} record - Record yang akan ditambahkan timestamp
     * @returns {Object} Record dengan timestamps
     */
    addTimestamps(record) {
        const now = this.getCurrentTimestamp();
        return {
            ...record,
            createdAt: record.createdAt || now,
            updatedAt: now
        };
    },

    /**
     * Update timestamp updatedAt (untuk record yang diupdate)
     * @param {Object} record - Record yang akan diupdate timestamp
     * @returns {Object} Record dengan updatedAt baru
     */
    updateTimestamp(record) {
        return {
            ...record,
            updatedAt: this.getCurrentTimestamp()
        };
    },

    /**
     * Generate ID dan add timestamps untuk record baru
     * @param {Object} record - Record baru
     * @param {Object} options - Options
     * @param {boolean} options.generateId - Generate UUID untuk field 'id' (default: true)
     * @param {boolean} options.addTimestamps - Add createdAt/updatedAt (default: true)
     * @returns {Object} Record yang sudah lengkap
     */
    prepareNewRecord(record, options = {}) {
        const { generateId = true, addTimestamps = true } = options;

        let prepared = { ...record };

        // Generate ID jika belum ada dan dibutuhkan
        if (generateId && !prepared.id) {
            prepared.id = this.generateUUID();
        }

        // Add timestamps
        if (addTimestamps) {
            prepared = this.addTimestamps(prepared);
        }

        return prepared;
    },

    /**
     * Prepare record untuk update (auto-update timestamp)
     * @param {Object} record - Record yang akan diupdate
     * @returns {Object} Record dengan updatedAt baru
     */
    prepareUpdateRecord(record) {
        return this.updateTimestamp(record);
    },

    /**
     * Clone data untuk menghilangkan Vue reactivity
     * Penting untuk IndexedDB agar tidak terjadi DataCloneError
     * @param {any} data - Data yang akan di-clone
     * @returns {any} Plain object/array tanpa reactivity
     */
    cloneData(data) {
        try {
            return JSON.parse(JSON.stringify(data));
        } catch (error) {
            // console.error('[DatabaseHelpers] Error cloning data:', error);
            return data;
        }
    },

    /**
     * Validasi apakah record memiliki struktur yang valid
     * @param {Object} record - Record yang akan divalidasi
     * @param {Object} schema - Schema validasi
     * @returns {Object} { valid: boolean, errors: string[] }
     */
    validateRecord(record, schema) {
        const errors = [];

        // Validasi required fields
        if (schema.required) {
            schema.required.forEach(field => {
                if (record[field] === undefined || record[field] === null) {
                    errors.push(`Field "${field}" is required`);
                }
            });
        }

        // Validasi tipe data
        if (schema.fields) {
            Object.keys(schema.fields).forEach(field => {
                const expectedType = schema.fields[field];
                const actualValue = record[field];

                if (actualValue !== undefined && actualValue !== null) {
                    const actualType = typeof actualValue;
                    if (actualType !== expectedType && expectedType !== 'any') {
                        errors.push(`Field "${field}" should be ${expectedType}, got ${actualType}`);
                    }
                }
            });
        }

        return {
            valid: errors.length === 0,
            errors
        };
    },

    /**
     * Standarisasi metadata fields
     * Rename field lama ke standar baru (createdAt, updatedAt)
     * @param {Object} record - Record dengan field lama
     * @returns {Object} Record dengan field standar
     */
    standardizeMetadata(record) {
        const standardized = { ...record };

        // Rename lastUpdated -> updatedAt
        if (standardized.lastUpdated && !standardized.updatedAt) {
            standardized.updatedAt = standardized.lastUpdated;
            delete standardized.lastUpdated;
        }

        // Rename lastChecked -> updatedAt
        if (standardized.lastChecked && !standardized.updatedAt) {
            standardized.updatedAt = standardized.lastChecked;
            delete standardized.lastChecked;
        }

        // Rename timestamp -> createdAt (untuk log entries)
        if (standardized.timestamp && !standardized.createdAt) {
            standardized.createdAt = standardized.timestamp;
            // Keep timestamp for backward compatibility
        }

        return standardized;
    },

    /**
     * Helper untuk create record dengan standar lengkap
     * @param {Object} data - Data record
     * @param {Object} options - Options
     * @returns {Object} Record yang siap disimpan
     */
    createRecord(data, options = {}) {
        // Clone untuk menghilangkan reactivity
        let record = this.cloneData(data);

        // Prepare dengan ID dan timestamps
        record = this.prepareNewRecord(record, options);

        // Standardize metadata
        record = this.standardizeMetadata(record);

        return record;
    },

    /**
     * Helper untuk update record dengan standar lengkap
     * @param {Object} data - Data record
     * @returns {Object} Record yang siap di-update
     */
    updateRecord(data) {
        // Clone untuk menghilangkan reactivity
        let record = this.cloneData(data);

        // Update timestamp
        record = this.prepareUpdateRecord(record);

        // Standardize metadata
        record = this.standardizeMetadata(record);

        return record;
    }
};

// Export
if (typeof window !== 'undefined') {
    window.DatabaseHelpers = DatabaseHelpers;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DatabaseHelpers };
}
