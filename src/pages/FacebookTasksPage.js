import { EmptyState } from '../components/EmptyState.js';
import { FacebookVerificationModal } from '../components/FacebookVerificationModal.js';
import { PageHeader } from '../components/PageHeader.js';
import { Toast } from '../components/Toast.js';
import { WalletTopupModal } from '../components/WalletTopupModal.js';
import { AuthService } from '../services/AuthService.js';
import { CustomerService } from '../services/CustomerService.js';
import { FacebookTaskService, TASK_TYPES } from '../services/FacebookTaskService.js';
import { WalletService } from '../services/WalletService.js';
import { formatCurrency } from '../utils/currency.js';
import { escapeHtml } from '../utils/html.js';

const state = {
  activeTab: 'marketplace', // 'marketplace', 'create', 'mytasks'
  currentCustomer: null,
  walletInfo: { walletBalance: 0, bonusBalance: 0, totalAvailable: 0 },
  activeTasks: [],
  myTasks: [],
  selectedTaskTypeFilter: '',
  createTaskForm: {
    taskType: 'like_post',
    postUrl: '',
    targetQuantity: 50,
    unitPrice: 500,
    note: '',
  },
  isLoading: false,
};

export function FacebookTasksPage() {
  return `
    ${PageHeader({
    title: 'Nhiệm vụ Tương tác Facebook',
  })}

    <div class="tasks-page-container">
      <div id="tasks-wallet-banner-outlet"></div>

      <div class="task-tabs-bar">
        <button class="task-tab ${state.activeTab === 'marketplace' ? 'active' : ''}" type="button" data-task-tab="marketplace">
          ⚡ Chợ Nhiệm vụ
        </button>
        <button class="task-tab ${state.activeTab === 'create' ? 'active' : ''}" type="button" data-task-tab="create">
          ➕ Đăng Nhiệm vụ
        </button>
        <button class="task-tab ${state.activeTab === 'mytasks' ? 'active' : ''}" type="button" data-task-tab="mytasks">
          📋 Nhiệm vụ của Tôi
        </button>
      </div>

      <div id="tasks-tab-content">
        <div class="empty-state"><div class="spinner-small"></div> Đang tải...</div>
      </div>
    </div>
  `;
}

FacebookTasksPage.afterRender = async function afterRenderFacebookTasks({ params } = {}) {
  const typeFilter = params?.get('type');
  if (typeFilter) {
    state.selectedTaskTypeFilter = typeFilter;
    state.createTaskForm.taskType = typeFilter;
  }
  bindTabEvents();
  await loadUserData();
  renderTabContent();
};

async function loadUserData() {
  state.isLoading = true;
  try {
    const session = await AuthService.getCurrentSession();
    if (session?.user?.id) {
      const userId = session.user.id;
      const profile = await AuthService.getCurrentProfile(userId);
      const userEmail = session.user.email || '';

      // Nhiệm vụ Facebook & Ví Ảo là tính năng của khách hàng (role 'user').
      // Admin/reviewer không có bản ghi trong bảng `customers`, nên bỏ qua các
      // truy vấn hồ sơ + ví để tránh lỗi 404 (/customers/:id) và 406 (ví .single()).
      if (profile?.role === 'user') {
        let customer = null;
        try {
          const { data } = await CustomerService.getById(userId);
          customer = data;
        } catch (err) {
          console.warn('[FacebookTasksPage] Customer lookup fallback for user:', userId);
        }

        if (!customer) {
          const displayName = session.user.user_metadata?.display_name || userEmail.split('@')[0] || 'Người dùng 1';
          customer = {
            id: userId,
            facebook_name: displayName,
            status: 'active',
            wallet_balance: 0,
            bonus_balance: 0,
          };
        }

        state.currentCustomer = customer;
        state.walletInfo = await WalletService.getWalletInfo(customer.id);
      } else {
        // Không phải khách hàng: hiển thị banner với số dư 0, không gọi API khách hàng/ví.
        state.currentCustomer = {
          id: userId,
          facebook_name: profile?.display_name || userEmail.split('@')[0] || 'Quản trị viên',
          status: 'active',
          wallet_balance: 0,
          bonus_balance: 0,
        };
        state.walletInfo = { walletBalance: 0, bonusBalance: 0, totalAvailable: 0 };
      }
    }
  } catch (err) {
    console.warn('[FacebookTasksPage] Load user error:', err);
  } finally {
    state.isLoading = false;
  }
}

