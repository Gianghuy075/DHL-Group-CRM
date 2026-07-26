import { EmptyState } from '../components/EmptyState.js';
import { PageHeader } from '../components/PageHeader.js';
import { openRenewKioskForm } from '../components/RenewKioskForm.js';
import { openBusinessTypeForm } from '../components/BusinessTypeForm.js';
import { KioskPurchaseModal } from '../components/KioskPurchaseModal.js';
import { Toolbar } from '../components/Toolbar.js';
import { Toast } from '../components/Toast.js';
import { AuthService } from '../services/AuthService.js';
import { BusinessTypeService } from '../services/BusinessTypeService.js';
import { KioskService } from '../services/KioskService.js';
import { formatCurrency } from '../utils/currency.js';
import { formatDate } from '../utils/date.js';
import { debounce } from '../utils/dom.js';
import { escapeHtml } from '../utils/html.js';

const PAGE_SIZE_OPTIONS = [12, 24, 48];
const KIOSK_STATUSES = [
  { value: 'active', label: 'Hoạt động' },
  { value: 'expired', label: 'Hết hạn' },
  { value: 'warning', label: 'Sắp hết hạn' },
  { value: 'pending', label: 'Chờ duyệt' },
];

const state = {
  activeTab: 'auto', // 'store', 'mykiosks', 'admin_kiosks', 'admin_packages'
  searchTerm: '',
  status: '',
  businessTypeId: '',
  page: 1,
  pageSize: 12,
  total: 0,
  requestId: 0,
  businessTypes: [],
  currentProfile: null,
};

export function KiosksPage() {
  return `
    <div id="kiosk-page-header-outlet">
      ${PageHeader({ title: 'Đang tải...' })}
    </div>

    <div class="kiosks-page-container">
      <div id="kiosk-tabs-outlet"></div>
      <div id="kiosk-tab-content">
        <div class="empty-state"><div class="spinner-small"></div> Đang tải hệ thống...</div>
      </div>
    </div>
  `;
}

KiosksPage.afterRender = async function afterRenderKiosks() {
  const session = await AuthService.getCurrentSession();
  const profile = session?.user?.id ? await AuthService.getCurrentProfile(session.user.id) : null;
  state.currentProfile = profile;

  const isAdmin = profile?.role === 'admin';
  if (state.activeTab === 'auto') {
    state.activeTab = isAdmin ? 'admin_kiosks' : 'store';
  }

  renderHeader(isAdmin);
  renderTabs(isAdmin);

  bindGlobalEvents(isAdmin);
  await loadKioskStoreCatalog();
  renderTabContent(isAdmin);
};

function renderHeader(isAdmin) {
  const container = document.getElementById('kiosk-page-header-outlet');
  if (!container) return;

  if (isAdmin) {
    container.innerHTML = PageHeader({
      title: 'Quản lý Kiosk Hệ Thống',
      actions: `<button class="btn-primary" id="admin-add-package-btn" type="button">➕ Thêm Gói Kiosk Mới</button>`,
    });
  } else {
    container.innerHTML = PageHeader({
      title: 'Dịch vụ Kiosk Facebook',
      actions: `<button class="btn-primary" id="buy-kiosk-button" type="button">🛒 Mua gói Kiosk Mới</button>`,
    });
  }
}

function renderTabs(isAdmin) {
  const container = document.getElementById('kiosk-tabs-outlet');
  if (!container) return;

  if (isAdmin) {
    container.innerHTML = `
      <div class="task-tabs-bar" style="margin-bottom: 20px;">
        <button class="task-tab ${state.activeTab === 'admin_kiosks' ? 'active' : ''}" type="button" data-kiosk-tab="admin_kiosks">
          📊 Theo dõi Kiosk Khách hàng (${state.total || 'All'})
        </button>

        <button class="task-tab ${state.activeTab === 'admin_packages' ? 'active' : ''}" type="button" data-kiosk-tab="admin_packages">
          ⚙️ Quản lý Gói Kiosk Mở Bán (${state.businessTypes.length})
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="task-tabs-bar" style="margin-bottom: 20px;">
        <button class="task-tab ${state.activeTab === 'store' ? 'active' : ''}" type="button" data-kiosk-tab="store">
          🛒 Danh mục Gói Kiosk Đang Mở Bán
        </button>
        <button class="task-tab ${state.activeTab === 'mykiosks' ? 'active' : ''}" type="button" data-kiosk-tab="mykiosks">
          📱 Kiosk Của Tôi
        </button>
      </div>
    `;
  }

  container.querySelectorAll('[data-kiosk-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeTab = btn.dataset.kioskTab;
      container.querySelectorAll('[data-kiosk-tab]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderTabContent(isAdmin);
    });
  });
}

