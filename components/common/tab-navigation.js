// components/common/tab-navigation.js
// Vue Component untuk Tab Navigation

const TabNavigation = {
  name: 'TabNavigation',

  template: `
    <div class="card card-soft mb-3">
      <div class="card-body py-2">
        <div class="row g-2 align-items-center">
          <!-- Toggle Button Sidebar - Tampil di semua tab -->
          <div class="col-auto">
            <button
              @click="toggleFilterSidebar"
              class="btn btn-sm sidebar-toggle-btn"
              :class="showFilterSidebar ? 'btn-light' : 'btn-dark'"
              :title="showFilterSidebar ? 'Sembunyikan Sidebar' : 'Tampilkan Sidebar'">
              <i class="bi" :class="showFilterSidebar ? 'bi-box-arrow-left' : 'bi-box-arrow-right'"></i>
            </button>
          </div>

          <!-- Tab Navigation -->
          <div class="col">
            <ul class="nav nav-pills subtab justify-content-center justify-content-md-start flex-wrap gap-1">
              <!-- Tab Scan - Selalu tampil -->
              <li class="nav-item">
                <a href="?mode=scan" class="nav-link"
                        :class="{active: activeTab === 'scan'}"
                        @click.prevent="setActiveTab('scan')">
                  <i class="bi bi-search"></i> Scanning Harga
                </a>
              </li>

              <!-- Tab Manajemen - disembunyikan saat mode multichain -->
              <li class="nav-item" v-if="!isMultiChainMode">
                <a href="?mode=manajemen" class="nav-link"
                        :class="{active: activeTab === 'manajemen'}"
                        @click.prevent="setActiveTab('manajemen')">
                  <i class="bi bi-coin"></i> Manajemen Koin
                </a>
              </li>

              <!-- Tab Sinkronisasi - disembunyikan saat mode multichain -->
              <li class="nav-item" v-if="!isMultiChainMode">
                <a href="?mode=sync" class="nav-link"
                        :class="{active: activeTab === 'sync'}"
                        @click.prevent="setActiveTab('sync')">
                  <i class="bi bi-arrow-repeat"></i> Sinkronisasi Koin
                </a>
              </li>

              <!-- Tab Dompet - Selalu tampil -->
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
    isMultiChainMode() {
      return this.activeChain === 'multi';
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
