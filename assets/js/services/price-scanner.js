/**
 * ===================================================================================
 * Price Scanner Orchestrator - REFACTORED
 * ===================================================================================
 *
 * Tanggung Jawab:
 * - Mengorkestrasi seluruh proses scanning (CEX → DEX → PNL)
 * - Mengelola batching token (grup) untuk menghindari rate limit
 * - Menerapkan sistem jeda terstruktur (koin, grup, CEX, DEX)
 * - Mengirim notifikasi ke Telegram untuk sinyal profitable
 * - Memberikan callback progress untuk UI
 *
 * Alur Scanning dengan Jeda:
 * 1. Send Telegram status ONLINE
 * 2. Fetch data real-time (Gas Gwei & USDT/IDR rate)
 * 3. Loop per GRUP (batch):
 *    a. Loop per KOIN dalam grup (dengan jeda koin):
 *       - Fetch CEX prices (dengan jeda CEX)
 *       - Update UI untuk CEX data
 *       - Loop per DEX aktif (dengan jeda DEX):
 *         * Fetch DEX quote (dengan timeout)
 *         * Kalkulasi PNL
 *         * Update UI per DEX (tidak tunggu semua DEX selesai)
 *         * Send Telegram jika profitable
 *    b. Jeda GRUP sebelum ke grup berikutnya
 * 4. Send Telegram status OFFLINE
 *
 * Sistem Jeda:
 * - Jeda Koin: Delay antar koin dalam satu grup (500ms * posisi koin)
 * - Jeda Grup: Delay antar grup/batch (2000ms)
 * - Jeda CEX: Delay spesifik per CEX saat fetch orderbook
 * - Jeda DEX: Delay spesifik per DEX saat fetch quote
 * - Timeout: Batas waktu fetch CEX/DEX (10000ms)
 */
class PriceScanner {
    constructor(config, services, callbacks = {}) {
        this.config = config;

        // Services
        this.cexFetcher = services.cexFetcher;
        this.dexFetcher = services.dexFetcher;
        this.realtimeFetcher = services.realtimeFetcher;
        this.pnlCalculator = services.pnlCalculator;
        this.telegramService = services.telegramService;

        // Delay Manager untuk mengelola semua jenis jeda
        this.delayManager = new DelayManager(config, services.globalSettings || {});

        // Callbacks untuk UI
        this.callbacks = {
            onStart: callbacks.onStart || (() => {}),
            onProgress: callbacks.onProgress || (() => {}),
            onCexResult: callbacks.onCexResult || (() => {}), // REVISI: Callback untuk hasil CEX
            onPnlResult: callbacks.onPnlResult || (() => {}), // REVISI: Callback baru untuk hasil PNL per DEX
            onTokenComplete: callbacks.onTokenComplete || (() => {}),
            onBatchComplete: callbacks.onBatchComplete || (() => {}),
            onComplete: callbacks.onComplete || (() => {}),
            onError: callbacks.onError || (() => {})
        };

        // State
        this.isScanning = false;
        this.scanStats = {
            totalTokens: 0,
            processedTokens: 0,
            successCount: 0,
            errorCount: 0,
            profitableSignals: 0,
            startTime: null,
            endTime: null
        };

        // Settings
        this.settings = {
            tokensPerBatch: 3,          // Jumlah token per batch (grup)
            modalUsd: 100,              // Modal default dalam USD
            minPnl: 0.5,                // Minimum PNL (absolut) untuk notifikasi
            autoSendTelegram: true      // Auto send ke Telegram
        };
    }

