/**
 * ===================================================================================
 * CEX Data Fetcher Module (checkWalletExchanger.js)
 * ===================================================================================
 *
 * Tanggung Jawab:
 * - Mengambil data lengkap dari berbagai API CEX.
 * - Menyediakan fungsi untuk mendapatkan:
 *   1. Daftar koin beserta status deposit/withdraw dan fee.
 *   2. Status perdagangan (trading status).
 *   3. Harga terkini.
 * - Mengisolasi semua logika API call ke dalam satu file agar mudah dikelola.
 *
 * Catatan Endpoint & Kredensial (per 2024 – detail per CEX):
 * - **BINANCE**
 *   • Proxy: ya (coin list) menggunakan `config.PROXY.PREFIX`.
 *   • Coin list: `GET https://api-gcp.binance.com/sapi/v1/capital/config/getall` – perlu `timestamp`, signature `HmacSHA256(${timestamp})`, header `X-MBX-ApiKey`.
 *   • Field dipakai: `networkList[].network` (chain), `depositEnable`, `withdrawEnable`, `contractAddress`, `withdrawFee`.
 *   • Trade status: `GET https://api.binance.com/api/v3/exchangeInfo` – filter `symbols[].status === 'TRADING' && quoteAsset === 'USDT'`.
 *   • Harga: `GET https://api.binance.com/api/v3/ticker/price` – gunakan `symbol` & `price`.
 *
 * - **MEXC**
 *   • Proxy: ya (coin list).
 *   • Coin list: `GET https://api.mexc.com/api/v3/capital/config/getall` – request `timestamp`, signature HMAC SHA256, header `X-MEXC-APIKEY`.
 *   • Field dipakai: `networkList[].network`, `depositEnable`, `withdrawEnable`, `contract`, `withdrawFee`.
 *   • Trade status: `GET https://api.mexc.com/api/v3/exchangeInfo` – pilih pair dengan status mengandung "EN" dan quote `USDT/USD`.
 *   • Harga: `GET https://api.mexc.com/api/v3/ticker/price` – gunakan `symbol`, `price`.
 *
 * - **GATE**
 *   • Proxy: ya untuk semua endpoint.
 *   • Coin detail: `GET https://api.gateio.ws/api/v4/spot/currencies` – gunakan `chains[].name`, `deposit_disabled`, `withdraw_disabled`, `addr`.
 *   • Trade status: `GET https://api.gateio.ws/api/v4/spot/currency_pairs` – ambil `trade_status !== 'disabled'` dengan quote `USDT` untuk tab trading.
 *   • Harga: `GET https://api.gateio.ws/api/v4/spot/tickers` – gunakan `currency_pair`, `last`.
 *   • Catatan: biaya withdraw (`feeWD`) default diambil dari `withdraw_fix_on_chains` (jika tersedia).
 *
 * - **KUCOIN**
 *   • Proxy: ya.
 *   • Coin list: `GET https://api.kucoin.com/api/v3/currencies` – gunakan `chains[].chainName`, `isDepositEnabled`, `isWithdrawEnabled`, `contractAddress`, `withdrawalMinFee`.
 *   • Trade status: `GET https://api.kucoin.com/api/v2/symbols` – filter `enableTrading === true` dengan quote `USDT`.
 *   • Harga: `GET https://api.kucoin.com/api/v1/market/allTickers` – gunakan `data.ticker[].symbol`, `last`.
 *
 * - **BITGET**
 *   • Proxy: tidak (semua endpoint langsung).
 *   • Coin list: `GET https://api.bitget.com/api/v2/spot/public/coins` – gunakan `chains[].chain`, `rechargeable`, `withdrawable`, `contractAddress`, `withdrawFee`.
 *   • Trade status: `GET https://api.bitget.com/api/v2/spot/public/symbols` – filter `status !== 'offline'` dan quote `USDT`.
 *   • Harga: `GET https://api.bitget.com/api/v2/spot/market/tickers` – gunakan `symbol`, `lastPr`.
 *
 * - **BYBIT**
 *   • Proxy: ya untuk coin list.
 *   • Coin list: `GET https://api.bybit.com/v5/asset/coin/query-info` – header harus memuat `X-BAPI-API-KEY`, `X-BAPI-SIGN`, `X-BAPI-TIMESTAMP`, `X-BAPI-RECV-WINDOW`, `X-BAPI-SIGN-TYPE`; signature dibangun dari `${timestamp}${apiKey}${recvWindow}${queryString}`.
 *   • Field dipakai: `chains[].chain`/`chainType` (chain alias), `contractAddress`, `withdrawFee`/`withdrawMinFee`, status `chainDeposit`, `chainWithdraw`, `depositable`, `withdrawable`.
 *   • Trade status: `GET https://api.bybit.com/v5/market/instruments-info?category=spot` – pilih item dengan `status === 'trading'` dan simbol diakhiri `USDT`.
 *   • Harga: `GET https://api.bybit.com/v5/market/tickers?category=spot` – gunakan `symbol`, `lastPrice`.
 *
 * - **INDODAX**
 *   • Proxy: ya untuk semua endpoint.
 *   • Coin list: `POST https://indodax.com/tapi` – body `method=getInfo&timestamp=${ts}&recvWindow=${rw}`; header `Key` dan `Sign` (HMAC SHA512 dari body). Field dipakai: `return.network` (daftar jaringan). SC diambil dari cache lokal (IndexedDB) via `SyncStorage` karena API tidak mengembalikan langsung.
 *   • Trade status: `GET https://indodax.com/api/pairs` – simbol `xxx_idr` dikonversi ke `XXX`.
 *   • Harga: `GET https://indodax.com/api/ticker_all` – gunakan `tickers[key].last` untuk `*_idr`.
 *
 * - **Catatan Umum**
 *   • Prefix proxy default: `config.PROXY.PREFIX` atau fallback `https://proxykanan.awokawok.workers.dev/?`; Bitget endpoints sengaja dilewati langsung karena stabil tanpa proxy.
 *   • Pencocokan chain memanfaatkan `SYNONYMS`, `NAMA_CHAIN`, `NAMA_PENDEK`; semuanya dinormalisasi via `_normalizeText`.
 *   • Status deposit/withdraw dikonversi ke boolean oleh `_toBooleanStatus` agar string seperti "true" / "1" / "enabled" jadi konsisten.
 *   • Harga & status trade diambil lewat `fetchPrices` dan `fetchTradeStatus`, kemudian digabungkan pada tab Sync/Wallet supaya daftar koin punya referensi harga & status trading terkini.
 *
 * Cara Penggunaan:
 * 1. Import kelas: `import { CheckWalletExchanger } from './modules/wallet/checkWalletExchanger.js';`
 * 2. Buat instance: `const cexFetcher = new CheckWalletExchanger(window.CEX_SECRETS, window.CONFIG_APPS);`
 * 3. Panggil method: `const binanceCoins = await cexFetcher.fetchCoinList('BINANCE', 'bsc');`
 */

