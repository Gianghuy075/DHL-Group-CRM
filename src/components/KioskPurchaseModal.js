import { Modal } from './Modal.js';
import { Toast } from './Toast.js';
import { CategoryService } from '../services/CategoryService.js';
import { BusinessTypeService } from '../services/BusinessTypeService.js';
import { KioskService } from '../services/KioskService.js';
import { WalletService } from '../services/WalletService.js';
import { formatCurrency } from '../utils/currency.js';
import { escapeHtml } from '../utils/html.js';

// Modal cho người dùng mua gói Kiosk, trừ trực tiếp từ Ví Ảo.
const state = {
  customerId: null,
  customerName: '',
  onPurchased: async () => {},
  categories: [],
  businessTypes: [],
  selectedBusinessType: null,
  walletBalance: 0,
};

export const KioskPurchaseModal = {
  open({ customerId, customerName = '', onPurchased = async () => {} } = {}) {
    if (!customerId) {
      Toast.show('Không xác định được tài khoản để mua gói Kiosk.');
      return;
    }
    state.customerId = customerId;
    state.customerName = customerName;
    state.onPurchased = onPurchased;
    state.selectedBusinessType = null;
    state.businessTypes = [];

    renderForm();
    loadWallet();
    loadCategories();
  },
};

function renderForm() {
  Modal.open({
    title: '🛒 Mua gói Kiosk',
    body: `
      <div class="kiosk-purchase-container">
        <div class="topup-summary-bar">
          <div>Số dư Ví: <strong class="text-gold" id="kp-wallet-balance">…</strong></div>
        </div>

        <div id="kp-error" class="form-error hidden"></div>

        <label class="form-group">
          <span>Danh mục *</span>
          <select class="form-control" id="kp-category" required>
            <option value="">Đang tải danh mục…</option>
          </select>
        </label>

        <label class="form-group">
          <span>Loại hình kinh doanh *</span>
          <select class="form-control" id="kp-business-type" required disabled>
            <option value="">Chọn danh mục trước</option>
          </select>
        </label>

        <div class="form-row">
          <label class="form-group">
            <span>Số tháng *</span>
            <input class="form-control" id="kp-months" type="number" min="1" max="36" step="1" value="1" required />
          </label>
          <label class="form-group">
            <span>Tên Facebook (tuỳ chọn)</span>
            <input class="form-control" id="kp-facebook-name" type="text" placeholder="Tên hiển thị Kiosk" />
          </label>
        </div>

        <label class="form-group">
          <span>Link Facebook (tuỳ chọn)</span>
          <input class="form-control" id="kp-facebook-link" type="url" placeholder="https://www.facebook.com/..." />
        </label>

        <div class="topup-summary-bar">
          <div>Giá/tháng: <strong id="kp-price-per-month">—</strong></div>
          <div class="total">Thành tiền: <strong class="text-gold" id="kp-total">—</strong></div>
        </div>

        <div class="modal-actions">
          <button class="btn-secondary" type="button" id="kp-cancel">Hủy</button>
          <button class="btn-primary" type="button" id="kp-submit" disabled>Mua (trừ ví) ➔</button>
        </div>
      </div>
    `,
  });

  document.getElementById('kp-cancel')?.addEventListener('click', Modal.close);
  document.getElementById('kp-category')?.addEventListener('change', async (event) => {
    await loadBusinessTypes(event.target.value);
  });
  document.getElementById('kp-business-type')?.addEventListener('change', () => {
    state.selectedBusinessType = state.businessTypes.find(
      (bt) => String(bt.id) === document.getElementById('kp-business-type').value,
    ) || null;
    updateTotal();
  });
  document.getElementById('kp-months')?.addEventListener('input', updateTotal);
  document.getElementById('kp-submit')?.addEventListener('click', submitPurchase);
}

async function loadWallet() {
  const info = await WalletService.getWalletInfo(state.customerId);
  state.walletBalance = Number(info?.totalAvailable || 0);
  const el = document.getElementById('kp-wallet-balance');
  if (el) el.textContent = formatCurrency(state.walletBalance);
  updateTotal();
}

