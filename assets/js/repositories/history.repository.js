/**
 * ===================================================================================
 * History Repository
 * ===================================================================================
 *
 * Mengelola riwayat aksi pengguna di IndexedDB (RIWAYAT_AKSI).
 */
class HistoryRepository extends BaseRepository {
    constructor(dbService) {
        super(dbService);
        this.HISTORY_STORE = 'RIWAYAT_AKSI';
    }

    /**
     * Get all history records
     * @returns {Promise<Array>}
     */
    async getAllHistory() {
        return await this.getAll(this.HISTORY_STORE);
    }

    /**
     * Add history record
     * @param {object} record - { action, status, message, ...extra }
     * @returns {Promise<object>}
     */
    async addHistory(record) {
        const historyRecord = {
            ...record,
            timestamp: new Date().toISOString(),
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now()
        };

        return await this.save(this.HISTORY_STORE, historyRecord);
    }

    /**
     * Log action (alias untuk addHistory dengan auto-format)
     * @param {string} action - Action name (e.g., 'IMPORT_KOIN')
     * @param {object} details - Action details
     * @param {string} status - success|error|warning
     * @returns {Promise<object>}
     */
    async logAction(action, details = {}, status = 'success') {
        return await this.addHistory({
            action,
            status,
            ...details
        });
    }

    /**
     * Get history by action type
     * @param {string} action
     * @returns {Promise<Array>}
     */
    async getByAction(action) {
        const allHistory = await this.getAllHistory();
        return allHistory.filter(h => h.action === action);
    }

    /**
     * Get recent history (last N records)
     * @param {number} limit
     * @returns {Promise<Array>}
     */
    async getRecent(limit = 50) {
        const allHistory = await this.getAllHistory();
        return allHistory
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }

    /**
     * Clear all history
     * @returns {Promise<boolean>}
     */
    async clearAllHistory() {
        return await this.deleteAll(this.HISTORY_STORE);
    }

    /**
     * Delete history older than days
     * @param {number} days
     * @returns {Promise<number>} Count of deleted records
     */
    async deleteOlderThan(days) {
        const allHistory = await this.getAllHistory();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        let deletedCount = 0;
        for (const record of allHistory) {
            if (new Date(record.timestamp) < cutoffDate) {
                await this.delete(this.HISTORY_STORE, record.id);
                deletedCount++;
            }
        }

        return deletedCount;
    }
}

// Export
if (typeof window !== 'undefined') {
    window.HistoryRepository = HistoryRepository;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HistoryRepository };
}