    /**
     * Memulai proses scanning
     * @param {array} tokens - Daftar token yang akan di-scan
     * @param {object} filters - Filter aktif (chains, cex, dex, pairs)
     * @param {object} scanSettings - Override settings
     */
    async startScan(tokens, filters, scanSettings = {}) {
        if (this.isScanning) {
            // console.warn('[PriceScanner] Scan already in progress');
            return;
        }

        this.isScanning = true;
        this._resetStats();
        this.scanStats.totalTokens = tokens.length;
        this.scanStats.startTime = Date.now();
        this._logProgress('INISIASI', `Menyiapkan pemindaian untuk ${tokens.length} token.`);

        // Override settings jika ada
        Object.assign(this.settings, scanSettings);

        // Update DelayManager dengan globalSettings terbaru
        if (scanSettings.globalSettings) {
            this.delayManager.updateGlobalSettings(scanSettings.globalSettings);
        }

        // Log konfigurasi delay untuk debugging
        console.log('[PriceScanner] Delay Configuration:', this.delayManager.getCurrentConfig());

        try {
            // Callback: Start
            this.callbacks.onStart({
                totalTokens: tokens.length,
                settings: this.settings
            });

            // Step 1: Send Telegram ONLINE
            // REVISI: Ambil nickname dari globalSettings yang di-pass saat startScan
            const nickname = this.settings.globalSettings?.nickname || 'SCANNER';
            // Set username di service agar bisa digunakan untuk status lain (STOPPED, ERROR)
            this.telegramService.setUserName(nickname);
            await this.telegramService.sendStatus('ONLINE');
            this._logProgress('STATUS', `Status Telegram diatur ke ONLINE untuk ${nickname}.`);

            // Step 2: Fetch data real-time
            this._logProgress('REALTIME_FETCH', 'Mengambil data gas & kurs real-time.');

            // PENTING: Ambil chain dari token yang akan di-scan, bukan dari filter
            // Karena filter.chains mungkin berisi semua chain (true), tapi token yang akan di-scan hanya beberapa chain
            const uniqueChains = [...new Set(tokens.map(t => t.chain.toLowerCase()))];
            // console.log('[PriceScanner] Chains from tokens to scan:', uniqueChains);
            // console.log('[PriceScanner] Total tokens:', tokens.length);

            const realtimeData = await this.realtimeFetcher.getAllRealtimeData(uniqueChains);
            const { gasData, usdtRate } = realtimeData;
            this._logProgress('REALTIME_SELESAI', 'Data real-time berhasil diperoleh.', { chains: uniqueChains, usdtRate });

            // Step 3: Proses tokens dalam batch
            const batches = this._createBatches(tokens, this.settings.tokensPerBatch);
            this._logProgress('BATCH_INFO', `Total batch: ${batches.length}.`, { totalBatches: batches.length });

            let aborted = false;

            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                const batchNumber = i + 1;

                this._logProgress('BATCH_MULAI', `Memproses batch ${batchNumber} dari ${batches.length}.`, { batchNumber, totalBatches: batches.length });

                if (!this.isScanning) {
                    this._logProgress('BATCH_DIHENTIKAN', 'Proses dihentikan sebelum batch dijalankan.', { batchNumber }, 'warn');
                    aborted = true;
                    break;
                }

                // REFACTORED: Proses token dengan jeda koin yang terstruktur
                // Setiap koin dalam grup diberi jeda bertahap (stagger) agar tidak request bersamaan
                // Jeda diterapkan: antar koin, per CEX, per DEX
                const jobs = batch.map((token, tokenIndex) => (async () => {
                    if (!this.isScanning) {
                        return;
                    }

                    // Jeda Koin: Delay bertahap berdasarkan posisi koin dalam grup
                    // Koin ke-0: 0ms, ke-1: jedaKoin*1, ke-2: jedaKoin*2, dst
                    await this.delayManager.waitCoinDelay(tokenIndex);

                    if (!this.isScanning) {
                        return;
                    }

                    return this._processToken(token, filters, gasData, usdtRate);
                })());

                // Jalankan semua jobs paralel dan tunggu selesai
                // allSettled memastikan satu error tidak menghentikan yang lain
                await Promise.allSettled(jobs);

                // Callback: Batch complete
                this.callbacks.onBatchComplete({
                    batchNumber,
                    totalBatches: batches.length,
                    processed: this.scanStats.processedTokens,
                    total: this.scanStats.totalTokens
                });
                this._logProgress('BATCH_SELESAI', `Batch ${batchNumber} selesai.`, {
                    batchNumber,
                    processed: this.scanStats.processedTokens,
                    total: this.scanStats.totalTokens
                });

                // Jeda Grup: Delay sebelum memproses grup/batch berikutnya
                if (i < batches.length - 1) {
                    if (!this.isScanning) {
                        this._logProgress('BATCH_DIHENTIKAN', 'Proses dihentikan saat jeda antar grup.', { batchNumber }, 'warn');
                        aborted = true;
                        break;
                    }

                    const groupDelay = this.delayManager.getGroupDelay();
                    if (groupDelay > 0) {
                        this._logProgress('BATCH_JEDA', `Menunggu ${groupDelay}ms sebelum grup berikutnya...`, { delay: groupDelay });
                        await this.delayManager.waitGroupDelay();
                    }
                }
            }

            // Step 4: Send Telegram OFFLINE
            if (!aborted) {
                await this.telegramService.sendStatus('OFFLINE');
                this._logProgress('STATUS', 'Status Telegram diatur ke OFFLINE.');
            } else {
                this._logProgress('STATUS', 'Status OFFLINE dilewati karena proses dihentikan.', null, 'warn');
            }

            // Finish
            this.scanStats.endTime = Date.now();
            this.isScanning = false;

            // Callback: Complete
            this.callbacks.onComplete({
                stats: this.scanStats,
                duration: this.scanStats.endTime - this.scanStats.startTime,
                aborted
            });

            this._logProgress('SELESAI', 'Proses scanning tuntas.', {
                sukses: this.scanStats.successCount,
                gagal: this.scanStats.errorCount,
                sinyal: this.scanStats.profitableSignals,
                durasiMs: this.scanStats.endTime - this.scanStats.startTime,
                dihentikan: aborted
            });

        } catch (error) {
            this.isScanning = false;
            // console.error('[PriceScanner] Scan error:', error);
            this.callbacks.onError(error);
            this._logProgress('ERROR', 'Terjadi kesalahan saat scanning.', { error: error.message }, 'error');
            await this.telegramService.sendStatus('ERROR');
        }
    }

    /**
     * Stop scanning (gracefully)
     */
    stopScan() {
        if (!this.isScanning) return;

        this._logProgress('STOP', 'Permintaan penghentian scanning diterima.');
        this.isScanning = false;
        this.telegramService.sendStatus('STOPPED');
    }

    /**
     * Memproses satu token
     * @private
     */
    async _processToken(token, filters, gasData, usdtRate) {
        if (!this.isScanning) {
            return;
        }

        try {
            const tokenId = token.id;
            const tokenName = `${token.nama_token}/${token.nama_pair}`;
            this._logProgress('TOKEN_MULAI', `Memproses ${tokenName}.`, { tokenId, tokenName });

            // Step 1: Fetch CEX prices
            // REVISI: Logika pemanggilan CEX dipindahkan ke sini untuk menghormati filter chain.
            const cexPrices = { token: null, pair: null };
            const cexKey = token.cex_name;

            if (cexKey) {
                const cexDelay = this.delayManager.getCexDelay(cexKey);

                // Ambil orderbook untuk token utama
                const tokenSymbol = (token.nama_token || token.cex_ticker_token || '').replace(/\s+/g, '');
                if (!tokenSymbol) {
                    this._logProgress('ORDERBOOK_TOKEN_LEWAT', `Nama token tidak tersedia untuk ${tokenName}.`, { tokenId }, 'warn');
                } else {
                    this._logProgress('ORDERBOOK_TOKEN', `Mengambil orderbook ${tokenSymbol} di ${cexKey}.`, { tokenId });
                    cexPrices.token = await this.cexFetcher.getOrderbook(cexKey, tokenSymbol);

                    if (cexPrices.token) {
                        this._logProgress('ORDERBOOK_TOKEN_SELESAI', `Orderbook token ${tokenSymbol} diterima (delay: ${cexDelay}ms).`, {
                            tokenId,
                            bestBid: cexPrices.token.bestBid,
                            bestAsk: cexPrices.token.bestAsk,
                            cexDelay
                        });
                    } else {
                        this._logProgress('ORDERBOOK_TOKEN_GAGAL', `Orderbook token ${tokenSymbol} tidak tersedia.`, { tokenId }, 'warn');
                    }
                }

                // Jeda CEX: Delay setelah fetch orderbook token
                await this.delayManager.waitCexDelay(cexKey);

                // Ambil orderbook untuk pair jika ada
                if (token.nama_pair) {
                    const pairSymbol = token.nama_pair.replace(/\s+/g, '');
                    if (!pairSymbol) {
                        this._logProgress('ORDERBOOK_PAIR_LEWAT', `Nama pair kosong untuk ${tokenName}.`, { tokenId }, 'warn');
                    } else {
                        this._logProgress('ORDERBOOK_PAIR', `Mengambil orderbook ${pairSymbol} di ${cexKey}.`, { tokenId });
                        cexPrices.pair = await this.cexFetcher.getOrderbook(cexKey, pairSymbol);

                        if (cexPrices.pair) {
                            this._logProgress('ORDERBOOK_PAIR_SELESAI', `Orderbook pair ${pairSymbol} diterima (delay: ${cexDelay}ms).`, {
                                tokenId,
                                bestBid: cexPrices.pair.bestBid,
                                bestAsk: cexPrices.pair.bestAsk,
                                cexDelay
                            });
                        } else {
                            this._logProgress('ORDERBOOK_PAIR_GAGAL', `Orderbook pair ${pairSymbol} tidak tersedia.`, { tokenId }, 'warn');
                        }
                    }
                } else {
                    this._logProgress('ORDERBOOK_PAIR_LEWAT', `Nama pair tidak tersedia untuk ${tokenName}.`, { tokenId }, 'warn');
                }

                // Jeda CEX: Delay setelah fetch orderbook pair
                await this.delayManager.waitCexDelay(cexKey);
            } else {
                this._logProgress('ORDERBOOK_LEWAT', `CEX utama tidak ditemukan untuk ${tokenName}.`, { tokenId }, 'warn');
            }

            // REVISI: Emit callback CEX result segera setelah data CEX diterima
            // Ini memungkinkan UI untuk menampilkan harga CEX tanpa menunggu DEX
            this.callbacks.onCexResult({
                token,
                cexPrices
            });

            if (!cexPrices || !cexPrices.token) {
                this._logProgress('TOKEN_GAGAL', `Orderbook utama tidak ditemukan untuk ${tokenName}.`, { tokenId }, 'warn');
                this.scanStats.errorCount++;
                this.scanStats.processedTokens++;
                return;
            }

            // Hitung jumlah pasti yang akan dipakai untuk swap di DEX
            const dexInput = this._calculateDexInputAmounts(token, cexPrices);

            if (!this.isScanning) {
                return;
            }

            // Step 2 & 3: Fetch DEX quotes DAN kalkulasi PNL
            // REFACTORED: Jeda DEX diterapkan hanya saat pergantian arah (CEX->DEX ke DEX->CEX)
            const dexFilters = filters?.dex || {};
            const activeDexKeys = Object.keys(dexFilters).filter(k => dexFilters[k]);
            if (activeDexKeys.length === 0) {
                this._logProgress('DEX_SKIP', `Tidak ada DEX aktif untuk ${tokenName}.`, { tokenId }, 'warn');
            }

            const dexResults = {};
            const pnlResults = {};

            // REFACTORED: Proses DEX secara paralel dalam satu grup (per koin)
            // Jeda antar DEX hanya untuk menghindari rate limit simultaneous request
            const dexJobs = activeDexKeys.map(async (dexKey, dexIndex) => {
                if (!this.isScanning) {
                    return;
                }

                // Cek apakah token support DEX ini
                if (!token.dex || !token.dex[dexKey] || !token.dex[dexKey].status) {
                    return;
                }

                // Jeda bertahap antar DEX dalam grup yang sama (stagger)
                // Untuk menghindari terlalu banyak request bersamaan
                if (dexIndex > 0) {
                    await this.delayManager.waitDexDelay(dexKey, dexIndex);
                }

                try {
                    // Fetch quote untuk KEDUA arah sekaligus
                    this._logProgress('DEX_FETCH', `Mengambil quote ${dexKey} untuk ${tokenName}.`, { tokenId, dexKey });
                    const quotes = await this._fetchDexQuotes(token, dexKey, dexInput);

                    if (quotes) {
                        dexResults[dexKey] = quotes;
                        this._logProgress('DEX_FETCH_SELESAI', `Quote ${dexKey} diterima.`, {
                            tokenId,
                            dexKey,
                            toPair: quotes.tokenToPair?.amountOut || 0,
                            toToken: quotes.pairToToken?.amountOut || 0
                        });

                        // Kalkulasi PNL untuk KEDUA arah
                        const pnlCexToDex = this.pnlCalculator.calculateBothDirections({
                            token,
                            cexPrices,
                            dexQuote: quotes.tokenToPair,
                            direction: 'CEXtoDEX',
                            modalUsd: this.settings.modalUsd,
                            gasData,
                            usdtRate
                        });

                        const pnlDexToCex = this.pnlCalculator.calculateBothDirections({
                            token,
                            cexPrices,
                            dexQuote: quotes.pairToToken,
                            direction: 'DEXtoCEX',
                            modalUsd: this.settings.modalUsd,
                            gasData,
                            usdtRate
                        });

                        pnlResults[dexKey] = {
                            cexToDex: pnlCexToDex,
                            dexToCex: pnlDexToCex
                        };

                        this._logProgress('PNL_SELESAI', `PNL ${tokenName} via ${dexKey}.`, {
                            tokenId,
                            dexKey,
                            cexToDex: pnlCexToDex?.pnlPercent || 0,
                            dexToCex: pnlDexToCex?.pnlPercent || 0
                        });

                        // Update UI langsung per DEX (tidak tunggu semua DEX selesai)
                        this.callbacks.onPnlResult({
                            token,
                            dexKey,
                            pnl: pnlResults[dexKey],
                            cexPrices
                        });

                        // Send sinyal Telegram jika profitable
                        if (this.settings.autoSendTelegram) {
                            await this._checkAndSendSignal(token, dexKey, pnlCexToDex, usdtRate);
                            await this._checkAndSendSignal(token, dexKey, pnlDexToCex, usdtRate);
                        }

                    } else {
                        this._logProgress('DEX_FETCH_GAGAL', `Quote ${dexKey} gagal.`, { tokenId, dexKey }, 'warn');

                        // Emit error state
                        this.callbacks.onPnlResult({
                            token,
                            dexKey,
                            pnl: {
                                cexToDex: { error: true, errorMessage: 'Quote gagal' },
                                dexToCex: { error: true, errorMessage: 'Quote gagal' }
                            },
                            cexPrices
                        });
                    }
                } catch (error) {
                    this._logProgress('DEX_ERROR', `Error ${dexKey}: ${error.message}`, { tokenId, dexKey }, 'error');

                    // Emit error state
                    this.callbacks.onPnlResult({
                        token,
                        dexKey,
                        pnl: {
                            cexToDex: { error: true, errorMessage: error.message },
                            dexToCex: { error: true, errorMessage: error.message }
                        },
                        cexPrices
                    });
                }
            });

            // Tunggu semua DEX dalam grup selesai (parallel dengan stagger)
            await Promise.allSettled(dexJobs);

            // Update stats
            this.scanStats.processedTokens++;
            this.scanStats.successCount++;

            // Callback: Token complete
            this.callbacks.onTokenComplete({
                token,
                cexPrices,
                dexResults,
                pnlResults,
                progress: (this.scanStats.processedTokens / this.scanStats.totalTokens) * 100
            });
            this._logProgress('TOKEN_SELESAI', `Token ${tokenName} selesai diproses.`, {
                tokenId,
                processed: this.scanStats.processedTokens,
                total: this.scanStats.totalTokens
            });

        } catch (error) {
            // console.error(`[PriceScanner] Error processing token ${token.id}:`, error);
            this.scanStats.errorCount++;
            this.scanStats.processedTokens++;
            this._logProgress('TOKEN_ERROR', `Kesalahan saat memproses ${token.id}.`, { error: error.message }, 'error');
        }
    }

    /**
     * Fetch DEX quotes untuk kedua arah
     * @private
     */
    async _fetchDexQuotes(token, dexKey, inputAmounts) {
        try {
            const globalSettings = this.settings.globalSettings || { walletMeta: '0x0000000000000000000000000000000000000000' };
            const activeDexConfig = { [dexKey]: true };

            let pairToTokenQuote = null;
            let tokenToPairQuote = null;

            // Gunakan timeout dari DelayManager
            const timeout = this.delayManager.getTimeout();

            // Gunakan callback untuk mendapatkan hasil
            await this.dexFetcher.getQuotes(
                token,
                activeDexConfig,
                inputAmounts,
                globalSettings,
                (resultDexKey, quotes) => {
                    if (resultDexKey === dexKey) {
                        pairToTokenQuote = quotes.pairToToken;
                        tokenToPairQuote = quotes.tokenToPair;
                    }
                },
                timeout
            );

            return {
                pairToToken: pairToTokenQuote,
                tokenToPair: tokenToPairQuote
            };

        } catch (error) {
            // console.error(`[PriceScanner] DEX fetch error for ${dexKey}:`, error);
            return null;
        }
    }

    /**
     * Hitung jumlah aktual yang akan digunakan sebagai input swap di DEX
     * @private
     */
    _calculateDexInputAmounts(token, cexPrices) {
        const modalUsd = this.settings.modalUsd || 0;
        const cexKey = (token.cex_name || '').toLowerCase();

        // Hitung jumlah token yang dibeli di CEX (tidak termasuk biaya trading karena diambil dari modal USD)
        const buyPriceToken = cexPrices.token?.bestAsk || 0;
        const tokenWithdrawalFee = this.pnlCalculator.getWithdrawalFee
            ? this.pnlCalculator.getWithdrawalFee({
                cexKey,
                symbol: token.nama_token,
                token,
                assetType: 'token'
            })
            : (this.pnlCalculator._getCexWithdrawalFee
                ? this.pnlCalculator._getCexWithdrawalFee(cexKey, token.nama_token, token)
                : 0);

        const tokenAmountBought = buyPriceToken > 0 ? (modalUsd / buyPriceToken) : 0;
        const tokenAmountAfterWithdrawal = Math.max(tokenAmountBought - tokenWithdrawalFee, 0);

        // Hitung jumlah pair yang dibeli di CEX untuk skenario DEX → CEX
        const pairSymbol = (token.nama_pair || '').toUpperCase();
        const buyPricePair = pairSymbol === 'USDT' ? 1 : (cexPrices.pair?.bestAsk || 0);
        const pairWithdrawalFee = this.pnlCalculator.getWithdrawalFee
            ? this.pnlCalculator.getWithdrawalFee({
                cexKey,
                symbol: token.nama_pair,
                token,
                assetType: 'pair'
            })
            : (this.pnlCalculator._getCexWithdrawalFee
                ? this.pnlCalculator._getCexWithdrawalFee(cexKey, token.nama_pair, token)
                : 0);

        const pairAmountBought = buyPricePair > 0 ? (modalUsd / buyPricePair) : 0;
        const pairAmountAfterWithdrawal = Math.max(pairAmountBought - pairWithdrawalFee, 0);

        return {
            tokenToPair: tokenAmountAfterWithdrawal,
            pairToToken: pairAmountAfterWithdrawal
        };
    }

    /**
     * Utility logging progress dan meneruskan ke callback
     * @private
     */
    _logProgress(stage, message, data = null, level = 'log') {
        const allowed = ['log', 'info', 'warn', 'error'];
        const method = allowed.includes(level) ? level : 'log';
        const prefix = `[PriceScanner][${stage}]`;
        if (data) {
            console[method](`${prefix} ${message}`, data);
        } else {
            console[method](`${prefix} ${message}`);
        }
        if (typeof this.callbacks.onProgress === 'function') {
            try {
                this.callbacks.onProgress({ stage, message, data });
            } catch (err) {
                console.warn('[PriceScanner] Gagal meneruskan progress ke UI:', err.message);
            }
        }
    }

    /**
     * Check PNL dan kirim sinyal ke Telegram jika profitable
     * @private
     */
    async _checkAndSendSignal(token, dexKey, pnlResult, usdtRate) {
        if (!pnlResult || pnlResult.error) return;

        const { pnlPercent, pnl } = pnlResult;

        // REVISI: Kondisi diubah dari pnlPercent menjadi pnl (nilai absolut)
        if (pnl >= this.settings.minPnl) {
            this.scanStats.profitableSignals++;

            const formatted = this.pnlCalculator.formatPnlResult(pnlResult, usdtRate);

            const message = this._formatTelegramMessage(token, dexKey, formatted);
            this._logProgress('SIGNAL', `Mengirim sinyal ${token.nama_token}/${token.nama_pair} via ${dexKey}.`, {
                pnlPercent,
                pnlUsd: pnl
            });
            await this.telegramService.sendSignal(message);

            // console.log(`[PriceScanner] 📢 Signal sent for ${token.nama_token}/${token.nama_pair} via ${dexKey}`);
        }
    }

    /**
     * Format pesan Telegram untuk sinyal (HTML format)
     * @private
     */
    _formatTelegramMessage(token, dexKey, pnlFormatted) {
        const { direction, costs, details, modal } = pnlFormatted;
        const { formatted } = this.pnlCalculator.formatPnlResult(pnlFormatted, this.settings.globalSettings?.usdtRate || 15800);

        const nickname = this.settings.globalSettings?.nickname?.toUpperCase() || 'USER';
        const appName = this.config?.APP_NAME?.toUpperCase() || 'MULTIPLUS-SCANNER';

        const proses = direction === 'CEXtoDEX'
            ? `${token.cex_name.toUpperCase()} => ${dexKey.toUpperCase()}`
            : `${dexKey.toUpperCase()} => ${token.cex_name.toUpperCase()}`;

        const transaksi = direction === 'CEXtoDEX'
            ? `${token.nama_token} => ${token.nama_pair}`
            : `${token.nama_pair} => ${token.nama_token}`;

        const buyPrice = details.buyPrice || details.buyPriceForPair || 0;
        const sellPrice = details.sellPrice || 0;

        const feeWd = costs.withdrawal?.toFixed(2) || '0.00';
        const feeSwap = costs.gasDex?.toFixed(2) || '0.00';

        const tokenStatus = `WD${token.cex_withdraw_status ? '✅' : '❌'} | DP${token.cex_deposit_status ? '✅' : '❌'}`;
        const pairStatus = `WD${token.cex_pair_withdraw_status ? '✅' : '❌'} | DP${token.cex_pair_deposit_status ? '✅' : '❌'}`;

        return `
<b>#${appName} #${token.chain.toUpperCase()}</b>
<b>#INFO_USER : #${nickname}</b>
---------------------------------------------------
<b>PROSES :</b> ${proses}
<b>TRANSAKSI :</b> ${transaksi}
<b>MODAL & STOK :</b> ${formatted.modal} | STOK
<b>BUY ${direction === 'CEXtoDEX' ? token.nama_token : token.nama_pair} :</b> ${buyPrice.toFixed(12)}$
<b>SELL ${direction === 'CEXtoDEX' ? token.nama_pair : token.nama_token} :</b> ${sellPrice.toFixed(12)}$
<b>PROFIT & TOTAL FEE :</b> ${formatted.pnl} & ${formatted.totalCost}
<b>FEE WD & FEE SWAP :</b> ${feeWd}$ & ${feeSwap}$
<b>${token.nama_pair}:</b> ${pairStatus}
<b>${token.nama_token}:</b> ${tokenStatus}
        `.trim();
    }

    /**
     * Membuat batches dari array tokens
     * @private
     */
    _createBatches(tokens, batchSize) {
        const batches = [];
        for (let i = 0; i < tokens.length; i += batchSize) {
            batches.push(tokens.slice(i, i + batchSize));
        }
        return batches;
    }

    /**
     * Helper untuk mengambil global settings aktif
     * @private
     */
    _getGlobalSettings() {
        return this.settings?.globalSettings || {};
    }

    /**
     * Reset statistics
     * @private
     */
    _resetStats() {
        this.scanStats = {
            totalTokens: 0,
            processedTokens: 0,
            successCount: 0,
            errorCount: 0,
            profitableSignals: 0,
            startTime: null,
            endTime: null
        };
    }

    /**
     * Update settings
     */
    updateSettings(newSettings) {
        Object.assign(this.settings, newSettings);

        // Update DelayManager dengan globalSettings terbaru
        if (newSettings.globalSettings) {
            this.delayManager.updateGlobalSettings(newSettings.globalSettings);
        }

        // Update fetchers dengan globalSettings
        if (this.cexFetcher && typeof this.cexFetcher.updateGlobalSettings === 'function') {
            this.cexFetcher.updateGlobalSettings(this.settings.globalSettings);
        }
        if (this.dexFetcher && typeof this.dexFetcher.updateGlobalSettings === 'function') {
            this.dexFetcher.updateGlobalSettings(this.settings.globalSettings);
        }
    }

    /**
     * Get current scan status
     */
    getStatus() {
        return {
            isScanning: this.isScanning,
            stats: this.scanStats,
            settings: this.settings
        };
    }
}

// Export untuk digunakan di window global
if (typeof window !== 'undefined') {
    window.PriceScanner = PriceScanner;
}
