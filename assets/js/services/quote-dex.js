/**
 * ===================================================================================
 * DEX Data Fetcher Module
 * ===================================================================================
 *
 * Tanggung Jawab:
 * - Berinteraksi dengan API aggregator DEX (seperti 1inch, Odos, KyberSwap).
 * - Mengambil quote harga (jumlah token output) untuk sebuah swap.
 * - Mengelola rate-limiting saat berkomunikasi dengan API DEX.
 * - Mengadaptasi logika dari `app-lama/services/dex.js`.
 */
class DexDataFetcher {
    constructor(config, httpModule, globalSettings) {
        this.config = config;
        this.Http = httpModule;
        this.globalSettings = globalSettings || {}; // Diperlukan untuk wallet address
        this.delayPerCall = 300; // Jeda antar panggilan API ke aggregator yang sama

        // Adaptasi dari app-lama/services/dex.js
        this.dexStrategies = {
            kyber: {
                buildRequest: ({ chainName, fromToken, toToken, amountInBig }) => {
                    const url = `https://aggregator-api.kyberswap.com/${chainName.toLowerCase()}/api/v1/routes?tokenIn=${fromToken.address}&tokenOut=${toToken.address}&amountIn=${amountInBig}&gasInclude=true`;
                    return { url, method: 'GET' };
                },
                parseResponse: (response, { toToken }) => {
                    const summary = response?.data?.routeSummary;
                    if (!summary) throw new Error("Invalid KyberSwap response");
                    return {
                        amountOut: parseFloat(summary.amountOut) / Math.pow(10, toToken.decimals),
                        gasFee: parseFloat(summary.gasPriceGwei) || null, // Ambil gas price dalam Gwei
                        rawResponse: response
                    };
                }
            },
            '1inch': {
                buildRequest: ({ chainCode, fromToken, toToken, amountInBig, apiKey }) => {
                    const url = `https://api.1inch.dev/swap/v6.0/${chainCode}/quote`;
                    const params = new URLSearchParams({
                        src: fromToken.address,
                        dst: toToken.address,
                        amount: amountInBig.toString(),
                        includeGas: 'true'
                    });
                    if (!apiKey) throw new Error("1inch API Key is missing in config");
                    return { url: `${url}?${params.toString()}`, method: 'GET', headers: { 'Authorization': `Bearer ${apiKey}` } };
                },
                parseResponse: (response, { toToken }) => {
                    if (!response?.dstAmount) throw new Error("Invalid 1inch response");
                    return {
                        amountOut: parseFloat(response.dstAmount) / Math.pow(10, toToken.decimals),
                        gasFee: response.gas, // 1inch mengembalikan gas limit, bukan Gwei. Kita tampilkan sebagai referensi.
                        rawResponse: response
                    };
                }
            },
            odos: {
                // ADOPSI APLIKASI LAMA: Gunakan Odos API v3 dengan struktur yang sama
                buildRequest: ({ chainCode, fromToken, toToken, amountInBig, walletAddress }) => {
                    const url = "https://api.odos.xyz/sor/quote/v3";
                    return {
                        url,
                        method: 'POST',
                        data: {
                            chainId: chainCode,
                            compact: true,
                            disableRFQs: true,
                            userAddr: walletAddress,
                            inputTokens: [{
                                amount: amountInBig.toString(),
                                tokenAddress: fromToken.address
                            }],
                            outputTokens: [{
                                proportion: 1,
                                tokenAddress: toToken.address
                            }],
                            slippageLimitPercent: 0.3  // 0.3% slippage sesuai app lama
                        }
                    };
                },
                parseResponse: (response, { toToken }) => {
                    // PERBAIKAN CRITICAL: outAmounts adalah STRING, bukan array!
                    // Struktur Odos v3 response:
                    // {
                    //   "outAmounts": "123456789",        // STRING, bukan array!
                    //   "gasEstimateValue": 0.5,          // Fee dalam USD
                    //   "netOutValue": 100.5,
                    //   "pathId": "..."
                    // }
                    if (!response?.outAmounts) throw new Error("Invalid Odos response structure");

                    // Parse outAmounts sebagai STRING langsung (sesuai app lama)
                    const amountOut = parseFloat(response.outAmounts) / Math.pow(10, toToken.decimals);

                    // gasEstimateValue adalah estimasi fee dalam USD (bukan wei/gwei)
                    const gasFee = parseFloat(response.gasEstimateValue) || null;

                    return {
                        amountOut,
                        gasFee,  // Fee sudah dalam USD
                        rawResponse: response
                    };
                }
            },
            '0x': {
                // REVISI: Menggunakan endpoint Matcha API sesuai contoh.
                buildRequest: ({ chainCode, fromToken, toToken, amountInBig }) => {
                    const url = `https://matcha.xyz/api/swap/price`;
                    const params = new URLSearchParams({
                        chainId: chainCode,
                        buyToken: toToken.address,
                        sellToken: fromToken.address,
                        sellAmount: amountInBig.toString()
                    });
                    return { url: `${url}?${params.toString()}`, method: 'GET' };
                },
                parseResponse: (response, { toToken }) => {
                    // REVISI: Menggunakan `buyAmount` dari respons Matcha.
                    if (!response?.buyAmount) throw new Error("Invalid 0x/Matcha response");
                    const gasPriceGwei = response.gasPrice ? parseFloat(response.gasPrice) / 1e9 : null;
                    return {
                        amountOut: parseFloat(response.buyAmount) / Math.pow(10, toToken.decimals),
                        gasFee: gasPriceGwei ? gasPriceGwei.toFixed(2) : null, // Tampilkan gas price dalam Gwei
                        rawResponse: response
                    };
                }
            },
            // TAMBAHKAN STRATEGI UNTUK OKX DEX
            okxdex: {
                // REVISI: Menggunakan implementasi dari app lama yang terbukti berfungsi
                buildRequest: ({ chainCode, fromToken, toToken, amountInBig, apiKeys }) => {
                    if (!apiKeys || apiKeys.length === 0) throw new Error("OKX DEX API keys are missing in config");
                    
                    // Helper untuk mendapatkan API key acak dari config
                    const getRandomApiKey = (keys) => keys[Math.floor(Math.random() * keys.length)];
                    const selectedApiKey = getRandomApiKey(apiKeys);
 
                    const timestamp = new Date().toISOString();
                    const method = 'GET';
                    const path = "/api/v5/dex/aggregator/quote";
                    // REVISI: Kembali menggunakan `chainIndex` dan `codeChain` sesuai app lama
                    const queryParams = `fromTokenAddress=${fromToken.address}&toTokenAddress=${toToken.address}&amount=${amountInBig.toString()}&chainIndex=${chainCode}`;
                    
                    // Data untuk signature
                    const dataToSign = timestamp + method + path + '?' + queryParams;

                    // Helper untuk signature (membutuhkan crypto-js)
                    const signature = CryptoJS.HmacSHA256(dataToSign, selectedApiKey.SECRET_KEY_OKX).toString(CryptoJS.enc.Base64);

                    return {
                        url: `https://www.okx.com${path}?${queryParams}`,
                        method: method,
                        headers: { "OK-ACCESS-KEY": selectedApiKey.API_KEY_OKX, "OK-ACCESS-SIGN": signature, "OK-ACCESS-PASSPHRASE": selectedApiKey.PASSPHRASE_OKX, "OK-ACCESS-TIMESTAMP": timestamp, "Content-Type": "application/json" }
                    };
                },
                parseResponse: (response, { toToken }) => {
                    const data = response?.data?.[0];
                    if (!data?.toTokenAmount) throw new Error("Invalid OKX DEX response structure");
                    return {
                        amountOut: parseFloat(data.toTokenAmount) / Math.pow(10, toToken.decimals),
                        gasFee: parseFloat(data.estimatedGasFee) || null, // Ambil estimasi gas fee
                        rawResponse: response
                    };
                }
            },
            // Implementasi khusus DZAP (menggunakan sumber 1inch via LiFi)
            dzap: {
                buildRequest: ({ chainCode, fromToken, toToken, amountInBig, walletAddress }) => {
                    const url = "https://api.dzap.io/v1/quotes";
                    const slippage = 0.5; // persen
                    const body = {
                        fromChain: chainCode,
                        integratorId: 'dzap',
                        data: [{
                            amount: amountInBig.toString(),
                            srcToken: fromToken.address,
                            srcDecimals: Number(fromToken.decimals) || 0,
                            destToken: toToken.address,
                            destDecimals: Number(toToken.decimals) || 0,
                            slippage,
                            toChain: chainCode
                        }]
                    };
                    if (walletAddress) {
                        body.account = walletAddress;
                    }
                    return { url, method: 'POST', data: body };
                },
                parseResponse: (response, { toToken }) => {
                    const firstKey = response ? Object.keys(response)[0] : null;
                    const payload = firstKey ? response[firstKey] : null;
                    const quoteRates = payload?.quoteRates || {};
                    const preferredKey = payload?.recommendedSource || payload?.bestReturnSource || Object.keys(quoteRates)[0];
                    const quote = preferredKey ? quoteRates[preferredKey] : null;
                    if (!quote) {
                        throw new Error('Invalid DZAP response: quote source not available');
                    }

                    const destDecimals = Number(quote.destToken?.decimals ?? toToken.decimals ?? 0);
                    const rawAmount = quote.toAmount ?? quote.destAmount ?? '0';
                    const amountOut = parseFloat(rawAmount) / Math.pow(10, destDecimals);
                    const gasFeeUsd = quote.fee?.gasFee?.[0]?.amountUSD;

                    return {
                        amountOut,
                        gasFee: gasFeeUsd ? parseFloat(gasFeeUsd) : null
                    };
                }
            },
            // Implementasi khusus SWOOP (Railway proxy)
            swoop: {
                buildRequest: ({ chainCode, fromToken, toToken, amountInBig, walletAddress, dexConfig, globalSettings }) => {
                    const aggregatorSlug = (globalSettings && globalSettings.swoopAggregator)
                        || (dexConfig && dexConfig.DEFAULT_AGGREGATOR)
                        || 'odos';
                    const payload = {
                        chainId: chainCode,
                        aggregatorSlug,
                        sender: walletAddress || '0x0000000000000000000000000000000000000000',
                        inToken: {
                            chainId: chainCode,
                            type: 'TOKEN',
                            address: (fromToken.address || '').toLowerCase(),
                            decimals: Number(fromToken.decimals) || 0
                        },
                        outToken: {
                            chainId: chainCode,
                            type: 'TOKEN',
                            address: (toToken.address || '').toLowerCase(),
                            decimals: Number(toToken.decimals) || 0
                        },
                        amountInWei: amountInBig.toString(),
                        slippageBps: '50',
                        gasPriceGwei: 0
                    };
                    return {
                        url: 'https://bzvwrjfhuefn.up.railway.app/swap',
                        method: 'POST',
                        data: payload
                    };
                },
                parseResponse: (response, { toToken }) => {
                    const rawOutWei = response?.amountOutWei;
                    if (!rawOutWei) {
                        throw new Error('Invalid SWOOP response: amountOutWei missing');
                    }
                    const amountOut = parseFloat(rawOutWei) / Math.pow(10, Number(toToken.decimals) || 0);
                    const feeWei = response?.feeWei;
                    const gasFee = feeWei ? parseFloat(feeWei) / 1e18 : null;
                    return {
                        amountOut,
                        gasFee
                    };
                }
            },
            // Adaptasi dari app-lama untuk flytrade
            fly: {
                buildRequest: ({ chainName, fromToken, toToken, amountInBig, walletAddress }) => {
                    const url = `https://api.fly.trade/aggregator/quote?network=${chainName.toLowerCase()}&fromTokenAddress=${fromToken.address}&toTokenAddress=${toToken.address}&fromAddress=${walletAddress}&toAddress=${walletAddress}&sellAmount=${amountInBig.toString()}&slippage=0.005&gasless=false`;
                    return { url, method: 'GET' };
                },
                parseResponse: (response, { toToken }) => {
                    const rawOut = response?.amountOut;
                    if (!rawOut) throw new Error('Invalid FlyTrade amountOut');
                    return {
                        amountOut: parseFloat(rawOut) / Math.pow(10, toToken.decimals),
                        gasFee: null, // API FlyTrade tidak menyediakan info gas di quote
                        rawResponse: response
                    };
                }
            },
            // Implementasi untuk Paraswap
            para: {
                buildRequest: ({ chainCode, fromToken, toToken, amountInBig, walletAddress }) => {
                    const url = `https://apiv5.paraswap.io/prices/`;
                    const params = new URLSearchParams({
                        srcToken: fromToken.address,
                        destToken: toToken.address,
                        amount: amountInBig.toString(),
                        srcDecimals: fromToken.decimals,
                        destDecimals: toToken.decimals,
                        side: 'SELL',
                        network: chainCode,
                        userAddress: walletAddress
                    });
                    return { url: `${url}?${params.toString()}`, method: 'GET' };
                },
                parseResponse: (response, { toToken }) => {
                    const route = response?.priceRoute;
                    if (!route?.destAmount) throw new Error("Invalid Paraswap response");
                    return {
                        amountOut: parseFloat(route.destAmount) / Math.pow(10, toToken.decimals),
                        gasFee: parseFloat(route.gasCostUSD) || null, // Paraswap memberikan estimasi fee dalam USD
                        rawResponse: response
                    };
                }
            }
        };
    }

