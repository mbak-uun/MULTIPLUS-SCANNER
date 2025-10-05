// assets/js/mixins/router.js

const routerMixin = {
  methods: {
    processURLParams() {
      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get('mode');
      const chainParam = params.get('chain');

      if (chainParam && (this.config.CHAINS[chainParam] || chainParam === 'multi')) {
        this.activeChain = chainParam;
      }

      const validTabs = ['scan', 'manajemen', 'sync', 'wallet'];
      const validMenus = ['db', 'settings', 'history', 'portfolio'];

      if (modeParam) {
        if (validTabs.includes(modeParam)) {
          this.activeMenu = 'mode';
          this.activeTab = modeParam;
        } else if (validMenus.includes(modeParam)) {
          this.activeMenu = modeParam;
        }
      }
    },
    updateURL(key, value) {
      const url = new URL(window.location);
      url.searchParams.set(key, value);
      window.history.pushState({}, '', url);
    },
    setActiveMenu(menu, defaultTab = null) {
      // Jika menu yang diklik berbeda dengan menu aktif, reload untuk konsistensi data
      if (this.activeMenu !== menu) {
        const newMode = menu === 'mode' ? (defaultTab || this.activeTab) : menu;
        this.updateURL('mode', newMode);

        // Tampilkan overlay loading
        this.isLoading = true;
        this.loadingText = 'Memuat halaman...';

        // Reload halaman untuk refresh data
        setTimeout(() => {
          window.location.reload();
        }, 200);
      } else {
        // Jika menu sama, hanya update tab jika ada defaultTab
        if (menu === 'mode' && defaultTab) {
          this.activeTab = defaultTab;
        }
        const newMode = menu === 'mode' ? this.activeTab : menu;
        this.updateURL('mode', newMode);
      }
    },
    setActiveTab(tab) {
      // Jika tab yang diklik berbeda dengan tab aktif, reload halaman.
      if (this.activeTab !== tab) {
        this.updateURL('mode', tab);
        window.location.reload();
      } else {
        // Jika tab yang diklik sama, tetap lakukan reload (perilaku lama).
        window.location.reload();
      }
    }
  }
};