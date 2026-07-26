import { escapeHtml } from '../utils/html.js';

export function AppLayout({ navSections, user }) {
  const displayName = user?.display_name || user?.username || 'Người dùng';
  const ROLE_LABELS = {
    admin: 'Quản trị viên',
    user: 'Khách hàng Kiosk',
  };
  const roleLabel = ROLE_LABELS[user?.role] || 'Khách hàng Kiosk';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U';

  return `
    <div class="app-shell">
      <aside class="sidebar" data-sidebar>
        <div class="sidebar-logo">
          <div class="logo-mark">🏪</div>
          <div>
            <div class="sidebar-title">Quản lý Kiosk</div>
            <div class="sidebar-sub">Diễn Châu · À Đây Rồi</div>
          </div>
        </div>
        <nav class="sidebar-nav" aria-label="Điều hướng chính">
          ${navSections.map(renderNavSection).join('')}
        </nav>
        <div class="sidebar-footer">
          <div class="sidebar-wallet-card" data-sidebar-wallet-card>
            <div class="wallet-info-meta">
              <span class="wallet-icon-sm font-emoji">💳</span>
              <div class="wallet-text-group">
                <span class="wallet-label-sm">Ví Ảo KioskHub</span>
                <strong class="wallet-balance-val text-gold" data-sidebar-wallet-balance>…</strong>
              </div>
            </div>
            <button class="btn-topup-sidebar" type="button" data-sidebar-topup title="Nạp tiền vào Ví Ảo">+ Nạp</button>
          </div>

          <div class="sidebar-user-row">
            <div class="user-avatar">${escapeHtml(initial)}</div>
            <div class="sidebar-user-meta">
              <div class="user-name">${escapeHtml(displayName)}</div>
              <div class="user-role">${escapeHtml(roleLabel)}</div>
            </div>
            <button class="logout-button" type="button" data-logout aria-label="Đăng xuất">↪</button>
          </div>
        </div>
      </aside>

      <main class="main-content">
        <header class="top-bar">
          <div class="top-bar-left">
            <button class="icon-button" type="button" data-menu-toggle aria-label="Mở menu" aria-expanded="false">☰</button>
            <div class="page-title" data-page-title>Tổng quan</div>
          </div>
          <div class="top-bar-right">
            <span class="current-date" data-current-date></span>
          </div>
        </header>
        <div class="page-content" data-route-outlet></div>
      </main>
    </div>

    <div class="modal-overlay hidden" data-modal-overlay>
      <div class="modal" data-modal role="dialog" aria-modal="true" aria-labelledby="app-modal-title">
        <div class="modal-header">
          <h3 id="app-modal-title" data-modal-title></h3>
          <button class="modal-close" type="button" data-modal-close aria-label="Đóng">✕</button>
        </div>
        <div class="modal-body" data-modal-body></div>
      </div>
    </div>

    <div class="toast-container" data-toast-container aria-live="polite" aria-atomic="true"></div>
  `;
}

function renderNavSection(section) {
  return `
    <div class="nav-section">
      <div class="nav-section-label">${section.label}</div>
      ${section.items.map(renderNavItem).join('')}
    </div>
  `;
}

function renderNavItem(item) {
  if (item.children && item.children.length > 0) {
    return `
      <div class="nav-item-group expanded" data-nav-group="${item.route}">
        <div class="nav-group-header" data-nav-toggle="${item.route}">
          <div class="nav-group-title-wrapper">
            <span class="nav-icon" aria-hidden="true">${item.icon}</span>
            <span class="nav-group-title">${item.label}</span>
          </div>
          <span class="nav-chevron font-emoji">⌃</span>
        </div>
        <div class="nav-sub-menu">
          ${item.children.map((child) => `
            <a href="#/${child.route}?type=${child.taskType}" class="nav-sub-item" data-nav-route="${child.route}" data-nav-type="${child.taskType}">
              <span>${child.label}</span>
            </a>
          `).join('')}
        </div>
      </div>
    `;
  }

  return `
    <a href="#/${item.route}" class="nav-item" data-nav-route="${item.route}">
      <span class="nav-icon" aria-hidden="true">${item.icon}</span>
      <span>${item.label}</span>
    </a>
  `;
}

// Attach event listener for collapsible sidebar sub-menus
document.addEventListener('click', (event) => {
  const toggleBtn = event.target.closest('[data-nav-toggle]');
  if (toggleBtn) {
    const group = toggleBtn.closest('.nav-item-group');
    if (group) {
      group.classList.toggle('expanded');
    }
  }
});
