/**
 * ===================================================================================
 * Telegram Service
 * ===================================================================================
 *
 * Tanggung Jawab:
 * - Mengirim pesan status scanner ke grup Telegram
 * - Mengirim sinyal profitable ke grup Telegram
 * - Mengelola rate limiting untuk Telegram API
 */
class TelegramService {
    constructor(credentials) {
        this.credentials = credentials; // { botToken, chatId, appName }
        this.appName = credentials.appName || 'MULTIPLUS-SCANNER'; // Fallback
        // REVISI: Langsung gunakan window.Http yang sudah global
        this.Http = window.Http;
        if (!this.Http) {
            throw new Error('Http module is required for TelegramService');
        }
        this.messageQueue = [];
        this.isSending = false;
        this.delayBetweenMessages = 1000; // 1 detik delay antar pesan
        this.userName = 'SCANNER'; // Default user name
    }

    /**
     * Kirim status scanner (ONLINE, OFFLINE, dll)
     * Format seperti aplikasi lama: #MULTICHECKER USER: [STATUS]
     */
    async sendStatus(status, user = null) {
        // REVISI: Mengubah format pesan menjadi HTML untuk penandaan tebal.
        const userName = user || this.userName;
        const message = `<b>#${this.appName.toUpperCase()}</b>\nUSER: <b>${userName}</b> [<b>${status.toUpperCase()}</b>]`;
        // Mengirim dengan parseMode 'HTML'
        return this._queueMessage(message, 'HTML');
    }

    /**
     * Kirim sinyal profitable
     */
    async sendSignal(message, parseMode = 'HTML') {
        return this._queueMessage(message, parseMode);
    }

    /**
     * Set user name untuk status messages
     */
    setUserName(userName) {
        this.userName = userName;
    }

    /**
     * Menambahkan pesan ke queue
     * @private
     */
    async _queueMessage(message, parseMode = 'HTML') {
        this.messageQueue.push({ message, parseMode });

        if (!this.isSending) {
            await this._processQueue();
        }
    }

    /**
     * Memproses queue pesan
     * @private
     */
    async _processQueue() {
        if (this.messageQueue.length === 0) {
            this.isSending = false;
            return;
        }

        this.isSending = true;

        while (this.messageQueue.length > 0) {
            const { message, parseMode } = this.messageQueue.shift();
            await this._sendMessage(message, parseMode);

            // Delay sebelum pesan berikutnya
            if (this.messageQueue.length > 0) {
                await this._delay(this.delayBetweenMessages);
            }
        }

        this.isSending = false;
    }

    /**
     * Kirim satu pesan ke Telegram
     * @private
     */
    async _sendMessage(message, parseMode = 'HTML') {
        if (!this.credentials || !this.credentials.botToken || !this.credentials.chatId) {
            console.warn('[TelegramService] Credentials not configured');
            return false;
        }

        const url = `https://api.telegram.org/bot${this.credentials.botToken}/sendMessage`;

        const params = new URLSearchParams({
            chat_id: this.credentials.chatId,
            text: message,
            parse_mode: parseMode, // 'HTML' atau 'Markdown'
            disable_web_page_preview: true  // Seperti di aplikasi lama
        });

        try {
            const data = await this.Http.get(`${url}?${params}`, { responseType: 'json' });

            if (data.ok) {
                console.log('[TelegramService] Message sent successfully');
                return true;
            } else {
                console.error('[TelegramService] Failed to send message:', data);
                return false;
            }

        } catch (error) {
            console.error('[TelegramService] Error sending message:', error);
            return false;
        }
    }

    /**
     * Update credentials
     */
    updateCredentials(credentials) {
        this.credentials = credentials;
    }

    /**
     * Delay helper
     * @private
     */
    async _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Clear message queue
     */
    clearQueue() {
        this.messageQueue = [];
    }

    /**
     * Get queue status
     */
    getQueueStatus() {
        return {
            queueLength: this.messageQueue.length,
            isSending: this.isSending
        };
    }
}

// Export untuk digunakan di window global
if (typeof window !== 'undefined') {
    window.TelegramService = TelegramService;
}
