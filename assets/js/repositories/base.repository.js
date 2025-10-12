/**
 * ===================================================================================
 * Base Repository
 * ===================================================================================
 *
 * Abstract base class untuk semua repositories.
 * Menyediakan CRUD operations dasar untuk IndexedDB.
 */
class BaseRepository {
    constructor(dbService) {
        if (!dbService) {
            console.error('[BaseRepository] ERROR: dbService is undefined!');
            console.trace();
        }
        this.db = dbService;
    }

    /**
     * Get all records from store
     * @param {string} storeName
     * @returns {Promise<Array>}
     */
    async getAll(storeName) {
        try {
            return await this.db.getAllData(storeName);
        } catch (error) {
            console.error(`[${this.constructor.name}] getAll error:`, error);
            throw new Error(`Failed to get all records from ${storeName}: ${error.message}`);
        }
    }

    /**
     * Get record by ID
     * @param {string} storeName
     * @param {string|number} id
     * @returns {Promise<object|null>}
     */
    async getById(storeName, id) {
        try {
            return await this.db.getData(storeName, id);
        } catch (error) {
            console.error(`[${this.constructor.name}] getById error:`, error);
            return null;
        }
    }

    /**
     * Save (insert or update) record
     * @param {string} storeName
     * @param {object} record
   * @param {string|number} [key] - Kunci eksplisit untuk store dengan out-of-line keys (seperti SETTING_GLOBAL).
     * @returns {Promise<object>}
     */
  async save(storeName, record, key = null) {
        try {
      // Gunakan helper jika ada, jika tidak, gunakan logika dasar
      const helpers = window.DatabaseHelpers;
      let dataToSave;

            // Deteksi apakah record baru atau update
      // Record dianggap baru jika tidak memiliki 'id' dan tidak ada 'key' eksplisit yang diberikan.
      const isNew = !record.id && !key;

      if (helpers) {
        dataToSave = isNew
          ? helpers.createRecord(record, { generateId: true })
          : helpers.updateRecord(record);
      } else {
        // Fallback jika helper tidak ada
        dataToSave = { ...record };
        if (isNew) dataToSave.id = crypto.randomUUID();
        dataToSave.updatedAt = new Date().toISOString();
        if (isNew) dataToSave.createdAt = dataToSave.updatedAt;
      }

      await this.db.saveData(storeName, dataToSave, key);
            return dataToSave;
        } catch (error) {
            console.error(`[${this.constructor.name}] save error:`, error);
            throw new Error(`Failed to save record to ${storeName}: ${error.message}`);
        }
    }

    /**
     * Delete record by ID
     * @param {string} storeName
     * @param {string|number} id
     * @returns {Promise<boolean>}
     */
    async delete(storeName, id) {
        try {
            await this.db.deleteData(storeName, id);
            return true;
        } catch (error) {
            console.error(`[${this.constructor.name}] delete error:`, error);
            throw new Error(`Failed to delete record from ${storeName}: ${error.message}`);
        }
    }

    /**
     * Delete all records from store
     * @param {string} storeName
     * @returns {Promise<boolean>}
     */
    async deleteAll(storeName) {
        try {
            const records = await this.getAll(storeName);
            for (const record of records) {
                if (record.id) {
                    await this.delete(storeName, record.id);
                }
            }
            return true;
        } catch (error) {
            console.error(`[${this.constructor.name}] deleteAll error:`, error);
            throw new Error(`Failed to delete all records from ${storeName}: ${error.message}`);
        }
    }

    /**
     * Count records in store
     * @param {string} storeName
     * @returns {Promise<number>}
     */
    async count(storeName) {
        try {
            const records = await this.getAll(storeName);
            return records.length;
        } catch (error) {
            console.error(`[${this.constructor.name}] count error:`, error);
            return 0;
        }
    }
}

// Export
if (typeof window !== 'undefined') {
    window.BaseRepository = BaseRepository;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BaseRepository };
}
