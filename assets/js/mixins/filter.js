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
      if (!this.tokens || !this.filters) return [];

      let filtered = [...this.tokens];

      // 1. Filter berdasarkan pencarian (jika ada di komponen)
      if (this.searchQuery) {
        const lowerCaseQuery = this.searchQuery.toLowerCase();
        filtered = filtered.filter(token =>
          (token.nama_koin && token.nama_koin.toLowerCase().includes(lowerCaseQuery)) ||
          (token.nama_token && token.nama_token.toLowerCase().includes(lowerCaseQuery)) ||
          (token.nama_pair && token.nama_pair.toLowerCase().includes(lowerCaseQuery)) ||
          (token.sc_token && token.sc_token.toLowerCase().includes(lowerCaseQuery))
        );
      }

      // 2. Filter berdasarkan favorit
      if (this.filters.favoritOnly) {
        filtered = filtered.filter(token => token.isFavorite || token.isFavorit);
      }

      // 3. Filter berdasarkan CHAIN (hanya di mode multi-chain)
      if (this.$root.activeChain === 'multi' && this.filters.chains) {
        const activeChainFilters = Object.keys(this.filters.chains).filter(key => this.filters.chains[key]);
        if (activeChainFilters.length > 0) {
          filtered = filtered.filter(token => {
            const tokenChain = (token.chain || '').toLowerCase();
            return activeChainFilters.some(chain => chain.toLowerCase() === tokenChain);
          });
        }
      }

      // 4. Filter berdasarkan CEX (logika OR)
      if (this.filters.cex) {
        const activeCexFilters = Object.keys(this.filters.cex).filter(key => this.filters.cex[key]);
        if (activeCexFilters.length > 0) {
          filtered = filtered.filter(token => {
            const tokenCexList = this.getTokenCEXList(token).map(c => c.toLowerCase());
            return activeCexFilters.some(cex => tokenCexList.includes(cex.toLowerCase()));
          });
        }
      }

      // 5. Filter berdasarkan DEX (logika OR)
      if (this.filters.dex) {
        const activeDexFilters = Object.keys(this.filters.dex).filter(key => this.filters.dex[key]);
        if (activeDexFilters.length > 0) {
          filtered = filtered.filter(token => {
            const tokenDexList = Object.keys(token.dex || {}).filter(d => token.dex[d]?.status).map(d => d.toLowerCase());
            return activeDexFilters.some(dex => tokenDexList.includes(dex.toLowerCase()));
          });
        }
      }

      // 6. Filter berdasarkan PAIR (logika OR + dukungan "NON")
      if (this.filters.pairs) {
        const activePairFilters = Object.keys(this.filters.pairs).filter(key => this.filters.pairs[key]);
        if (activePairFilters.length > 0) {
          const definedPairsByChain = this.$root.activeChains.reduce((acc, chainKey) => {
            const chainConf = this.$root.config.CHAINS?.[chainKey];
            if (chainConf && chainConf.PAIR_DEXS) {
              acc[chainKey] = Object.values(chainConf.PAIR_DEXS).map(p => p.SYMBOL_PAIR.toLowerCase());
            }
            return acc;
          }, {});

          filtered = filtered.filter(token => {
            const tokenChain = (token.chain || '').toLowerCase();
            const tokenPair = (token.nama_pair || '').toLowerCase();
            return activePairFilters.some(pairKey => {
              const [filterChain, filterPair] = pairKey.toLowerCase().split('.');
              if (filterChain !== tokenChain) return false;
              if (filterPair === 'non') {
                return !(definedPairsByChain[tokenChain] || []).includes(tokenPair);
              }
              return tokenPair === filterPair;
            });
          });
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

      return filtered;
    }
  },
  methods: {
    getTokenCEXList(token) {
      if (!token || !token.cex || typeof token.cex !== 'object') return [];
      return Object.keys(token.cex);
    }
  }
};