class CheckWalletExchanger {
  constructor(secrets, config, httpModule) {
    if (!secrets || !config) {
      throw new Error('CEX_SECRETS and CONFIG_APPS must be provided.');
    }
    if (!httpModule) {
      throw new Error('Http module is required. Pastikan assets/js/mixins/Http.js dimuat.');
    }
    this.Http = httpModule;
    this.secrets = secrets;
    this.config = config;
    this.proxyPrefix = config.PROXY?.PREFIX || 'https://proxykanan.awokawok.workers.dev/?';
  }

  /**
   * Helper untuk menambahkan prefix proxy ke URL.
   * @param {string} url - URL asli.
   * @returns {string} URL dengan proxy.
   */
  _prox(url) {
    return `${this.proxyPrefix}${url}`;
  }

  /**
   * Helper untuk mencocokkan nama jaringan dari API CEX dengan nama chain di aplikasi.
   * @param {string} chainKey - Nama chain di aplikasi (e.g., 'bsc').
   * @param {string} networkName - Nama jaringan dari API CEX.
   * @returns {boolean} - True jika cocok.
   */
  _matchesCex(chainKey, networkName) {
    const aliases = this._getChainAliases(chainKey);
    if (!aliases.length) return false;
    const normalizedNetwork = this._normalizeText(networkName);
    if (!normalizedNetwork) return false;
    return aliases.some(alias => normalizedNetwork.includes(alias));
  }

