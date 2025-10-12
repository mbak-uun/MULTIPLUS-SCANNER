/**
 * useTokenActions Composable
 *
 * Centralized CRUD operations untuk Token Management
 * Menggantikan duplikasi di scanning-tab.js, management-tab.js
 *
 * Features:
 * - Save token (add/edit)
 * - Delete token
 * - Toggle favorite
 * - Bulk import
 * - History logging integration
 */

const useTokenActions = () => {
  /**
   * Get repository instances
   */
  const getCoinRepository = () => {
    return window.AppContainer.get('coinRepository');
  };

  const getHistoryRepository = () => {
    return window.AppContainer.get('historyRepository');
  };

  /**
   * Save token (create or update)
   * @param {object} token - Token payload
   * @param {boolean} isEdit - True if editing existing token
   * @returns {Promise<object>} Saved token
   */
  const saveToken = async (token, isEdit = false) => {
    try {
      const coinRepo = getCoinRepository();
      const savedToken = await coinRepo.save(token);

      // Log to history
      const historyRepo = getHistoryRepository();
      await historyRepo.save({
        action: isEdit ? 'EDIT_TOKEN' : 'ADD_TOKEN',
        status: 'success',
        message: `Token ${token.nama_koin} berhasil ${isEdit ? 'diupdate' : 'ditambahkan'}.`,
        chain: token.chain,
        details: {
          tokenId: savedToken.id,
          tokenName: savedToken.nama_koin,
          cex: savedToken.cex_name,
          dexCount: Object.keys(savedToken.dex || {}).length
        }
      });

      return savedToken;
    } catch (error) {
      logger.error('[useTokenActions] Error saving token:', error);

      // Log error to history
      const historyRepo = getHistoryRepository();
      await historyRepo.save({
        action: isEdit ? 'EDIT_TOKEN' : 'ADD_TOKEN',
        status: 'error',
        message: `Gagal ${isEdit ? 'mengupdate' : 'menambahkan'} token ${token.nama_koin}.`,
        chain: token.chain,
        details: {
          error: error.message
        }
      });

      throw error;
    }
  };

  /**
   * Delete token
   * @param {string} tokenId - Token ID
   * @param {string} chain - Chain key
   * @param {string} tokenName - Token name (for logging)
   * @returns {Promise<void>}
   */
  const deleteToken = async (tokenId, chain, tokenName) => {
    try {
      const coinRepo = getCoinRepository();
      await coinRepo.delete(tokenId, chain);

      // Log to history
      const historyRepo = getHistoryRepository();
      await historyRepo.save({
        action: 'DELETE_TOKEN',
        status: 'success',
        message: `Token ${tokenName} berhasil dihapus.`,
        chain: chain,
        details: {
          tokenId,
          tokenName
        }
      });
    } catch (error) {
      logger.error('[useTokenActions] Error deleting token:', error);

      // Log error to history
      const historyRepo = getHistoryRepository();
      await historyRepo.save({
        action: 'DELETE_TOKEN',
        status: 'error',
        message: `Gagal menghapus token ${tokenName}.`,
        chain: chain,
        details: {
          tokenId,
          error: error.message
        }
      });

      throw error;
    }
  };

  /**
   * Toggle token favorite status
   * @param {object} token - Token object
   * @returns {Promise<object>} Updated token
   */
  const toggleFavorite = async (token) => {
    try {
      // Get current favorite status (backward compatible dengan field lama)
      const currentFavorite = Boolean(token.isFavorite || token.isFavorit);
      const newFavoriteStatus = !currentFavorite;

      // Update token object
      token.isFavorite = newFavoriteStatus;
      token.isFavorit = newFavoriteStatus;

      // Clean token untuk save (remove old field)
      let cleanToken = JSON.parse(JSON.stringify(token));
      cleanToken.isFavorite = newFavoriteStatus;
      delete cleanToken.isFavorit;

      // Save to database
      const coinRepo = getCoinRepository();
      const savedToken = await coinRepo.save(cleanToken);

      // Log to history
      const historyRepo = getHistoryRepository();
      await historyRepo.save({
        action: 'TOGGLE_FAVORITE',
        status: 'success',
        message: `Token ${token.nama_token || token.nama_koin} ${newFavoriteStatus ? 'ditambahkan ke' : 'dihapus dari'} favorit.`,
        chain: token.chain,
        details: {
          tokenId: token.id,
          tokenName: token.nama_token || token.nama_koin,
          isFavorite: newFavoriteStatus
        }
      });

      return savedToken;
    } catch (error) {
      logger.error('[useTokenActions] Error toggling favorite:', error);

      // Log error to history
      const historyRepo = getHistoryRepository();
      await historyRepo.save({
        action: 'TOGGLE_FAVORITE',
        status: 'error',
        message: `Gagal mengubah status favorit token ${token.nama_token || token.nama_koin}.`,
        chain: token.chain,
        details: {
          tokenId: token.id,
          error: error.message
        }
      });

      throw error;
    }
  };

  /**
   * Bulk import tokens
   * @param {array} tokens - Array of token payloads
   * @param {string} chain - Chain key
   * @returns {Promise<object>} { imported: number, updated: number, errors: number }
   */
  const bulkImport = async (tokens, chain) => {
    const results = {
      imported: 0,
      updated: 0,
      errors: 0,
      errorDetails: []
    };

    const coinRepo = getCoinRepository();

    for (const token of tokens) {
      try {
        // Check if token already exists
        const existingTokens = await coinRepo.getAll(chain);
        const exists = existingTokens.some(t =>
          t.nama_koin === token.nama_koin &&
          t.cex_name === token.cex_name
        );

        await coinRepo.save(token);

        if (exists) {
          results.updated++;
        } else {
          results.imported++;
        }
      } catch (error) {
        results.errors++;
        results.errorDetails.push({
          tokenName: token.nama_koin,
          error: error.message
        });
        logger.error(`[useTokenActions] Error importing token ${token.nama_koin}:`, error);
      }
    }

    // Log to history
    const historyRepo = getHistoryRepository();
    await historyRepo.save({
      action: 'BULK_IMPORT',
      status: results.errors === 0 ? 'success' : 'partial',
      message: `Bulk import selesai: ${results.imported} ditambahkan, ${results.updated} diupdate, ${results.errors} gagal.`,
      chain: chain,
      details: {
        imported: results.imported,
        updated: results.updated,
        errors: results.errors,
        totalTokens: tokens.length,
        errorDetails: results.errorDetails
      }
    });

    return results;
  };

  /**
   * Load all tokens for a chain
   * @param {string} chain - Chain key
   * @returns {Promise<array>} Array of tokens
   */
  const loadTokens = async (chain) => {
    try {
      const coinRepo = getCoinRepository();
      return await coinRepo.getAll(chain);
    } catch (error) {
      logger.error('[useTokenActions] Error loading tokens:', error);
      throw error;
    }
  };

  /**
   * Get token by ID
   * @param {string} tokenId - Token ID
   * @param {string} chain - Chain key
   * @returns {Promise<object|null>} Token or null if not found
   */
  const getTokenById = async (tokenId, chain) => {
    try {
      const coinRepo = getCoinRepository();
      return await coinRepo.get(tokenId, chain);
    } catch (error) {
      logger.error('[useTokenActions] Error getting token:', error);
      return null;
    }
  };

  /**
   * Clear all tokens for a chain
   * @param {string} chain - Chain key
   * @returns {Promise<void>}
   */
  const clearAllTokens = async (chain) => {
    try {
      const coinRepo = getCoinRepository();
      const tokens = await coinRepo.getAll(chain);

      for (const token of tokens) {
        await coinRepo.delete(token.id, chain);
      }

      // Log to history
      const historyRepo = getHistoryRepository();
      await historyRepo.save({
        action: 'CLEAR_TOKENS',
        status: 'success',
        message: `Semua token di chain ${chain} berhasil dihapus.`,
        chain: chain,
        details: {
          count: tokens.length
        }
      });
    } catch (error) {
      logger.error('[useTokenActions] Error clearing tokens:', error);
      throw error;
    }
  };

  // Return public API
  return {
    saveToken,
    deleteToken,
    toggleFavorite,
    bulkImport,
    loadTokens,
    getTokenById,
    clearAllTokens
  };
};

// Export untuk window global (Vue 2 style compatible)
if (typeof window !== 'undefined') {
  window.useTokenActions = useTokenActions;
}