async function loadCategories() {
  const select = document.getElementById('kp-category');
  if (!select) return;
  try {
    const { data } = await CategoryService.listActive();
    state.categories = data || [];
    select.innerHTML = `
      <option value="">Chọn danh mục</option>
      ${state.categories.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name || 'Không tên')}</option>`).join('')}
    `;
  } catch (error) {
    select.innerHTML = '<option value="">Không tải được danh mục</option>';
    showError(error?.message || 'Không thể tải danh mục.');
  }
}

async function loadBusinessTypes(categoryId) {
  const select = document.getElementById('kp-business-type');
  if (!select) return;
  state.businessTypes = [];
  state.selectedBusinessType = null;
  updateTotal();

  if (!categoryId) {
    select.disabled = true;
    select.innerHTML = '<option value="">Chọn danh mục trước</option>';
    return;
  }

  select.disabled = true;
  select.innerHTML = '<option value="">Đang tải…</option>';
  try {
    const { data } = await BusinessTypeService.listByCategory(categoryId);
    state.businessTypes = data || [];
    select.innerHTML = `
      <option value="">Chọn loại hình kinh doanh</option>
      ${state.businessTypes.map((bt) => `<option value="${escapeHtml(bt.id)}">${escapeHtml(bt.name || 'Không tên')} · ${formatCurrency(bt.price_per_month || 0)}/tháng</option>`).join('')}
    `;
    select.disabled = false;
  } catch (error) {
    select.innerHTML = '<option value="">Không tải được loại hình</option>';
    showError(error?.message || 'Không thể tải loại hình kinh doanh.');
  }
}

function updateTotal() {
  const months = Number(document.getElementById('kp-months')?.value || 0);
  const price = Number(state.selectedBusinessType?.price_per_month || 0);
  const total = price * months;

  const priceEl = document.getElementById('kp-price-per-month');
  const totalEl = document.getElementById('kp-total');
  const submit = document.getElementById('kp-submit');

  if (priceEl) priceEl.textContent = state.selectedBusinessType ? formatCurrency(price) : '—';
  if (totalEl) totalEl.textContent = total ? formatCurrency(total) : '—';

  const valid = Boolean(state.selectedBusinessType) && Number.isInteger(months) && months >= 1 && months <= 36;
  if (submit) submit.disabled = !valid;

  clearError();
  if (valid && total > state.walletBalance) {
    showError(`Số dư ví không đủ (cần ${formatCurrency(total)}). Vui lòng nạp thêm.`);
    if (submit) submit.disabled = true;
  }
}

async function submitPurchase() {
  const submit = document.getElementById('kp-submit');
  const businessTypeId = document.getElementById('kp-business-type')?.value;
  const months = Number(document.getElementById('kp-months')?.value || 0);
  const facebookName = document.getElementById('kp-facebook-name')?.value.trim() || undefined;
  const facebookLink = document.getElementById('kp-facebook-link')?.value.trim() || undefined;

  if (!businessTypeId) {
    showError('Vui lòng chọn loại hình kinh doanh.');
    return;
  }

  if (submit) {
    submit.disabled = true;
    submit.textContent = 'Đang xử lý…';
  }

  try {
    const result = await KioskService.purchase({ businessTypeId, months, facebookName, facebookLink });
    Modal.open({
      title: '🎉 Mua gói Kiosk thành công!',
      body: `
        <div class="status-result-box success">
          <div class="status-icon">✅</div>
          <div class="status-title">Đã kích hoạt Kiosk</div>
          <div class="status-desc">
            Tổng thanh toán: <strong class="text-gold">${formatCurrency(result?.totalPaid || 0)}</strong><br/>
            Ngày hết hạn: <strong>${escapeHtml(result?.kiosk?.end_date || '—')}</strong>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-primary" type="button" id="kp-done">Đóng</button>
        </div>
      `,
    });
    document.getElementById('kp-done')?.addEventListener('click', async () => {
      Modal.close();
      await state.onPurchased?.();
    });
  } catch (error) {
    showError(error?.message || 'Không thể mua gói Kiosk.');
    if (submit) {
      submit.disabled = false;
      submit.textContent = 'Mua (trừ ví) ➔';
    }
  }
}

function showError(message) {
  const el = document.getElementById('kp-error');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

function clearError() {
  const el = document.getElementById('kp-error');
  if (!el) return;
  el.textContent = '';
  el.classList.add('hidden');
}
