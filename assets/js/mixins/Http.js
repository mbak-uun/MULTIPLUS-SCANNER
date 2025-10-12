/**
 * @file Http.js
 * @description A lightweight, promise-based HTTP client wrapper for the Fetch API.
 *
 * This module simplifies and standardizes HTTP requests across the application.
 * It provides convenient methods for common operations, automatic JSON handling,
 * robust error management, request timeouts, and proxy support.
 *
 * --- FEATURES ---
 * - Static methods: No need to instantiate the class.
 * - Promise-based: Works seamlessly with async/await.
 * - Automatic JSON: Stringifies request bodies and parses JSON responses.
 * - Rich Error Handling: Throws detailed errors for non-2xx responses,
 *   including status code, description, and response body.
 * - Timeout Support: Aborts requests that take too long.
 * - Proxy Support: Can route requests through a random or custom proxy.
 *
 * --- USAGE EXAMPLES ---
 *
 * 1. Basic GET Request
 *
 * async function getUsers() {
 *   try {
 *     const users = await Http.get('https://api.example.com/users');
 *     console.log(users);
 *   } catch (error) {
 *     console.error('Failed to fetch users:', error.message);
 *   }
 * }
 *
 * 2. POST Request with JSON Data and Error Handling
 *
 * async function createUser(userData) {
 *   try {
 *     const newUser = await Http.post('https://api.example.com/users', userData);
 *     console.log('User created:', newUser);
 *   } catch (error) {
 *     console.error(`Error ${error.status}: ${error.message}`);
 *     console.error('Description:', error.description);
 *     console.error('Server response:', error.body);
 *   }
 * }
 *
 * 3. Using a Random Proxy from Configuration
 *    (Assumes `config_app.proxies` is an array of proxy URLs)
 *
 * async function getDataViaProxy() {
 *   const data = await Http.get('https://api.private.com/data', {
 *     proxy: true // Use a random proxy from config_app.proxies
 *   });
 * }
 *
 * 4. Advanced Request with Custom Proxy and Timeout
 *
 * async function getWithTimeout() {
 *   const customProxy = 'https://my-proxy.com/fetch?url=';
 *   const data = await Http.get('https://api.slow-server.com/data', {
 *     proxy: customProxy,
 *     timeout: 3000 // 3 seconds
 *   });
 * }
 */

