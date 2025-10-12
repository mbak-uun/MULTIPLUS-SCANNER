/**
 * useTokenForm Composable
 *
 * Centralized form state management untuk Add/Edit/Import Token
 * Menggantikan duplikasi form logic di scanning-tab.js, management-tab.js, dan sync-tab.js
 *
 * Features:
 * - Reactive form state
 * - Form validation
 * - Pair & DEX selection logic
 * - Populate from existing token
 * - Build save payload
 */

const useTokenForm = () => {
  // Reactive form state
  const formData = {
    selectedPairType: '',
    selectedDex: [],
    dexModals: {}, // { dexKey: { modalKiri: 100, modalKanan: 100 } }
    nonData: { symbol: '', sc: '', des: 18 },
    tokenData: { name: '', sc: '', decimals: 18 },
    selectedCex: [],
    cex_tickers: {}, // { CEX_NAME: 'TICKER' }
  };

  /**
   * Reset form ke initial state
   */
  const resetFormData = (state) => {
    state.selectedPairType = '';
    state.selectedDex = [];
    state.dexModals = {};
    state.nonData = { symbol: '', sc: '', des: 18 };
    state.tokenData = { name: '', sc: '', decimals: 18 };
    state.selectedCex = [];
    state.cex_tickers = {};
  };

  /**
   * Toggle DEX selection
   * @param {string} dexKey - DEX key (e.g., 'odos', 'kyber')
   */
  const toggleDexSelection = (state, dexKey) => {
    const index = state.selectedDex.indexOf(dexKey);
    if (index > -1) {
      // Remove DEX
      state.selectedDex.splice(index, 1);
      delete state.dexModals[dexKey];
    } else {
      // Add DEX with default modal values
      state.selectedDex.push(dexKey);
      state.dexModals[dexKey] = { modalKiri: 100, modalKanan: 100 };
    }
  };

  /**
   * Update DEX modal value
   * @param {string} dexKey - DEX key
   * @param {string} field - 'modalKiri' or 'modalKanan'
   * @param {number} value - Modal value in USD
   */
  const updateDexModal = (state, dexKey, field, value) => {
    if (!state.dexModals[dexKey]) {
      state.dexModals[dexKey] = { modalKiri: 100, modalKanan: 100 };
    }
    state.dexModals[dexKey][field] = parseInt(value) || 0;
  };

  /**
   * Check if NON pair is selected
   */
  const isNonPair = (state) => {
    return state.selectedPairType === 'NON';
  };

  /**
   * Get available pair options from chain config
   * @param {object} config - App config
   * @param {string} activeChain - Active chain key
   */
  const getAvailablePairOptions = (config, activeChain) => {
    const chainConf = config.CHAINS?.[activeChain?.toLowerCase()];
    if (!chainConf || !chainConf.PAIR_DEXS) return [];

    return Object.entries(chainConf.PAIR_DEXS).map(([key, info]) => ({
      key,
      symbol: info.SYMBOL_PAIR,
      address: info.SC_ADDRESS_PAIR,
      decimals: Number(info.DECIMALS_PAIR ?? 18)
    }));
  };

  /**
   * Get available DEX options from global settings
   * @param {object} globalSettings - Global settings with config_dex
   * @param {object} config - App config
   */
  const getAvailableDexOptions = (globalSettings, config) => {
    const dexGlobalConfig = globalSettings?.config_dex;
    if (!dexGlobalConfig) return [];

    // Filter only active DEX
    return Object.keys(dexGlobalConfig)
      .filter(key => dexGlobalConfig[key]?.status === true)
      .map(dexKey => {
        const dexInfo = config?.DEXS?.[dexKey.toLowerCase()] || {};
        return {
          key: dexKey,
          name: dexKey.toUpperCase(),
          color: dexInfo.WARNA || '#0d6efd'
        };
      });
  };

  /**
   * Get selected pair info
   * @param {object} state - Form state
   * @param {array} availablePairOptions - Available pair options
   */
  const getSelectedPairInfo = (state, availablePairOptions) => {
    if (isNonPair(state)) return null;
    return availablePairOptions.find(p => p.key === state.selectedPairType) || null;
  };

  /**
   * Populate form from existing token (for Edit mode)
   * @param {object} state - Form state
   * @param {object} token - Token object
   * @param {array} availablePairOptions - Available pair options
   */
  const populateFromToken = (state, token, availablePairOptions) => {
    // CEX configuration
    state.selectedCex = [token.cex_name];
    state.cex_tickers[token.cex_name] = token.cex_ticker_token;

    // Token data
    state.tokenData = {
      name: token.nama_koin || token.nama_token,
      sc: token.sc_token,
      decimals: token.des_token || 18
    };

    // Pair selection
    state.selectedPairType = token.nama_pair || availablePairOptions[0]?.key || '';

    // DEX configuration
    state.selectedDex = Object.keys(token.dex || {}).filter(dexKey => token.dex[dexKey]?.status);
    state.dexModals = {};
    Object.keys(token.dex || {}).forEach(dexKey => {
      if (token.dex[dexKey]?.status) {
        state.dexModals[dexKey] = {
          modalKiri: token.dex[dexKey]?.left || 100,
          modalKanan: token.dex[dexKey]?.right || 100
        };
      }
    });
  };

  /**
   * Validate form data
   * @param {object} state - Form state
   * @returns {object} { valid: boolean, message: string }
   */
  const validateForm = (state) => {
    // Token name required
    if (!state.tokenData.name?.trim()) {
      return { valid: false, message: 'Nama Token wajib diisi.' };
    }

    // Smart contract required
    if (!state.tokenData.sc?.trim()) {
      return { valid: false, message: 'Smart Contract wajib diisi.' };
    }

    // Smart contract format validation (EVM address)
    const scRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!scRegex.test(state.tokenData.sc)) {
      return { valid: false, message: 'Format Smart Contract tidak valid (harus 0x + 40 hex characters).' };
    }

    // CEX selection required
    if (state.selectedCex.length === 0) {
      return { valid: false, message: 'Pilih minimal satu CEX.' };
    }

    // CEX ticker required
    const cexKey = state.selectedCex[0];
    if (!state.cex_tickers[cexKey]?.trim()) {
      return { valid: false, message: 'Ticker CEX wajib diisi.' };
    }

    // Pair selection required
    if (!state.selectedPairType) {
      return { valid: false, message: 'Pilih jenis Pair.' };
    }

    // NON pair validation
    if (isNonPair(state)) {
      if (!state.nonData.symbol?.trim()) {
        return { valid: false, message: 'Symbol NON Pair wajib diisi.' };
      }
      if (!state.nonData.sc?.trim()) {
        return { valid: false, message: 'Smart Contract NON Pair wajib diisi.' };
      }
      if (!scRegex.test(state.nonData.sc)) {
        return { valid: false, message: 'Format Smart Contract NON Pair tidak valid.' };
      }
    }

    // DEX selection required (minimal 1)
    if (state.selectedDex.length === 0) {
      return { valid: false, message: 'Pilih minimal satu DEX.' };
    }

    // All validations passed
    return { valid: true, message: '' };
  };

  /**
   * Build save payload from form data
   * @param {object} state - Form state
   * @param {object} existingToken - Existing token (for edit mode) or null (for add mode)
   * @param {string} activeChain - Active chain
   * @param {array} availablePairOptions - Available pair options
   * @returns {object} Token payload
   */
  const buildSavePayload = (state, existingToken, activeChain, availablePairOptions) => {
    // Get pair info
    let pairInfo;
    if (isNonPair(state)) {
      pairInfo = {
        symbol: state.nonData.symbol.toUpperCase(),
        address: state.nonData.sc,
        decimals: Number(state.nonData.des || 18)
      };
    } else {
      const pair = availablePairOptions.find(p => p.key === state.selectedPairType);
      pairInfo = {
        symbol: pair.symbol,
        address: pair.address,
        decimals: Number(pair.decimals || 18)
      };
    }

    // Build DEX config
    const dexConfig = state.selectedDex.reduce((acc, dexKey) => {
      const modal = state.dexModals[dexKey] || { modalKiri: 100, modalKanan: 100 };
      acc[dexKey] = {
        status: true,
        left: Number(modal.modalKiri || 0),
        right: Number(modal.modalKanan || 0)
      };
      return acc;
    }, {});

    // Build token payload
    const cexKey = state.selectedCex[0];
    const payload = {
      chain: activeChain.toUpperCase(),
      nama_koin: state.tokenData.name.toUpperCase(),
      nama_token: state.tokenData.name.toUpperCase(),
      sc_token: state.tokenData.sc,
      des_token: Number(state.tokenData.decimals || 18),
      cex_name: cexKey.toUpperCase(),
      cex_ticker_token: state.cex_tickers[cexKey].toUpperCase(),
      nama_pair: pairInfo.symbol,
      sc_pair: pairInfo.address,
      des_pair: pairInfo.decimals,
      dex: dexConfig
    };

    // Merge with existing token data (for edit mode)
    if (existingToken) {
      return {
        ...existingToken,
        ...payload,
        // Preserve fields yang tidak di-edit
        id: existingToken.id,
        isFavorite: existingToken.isFavorite || false,
        cex_withdraw_status: existingToken.cex_withdraw_status,
        cex_deposit_status: existingToken.cex_deposit_status,
        cex_pair_withdraw_status: existingToken.cex_pair_withdraw_status,
        cex_pair_deposit_status: existingToken.cex_pair_deposit_status,
        cex_ticker_pair: existingToken.cex_ticker_pair || pairInfo.symbol
      };
    }

    // Generate ID untuk new token
    const timestamp = Date.now();
    payload.id = `${activeChain.toUpperCase()}_${cexKey.toUpperCase()}_${state.tokenData.name.toUpperCase()}_${pairInfo.symbol}_${timestamp}`;
    payload.isFavorite = false;

    // Default CEX status (akan di-update by sync)
    payload.cex_withdraw_status = false;
    payload.cex_deposit_status = false;
    payload.cex_pair_withdraw_status = false;
    payload.cex_pair_deposit_status = false;
    payload.cex_ticker_pair = pairInfo.symbol;

    return payload;
  };

  // Return public API
  return {
    formData,
    resetFormData,
    toggleDexSelection,
    updateDexModal,
    isNonPair,
    getAvailablePairOptions,
    getAvailableDexOptions,
    getSelectedPairInfo,
    populateFromToken,
    validateForm,
    buildSavePayload
  };
};

// Export untuk window global (Vue 2 style compatible)
if (typeof window !== 'undefined') {
  window.useTokenForm = useTokenForm;
}
