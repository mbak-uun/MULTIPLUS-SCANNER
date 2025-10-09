/**
 * ===================================================================================
 * PNL (Profit & Loss) Calculator Service
 * ===================================================================================
 *
 * Tanggung Jawab:
 * - Menghitung profit/loss untuk arah CEX → DEX
 * - Menghitung profit/loss untuk arah DEX → CEX
 * - Memperhitungkan semua biaya (trading fee, withdrawal fee, gas fee)
 * - Menghitung persentase PNL dan nilai dalam USD/IDR
 */
class PnlCalculator {
    constructor(config) {
        this.config = config;
    }

    /**
     * Kalkulasi PNL untuk kedua arah (CEX→DEX dan DEX→CEX)
     * @param {object} params - Parameter kalkulasi
     * @returns {object} - { cexToDex: {...}, dexToCex: {...} }
     */
    calculateBothDirections(params) {
        const {
            token,              // Data token dari DB
            cexPrices,          // { token: { bestBid, bestAsk }, pair: {...} }
            dexQuote,           // { amountOut, gasFee } dari DEX
            direction,          // 'CEXtoDEX' atau 'DEXtoCEX'
            modalUsd,           // Modal dalam USD
            gasData,            // Data gas real-time
            usdtRate            // Rate USDT/IDR
        } = params;

        if (direction === 'CEXtoDEX') {
            return this._calculateCexToDex(params);
        } else {
            return this._calculateDexToCex(params);
        }
    }

    /**
     * Kalkulasi PNL untuk arah CEX → DEX
     * Flow: Beli Token di CEX -> Withdraw -> Swap di DEX -> Jual Pair di CEX
     *
     * @private
     */
    _calculateCexToDex(params) {
        const {
            token,
            cexPrices,
            dexQuote,
            modalUsd,
            gasData,
            usdtRate
        } = params;

        const chainKey = token.chain.toLowerCase();
        const cexKey = token.cex_name.toLowerCase();
        const tradingFeeRate = this._getCexTradingFee(cexKey);

        // Step 1: Beli token di CEX dengan modal USD
        const buyPriceCex = cexPrices.token?.bestAsk || 0; // Harga jual CEX (kita beli)
        if (buyPriceCex === 0) {
            return this._createEmptyResult('CEXtoDEX', 'No CEX price');
        }
        const tokenAmountBought = modalUsd / buyPriceCex;
        const tradingFeeBuyUsd = modalUsd * tradingFeeRate;

        // Step 2: Biaya withdrawal CEX
        const withdrawalFeeInToken = this._getCexWithdrawalFee(cexKey, token.nama_token, token, 'token');
        const withdrawalFeeUsd = withdrawalFeeInToken * buyPriceCex;

        // Jumlah token yang sampai ke wallet setelah withdrawal
        const tokenAmountAfterWithdrawal = Math.max(tokenAmountBought - withdrawalFeeInToken, 0);
        if (tokenAmountAfterWithdrawal <= 0) {
            return this._createEmptyResult('CEXtoDEX', 'Token amount after withdrawal is zero');
        }

        // Step 3: Swap di DEX (token -> pair)
        const pairReceived = dexQuote?.amountOut || 0;
        if (pairReceived === 0) {
            return this._createEmptyResult('CEXtoDEX', 'No DEX quote');
        }

        // Step 4: Biaya gas untuk swap di DEX
        const gasFeeUsd = this._calculateGasFeeUsd(gasData, chainKey, dexQuote.gasFee);

        // Step 5: Jual pair di CEX untuk mendapatkan USD kembali
        // Jika pair-nya USDT, harga jualnya 1. Jika bukan, ambil harga bid dari CEX.
        const sellPriceForPair = (token.nama_pair.toUpperCase() === 'USDT') ? 1 : (cexPrices.pair?.bestBid || 0);
        if (sellPriceForPair === 0) {
            return this._createEmptyResult('CEXtoDEX', 'No CEX pair price to sell');
        }
        const grossUsdFromSell = pairReceived * sellPriceForPair;

        // Step 6: Biaya trading CEX untuk menjual pair
        const tradingFeeSellUsd = grossUsdFromSell * tradingFeeRate;

        // --- Kalkulasi Final ---
        const finalUsdReceived = grossUsdFromSell - tradingFeeSellUsd;
        const totalCostUsd = tradingFeeBuyUsd + withdrawalFeeUsd + gasFeeUsd;

        // PNL Netto
        const pnlNettoUsd = finalUsdReceived - modalUsd - totalCostUsd;
        const pnlPercent = modalUsd > 0 ? (pnlNettoUsd / modalUsd) * 100 : 0;

        return {
            direction: 'CEXtoDEX',
            modal: modalUsd,
            result: finalUsdReceived,
            pnl: pnlNettoUsd,
            pnlPercent: pnlPercent,
            costs: {
                tradingCex1: tradingFeeBuyUsd,
                withdrawal: withdrawalFeeUsd,
                gasDex: gasFeeUsd,
                tradingCex2: tradingFeeSellUsd,
                total: totalCostUsd + tradingFeeSellUsd
            },
            details: {
                buyPrice: buyPriceCex,
                tokenAmount: tokenAmountBought,
                tokenAfterWithdrawal: tokenAmountAfterWithdrawal,
                pairReceived,
                sellPrice: sellPriceForPair
            },
            timestamp: Date.now()
        };
    }

