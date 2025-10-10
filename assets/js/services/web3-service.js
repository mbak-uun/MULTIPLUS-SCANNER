// assets/js/portfolio-web3-helper.js
// Helper untuk fetch wallet balance menggunakan Web3.js
// Kompatibel dengan KONFIG_APLIKASI
class Web3Service {
  constructor(config) {
    this.config = config;
    this.web3Instances = {}; // Cache Web3 instance per chain
  }

  /**
   * Get RPC URL dari config
   */
  _getRpcUrl(chainKey) {
    const chainConfig = this.config?.CHAINS?.[chainKey.toLowerCase()];
    if (!chainConfig || !chainConfig.RPC) {
      throw new Error(`RPC configuration not found for chain: ${chainKey}`);
    }
    return chainConfig.RPC;
  }

  _getChainConfig(chainKey) {
    const lower = String(chainKey || '').toLowerCase();
    return this.config?.CHAINS?.[lower] || null;
  }

  /**
   * Get atau create Web3 instance (with caching)
   */
  _getWeb3Instance(chainKey) {
    const lowerChainKey = chainKey.toLowerCase();

    if (this.web3Instances[lowerChainKey]) {
      return this.web3Instances[lowerChainKey];
    }

    if (typeof Web3 === 'undefined') {
      throw new Error('Web3.js is not loaded. Make sure it is included in your HTML.');
    }

    const rpcUrl = this._getRpcUrl(lowerChainKey);
    const web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
    this.web3Instances[lowerChainKey] = web3;
    return web3;
  }

  /**
   * Get native token symbol dari BASE_FEE_DEX
   * Contoh: "BNBUSDT" -> "BNB"
   */
  _getNativeSymbol(chainKey) {
    const chainConfig = this.config?.CHAINS?.[chainKey.toLowerCase()];
    const baseFeeDex = chainConfig?.BASE_FEE_DEX || '';
    const gasSymbol = baseFeeDex.replace(/USDT$/, '').toUpperCase();
    return gasSymbol || 'ETH'; // fallback
  }