function bindGlobalEvents(isAdmin) {
  document.getElementById('buy-kiosk-button')?.addEventListener('click', async () => {
    await openPurchaseModal();
  });

  document.getElementById('admin-add-package-btn')?.addEventListener('click', () => {
    openBusinessTypeForm({
      onSaved: async () => {
        Toast.show('Đã lưu Gói Kiosk mở bán thành công!');
        await loadKioskStoreCatalog();
        renderTabs(isAdmin);
        renderTabContent(isAdmin);
      },
    });
  });
}

async function openPurchaseModal(preSelectedCategoryId = '', preSelectedBusinessTypeId = '') {
  let profile = state.currentProfile;
  if (!profile) {
    const session = await AuthService.getCurrentSession();
    profile = session?.user?.id ? await AuthService.getCurrentProfile(session.user.id) : null;
    state.currentProfile = profile;
  }
  if (!profile?.id) return;

  KioskPurchaseModal.open({
    customerId: profile.id,
    customerName: profile.display_name || '',
    preSelectedCategoryId,
    preSelectedBusinessTypeId,
    onPurchased: async () => {
      state.activeTab = 'mykiosks';
      renderTabs(false);
      renderTabContent(false);
    },
  });
}

function renderTabContent(isAdmin) {
  const content = document.getElementById('kiosk-tab-content');
  if (!content) return;

  if (isAdmin) {
    if (state.activeTab === 'admin_packages') {
      renderAdminPackagesTab(content);
    } else {
      renderAdminKiosksTab(content);
    }
  } else {
    if (state.activeTab === 'mykiosks') {
      renderUserKiosksTab(content);
    } else {
      renderUserStoreTab(content);
    }
  }
}

/**
 * ADMIN TAB 2: Manage Packages (Cấu hình Gói Kiosk Mở Bán)
 */
async function renderAdminPackagesTab(container) {
  if (!state.businessTypes.length) {
    container.innerHTML = `<div class="empty-state"><div class="spinner-small"></div> Đang tải gói Kiosk...</div>`;
    await loadKioskStoreCatalog();
  }

  if (!state.businessTypes.length) {
    container.innerHTML = EmptyState({
      title: 'Chưa có Gói Kiosk nào',
      message: 'Nhấn nút "➕ Thêm Gói Kiosk Mới" ở góc trên để tạo gói mở bán đầu tiên!',
    });
    return;
  }

  container.innerHTML = `
    <div class="kiosk-store-grid">
      ${state.businessTypes.map(renderAdminPackageCard).join('')}
    </div>
  `;

  // Bind Admin Edit / Delete Actions
  container.querySelectorAll('[data-edit-package]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editPackage;
      openBusinessTypeForm({
        businessTypeId: id,
        onSaved: async () => {
          Toast.show('Đã cập nhật gói Kiosk!');
          await loadKioskStoreCatalog();
          renderTabContent(true);
        },
      });
    });
  });

  container.querySelectorAll('[data-delete-package]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.deletePackage;
      if (!confirm('Bạn có chắc chắn muốn ẩn/xóa Gói Kiosk này khỏi danh mục mở bán?')) return;

      try {
        await BusinessTypeService.remove(id);
        Toast.show('Đã ẩn gói Kiosk khỏi danh mục!');
        await loadKioskStoreCatalog();
        renderTabContent(true);
      } catch (err) {
        Toast.show(err?.message || 'Không thể xóa gói Kiosk.');
      }
    });
  });
}

function renderAdminPackageCard(bt) {
  const categoryName = bt.categories?.name || 'Gói Dịch Vụ';
  const price = formatCurrency(bt.price_per_month || 0);

  return `
    <article class="kiosk-package-card">
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="package-category-badge">${escapeHtml(categoryName)}</span>
          <span class="badge ${bt.is_active !== false ? 'badge-active' : 'badge-inactive'}">
            ${bt.is_active !== false ? 'Đang mở bán' : 'Tạm ẩn'}
          </span>
        </div>
        <h3 class="package-title">🏬 ${escapeHtml(bt.name || 'Gói Kiosk')}</h3>
        <div class="package-desc">${escapeHtml(bt.description || 'Gói kiosk tự động hỗ trợ đăng bài và chăm sóc CRM 24/7.')}</div>
      </div>

      <div>
        <div class="package-price-box">
          <div class="package-price">${price} <span class="package-period">/ tháng</span></div>
        </div>
        <div class="inline-actions" style="gap: 8px;">
          <button class="btn-secondary compact full-width" type="button" data-edit-package="${escapeHtml(bt.id)}">✏️ Chỉnh sửa Gói</button>
          <button class="table-action-button text-danger compact" type="button" data-delete-package="${escapeHtml(bt.id)}">🗑️ Ẩn Gói</button>
        </div>
      </div>
    </article>
  `;
}

