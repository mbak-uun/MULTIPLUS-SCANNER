// components/tabs/management-tab.js
// Komponen Vue untuk Tab Manajemen Koin

const ID_NUMBER_FORMAT = new Intl.NumberFormat('id-ID');

const ManagementTab = {
  name: 'ManagementTab',
  emits: ['show-toast', 'show-add-token-modal', 'import-tokens', 'export-tokens'],
  components: {
    'management-filter-bar': ManagementFilterBar
  },

  data() {
    return {
      tokens: [],
      searchQuery: '', // State untuk input pencarian
    };
  },

  computed: {
    activeChain() {
      return this.$root.activeChain;
    },
    // REVISI: Gunakan `filters` yang reaktif dari root, bukan `filterSettings` yang statis.
    filters() {
      return this.$root.filters;
    },
    // Mengambil daftar DEX yang aktif dari root instance
    activeDexList() {
      if (!this.filterSettings || !this.filterSettings.dex) return [];
      return Object.keys(this.filterSettings.dex)
        .filter(dexKey => this.filterSettings.dex[dexKey])
        .map(dexKey => ({ key: dexKey, name: dexKey.toUpperCase() }));
    },
    // Logika untuk memfilter dan mengurutkan token yang akan ditampilkan
    filteredTokens() {
      if (!this.tokens || !this.filters) return [];

      let filtered = [...this.tokens];
      console.log(`[Manajemen] 1. Initial tokens (${this.activeChain}):`, filtered.length, JSON.parse(JSON.stringify(filtered)));

      // 1. Filter berdasarkan pencarian (searchQuery)
      if (this.searchQuery) {
        const lowerCaseQuery = this.searchQuery.toLowerCase();
        filtered = filtered.filter(token =>
          (token.from && token.from.toLowerCase().includes(lowerCaseQuery)) ||
          (token.to && token.to.toLowerCase().includes(lowerCaseQuery)) ||
          (token.nama_koin && token.nama_koin.toLowerCase().includes(lowerCaseQuery)) ||
          (token.nama_token && token.nama_token.toLowerCase().includes(lowerCaseQuery)) || // Cari berdasarkan ticker juga
          (token.nama_pair && token.nama_pair.toLowerCase().includes(lowerCaseQuery))
        );
      }
      console.log('[Manajemen] 2. After search filter:', filtered.length);

      // REVISI: Tambahkan filter berdasarkan chain aktif jika bukan 'multi'
      if (this.activeChain !== 'multi' && this.activeChain) {
        filtered = filtered.filter(token => token.chain && token.chain.toLowerCase() === this.activeChain);
      }
      console.log('[Manajemen] 3. After chain filter:', filtered.length);

      // 2. Filter berdasarkan favorit (support both isFavorite dan isFavorit)
      if (this.filters.favoritOnly) {
        filtered = filtered.filter(token => token.isFavorite || token.isFavorit);
      }

      // 3. Filter berdasarkan CEX yang aktif di filter panel (menggunakan skema nested)
      if (this.filters.cex) {
        const activeCexFilters = Object.keys(this.filters.cex)
          .filter(key => this.filters.cex[key]);
        
        if (activeCexFilters.length > 0) {
          filtered = filtered.filter(token => {
            const tokenCexList = this.getTokenCEXList(token);
            // REVISI: Ubah kedua sisi menjadi lowercase untuk perbandingan yang konsisten.
            const lowerActiveCex = activeCexFilters.map(c => c.toLowerCase());
            return tokenCexList.some(cexKey =>
              lowerActiveCex.includes(cexKey.toLowerCase())
            );
          });
        }
      }
      console.log('[Manajemen] 4. After CEX & Favorite filter:', filtered.length);

      // 3. Terapkan pengurutan (sorting)
      const sortDirection = this.$root.filterSettings?.sortDirection || 'asc';
      const sortKey = sortDirection === 'asc' ? 1 : -1;
      filtered.sort((a, b) => {
        const nameA = (a.from || a.nama_koin || '').toLowerCase();
        const nameB = (b.from || b.nama_koin || '').toLowerCase();
        if (nameA < nameB) return -1 * sortKey;
        if (nameA > nameB) return 1 * sortKey;
        return 0;
      });
      console.log('[Manajemen] 5. Final sorted tokens:', filtered.length, JSON.parse(JSON.stringify(filtered)));


      return filtered;
    },
    columnCount() {
      // NO, TOKEN, CHAIN, EXCHANGER, DEX, ACTION
      return 6;
    },
  },

  methods: {
    // Helper untuk mengekstrak daftar CEX dari skema nested
    getTokenCEXList(token) {
      if (!token.cex || typeof token.cex !== 'object') return [];
      return Object.keys(token.cex);
    },
    // Helper untuk mendapatkan CEX utama dari sebuah token
    getTokenPrimaryCEX(token) {
      const cexList = this.getTokenCEXList(token);
      return cexList.length > 0 ? cexList[0] : null;
    },
    getDexLeft(token, dexKey) {
      return (token.dex && token.dex[dexKey] && token.dex[dexKey].left) || '0';
    },
    getDexRight(token, dexKey) {
      return (token.dex && token.dex[dexKey] && token.dex[dexKey].right) || '0';
    },
    getContractEntries(token) {
      if (!token || typeof token !== 'object') return [];
      return Object.keys(token)
        .filter(key => key.startsWith('sc_') && token[key])
        .map(key => {
          const decimalsKey = key.replace('sc_', 'des_');
          return {
            key,
            label: key.replace('sc_', '').toUpperCase(),
            address: token[key],
            decimals: token[decimalsKey]
          };
        });
    },
    getPrimaryCexInfo(token) {
      const key = this.getTokenPrimaryCEX(token);
      if (!key) return null;
      return {
        key,
        label: key.toUpperCase(),
        status: this.getTokenCexStatus(token, key)
      };
    },
    // Memuat semua token dari semua chain di IndexedDB
    async loadTokensFromDB() {
      if (!this.activeChain) return;
      console.log(`Memuat token untuk tab manajemen (Chain: ${this.activeChain})...`);
      
      let chainsToLoad = [];
      if (this.activeChain === 'multi') {
        chainsToLoad = this.$root.activeChains;
      } else if (this.activeChain) {
        chainsToLoad = [this.activeChain];
      } else {
        this.tokens = [];
        return;
      }

      let allTokens = [];
      for (const chainKey of chainsToLoad) {
        const storeName = DB.getStoreNameByChain('KOIN', chainKey);
        const chainTokens = await DB.getAllData(storeName) || [];
        // Filter record 'DATA_KOIN' dan tambahkan properti 'chain' jika belum ada
        const validTokens = chainTokens.filter(t => t.id !== 'DATA_KOIN').map(t => ({ ...t, chain: t.chain || chainKey.toUpperCase() }));
        allTokens.push(...validTokens);
      }

      this.tokens = allTokens;
      console.log(`Total ${this.tokens.length} token dimuat untuk manajemen.`);
    },

    // Mengubah arah pengurutan
    toggleSortDirection() {
      const newDirection = (this.$root.filterSettings.sortDirection || 'asc') === 'desc' ? 'asc' : 'desc';
      this.$root.filterSettings.sortDirection = newDirection;
    },
    // Menandai/menghapus token sebagai favorit
    async toggleTokenFavorit(token) {
      const currentFavorite = token.isFavorite || token.isFavorit || false;
      token.isFavorite = !currentFavorite;
      // Sync field lama untuk backward compatibility
      if (token.isFavorit !== undefined) {
        token.isFavorit = token.isFavorite; // Seharusnya token.isFavorite = !currentFavorite; tapi kita biarkan untuk konsistensi
      }
      const storeName = DB.getStoreNameByChain('KOIN', token.chain);
      await DB.saveData(storeName, token);
      this.$emit('show-toast', `${token.nama_token || token.from} ${token.isFavorite ? 'ditambahkan ke' : 'dihapus dari'} favorit`, 'success');
    },
    // Menghapus token
    async deleteToken(token) {
      if (confirm(`Anda yakin ingin menghapus token ${token.from || token.nama_koin}?`)) {
        this.tokens = this.tokens.filter(t => t.id !== token.id);
        const storeName = DB.getStoreNameByChain('KOIN', token.chain);
        await DB.deleteData(storeName, token.id);
        this.$emit('show-toast', `Token ${token.from || token.nama_koin} berhasil dihapus.`, 'danger');
      }
    },
    // Menampilkan modal untuk menambah token baru
    showAddTokenModal() {
      this.$emit('show-add-token-modal', null); // null berarti mode 'tambah baru'
    },
    // Menampilkan modal untuk mengedit token yang ada
    showEditTokenModal(token) {
      this.$emit('show-add-token-modal', token); // Mengirim data token untuk diedit
    },
    // Badge class untuk status WX/WD
    getTokenCexStatus(token, cexKey) {
      const cexData = token.cex?.[cexKey.toUpperCase()];
      if (!cexData) return { deposit: false, withdraw: false };
      return {
        deposit: cexData.depositToken,
        withdraw: cexData.withdrawToken
      };
    },
    async toggleTokenStatus(token, event) {
      const newStatus = event?.target?.checked ?? false;
      token.status = newStatus;
      try {
        const storeName = DB.getStoreNameByChain('KOIN', token.chain);
        await DB.saveData(storeName, token);
        this.$emit('show-toast', `${token.from || token.nama_koin} ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`, 'info');
      } catch (error) {
        console.error('Gagal memperbarui status token:', error);
        token.status = !newStatus;
        if (event?.target) {
          event.target.checked = token.status;
        }
        this.$emit('show-toast', 'Gagal memperbarui status token.', 'danger');
      }
    },
    getDexEntries(token) {
      if (!token || !token.dex || typeof token.dex !== 'object') return [];
      return Object.keys(token.dex).map(key => {
        const dexData = token.dex[key] || {};
        const status = dexData.status !== false;
        return {
          key,
          name: key.toUpperCase(),
          status,
          left: this.getDexLeft(token, key),
          right: this.getDexRight(token, key)
        };
      }).filter(entry => entry.status);
    },
    formatDexValue(value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return value ?? '0';
      if (Math.abs(numeric) >= 1000) {
        return ID_NUMBER_FORMAT.format(Math.round(numeric));
      }
      return numeric % 1 === 0 ? numeric.toString() : numeric.toFixed(2);
    }
  },

  watch: {
    activeChain: {
      immediate: true,
      handler() { this.loadTokensFromDB(); }
    }
  },
  activated() {
    this.loadTokensFromDB(); // Muat ulang data saat tab diaktifkan kembali
  },

  template: `
    <div class="management-tab">
      <!-- Bar Kontrol dan Filter -->
      <div class="card mb-3">
        <div class="card-body p-2">
          <div class="row g-2 align-items-center">
            <!-- Input Pencarian -->
            <div class="col-lg-4 col-md-12">
              <div class="input-group">
                <span class="input-group-text"><i class="bi bi-search"></i></span>
                <input type="text" class="form-control" placeholder="Cari token..." v-model="searchQuery">
              </div>
            </div>
            <!-- Filter Favorit (dari komponen terpisah) -->
            <div class="col-auto">
              <management-filter-bar></management-filter-bar>
            </div>
            <!-- Tombol Aksi -->
            <div class="col-lg-auto col-md-12 ms-lg-auto">
              <div class="d-flex justify-content-start justify-content-lg-end gap-2">
                <button class="btn btn-sm btn-outline-primary" @click="$emit('import-tokens')">
                  <i class="bi bi-upload me-1"></i> Import
                </button>
                <button class="btn btn-sm btn-outline-secondary" @click="$emit('export-tokens')">
                  <i class="bi bi-download me-1"></i> Export
                </button>
                <button class="btn btn-sm btn-success" @click="showAddTokenModal">
                  <i class="bi bi-plus-circle-fill me-1"></i> Tambah Token
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabel Manajemen Koin -->
      <div class="table-responsive">
        <table class="table table-sm table-hover align-middle management-table">
          <thead class="sticky-top">
            <tr class="text-center text-uppercase small">
              <th class="text-nowrap">No</th>
              <th class="text-nowrap" @click="toggleSortDirection" style="cursor: pointer;">
                Token / Pair
                <i class="bi ms-1" :class="{
                  'bi-arrow-down': $root.filterSettings.sortDirection === 'desc',
                  'bi-arrow-up': $root.filterSettings.sortDirection === 'asc'
                }"></i>
              </th>
              <th class="text-nowrap">Chain</th>
              <th class="text-nowrap">Exchanger</th>
              <th class="text-nowrap">Dex & Modal</th>
              <th class="text-nowrap" style="width: 150px;">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredTokens.length === 0">
              <td :colspan="columnCount" class="text-center text-muted py-5">
                <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                <span>Tidak ada data token yang cocok dengan filter.</span>
              </td>
            </tr>
            <tr v-for="(token, index) in filteredTokens" :key="token.id">
              <td class="text-center fw-semibold">{{ index + 1 }}</td>
              <td>
                <div class="d-flex flex-column">
                  <div class="fw-bold">
                    <span class="text-primary">{{ token.nama_koin || token.from }}</span>
                  </div>
                  <div class="small text-muted">
                    {{ token.sc_token }}
                  </div>
                </div>
              </td>
              <td class="text-center">
                <div class="d-flex flex-column align-items-center">
                  <span class="badge" :style="$root.getColorStyles('chain', token.chain, 'soft')">
                    {{ token.chain }}
                  </span>
                </div>
              </td>
              <td v-if="getPrimaryCexInfo(token)" class="text-center">
                <div class="d-flex flex-column align-items-center">
                  <span class="badge" :style="$root.getColorStyles('cex', getPrimaryCexInfo(token).key, 'soft')">
                    {{ getPrimaryCexInfo(token).label }}
                  </span>
                  <div class="small mt-1">
                    <span class="badge" :class="getPrimaryCexInfo(token).status.deposit ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'">DP</span>
                    <span class="badge" :class="getPrimaryCexInfo(token).status.withdraw ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'">WD</span>
                  </div>
                </div>
              </td>
              <td v-else class="text-center text-muted">-</td>
              <td class="text-center">
                <div v-if="getDexEntries(token).length" class="d-flex flex-wrap gap-2 justify-content-center">
                  <span v-for="dex in getDexEntries(token)" :key="dex.key" class="badge" :style="$root.getColorStyles('dex', dex.key, 'soft')">
                    {{ dex.name }}
                    <span class="text-muted small">({{ formatDexValue(dex.left) }}|{{ formatDexValue(dex.right) }})</span>
                  </span>
                </div>
                <span v-else class="text-muted small">-</span>
              </td>
              <td class="text-center">
                <div class="btn-group btn-group-sm">
                  <div class="form-check form-switch form-check-inline me-2" title="Aktifkan/Nonaktifkan Token">
                    <input class="form-check-input" type="checkbox" role="switch" :id="'status-' + token.id"
                      :checked="Boolean(token.status)" @change="toggleTokenStatus(token, $event)">
                  </div>
                  <button class="btn btn-outline-warning btn-icon" :class="(token.isFavorite || token.isFavorit) ? 'active' : ''"
                    @click="toggleTokenFavorit(token)" title="Toggle Favorit">
                    <i class="bi bi-star-fill"></i>
                  </button>
                  <button class="btn btn-outline-primary btn-icon" @click="showEditTokenModal(token)" title="Edit Token">
                    <i class="bi bi-pencil-fill"></i>
                  </button>
                  <button class="btn btn-outline-danger btn-icon" @click="deleteToken(token)" title="Hapus Token">
                    <i class="bi bi-trash-fill"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
};
