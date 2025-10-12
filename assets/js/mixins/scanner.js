/**
 * ===================================================================================
 * Scanner Mixin
 * ===================================================================================
 *
 * Mixin ini menyediakan logika scanning untuk komponen Vue
 * Digunakan oleh scanning-tab.js
 */
const scannerMixin = {
    data() {
        return {
            scanner: null,
            scanningInProgress: false,
            scanProgress: 0,
            currentBatch: 0,
            totalBatches: 0,
            scanResults: {},  // Menyimpan hasil scan per token { tokenId: { cex, dex, pnl } }
            dexScanStatus: {}, // Status per token per DEX: loading | done | error
            lastScanTime: null,
            lastPnlResult: null, // REVISI: Tambahkan state untuk hasil PNL terakhir
            currentProgressMessage: '' // Pesan progress detail untuk ditampilkan
        };
    },

    methods: {
        /**
         * Inisialisasi scanner instance
         */
        initializeScanner() {
            if (this.scanner) return; // Already initialized

            // Ambil credentials Telegram dari KONFIG_APLIKASI
            // Fallback ke global settings jika tidak ada
            const telegramCredentials = {
                botToken: this.$root.config?.TELEGRAM?.BOT_TOKEN || this.$root.globalSettings?.telegramBotToken || '',
                chatId: this.$root.config?.TELEGRAM?.CHAT_ID || this.$root.globalSettings?.telegramChatId || '',
                appName: this.$root.config?.APP_NAME || 'MULTIPLUS-SCANNER'
            };

            // Inisialisasi semua services
            const services = {
                cexFetcher: new CexPriceFetcher(this.$root.config, Http, this.$root.globalSettings),
                dexFetcher: new DexDataFetcher(this.$root.config, Http, this.$root.globalSettings),
                realtimeFetcher: new RealtimeDataFetcher(this.$root.config, Http),
                pnlCalculator: new PnlCalculator(this.$root.config),
                telegramService: new TelegramService(telegramCredentials)
            };

            // Callbacks untuk scanner
            const callbacks = {
                onStart: (data) => this.handleScanStart(data),
                onProgress: (data) => this.handleScanProgress(data),
                onCexResult: (data) => this.handleCexResult(data), // REVISI: Callback untuk CEX data
                onPnlResult: (data) => this.handlePnlResult(data), // REVISI: Tambahkan handler untuk callback baru
                onTokenComplete: (data) => this.handleTokenComplete(data),
                onBatchComplete: (data) => this.handleBatchComplete(data),
                onComplete: (data) => this.handleScanComplete(data),
                onError: (error) => this.handleScanError(error)
            };

            // Buat scanner instance
            this.scanner = new PriceScanner(this.$root.config, services, callbacks);

        },

        /**
         * Memulai scanning
         */
        async startScanning() {
            if (this.scanningInProgress) {
                // // console.warn('[ScannerMixin] Scan already in progress');
                return;
            }

            // Inisialisasi scanner jika belum
            this.initializeScanner();

            // Ambil tokens yang akan di-scan (dari filteredTokens)
            const tokensToScan = this.filteredTokens || [];

            if (tokensToScan.length === 0) {
                this.$emit('show-toast', 'Tidak ada token untuk di-scan', 'warning');
                this.$root.isFilterLocked = false;
                return;
            }

            // Ambil filter aktif
            const filters = this.$root.filters;

            // Normalisasi jumlah token per batch (Anggota Grup)
            const rawBatchSize = Number(
                this.$root.globalSettings?.tokensPerBatch ??
                this.$root.globalSettings?.AnggotaGrup ??
                0
            );
            const tokensPerBatch = Number.isFinite(rawBatchSize) && rawBatchSize > 0
                ? Math.min(Math.trunc(rawBatchSize), 10)
                : 3;

            // ADOPSI APLIKASI LAMA: Ambil settings lengkap termasuk delay configuration
            const scanSettings = {
                modalUsd: this.$root.globalSettings?.modalUsd || 100,
                minPnlPercent: this.$root.filters?.minPnl || 0.5,
                tokensPerBatch,

                // ADOPSI APLIKASI LAMA: Delay settings dari config
                jedaTimeGroup: this.$root.config?.SCANNING_DELAYS?.jedaTimeGroup || 2000,
                jedaKoin: this.$root.globalSettings?.jedaKoin ?? this.$root.config?.SCANNING_DELAYS?.jedaKoin ?? 500,
                JedaCexs: this.$root.config?.SCANNING_DELAYS?.JedaCexs || {},
                JedaDexs: this.$root.config?.SCANNING_DELAYS?.JedaDexs || {},
                dexTimeout: this.$root.config?.SCANNING_DELAYS?.dexTimeout || 5000,

                autoSendTelegram: true,
                globalSettings: this.$root.globalSettings // WAJIB: Teruskan globalSettings yang berisi nickname
            };

            // Update scanner settings
            this.scanner.updateSettings(scanSettings);

            // Mulai scan
            this.clearScanResults();
            this.scanningInProgress = true;
            this.$root.isFilterLocked = true;

            await this.scanner.startScan(tokensToScan, filters, scanSettings);
        },

        /**
         * Stop scanning
         */
        stopScanning() {
            if (!this.scanningInProgress || !this.scanner) return;

            this.scanner.stopScan();
            this.scanningInProgress = false;
            this.$root.isFilterLocked = false;
            this.dexScanStatus = {};
            this.$emit('show-toast', 'Scanning dihentikan', 'info');
        },

        /**
         * Handler: Scan start
         */
        handleScanStart(data) {
            this.scanProgress = 0;
            this.currentBatch = 0;
            this.totalBatches = Math.ceil(data.totalTokens / data.settings.tokensPerBatch);
            this.scanResults = {}; // Reset results
            this.dexScanStatus = {};

            this.$emit('show-toast', `Memulai scan untuk ${data.totalTokens} token...`, 'info');
        },

        /**
         * Handler: Scan progress (untuk logging)
         */
        handleScanProgress(data) {
            // Method ini ditambahkan untuk menangani callback onProgress dari PriceScanner.
            // Update pesan progress untuk UI
            const { stage, message } = data;

            // Format pesan berdasarkan stage
            const stageMap = {
                'REALTIME_FETCH': '⏳ Mengambil data real-time...',
                'REALTIME_SELESAI': '✓ Data real-time diperoleh',
                'BATCH_MULAI': `📦 Batch ${data.data?.batchNumber || ''}`,
                'TOKEN_MULAI': `🔍 ${data.data?.tokenName || 'Token'}`,
                'ORDERBOOK_TOKEN': `💰 Fetching CEX...`,
                'ORDERBOOK_TOKEN_SELESAI': `✓ CEX data received`,
                'DEX_FETCH': `🔄 Fetching ${data.data?.dexKey || 'DEX'}...`,
                'DEX_FETCH_SELESAI': `✓ ${data.data?.dexKey || 'DEX'} quote received`,
                'PNL_SELESAI': `💵 Calculating PNL...`,
                'TOKEN_SELESAI': `✓ Token complete`,
                'BATCH_SELESAI': `✓ Batch ${data.data?.batchNumber || ''} done`
            };

            this.currentProgressMessage = stageMap[stage] || message || 'Processing...';

            const tokenId = data?.data?.tokenId;
            const dexKey = data?.data?.dexKey;

            // Update status loading per token per DEX
            if (tokenId && dexKey) {
                if (stage === 'DEX_FETCH') {
                    this._setDexScanStatus(tokenId, dexKey, 'loading');
                } else if (stage === 'DEX_FETCH_SELESAI' || stage === 'PNL_SELESAI') {
                    this._setDexScanStatus(tokenId, dexKey, 'done');
                } else if (stage === 'DEX_FETCH_GAGAL') {
                    this._setDexScanStatus(tokenId, dexKey, 'error');
                }
            }

            // Reset status semua DEX saat token mulai di-scan
            if (stage === 'TOKEN_MULAI' && tokenId) {
                this._resetDexStatusForToken(tokenId);
            }

            // TIDAK PERLU $forceUpdate() - Vue 3 otomatis detect perubahan dexScanStatus
        },

        /**
         * Handler: CEX result untuk token selesai.
         * Dipanggil segera saat data CEX diterima.
         */
        handleCexResult(data) {
            const { token, cexPrices } = data;

            // VUE 3: Direct assignment works - Proxy-based reactivity
            if (!this.scanResults[token.id]) {
                this.scanResults[token.id] = { pnl: {}, cex: null, dex: {} };
            }

            // Update CEX data - Vue 3 akan otomatis detect perubahan
            this.scanResults[token.id].cex = cexPrices;

        },

        /**
         * Handler: PNL result untuk satu DEX selesai.
         * Ini dipanggil segera setelah satu DEX selesai di-fetch dan dikalkulasi.
         * Update UI langsung per DEX, tidak menunggu semua DEX selesai.
         */
        handlePnlResult(data) {
            const { token, dexKey, pnl, cexPrices } = data;

            // VUE 3: Buat object baru untuk trigger reactivity
            // Spread existing data + update yang baru
            const existingData = this.scanResults[token.id] || { pnl: {}, cex: null, dex: {} };
            const existingPnl = existingData.pnl || {};

            // Update dengan create new object reference (memastikan Vue detect change)
            this.scanResults[token.id] = {
                ...existingData,
                cex: cexPrices || existingData.cex,
                pnl: {
                    ...existingPnl,
                    [dexKey]: pnl
                }
            };

            const hasError = Boolean(
                pnl?.cexToDex?.error ||
                pnl?.dexToCex?.error ||
                pnl?.error
            );
            this._setDexScanStatus(token.id, dexKey, hasError ? 'error' : 'done');

            // Simpan untuk signal card processing
            this.lastPnlResult = { token, dexKey, pnl };

        },

        /**
         * Handler: Token complete
         */
        handleTokenComplete(data) {
            const { token, cexPrices, dexResults, pnlResults, progress } = data;

            // REVISI: Cukup pastikan data CEX dan DEX tersimpan. PNL sudah diupdate secara real-time.
            // Ini mencegah re-render yang tidak perlu di akhir proses token.
            this.scanResults[token.id] = {
                ...(this.scanResults[token.id] || { pnl: {} }), // Pertahankan PNL yang sudah ada
                cex: cexPrices,
                dex: dexResults, // Simpan hasil quote DEX mentah jika perlu
                timestamp: Date.now()
            };

            // Update progress
            this.scanProgress = progress;
            this._markTokenDexDone(token.id);

        },

        /**
         * Handler: Batch complete
         */
        handleBatchComplete(data) {
            this.currentBatch = data.batchNumber;
            const shouldAutoScroll = Boolean(this.$root?.filters?.autoscroll);
            if (shouldAutoScroll) {
                this.scrollToFirstTokenRow();
            }
        },

        /**
         * Handler: Scan complete
         */
        handleScanComplete(data) {

            this.scanningInProgress = false;
            this.$root.isFilterLocked = false;
            this.scanProgress = 100;
            this.lastScanTime = Date.now();
            this.currentProgressMessage = '✓ Scan selesai!';

            const { stats, duration } = data;
            const durationSec = (duration / 1000).toFixed(1);

            this.$emit('show-toast',
                `Scan selesai! ${stats.successCount}/${stats.totalTokens} token berhasil. Sinyal: ${stats.profitableSignals}. Durasi: ${durationSec}s`,
                'success',
                5000
            );

            // Update root lastScanTime untuk display
            this.$root.lastScanTime = this.lastScanTime;
        },

        /**
         * Handler: Scan error
         */
        handleScanError(error) {
            // // console.error('[ScannerMixin] Scan error:', error);
            this.scanningInProgress = false;
            this.$root.isFilterLocked = false;
            this.dexScanStatus = {};
            this.$emit('show-toast', `Error saat scanning: ${error.message}`, 'danger', 5000);
        },

        /**
         * Update tampilan token dengan hasil PNL
         */
        updateTokenDisplay(tokenId, pnlResults) {
            // Cari token di array tokens
            const token = this.tokens.find(t => t.id === tokenId);
            if (!token) return;

            // Update property dex dengan hasil PNL
            for (const dexKey in pnlResults) {
                if (!token.dex) token.dex = {};
                if (!token.dex[dexKey]) token.dex[dexKey] = { status: true };

                const pnl = pnlResults[dexKey];

                // Update left (CEX→DEX) dan right (DEX→CEX) dengan nilai PNL
                token.dex[dexKey].left = pnl.cexToDex?.pnl || 0;
                token.dex[dexKey].right = pnl.dexToCex?.pnl || 0;
                token.dex[dexKey].leftPercent = pnl.cexToDex?.pnlPercent || 0;
                token.dex[dexKey].rightPercent = pnl.dexToCex?.pnlPercent || 0;
            }

            // Force reactivity update
            this.$forceUpdate();
        },

        /**
         * Get scan result for specific token
         */
        getScanResult(tokenId) {
            return this.scanResults[tokenId] || null;
        },

        /**
         * Clear scan results
         */
        clearScanResults() {
            this.scanResults = {};
            this.scanProgress = 0;
            this.currentBatch = 0;
            this.totalBatches = 0;
            this.currentProgressMessage = '';
            this.dexScanStatus = {};
        },

        scrollToFirstTokenRow() {
            this.$nextTick(() => {
                const hostElement = this.$el || document.querySelector('.scanning-tab');
                if (!hostElement) return;

                const targetCell = hostElement.querySelector('.token-row .token-detail') ||
                    hostElement.querySelector('.token-row');

                if (targetCell) {
                    targetCell.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        },

        _setDexScanStatus(tokenId, dexKey, status) {
            if (!tokenId || !dexKey || !status) return;
            const existingTokenStatus = this.dexScanStatus[tokenId] || {};
            if (existingTokenStatus[dexKey] === status) return;
            this.dexScanStatus = {
                ...this.dexScanStatus,
                [tokenId]: {
                    ...existingTokenStatus,
                    [dexKey]: status
                }
            };
        },

        _resetDexStatusForToken(tokenId) {
            if (!tokenId) return;
            if (this.dexScanStatus[tokenId]) {
                this.dexScanStatus = {
                    ...this.dexScanStatus,
                    [tokenId]: {}
                };
            }
        },

        _markTokenDexDone(tokenId) {
            if (!tokenId || !this.dexScanStatus[tokenId]) return;
            const updatedEntries = Object.fromEntries(
                Object.entries(this.dexScanStatus[tokenId]).map(([dexKey, status]) => {
                    return [dexKey, status === 'error' ? status : 'done'];
                })
            );
            this.dexScanStatus = {
                ...this.dexScanStatus,
                [tokenId]: updatedEntries
            };
        }
    },

    computed: {
        scanStatusText() {
            if (this.scanningInProgress) {
                return `Scanning... ${this.scanProgress.toFixed(0)}% (Batch ${this.currentBatch}/${this.totalBatches})`;
            }

            if (this.lastScanTime) {
                const time = new Date(this.lastScanTime).toLocaleTimeString('id-ID');
                return `Last scan: ${time}`;
            }

            return 'Ready to scan';
        }
    },

    mounted() {
        // Inisialisasi scanner saat component mounted
        this.initializeScanner();
    }
};
