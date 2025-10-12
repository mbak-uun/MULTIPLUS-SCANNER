// assets/js/mixins/router.js

const routerMixin = {
  methods: {
    processURLParams() {
      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get('mode');
      // REVISI: Logika pengaturan 'activeChain' dipindahkan ke 'data()' di app.js
      // untuk mencegah trigger watcher yang tidak diinginkan saat inisialisasi.
      const chainParam = this.activeChain;

      const isMultiChainMode = chainParam === 'multi';
      const allowedMultiTabs = ['scan', 'wallet'];

      const validTabs = ['scan', 'manajemen', 'sync', 'wallet'];
      const validMenus = ['db', 'settings', 'history', 'portfolio'];

      if (modeParam) {
        if (validTabs.includes(modeParam)) {
          const resolvedTab = isMultiChainMode && !allowedMultiTabs.includes(modeParam)
            ? 'scan'
            : modeParam;

          this.activeMenu = 'mode';
          this.activeTab = resolvedTab;

          if (resolvedTab !== modeParam) {
            // console.warn(`[RouterMixin] Mode "${modeParam}" tidak diizinkan pada multi-chain. Mengalihkan ke "scan".`);
            this.updateURL('mode', resolvedTab);
          }
        } else if (validMenus.includes(modeParam)) {
          this.activeMenu = modeParam;
        }
      } else if (isMultiChainMode && !allowedMultiTabs.includes(this.activeTab)) {
        // Tidak ada mode di URL, tetapi tab aktif tidak valid untuk multi-chain
        this.activeTab = 'scan';
        this.activeMenu = 'mode';
        this.updateURL('mode', 'scan');
      }
    },
    updateURL(key, value) {
      const url = new URL(window.location);
      url.searchParams.set(key, value);
      window.history.pushState({}, '', url);
    },
    setActiveMenu(menu, defaultTab = null) {
      if (menu === 'mode') {
        const targetTab = defaultTab || this.activeTab;
        this.setActiveTab(targetTab);
        return;
      }

      if (this.activeMenu !== menu) {
        this.activeMenu = menu;
      }

      this.updateURL('mode', menu);
    },
    setActiveTab(tab) {
      const isMultiChainMode = this.activeChain === 'multi';
      const allowedMultiTabs = ['scan', 'wallet'];
      const effectiveTab = isMultiChainMode && !allowedMultiTabs.includes(tab) ? 'scan' : tab;

      const isDifferentTab = this.activeTab !== effectiveTab;

      if (this.activeMenu !== 'mode') {
        this.activeMenu = 'mode';
      }

      if (isDifferentTab) {
        this.activeTab = effectiveTab;
        this.updateURL('mode', effectiveTab);
      } else {
        this.updateURL('mode', effectiveTab);
        if (typeof this.reloadActiveTab === 'function') {
          this.reloadActiveTab();
        }
      }
    }
  }
};