  _isNativeLikeAddress(address) {
    const normalized = String(address || '').toLowerCase();
    if (!normalized || normalized === '0x' || normalized === '0x0') return true;
    return [
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000001010',
      '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    ].includes(normalized);
  }

  _getTrackedTokens(chainKey) {
    const chainConfig = this._getChainConfig(chainKey);
    const pairs = chainConfig?.PAIR_DEXS || {};
    const unique = new Map();

    Object.values(pairs).forEach((pair) => {
      const symbol = String(pair?.SYMBOL_PAIR || '').toUpperCase();
      if (!symbol || symbol === 'NON') return;
      const address = String(pair?.SC_ADDRESS_PAIR || '').trim();
      if (!address) return;
      if (!unique.has(symbol)) {
        unique.set(symbol, {
          symbol,
          address,
          decimals: Number(pair?.DECIMALS_PAIR || 18)
        });
      }
    });

    return Array.from(unique.values());
  }

  _resolveRate(symbol, rates = {}) {
    const upper = String(symbol || '').toUpperCase();
    if (!upper) return null;

    if (['USDT', 'USDC', 'BUSD'].includes(upper)) return 1;

    if (rates[upper] != null) return Number(rates[upper]);

    // Handle wrapped tokens (WETH -> ETH, WBNB -> BNB, WMATIC -> MATIC, POL -> MATIC)
    const stripWrapped = upper.startsWith('W') ? upper.slice(1) : null;
    if (stripWrapped && rates[stripWrapped] != null) {
      return Number(rates[stripWrapped]);
    }

    if (upper === 'POL' && rates.MATIC != null) return Number(rates.MATIC);

    return null;
  }

  /**
   * Get USDT contract address dari config
   */
  _getUSDTAddress(chainKey) {
    const chainConfig = this.config?.CHAINS?.[chainKey.toLowerCase()];

    // Cari di PAIR_DEXS dengan key 'USDT'
    if (chainConfig?.PAIR_DEXS?.USDT) {
      const usdtPair = chainConfig.PAIR_DEXS.USDT;
      // Gunakan SC_ADDRESS_PAIR atau USDT_ADDRESS
      return usdtPair.SC_ADDRESS_PAIR || usdtPair.USDT_ADDRESS;
    }

    throw new Error(`USDT address not found for chain: ${chainKey}`);
  }

  /**
   * Get native balance (ETH, BNB, MATIC, etc)
   */
  async getNativeBalance(chainKey, address) {
    try {
      const web3 = this._getWeb3Instance(chainKey);
      const balanceWei = await web3.eth.getBalance(address);
      return parseFloat(web3.utils.fromWei(balanceWei, 'ether'));
    } catch (error) {
      console.error(`Failed to get native balance for ${address} on ${chainKey}:`, error);
      throw new Error(`Failed to get native balance: ${error.message}`);
    }
  }

  /**
   * Get ERC20 token balance
   */
  async getTokenBalance(chainKey, tokenAddress, address) {
    try {
      const web3 = this._getWeb3Instance(chainKey);

      const tokenAbi = [
        {
          constant: true,
          inputs: [{ name: '_owner', type: 'address' }],
          name: 'balanceOf',
          outputs: [{ name: 'balance', type: 'uint256' }],
          type: 'function'
        },
        {
          constant: true,
          inputs: [],
          name: 'decimals',
          outputs: [{ name: '', type: 'uint8' }],
          type: 'function'
        }
      ];

      const contract = new web3.eth.Contract(tokenAbi, tokenAddress);
      const [balance, decimals] = await Promise.all([
        contract.methods.balanceOf(address).call(),
        contract.methods.decimals().call()
      ]);

      return parseFloat(balance) / Math.pow(10, parseInt(decimals));
    } catch (error) {
      console.error(`Failed to get token balance for ${tokenAddress} on ${chainKey}:`, error);
      throw new Error(`Failed to get token balance: ${error.message}`);
    }
  }

  /**
   * Get decimals for ERC20 token
   *
   * Mengambil nilai desimal (precision) dari smart contract ERC20 token.
   * Digunakan untuk konversi nilai token dari Wei/smallest unit ke unit normal.
   *
   * MODUL YANG DIGUNAKAN:
   * - Web3.js Library (v1.10.0) - untuk interaksi dengan blockchain via RPC
   *   • Loaded dari CDN: https://cdn.jsdelivr.net/npm/web3@1.10.0/dist/web3.min.js
   *   • Instance management: _getWeb3Instance() (cached per chain)
   * - No HTTP module needed - Web3.js handles RPC internally via HttpProvider
   *
   * CARA KERJA:
   * 1. Ambil Web3 instance untuk chain (BSC, ETH, Polygon, dll)
   * 2. Buat contract instance dengan minimal ABI (hanya method decimals)
   * 3. Call method decimals() dari smart contract via RPC
   * 4. Return integer value (biasanya 6, 8, atau 18)
   *
   * CONTOH PENGGUNAAN:
   * ```javascript
   * // Di sync-tab.js saat sinkronisasi token dari CEX
   * const decimals = await this.$root.web3Service.getDecimals('bsc', '0x...');
   * // Return: 18 (untuk USDT BSC)
   *
   * // Fallback jika gagal
   * try {
   *   record.des_token = await web3Service.getDecimals(chain, contractAddress);
   * } catch (error) {
   *   record.des_token = 18; // Default untuk ERC20 standard
   * }
   * ```
   *
   * @param {string} chainKey - Chain ID (lowercase: 'bsc', 'eth', 'polygon', 'arbitrum')
   * @param {string} tokenAddress - Token contract address (format: 0x...)
   * @returns {Promise<number>} - Token decimals (integer: 6, 8, 18, etc.)
   * @throws {Error} - Jika RPC call gagal atau contract invalid
   */
  async getDecimals(chainKey, tokenAddress) {
    try {
      // Get cached Web3 instance untuk chain ini
      const web3 = this._getWeb3Instance(chainKey);

      // Minimal ABI - hanya butuh function decimals()
      const tokenAbi = [
        {
          constant: true,
          inputs: [],
          name: 'decimals',
          outputs: [{ name: '', type: 'uint8' }],
          type: 'function'
        }
      ];

      // Buat contract instance
      const contract = new web3.eth.Contract(tokenAbi, tokenAddress);

      // Call method decimals() via RPC (read-only, no gas)
      const decimals = await contract.methods.decimals().call();

      // Convert to integer (uint8 from blockchain)
      return parseInt(decimals);
    } catch (error) {
      console.error(`Failed to get decimals for ${tokenAddress} on ${chainKey}:`, error);
      throw new Error(`Failed to get decimals: ${error.message}`);
    }
  }

  /**
   * Get balances (USDT + Gas) - Compatible dengan Portfolio
   *
   * @param {Object} options
   * @param {string} options.chain - Chain ID (lowercase)
   * @param {string} options.address - Wallet address
   * @param {Object} options.rates - Token rates { BTC: 50000, ETH: 3000, BNB: 300, ... }
   * @returns {Object} { chain, address, assetAmount, assetValue, gasAmount, gasValue, total, ... }
   */
  async getBalances(options) {
    const { chain, address, rates = {} } = options;

    if (!chain) throw new Error('getBalances: "chain" is required');
    if (!address) throw new Error('getBalances: "address" is required');

    const chainKey = chain.toLowerCase();

    // Get native symbol (BNB, ETH, MATIC, etc)
    const gasSymbol = this._getNativeSymbol(chainKey);

    const trackedTokens = this._getTrackedTokens(chainKey)
      .filter(token => token && token.symbol)
      .filter(token => !this._isNativeLikeAddress(token.address));

    const tokenBalancesPromise = Promise.all(trackedTokens.map(async (token) => {
      try {
        return await this.getTokenBalance(chainKey, token.address, address);
      } catch (error) {
        //console.warn(`⚠️ Failed to fetch ${token.symbol} balance on ${chainKey}:`, error.message || error);
        return 0;
      }
    }));

    const nativeBalancePromise = this.getNativeBalance(chainKey, address).catch((error) => {
      //console.warn(`⚠️ Failed to fetch native balance for ${chainKey}:`, error.message || error);
      return 0;
    });

    const [tokenBalances, gasAmount] = await Promise.all([tokenBalancesPromise, nativeBalancePromise]);

    const rawAssets = [];
    let assetValue = 0;

    trackedTokens.forEach((token, index) => {
      const amount = Number(tokenBalances[index] || 0);
      if (!amount) return;
      const rate = this._resolveRate(token.symbol, rates) || 0;
      const value = amount * rate;
      assetValue += value;
      rawAssets.push({
        symbol: token.symbol,
        amount,
        value,
        rate,
        address: token.address
      });
    });

    // Ensure at least one stablecoin entry is present if none tracked but config has USDT
    if (!rawAssets.length) {
      try {
        const usdtAddress = this._getUSDTAddress(chainKey);
        if (usdtAddress && !this._isNativeLikeAddress(usdtAddress)) {
          const usdtAmount = await this.getTokenBalance(chainKey, usdtAddress, address);
          if (usdtAmount) {
            const usdtValue = usdtAmount * 1;
            assetValue += usdtValue;
            rawAssets.push({
              symbol: 'USDT',
              amount: usdtAmount,
              value: usdtValue,
              rate: 1,
              address: usdtAddress
            });
          }
        }
      } catch (err) {
        //console.warn('⚠️ Failed to fetch fallback USDT balance:', err.message || err);
      }
    }

    const gasRate = this._resolveRate(gasSymbol, rates) || 0;
    const gasValue = Number(gasAmount || 0) * gasRate;
    const total = assetValue + gasValue;

    return {
      chain: chainKey,
      address,
      tokenSymbol: rawAssets[0]?.symbol || 'USDT',
      tokenAddress: rawAssets[0]?.address || null,
      assetAmount: assetValue,
      assetValue,
      assetRate: null,
      gasAmount,
      gasValue,
      gasRate,
      gasSymbol,
      total,
      raw_assets: rawAssets,
      fetchedAt: new Date().toISOString()
    };
  }
}

// Export untuk digunakan di window global
if (typeof window !== 'undefined') {
  window.Web3Service = Web3Service;
}
