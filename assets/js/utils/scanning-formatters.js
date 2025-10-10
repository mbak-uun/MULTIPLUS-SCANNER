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
        minimumFractionDigits: 0,
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

    const ensureEntries = (dataEntries, fallbackPrice, forceUsdtDefaults = false) => {
      const cloneEntries = (entries) => entries.map(entry => ({
        ...entry
      }));

      if (Array.isArray(dataEntries) && dataEntries.length > 0) {
        const normalized = cloneEntries(dataEntries);
        if (forceUsdtDefaults && normalized.length < 3) {
          const defaultPrice = (fallbackPrice && fallbackPrice > 0) ? fallbackPrice : 1;
          while (normalized.length < 3) {
            normalized.push({ price: defaultPrice, quantity: 10000 });
          }
        }
        return normalized;
      }

      if (forceUsdtDefaults) {
        const defaultPrice = (fallbackPrice && fallbackPrice > 0) ? fallbackPrice : 1;
        return [
          { price: defaultPrice, quantity: 10000 },
          { price: defaultPrice, quantity: 10000 },
          { price: defaultPrice, quantity: 10000 }
        ];
      }

      if (!fallbackPrice || fallbackPrice <= 0) return [];
      return [{ price: fallbackPrice, quantity: 1 }];
    };

    const tokenData = cexPrices.token || {};
    const pairData = cexPrices.pair || {};

    const isPairUsdt = pairLabel === 'USDT';

    const tokenAsks = ensureEntries(tokenData.asks, tokenData.bestAsk);
    const tokenBids = ensureEntries(tokenData.bids, tokenData.bestBid);
    const pairAsks = ensureEntries(pairData.asks, pairData.bestAsk, isPairUsdt);
    const pairBids = ensureEntries(pairData.bids, pairData.bestBid, isPairUsdt);

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
      dexStatus = null,
      actionLink = '#',
      actionLabel = '',
      actionTitle = ''
    } = resolvedOptions || {};

    const formatUsd = (value) => {
      if (value === undefined || value === null || Number.isNaN(value)) return '$0.00';
      if (typeof Formatters !== 'undefined' && typeof Formatters.usd === 'function') {
        return Formatters.usd(value);
      }
      return `$${Number(value).toLocaleString('en-US', {
        minimumFractionDigits: 0,
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
        <span class="scanning-dex-name text-dark fw-bold">${sanitizedLabel}</span>
        <span class="scanning-dex-modal text-dark fw-bold">[${escapeHtml(modalText)}]</span>
      </div>`;
    };

    const statusNormalized = typeof dexStatus === 'string' ? dexStatus.toLowerCase() : null;
    const hasPnlData = !(pnlData === null || pnlData === undefined);
    const isErrorState = statusNormalized === 'error' || (hasPnlData && pnlData.error);
    const headerModalValue = hasPnlData && !isErrorState && pnlData?.modal != null
      ? pnlData.modal
      : modalUsd;

    // ERROR STATE: Tampilkan error icon
    if (isErrorState) {
      const errorTitle = hasPnlData
        ? (typeof pnlData.error === 'string'
            ? pnlData.error
            : (pnlData.errorMessage || 'DEX Error'))
        : 'Gagal memindai DEX';
      const escapedTitle = escapeHtml(errorTitle);
      return `<div title="${escapedTitle}">
        ${buildHeader(headerModalValue)}
        <div class="scanning-dex-icon">
          <i class="bi bi-exclamation-triangle-fill scanning-dex-error-icon"></i>
        </div>
        <div class="text-danger fw-semibold small mt-1">DEX Error</div>
      </div>`;
    }

    // LOADING STATE: Hanya tampilkan loading jika status = 'loading'
    // PERBAIKAN: Tidak lagi menggunakan isScanning global
    // Status 'loading' di-set per token per DEX saat DEX sedang di-fetch
    if (statusNormalized === 'loading') {
      return `<div class="scanning-dex-cell scanning-dex-cell--loading small text-center" title="Memindai...">
        ${buildHeader(headerModalValue)}
        <div class="scanning-dex-icon">
          <div class="spinner-border spinner-border-sm text-warning scanning-dex-spinner" role="status"></div>
        </div>
      </div>`;
    }

    // NO DATA STATE: Belum ada data dan belum scanning
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

    const details = pnlData?.details || {};
    const costs = pnlData?.costs || {};
    const pnlValue = Number(pnlData?.pnl || 0);

    // Buy price & sell price
    const buyPriceValue = details.buyPrice ?? details.buyPriceForPair ?? 0;
    const sellPriceValue = details.sellPrice ?? 0;
    const buyPrice = this.formatPriceWithZeros(buyPriceValue);
    const sellPrice = this.formatPriceWithZeros(sellPriceValue);

    // DEX Rate dalam USDT (harga per 1 token di DEX)
    const dexRateUsdt = Number(details.dexRateUsdt || 0);
    const dexRateFormatted = dexRateUsdt > 0 ? this.formatPriceWithZeros(dexRateUsdt) : '-';

    // Fees
    const feeWithdrawal = Number(costs.withdrawal || 0).toFixed(2);
    const feeSwapTotal = Number(costs.total || 0).toFixed(2);

    // PNL
    const pnlPrefix = pnlValue > 0 ? '+' : (pnlValue < 0 ? '-' : '');
    const pnlUsdLabel = `${pnlPrefix}${Math.abs(pnlValue).toFixed(2)}$`;
    const pnlColorClass = pnlValue > 0 ? 'text-success' : (pnlValue < 0 ? 'text-danger' : 'text-secondary');

    const buyPriceBlock = renderTradeValue(cexBuyLink, buyPrice, 'scanning-dex-price text-success fw-semibold');
    const dexRateBlock = renderTradeValue(dexLink, dexRateFormatted, 'scanning-dex-price text-primary fw-semibold');
    const sellPriceBlock = renderTradeValue(cexSellLink, sellPrice, 'scanning-dex-price text-danger fw-semibold');

    const modalRaw = (pnlData && pnlData.modal != null) ? pnlData.modal : modalUsd;

    const cellClass = pnlValue > 0
      ? 'scanning-dex-cell scanning-dex-cell--positive small text-center'
      : 'scanning-dex-cell small text-center';

    const actionLabelUpper = (actionLabel || '').toString().toUpperCase() || '--';
    const bracketedLabel = `[${actionLabelUpper}]`;
    const hasActionLink = actionLink && actionLink !== '#';
    const safeActionTitle = actionTitle ? escapeAttr(actionTitle) : '';
    const actionTitleAttr = safeActionTitle ? ` title="${safeActionTitle}"` : '';
    const actionControl = hasActionLink
      ? `<a href="${escapeAttr(actionLink)}" target="_blank" rel="noopener" class="scanning-dex-action-link"${actionTitleAttr}>${escapeHtml(bracketedLabel)}</a>`
      : `<span class="scanning-dex-action-link text-muted">${escapeHtml(bracketedLabel)}</span>`;

    return `
      <div class="${cellClass}">
        ${buildHeader(modalRaw)}
        <div class="scanning-dex-line">${buyPriceBlock}</div>
        <div class="scanning-dex-line">${dexRateBlock}</div>
        <div class="scanning-dex-line">${sellPriceBlock}</div>
        <hr class="scanning-dex-divider my-1">
        <div class="scanning-dex-meta text-danger fw-semibold small">
          <span>FeeWD: ${feeWithdrawal}$</span>
          ${actionControl}
        </div>
        <div class="scanning-dex-meta text-danger fw-semibold small">
          <span>FeeSwap: ${feeSwapTotal}$</span>
        </div>
        <div class="scanning-dex-pnl-simple ${pnlColorClass} fw-semibold">PNL: ${pnlUsdLabel}</div>
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
