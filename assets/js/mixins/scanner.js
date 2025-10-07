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

            console.log('[ScannerMixin] Scanner initialized');
        },

        /**
         * Memulai scanning
         */
        async startScanning() {
            if (this.scanningInProgress) {
                console.warn('[ScannerMixin] Scan already in progress');
                return;
            }

            // Inisialisasi scanner jika belum
            this.initializeScanner();

            // Ambil tokens yang akan di-scan (dari filteredTokens)
            const tokensToScan = this.filteredTokens || [];

            if (tokensToScan.length === 0) {
                this.$emit('show-toast', 'Tidak ada token untuk di-scan', 'warning');
                return;
            }

            // Ambil filter aktif
            const filters = this.$root.filters;

            // Ambil settings dari filterSettings
            const scanSettings = {
                modalUsd: this.$root.globalSettings?.modalUsd || 100,
                minPnlPercent: this.$root.filters?.minPnl || 0.5,
                tokensPerBatch: 3,
                delayBetweenBatches: 2000,
                delayBetweenDex: 300,
                autoSendTelegram: true,
                globalSettings: this.$root.globalSettings // WAJIB: Teruskan globalSettings yang berisi nickname
            };

            // Update scanner settings
            this.scanner.updateSettings(scanSettings);

            // Mulai scan
            this.clearScanResults();
            console.log(`[ScannerMixin] Starting scan for ${tokensToScan.length} tokens...`);
            this.scanningInProgress = true;

            await this.scanner.startScan(tokensToScan, filters, scanSettings);
        },

        /**
         * Stop scanning
         */
        stopScanning() {
            if (!this.scanningInProgress || !this.scanner) return;

            this.scanner.stopScan();
            this.scanningInProgress = false;
            this.$emit('show-toast', 'Scanning dihentikan', 'info');
        },

        /**
         * Handler: Scan start
         */
        handleScanStart(data) {
            console.log('[ScannerMixin] Scan started:', data);
            this.scanProgress = 0;
            this.currentBatch = 0;
            this.totalBatches = Math.ceil(data.totalTokens / data.settings.tokensPerBatch);
            this.scanResults = {}; // Reset results

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

            // Force Vue reactivity
            this.$forceUpdate();
        },

        /**
         * Handler: CEX result untuk token selesai.
         * Dipanggil segera saat data CEX diterima.
         */
        handleCexResult(data) {
            const { token, cexPrices } = data;

            // Inisialisasi struktur data di scanResults
            if (!this.scanResults[token.id]) {
                this.scanResults[token.id] = { pnl: {}, cex: null, dex: {} };
            }

            // Update CEX data
            this.scanResults[token.id].cex = cexPrices;

            // Force Vue reactivity untuk update UI
            this.$forceUpdate();

            console.log(`[ScannerMixin] CEX data received for ${token.nama_token}/${token.nama_pair}`);
        },

        /**
         * Handler: PNL result untuk satu DEX selesai.
         * Ini dipanggil segera setelah satu DEX selesai di-fetch dan dikalkulasi.
         * Update UI langsung per DEX, tidak menunggu semua DEX selesai.
         */
        handlePnlResult(data) {
            const { token, dexKey, pnl, cexPrices } = data;

            // Pastikan struktur data di scanResults ada
            if (!this.scanResults[token.id]) {
                this.scanResults[token.id] = { pnl: {}, cex: cexPrices, dex: {} };
            }
            if (!this.scanResults[token.id].pnl) {
                this.scanResults[token.id].pnl = {};
            }
            if (cexPrices && !this.scanResults[token.id].cex) {
                this.scanResults[token.id].cex = cexPrices;
            }

            // Update PNL untuk DEX ini - buat object baru untuk trigger Vue reactivity
            this.scanResults[token.id].pnl = {
                ...this.scanResults[token.id].pnl,
                [dexKey]: pnl
            };

            // PENTING: Buat reference baru untuk scanResults agar Vue mendeteksi perubahan
            this.scanResults = { ...this.scanResults };

            // REVISI: Simpan hasil PNL terakhir agar bisa di-watch oleh komponen
            this.lastPnlResult = { ...data, timestamp: Date.now() };

            // Force Vue reactivity untuk update UI
            this.$forceUpdate();

            console.log(`[ScannerMixin] PNL result received for ${token.nama_token}/${token.nama_pair} via ${dexKey} - UI updated immediately`);
        },

        /**
         * Handler: Token complete
         */
        handleTokenComplete(data) {
            const { token, cexPrices, dexResults, pnlResults, progress } = data;

            // Gabungkan hasil PNL yang sudah ada (dari onPnlResult)
            const existingPnl = this.scanResults[token.id]?.pnl || {};

            // Update hasil final di memori
            const finalResult = {
                cex: cexPrices,
                dex: dexResults,
                pnl: { ...existingPnl, ...pnlResults },
                timestamp: Date.now()
            };
            this.scanResults[token.id] = finalResult;

            // Update progress
            this.scanProgress = progress;

            console.log(`[ScannerMixin] Token ${token.nama_token} completed (${progress.toFixed(1)}%)`);
        },

        /**
         * Handler: Batch complete
         */
        handleBatchComplete(data) {
            this.currentBatch = data.batchNumber;
            console.log(`[ScannerMixin] Batch ${data.batchNumber}/${data.totalBatches} completed`);
        },

        /**
         * Handler: Scan complete
         */
        handleScanComplete(data) {
            console.log('[ScannerMixin] Scan completed:', data);

            this.scanningInProgress = false;
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
            console.error('[ScannerMixin] Scan error:', error);
            this.scanningInProgress = false;
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
        },
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