    updateGlobalSettings(globalSettings = {}) {
        this.globalSettings = globalSettings || {};
    }

    _resolveDexDelay(dexKey) {
        if (!dexKey) return this.delayPerCall;
        const lower = String(dexKey).toLowerCase();
        const upper = String(dexKey).toUpperCase();

        const fromGlobal = this.globalSettings?.config_dex?.[lower]?.jeda;
        const fromConfig =
            this.config?.SCANNING_DELAYS?.JedaDexs?.[lower] ??
            this.config?.SCANNING_DELAYS?.JedaDexs?.[upper];

        const numeric = Number(fromGlobal ?? fromConfig);
        if (Number.isFinite(numeric) && numeric > 0) {
            return numeric;
        }
        return this.delayPerCall;
    }

    async _waitDexDelay(dexKey) {
        const delay = this._resolveDexDelay(dexKey);
        if (!delay) return;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Mendapatkan quote harga dari semua DEX yang relevan untuk sebuah token.
     * @param {object} token - Objek token dari database.
     * @param {object} activeDexConfig - Konfigurasi DEX yang aktif dari filter.
     * @param {object} inputAmounts - Jumlah aktual yang akan digunakan untuk swap.
     *                                { pairToToken: <jumlah pair>, tokenToPair: <jumlah token> }
     * @param {object} globalSettings - Pengaturan global untuk mendapatkan wallet address.
     * @param {function} onResultCallback - Callback saat satu DEX selesai diproses.
     * @returns {Promise<void>}
     */
    async getQuotes(token, activeDexConfig, inputAmounts, globalSettings, onResultCallback) {
        if (typeof onResultCallback !== 'function') return;

        if (globalSettings) {
            this.updateGlobalSettings(globalSettings);
        }

        const activeDexKeys = Object.keys(activeDexConfig).filter(key => activeDexConfig[key] === true);

        for (const dexKey of activeDexKeys) {
            // Cek apakah token ini mendukung DEX tersebut
            if (token.dex && token.dex[dexKey] && token.dex[dexKey].status) {
                const pairToTokenQuote = await this._fetchSingleQuote(dexKey, token, inputAmounts, 'CEXtoDEX', this.globalSettings);
                await this._waitDexDelay(dexKey);
                const tokenToPairQuote = await this._fetchSingleQuote(dexKey, token, inputAmounts, 'DEXtoCEX', this.globalSettings);

                // Panggil callback dengan hasil untuk DEX ini
                onResultCallback(dexKey, {
                    pairToToken: pairToTokenQuote,
                    tokenToPair: tokenToPairQuote
                });

                await this._waitDexDelay(dexKey);
            }
        }
    }

    /**
     * Mengambil satu quote untuk satu arah (CEXtoDEX atau DEXtoCEX).
     * @private
     */
    async _fetchSingleQuote(dexKey, token, inputAmounts, direction, globalSettings) {
        const dexConfig = this.config.DEXS[dexKey];
        if (!dexConfig) return null;

        const strategyKey = dexConfig.FETCH_DEX.PRIMARY[direction];
        const fallbackStrategyKey = dexConfig.FETCH_DEX.ALTERNATIVE.ENABLE ? dexConfig.FETCH_DEX.ALTERNATIVE[direction] : null;

        const strategy = this.dexStrategies[strategyKey];
        if (!strategy) {
            //console.warn(`[DexDataFetcher] Strategy '${strategyKey}' for ${dexKey} not found.`);
            return null;
        }

        // Menentukan token input dan output berdasarkan arah
        const tokenInfo = { address: token.sc_token, decimals: token.des_token };
        const pairInfo = { address: token.sc_pair, decimals: token.des_pair };

        const fromToken = direction === 'CEXtoDEX' ? pairInfo : tokenInfo;
        const toToken = direction === 'CEXtoDEX' ? tokenInfo : pairInfo;

        // Tentukan jumlah input aktual berdasarkan arah
        let amountIn = null;
        if (direction === 'CEXtoDEX') {
            amountIn = inputAmounts?.pairToToken ?? null;
        } else {
            amountIn = inputAmounts?.tokenToPair ?? null;
        }

        if (!amountIn || Number(amountIn) <= 0) {
            //console.warn(`[DexDataFetcher] Skip ${dexKey} ${direction}: invalid amount ${amountIn}`);
            return null;
        }

        const amountInBig = this._toBaseUnits(amountIn, fromToken.decimals);

        const params = {
            chainName: token.chain.toLowerCase(),
            chainCode: this.config.CHAINS[token.chain.toLowerCase()]?.KODE_CHAIN,
            fromToken,
            toToken,
            amountInBig,
            walletAddress: globalSettings?.walletMeta || '0x0000000000000000000000000000000000000000',
            apiKey: dexConfig.FETCH_DEX.API_KEY || null, // Ambil API Key dari config (untuk 1inch)
            apiKeys: dexConfig.DATA_API || null, // Ambil array API Keys dari config (untuk OKX)
            dexConfig,
            globalSettings
        };

        try {
            const requestDetails = strategy.buildRequest(params);
            let url = requestDetails.url;

            // Gunakan proxy jika ada di config
            if (dexConfig.PROXY) {
                url = `${dexConfig.PROXY}${url}`;
            }

            // TIMEOUT CONFIGURATION (prioritas tertinggi ke terendah):
            // 1. globalSettings.config_dex[dexKey].timeout (user setting per DEX)
            // 2. globalSettings.WaktuTunggu (user setting global)
            // 3. config.SCANNING_DELAYS.dexTimeout (config default)
            // 4. 10000ms (hardcoded fallback)
            const dexKeyLower = dexKey.toLowerCase();
            const timeout = globalSettings?.config_dex?.[dexKeyLower]?.timeout ??
                           globalSettings?.WaktuTunggu ??
                           this.config?.SCANNING_DELAYS?.dexTimeout ??
                           10000;

            const response = await this.Http.request({
                ...requestDetails,
                url,
                responseType: 'json',
                timeout // Tambahkan timeout
            });

            const parsed = strategy.parseResponse(response, params);
            if (parsed && typeof parsed === 'object') {
                return { ...parsed, rawResponse: response };
            }
            return { rawResponse: response };

        } catch (error) {
            const errorCode = error.status || error.code;
            const isRateLimited = errorCode === 429 || error.message?.includes('rate limit');
            const isTimeout = error.code === 'TIMEOUT' || error.message?.includes('timeout');

            // ADOPSI APLIKASI LAMA: Logging error detail
            console.warn(`[DexDataFetcher] Primary fetch for ${dexKey} (${strategyKey}) failed:`, {
                error: error.message,
                code: errorCode,
                isRateLimited,
                isTimeout
            });

            // ADOPSI APLIKASI LAMA: Coba fallback jika ada (terutama untuk rate limit 429)
            if (fallbackStrategyKey && (isRateLimited || isTimeout)) {
                /* console.log(`[DexDataFetcher] Trying fallback strategy '${fallbackStrategyKey}' for ${dexKey}...`); */
                const fallbackStrategy = this.dexStrategies[fallbackStrategyKey];
                if (fallbackStrategy) {
                    try {
                        const requestDetails = fallbackStrategy.buildRequest(params);
                        let url = requestDetails.url;
                        if (dexConfig.PROXY) {
                            url = `${dexConfig.PROXY}${url}`;
                        }

                        // Tambahkan timeout juga untuk fallback
                        // PRIORITAS: globalSettings.WaktuTunggu (user) > config.SCANNING_DELAYS.dexTimeout (default) > hardcoded
                        const timeout = globalSettings?.WaktuTunggu ??
                                       this.config?.SCANNING_DELAYS?.dexTimeout ??
                                       10000;

                        const response = await this.Http.request({
                            ...requestDetails,
                            url,
                            responseType: 'json',
                            timeout
                        });

                        const parsed = fallbackStrategy.parseResponse(response, params);
                        if (parsed && typeof parsed === 'object') {
                            /* console.log(`[DexDataFetcher] ✅ Fallback success for ${dexKey} using ${fallbackStrategyKey}`); */
                            return { ...parsed, rawResponse: response, usedFallback: true };
                        }
                        return { rawResponse: response };
                    } catch (fallbackError) {
                        console.error(`[DexDataFetcher] Fallback fetch for ${dexKey} (${fallbackStrategyKey}) also failed: ${fallbackError.message}`);
                        return null;
                    }
                }
            }
            return null;
        }
    }

    _toBaseUnits(amount, decimals) {
        const decimalsNum = Number(decimals) || 0;
        if (decimalsNum === 0) {
            return BigInt(Math.round(amount));
        }

        const fixed = amount.toFixed(decimalsNum);
        const normalized = fixed.replace('.', '');
        return BigInt(normalized);
    }
}

// Export untuk digunakan di window global
if (typeof window !== 'undefined') {
    window.DexDataFetcher = DexDataFetcher;
}
