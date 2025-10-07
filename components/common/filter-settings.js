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

        <div class="card-body p-2">
          <div class="accordion accordion-flush filter-accordion" id="filterAccordion">
            <!-- Chain Filter Section -->
            <div class="accordion-item" v-if="availableChainFilters.length > 0" :style="getAccordionItemStyles()">
              <h2 class="accordion-header" id="headingChain">
                <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapseChain" aria-expanded="true" aria-controls="collapseChain" :style="getAccordionHeaderStyles()">
                  Chain ({{ availableChainFilters.length }})
                </button>
              </h2>
              <div id="collapseChain" class="accordion-collapse collapse show" aria-labelledby="headingChain" data-bs-parent="#filterAccordion">
                <div class="accordion-body" :style="getAccordionBodyStyles()">
                  <div class="row g-2 row-cols-1 row-cols-sm-2 row-cols-lg-1">
                    <!-- Opsi untuk Multi Chain -->
                    <div class="col">
                      <div class="filter-item text-success" :class="{checked: activeChain === 'multi'}">
                        <input type="radio" name="chain-filter-radio" id="chain-radio-multi" value="multi" v-model="activeChain">
                        <label for="chain-radio-multi" class="w-100 d-flex align-items-center gap-2">
                          <i class="bi bi-stars"></i> MULTICHAIN
                        </label>
                      </div>
                    </div>
                    <!-- Opsi untuk setiap chain -->
                    <div v-for="chainKey in availableChainFilters" :key="'filter-' + chainKey" class="col">
                      <div class="filter-item" :class="{checked: activeChain === chainKey}">
                        <input type="radio" name="chain-filter-radio" :id="'chain-radio-' + chainKey" :value="chainKey" v-model="activeChain">
                        <label :for="'chain-radio-' + chainKey" class="w-100 d-flex align-items-center gap-2" :style="getColorStyles('chain', chainKey, 'text')">
                          <img :src="chainList.find(c => c.key === chainKey)?.ICON" class="chain-radio-btn-icon" alt="">
                          {{ chainKey.toUpperCase() }} [{{ coinCountByChain[chainKey] || 0 }}]
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- CEX Filter Section - Disabled di mode multi -->
            <div class="accordion-item" v-if="availableCEXFilters.length > 0 && activeChain !== 'multi'" :style="getAccordionItemStyles()">
              <h2 class="accordion-header" id="headingCex">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseCex" aria-expanded="false" aria-controls="collapseCex" :style="getAccordionHeaderStyles()">
                  Exchanger (CEX) ({{ availableCEXFilters.length }})
                </button>
              </h2>
              <div id="collapseCex" class="accordion-collapse collapse" aria-labelledby="headingCex" data-bs-parent="#filterAccordion">
                <div class="accordion-body" :style="getAccordionBodyStyles()">
                  <div class="row g-2 row-cols-1 row-cols-sm-2 row-cols-lg-1">
                    <div v-for="cex in availableCEXFilters" :key="'cex-' + cex" class="col">
                      <div class="filter-item" :class="{checked: isFilterActive('cex', cex)}">
                        <input type="checkbox" :checked="isFilterActive('cex', cex)" @change="toggleCEXFilter(cex)">
                        <span :style="getColorStyles('cex', cex, 'text')">
                          {{ cex.toUpperCase() }} [{{ coinCountByCex[cex.toLowerCase()] || 0 }}]
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- DEX Filter Section - Disabled di mode multi -->
            <div class="accordion-item" v-if="availableDEXFilters.length > 0 && activeChain !== 'multi'" :style="getAccordionItemStyles()">
              <h2 class="accordion-header" id="headingDex">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseDex" aria-expanded="false" aria-controls="collapseDex" :style="getAccordionHeaderStyles()">
                  DEX ({{ availableDEXFilters.length }})
                </button>
              </h2>
              <div id="collapseDex" class="accordion-collapse collapse" aria-labelledby="headingDex" data-bs-parent="#filterAccordion">
                <div class="accordion-body" :style="getAccordionBodyStyles()">
                  <div class="row g-2 row-cols-1 row-cols-sm-2 row-cols-lg-1">
                    <div v-for="dex in availableDEXFilters" :key="'dex-' + dex" class="col">
                      <div class="filter-item" :class="{checked: isFilterActive('dex', dex)}">
                        <input type="checkbox" :checked="isFilterActive('dex', dex)" @change="toggleDEXFilter(dex)">
                        <span :style="getColorStyles('dex', dex, 'text')">
                          {{ dex.toUpperCase() }} [{{ coinCountByDex[dex] || 0 }}]
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Pairs Filter Section - Disabled di mode multi -->
            <div class="accordion-item" v-if="$root.pairList.length > 0 && activeChain !== 'multi'" :style="getAccordionItemStyles()">
              <h2 class="accordion-header" id="headingPair">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapsePair" aria-expanded="false" aria-controls="collapsePair" :style="getAccordionHeaderStyles()">
                  PAIR DEX ({{ $root.pairList.length }})
                </button>
              </h2>
              <div id="collapsePair" class="accordion-collapse collapse" aria-labelledby="headingPair" data-bs-parent="#filterAccordion">
                <div class="accordion-body" :style="getAccordionBodyStyles()">
                  <div class="row g-2 row-cols-1 row-cols-sm-2 row-cols-lg-1">
                    <div v-for="pairKey in $root.pairList" :key="pairKey" class="col">
                      <div class="filter-item" :class="{checked: isFilterActive('pairs', pairKey)}">
                        <input type="checkbox" :checked="isFilterActive('pairs', pairKey)" @change="togglePairFilter(pairKey)">
                        <span>
                          {{ pairKey.toUpperCase() }} [{{ coinCountByPair[pairKey.toUpperCase()] || 0 }}]
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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

    // Chain data dari parent
    activeChain: {
      get() {
        return this.$root.activeChain;
      },
      set(value) {
        this.$root.activeChain = value;
      }
    },

    chainList() {
      return this.$root.chainList || [];
    },

    activeChains() {
      return this.$root.activeChains || [];
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
    getAccordionItemStyles() {
      // Menggunakan warna border dari chain yang aktif
      const themeColorInfo = this.$root.getColorInfo('chain', this.activeChain);
      return {
        '--bs-accordion-border-color': `rgba(${themeColorInfo.rgb}, 0.4)`
      };
    },
    getAccordionHeaderStyles() {
      // Menggunakan warna solid dari chain yang aktif sebagai background header
      return this.$root.getColorStyles('chain', this.activeChain, 'solid');
    },
    getAccordionBodyStyles() {
      // Menggunakan warna soft dari chain yang aktif sebagai background body
      return this.$root.getColorStyles('chain', this.activeChain, 'soft');
    }
  }
};
