// assets/js/mixins/utilities.js

const utilitiesMixin = {
  methods: {
    // Utility untuk copy text ke clipboard
    copyToClipboard(text, label = 'Text') {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
        this.showToast(`${label} disalin ke clipboard!`, 'success');
      } else {
        // console.warn('Clipboard API tidak tersedia');
        this.showToast('Gagal menyalin ke clipboard', 'danger');
      }
    },

    // Utility untuk format waktu - Menggunakan Formatters (centralized)
    formatDateTime(date, format = 'time') {
      if (!date) return '-';

      if (format === 'time') {
        return Formatters.time(date);
      } else if (format === 'date') {
        return Formatters.date(date);
      } else if (format === 'datetime') {
        return Formatters.datetime(date);
      }

      return Formatters.datetime(date);
    },

    // Utility untuk format bytes - Menggunakan Formatters (centralized)
    formatBytes(bytes, decimals = 2) {
      return Formatters.fileSize(bytes, decimals);
    }
  }
};
