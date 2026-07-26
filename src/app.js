import { Modal } from './components/Modal.js';
import { Toast } from './components/Toast.js';
import { ADMIN_NAV_SECTIONS, USER_NAV_SECTIONS, PAGE_TITLES } from './constants/navigation.js';
import { AppLayout } from './layouts/AppLayout.js';
import { createRouter } from './router/index.js';
import { getSupabaseStatus } from './supabase/client.js';
import { AuthService } from './services/AuthService.js';
import { formatToday } from './utils/date.js';
import { BusinessTypesPage } from './pages/BusinessTypesPage.js';
import { CategoriesPage } from './pages/CategoriesPage.js';
import { CustomerDetailPage } from './pages/CustomerDetailPage.js';
import { CustomersPage } from './pages/CustomersPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { KioskDetailPage } from './pages/KioskDetailPage.js';
import { KiosksPage } from './pages/KiosksPage.js';
import { LogsPage } from './pages/LogsPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { PaymentsPage } from './pages/PaymentsPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegistrationRequestsPage } from './pages/RegistrationRequestsPage.js';
import { StaffPage } from './pages/StaffPage.js';
import { FacebookTasksPage } from './pages/FacebookTasksPage.js';
import { TaskReviewPage } from './pages/TaskReviewPage.js';
import { AccountPage } from './pages/AccountPage.js';
import { WalletService } from './services/WalletService.js';
import { WalletTopupModal } from './components/WalletTopupModal.js';
import { formatCurrency } from './utils/currency.js';

const routes = {
  dashboard: DashboardPage,
  customers: CustomersPage,
  'customer-detail': CustomerDetailPage,
  kiosks: KiosksPage,
  'kiosk-detail': KioskDetailPage,
  payments: PaymentsPage,
  'facebook-tasks': FacebookTasksPage,
  'task-review': TaskReviewPage,
  categories: CategoriesPage,
  'business-types': BusinessTypesPage,
  logs: LogsPage,
  settings: SettingsPage,
  register: RegisterPage,
  reports: ReportsPage,
  'registration-requests': RegistrationRequestsPage,
  staff: StaffPage,
  profile: AccountPage,
};

async function initApp() {
  const root = document.getElementById('app');
  if (!root) return;

  try {
    const session = await AuthService.initialize();
    const initialRoute = getRouteName();

    if (!session && initialRoute === 'register') {
      renderPublicRegistration(root);
      return;
    }

    if (!session) {
      renderLogin(root);
      return;
    }

    const profile = await AuthService.getCurrentProfile(session.user.id);
    if (!profile?.is_active) {
      await AuthService.signOut();
      renderLogin(root, 'Tài khoản chưa được cấp quyền hoặc đã bị khóa.');
      return;
    }

    renderAuthenticatedApp(root, profile);
  } catch (error) {
    renderLogin(root, error?.message || 'Không thể khởi tạo phiên đăng nhập.');
  }
}

function getRoleConfig(role) {
  if (role === 'user') {
    return {
      navSections: USER_NAV_SECTIONS,
      allowedRoutes: new Set(['facebook-tasks', 'kiosks', 'kiosk-detail', 'payments', 'profile']),
      defaultRoute: 'facebook-tasks',
    };
  }

  // Admin (Bao gồm toàn bộ quyền Quản trị & Kiểm duyệt)
  return {
    navSections: ADMIN_NAV_SECTIONS,
    allowedRoutes: new Set(Object.keys(routes)),
    defaultRoute: 'dashboard',
  };
}

function renderAuthenticatedApp(root, profile) {
  const { navSections, allowedRoutes, defaultRoute } = getRoleConfig(profile.role);

  if (!allowedRoutes.has(getRouteName())) window.location.hash = `#/${defaultRoute}`;

  root.innerHTML = AppLayout({ navSections, user: profile });
  Modal.mount();
  Toast.mount();

  const sidebar = document.querySelector('[data-sidebar]');
  const outlet = document.querySelector('[data-route-outlet]');
  const pageTitle = document.querySelector('[data-page-title]');
  const currentDate = document.querySelector('[data-current-date]');
  const menuToggle = document.querySelector('[data-menu-toggle]');
  const supabaseBadge = document.querySelector('[data-supabase-badge]');

  if (currentDate) currentDate.textContent = formatToday();
  updateSupabaseBadge(supabaseBadge);

  // Load and bind Sidebar Wallet Balance
  const updateSidebarWallet = async () => {
    const el = document.querySelector('[data-sidebar-wallet-balance]');
    if (!el || !profile?.id) return;
    try {
      const info = await WalletService.getWalletInfo(profile.id);
      el.textContent = formatCurrency(info?.totalAvailable || 0);
    } catch (err) {
      console.warn('[app] Failed to update sidebar wallet:', err);
    }
  };

  updateSidebarWallet();

  document.querySelector('[data-sidebar-topup]')?.addEventListener('click', () => {
    if (!profile?.id) return;
    WalletTopupModal.open({
      customerId: profile.id,
      customerName: profile.display_name || profile.username || 'Khách hàng',
      onTopupSuccess: async () => {
        await updateSidebarWallet();
      },
    });
  });

  document.querySelector('[data-logout]')?.addEventListener('click', async () => {
    await AuthService.signOut();
    window.location.hash = '#/login';
    window.location.reload();
  });

  menuToggle?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(sidebar?.classList.contains('open')));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') Modal.close();
  });

  createRouter({
    outlet,
    routes,
    fallback: NotFoundPage,
    defaultRoute,
    canAccess(route) {
      return allowedRoutes.has(route);
    },
    onRouteChange(route) {
      pageTitle.textContent = PAGE_TITLES[route] || PAGE_TITLES.dashboard;
      setActiveNavigation(route);
      if (window.innerWidth < 900) {
        sidebar?.classList.remove('open');
        menuToggle?.setAttribute('aria-expanded', 'false');
      }
    },
  }).start();
}

function renderLogin(root, message = '') {
  if (getRouteName() !== 'login') window.location.hash = '#/login';
  root.innerHTML = LoginPage({ message });
  LoginPage.afterRender();
}

function renderPublicRegistration(root) {
  if (getRouteName() !== 'register') window.location.hash = '#/register';
  root.innerHTML = RegisterPage();
  RegisterPage.afterRender();
}

function getRouteName() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  return raw.split(/[/?]/)[0] || '';
}

function setActiveNavigation(route) {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const queryString = raw.includes('?') ? raw.split('?')[1] : '';
  const params = new URLSearchParams(queryString);
  const taskType = params.get('type') || '';

  const activeRoute = {
    'customer-detail': 'customers',
    'kiosk-detail': 'kiosks',
  }[route] || route;

  document.querySelectorAll('[data-nav-route]').forEach((link) => {
    const linkRoute = link.dataset.navRoute;
    const linkType = link.dataset.navType || '';

    let active = linkRoute === activeRoute;
    if (linkRoute === 'facebook-tasks' && linkType) {
      active = linkRoute === activeRoute && linkType === taskType;
    }

    link.classList.toggle('active', active);
    if (active) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

function updateSupabaseBadge(element) {
  if (!element) return;
  const status = getSupabaseStatus();
  if (status.configured) {
    element.style.display = 'none';
  } else {
    element.style.display = '';
    element.textContent = 'Chưa kết nối Supabase';
    element.classList.remove('ready');
  }
}

document.addEventListener('DOMContentLoaded', initApp);