  _getChainAliases(chainKey) {
    if (!this._chainAliasesCache) {
      this._chainAliasesCache = new Map();
    }
    if (this._chainAliasesCache.has(chainKey)) {
      return this._chainAliasesCache.get(chainKey);
    }
    const cfg = this.config.CHAINS?.[chainKey];
    if (!cfg) {
      this._chainAliasesCache.set(chainKey, []);
      return [];
    }

    const mainName = cfg.NAMA_CHAIN || cfg.Nama_Chain || cfg.nama_chain || cfg.name;
    const shortName = cfg.NAMA_PENDEK || cfg.Nama_Pendek || cfg.nama_pendek || cfg.code;
    const synonyms = Array.isArray(cfg.SYNONYMS) ? cfg.SYNONYMS : [];

    const rawAliases = [chainKey, mainName, shortName, ...(synonyms || [])];
    const aliases = rawAliases
      .filter(Boolean)
      .map(item => this._normalizeText(item))
      .filter(Boolean)
      .filter((item, idx, arr) => arr.indexOf(item) === idx);

    this._chainAliasesCache.set(chainKey, aliases);
    return aliases;
  }

  _normalizeText(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\s_\-]+/g, '')
      .replace(/[()]/g, '')
      .trim();
  }

  _toBooleanStatus(value) {
    if (typeof value === 'boolean') return value;
    if (value === null || value === undefined) return false;
    const text = this._normalizeText(value);
    if (!text) return false;

    const truthy = new Set(['1', 'true', 'yes', 'on', 'aktif', 'active', 'enabled', 'enable', 'available', 'allowed', 'live', 'trading']);
    const falsy = new Set(['0', 'false', 'no', 'off', 'nonaktif', 'inactive', 'disabled', 'disable', 'suspend', 'suspended', 'forbid', 'forbidden', 'offline']);

    if (truthy.has(text)) return true;
    if (falsy.has(text)) return false;

    if (!Number.isNaN(Number(text))) {
      return Number(text) !== 0;
    }

    return Boolean(value);
  }

  /**
   * Membuat signature untuk API Bybit V5.
   */
  _createBybitSignature({ ts, apiKey, recvWindow, queryString, secret }) {
    const preSign = `${ts}${apiKey}${recvWindow}${queryString}`;
    return CryptoJS.HmacSHA256(preSign, secret).toString();
  }

  /**
   * Mengambil daftar koin lengkap (status depo/wd, fee) dari satu CEX.
   * @param {string} cex - Nama CEX (e.g., 'BINANCE', 'GATE').
   * @param {string} chainKey - Nama chain (e.g., 'bsc').
   * @returns {Promise<Array>} - Array of coin objects.
   */
  async fetchCoinList(cex, chainKey) {
    const upperCex = String(cex || '').toUpperCase();
    const fetcher = this._getCoinListFetcher(upperCex);

    if (!fetcher) {
      console.warn(`[CheckWalletExchanger] No fetcher found for CEX: ${upperCex}`);
      return [];
    }

    try {
      return await fetcher(chainKey);
    } catch (error) {
      console.error(`[CheckWalletExchanger] Failed to fetch coin list for ${upperCex} on ${chainKey}:`, error);
      throw new Error(`Failed to fetch ${upperCex}: ${error.message}`);
    }
  }

  /**
   * Mengambil status trading untuk CEX yang dipilih.
   * @param {Array<string>} selectedCex - e.g., ['BINANCE', 'GATE'].
   * @returns {Promise<Function>} - Sebuah fungsi `hasTrade(cex, symbol)` untuk memeriksa status.
   */
  async fetchTradeStatus(selectedCex = []) {
    const tradeSources = {
      BINANCE: { url: 'https://api.binance.com/api/v3/exchangeInfo', useProxy: false, parse: r => new Set((r?.symbols || []).filter(it => it.status === 'TRADING' && it.quoteAsset === 'USDT').map(it => String(it.baseAsset || '').toUpperCase())) },
      MEXC: { url: 'https://api.mexc.com/api/v3/exchangeInfo', useProxy: true, parse: r => new Set((r?.symbols || []).filter(it => String(it.status || '').toUpperCase().includes('EN')).filter(it => (it.quoteAsset === 'USDT' || it.quoteAsset === 'USD')).map(it => String(it.baseAsset || '').toUpperCase())) },
      GATE: { url: 'https://api.gateio.ws/api/v4/spot/currency_pairs', useProxy: true, parse: r => new Set((r || []).filter(it => (String(it.quote || '').toUpperCase() === 'USDT') && ((it.trade_status || '').toLowerCase() !== 'disabled')).map(it => String(it.base || '').toUpperCase())) },
      KUCOIN: { url: 'https://api.kucoin.com/api/v2/symbols', useProxy: true, parse: r => new Set((r?.data || []).filter(it => it.enableTrading === true && String(it.quoteCurrency || '').toUpperCase() === 'USDT').map(it => String(it.baseCurrency || '').toUpperCase())) },
      OKX: { url: 'https://www.okx.com/api/v5/public/instruments?instType=SPOT', useProxy: true, parse: r => new Set((r?.data || []).filter(it => String(it.state || '').toLowerCase() === 'live').map(it => (it.instId || '').split('-')[0].toUpperCase())) },
      BITGET: { url: 'https://api.bitget.com/api/v2/spot/public/symbols', useProxy: false, parse: r => new Set((r?.data || []).filter(it => (String(it.status || '').toLowerCase() !== 'offline') && String(it.quoteCoin || '').toUpperCase() === 'USDT').map(it => String(it.baseCoin || '').toUpperCase())) },
      BYBIT: { url: 'https://api.bybit.com/v5/market/instruments-info?category=spot', useProxy: false, parse: r => new Set(((r?.result?.list) || []).filter(it => String(it.status || '').toLowerCase() === 'trading').map(it => { const m = /^([A-Z0-9]+)USDT$/.exec(String(it.symbol || '')); return m ? m[1].toUpperCase() : null; }).filter(Boolean)) },
      INDODAX: { url: 'https://indodax.com/api/pairs', useProxy: true, parse: r => new Set(((r || [])).map(it => { const m = /^([a-z0-9]+)_idr$/i.exec(String(it.symbol || '')); return m ? m[1].toUpperCase() : null; }).filter(Boolean)) }
    };

    const map = {};
    for (const cex of selectedCex) {
      const source = tradeSources[cex.toUpperCase()];
      if (!source) continue;
      try {
        const url = source.useProxy ? this._prox(source.url) : source.url;
        const data = await this.Http.get(url, { responseType: 'json' });
        map[cex.toUpperCase()] = source.parse(data);
      } catch (error) {
        console.warn(`[CheckWalletExchanger] Gagal mengambil Trade Status [${cex}]:`, error);
        map[cex.toUpperCase()] = new Set();
      }
    }
    return (cex, symbol) => {
      const set = map[String(cex || '').toUpperCase()] || new Set();
      return set.has(String(symbol || '').toUpperCase());
    };
  }

  /**
   * Mengambil harga terkini untuk CEX yang dipilih.
   * @param {Array<string>} selectedCex - e.g., ['BINANCE', 'GATE'].
   * @returns {Promise<Function>} - Sebuah fungsi `getPrice(cex, symbol)` untuk mendapatkan harga.
   */
  async fetchPrices(selectedCex = []) {
    const buildPriceMap = (list, symbolKey, valueKey, pattern) => {
      const out = {};
      (list || []).forEach(item => {
        const sym = String(item[symbolKey] || '');
        if (!pattern.test(sym)) return;
        const base = sym.replace(pattern, '');
        const value = parseFloat(item[valueKey]);
        if (Number.isFinite(value)) {
          out[base.toUpperCase()] = value;
        }
      });
      return out;
    };

    const priceSources = {
      BINANCE: { url: 'https://api.binance.com/api/v3/ticker/price', useProxy: false, parse: r => buildPriceMap(r, 'symbol', 'price', /USDT$/) },
      MEXC: { url: 'https://api.mexc.com/api/v3/ticker/price', useProxy: true, parse: r => buildPriceMap(r, 'symbol', 'price', /USDT$/) },
      GATE: { url: 'https://api.gateio.ws/api/v4/spot/tickers', useProxy: true, parse: r => buildPriceMap(r, 'currency_pair', 'last', /_USDT$/) },
      KUCOIN: { url: 'https://api.kucoin.com/api/v1/market/allTickers', useProxy: true, parse: r => buildPriceMap(r?.data?.ticker || [], 'symbol', 'last', /-USDT$/) },
      OKX: { url: 'https://www.okx.com/api/v5/market/tickers?instType=SPOT', useProxy: true, parse: r => buildPriceMap(r?.data || [], 'instId', 'last', /-USDT$/) },
      BITGET: { url: 'https://api.bitget.com/api/v2/spot/market/tickers', useProxy: false, parse: r => buildPriceMap(r?.data || [], 'symbol', 'lastPr', /USDT$/) },
      BYBIT: { url: 'https://api.bybit.com/v5/market/tickers?category=spot', useProxy: false, parse: r => buildPriceMap(r?.result?.list || [], 'symbol', 'lastPrice', /USDT$/) },
      INDODAX: { url: 'https://indodax.com/api/ticker_all', useProxy: true, parse: r => {
        const out = {};
        const tickers = r?.tickers || {};
        Object.keys(tickers).forEach(key => {
          if (/_idr$/i.test(key)) {
            const symbol = key.replace(/_idr$/i, '').toUpperCase();
            const last = parseFloat(tickers[key]?.last);
            if (Number.isFinite(last)) out[symbol] = last;
          }
        });
        return out;
      }}
    };

    const maps = {};
    for (const cex of selectedCex) {
      const source = priceSources[cex.toUpperCase()];
      if (!source) continue;
      try {
        const url = source.useProxy ? this._prox(source.url) : source.url;
        const data = await this.Http.get(url, { responseType: 'json' });
        maps[cex.toUpperCase()] = source.parse(data) || {};
      } catch (error) {
        console.warn(`[CheckWalletExchanger] Gagal mengambil Harga [${cex}]:`, error);
        maps[cex.toUpperCase()] = {};
      }
    }
    return (cex, symbol) => {
      const map = maps[String(cex || '').toUpperCase()] || {};
      return map[String(symbol || '').toUpperCase()] ?? null;
    };
  }

  /**
   * Mendapatkan fungsi fetcher spesifik untuk setiap CEX.
   * @private
   */
  _getCoinListFetcher(cex) {
    const fetchers = {
      BINANCE: async (chainKey) => {
        const secret = this.secrets?.BINANCE || {};
        if (!secret.ApiKey || !secret.ApiSecret) throw new Error('BINANCE API key tidak tersedia');

        const timestamp = Date.now().toString();
        const queryString = `timestamp=${timestamp}`;
        const signature = CryptoJS.HmacSHA256(queryString, secret.ApiSecret).toString(CryptoJS.enc.Hex);
        const url = this._prox(`https://api-gcp.binance.com/sapi/v1/capital/config/getall?${queryString}&signature=${signature}`);

        const res = await this.Http.request({
          url,
          method: 'GET',
          headers: { 'X-MBX-ApiKey': secret.ApiKey },
          responseType: 'json'
        });

        const items = Array.isArray(res) ? res : (res?.data || []);
        const out = [];
        items.forEach(item => {
          (item.networkList || []).forEach(net => {
            if (!this._matchesCex(chainKey, net.network)) return;
            out.push({
              cex: 'BINANCE',
              chain: chainKey,
              nama_koin: item.assetName || item.coin || '',
              nama_token: String(item.coin || item.asset || '').toUpperCase(),
              sc_token: net.contractAddress || net.address || '',
              deposit: this._toBooleanStatus(net.depositEnable),
              withdraw: this._toBooleanStatus(net.withdrawEnable),
              feeWD: parseFloat(net.withdrawFee || 0)
            });
          });
        });
        return out;
      },

      GATE: async (chainKey) => {
        const url = this._prox('https://api.gateio.ws/api/v4/spot/currencies');
        const res = await this.Http.get(url, { responseType: 'json' });
        const out = [];
        (res || []).forEach(item => {
          (item.chains || []).forEach(ch => {
            if (!this._matchesCex(chainKey, ch.name)) return;
            out.push({
              cex: 'GATE',
              chain: chainKey,
              nama_koin: item.name || item.currency || '',
              nama_token: String(item.currency || '').toUpperCase(),
              sc_token: ch.addr || '',
              deposit: this._toBooleanStatus(ch.deposit_disabled === false),
              withdraw: this._toBooleanStatus(ch.withdraw_disabled === false),
              feeWD: parseFloat(ch.withdraw_fix_on_chains || 0)
            });
          });
        });
        return out;
      },

      KUCOIN: async (chainKey) => {
        const url = this._prox('https://api.kucoin.com/api/v3/currencies');
        const res = await this.Http.get(url, { responseType: 'json' });
        const out = [];
        (res?.data || []).forEach(item => {
          (item.chains || []).forEach(ch => {
            if (!this._matchesCex(chainKey, ch.chainName)) return;
            out.push({
              cex: 'KUCOIN',
              chain: chainKey,
              nama_koin: item.name || item.currency || '',
              nama_token: String(item.currency || '').toUpperCase(),
              sc_token: ch.contractAddress || '',
              deposit: this._toBooleanStatus(ch.isDepositEnabled),
              withdraw: this._toBooleanStatus(ch.isWithdrawEnabled),
              feeWD: parseFloat(ch.withdrawalMinFee || ch.withdrawFee || 0)
            });
          });
        });
        return out;
      },

      BITGET: async (chainKey) => {
        const url = 'https://api.bitget.com/api/v2/spot/public/coins';
        const res = await this.Http.get(url, { responseType: 'json' });
        const out = [];
        (res?.data || []).forEach(item => {
          (item.chains || []).forEach(ch => {
            if (!this._matchesCex(chainKey, ch.chain)) return;
            out.push({
              cex: 'BITGET',
              chain: chainKey,
              nama_koin: item.name || item.coin || '',
              nama_token: String(item.coin || '').toUpperCase(),
              sc_token: ch.contractAddress || '',
              deposit: this._toBooleanStatus(ch.rechargeable),
              withdraw: this._toBooleanStatus(ch.withdrawable),
              feeWD: parseFloat(ch.withdrawFee || 0)
            });
          });
        });
        return out;
      },

      BYBIT: async (chainKey) => {
        const secret = this.secrets?.BYBIT || {};
        if (!secret.ApiKey || !secret.ApiSecret) throw new Error('BYBIT API key tidak tersedia');

        const ts = Date.now().toString();
        const recvWindow = '5000';
        const signature = this._createBybitSignature({ ts, apiKey: secret.ApiKey, recvWindow, queryString: '', secret: secret.ApiSecret });

        const res = await this.Http.request({
          url: this._prox('https://api.bybit.com/v5/asset/coin/query-info'),
          method: 'GET',
          headers: {
            'X-BAPI-SIGN-TYPE': '2',
            'X-BAPI-SIGN': signature,
            'X-BAPI-API-KEY': secret.ApiKey,
            'X-BAPI-TIMESTAMP': ts,
            'X-BAPI-RECV-WINDOW': recvWindow
          },
          responseType: 'json'
        });

        const out = [];
        const rows = res?.result?.rows || res?.result?.list || res?.result || [];
        rows.forEach(row => {
          const coinName = row?.coin || row?.name || row?.symbol || '';
          (row?.chains || row?.chainInfos || []).forEach(ch => {
            if (!this._matchesCex(chainKey, ch?.chain || ch?.chainType || ch?.name)) return;
            const depositSource = ch.depositable ?? ch.canDeposit ?? ch.chainDeposit ?? ch.chain_deposit ?? ch.chainDepositEnable ?? ch.chain_deposit_enable ?? ch.deposit;
            const withdrawSource = ch.withdrawable ?? ch.canWithdraw ?? ch.chainWithdraw ?? ch.chain_withdraw ?? ch.chainWithdrawEnable ?? ch.chain_withdraw_enable ?? ch.withdraw;
            out.push({
              cex: 'BYBIT',
              chain: chainKey,
              nama_koin: String(coinName || ''),
              nama_token: String(coinName || '').toUpperCase(),
              sc_token: ch.contractAddress || '',
              deposit: this._toBooleanStatus(depositSource),
              withdraw: this._toBooleanStatus(withdrawSource),
              feeWD: parseFloat(ch.withdrawFee || ch.withdrawMinFee || 0)
            });
          });
        });
        return out;
      },

      INDODAX: async (chainKey) => {
        const secret = this.secrets?.INDODAX || {};
        if (!secret.ApiKey || !secret.ApiSecret) throw new Error('INDODAX API key tidak tersedia');

        const ts = Date.now();
        const recvWindow = 5000;
        const body = `method=getInfo&timestamp=${ts}&recvWindow=${recvWindow}`;
        const sign = CryptoJS.HmacSHA512(body, secret.ApiSecret).toString();

        const res = await this.Http.post(
          this._prox('https://indodax.com/tapi'),
          body,
          {
            headers: {
              'Key': secret.ApiKey,
              'Sign': sign,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            responseType: 'json'
          }
        );

        const networkMap = res?.return?.network || {};
        // Untuk INDODAX, kita perlu data dari cache untuk mendapatkan SC
        const baseList = await SyncStorage.getAll(chainKey);
        const snapBySymbol = new Map();
        baseList.forEach(item => {
          const symbol = String(item.ticker || item.symbol || '').toUpperCase();
          if (symbol) snapBySymbol.set(symbol, item);
        });

        const out = [];
        Object.keys(networkMap || {}).forEach(symRaw => {
          const sym = String(symRaw || '').toUpperCase();
          const networks = Array.isArray(networkMap[symRaw]) ? networkMap[symRaw] : [networkMap[symRaw]];
          const hit = networks.some(net => this._matchesCex(chainKey, net));
          if (!hit) return;

          const base = snapBySymbol.get(sym) || {};
          out.push({
            cex: 'INDODAX',
            chain: chainKey,
            nama_koin: base.name || sym,
            nama_token: sym,
            sc_token: base.sc || '',
            decimals: base.des ?? base.decimals ?? '',
            deposit: null, // API Indodax tidak memberikan status ini secara langsung
            withdraw: null,
            feeWD: 0 // Tidak tersedia di endpoint ini
          });
        });
        return out;
      },

      MEXC: async (chainKey) => {
        const secret = this.secrets?.MEXC || {};
        if (!secret.ApiKey || !secret.ApiSecret) throw new Error('MEXC API key tidak tersedia');

        const timestamp = Date.now().toString();
        const queryString = `timestamp=${timestamp}`;
        const signature = CryptoJS.HmacSHA256(queryString, secret.ApiSecret).toString(CryptoJS.enc.Hex);
        const url = this._prox(`https://api.mexc.com/api/v3/capital/config/getall?${queryString}&signature=${signature}`);

        const res = await this.Http.request({
          url,
          method: 'GET',
          headers: { 'X-MEXC-APIKEY': secret.ApiKey },
          responseType: 'json'
        });

        const items = Array.isArray(res) ? res : (res?.data || []);
        const out = [];
        items.forEach(item => {
          (item.networkList || []).forEach(net => {
            if (!this._matchesCex(chainKey, net.network)) return;
            out.push({
              cex: 'MEXC',
              chain: chainKey,
              nama_koin: item.coin,
              nama_token: String(item.coin || '').toUpperCase(),
              sc_token: net.contract || '',
              deposit: this._toBooleanStatus(net.depositEnable),
              withdraw: this._toBooleanStatus(net.withdrawEnable),
              feeWD: parseFloat(net.withdrawFee || 0)
            });
          });
        });
        return out;
      }
    };

    return fetchers[cex];
  }
}

// Export kelas agar bisa di-import di file lain
if (typeof window !== 'undefined') {
  window.CheckWalletExchanger = CheckWalletExchanger;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CheckWalletExchanger };
}
