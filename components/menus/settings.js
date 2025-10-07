// components/menus/settings.js
// Vue Component untuk Menu Settings

const SettingsMenu = {
  name: 'SettingsMenu',

  template: `
    <div v-if="settingsForm">
      <!-- Settings Toolbar -->
      <div class="card card-body mb-3">
        <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between">
          <h5 class="mb-0">
            <i class="bi bi-gear"></i>
            Pengaturan Global
          </h5>
          <div class="d-flex flex-wrap gap-2 justify-content-end">
            <button type="button" @click="handleSaveSettings" class="btn btn-success btn-sm">
              <i class="bi bi-save"></i>
              <span>Simpan Pengaturan</span>
            </button>
          </div>
        </div>
      </div>

      <form @submit.prevent="handleSaveSettings">
        <div class="card card-soft">
          <div class="card-header">
            <i class="bi bi-gear-wide-connected text-dark me-2"></i>
            <span class="fw-bold text-dark">Form Pengaturan</span>
          </div>
          <div class="card-body">
            <!-- REFACTORED: Layout 2 kolom (4 + 8) -->
            <div class="row g-3">
              <!-- Kolom 1: Input Data -->
              <div class="col-lg-4">
                <div class="card h-100">
                  <div class="card-header py-2" :style="getColorStyles('chain', $parent.activeChain, 'solid')">
                    <h6 class="mb-0 fw-bold"><i class="bi bi-person-badge"></i> Identitas & Waktu</h6>
                  </div>
                  <div class="card-body">
                    <div class="mb-3">
                      <label class="form-label fw-bold">Nickname <span class="text-danger">*</span></label>
                      <input type="text" class="form-control form-control-sm" v-model="settingsForm.nickname" placeholder="Nickname Anda" required>
                    </div>
                    <div class="mb-3">
                      <label class="form-label fw-bold">Alamat Wallet <span class="text-danger">*</span></label>
                      <input type="text" class="form-control form-control-sm" v-model="settingsForm.walletMeta" placeholder="0x..." required pattern="^0x[a-fA-F0-9]{40}$" title="Masukkan alamat wallet Ethereum yang valid (contoh: 0x...).">
                    </div>
                    <div class="mb-3">
                      <label class="form-label fw-bold">Anggota Grup <span class="text-danger">[1 s/d 5]</span></label>
                      <input type="number" class="form-control form-control-sm" v-model.number="settingsForm.AnggotaGrup" min="1" max="5" required>
                    </div>

                    <hr class="my-3">

                    <div class="mb-3">
                      <label class="form-label fw-bold">Jeda Time Group (ms) <span class="text-danger">[1500 s/d 3000]</span></label>
                      <input type="number" class="form-control form-control-sm" v-model.number="settingsForm.jedaTimeGroup" min="0" required>
                    </div>
                    <div class="mb-3">
                      <label class="form-label fw-bold">Jeda Per Anggota (ms) <span class="text-danger">[500 s/d 1000]</span></label>
                      <input type="number" class="form-control form-control-sm" v-model.number="settingsForm.jedaPerAnggota" min="0" required>
                    </div>
                    <div class="mb-2">
                      <label class="form-label fw-bold">Waktu Tunggu (ms) <span class="text-danger">[3000 s/d 6000]</span></label>
                      <input type="number" class="form-control form-control-sm" v-model.number="settingsForm.WaktuTunggu" min="0" required>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Kolom 2: Pilihan Chain, CEX, DEX -->
              <div class="col-lg-8">
                <!-- Pilihan Chain (Gabungan) -->
                <div v-if="settingsForm.config_chain" class="card mb-3">
                    <div class="card-header py-2" :style="getColorStyles('chain', $parent.activeChain, 'solid')">
                      <h6 class="mb-0 fw-bold">
                      <i class="bi bi-diagram-3"></i> Pilihan Chain
                      <span class="badge bg-secondary ms-2">Min. 1</span>
                      </h6>
                    </div>
                    <div class="card-body d-flex flex-wrap gap-3">
                      <div v-for="(config, key) in settingsForm.config_chain" :key="'chain-set-'+key" class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" role="switch" v-model="config.status" :id="'chain-'+key">
                        <label class="form-check-label" :for="'chain-'+key" :style="getColorStyles('chain', key, 'text')">
                          {{ key.toUpperCase() }}
                        </label>
                      </div>
                    </div>
                </div>
                
                <div class="row g-3">
                  <!-- Kolom 2.1: Pilihan CEX -->
                  <div class="col-lg-6">
                    <div v-if="settingsForm.config_cex" class="card h-100">
                      <div class="card-header py-2" :style="getColorStyles('chain', $parent.activeChain, 'solid')">
                        <h6 class="mb-0 fw-bold"><i class="bi bi-currency-exchange"></i> Exchanger & Jeda <span class="badge bg-secondary ms-2">Min. 1</span></h6>
                      </div>
                      <div class="card-body">
                        <div v-for="(config, key) in settingsForm.config_cex" :key="'cex-set-'+key" class="d-flex align-items-center gap-2 mb-2">
                          <div class="form-check form-switch flex-grow-1">
                            <input class="form-check-input" type="checkbox" role="switch" v-model="config.status" :id="'cex-'+key">
                            <label class="form-check-label" :for="'cex-'+key" :style="getColorStyles('cex', key, 'text')">
                              {{ key.toUpperCase() }}
                            </label>
                          </div>
                          <input type="number" class="form-control form-control-sm" style="width: 80px;" v-model.number="config.jeda" :disabled="!config.status" min="0" placeholder="ms">
                        </div>
                      </div>
                    </div>
                  </div>
                  <!-- Kolom 2.2: Pilihan DEX -->
                  <div class="col-lg-6">
                    <div v-if="settingsForm.config_dex" class="card h-100">
                      <div class="card-header py-2" :style="getColorStyles('chain', $parent.activeChain, 'solid')">
                        <h6 class="mb-0 fw-bold"><i class="bi bi-x-diamond"></i> DEX & Jeda  <span class="badge bg-secondary ms-2">Min. 1</span></h6>
                      </div>
                      <div class="card-body">
                        <div v-for="(config, key) in settingsForm.config_dex" :key="'dex-set-'+key" class="d-flex align-items-center gap-2 mb-2">
                          <div class="form-check form-switch flex-grow-1">
                            <input class="form-check-input" type="checkbox" role="switch" v-model="config.status" :id="'dex-'+key">
                            <label class="form-check-label" :for="'dex-'+key" :style="getColorStyles('dex', key, 'text')">
                               {{ key.toUpperCase() }}
                            </label>
                          </div>
                          <input type="number" class="form-control form-control-sm" style="width: 80px;" v-model.number="config.jeda" :disabled="!config.status" min="0" placeholder="ms">
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Info Note -->
            <div class="alert alert-info mt-3" role="alert">
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
