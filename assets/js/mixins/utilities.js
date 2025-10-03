// assets/js/mixins/utilities.js

const utilitiesMixin = {
  methods: {
    // Utility untuk copy text ke clipboard
    copyToClipboard(text, label = 'Text') {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
        this.showToast(`${label} disalin ke clipboard!`, 'success');
      } else {
        console.warn('Clipboard API tidak tersedia');
        this.showToast('Gagal menyalin ke clipboard', 'danger');
      }
      console.log('Copied to clipboard:', text);
    },

    // Utility untuk format waktu
    formatDateTime(date, format = 'time') {
      if (!date) return '-';
      const dateObj = new Date(date);

      if (format === 'time') {
        return dateObj.toLocaleTimeString();
      } else if (format === 'date') {
        return dateObj.toLocaleDateString();
      } else if (format === 'datetime') {
        return dateObj.toLocaleString();
      }

      return dateObj.toLocaleString();
    },

    // Utility untuk format bytes
    formatBytes(bytes, decimals = 2) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
  }
};
