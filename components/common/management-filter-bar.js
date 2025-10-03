// components/common/management-filter-bar.js
// Filter Bar untuk Tab Manajemen Koin

const ManagementFilterBar = {
  name: 'ManagementFilterBar',

  template: `
    <div class="card card-soft mb-3">
      <div class="card-body py-2">
        <div class="d-flex flex-wrap align-items-center gap-2">
         
          <!-- Favorite Only Toggle -->
          <div class="form-check form-switch">
            <input
              class="form-check-input"
              type="checkbox"
              id="managementFavoritOnly" 
              v-model="filters.favoritOnly"
              @change="saveFilter('favoritOnly')">
            <label class="form-check-label" for="managementFavoritOnly">
              <i class="bi bi-star-fill text-warning"></i> Favorite
            </label>
          </div>
 
        </div>
      </div>
    </div>
  `,

  computed: {
    filters() {
      return this.$root.filters || {};
    },

    chainLabel() {
      const chainKey = this.filterSettings.chainKey || '';
      const chainMap = {
        'bsc': 'BSC',
        'eth': 'Ethereum',
        'sol': 'Solana',
        'matic': 'Polygon',
        'avax': 'Avalanche',
        'arb': 'Arbitrum',
        'op': 'Optimism',
        'base': 'Base',
        'multi': 'Multi Chain'
      };
      return chainMap[chainKey.toLowerCase()] || chainKey.toUpperCase() || 'Unknown';
    },

    chainBadgeClass() {
      const chainKey = (this.filterSettings.chainKey || '').toLowerCase();
      const colorMap = {
        'bsc': 'bg-warning text-dark',
        'eth': 'bg-primary',
        'sol': 'bg-purple',
        'matic': 'bg-info',
        'avax': 'bg-danger',
        'arb': 'bg-secondary',
        'op': 'bg-danger',
        'base': 'bg-primary',
        'multi': 'bg-success'
      };
      return colorMap[chainKey] || 'bg-secondary';
    }
  },

  methods: {
    async saveFilter(field) {
      // REVISI: Panggil metode terpusat di root component (app.js)
      this.$root.saveFilterChange(field);
    },

    getChangeMessage(field, value) {
      // REVISI: Metode ini tidak lagi digunakan karena notifikasi ditangani oleh `saveFilterChange` di root.
      const messages = {
        'darkMode': `Tema ${value ? 'Gelap 🌙' : 'Terang ☀️'} aktif`,
        'favoritOnly': `Filter Favorit ${value ? 'AKTIF ✓' : 'NONAKTIF ✗'}`
      };
      return messages[field] || 'Filter berhasil diubah';
    }
  }
};