    /**
     * Kalkulasi PNL untuk arah DEX → CEX
     * Flow: Beli Pair di CEX -> Withdraw -> Swap di DEX -> Jual Token di CEX
     *
     * @private
     */
    _calculateDexToCex(params) {
        const {
            token,
            cexPrices,
            dexQuote,
            modalUsd,
            gasData
        } = params;

        const chainKey = token.chain.toLowerCase();
        const cexKey = token.cex_name.toLowerCase();
        const tradingFeeRate = this._getCexTradingFee(cexKey);

        // Step 1: Beli pair di CEX dengan modal USD
        // Jika pair-nya USDT, harga belinya 1. Jika bukan, ambil harga ask dari CEX.
        const buyPriceForPair = (token.nama_pair.toUpperCase() === 'USDT') ? 1 : (cexPrices.pair?.bestAsk || 0);
        if (buyPriceForPair === 0) {
            return this._createEmptyResult('DEXtoCEX', 'No CEX pair price to buy');
        }
        const pairAmountBought = modalUsd / buyPriceForPair;
        const tradingFeeBuyUsd = modalUsd * tradingFeeRate;

        // Step 2: Biaya withdrawal pair dari CEX
        const withdrawalFeeInPair = this._getCexWithdrawalFee(cexKey, token.nama_pair, token, 'pair');
        const withdrawalFeeUsd = withdrawalFeeInPair * buyPriceForPair;

        // Jumlah pair yang sampai ke wallet
        const pairAmountAfterWithdrawal = Math.max(pairAmountBought - withdrawalFeeInPair, 0);
        if (pairAmountAfterWithdrawal <= 0) {
            return this._createEmptyResult('DEXtoCEX', 'Pair amount after withdrawal is zero');
        }

        // Step 3: Swap di DEX (pair -> token)
        const tokenReceived = dexQuote?.amountOut || 0;
        if (tokenReceived === 0) {
            return this._createEmptyResult('DEXtoCEX', 'No DEX quote');
        }

        // Step 4: Biaya gas untuk swap di DEX
        const gasFeeUsd = this._calculateGasFeeUsd(gasData, chainKey, dexQuote.gasFee);

        // Step 5: Jual token di CEX untuk mendapatkan USD kembali
        const sellPriceForToken = cexPrices.token?.bestBid || 0; // Harga beli CEX (kita jual)
        if (sellPriceForToken === 0) {
            return this._createEmptyResult('DEXtoCEX', 'No CEX price');
        }
        const grossUsdFromSell = tokenReceived * sellPriceForToken;

        // Step 6: Biaya trading CEX untuk menjual token
        const tradingFeeSellUsd = grossUsdFromSell * tradingFeeRate;

        // --- Kalkulasi Final ---
        const finalUsdReceived = grossUsdFromSell - tradingFeeSellUsd;
        const totalCostUsd = tradingFeeBuyUsd + withdrawalFeeUsd + gasFeeUsd;

        // PNL Netto
        const pnlNettoUsd = finalUsdReceived - modalUsd - totalCostUsd;
        const pnlPercent = modalUsd > 0 ? (pnlNettoUsd / modalUsd) * 100 : 0;

        return {
            direction: 'DEXtoCEX',
            modal: modalUsd,
            result: finalUsdReceived,
            pnl: pnlNettoUsd,
            pnlPercent: pnlPercent,
            costs: {
                tradingCex1: tradingFeeBuyUsd,
                withdrawal: withdrawalFeeUsd,
                gasDex: gasFeeUsd,
                tradingCex2: tradingFeeSellUsd,
                total: totalCostUsd + tradingFeeSellUsd
            },
            details: {
                buyPriceForPair,
                pairAmount: pairAmountBought,
                pairAfterWithdrawal: pairAmountAfterWithdrawal,
                tokenReceived,
                sellPrice: sellPriceForToken
            },
            timestamp: Date.now()
        };
    }