const HTTP_ERROR_CODES = [
  // --- Informational Responses (100–199) ---
  { code: 100, message: "Continue", description: "Permintaan awal diterima, lanjutkan proses pengiriman data." },
  { code: 101, message: "Switching Protocols", description: "Server setuju untuk beralih ke protokol lain sesuai permintaan klien." },
  { code: 102, message: "Processing", description: "Server sedang memproses permintaan, tetapi belum ada respons akhir." },
  { code: 103, message: "Early Hints", description: "Server mengirimkan informasi awal sebelum respons utama." },

  // --- Successful Responses (200–299) ---
  { code: 200, message: "OK", description: "Permintaan berhasil dan hasil dikembalikan." },
  { code: 201, message: "Created", description: "Permintaan berhasil dan sumber daya baru telah dibuat." },
  { code: 202, message: "Accepted", description: "Permintaan diterima tetapi belum diproses sepenuhnya." },
  { code: 203, message: "Non-Authoritative Information", description: "Data berhasil dikembalikan, namun berasal dari sumber non-otoritatif." },
  { code: 204, message: "No Content", description: "Permintaan berhasil, tetapi tidak ada konten yang dikirimkan kembali." },
  { code: 205, message: "Reset Content", description: "Permintaan berhasil, dan klien diminta mereset tampilan form input." },
  { code: 206, message: "Partial Content", description: "Server mengirim sebagian data sesuai permintaan (biasanya untuk download parsial)." },
  { code: 207, message: "Multi-Status", description: "Respons berisi beberapa status untuk permintaan berbeda." },
  { code: 208, message: "Already Reported", description: "Sumber daya telah dilaporkan sebelumnya, tidak diulang." },
  { code: 226, message: "IM Used", description: "Server telah memproses permintaan menggunakan instance-manipulations." },

  // --- Redirection Messages (300–399) ---
  { code: 300, message: "Multiple Choices", description: "Tersedia beberapa opsi sumber daya yang dapat dipilih klien." },
  { code: 301, message: "Moved Permanently", description: "Sumber daya telah dipindahkan secara permanen ke URL baru." },
  { code: 302, message: "Found", description: "Sumber daya sementara dipindahkan ke URL lain." },
  { code: 303, message: "See Other", description: "Klien harus menggunakan metode GET ke URL lain." },
  { code: 304, message: "Not Modified", description: "Sumber daya belum berubah sejak terakhir diakses (cache masih valid)." },
  { code: 305, message: "Use Proxy", description: "Sumber daya hanya tersedia melalui proxy yang ditentukan." },
  { code: 307, message: "Temporary Redirect", description: "Sumber daya sementara dipindahkan ke URL lain, metode tetap sama." },
  { code: 308, message: "Permanent Redirect", description: "Sumber daya dipindahkan secara permanen ke URL baru, metode tetap sama." },

  // --- Client Error Responses (400–499) ---
  { code: 400, message: "Bad Request", description: "Permintaan tidak valid atau tidak dapat dipahami oleh server." },
  { code: 401, message: "Unauthorized", description: "Autentikasi diperlukan untuk mengakses sumber daya." },
  { code: 402, message: "Payment Required", description: "Diperlukan pembayaran untuk mengakses sumber daya (jarang digunakan)." },
  { code: 403, message: "Forbidden", description: "Server memahami permintaan tetapi menolak untuk memprosesnya." },
  { code: 404, message: "Not Found", description: "Sumber daya yang diminta tidak ditemukan di server." },
  { code: 405, message: "Method Not Allowed", description: "Metode HTTP yang digunakan tidak diizinkan untuk sumber daya ini." },
  { code: 406, message: "Not Acceptable", description: "Server tidak dapat menghasilkan konten yang dapat diterima oleh klien." },
  { code: 407, message: "Proxy Authentication Required", description: "Autentikasi proxy diperlukan sebelum melanjutkan." },
  { code: 408, message: "Request Timeout", description: "Server kehabisan waktu untuk menunggu permintaan dari klien." },
  { code: 409, message: "Conflict", description: "Terjadi konflik pada permintaan, biasanya karena data sudah ada atau berubah." },
  { code: 410, message: "Gone", description: "Sumber daya tidak lagi tersedia dan telah dihapus permanen." },
  { code: 411, message: "Length Required", description: "Server memerlukan header 'Content-Length' untuk memproses permintaan." },
  { code: 412, message: "Precondition Failed", description: "Syarat dalam header permintaan tidak terpenuhi oleh server." },
  { code: 413, message: "Payload Too Large", description: "Data permintaan terlalu besar untuk diproses server." },
  { code: 414, message: "URI Too Long", description: "URI terlalu panjang untuk diproses oleh server." },
  { code: 415, message: "Unsupported Media Type", description: "Tipe media dari permintaan tidak didukung oleh server." },
  { code: 416, message: "Range Not Satisfiable", description: "Rentang data yang diminta tidak dapat dipenuhi." },
  { code: 417, message: "Expectation Failed", description: "Server tidak dapat memenuhi nilai header 'Expect' dari permintaan." },
  { code: 418, message: "I'm a teapot", description: "Kode lelucon dari RFC 2324 — server adalah teko, bukan mesin kopi." },
  { code: 421, message: "Misdirected Request", description: "Permintaan dikirim ke server yang tidak dapat memprosesnya." },
  { code: 422, message: "Unprocessable Entity", description: "Server memahami format tetapi tidak dapat memproses isinya." },
  { code: 423, message: "Locked", description: "Sumber daya terkunci dan tidak dapat diakses saat ini." },
  { code: 424, message: "Failed Dependency", description: "Permintaan gagal karena ketergantungan pada permintaan lain yang gagal." },
  { code: 425, message: "Too Early", description: "Server menolak memproses karena permintaan terlalu dini." },
  { code: 426, message: "Upgrade Required", description: "Klien harus beralih ke protokol lain (misalnya HTTPS)." },
  { code: 428, message: "Precondition Required", description: "Server memerlukan kondisi tertentu sebelum memproses permintaan." },
  { code: 429, message: "Too Many Requests", description: "Klien mengirim terlalu banyak permintaan dalam waktu singkat (rate limit)." },
  { code: 431, message: "Request Header Fields Too Large", description: "Header permintaan terlalu besar untuk diproses server." },
  { code: 451, message: "Unavailable For Legal Reasons", description: "Konten tidak tersedia karena alasan hukum (misalnya sensor pemerintah)." },

  // --- Server Error Responses (500–599) ---
  { code: 500, message: "Internal Server Error", description: "Terjadi kesalahan umum di sisi server." },
  { code: 501, message: "Not Implemented", description: "Metode atau fungsionalitas belum diimplementasikan oleh server." },
  { code: 502, message: "Bad Gateway", description: "Server bertindak sebagai gateway dan menerima respons tidak valid dari upstream." },
  { code: 503, message: "Service Unavailable", description: "Server tidak dapat menangani permintaan karena sedang sibuk atau pemeliharaan." },
  { code: 504, message: "Gateway Timeout", description: "Server upstream tidak merespons tepat waktu." },
  { code: 505, message: "HTTP Version Not Supported", description: "Versi HTTP yang digunakan tidak didukung oleh server." },
  { code: 506, message: "Variant Also Negotiates", description: "Kesalahan konfigurasi konten yang dapat dinegosiasikan." },
  { code: 507, message: "Insufficient Storage", description: "Server tidak memiliki ruang penyimpanan cukup untuk memproses permintaan." },
  { code: 508, message: "Loop Detected", description: "Server mendeteksi loop tak berujung dalam pemrosesan permintaan." },
  { code: 510, message: "Not Extended", description: "Server memerlukan ekstensi tambahan untuk menyelesaikan permintaan." },
  { code: 511, message: "Network Authentication Required", description: "Autentikasi jaringan diperlukan (biasanya untuk hotspot publik)." }
];

