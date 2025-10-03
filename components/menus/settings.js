// components/menus/settings.js
// Vue Component untuk Menu Settings

const SettingsMenu = {
  name: 'SettingsMenu',

  template: `
    <div v-if="settingsForm">
      <form @submit.prevent="handleSaveSettings">
        <div class="card card-soft">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0"><i class="bi bi-gear-wide-connected"></i> Pengaturan Global</h5>
            <button type="submit" class="btn btn-success">
              <i class="bi bi-save"></i> Simpan Pengaturan
            </button>
          </div>
          <div class="card-body">
            <div class="row g-4">
              <!-- Kolom Pengaturan Umum -->
              <div class="col-md-6">
                <div class="mb-3">
                  <label class="form-label fw-bold">Nickname <span class="text-danger">*</span></label>
                  <input type="text" class="form-control" v-model="settingsForm.nickname" placeholder="Masukkan nickname Anda" required>
                  <small class="text-muted">Nama pengguna untuk identifikasi</small>
                </div>
                <div class="mb-3">
                  <label class="form-label fw-bold">Wallet Meta <span class="text-danger">*</span></label>
                  <input type="text" class="form-control" v-model="settingsForm.walletMeta" placeholder="0x..." required>
                  <small class="text-muted">Alamat wallet MetaMask Anda</small>
                </div>
                <div class="mb-3">
                  <label class="form-label fw-bold">Anggota Grup <span class="text-danger">*</span></label>
                  <input type="number" class="form-control" v-model.number="settingsForm.AnggotaGrup" min="1" required>
                  <small class="text-muted">Jumlah anggota per grup (minimal 1)</small>
                </div>
              </div>
              <!-- Kolom Pengaturan Timing -->
              <div class="col-md-6">
                <div class="mb-3">
                  <label class="form-label fw-bold">Jeda Time Group (ms) <span class="text-danger">*</span></label>
                  <input type="number" class="form-control" v-model.number="settingsForm.jedaTimeGroup" min="0" required>
                  <small class="text-muted">Jeda antar grup dalam milidetik</small>
                </div>
                <div class="mb-3">
                  <label class="form-label fw-bold">Jeda Per Anggota (ms) <span class="text-danger">*</span></label>
                  <input type="number" class="form-control" v-model.number="settingsForm.jedaPerAnggota" min="0" required>
                  <small class="text-muted">Jeda per anggota dalam milidetik</small>
                </div>
                <div class="mb-3">
                  <label class="form-label fw-bold">Waktu Tunggu (ms) <span class="text-danger">*</span></label>
                  <input type="number" class="form-control" v-model.number="settingsForm.WaktuTunggu" min="0" required>
                  <small class="text-muted">Waktu tunggu dalam milidetik</small>
                </div>
              </div>
            </div>

            <hr class="my-4">

            <!-- Pengaturan CEX, DEX, CHAIN -->
            <div class="row g-4">
              <!-- Kolom CHAIN -->
              <div class="col-lg-4" v-if="settingsForm.config_chain">
                <h6 class="fw-bold mb-3" :style="getColorStyles('chain', 'bsc', 'text')">
                  <i class="bi bi-diagram-3"></i> Blockchain Network
                  <span class="badge bg-secondary ms-2">Min. 1</span>
                </h6>
                <div v-for="(config, key) in settingsForm.config_chain" :key="'chain-set-'+key" class="d-flex align-items-center gap-2 mb-2 p-2 border rounded" :class="config.status ? 'bg-light' : ''">
                  <input type="checkbox" class="form-check-input" v-model="config.status" :id="'chain-'+key">
                  <label class="form-label mb-0 flex-grow-1" :for="'chain-'+key" :style="getColorStyles('chain', key, 'text')">
                    {{ key.toUpperCase() }}
                  </label>
                </div>
              </div>
              <!-- Kolom CEX -->
              <div class="col-lg-4" v-if="settingsForm.config_cex">
                <h6 class="fw-bold mb-3" :style="getColorStyles('cex', 'GATE', 'text')">
                  <i class="bi bi-building"></i> Exchanger (CEX)
                  <span class="badge bg-secondary ms-2">Min. 1</span>
                </h6>
                <div v-for="(config, key) in settingsForm.config_cex" :key="'cex-set-'+key" class="d-flex align-items-center gap-2 mb-2 p-2 border rounded" :class="config.status ? 'bg-light' : ''">
                  <input type="checkbox" class="form-check-input" v-model="config.status" :id="'cex-'+key">
                  <label class="form-label mb-0 flex-grow-1" :for="'cex-'+key" :style="getColorStyles('cex', key, 'text')">
                    {{ key.toUpperCase() }}
                  </label>
                  <input type="number" class="form-control form-control-sm" style="width: 80px;" v-model.number="config.jeda" :disabled="!config.status" min="0" placeholder="ms">
                </div>
                <small class="text-muted">Default jeda: 30ms</small>
              </div>
              <!-- Kolom DEX -->
              <div class="col-lg-4" v-if="settingsForm.config_dex">
                <h6 class="fw-bold mb-3" :style="getColorStyles('dex', 'lifi', 'text')">
                  <i class="bi bi-diamond"></i> Decentralized (DEX)
                  <span class="badge bg-secondary ms-2">Min. 1</span>
                </h6>
                <div v-for="(config, key) in settingsForm.config_dex" :key="'dex-set-'+key" class="d-flex align-items-center gap-2 mb-2 p-2 border rounded" :class="config.status ? 'bg-light' : ''">
                  <input type="checkbox" class="form-check-input" v-model="config.status" :id="'dex-'+key">
                  <label class="form-label mb-0 flex-grow-1" :for="'dex-'+key" :style="getColorStyles('dex', key, 'text')">
                     {{ key.toUpperCase() }}
                  </label>
                  <input type="number" class="form-control form-control-sm" style="width: 80px;" v-model.number="config.jeda" :disabled="!config.status" min="0" placeholder="ms">
                </div>
                <small class="text-muted">Default jeda: 100ms</small>
              </div>

            </div>

            <!-- Info Note -->
            <div class="alert alert-info mt-4" role="alert">
              <i class="bi bi-info-circle-fill me-2"></i>
              <strong>Catatan:</strong> Field bertanda <span class="text-danger">*</span> wajib diisi. Minimal 1 CEX, 1 DEX, dan 1 Chain harus aktif.
            </div>
          </div>
        </div>
      </form>
    </div>
  `,

  props: {
    settingsForm: {
      type: Object,
      required: true
    }
  },

  methods: {
    getColorStyles(type, key, variant) {
      return this.$parent.getColorStyles(type, key, variant);
    },
    handleSaveSettings() {
      this.$parent.saveGlobalSettings();
    }
  }
};
