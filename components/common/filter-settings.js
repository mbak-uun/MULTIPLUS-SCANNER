// components/common/filter-settings.js
// Vue Component untuk Filter Settings Panel

const FilterSettings = {
  name: 'FilterSettings',

  template: ` 
    <div class="col-lg-2 mb-3 mb-lg-0" v-if="shouldShowFilterPanel">
      <div class="card card-soft h-100">
        <div class="card-header filter-card-header">
          <span>PILIHAN FILTERING</span>
        </div>
        <div class="card-body">
          <!-- Chain Filter Section -->
          <fieldset class="filter-fieldset"
                    v-if="activeChain === 'multi' && activeChains.length > 0" :class="{ 'bg-transparent': isDarkMode }">
            <legend>Chain ({{ activeChains.length }})</legend>
            <div class="row g-2 row-cols-1 row-cols-sm-2 row-cols-lg-1">
              <div v-for="chainKey in activeChains"
                     :key="'filter-' + chainKey"
                     class="col">
                <div class="filter-item"
                     :class="{checked: filters.chains[chainKey]}"
                     :style="getColorStyles('chain', chainKey, filters.chains[chainKey] ? 'solid' : 'soft')">
                  <input type="checkbox" v-model="filters.chains[chainKey]" @change="saveFilterChange('chains')">
                  <span>{{ chainKey.toUpperCase() }} [{{ coinCountByChain[chainKey] || 0 }}]</span>
                </div>
              </div>
            </div>
          </fieldset>

          <!-- CEX Filter Section -->
          <fieldset class="filter-fieldset" v-if="activeCEXs.length > 0" :class="{ 'bg-transparent': isDarkMode }">
            <legend>Exchanger (CEX) ({{ activeCEXs.length }})</legend>
            <div class="row g-2 row-cols-1 row-cols-sm-2 row-cols-lg-1" v-if="filters.cex">
              <div v-for="cex in activeCEXs"
                     :key="'cex-' + cex"
                     class="col">
                <div class="filter-item"
                     :class="{checked: filters.cex[cex]}"
                     :style="getColorStyles('cex', cex, filters.cex[cex] ? 'solid' : 'soft')">
                  <input type="checkbox" v-model="filters.cex[cex]" @change="saveFilterChange('cex')">
                  <span>{{ cex.toUpperCase() }} [{{ coinCountByCex[cex.toLowerCase()] || 0 }}]</span>
                </div>
              </div>
            </div>
          </fieldset>

          <!-- DEX Filter Section -->
          <fieldset class="filter-fieldset" v-if="activeDEXs.length > 0" :class="{ 'bg-transparent': isDarkMode }">
            <legend>DEX ({{ activeDEXs.length }})</legend>
            <div class="row g-2 row-cols-1 row-cols-sm-2 row-cols-lg-1" v-if="filters.dex">
              <div v-for="dex in activeDEXs"
                     :key="'dex-' + dex"
                     class="col">
                <div class="filter-item"
                     :class="{checked: filters.dex[dex]}"
                     :style="getColorStyles('dex', dex, filters.dex[dex] ? 'solid' : 'soft')">
                  <input type="checkbox" v-model="filters.dex[dex]" @change="saveFilterChange('dex')">
                  <span>{{ dex.toUpperCase() }} [{{ coinCountByDex[dex] || 0 }}]</span>
                </div>
              </div>
            </div>
          </fieldset>

          <!-- Pairs Filter Section -->
          <div class="filter-section">
            <!-- Loop luar untuk setiap chain dalam pairList -->
            <fieldset class="filter-fieldset pair-group"
                      v-for="(pairs, chainKey) in pairList" :class="{ 'bg-transparent': isDarkMode }"
                      :key="chainKey">
              <legend :style="getColorStyles('chain', chainKey, 'text')">
                PAIR DEX {{ chainKey.toUpperCase() }}
              </legend>
              <div class="row g-2 row-cols-1 row-cols-sm-2 row-cols-lg-1">
                <!-- Loop dalam untuk setiap pair dalam chain -->
                <div v-for="uniquePairKey in pairs"
                     :key="uniquePairKey"
                     class="col">
                  <div class="filter-item"
                       :class="{checked: filters.pairs[uniquePairKey]}"
                       :style="getPairColorStyles(uniquePairKey, filters.pairs[uniquePairKey])">

                  <!-- Binding yang disederhanakan, berfungsi untuk kedua mode -->
                  <input type="checkbox"
                         v-model="filters.pairs[uniquePairKey]"
                         @change="saveFilterChange('pairs')">

                  <span>{{ uniquePairKey.split('.')[1] }} [{{ coinCountByPair[uniquePairKey.toLowerCase()] || 0 }}]</span>
                  </div>
                </div>
              </div>
            </fieldset>
          </div>
        </div>
      </div>
    </div>
  `,

  computed: {
    shouldShowFilterPanel() {
      return this.$parent.shouldShowFilterPanel;
    },
    activeChain() {
      return this.$parent.activeChain;
    },
    activeChains() {
      return this.$parent.activeChains;
    },
    activeCEXs() {
      return this.$parent.activeCEXs;
    },
    activeDEXs() {
      return this.$parent.activeDEXs;
    },
    isDarkMode() {
      return this.$parent.isDarkMode;
    },
    filters() {
      return this.$parent.filters;
    },
    pairList() {
      return this.$parent.pairList;
    },
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
      return this.$parent.getColorStyles(type, key, variant);
    },
    getPairColorStyles(uniquePairKey, isChecked) {
      return this.$parent.getPairColorStyles(uniquePairKey, isChecked);
    },

    async saveFilterChange(filterType) {
      // REVISI: Panggil metode terpusat yang sudah ada di root component (app.js)
      this.$root.saveFilterChange(filterType);
    }
  }
};
