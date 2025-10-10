// components/common/filter-toolbar.js

const FilterToolbar = {
  name: 'FilterToolbar',
  // Props untuk menerima data dari parent (scanning-tab atau management-tab)
  props: {
    title: {
      type: String,
      required: true
    },
    icon: {
      type: String,
      default: 'bi-funnel'
    },
    filters: {
      type: Object,
      required: true
    },
    searchQuery: {
      type: String,
      required: true
    },
    filteredTokensCount: {
      type: Number,
      default: 0
    },
    disabled: {
      type: Boolean,
      default: false
    },
    showFavoriteButton: {
      type: Boolean,
      default: true
    },
    showMinPnlInput: {
      type: Boolean,
      default: true
    },
    showAutoscrollButton: {
      type: Boolean,
      default: true
    },
    showAutorunButton: {
      type: Boolean,
      default: false
    }
  },
  // Emits untuk mengirim event ke parent saat ada interaksi
  emits: [
    'update:searchQuery',
    'update:filters',
    'toggle-favorite',
    'toggle-autoscroll',
    'handle-min-pnl-change',
    'toggle-autorun'
  ],
  computed: {
    // Computed property untuk v-model pada searchQuery
    localSearchQuery: {
      get() {
        return this.searchQuery;
      },
      set(value) {
        this.$emit('update:searchQuery', value);
      }
    },
    // Computed property untuk v-model pada filters.minPnl
    localMinPnl: {
      get() {
        return this.filters.minPnl;
      },
      set(value) {
        // Emit event untuk update seluruh objek filters
        this.$emit('update:filters', { ...this.filters, minPnl: value });
      }
    }
  },
  template: `
    <div class="card card-soft card-body p-2 mb-3">
      <div class="row g-2 align-items-center">
        <div class="col-12 col-xl">
          <div class="row g-2 align-items-center">
            <div class="col-12 col-md-auto">
              <h6 class="mb-0 d-flex align-items-center gap-2">
                <i class="bi" :class="icon"></i>
                {{ title }}
              </h6>
            </div>
            <div class="col-12 col-sm-auto">
              <div class="input-group input-group-sm w-100" style="min-width: 200px;">
                <span class="input-group-text">
                  <i class="bi bi-search"></i>
                </span>
                <input
                  type="text"
                  class="form-control"
                  placeholder="Cari token..."
                  v-model="localSearchQuery"
                  :disabled="disabled">
              </div>
            </div>

            <div v-if="showMinPnlInput" class="col-6 col-sm-auto">
              <div class="input-group input-group-sm w-100" style="min-width: 140px;">
                <span class="input-group-text">
                  <i class="bi bi-graph-up-arrow"></i>
                </span>
                <input
                  type="number"
                  class="form-control"
                  placeholder="Min PnL"
                  min="0"
                  step="0.1"
                  :disabled="disabled"
                  v-model.number="localMinPnl"
                  @change="$emit('handle-min-pnl-change')">
              </div>
            </div>

            <div v-if="showFavoriteButton" class="col-6 col-sm-auto">
              <button
                type="button"
                class="btn btn-sm d-flex align-items-center gap-1"
                :class="filters.favoritOnly ? 'btn-dark ' : 'btn-outline-dark'"
                :disabled="disabled"
                @click="$emit('toggle-favorite')"
                title="Tampilkan hanya token favorit">
                <i class="bi" :class="filters.favoritOnly ? 'bi-star-fill' : 'bi-star'"></i>
                <span class="small fw-semibold">Favorite</span>
              </button>
            </div>

            <div v-if="showAutoscrollButton" class="col-6 col-sm-auto">
              <button
                type="button"
                class="btn btn-sm d-flex align-items-center gap-1"
                :class="filters.autoscroll ? 'btn-dark' : 'btn-outline-dark'"
                :disabled="disabled"
                @click="$emit('toggle-autoscroll')"
                title="Scroll otomatis mengikuti sinyal terbaru">
                <i class="bi" :class="filters.autoscroll ? 'bi-arrow-down-circle-fill' : 'bi-arrow-down-circle'"></i>
                <span class="small fw-semibold">Autoscroll</span>
              </button>
            </div>

            <div v-if="showAutorunButton" class="col-6 col-sm-auto">
              <button
                type="button"
                class="btn btn-sm d-flex align-items-center gap-1"
                :class="filters.autorun ? 'btn-dark' : 'btn-outline-dark'"
                :disabled="disabled"
                @click="$emit('toggle-autorun')"
                title="Mulai scan otomatis (mode Scan)">
                <i class="bi" :class="filters.autorun ? 'bi-lightning-charge-fill' : 'bi-lightning-charge'"></i>
                <span class="small fw-semibold">Autorun</span>
              </button>
            </div>

            <div class="col-12 col-sm-auto">
              <span class="badge bg-light text-dark border w-100 text-center">
                Total: {{ filteredTokensCount }}
              </span>
            </div>
          </div>
        </div>
        <div class="col-12 col-xl-auto">
          <div class="d-grid d-sm-inline-flex gap-2 justify-content-sm-end">
            <!-- Slot untuk tombol aksi spesifik -->
            <slot name="actions"></slot>
          </div>
        </div>
      </div>
      <slot name="footer"></slot>
    </div>
  `
};

window.FilterToolbar = FilterToolbar;
