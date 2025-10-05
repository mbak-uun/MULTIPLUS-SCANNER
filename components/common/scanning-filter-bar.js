// components/common/scanning-filter-bar.js
// Filter Bar untuk Tab Scanning

const ScanningFilterBar = {
  name: 'ScanningFilterBar',

  template: `
    <div class="tab-toolbar">
      <div class="tab-toolbar__left">
        <h6 class="tab-toolbar__title">
          <i class="bi bi-radar"></i>
          Scanning Control
        </h6>

        <!-- Toggles -->
        <label class="filter-toggle-simple" :class="{active: filters.favoritOnly}">
          <input type="checkbox" v-model="filters.favoritOnly" @change="saveFilterChange('favoritOnly')">
          <i class="bi bi-star-fill text-warning"></i>
          Favorite
        </label>

        <label class="tab-toolbar__toggle" :class="{active: filters.autorun}">
          <input type="checkbox" v-model="filters.autorun" @change="saveFilterChange('autorun')">
          <i class="bi bi-play-circle"></i>
          Auto Run
        </label>

        <label class="tab-toolbar__toggle" :class="{active: filters.autoscroll}">
          <input type="checkbox" v-model="filters.autoscroll" @change="saveFilterChange('autoscroll')">
          <i class="bi bi-arrow-down-circle"></i>
          Auto Scroll
        </label>

        <div class="tab-toolbar__divider"></div>

        <!-- REVISI: Tambahkan input pencarian di sini -->
        <div class="tab-toolbar__search">
          <div class="input-group input-group-sm">
            <span class="input-group-text">
              <i class="bi bi-search"></i>
            </span>
            <input type="text" class="form-control" placeholder="Cari token..."
                   v-model="searchQuery">
          </div>
        </div>

        <!-- Search & PNL Filter -->
        <div class="tab-toolbar__search">
          <div class="input-group input-group-sm">
            <span class="input-group-text">
              <i class="bi bi-percent"></i>
            </span>
            <input type="number" class="form-control" placeholder="Min PNL"
                   v-model.number="filters.minPnl" @change="saveFilterChange('minPnl')"
                   step="0.1" min="0" style="width: 100px;">
          </div>
        </div>
      </div>

      <div class="tab-toolbar__right">
        <!-- Sorting Info -->
        <span class="tab-toolbar__info" v-if="filterSettings.sortDirection">
          <i class="bi" :class="filterSettings.sortDirection === 'desc' ? 'bi-arrow-down' : 'bi-arrow-up'"></i>
          Sort: {{ filterSettings.sortDirection.toUpperCase() }}
        </span>

        <!-- Progress (saat scanning) -->
        <div v-if="isScanning" class="progress" style="width: 140px; height: 32px; border-radius: var(--radius-lg);">
          <div class="progress-bar progress-bar-striped progress-bar-animated"
               :style="{background: 'var(--brand)'}"
               role="progressbar" style="width: 100%">
            <small class="fw-semibold">Scanning...</small>
          </div>
        </div>

        <!-- Start/Stop Button -->
        <button class="tab-btn"
                :class="filters.run === 'run' ? 'tab-btn--danger' : 'tab-btn--success'"
                @click="toggleRun">
          <i :class="filters.run === 'run' ? 'bi bi-stop-circle-fill' : 'bi bi-play-circle-fill'"></i>
          {{ filters.run === 'run' ? 'STOP' : 'START' }}
        </button>
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
    // REVISI: Ambil dan set searchQuery dari root component
    searchQuery: {
      get() { return this.$root.searchQuery; },
      set(value) { this.$root.searchQuery = value; }
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
