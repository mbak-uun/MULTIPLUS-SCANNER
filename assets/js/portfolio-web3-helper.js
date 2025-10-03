// assets/js/portfolio-web3-helper.js
// Helper untuk fetch wallet balance menggunakan Web3.js
// Kompatibel dengan KONFIG_APLIKASI

class PortfolioWeb3Helper {
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

    // Get USDT contract address
    const usdtAddress = this._getUSDTAddress(chainKey);

    // Get native symbol (BNB, ETH, MATIC, etc)
    const gasSymbol = this._getNativeSymbol(chainKey);

    // Fetch balances in parallel
    const [assetAmount, gasAmount] = await Promise.all([
      this.getTokenBalance(chainKey, usdtAddress, address),
      this.getNativeBalance(chainKey, address)
    ]);

    // Calculate USD values
    const assetRate = 1; // USDT always 1
    const gasRate = rates[gasSymbol] || 0;

    const assetValue = assetAmount * assetRate;
    const gasValue = gasAmount * gasRate;
    const total = assetValue + gasValue;

    return {
      chain: chainKey,
      address,
      tokenSymbol: 'USDT',
      tokenAddress: usdtAddress,
      assetAmount,
      assetValue,
      assetRate,
      gasAmount,
      gasValue,
      gasRate,
      gasSymbol,
      total,
      raw_assets: [
        {
          symbol: 'USDT',
          amount: assetAmount,
          value: assetValue
        }
      ],
      fetchedAt: new Date().toISOString()
    };
  }
}

// Export untuk digunakan di Portfolio
if (typeof window !== 'undefined') {
  window.PortfolioWeb3Helper = PortfolioWeb3Helper;
}