/**
 * ADMIN TAB 1: Admin Customer Kiosks List (Theo dõi Kiosk Toàn Hệ Thống)
 */
async function renderAdminKiosksTab(container) {
  container.innerHTML = `
    ${Toolbar({
      children: `
        <input
          type="search"
          id="kiosk-search"
          class="form-control"
          placeholder="Tìm theo Khách hàng, Facebook ID, tên Facebook, loại hình KD"
          aria-label="Tìm Kiosk"
          autocomplete="off"
        />
        <select id="kiosk-business-type-filter" class="filter-select" aria-label="Lọc loại hình kinh doanh">
          <option value="">Tất cả loại hình KD</option>
          ${state.businessTypes.map((bt) => `<option value="${escapeHtml(bt.id)}">${escapeHtml(bt.name)}</option>`).join('')}
        </select>
        <select id="kiosk-status-filter" class="filter-select" aria-label="Lọc trạng thái">
          <option value="">Tất cả trạng thái</option>
          ${KIOSK_STATUSES.map((status) => `<option value="${status.value}">${status.label}</option>`).join('')}
        </select>
      `,
    })}
    <div class="kiosk-grid" id="kiosk-grid">
      ${EmptyState({ title: 'Đang tải Kiosk', message: 'Đang đọc dữ liệu toàn hệ thống...' })}
    </div>
    <div class="pagination-bar">
      <div id="kiosks-page-summary" class="pagination-summary">—</div>
      <div class="pagination-controls">
        <select id="kiosks-page-size" class="filter-select compact" aria-label="Số kiosk mỗi trang">
          ${PAGE_SIZE_OPTIONS.map((size) => `<option value="${size}" ${size === state.pageSize ? 'selected' : ''}>${size} / trang</option>`).join('')}
        </select>
        <button id="kiosks-prev-page" class="btn-secondary" type="button">Trước</button>
        <button id="kiosks-next-page" class="btn-secondary" type="button">Sau</button>
      </div>
    </div>
  `;

  syncKioskControls();
  bindKiosksListEvents(true);
  await loadKiosks(true);
}

/**
 * USER TAB 1: Store Catalog (Danh mục Gói Kiosk Đang Mở Bán cho User)
 */
async function renderUserStoreTab(container) {
  if (!state.businessTypes.length) {
    container.innerHTML = `<div class="empty-state"><div class="spinner-small"></div> Đang đọc danh mục gói Kiosk...</div>`;
    await loadKioskStoreCatalog();
  }

  const activePackages = state.businessTypes.filter((bt) => bt.is_active !== false);

  if (!activePackages.length) {
    container.innerHTML = EmptyState({
      title: 'Chưa có gói Kiosk nào mở bán',
      message: 'Vui lòng quay lại sau hoặc liên hệ quản trị viên.',
    });
    return;
  }

  container.innerHTML = `
    <div class="kiosk-store-grid">
      ${activePackages.map(renderUserPackageCard).join('')}
    </div>
  `;

  // Bind Store Buy Click Buttons
  container.querySelectorAll('[data-buy-package]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const btId = btn.dataset.buyPackage;
      const catId = btn.dataset.categoryId;
      await openPurchaseModal(catId, btId);
    });
  });
}

function renderUserPackageCard(bt) {
  const categoryName = bt.categories?.name || 'Gói Dịch Vụ';
  const price = formatCurrency(bt.price_per_month || 0);

  return `
    <article class="kiosk-package-card">
      <div>
        <span class="package-category-badge">${escapeHtml(categoryName)}</span>
        <h3 class="package-title">🏬 ${escapeHtml(bt.name || 'Gói Kiosk')}</h3>
        <div class="package-desc">${escapeHtml(bt.description || 'Đã bao gồm tính năng tự động đăng bài, chăm sóc Kiosk 24/7 và đối soát tương tác CRM.')}</div>
      </div>

      <div>
        <div class="package-price-box">
          <div class="package-price">${price} <span class="package-period">/ tháng</span></div>
        </div>
        <button class="btn-primary full-width" type="button" data-buy-package="${escapeHtml(bt.id)}" data-category-id="${escapeHtml(bt.category_id)}">
          🛒 Chọn Mua Gói Này ➔
        </button>
      </div>
    </article>
  `;
}

/**
 * USER TAB 2: User Kiosks List (Kiosk Của Tôi)
 */
