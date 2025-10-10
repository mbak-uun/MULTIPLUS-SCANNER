// assets/js/mixins/filter.js
// Mixin untuk logika filtering token yang bisa digunakan kembali di berbagai komponen.

const filterMixin = {
  computed: {
    /**
     * Computed property utama untuk memfilter dan mengurutkan token.
     * Mixin ini mengasumsikan komponen yang menggunakannya memiliki:
     * - `this.tokens`: Array data mentah token.
     * - `this.filters`: Objek pengaturan filter dari root.
     * - `this.$root`: Akses ke instance root Vue.
     * - `this.searchQuery` (opsional): String untuk pencarian teks.
     */
    filteredTokens() {
      if (!this.tokens || !this.$root.filters) {
        // console.log('[FilterMixin] No tokens or filters:', { tokens: !!this.tokens, filters: !!this.filters });
        return [];
      }

      let filtered = [...this.tokens];
      // console.log(`[FilterMixin] Starting with ${filtered.length} tokens`);
      
      // Panggil metode filtering yang terpusat
      filtered = this.applyFiltersToTokens(filtered, {
        filters: this.$root.filters,
        searchQuery: this.$root.searchQuery
      });

      // 7. Pengurutan
      // REVISI: Gunakan sortKey dan sortDirection dari data komponen, bukan dari root.
      if (this.sortKey) {
        const direction = this.sortDirection === 'asc' ? 1 : -1;
        filtered.sort((a, b) => {
          let valA = a[this.sortKey];
          let valB = b[this.sortKey];

          // Penanganan khusus untuk tipe data yang berbeda
          if (typeof valA === 'string') {
            return valA.localeCompare(valB) * direction;
          }
          if (typeof valA === 'number' || typeof valA === 'boolean') {
            if (valA < valB) return -1 * direction;
            if (valA > valB) return 1 * direction;
            return 0;
          }
          // Fallback untuk null/undefined
          if (valA == null) return 1 * direction;
          if (valB == null) return -1 * direction;

          // Fallback perbandingan string
          return String(valA).localeCompare(String(valB)) * direction;
        });
      }

      // console.log(`[FilterMixin] ✅ FINAL filteredTokens count: ${filtered.length}`);
      return filtered;
    }
  },
  methods: {
    getTokenCEXList(token) {
      // REVISI: Disesuaikan dengan skema flat baru.
      // Kembalikan array berisi satu CEX jika ada.
      if (!token || !token.cex_name) return [];
      return [token.cex_name];
    },

    /**
     * Terapkan seluruh aturan filter terhadap daftar token.
     * Digunakan oleh berbagai komponen (scanning, management, root stats).
     *
     * @param {Array<Object>} sourceTokens - Koleksi token mentah.
     * @param {Object} options
     * @param {Object} options.filters - Status filter aktif.
     * @param {string} options.searchQuery - Kata kunci pencarian bebas.
     * @returns {Array<Object>} Token yang lolos filter.
     */
    applyFiltersToTokens(sourceTokens, { filters = {}, searchQuery = '' } = {}) {
      if (!Array.isArray(sourceTokens) || sourceTokens.length === 0) {
        return [];
      }

      const normalizedSearch = String(searchQuery || '').trim().toLowerCase();
      const chainFilters = filters.chains || {};
      const cexFilters = filters.cex || {};
      const pairFilters = filters.pairs || {};

      const activeChainSet = new Set(
        Object.keys(chainFilters)
          .filter(chainKey => chainFilters[chainKey])
          .map(chainKey => chainKey.toLowerCase())
      );
      const activeCexSet = new Set(
        Object.keys(cexFilters)
          .filter(cexKey => cexFilters[cexKey])
          .map(cexKey => cexKey.toLowerCase())
      );
      const activePairSet = new Set(
        Object.keys(pairFilters)
          .filter(pairKey => pairFilters[pairKey])
          .map(pairKey => pairKey.toUpperCase())
      );

      const shouldFilterByChain = Object.keys(chainFilters).length > 0;
      const shouldFilterByCex = Object.keys(cexFilters).length > 0;
      const shouldFilterByPair = Object.keys(pairFilters).length > 0;
      const favoritesOnly = Boolean(filters.favoritOnly);

      return sourceTokens.filter(rawToken => {
        if (!rawToken || typeof rawToken !== 'object') return false;

        // 1. Filter favorit
        if (favoritesOnly) {
          const isFavorite = rawToken.isFavorite ?? rawToken.isFavorit ?? false;
          if (!isFavorite) return false;
        }

        // 2. Filter chain
        if (shouldFilterByChain) {
          const tokenChain = String(rawToken.chainKey || rawToken.chain || '')
            .trim()
            .toLowerCase();
          if (!activeChainSet.size) return false;
          if (!activeChainSet.has(tokenChain)) return false;
        }

        // 3. Filter CEX
        if (shouldFilterByCex) {
          const tokenCex = String(
            rawToken.cex_name || rawToken.cex || rawToken.primaryCex || ''
          )
            .trim()
            .toLowerCase();
          if (!activeCexSet.size) return false;
          if (!activeCexSet.has(tokenCex)) return false;
        }

        // 4. Filter Pair (jika ada)
        if (shouldFilterByPair) {
          const tokenPair = String(rawToken.nama_pair || rawToken.pair || '')
            .trim()
            .toUpperCase();
          if (!activePairSet.size) return false;
          if (!activePairSet.has(tokenPair)) return false;
        }

        // 5. Filter pencarian bebas
        if (normalizedSearch) {
          const haystackSegments = [
            rawToken.id,
            rawToken.nama_token,
            rawToken.nama_koin,
            rawToken.nama_pair,
            rawToken.cex_ticker_token,
            rawToken.cex_ticker_pair,
            rawToken.cex_name,
            rawToken.chain,
            rawToken.chainKey,
            rawToken.sc_token,
            rawToken.sc_pair
          ]
            .filter(Boolean)
            .map(value => String(value).toLowerCase());

          const matchesSearch = haystackSegments.some(segment =>
            segment.includes(normalizedSearch)
          );

          if (!matchesSearch) return false;
        }

        return true;
      });
    }
  }
};
