/**
 * Logger Utility - Conditional Logging untuk Production
 *
 * Purpose:
 * - Menyediakan logging methods yang bisa di-disable di production
 * - Mempertahankan console.error untuk critical errors
 * - Memudahkan debugging di development
 *
 * Usage:
 * - Development: Semua log tampil
 * - Production: Hanya error yang tampil
 *
 * Replace:
 * console.log(...) → logger.log(...)
 * console.warn(...) → logger.warn(...)
 * console.error(...) → logger.error(...) (atau tetap console.error)
 */

const logger = {
  /**
   * Check if running in development mode
   * Deteksi berdasarkan:
   * 1. URL (localhost, 127.0.0.1, atau file://)
   * 2. localStorage flag 'debugMode'
   */
  isDevelopment() {
    // Check URL
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' ||
                       hostname === '127.0.0.1' ||
                       hostname === '' ||
                       hostname.startsWith('192.168.') ||
                       window.location.protocol === 'file:';

    // Check localStorage flag
    const debugMode = localStorage.getItem('debugMode') === 'true';

    return isLocalhost || debugMode;
  },

  /**
   * Log method - Only in development
   */
  log(...args) {
    if (this.isDevelopment()) {
      console.log(...args);
    }
  },

  /**
   * Info method - Only in development
   */
  info(...args) {
    if (this.isDevelopment()) {
      console.info(...args);
    }
  },

  /**
   * Warn method - Only in development
   */
  warn(...args) {
    if (this.isDevelopment()) {
      console.warn(...args);
    }
  },

  /**
   * Error method - ALWAYS logged (even in production)
   * Critical errors harus selalu di-log untuk debugging production
   */
  error(...args) {
    console.error(...args);
  },

  /**
   * Table method - Only in development
   */
  table(data, columns) {
    if (this.isDevelopment()) {
      console.table(data, columns);
    }
  },

  /**
   * Group methods - Only in development
   */
  group(...args) {
    if (this.isDevelopment()) {
      console.group(...args);
    }
  },

  groupCollapsed(...args) {
    if (this.isDevelopment()) {
      console.groupCollapsed(...args);
    }
  },

  groupEnd() {
    if (this.isDevelopment()) {
      console.groupEnd();
    }
  },

  /**
   * Time methods - Only in development
   */
  time(label) {
    if (this.isDevelopment()) {
      console.time(label);
    }
  },

  timeEnd(label) {
    if (this.isDevelopment()) {
      console.timeEnd(label);
    }
  },

  /**
   * Debug method - Only in development with explicit debug flag
   */
  debug(...args) {
    if (this.isDevelopment() && localStorage.getItem('debugMode') === 'true') {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * Enable debug mode manually (for production debugging)
   * Usage di console: logger.enableDebug()
   */
  enableDebug() {
    localStorage.setItem('debugMode', 'true');
    console.log('✅ Debug mode enabled. Reload page to see logs.');
  },

  /**
   * Disable debug mode
   * Usage di console: logger.disableDebug()
   */
  disableDebug() {
    localStorage.removeItem('debugMode');
    console.log('❌ Debug mode disabled.');
  }
};

// Export untuk window global
if (typeof window !== 'undefined') {
  window.logger = logger;
}