async function renderUserKiosksTab(container) {
  container.innerHTML = `
    ${Toolbar({
      children: `
        <input
          type="search"
          id="kiosk-search"
          class="form-control"
          placeholder="Tìm theo Facebook ID, tên Facebook, loại hình KD"
          aria-label="Tìm Kiosk"
          autocomplete="off"
        />
        <select id="kiosk-status-filter" class="filter-select" aria-label="Lọc trạng thái">
          <option value="">Tất cả trạng thái</option>
          ${KIOSK_STATUSES.map((status) => `<option value="${status.value}">${status.label}</option>`).join('')}
        </select>
      `,
    })}
    <div class="kiosk-grid" id="kiosk-grid">
      ${EmptyState({ title: 'Đang tải Kiosk', message: 'Đang đọc dữ liệu...' })}
    </div>
    <div class="pagination-bar">
      <div id="kiosks-page-summary" class="pagination-summary">—</div>
      <div class="pagination-controls">
        <select id="kiosks-page-size" class="filter-select compact" aria-label="Số kiosk mỗi trang">
          ${PAGE_SIZE_OPTIONS.map((size) => `<option value="${size}" ${size === state.pageSize ? 'selected' : ''}>${size} / trang</option>`).join('')}
        </select>
        <button id="kiosks-prev-page" class="btn-secondary" type="button">Trước</button>
        <button id="kiosks-next-page" class="btn-secondary" type="button">Sau</button>
      </div>
    </div>
  `;

  syncKioskControls();
  bindKiosksListEvents(false);
  await loadKiosks(false);
}

async function loadKioskStoreCatalog() {
  try {
    const { data } = await BusinessTypeService.list();
    state.businessTypes = data || [];
  } catch (error) {
    console.warn('[KiosksPage] Failed to load business types catalog:', error);
    state.businessTypes = [];
  }
}

function syncKioskControls() {
  const searchInput = document.getElementById('kiosk-search');
  const statusFilter = document.getElementById('kiosk-status-filter');
  const businessTypeFilter = document.getElementById('kiosk-business-type-filter');
  const pageSizeSelect = document.getElementById('kiosks-page-size');

  if (searchInput) searchInput.value = state.searchTerm;
  if (statusFilter) statusFilter.value = state.status;
  if (businessTypeFilter) businessTypeFilter.value = state.businessTypeId;
  if (pageSizeSelect) pageSizeSelect.value = String(state.pageSize);
}

function bindKiosksListEvents(isAdmin) {
  const searchInput = document.getElementById('kiosk-search');
  const statusFilter = document.getElementById('kiosk-status-filter');
  const businessTypeFilter = document.getElementById('kiosk-business-type-filter');
  const pageSizeSelect = document.getElementById('kiosks-page-size');
  const grid = document.getElementById('kiosk-grid');

  searchInput?.addEventListener('input', debounce((event) => {
    state.searchTerm = event.target.value.trim();
    state.page = 1;
    loadKiosks(isAdmin);
  }, 300));

  statusFilter?.addEventListener('change', (event) => {
    state.status = event.target.value;
    state.page = 1;
    loadKiosks(isAdmin);
  });

  businessTypeFilter?.addEventListener('change', (event) => {
    state.businessTypeId = event.target.value;
    state.page = 1;
    loadKiosks(isAdmin);
  });

  pageSizeSelect?.addEventListener('change', (event) => {
    state.pageSize = Number(event.target.value);
    state.page = 1;
    loadKiosks(isAdmin);
  });

  document.getElementById('kiosks-prev-page')?.addEventListener('click', () => {
    if (state.page <= 1) return;
    state.page -= 1;
    loadKiosks(isAdmin);
  });

  document.getElementById('kiosks-next-page')?.addEventListener('click', () => {
    if (state.page >= totalPages()) return;
    state.page += 1;
    loadKiosks(isAdmin);
  });

  grid?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-kiosk-renew]');
    if (!button) return;

    openRenewKioskForm({
      kioskId: button.dataset.kioskRenew,
      onSaved: () => loadKiosks(isAdmin),
    });
  });
}

async function loadKiosks(isAdmin = false) {
  const requestId = state.requestId + 1;
  state.requestId = requestId;
  setLoadingState();

  try {
    const session = await AuthService.getCurrentSession();
    const customerId = isAdmin ? undefined : session?.user?.id;

    const { data, count } = await KioskService.list({
      searchTerm: state.searchTerm,
      status: state.status,
      businessTypeId: state.businessTypeId,
      customerId,
      pagination: { page: state.page, pageSize: state.pageSize },
    });

    if (requestId !== state.requestId) return;

    state.total = count || 0;
    renderKiosks(data || [], isAdmin);
    renderPagination();
  } catch (error) {
    if (requestId !== state.requestId) return;
    renderError(error);
  }
}

