// assets/js/mixins/telegram.js

const telegramMixin = {
  methods: {
    async sendTelegramMessage(message, credentials) {
      if (!credentials || !credentials.botToken || !credentials.chatId) {
        console.error('Telegram credentials (botToken, chatId) are incomplete.');
        this.showToast('Telegram credentials are incomplete.', 'danger');
        return false;
      }
      const url = `https://api.telegram.org/bot${credentials.botToken}/sendMessage`;
      const params = new URLSearchParams({ chat_id: credentials.chatId, text: message, parse_mode: 'Markdown' });
      try {
        const response = await fetch(`${url}?${params}`);
        const data = await response.json();
        return data.ok;
      } catch (error) {
        console.error('Failed to send Telegram message:', error);
        return false;
      }
    }
  }
};