class Http {
  static async request(options = {}) {
    const {
      url: originalUrl,
      method = 'GET',
      headers = {},
      data, // REVISI: data adalah alias untuk body
      body,
      responseType = 'auto',
      timeout = 7000,
      credentials,
      signal,
      proxy = false // false, true (random from config), or a string (custom proxy url)
    } = options;

    if (!originalUrl) {
      throw new Error('Http.request: "url" is required');
    }

    let url = originalUrl;

    // REVISI: Logika proxy yang lebih andal
    if (proxy) {
      let proxyUrl = '';
      if (proxy === true) {
        // Gunakan proxy dari config jika tersedia
        const config = (typeof window !== 'undefined' && window.KONFIG_APLIKASI) ? window.KONFIG_APLIKASI : {};
        const proxies = config.LIST_PROXY?.SERVERS || [];
        if (proxies.length > 0) {
          const randomIndex = Math.floor(Math.random() * proxies.length);
          proxyUrl = proxies[randomIndex];
        } else {
          // Fallback ke proxy default jika config tidak ada
          proxyUrl = 'https://server1.ciwayeh967.workers.dev/?';
        }
      } else if (typeof proxy === 'string') {
        proxyUrl = proxy;
      }
      // Pastikan proxyUrl diakhiri dengan '?' atau '&' sebelum menambahkan URL
      if (proxyUrl) {
         url = `${proxyUrl}${proxyUrl.includes('?') ? '' : '?'}${encodeURIComponent(originalUrl)}`;
      }
    }

    const controller = new AbortController();
    const signals = signal
      ? [signal, controller.signal]
      : [controller.signal];

    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeout);

    const fetchHeaders = new Headers(headers);
    const payload = body ?? data;
    const fetchOptions = {
      method,
      headers: fetchHeaders,
      signal: signals.length === 1 ? signals[0] : Http._mergeSignals(signals),
      credentials
    };

    if (payload !== undefined && payload !== null && method.toUpperCase() !== 'GET') {
      if (typeof payload === 'string' || payload instanceof FormData || payload instanceof URLSearchParams || payload instanceof Blob) {
        fetchOptions.body = payload;
      } else {
        if (!fetchHeaders.has('Content-Type')) {
          fetchHeaders.set('Content-Type', 'application/json');
        }
        fetchOptions.body = JSON.stringify(payload);
      }
    }

    try {
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      const shouldParseJson = responseType === 'json' || (responseType === 'auto' && contentType.includes('application/json'));
      const shouldParseText = responseType === 'text' || (responseType === 'auto' && contentType.includes('text/'));

      let parsedBody = null;
      if (shouldParseJson) {
        parsedBody = await response.json().catch(() => null);
      } else if (shouldParseText) {
        parsedBody = await response.text();
      } else if (responseType === 'blob') {
        parsedBody = await response.blob();
      } else if (responseType === 'arrayBuffer') {
        parsedBody = await response.arrayBuffer();
      }

      if (!response.ok) {
        const errorDetails = HTTP_ERROR_CODES.find(e => e.code === response.status);
        const message = errorDetails
          ? `${errorDetails.message} (HTTP ${response.status})`
          : `HTTP ${response.status} ${response.statusText || ''}`.trim();

        const error = new Error(message);
        error.status = response.status;
        error.statusText = response.statusText;
        error.description = errorDetails ? errorDetails.description : 'No specific description available.';
        error.body = parsedBody;
        throw error;
      }

      return parsedBody;
    } catch (error) {
      clearTimeout(timeoutId);
      if (timedOut) {
        const timeoutError = new Error(`Request timeout after ${timeout}ms`);
        timeoutError.code = 'TIMEOUT';
        throw timeoutError;
      }
      throw error;
    }
  }

  static get(url, options = {}) {
    return Http.request({ ...options, url, method: 'GET' });
  }

  static post(url, data, options = {}) {
    return Http.request({ ...options, url, method: 'POST', data });
  }

  static _mergeSignals(signals) {
    const controller = new AbortController();
    signals.forEach(sig => {
      if (!sig) return;
      if (sig.aborted) {
        controller.abort(sig.reason);
      } else {
        sig.addEventListener('abort', () => controller.abort(sig.reason), { once: true });
      }
    });
    return controller.signal;
  }
}

if (typeof window !== 'undefined') {
  window.Http = Http;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Http };
}