    /**
     * Mendapatkan trading fee rate untuk CEX tertentu
     * @private
     */
    _getCexTradingFee(cexKey) {
        // REVISI: Ambil fee trading dari config jika tersedia
        const cexConfig = this.config?.CEX?.[cexKey.toUpperCase()];
        if (cexConfig && cexConfig.FEE_TRADING !== undefined && cexConfig.FEE_TRADING !== null) {
            return parseFloat(cexConfig.FEE_TRADING);
        }

        // Fallback ke estimasi umum jika data tidak ada di config
        const fees = {
            binance: 0.001,      // 0.1%
            gate: 0.002,         // 0.2%
            gateio: 0.002,       // 0.2%
            tokocrypto: 0.001,   // 0.1%
            indodax: 0.003       // 0.3%
        };

        return fees[cexKey.toLowerCase()] || 0.001; // Default 0.1%
    }

    /**
     * Mendapatkan withdrawal fee untuk token tertentu di CEX
     * @private
     */
    _getCexWithdrawalFee(cexKey, tokenSymbol, token = null, assetType = 'token') {
        const symbolUpper = (tokenSymbol || '').toUpperCase();

        // Prioritas 1: nilai spesifik di record token
        if (token) {
            if (assetType !== 'pair' && token.cex_fee_wd !== undefined && token.cex_fee_wd !== null) {
                return parseFloat(token.cex_fee_wd);
            }
            if (assetType === 'pair' && token.cex_pair_fee_wd !== undefined && token.cex_pair_fee_wd !== null) {
                return parseFloat(token.cex_pair_fee_wd);
            }
        }

        // Prioritas 2: konfigurasi CEX di config_app (jika tersedia)
        const cexConfig = this.config?.CEX?.[cexKey.toUpperCase()];
        const mappedFees = cexConfig?.WITHDRAW_FEES;
        if (mappedFees && mappedFees[symbolUpper] !== undefined) {
            return parseFloat(mappedFees[symbolUpper]);
        }

        // Fallback umum jika tidak ada data
        const commonFees = {
            'USDT': 1,
            'USDC': 1,
            'ETH': 0.001,
            'BNB': 0.0005,
            'MATIC': 0.1
        };

        if (commonFees[symbolUpper] !== undefined) {
            return commonFees[symbolUpper];
        }

        // Default kecil untuk menghindari 0 total biaya
        return 0.5;
    }

    /**
     * Wrapper publik untuk mengambil fee trading
     */
    getTradingFeeRate(cexKey) {
        return this._getCexTradingFee(cexKey);
    }

    /**
     * Wrapper publik untuk mengambil fee withdrawal
     */
    getWithdrawalFee({ cexKey, symbol, token, assetType = 'token' }) {
        return this._getCexWithdrawalFee(cexKey, symbol, token, assetType);
    }

    /**
     * Kalkulasi biaya gas dalam USD
     * @private
     */
    _calculateGasFeeUsd(gasData, chainKey, gasFeeFromDex = null) {
        // Prioritas 1: Gunakan gas fee dari quote DEX jika ada (lebih akurat)
        if (gasFeeFromDex && typeof gasFeeFromDex === 'number' && gasFeeFromDex > 0) {
            return gasFeeFromDex;
        }

        // Prioritas 2: Fallback ke perhitungan manual jika quote tidak menyediakan
        const chainGas = gasData[chainKey];
        if (!chainGas) return 1; // Default 1 USD jika tidak ada data

        const { gwei, price, gasLimit } = chainGas;

        // Gas fee = gasLimit * gwei * price / 1e9
        const gasFeeUsd = (gasLimit * gwei * price) / 1e9; // 1 Gwei = 10^9 Wei

        return gasFeeUsd;
    }

    /**
     * Membuat hasil kosong saat data tidak tersedia
     * @private
     */
    _createEmptyResult(direction, reason) {
        return {
            direction,
            modal: 0,
            result: 0,
            pnl: 0,
            pnlPercent: 0,
            costs: {
                tradingCex1: 0,
                withdrawal: 0,
                gasDex: 0,
                tradingCex2: 0,
                total: 0
            },
            details: {},
            error: reason,
            timestamp: Date.now()
        };
    }

    /**
     * Format hasil PNL ke dalam format yang mudah dibaca
     */
    formatPnlResult(pnlResult, usdtRate = 15800) {
        const pnlIdr = pnlResult.pnl * usdtRate;

        return {
            ...pnlResult,
            pnlIdr,
            formatted: {
                modal: `$${pnlResult.modal.toFixed(2)}`,
                result: `$${pnlResult.result.toFixed(2)}`,
                pnl: `$${pnlResult.pnl.toFixed(2)}`,
                pnlIdr: `Rp ${pnlIdr.toLocaleString('id-ID')}`,
                pnlPercent: `${pnlResult.pnlPercent > 0 ? '+' : ''}${pnlResult.pnlPercent.toFixed(2)}%`,
                totalCost: `$${pnlResult.costs.total.toFixed(2)}`
            }
        };
    }
}

// Export untuk digunakan di window global
if (typeof window !== 'undefined') {
    window.PnlCalculator = PnlCalculator;
}
