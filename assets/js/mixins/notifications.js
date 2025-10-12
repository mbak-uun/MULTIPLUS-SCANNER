// assets/js/mixins/notifications.js

const notificationsMixin = {
  methods: {
    showToast(message, type = 'info', duration = 5000) {
      const container = document.getElementById('toast-container');
      if (!container) {
        // console.error('Element #toast-container not found in DOM.');
        return;
      }
      const iconMap = {
        success: 'bi-check-circle-fill',
        danger: 'bi-x-circle-fill',
        warning: 'bi-exclamation-triangle-fill',
        info: 'bi-info-circle-fill',
      };
      const toastId = `toast-${Date.now()}`;
      const toastHTML = `<div id="${toastId}" class="toast align-items-center text-bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true"><div class="d-flex"><div class="toast-body"><i class="bi ${iconMap[type] || iconMap['info']} me-2"></i>${message}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div></div>`;
      container.insertAdjacentHTML('beforeend', toastHTML);
      const toastEl = document.getElementById(toastId);
      const toast = new bootstrap.Toast(toastEl, { delay: duration });
      toast.show();
      toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    }
  }
};