// assets/js/mixins/Http.js
// Lightweight HTTP wrapper to standardize fetch usage across the app.

class Http {
  static async request(options = {}) {
    const {
      url,
      method = 'GET',
      headers = {},
      data,
      body,
      responseType = 'auto',
      timeout = 15000,
      credentials,
      signal
    } = options;

    if (!url) {
      throw new Error('Http.request: "url" is required');
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
        const error = new Error(`HTTP ${response.status} ${response.statusText || ''}`.trim());
        error.status = response.status;
        error.statusText = response.statusText;
        error.body = parsedBody;
        throw error;
      }

      return parsedBody;
    } catch (error) {
      clearTimeout(timeoutId);
      if (timedOut) {
        const timeoutError = new Error(`Request timeout after ${timeout}ms`);
        timeoutError.code = 'ETIMEDOUT';
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