function bindTabEvents() {
  document.querySelectorAll('[data-task-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeTab = btn.dataset.taskTab;
      document.querySelectorAll('[data-task-tab]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderTabContent();
    });
  });
}

function renderWalletBanner() {
  const container = document.getElementById('tasks-wallet-banner-outlet');
  if (!container) return;

  const isVerified = Boolean(state.currentCustomer?.facebook_verified);

  if (isVerified) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="tasks-banner-wrapper">
      <div class="fb-verified-mini-banner warning">
        <div class="mini-card-info">
          <span class="banner-icon font-emoji">⚠️</span>
          <div class="mini-card-title">Bạn chưa xác thực tài khoản Facebook cá nhân</div>
        </div>
        <button class="btn-secondary compact" type="button" id="tasks-verify-fb-btn">Xác thực ngay ➔</button>
      </div>
    </div>
  `;

  document.getElementById('tasks-verify-fb-btn')?.addEventListener('click', () => {
    openFBVerificationPrompt();
  });
}

function openFBVerificationPrompt(onDone) {
  FacebookVerificationModal.open({
    customerId: state.currentCustomer?.id,
    currentFacebookUrl: state.currentCustomer?.facebook_link || '',
    currentFacebookId: state.currentCustomer?.facebook_id || '',
    onVerified: async () => {
      await loadUserData();
      renderTabContent();
      await onDone?.();
    },
  });
}

function renderTabContent() {
  renderWalletBanner();
  const outlet = document.getElementById('tasks-tab-content');
  if (!outlet) return;

  switch (state.activeTab) {
    case 'marketplace':
      renderMarketplaceTab(outlet);
      break;
    case 'create':
      renderCreateTaskTab(outlet);
      break;
    case 'mytasks':
      renderMyTasksTab(outlet);
      break;
    default:
      renderMarketplaceTab(outlet);
  }
}

/**
 * TAB 1: Task Marketplace (Chợ Nhiệm vụ)
 */
async function renderMarketplaceTab(container) {
  container.innerHTML = `<div class="empty-state"><div class="spinner-small"></div> Đang đọc danh sách nhiệm vụ từ chợ...</div>`;

  const { data: tasks } = await FacebookTaskService.listActiveTasks({
    taskType: state.selectedTaskTypeFilter,
    workerId: state.currentCustomer?.id,
  });

  state.activeTasks = tasks || [];

  container.innerHTML = `
    ${!state.activeTasks.length ? `
      <div class="empty-state">
        <div class="empty-state-icon">🎯</div>
        <div class="empty-state-title">Chưa có nhiệm vụ mới</div>
        <div class="empty-state-message">Hiện chưa có nhiệm vụ chéo nào thuộc danh mục này. Hãy chọn dịch vụ khác ở thanh Sidebar góc trái hoặc chuyển sang tab "Đăng Nhiệm vụ Mới" để tạo!</div>
      </div>
    ` : `
      <div class="tasks-grid">
        ${state.activeTasks.map(renderTaskCard).join('')}
      </div>
    `}
  `;

  // Bind Work Submission Events
  container.querySelectorAll('[data-do-task]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const taskId = btn.dataset.doTask;
      const task = state.activeTasks.find((t) => t.id === taskId);
      if (!task) return;

      if (!state.currentCustomer?.id) {
        Toast.show('Cần thông tin Khách hàng để thực hiện nhiệm vụ.');
        return;
      }

      if (!state.currentCustomer?.facebook_verified) {
        Toast.show('Bạn cần xác thực tài khoản Facebook công khai (>= 100 bạn bè) trước khi làm nhiệm vụ.');
        openFBVerificationPrompt();
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Đang gửi bằng chứng...';

      try {
        const result = await FacebookTaskService.submitTaskWork({
          taskId: task.id,
          workerId: state.currentCustomer.id,
        });

        Toast.show(result.message);
        await loadUserData();
        renderMarketplaceTab(container);
      } catch (err) {
        Toast.show(err?.message || 'Không thể thực hiện nhiệm vụ.');
        btn.disabled = false;
        btn.textContent = 'Gửi bằng chứng ➔';
      }
    });
  });
}

function renderTaskCard(task) {
  const typeObj = TASK_TYPES.find((t) => t.id === task.task_type) || TASK_TYPES[0];
  const remaining = Math.max(0, task.target_quantity - (task.completed_quantity || 0));

  return `
    <div class="task-card">
      <div class="task-card-header">
        <div class="task-type-badge">
          <span>${typeObj.icon}</span>
          <strong>${typeObj.name}</strong>
        </div>
        <div class="task-reward-tag">+${formatCurrency(task.unit_price)}</div>
      </div>

      <div class="task-card-body">
        <div class="task-url-box">
          <a class="task-url-link" href="${escapeHtml(task.post_url)}" target="_blank" rel="noreferrer">
            ${escapeHtml(task.post_url)} ↗
          </a>
        </div>
        <div class="task-progress-bar">
          <div class="progress-fill" style="width: ${Math.min(100, (task.completed_quantity / task.target_quantity) * 100)}%;"></div>
        </div>
        <div class="task-meta-info">
          <span>Còn lại: <strong>${remaining}/${task.target_quantity}</strong></span>
          <span>Đăng bởi: <strong>${escapeHtml(task.customers?.facebook_name || 'Khách hàng')}</strong></span>
        </div>
      </div>

      <div class="task-card-footer">
        <a class="btn-secondary compact" href="${escapeHtml(task.post_url)}" target="_blank" rel="noreferrer">Mở Facebook ↗</a>
        <button class="btn-primary compact" type="button" data-do-task="${escapeHtml(task.id)}">Gửi bằng chứng ➔</button>
      </div>
    </div>
  `;
}

/**
 * TAB 2: Create New Task (Đăng Nhiệm vụ Mới)
 */
function renderCreateTaskTab(container) {
  const { taskType, postUrl, targetQuantity, unitPrice, note } = state.createTaskForm;
  const selectedTypeObj = TASK_TYPES.find((t) => t.id === taskType) || TASK_TYPES[0];
  const totalCost = Number(targetQuantity || 0) * Number(unitPrice || 0);
  const totalAvailable = state.walletInfo.totalAvailable;
  const hasEnoughMoney = totalAvailable >= totalCost;

  container.innerHTML = `
    <div class="form-card create-task-card">
      <h3>➕ Đăng Nhiệm vụ Tương tác Facebook Mới</h3>
      <p class="muted-text">Chi phí nhiệm vụ sẽ được trừ trực tiếp từ Số dư Ví Ảo KioskHub của bạn và tự động thưởng cho người làm.</p>

      <form id="create-facebook-task-form" novalidate>
        <div id="create-task-error" class="form-error hidden"></div>

        <div class="form-group">
          <span class="form-label">Dịch vụ tương tác:</span>
          <div class="active-type-badge-box">
            <span class="type-icon">${selectedTypeObj.icon}</span>
            <strong class="type-name">${selectedTypeObj.name}</strong>
          </div>
        </div>

        <label class="form-group">
          <span>Đường dẫn Facebook (URL Bài viết / Trang cá nhân / Fanpage) *</span>
          <input class="form-control" id="create-task-url" type="url" placeholder="https://www.facebook.com/..." value="${escapeHtml(postUrl)}" required />
        </label>

        <div class="form-row">
          <label class="form-group">
            <span>Số lượng tương tác cần mua *</span>
            <input class="form-control" id="create-task-qty" type="number" min="1" step="10" value="${targetQuantity}" required />
          </label>
          <label class="form-group">
            <span>Đơn giá trả thưởng / lượt (VNĐ) *</span>
            <input class="form-control" id="create-task-price" type="number" min="100" step="100" value="${unitPrice}" required />
          </label>
        </div>

        <label class="form-group">
          <span>Ghi chú thêm <small class="field-optional">Không bắt buộc</small></span>
          <input class="form-control" id="create-task-note" type="text" placeholder="Ví dụ: Thả tim cho bài viết..." value="${escapeHtml(note)}" />
        </label>

        <div class="create-task-cost-box">
          <div class="setting-item">
            <span class="setting-name">Tổng chi phí nhiệm vụ (${targetQuantity} lượt x ${formatCurrency(unitPrice)})</span>
            <span class="setting-value strong-cell text-gold">${formatCurrency(totalCost)}</span>
          </div>
          <div class="setting-item">
            <span class="setting-name">Số dư Ví khả dụng của bạn</span>
            <span class="setting-value ${hasEnoughMoney ? 'text-green' : 'text-danger'}">${formatCurrency(totalAvailable)}</span>
          </div>
          ${!hasEnoughMoney ? `
            <div class="wallet-insufficient-notice">
              ⚠️ Số dư ví của bạn không đủ để đăng nhiệm vụ này (Thiếu <strong>${formatCurrency(totalCost - totalAvailable)}</strong>).
              Vui lòng nạp thêm tiền vào Ví.
            </div>
          ` : ''}
        </div>

        <div class="modal-actions">
          ${!hasEnoughMoney ? `
            <button class="btn-primary" type="button" id="create-task-topup-btn">💳 Nạp Ví Ngay</button>
          ` : `
            <button class="btn-primary" type="submit" id="create-task-submit-btn">Đăng Nhiệm vụ & Trừ Ví ➔</button>
          `}
        </div>
      </form>
    </div>
  `;

  container.getElementById('create-task-url')?.addEventListener('input', (e) => { state.createTaskForm.postUrl = e.target.value; });
  container.getElementById('create-task-qty')?.addEventListener('input', (e) => {
    state.createTaskForm.targetQuantity = Number(e.target.value || 0);
    renderCreateTaskTab(container);
  });
  container.getElementById('create-task-price')?.addEventListener('input', (e) => {
    state.createTaskForm.unitPrice = Number(e.target.value || 0);
    renderCreateTaskTab(container);
  });
  container.getElementById('create-task-note')?.addEventListener('input', (e) => { state.createTaskForm.note = e.target.value; });

  container.getElementById('create-task-topup-btn')?.addEventListener('click', () => {
    if (!state.currentCustomer?.id) {
      Toast.show('Không tìm thấy thông tin Khách hàng.');
      return;
    }
    WalletTopupModal.open({
      customerId: state.currentCustomer.id,
      customerName: state.currentCustomer.facebook_name || 'Khách hàng',
      onTopupSuccess: async () => {
        await loadUserData();
        renderCreateTaskTab(container);
      },
    });
  });

  container.getElementById('create-facebook-task-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.currentCustomer?.id) {
      Toast.show('Cần thông tin Khách hàng để tạo nhiệm vụ.');
      return;
    }

    const btn = document.getElementById('create-task-submit-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang đăng nhiệm vụ & trừ tiền ví...';
    }

    try {
      await FacebookTaskService.createTask({
        creatorId: state.currentCustomer.id,
        taskType: state.createTaskForm.taskType,
        postUrl: state.createTaskForm.postUrl,
        targetQuantity: state.createTaskForm.targetQuantity,
        unitPrice: state.createTaskForm.unitPrice,
        note: state.createTaskForm.note,
      });

      Toast.show('Đăng nhiệm vụ chéo Facebook thành công!');
      state.createTaskForm.postUrl = '';
      await loadUserData();
      state.activeTab = 'mytasks';
      document.querySelectorAll('[data-task-tab]').forEach((b) => b.classList.toggle('active', b.dataset.taskTab === 'mytasks'));
      renderTabContent();
    } catch (err) {
      if (err?.message?.startsWith('INSUFFICIENT_WALLET')) {
        Toast.show('Số dư ví không đủ. Vui lòng nạp ví.');
      } else {
        Toast.show(err?.message || 'Không thể đăng nhiệm vụ.');
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Đăng Nhiệm vụ & Trừ Ví ➔';
      }
    }
  });
}

/**
 * TAB 3: My Tasks (Nhiệm vụ của Tôi - Dành cho Người A)
 */
async function renderMyTasksTab(container) {
  if (!state.currentCustomer?.id) {
    container.innerHTML = EmptyState({ title: 'Chưa có thông tin Khách hàng', message: 'Vui lòng đăng nhập để xem danh sách nhiệm vụ đã đăng.' });
    return;
  }

  container.innerHTML = `<div class="empty-state"><div class="spinner-small"></div> Đang tải nhiệm vụ của bạn...</div>`;

  const { data: myTasks } = await FacebookTaskService.listTasksByCreator(state.currentCustomer.id);
  state.myTasks = myTasks || [];

  if (!state.myTasks.length) {
    container.innerHTML = EmptyState({
      title: 'Bạn chưa đăng nhiệm vụ nào',
      message: 'Chuyển sang tab "Đăng Nhiệm vụ Mới" để bắt đầu tăng tương tác Facebook!',
    });
    return;
  }

  container.innerHTML = `
    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>Loại</th>
            <th>Link Facebook</th>
            <th>Đã hoàn thành</th>
            <th>Đơn giá</th>
            <th>Tổng chi phí</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${state.myTasks.map((task) => `
            <tr>
              <td>${renderTaskTypeBadge(task.task_type)}</td>
              <td><a class="table-link" href="${escapeHtml(task.post_url)}" target="_blank" rel="noreferrer">${escapeHtml(task.post_url)} ↗</a></td>
              <td><strong class="text-gold">${task.completed_quantity} / ${task.target_quantity}</strong></td>
              <td>${formatCurrency(task.unit_price)}</td>
              <td class="strong-cell">${formatCurrency(task.total_cost)}</td>
              <td>${renderTaskStatusBadge(task.status)}</td>
              <td>
                ${task.status === 'active' ? `
                  <button class="btn-danger compact" type="button" data-cancel-task="${escapeHtml(task.id)}">Hủy & Hoàn tiền</button>
                ` : '—'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  container.querySelectorAll('[data-cancel-task]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const taskId = btn.dataset.cancelTask;
      if (!confirm('Bạn có chắc chắn muốn hủy nhiệm vụ này? Số tiền lượt chưa thực hiện sẽ được hoàn lại vào Ví Ảo.')) return;

      btn.disabled = true;
      btn.textContent = 'Đang hủy...';

      try {
        const result = await FacebookTaskService.cancelTask(taskId, state.currentCustomer.id);
        Toast.show(`Đã hủy nhiệm vụ và hoàn ${formatCurrency(result.refundAmount)} vào Ví Ảo!`);
        await loadUserData();
        renderMyTasksTab(container);
      } catch (err) {
        Toast.show(err?.message || 'Không thể hủy nhiệm vụ.');
        btn.disabled = false;
        btn.textContent = 'Hủy & Hoàn tiền';
      }
    });
  });
}

function renderTaskTypeBadge(type) {
  const obj = TASK_TYPES.find((t) => t.id === type) || TASK_TYPES[0];
  return `<span class="badge badge-active">${obj.icon} ${obj.name}</span>`;
}

function renderTaskStatusBadge(status) {
  if (status === 'active') return '<span class="status-dot green">Đang chạy</span>';
  if (status === 'completed') return '<span class="status-dot green">Đã hoàn thành</span>';
  if (status === 'cancelled') return '<span class="status-dot red">Đã hủy</span>';
  return `<span class="badge">${escapeHtml(status)}</span>`;
}