function renderKiosks(kiosks, isAdmin) {
  const grid = document.getElementById('kiosk-grid');
  if (!grid) return;

  if (!kiosks.length) {
    grid.innerHTML = EmptyState({
      title: 'Chưa có Kiosk nào',
      message: isAdmin ? 'Hệ thống chưa có bản ghi Kiosk nào.' : 'Bạn chưa sở hữu Kiosk nào. Hãy chọn mua từ danh mục mở bán!',
    });
    return;
  }

  grid.innerHTML = kiosks.map((k) => renderKioskCard(k, isAdmin)).join('');
}

function renderKioskCard(kiosk, isAdmin) {
  const businessType = kiosk.business_types?.name || '—';
  const category = kiosk.categories?.name || '—';
  const customerName = kiosk.customers?.facebook_name || 'Khách hàng';

  return `
    <article class="kiosk-card">
      <div class="kiosk-card-header">
        <div>
          <div class="kiosk-name">${escapeHtml(kiosk.facebook_name || '—')}</div>
          <div class="kiosk-category">${escapeHtml(category)} ${isAdmin ? `· <small class="text-gold">${escapeHtml(customerName)}</small>` : ''}</div>
        </div>
        ${renderStatusBadge(kiosk.status)}
      </div>
      <div class="kiosk-details">
        ${kioskDetail('Facebook ID', kiosk.facebook_id)}
        ${kioskDetail('Loại hình KD', businessType)}
        ${isAdmin ? kioskDetail('Khách hàng', customerName) : ''}
        ${kioskDetail('Ngày bắt đầu', formatDate(kiosk.start_date))}
        ${kioskDetail('Ngày hết hạn', formatDate(kiosk.end_date))}
        ${kioskDetail('Tổng đã thanh toán', formatCurrency(kiosk.total_paid || 0))}
      </div>
      <div class="kiosk-card-footer">
        <div class="inline-actions">
          <a class="table-link" href="#/kiosk-detail?id=${encodeURIComponent(kiosk.id)}">Chi tiết</a>
          <button class="table-action-button" type="button" data-kiosk-renew="${escapeHtml(kiosk.id)}">Gia hạn</button>
        </div>
        <span class="kiosk-id">ID: ${escapeHtml(kiosk.id || '—')}</span>
      </div>
    </article>
  `;
}

function kioskDetail(label, value) {
  const display = value !== null && value !== undefined && value !== '' ? value : '—';
  return `
    <div class="kiosk-detail">
      <span class="kiosk-detail-label">${label}</span>
      <span class="kiosk-detail-value">${escapeHtml(display)}</span>
    </div>
  `;
}

function setLoadingState() {
  const grid = document.getElementById('kiosk-grid');
  if (grid) {
    grid.innerHTML = EmptyState({
      title: 'Đang tải Kiosk',
      message: 'Đang đọc dữ liệu...',
    });
  }
}

function renderError(error) {
  const grid = document.getElementById('kiosk-grid');
  state.total = 0;
  if (grid) {
    grid.innerHTML = EmptyState({
      title: 'Không thể tải Kiosk',
      message: escapeHtml(error?.message || 'Đã có lỗi xảy ra khi đọc danh sách Kiosk.'),
    });
  }
  renderPagination();
}

function renderPagination() {
  const summary = document.getElementById('kiosks-page-summary');
  const prev = document.getElementById('kiosks-prev-page');
  const next = document.getElementById('kiosks-next-page');
  const pages = totalPages();

  if (summary) {
    summary.textContent = state.total
      ? `Trang ${state.page} / ${pages} · ${state.total} kiosk`
      : '0 kiosk';
  }

  if (prev) prev.disabled = state.page <= 1;
  if (next) next.disabled = state.page >= pages;
}

function renderStatusBadge(status) {
  const normalized = String(status || 'inactive').toLowerCase();
  const safeClass = normalized.replace(/[^a-z0-9-]/g, '') || 'inactive';
  const labels = {
    active: 'Hoạt động',
    inactive: 'Không hoạt động',
    expired: 'Hết hạn',
    warning: 'Sắp hết hạn',
    pending: 'Chờ duyệt',
    suspended: 'Tạm ngưng',
  };

  return `<span class="badge badge-${safeClass}">${labels[normalized] || escapeHtml(status || 'Không rõ')}</span>`;
}

function totalPages() {
  return Math.max(1, Math.ceil(state.total / state.pageSize));
}
