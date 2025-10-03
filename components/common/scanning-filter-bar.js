// components/common/scanning-filter-bar.js
// Filter Bar untuk Tab Scanning

const ScanningFilterBar = {
  name: 'ScanningFilterBar',

  template: `
    <div class="card card-soft px-2 py-2">
        <div class="d-flex flex-wrap align-items-center gap-2">
          <!-- Favorite Only Toggle -->
          <div class="form-check form-switch">
            <input
              class="form-check-input"
              type="checkbox"
              id="favoritOnly" 
              v-model="filters.favoritOnly"
              @change="saveFilterChange('favoritOnly')">
            <label class="form-check-label" for="favoritOnly">
              <i class="bi bi-star-fill text-warning"></i> Favorite
            </label>
          </div>

          <!-- Auto Run Toggle -->
          <div class="form-check form-switch">
            <input
              class="form-check-input"
              type="checkbox"
              id="autorun" 
              v-model="filters.autorun"
              @change="saveFilterChange('autorun')">
            <label class="form-check-label" for="autorun">
              <i class="bi bi-play-circle"></i> Run
            </label>
          </div>

          <!-- Auto Scroll Toggle -->
          <div class="form-check form-switch">
            <input
              class="form-check-input"
              type="checkbox"
              id="autoscroll" 
              v-model="filters.autoscroll"
              @change="saveFilterChange('autoscroll')">
            <label class="form-check-label" for="autoscroll">
              <i class="bi bi-arrow-down-circle"></i>  Scroll
            </label>
          </div>

          <div class="vr"></div>

          <!-- Min PNL Input -->
          <div class="d-flex align-items-center gap-2">
            <label class="form-label mb-0 small">PNL:</label>
            <input
              type="number"
              class="form-control form-control-sm"
              style="width: 80px;" 
              v-model.number="filters.minPnl"
              @change="saveFilterChange('minPnl')"
              step="0.1"
              min="0">
          </div>

          <div class="ms-auto d-flex align-items-center gap-2">
            <!-- Progress Bar (muncul saat scanning) -->
            <div v-if="isScanning" class="progress" style="width: 150px; height: 28px;">
              <div class="progress-bar progress-bar-striped progress-bar-animated bg-info" role="progressbar" style="width: 100%">
                <small>Scanning...</small>
              </div>
            </div>

            <!-- Tombol Start/Stop -->
            <button
              class="btn btn-sm"
              :class="filters.run === 'run' ? 'btn-danger' : 'btn-success'"
              @click="toggleRun">
              <i :class="filters.run === 'run' ? 'bi bi-stop-circle' : 'bi bi-play-circle'"></i>
              {{ filters.run === 'run' ? 'STOP' : 'START' }}
            </button>
          </div>
        </div>
    </div>
  `,

  computed: {
    filterSettings() {
      return this.$root.filterSettings || {};
    },
    filters() {
      return this.$root.filters || {};
    },
    isScanning() {
      return this.filters && this.filters.run === 'run';
    },

    chainLabel() {
      const chainKey = this.filters.chainKey || '';
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
      const chainKey = (this.filters.chainKey || '').toLowerCase();
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
    toggleDarkMode() {
      this.$root.filters.darkMode = !this.$root.filters.darkMode;

      // Apply theme immediately
      const theme = this.$root.filters.darkMode ? 'dark' : 'light';
      document.documentElement.setAttribute('data-bs-theme', theme);

      this.saveFilterChange('darkMode');
    },

    toggleRun() {
      this.$root.filters.run = this.$root.filters.run === 'run' ? 'stop' : 'run';
      this.saveFilterChange('run');
    },

    reloadData() {
      this.$root.reloadActiveTab();
    },

    saveFilterChange(filterType) {
      this.$root.saveFilterChange(filterType);
    },

    getChangeMessage(field, value) {
      const messages = {
        'darkMode': `Tema ${value ? 'Gelap 🌙' : 'Terang ☀️'} aktif`,
        'favoritOnly': `Filter Favorit ${value ? 'AKTIF ✓' : 'NONAKTIF ✗'}`,
        'autorun': `Auto Run ${value ? 'AKTIF ✓' : 'NONAKTIF ✗'}`,
        'autoscroll': `Auto Scroll ${value ? 'AKTIF ✓' : 'NONAKTIF ✗'}`,
        'minPnl': `Min PNL diubah menjadi ${value}%`,
        'run': `Pemindaian ${value === 'run' ? 'DIMULAI ▶' : 'DIHENTIKAN ■'}`
      };
      return messages[field] || 'Filter berhasil diubah';
    }
  }
};
