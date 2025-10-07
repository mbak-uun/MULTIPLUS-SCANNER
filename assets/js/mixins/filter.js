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
      if (!this.tokens || !this.filters) {
        console.log('[FilterMixin] No tokens or filters:', { tokens: !!this.tokens, filters: !!this.filters });
        return [];
      }

      let filtered = [...this.tokens];
      console.log(`[FilterMixin] Starting with ${filtered.length} tokens`);

      // 1. Filter berdasarkan pencarian (jika ada di komponen)
      if (this.searchQuery) {
        const beforeCount = filtered.length;
        const lowerCaseQuery = this.searchQuery.toLowerCase();
        filtered = filtered.filter(token =>
          (token.nama_koin && token.nama_koin.toLowerCase().includes(lowerCaseQuery)) ||
          (token.nama_token && token.nama_token.toLowerCase().includes(lowerCaseQuery)) ||
          (token.nama_pair && token.nama_pair.toLowerCase().includes(lowerCaseQuery)) ||
          (token.sc_token && token.sc_token.toLowerCase().includes(lowerCaseQuery))
        );
        console.log(`[FilterMixin] After searchQuery filter: ${filtered.length} (removed ${beforeCount - filtered.length})`);
      }

      // 2. Filter berdasarkan favorit
      if (this.filters.favoritOnly) {
        const beforeCount = filtered.length;
        filtered = filtered.filter(token => token.isFavorite || token.isFavorit);
        console.log(`[FilterMixin] After favoritOnly filter: ${filtered.length} (removed ${beforeCount - filtered.length})`);
      }

      // 3. Filter berdasarkan CHAIN (hanya di mode multi-chain)
      const isMultiChainMode = this.$root.activeChain === 'multi';
      if (isMultiChainMode && this.filters.chains) {
        const activeChainFilters = Object.keys(this.filters.chains).filter(key => this.filters.chains[key]);
        if (activeChainFilters.length > 0) {
          const beforeCount = filtered.length;
          filtered = filtered.filter(token => {
            const tokenChain = (token.chain || '').toLowerCase();
            return activeChainFilters.some(chain => chain.toLowerCase() === tokenChain);
          });
          console.log(`[FilterMixin] After chain filter: ${filtered.length} (removed ${beforeCount - filtered.length})`, { activeChains: activeChainFilters });
        }
      }

      // 4. Filter berdasarkan CEX (logika OR) - SKIP di mode multi
      if (this.filters.cex && !isMultiChainMode) {
        const activeCexFilters = Object.keys(this.filters.cex).filter(key => this.filters.cex[key]);
        if (activeCexFilters.length > 0) {
          const beforeCount = filtered.length;

          // Debug: Log sebelum filter
          console.log(`[FilterMixin] CEX Filter DEBUG - Before:`, {
            tokenCount: filtered.length,
            activeCexFilters,
            sampleTokenCex: filtered[0]?.cex_name
          });

          filtered = filtered.filter(token => {
            // REVISI: Sesuaikan dengan skema flat baru.
            // Cukup periksa apakah token.cex_name ada di dalam filter CEX yang aktif.
            const tokenCex = (token.cex_name || '').toLowerCase();
            const tokenCexList = tokenCex ? [tokenCex] : [];
            const matches = activeCexFilters.some(cex => tokenCexList.includes(cex.toLowerCase()));

            // Debug individual token
            if (!matches && beforeCount <= 10) {
              console.log(`[FilterMixin] CEX Filter REJECTED:`, {
                tokenCex: token.cex_name,
                normalized: tokenCex,
                activeCexFilters,
                tokenCexList
              });
            }

            return matches;
          });
          console.log(`[FilterMixin] After CEX filter: ${filtered.length} (removed ${beforeCount - filtered.length})`, { activeCex: activeCexFilters });
        }
      }

      // 5. Filter berdasarkan DEX (logika OR) - SKIP di mode multi
      if (this.filters.dex && !isMultiChainMode) {
        const activeDexFilters = Object.keys(this.filters.dex).filter(key => this.filters.dex[key]);
        if (activeDexFilters.length > 0) {
          const beforeCount = filtered.length;

          // Debug: Log sebelum filter
          console.log(`[FilterMixin] DEX Filter DEBUG - Before:`, {
            tokenCount: filtered.length,
            activeDexFilters,
            sampleTokenDex: filtered[0]?.dex
          });

          filtered = filtered.filter(token => {
            const tokenDexList = Object.keys(token.dex || {}).filter(d => token.dex[d]?.status).map(d => d.toLowerCase());
            const matches = activeDexFilters.some(dex => tokenDexList.includes(dex.toLowerCase()));

            // Debug individual token
            if (!matches && beforeCount <= 10) {
              console.log(`[FilterMixin] DEX Filter REJECTED:`, {
                tokenDex: token.dex,
                tokenDexList,
                activeDexFilters
              });
            }

            return matches;
          });
          console.log(`[FilterMixin] After DEX filter: ${filtered.length} (removed ${beforeCount - filtered.length})`, { activeDex: activeDexFilters });
        }
      }

      // 6. Filter berdasarkan PAIR (logika OR, tanpa prefix chain) - SKIP di mode multi
      if (this.filters.pairs && !isMultiChainMode) {
        const activePairFilters = Object.keys(this.filters.pairs).filter(key => this.filters.pairs[key]);
        
        // Hanya filter jika ada setidaknya satu filter pair yang aktif.
        if (activePairFilters.length > 0) {
          const beforeCount = filtered.length;
          const lowerCaseActivePairs = activePairFilters.map(p => p.toLowerCase());
          
          filtered = filtered.filter(token => {
            // Ambil nama pair dari token, default ke 'NON' jika tidak ada.
            const tokenPair = (token.nama_pair || 'NON').toLowerCase();
            return lowerCaseActivePairs.includes(tokenPair);
          });
          console.log(`[FilterMixin] After PAIR filter: ${filtered.length} (removed ${beforeCount - filtered.length})`, { activePairs: activePairFilters });
        }
      }

      // 7. Pengurutan
      const sortDirection = this.$root.filterSettings?.sortDirection || 'asc';
      const sortKey = sortDirection === 'asc' ? 1 : -1;
      filtered.sort((a, b) => {
        const nameA = (a.nama_koin || '').toLowerCase();
        const nameB = (b.nama_koin || '').toLowerCase();
        if (nameA < nameB) return -1 * sortKey;
        if (nameA > nameB) return 1 * sortKey;
        return 0;
      });

      console.log(`[FilterMixin] ✅ FINAL filteredTokens count: ${filtered.length}`);
      return filtered;
    }
  },
  methods: {
    getTokenCEXList(token) {
      // REVISI: Disesuaikan dengan skema flat baru.
      // Kembalikan array berisi satu CEX jika ada.
      if (!token || !token.cex_name) return [];
      return [token.cex_name];
    }
  }
};