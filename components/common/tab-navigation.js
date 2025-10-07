// components/common/tab-navigation.js
// Vue Component untuk Tab Navigation

const TabNavigation = {
  name: 'TabNavigation',

  template: `
    <div class="card card-soft mb-3">
      <div class="card-body py-2">
        <div class="row g-2 align-items-center">
          <div class="col-12 col-md-auto" v-if="['scan', 'manajemen'].includes(activeTab)">
            <div class="d-grid">
              <button
                @click="toggleFilterSidebar"
                class="btn btn-sm btn-outline-secondary filter-toggle-btn"
                :title="showFilterSidebar ? 'Sembunyikan Filter' : 'Tampilkan Filter'">
                <i class="bi bi-arrow-left-right"></i>
              </button>
            </div>
          </div>
          <div class="col-12 col-md">
            <ul class="nav nav-pills subtab justify-content-center justify-content-md-start flex-wrap gap-1">
              <li class="nav-item">
                <a href="?mode=scan" class="nav-link"
                        :class="{active: activeTab === 'scan'}"
                        @click.prevent="setActiveTab('scan')">
                  <i class="bi bi-search"></i> Scanning Harga
                </a>
              </li>
              <li class="nav-item" v-if="activeChain !== 'multi'">
                <a href="?mode=manajemen" class="nav-link"
                        :class="{active: activeTab === 'manajemen'}"
                        @click.prevent="setActiveTab('manajemen')">
                  <i class="bi bi-coin"></i> Manajemen Koin
                </a>
              </li>
              <li class="nav-item" v-if="activeChain !== 'multi'">
                <a href="?mode=sync" class="nav-link"
                        :class="{active: activeTab === 'sync'}"
                        @click.prevent="setActiveTab('sync')">
                  <i class="bi bi-arrow-repeat"></i> Sinkronisasi Koin
                </a>
              </li>
              <li class="nav-item">
                <a href="?mode=wallet" class="nav-link"
                        :class="{active: activeTab === 'wallet'}"
                        @click.prevent="setActiveTab('wallet')">
                  <i class="bi bi-wallet2"></i> Dompet Exchanger
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `,

  computed: {
    activeTab() {
      return this.$parent.activeTab;
    },
    showFilterSidebar() {
      return this.$parent.showFilterSidebar;
    },
    activeChain() {
      return this.$parent.activeChain;
    },
    // REVISI: Menambahkan computed property untuk warna latar belakang indikator
    activeChainColor() {
      if (this.activeChain === 'multi') {
        return { 'background-color': 'var(--bs-gray-600)' };
      }
      return this.$parent.getColorStyles('chain', this.activeChain, 'solid');
    }
  },

  methods: {
    setActiveTab(tab) {
      // Jika tab yang diklik sama dengan tab yang sedang aktif, reload halaman
      if (this.activeTab === tab) {
        window.location.reload();
      } else {
        this.$parent.setActiveTab(tab);
      }
    },
    toggleFilterSidebar() {
      this.$parent.showFilterSidebar = !this.$parent.showFilterSidebar;
    }
  }
};
