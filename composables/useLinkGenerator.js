/**
 * useLinkGenerator Composable
 *
 * Centralized link generation untuk CEX, DEX, Explorer, dll
 * Menggantikan duplikasi di scanning-tab.js dan component lain
 *
 * Features:
 * - CEX trade links
 * - CEX withdraw/deposit links
 * - CEX wallet balance links
 * - DEX trade links
 * - Explorer links
 * - DEX aggregator links
 */

const useLinkGenerator = (config) => {
  /**
   * Get CEX trade link
   * @param {object} token - Token object
   * @param {string} symbol - Symbol to trade (token or pair)
   * @returns {string} Trade URL
   */
  const getCexTradeLink = (token, symbol) => {
    const cexKey = (token.cex_name || '').toUpperCase();
    if (!cexKey) return '#';

    const cexConfig = config?.CEX?.[cexKey];
    if (!cexConfig || !cexConfig.URLS) return '#';

    const urlTemplate = cexConfig.URLS.TRADE;
    if (!urlTemplate) return '#';

    // Determine if this is for token or pair
    const isForToken = (symbol === (token.cex_ticker_token || token.nama_token));
    const isForPair = (symbol === (token.cex_ticker_pair || token.nama_pair));

    let baseSymbol = '';
    let pairSymbol = 'USDT';

    if (isForToken) {
      baseSymbol = token.nama_token;
      pairSymbol = token.nama_pair || 'USDT';
    } else if (isForPair) {
      baseSymbol = token.nama_pair;
      pairSymbol = 'USDT';
    } else {
      baseSymbol = symbol;
    }

    if (!baseSymbol) return '#';
    const effectivePairSymbol = pairSymbol || 'USDT';

    // Build replacements object
    const replacements = {
      symbol: baseSymbol,
      token: baseSymbol,
      base: baseSymbol,
      pair: effectivePairSymbol,
      quote: effectivePairSymbol,
      symbolpair: `${baseSymbol}${effectivePairSymbol}`,
      pairtoken: `${effectivePairSymbol}${baseSymbol}`,
      basequote: `${baseSymbol}${effectivePairSymbol}`,
      quotebase: `${effectivePairSymbol}${baseSymbol}`,
      'symbol_pair': `${baseSymbol}_${effectivePairSymbol}`,
      'pair_symbol': `${effectivePairSymbol}_${baseSymbol}`,
      'symbol-pair': `${baseSymbol}-${effectivePairSymbol}`,
      'pair-symbol': `${effectivePairSymbol}-${baseSymbol}`,
      'symbolpairdash': `${baseSymbol}-${effectivePairSymbol}`
    };

    // Replace placeholders in URL template
    return urlTemplate.replace(/{([^{}]+)}/g, (match, key) => {
      const normalized = key.trim();
      const lowerNormalized = normalized.toLowerCase();

      if (replacements.hasOwnProperty(normalized)) {
        return replacements[normalized];
      }

      if (replacements.hasOwnProperty(lowerNormalized)) {
        return replacements[lowerNormalized];
      }

      const simplified = lowerNormalized.replace(/[^a-z]/g, '');
      if (replacements.hasOwnProperty(simplified)) {
        return replacements[simplified];
      }

      return '';
    });
  };

  /**
   * Get explorer link for contract address
   * @param {object} token - Token object
   * @param {string} contractAddress - Contract address
   * @returns {string} Explorer URL
   */
  const getExplorerLink = (token, contractAddress) => {
    if (!contractAddress || !token || !token.chain) return '#';

    const chainKey = token.chain.toLowerCase();
    const chainConfig = config?.CHAINS?.[chainKey];

    const urlTemplate = chainConfig?.LINKS?.EXPLORER?.TOKEN || chainConfig?.LINKS?.EXPLORER?.ADDRESS;
    if (!urlTemplate) return '#';

    return urlTemplate.replace('{address}', contractAddress);
  };

  /**
   * Get CEX wallet balance link
   * @param {object} token - Token object
   * @param {string} contractAddress - Contract address
   * @param {number} walletIndex - Wallet index (1, 2, or 3)
   * @returns {string} Wallet balance URL
   */
  const getCexWalletBalanceLink = (token, contractAddress, walletIndex = 1) => {
    if (!contractAddress) return '#';

    const cexKey = (token.cex_name || '').toUpperCase();
    if (!cexKey) return getExplorerLink(token, contractAddress);

    const chain = token.chain.toLowerCase();
    const cexConfig = config?.CEX?.[cexKey];

    if (!cexConfig || !cexConfig.WALLETS || !cexConfig.WALLETS[chain]) {
      return getExplorerLink(token, contractAddress);
    }

    const walletData = cexConfig.WALLETS[chain];
    let walletAddress = null;

    // Select wallet by index
    if (walletIndex === 1) {
      walletAddress = walletData.address;
    } else if (walletIndex === 2) {
      walletAddress = walletData.address2 || walletData.address;
    } else if (walletIndex === 3) {
      walletAddress = walletData.address3 || walletData.address2 || walletData.address;
    }

    if (!walletAddress) {
      return getExplorerLink(token, contractAddress);
    }

    // Get explorer template
    const chainConfig = config?.CHAINS?.[chain];
    const urlTemplate = chainConfig?.LINKS?.EXPLORER?.TOKEN;

    if (!urlTemplate) {
      return `https://etherscan.io/token/${contractAddress}?a=${walletAddress}`;
    }

    return `${urlTemplate.replace('{address}', contractAddress)}?a=${walletAddress}`;
  };

  /**
   * Get CEX deposit link
   * @param {object} token - Token object
   * @param {string} symbol - Symbol to deposit
   * @returns {string} Deposit URL
   */
  const getCexDepositLink = (token, symbol) => {
    const cexKey = (token.cex_name || '').toUpperCase();
    if (!cexKey || !symbol) return '#';

    const cexConfig = config?.CEX?.[cexKey];
    const urlTemplate = cexConfig?.URLS?.DEPOSIT;

    if (!urlTemplate) return '#';

    return urlTemplate
      .replace(/{token}/g, symbol)
      .replace(/{pair}/g, symbol);
  };

  /**
   * Get CEX withdraw link
   * @param {object} token - Token object
   * @param {string} symbol - Symbol to withdraw
   * @returns {string} Withdraw URL
   */
  const getCexWithdrawLink = (token, symbol) => {
    const cexKey = (token.cex_name || '').toUpperCase();
    if (!cexKey || !symbol) return '#';

    const cexConfig = config?.CEX?.[cexKey];
    const urlTemplate = cexConfig?.URLS?.WITHDRAW;

    if (!urlTemplate) return '#';

    return urlTemplate
      .replace(/{token}/g, symbol)
      .replace(/{pair}/g, symbol);
  };

  /**
   * Get DEX trade link
   * @param {object} token - Token object
   * @param {string} dexKey - DEX key (e.g., 'odos', 'kyber')
   * @param {string} direction - 'CEXtoDEX' or 'DEXtoCEX'
   * @returns {string} DEX trade URL
   */
  const getDexTradeLink = (token, dexKey, direction = 'CEXtoDEX') => {
    if (!token || !dexKey) return '#';

    const dexConfig = config?.DEXS?.[String(dexKey || '').toLowerCase()];
    const urlTemplate = dexConfig?.URL_DEX;
    if (!urlTemplate) return '#';

    const chainKey = String(token.chain || '').toLowerCase();
    const chainConfig = config?.CHAINS?.[chainKey] || {};

    const chainNameOriginal = chainConfig.NAMA_CHAIN || chainConfig.NAMA_PENDEK || token.chain || '';
    const chainNameLower = String(chainNameOriginal || '').toLowerCase();

    const chainCodeSource = chainConfig.NAMA_PENDEK || chainConfig.KODE_CHAIN || chainNameOriginal;
    const chainCodeString = typeof chainCodeSource === 'number'
      ? String(chainCodeSource)
      : String(chainCodeSource || '').toLowerCase();
    const chainCodeUpper = typeof chainCodeSource === 'number'
      ? String(chainCodeSource)
      : String(chainCodeSource || '').toUpperCase();

    // Sanitize symbols
    const sanitizeSymbol = (value) => {
      if (!value) return '';
      const raw = value.toString().trim();
      if (!raw) return '';
      const symbolPart = raw.includes('/') ? raw.split('/')[0] : raw.includes('_') ? raw.split('_')[0] : raw;
      return symbolPart.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    };

    const tokenSymbol = sanitizeSymbol(token.cex_ticker_token || token.nama_token);
    const pairSymbol = sanitizeSymbol(token.cex_ticker_pair || token.nama_pair) || 'USDT';

    const tokenAddress = String(token.sc_token || '').toLowerCase();
    const pairAddress = String(token.sc_pair || '').toLowerCase();

    // Build replacements
    const replacements = {
      chainName: chainNameLower,
      chain: chainNameLower,
      chainLower: chainNameLower,
      chainUpper: String(chainNameOriginal || '').toUpperCase(),
      chainOriginal: chainNameOriginal,
      chainCode: chainCodeString,
      chaincode: chainCodeString,
      chainCodeUpper: chainCodeUpper,
      chainCodeLower: chainCodeString,
      tokenSymbol,
      baseSymbol: tokenSymbol,
      tokenSymbolLower: tokenSymbol.toLowerCase(),
      pairSymbol,
      quoteSymbol: pairSymbol,
      pairSymbolLower: pairSymbol.toLowerCase(),
      tokenAddress,
      pairAddress,
      fromAddress: direction === 'CEXtoDEX' ? tokenAddress : pairAddress,
      toAddress: direction === 'CEXtoDEX' ? pairAddress : tokenAddress,
      direction
    };

    // Replace placeholders
    return urlTemplate.replace(/{([^{}]+)}/g, (match, key) => {
      const normalized = key.trim();
      if (replacements.hasOwnProperty(normalized)) {
        return String(replacements[normalized] || '');
      }
      const lower = normalized.toLowerCase();
      if (replacements.hasOwnProperty(lower)) {
        return String(replacements[lower] || '');
      }
      const compact = lower.replace(/[^a-z]/g, '');
      if (replacements.hasOwnProperty(compact)) {
        return String(replacements[compact] || '');
      }
      return '';
    });
  };

  /**
   * Get DEX aggregator link
   * @param {object} token - Token object
   * @param {string} aggregator - Aggregator code ('UNX', 'OKX', 'DFL', 'JMX')
   * @returns {string} Aggregator URL
   */
  const getDexAggregatorLink = (token, aggregator) => {
    const chainKey = String(token.chain || '').toLowerCase();
    const chainConfig = config?.CHAINS?.[chainKey];
    const chainId = chainConfig?.KODE_CHAIN || '1';

    const scTokenIn = token.sc_token;
    const scTokenOut = token.sc_pair;

    switch (aggregator.toUpperCase()) {
      case 'UNX':
        return `https://app.unidex.exchange/?chain=${token.chain}&from=${scTokenIn}&to=${scTokenOut}`;
      case 'OKX':
        return `https://www.okx.com/web3/dex-swap?inputChain=${chainId}&inputCurrency=${scTokenIn}&outputChain=${chainId}&outputCurrency=${scTokenOut}`;
      case 'DFL':
        return `https://swap.defillama.com/?chain=${token.chain}&from=${scTokenIn}&to=${scTokenOut}`;
      case 'JMX':
        return `https://jumper.exchange/?fromChain=${chainId}&fromToken=${scTokenIn}&toChain=${chainId}&toToken=${scTokenOut}`;
      default:
        return '#';
    }
  };

  // Return public API
  return {
    getCexTradeLink,
    getExplorerLink,
    getCexWalletBalanceLink,
    getCexDepositLink,
    getCexWithdrawLink,
    getDexTradeLink,
    getDexAggregatorLink
  };
};

// Export untuk window global (Vue 2 style compatible)
if (typeof window !== 'undefined') {
  window.useLinkGenerator = useLinkGenerator;
}
