// components/common/filter-settings.js
// Vue Component untuk Filter Settings Panel
// REFACTORED: Menggunakan konsep filter sistematis dengan filterManagerMixin
// REVISI: Sembunyikan filter favorit di mode multichain

const FilterSettings = {
  name: 'FilterSettings',

  // REFACTORED: Gunakan filterManagerMixin untuk mengelola filter
  mixins: [window.filterManagerMixin],

  data() {
    return {
      // State untuk collapse/expand setiap card
      collapsed: {
        chain: false,
        cex: false,
        dex: false,
        pair: {}
      }
    };
  },

  template: `
    <div class="col-lg-2 mb-3 mb-lg-0 d-flex flex-column gap-3" v-if="shouldRenderSidebar" :class="{'sidebar-hidden': !showSidebar}">
      <!-- BAGIAN 1: MODE CHAIN - Selalu tampil di semua tab -->
      <div class="card card-soft chain-switcher-card" v-if="shouldShowModeChain" style="min-height: auto;">
        <div class="card-header filter-card-header text-center">
          <span class="fw-bold small text-dark text-uppercase">Mode Chain</span>
        </div>
        <div class="card-body p-2" style="max-height: none; overflow: visible;">
          <div class="chain-switcher d-flex flex-wrap justify-content-center gap-2">
            <div
              class="filter-item chain-switcher__item"
              :class="{checked: activeChain === 'multi'}"
              role="button"
              tabindex="0"
              title="Mode Multi-Chain"
              :aria-pressed="activeChain === 'multi'"
              @click="handleChainItemClick('multi')"
              @keydown.enter.prevent="handleChainItemClick('multi')"
              @keydown.space.prevent="handleChainItemClick('multi')">
              <span class="chain-nav-label">
                <i class="bi bi-stars fs-4"></i>
              </span>
              <span class="chain-switcher__caption">ALL</span>
            </div>
            <div
              v-for="chain in chainList"
              :key="'nav-' + chain.key"
              class="filter-item chain-switcher__item"
              :class="{
                checked: activeChain === chain.key,
                disabled: !isChainEnabled(chain.key)
              }"
              role="button"
              :tabindex="isChainEnabled(chain.key) ? 0 : -1"
              :title="'Mode ' + (chain.NAMA_CHAIN || chain.key.toUpperCase())"
              :aria-disabled="!isChainEnabled(chain.key)"
              :aria-pressed="activeChain === chain.key"
              @click="handleChainItemClick(chain.key)"
              @keydown.enter.prevent="handleChainItemClick(chain.key)"
              @keydown.space.prevent="handleChainItemClick(chain.key)">
              <span class="chain-nav-label">
                <img :src="chain.ICON" class="chain-nav-icon" :alt="(chain.NAMA_CHAIN || chain.key) + ' icon'">
              </span>
              <span class="chain-switcher__caption">{{ (chain.NAMA_PENDEK || chain.key || '').toString().toUpperCase() }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- BAGIAN 2: PILIHAN CHAIN - Hanya untuk mode multichain -->
      <div class="card card-soft filter-card" v-if="shouldShowChainFilter" style="min-height: auto;">
        <div class="card-header filter-card-header d-flex justify-content-between align-items-center"
             @click="collapsed.chain = !collapsed.chain"
             style="cursor: pointer;">
          <span class="fw-bold small text-uppercase text-dark">Pilihan Chain</span>
          
          <div class="d-flex align-items-center gap-2">
            <span class="badge bg-primary" v-if="showFilterCounts">{{ selectedChainCount }}/{{ availableChainFilters.length }}</span>
            <i class="bi" :class="collapsed.chain ? 'bi-chevron-down' : 'bi-chevron-up'"></i>
          </div>
        </div>
        <div class="card-body p-2" v-show="!collapsed.chain" style="max-height: 300px; overflow-y: auto;">
          <div class="vstack gap-1">
            <div v-for="chainKey in availableChainFilters" :key="'multichain-filter-' + chainKey" class="filter-item" :class="{checked: isFilterActive('chains', chainKey)}">
              <input type="checkbox" :id="'chain-check-' + chainKey" :checked="isFilterActive('chains', chainKey)" @change="toggleChainFilter(chainKey)">
              <label :for="'chain-check-' + chainKey" class="w-100 d-flex align-items-center gap-2" :style="getColorStyles('chain', chainKey, 'text')">
                <img :src="chainList.find(c => c.key === chainKey)?.ICON" class="chain-radio-btn-icon" alt="">
                {{ chainKey.toUpperCase() }} [{{ coinCountByChain[chainKey] || 0 }}]
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- BAGIAN 3: CEX FILTER -->
      <div class="card card-soft filter-card" v-if="shouldShowCEXFilter" style="min-height: auto;">
        <div class="card-header filter-card-header d-flex justify-content-between align-items-center"
             @click="collapsed.cex = !collapsed.cex"
             style="cursor: pointer;">
          <span class="fw-bold small text-uppercase text-dark">EXCHANGER (CEX)</span>
          <div class="d-flex align-items-center gap-2">
            <span class="badge bg-primary" v-if="showFilterCounts">{{ selectedCEXCount }}/{{ availableCEXFilters.length }}</span>
            <i class="bi" :class="collapsed.cex ? 'bi-chevron-down' : 'bi-chevron-up'"></i>
          </div>
        </div>
        <div class="card-body p-2" v-show="!collapsed.cex" style="max-height: 300px; overflow-y: auto;">
          <div class="vstack gap-1">
            <div v-for="cex in availableCEXFilters" :key="'cex-' + cex">
              <div class="filter-item" :class="{checked: isFilterActive('cex', cex)}">
                <input type="checkbox" :id="'cex-check-' + cex" :checked="isFilterActive('cex', cex)" @change="toggleCEXFilter(cex)">
                <label :for="'cex-check-' + cex" class="w-100" :style="getColorStyles('cex', cex, 'text')">
                  {{ cex.toUpperCase() }} [{{ coinCountByCex[cex.toLowerCase()] || 0 }}]
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- BAGIAN 4: DEX FILTER -->
      <div class="card card-soft filter-card" v-if="shouldShowDEXFilter" style="min-height: auto;">
        <div class="card-header filter-card-header d-flex justify-content-between align-items-center"
             @click="collapsed.dex = !collapsed.dex"
             style="cursor: pointer;">
          <span class="fw-bold small text-uppercase text-dark">PILIHAN DEX</span>
          <div class="d-flex align-items-center gap-2">
            <span class="badge bg-primary" v-if="showFilterCounts">{{ selectedDEXCount }}/{{ availableDEXFilters.length }}</span>
            <i class="bi" :class="collapsed.dex ? 'bi-chevron-down' : 'bi-chevron-up'"></i>
          </div>
        </div>
        <div class="card-body p-2" v-show="!collapsed.dex" style="max-height: 300px; overflow-y: auto;">
          <div class="vstack gap-1">
            <div v-for="dex in availableDEXFilters" :key="'dex-' + dex">
              <div class="filter-item" :class="{checked: isFilterActive('dex', dex)}">
                <input type="checkbox" :id="'dex-check-' + dex" :checked="isFilterActive('dex', dex)" @change="toggleDEXFilter(dex)">
                <label :for="'dex-check-' + dex" class="w-100" :style="getColorStyles('dex', dex, 'text')">
                  {{ dex.toUpperCase() }} [{{ coinCountByDex[dex] || 0 }}]
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- BAGIAN 5: PAIR DEX FILTER -->
      <template v-if="shouldShowPairFilter">
        <div class="card card-soft filter-card"
             v-for="chainGroup in groupedPairsByChain"
             :key="'pair-card-' + chainGroup.chainKey"
             style="min-height: auto;">
          <div class="card-header filter-card-header d-flex justify-content-between align-items-center"
               @click="togglePairCollapse(chainGroup.chainKey)"
               style="cursor: pointer;">
            <div class="d-flex align-items-center gap-2">
              <img v-if="chainGroup.icon" :src="chainGroup.icon" class="chain-radio-btn-icon" :alt="chainGroup.label + ' icon'">
              <span class="fw-bold small text-uppercase text-dark">PAIRDEX {{ chainGroup.label }}</span>
            </div>
            <div class="d-flex align-items-center gap-2">
              <span class="badge bg-primary" v-if="showFilterCounts">{{ chainGroup.totalCount }}</span>
              <i class="bi" :class="isPairCollapsed(chainGroup.chainKey) ? 'bi-chevron-down' : 'bi-chevron-up'"></i>
            </div>
          </div>
          <div class="card-body p-2"
               v-show="!isPairCollapsed(chainGroup.chainKey)"
               style="max-height: 300px; overflow-y: auto;">
            <div class="vstack gap-1">
              <div v-for="pair in chainGroup.pairs" :key="chainGroup.chainKey + '-' + pair.key">
                <div class="filter-item" :class="{checked: isFilterActive('pairs', pair.key)}">
                  <input
                    type="checkbox"
                    v-if="!isMultiChainMode"
                    :id="'pair-check-' + chainGroup.chainKey + '-' + pair.key"
                    :checked="isFilterActive('pairs', pair.key)"
                    @change="togglePairFilter(pair.key)">
                  <label :for="'pair-check-' + chainGroup.chainKey + '-' + pair.key"
                         class="w-100 d-flex justify-content-between align-items-center">
                    <span class="fw-semibold text-uppercase">{{ pair.key }}</span>
                    <span class="badge bg-light text-dark border" v-if="showFilterCounts">{{ pair.count }}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

  `,

  computed: {
    isMultiChainMode() {
      return this.activeChain === 'multi';
    },

    groupedPairsByChain() {
      const chainGroups = {};
      const chainConfigs = this.$root?.config?.CHAINS || {};

      (this.$root.pairList || []).forEach(pair => {
        pair.chains.forEach(chainInfo => {
          const chainKey = chainInfo.key;
          if (!chainGroups[chainKey]) {
            const chainConfig = chainConfigs[chainKey] || {};
            chainGroups[chainKey] = {
              chainKey,
              label: chainInfo.label || chainConfig.NAMA_CHAIN || chainKey.toUpperCase(),
              icon: chainInfo.icon || chainConfig.ICON || null,
              totalCount: 0,
              pairs: []
            };
          }

          chainGroups[chainKey].pairs.push({
            key: pair.key,
            count: chainInfo.count
          });
          chainGroups[chainKey].totalCount += Number(chainInfo.count) || 0;
        });
      });

      return Object.values(chainGroups)
        .map(group => ({
          ...group,
          pairs: group.pairs.sort((a, b) => a.key.localeCompare(b.key))
        }))
        .filter(group => group.pairs.length > 0)
        .sort((a, b) => a.label.localeCompare(b.label));
    },

    showFilterCounts() {
      // REVISI: Selalu tampilkan jumlah koin di semua mode.
      // Logika sebelumnya menyembunyikan count di mode multichain.
      return true;
    },

    // Status visibility sidebar dari parent
    showSidebar() {
      return this.$parent.showFilterSidebar !== false;
    },

    // BAGIAN 1: MODE CHAIN - Selalu tampil di semua tab
    shouldShowModeChain() {
      return Array.isArray(this.chainList) && this.chainList.length > 0;
    },

    // BAGIAN 2: PILIHAN CHAIN - hanya tampil pada tab scan & manajemen
    shouldShowChainFilter() {
      const activeTab = this.$parent.activeTab;
      const allowedTabs = ['scan', 'manajemen'];
      return allowedTabs.includes(activeTab) && this.isMultiChainMode && this.availableChainFilters.length > 0;
    },

    // BAGIAN 3: CEX FILTER - Tampil kondisional
    shouldShowCEXFilter() {
      const activeTab = this.$parent.activeTab;
      const allowedTabs = ['scan', 'manajemen'];
      return allowedTabs.includes(activeTab) && this.availableCEXFilters.length > 0;
    },

    // BAGIAN 4: DEX FILTER - Tampil kondisional
    shouldShowDEXFilter() {
      const activeTab = this.$parent.activeTab;
      const allowedTabs = ['scan', 'manajemen'];
      return allowedTabs.includes(activeTab) && this.availableDEXFilters.length > 0;
    },

    // BAGIAN 5: PAIR DEX FILTER - Tampil kondisional
    shouldShowPairFilter() {
      const activeTab = this.$parent.activeTab;
      const allowedTabs = ['scan', 'manajemen'];
      return allowedTabs.includes(activeTab) && this.groupedPairsByChain.length > 0;
    },

    // Sidebar render jika salah satu bagian perlu ditampilkan
    shouldRenderSidebar() {
      return this.shouldShowModeChain || this.shouldShowChainFilter || this.shouldShowCEXFilter || this.shouldShowDEXFilter || this.shouldShowPairFilter;
    },

    // COUNTER: Hitung berapa yang dipilih untuk setiap filter
    // Data diambil dari currentFilterSettings (dari IndexedDB via $root.filterSettings)
    selectedChainCount() {
      const filters = this.currentFilterSettings?.chains || {};
      return Object.keys(filters).filter(key => filters[key] === true).length;
    },

    selectedCEXCount() {
      const filters = this.currentFilterSettings?.cex || {};
      return Object.keys(filters).filter(key => filters[key] === true).length;
    },

    selectedDEXCount() {
      const filters = this.currentFilterSettings?.dex || {};
      return Object.keys(filters).filter(key => filters[key] === true).length;
    },

    selectedPairCount() {
      const filters = this.currentFilterSettings?.pairs || {};
      return Object.keys(filters).filter(key => filters[key] === true).length;
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
    }
  },

  methods: {
    handleChainItemClick(chainKey) {
      const normalizedKey = chainKey.toLowerCase();
      if (!this.isChainEnabled(normalizedKey) || this.activeChain === normalizedKey) return;
      // REVISI: Panggil metode setActiveChain dari root component (app.js)
      this.$root.setActiveChain(normalizedKey);
    },
    isChainEnabled(chainKey) {
      if (!chainKey) return false;
      if (chainKey === 'multi') return true;

      const normalized = chainKey.toString().toLowerCase();
      const config = this.globalSettings?.config_chain?.[normalized];
      if (config === undefined) return true;
      return config.status !== false;
    },
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
    },
    isPairCollapsed(chainKey) {
      if (!chainKey) return false;
      return this.collapsed.pair?.[chainKey] === true;
    },
    togglePairCollapse(chainKey) {
      if (!chainKey) return;
      const current = this.collapsed.pair?.[chainKey] === true;
      this.collapsed.pair = {
        ...(this.collapsed.pair || {}),
        [chainKey]: !current
      };
    }
  }
};
