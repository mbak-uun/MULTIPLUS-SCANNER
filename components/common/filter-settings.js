// components/common/filter-settings.js
// Vue Component untuk Filter Settings Panel
// REFACTORED: Menggunakan konsep filter sistematis dengan filterManagerMixin

const FilterSettings = {
  name: 'FilterSettings',

  // REFACTORED: Gunakan filterManagerMixin untuk mengelola filter
  mixins: [window.filterManagerMixin],

  template: `
    <div class="col-lg-2 mb-3 mb-lg-0" v-if="shouldShowFilterPanel">
      <div class="card card-soft h-100">
        <div class="card-header filter-card-header">
          <span>PILIHAN FILTERING</span>
        </div>
        <div class="card-body">
          <!-- Chain Filter Section -->
          <!-- REFACTORED: Hanya tampil untuk mode multi, data dari availableChainFilters -->
          <fieldset class="filter-fieldset"
                    v-if="activeChain === 'multi' && availableChainFilters.length > 0"
                    :class="{ 'bg-transparent': isDarkMode }">
            <legend>
              Chain ({{ availableChainFilters.length }})
              <button type="button" class="btn btn-xs btn-link p-0 ms-1" @click="selectAllFilters('chains')" title="Select All">✓</button>
              <button type="button" class="btn btn-xs btn-link p-0" @click="deselectAllFilters('chains')" title="Clear">✗</button>
            </legend>
            <div class="row g-2 row-cols-1 row-cols-sm-2 row-cols-lg-1">
              <div v-for="chainKey in availableChainFilters"
                     :key="'filter-' + chainKey"
                     class="col">
                <div class="filter-item"
                     :class="{checked: isFilterActive('chains', chainKey)}">
                  <input type="checkbox"
                         :checked="isFilterActive('chains', chainKey)"
                         @change="toggleChainFilter(chainKey)">
                  <span :style="getColorStyles('chain', chainKey, 'text')">
                    {{ chainKey.toUpperCase() }} [{{ coinCountByChain[chainKey] || 0 }}]
                  </span>
                </div>
              </div>
            </div>
          </fieldset>

          <!-- CEX Filter Section -->
          <!-- REFACTORED: Data dari availableCEXFilters (yang aktif di SETTING_GLOBAL) -->
          <fieldset class="filter-fieldset"
                    v-if="availableCEXFilters.length > 0"
                    :class="{ 'bg-transparent': isDarkMode }">
            <legend>
              Exchanger (CEX) ({{ availableCEXFilters.length }})
              <button type="button" class="btn btn-xs btn-link p-0 ms-1" @click="selectAllFilters('cex')" title="Select All">✓</button>
              <button type="button" class="btn btn-xs btn-link p-0" @click="deselectAllFilters('cex')" title="Clear">✗</button>
            </legend>
            <div class="row g-2 row-cols-1 row-cols-sm-2 row-cols-lg-1">
              <div v-for="cex in availableCEXFilters"
                     :key="'cex-' + cex"
                     class="col">
                <div class="filter-item"
                     :class="{checked: isFilterActive('cex', cex)}">
                  <input type="checkbox"
                         :checked="isFilterActive('cex', cex)"
                         @change="toggleCEXFilter(cex)">
                  <span :style="getColorStyles('cex', cex, 'text')">
                    {{ cex.toUpperCase() }} [{{ coinCountByCex[cex.toLowerCase()] || 0 }}]
                  </span>
                </div>
              </div>
            </div>
          </fieldset>

          <!-- DEX Filter Section -->
          <!-- REFACTORED: Data dari availableDEXFilters (yang aktif di SETTING_GLOBAL) -->
          <fieldset class="filter-fieldset"
                    v-if="availableDEXFilters.length > 0"
                    :class="{ 'bg-transparent': isDarkMode }">
            <legend>
              DEX ({{ availableDEXFilters.length }})
              <button type="button" class="btn btn-xs btn-link p-0 ms-1" @click="selectAllFilters('dex')" title="Select All">✓</button>
              <button type="button" class="btn btn-xs btn-link p-0" @click="deselectAllFilters('dex')" title="Clear">✗</button>
            </legend>
            <div class="row g-2 row-cols-1 row-cols-sm-2 row-cols-lg-1">
              <div v-for="dex in availableDEXFilters"
                     :key="'dex-' + dex"
                     class="col">
                <div class="filter-item"
                     :class="{checked: isFilterActive('dex', dex)}">
                  <input type="checkbox"
                         :checked="isFilterActive('dex', dex)"
                         @change="toggleDEXFilter(dex)">
                  <span :style="getColorStyles('dex', dex, 'text')">
                    {{ dex.toUpperCase() }} [{{ coinCountByDex[dex] || 0 }}]
                  </span>
                </div>
              </div>
            </div>
          </fieldset>

          <!-- Pairs Filter Section -->
          <!-- REFACTORED: Data dari availablePairFilters (yang digunakan di KOIN_<CHAIN>) -->
          <div class="filter-section" v-if="availablePairFilters.length > 0">
            <fieldset class="filter-fieldset pair-group"
                      :class="{ 'bg-transparent': isDarkMode }">
              <legend :style="getColorStyles('chain', activeChain, 'text')">
                PAIR DEX {{ activeChain.toUpperCase() }} ({{ availablePairFilters.length }})
                <button type="button" class="btn btn-xs btn-link p-0 ms-1" @click="selectAllFilters('pairs')" title="Select All">✓</button>
                <button type="button" class="btn btn-xs btn-link p-0" @click="deselectAllFilters('pairs')" title="Clear">✗</button>
              </legend>
              <div class="row g-2 row-cols-1 row-cols-sm-2 row-cols-lg-1">
                <div v-for="pair in availablePairFilters"
                     :key="pair.key"
                     class="col">
                  <div class="filter-item"
                       :class="{checked: isFilterActive('pairs', pair.key)}">
                    <input type="checkbox"
                           :checked="isFilterActive('pairs', pair.key)"
                           @change="togglePairFilter(pair.key)">
                    <span :style="getColorStyles('chain', activeChain, 'text')">
                      {{ pair.symbol || pair.key }} [{{ getPairCount(pair) }}]
                    </span>
                  </div>
                </div>
              </div>
            </fieldset>
          </div>

          <!-- Empty State -->
          <div v-if="!availableCEXFilters.length && !availableDEXFilters.length && !availablePairFilters.length"
               class="text-center text-muted py-3">
            <small>Tidak ada filter yang tersedia</small>
          </div>
        </div>
      </div>
    </div>
  `,

  computed: {
    // Tetap ambil dari parent untuk backward compatibility
    shouldShowFilterPanel() {
      return this.$parent.shouldShowFilterPanel;
    },

    isDarkMode() {
      return this.$parent.isDarkMode;
    },

    // Coin counts dari parent
    coinCountByChain() {
      return this.$parent.coinCountByChain || {};
    },
    coinCountByCex() {
      return this.$parent.coinCountByCex || {};
    },
    coinCountByDex() {
      return this.$parent.coinCountByDex || {};
    },
    coinCountByPair() {
      return this.$parent.coinCountByPair || {};
    }
  },

  methods: {
    getColorStyles(type, key, variant) {
      // Delegate ke parent atau root
      return this.$parent.getColorStyles?.(type, key, variant) || this.$root.getColorStyles?.(type, key, variant) || {};
    },

    getPairCount(pair) {
      // Hitung berdasarkan coinCountByPair
      const pairKey = `${this.activeChain}.${pair.key}`.toLowerCase();
      return this.coinCountByPair[pairKey] || 0;
    }
  }
};
