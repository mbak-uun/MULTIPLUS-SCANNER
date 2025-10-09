/**
 * ===================================================================================
 * Scanning Display Formatters
 * ===================================================================================
 *
 * Modul khusus untuk format tampilan hasil scanning
 * Terpisah dari formatters.js yang lebih general
 */

const ScanningFormatters = {
  /**
   * Format harga dengan zero-counting notation
   * Contoh: 0.006400 → 0.{2}6400$
   */
  formatPriceWithZeros(price) {
    if (!price || price === 0) return '0.00$';

    const priceStr = price.toString();
    const parts = priceStr.split('.');

    if (parts.length === 1) return `${price.toFixed(2)}$`;

    const decimal = parts[1];
    let zeroCount = 0;

    for (let i = 0; i < decimal.length; i++) {
      if (decimal[i] === '0') {
        zeroCount++;
      } else {
        break;
      }
    }

    if (zeroCount >= 2) {
      const significantDigits = decimal.substring(zeroCount, zeroCount + 4);
      return `0.{${zeroCount}}${significantDigits}$`;
    }

    return `${price.toFixed(8).replace(/\.?0+$/, '')}$`;
  },

  /**
   * Format orderbook dengan depth levels (cumulative volume)
   * @param {object} orderbookData - { bids: [...], asks: [...] }
   * @param {string} type - 'bids' atau 'asks'
   * @param {number} levels - Jumlah level yang ditampilkan (default: 3)
   */
  formatOrderbookDepth(orderbookData, type = 'bids', levels = 3) {
    if (!orderbookData || !orderbookData[type]) {
      return '<div class="text-muted small">-</div>';
    }

    const data = orderbookData[type];
    let html = '';
    let cumulative = 0;

    const displayLevels = Math.min(levels, data.length);

    for (let i = 0; i < displayLevels; i++) {
      const item = data[i];
      cumulative += item.quantity;

      const price = this.formatPriceWithZeros(item.price);
      const colorClass = type === 'bids' ? 'text-success' : 'text-danger';

      html += `<div class="${colorClass} small">${price} <span class="text-muted">- ${cumulative.toFixed(2)}$</span></div>`;
    }

    return html;
  },

  /**
   * Format orderbook cell lengkap dengan depth
   * REFACTORED: Nama CEX di atas harga, menggunakan config untuk nama CEX
   */
  formatOrderbookCell(cexPrices, side, options = {}) {
    const tokenInfo = options.token || {};
    const tokenLabel = (tokenInfo.nama_token || tokenInfo.cex_ticker_token || tokenInfo.from || 'TOKEN').toString().toUpperCase();
    const pairLabel = (tokenInfo.nama_pair || tokenInfo.cex_ticker_pair || tokenInfo.to || 'PAIR').toString().toUpperCase();

    // Ambil nama CEX dari options (yang sudah menggunakan config)
    const cexName = options.cexName || 'CEX';

    if (!cexPrices) {
      return `<div class="text-center">
        <div class="fw-bold text-uppercase small mb-1" style="color: var(--brand);">${cexName} 🔒</div>
      </div>`;
    }

    const formatUsdTrailing = (value) => {
      if (value === undefined || value === null || Number.isNaN(value)) return '-';
      const formatter = Number(value);
      return `${formatter.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}$`;
    };

    const buildLines = (entries, colorClass) => {
      if (!entries || entries.length === 0) {
        return `<div class="small text-muted">-</div>`;
      }

      const limit = Math.min(3, entries.length);
      let html = '';

      for (let i = 0; i < limit; i++) {
        const entry = entries[i];
        const priceFormatted = this.formatPriceWithZeros(entry.price);
        const volumeFormatted = formatUsdTrailing(entry.price * entry.quantity);
        html += `<div class="${colorClass} fw-bold">${priceFormatted} : ${volumeFormatted}</div>`;
      }

      return html;
    };

    const ensureEntries = (dataEntries, fallbackPrice) => {
      if (dataEntries && dataEntries.length > 0) return dataEntries;
      if (!fallbackPrice || fallbackPrice <= 0) return [];
      return [{ price: fallbackPrice, quantity: 1 }];
    };

    const tokenData = cexPrices.token || {};
    const pairData = cexPrices.pair || {};

    const tokenAsks = ensureEntries(tokenData.asks, tokenData.bestAsk);
    const tokenBids = ensureEntries(tokenData.bids, tokenData.bestBid);
    const pairAsks = ensureEntries(pairData.asks, pairData.bestAsk);
    const pairBids = ensureEntries(pairData.bids, pairData.bestBid);

    let topHtml = '';
    let bottomHtml = '';

    if (side === 'left') {
      topHtml = buildLines(tokenAsks, 'text-success');
      bottomHtml = buildLines(pairBids, 'text-danger');
    } else {
      topHtml = buildLines(pairAsks, 'text-success');
      bottomHtml = buildLines(tokenBids, 'text-danger');
    }

    // REFACTORED: Nama CEX di atas, kemudian harga (tanpa background kotak)
    return `<div class="small text-center">
      <div class="fw-bold text-uppercase small mb-2" style="color: var(--brand);">${cexName}</div>
      ${topHtml}
      <div class="text-primary fw-bold my-1">${tokenLabel} -> ${pairLabel}</div>
      ${bottomHtml}
    </div>`;
  },

  /**
   * Format DEX cell dengan semua data detail
   */
  formatDexCell(pnlData, token, direction, options = {}) {
    let resolvedOptions = options;
    if (typeof options === 'number') {
      resolvedOptions = { usdtRate: options };
    }

    const {
      usdtRate = 15800,
      modalUsd = 0,
      isScanning = false,
      cexBuyLink = '#',
      cexSellLink = '#',
      dexLink = '#',
      dexLabel = '',
      dexKey = '',
      dexStatus = null
    } = resolvedOptions || {};

    const formatUsd = (value) => {
      if (value === undefined || value === null || Number.isNaN(value)) return '$0.00';
      if (typeof Formatters !== 'undefined' && typeof Formatters.usd === 'function') {
        return Formatters.usd(value);
      }
      return `$${Number(value).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
    };

    const formatModalValue = (value) => {
      if (value === undefined || value === null || Number.isNaN(value)) return '-';
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return '-';
      const rounded = Math.round(numeric);
      return `$${rounded.toLocaleString('en-US', { useGrouping: false })}`;
    };

    const escapeHtml = (text) => {
      if (text === undefined || text === null) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    const escapeAttr = (text) => escapeHtml(text);

    const renderTradeValue = (url, text, classNames) => {
      const safeText = escapeHtml(text);
      if (!url || url === '#') {
        return `<span class="${classNames}">${safeText}</span>`;
      }
      return `<a href="${escapeAttr(url)}" target="_blank" rel="noopener" class="text-decoration-none ${classNames}">${safeText}</a>`;
    };

    const buildHeader = (modalValue) => {
      const labelSource = dexLabel || dexKey || 'DEX';
      const sanitizedLabel = escapeHtml(String(labelSource).toUpperCase());
      const numericModal = Number(modalValue);
      const hasModal = Number.isFinite(numericModal) && numericModal > 0;
      const modalText = hasModal ? formatModalValue(numericModal) : '-';
      return `<div class="scanning-dex-header">
        <span class="scanning-dex-name">${sanitizedLabel}</span>
        <span class="scanning-dex-modal">[${escapeHtml(modalText)}]</span>
      </div>`;
    };

    const statusNormalized = typeof dexStatus === 'string' ? dexStatus.toLowerCase() : null;
    const hasPnlData = !(pnlData === null || pnlData === undefined);
    const isErrorState = statusNormalized === 'error' || (hasPnlData && pnlData.error);
    const headerModalValue = hasPnlData && !isErrorState && pnlData?.modal != null
      ? pnlData.modal
      : modalUsd;

    if (isErrorState) {
      const errorTitle = hasPnlData
        ? (typeof pnlData.error === 'string'
            ? pnlData.error
            : (pnlData.errorMessage || 'DEX Error'))
        : 'Gagal memindai DEX';
      const escapedTitle = escapeHtml(errorTitle);
      return `<div   title="${escapedTitle}">
        ${buildHeader(headerModalValue)}
        <div class="scanning-dex-icon">
          <i class="bi bi-exclamation-triangle-fill scanning-dex-error-icon"></i>
        </div>
        <div class="text-danger fw-semibold small mt-1">DEX Error</div>
      </div>`;
    }

    if (statusNormalized === 'loading' || (!hasPnlData && isScanning)) {
      return `<div class="scanning-dex-cell scanning-dex-cell--loading small text-center" title="Memindai...">
        ${buildHeader(headerModalValue)}
        <div class="scanning-dex-icon">
          <div class="spinner-border spinner-border-sm text-warning scanning-dex-spinner" role="status"></div>
        </div>
      </div>`;
    }

    if (!hasPnlData) {
      return `<div class="scanning-dex-cell text-center">
        ${buildHeader(headerModalValue)}
        <div class="text-muted small" title="Tekan tombol START untuk memulai pemindaian">🔒</div>
      </div>`;
    }

    // Error state sudah ditangani di atas, tetapi pastikan nilai error diabaikan
    if (pnlData.error) {
      const errorTitle = typeof pnlData.error === 'string'
        ? pnlData.error
        : (pnlData.errorMessage || 'DEX Error');
      const escapedTitle = escapeHtml(errorTitle);
      return `<div class="scanning-dex-cell scanning-dex-cell--error small text-center" title="${escapedTitle}">
        ${buildHeader(headerModalValue)}
        <div class="scanning-dex-icon">
          <i class="bi bi-exclamation-triangle-fill scanning-dex-error-icon"></i>
        </div>
        <div class="text-danger fw-semibold small mt-1">DEX Error</div>
      </div>`;
    }

    const { details, costs, pnl } = pnlData;

    // Buy price & sell price
    const buyPrice = this.formatPriceWithZeros(details.buyPrice || details.buyPriceForPair);
    const sellPrice = this.formatPriceWithZeros(details.sellPrice);

    // Output amount (jumlah token/pair yang didapat dari swap)
    const outputAmount = direction === 'CEXtoDEX'
      ? details.pairReceived
      : details.tokenReceived;
    const outputAmountFormatted = outputAmount ? `${outputAmount.toFixed(4)}$` : '-';

    // Fees
    const feeWD = costs.withdrawal.toFixed(2);
    const allFee = costs.total.toFixed(2);
    const gasFee = costs.gasDex.toFixed(2);

    // PNL
    const pnlIdr = (Math.abs(pnl) * usdtRate / 1000).toFixed(2); // Dalam ribuan
    const pnlPrefix = pnl > 0 ? '+' : (pnl < 0 ? '-' : '');
    const pnlUsdAbs = Math.abs(pnl).toFixed(2);

    const buyPriceBlock = renderTradeValue(cexBuyLink, buyPrice, 'scanning-dex-value text-success d-block fw-semibold');
    const outputBlock = renderTradeValue(dexLink, outputAmountFormatted, 'text-primary scanning-dex-value d-block fw-semibold');
    const sellPriceBlock = renderTradeValue(cexSellLink, sellPrice, 'scanning-dex-value text-danger d-block fw-semibold');

    // Tampilkan modal jika ada
    const modalRaw = (pnlData && pnlData.modal != null) ? pnlData.modal : modalUsd;

    const pnlClass = pnl > 0
      ? 'scanning-dex-pnl scanning-dex-pnl--positive'
      : (pnl < 0 ? 'scanning-dex-pnl scanning-dex-pnl--negative' : 'scanning-dex-pnl scanning-dex-pnl--neutral');

    const cellClass = pnl > 0
      ? 'scanning-dex-cell scanning-dex-cell--positive small text-center'
      : 'scanning-dex-cell small text-center';

    const pnlUsdLabel = pnlPrefix ? `${pnlPrefix}${pnlUsdAbs}$` : `${pnlUsdAbs}$`;
    const pnlIdrLabel = pnlPrefix ? `${pnlPrefix}${pnlIdr}$` : `${pnlIdr}$`;

    return `
      <div class="${cellClass}">
        ${buildHeader(modalRaw)}
        <div class="scanning-dex-line">${buyPriceBlock}</div>
        <div class="scanning-dex-line">${outputBlock}</div>
        <div class="scanning-dex-line">${sellPriceBlock}</div>
        <div class="scanning-dex-line">
          <span class="text-info fw-semibold">FeeWD:</span>
          <span class="text-info fw-semibold ms-1">${feeWD}$</span>
        </div>
        <div class="scanning-dex-line">
          <span class="text-danger fw-semibold">ALL: ${allFee}$</span>
          <span class="text-primary fw-semibold ms-2">SW: ${gasFee}$</span>
        </div>
        <div class="${pnlClass}">GT: ${pnlUsdLabel} | PNL: ${pnlIdrLabel}</div>
      </div>
    `;
  },

  /**
   * Format token direction arrow
   */
  formatDirection(token, direction) {
    if (direction === 'CEXtoDEX') {
      return `${token.nama_token} → ${token.nama_pair}`;
    } else {
      return `${token.nama_pair} → ${token.nama_token}`;
    }
  },

  /**
   * Format row number badge
   */
  formatRowNumber(index, cexName) {
    return `<span class="badge bg-success me-1">✅ #${index + 1}</span> <span class="badge bg-warning text-dark">${cexName}</span>`;
  },

  /**
   * Format volume dengan satuan yang sesuai
   */
  formatVolume(volume) {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(2)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(2)}K`;
    }
    return volume.toFixed(2);
  }
};

// Export untuk digunakan di window global
if (typeof window !== 'undefined') {
  window.ScanningFormatters = ScanningFormatters;
}
