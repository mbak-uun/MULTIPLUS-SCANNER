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
            console.warn(`[RouterMixin] Mode "${modeParam}" tidak diizinkan pada multi-chain. Mengalihkan ke "scan".`);
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
      const isMultiChainMode = this.activeChain === 'multi';
      const allowedMultiTabs = ['scan', 'wallet'];
      const effectiveTab = isMultiChainMode && !allowedMultiTabs.includes(tab) ? 'scan' : tab;

      // Jika tab yang diklik berbeda dengan tab aktif, reload halaman.
      if (this.activeTab !== effectiveTab) {
        this.updateURL('mode', effectiveTab);
        window.location.reload();
      } else {
        // Jika tab yang diklik sama, tetap lakukan reload (perilaku lama).
        window.location.reload();
      }
    }
  }
};
