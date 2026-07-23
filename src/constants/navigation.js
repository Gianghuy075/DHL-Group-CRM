export const PAGE_TITLES = {
  dashboard: 'Tổng quan hệ thống',
  customers: 'Quản lý Khách hàng',
  'customer-detail': 'Chi tiết Khách hàng',
  kiosks: 'Quản lý Kiosk',
  'kiosk-detail': 'Chi tiết Kiosk',
  payments: 'Quản lý Thanh toán & Doanh thu',
  'facebook-tasks': 'Nhiệm vụ Chéo FB & Ví Ảo',
  categories: 'Quản lý Danh mục',
  'business-types': 'Loại hình Kinh doanh',
  logs: 'Lịch sử thay đổi',
  settings: 'Cài đặt hệ thống',
  register: 'Đăng ký Kiosk',
  'registration-requests': 'Duyệt đơn đăng ký',
  staff: 'Quản lý Nhân viên',
  reports: 'Báo cáo Doanh thu',
};

// Menu Dành cho Quản trị viên (Admin)
export const ADMIN_NAV_SECTIONS = [
  {
    label: 'Tổng quan',
    items: [
      { route: 'dashboard', label: 'Tổng quan', icon: '📊' },
      { route: 'reports', label: 'Báo cáo doanh thu', icon: '📈' },
    ],
  },
  {
    label: 'Quản lý Dịch vụ & Khách hàng',
    items: [
      { route: 'facebook-tasks', label: 'Nhiệm vụ Chéo FB', icon: '⚡' },
      { route: 'customers', label: 'Khách hàng', icon: '👥' },
      { route: 'kiosks', label: 'Quản lý Kiosk', icon: '🏪' },
      { route: 'payments', label: 'Duyệt Thanh toán', icon: '💰' },
    ],
  },
  {
    label: 'Duyệt & Phân quyền',
    items: [
      { route: 'registration-requests', label: 'Duyệt đăng ký', icon: '✅' },
      { route: 'staff', label: 'Nhân viên', icon: '🛡️' },
    ],
  },
  {
    label: 'Cấu hình Hệ thống',
    items: [
      { route: 'categories', label: 'Danh mục', icon: '🏷️' },
      { route: 'business-types', label: 'Loại hình KD', icon: '🧾' },
      { route: 'logs', label: 'Lịch sử hệ thống', icon: '🕘' },
      { route: 'settings', label: 'Cài đặt', icon: '⚙️' },
    ],
  },
];

// Menu Dành cho Người dùng (Khách hàng / Chủ Kiosk)
export const USER_NAV_SECTIONS = [
  {
    label: 'Dịch vụ của tôi',
    items: [
      { route: 'facebook-tasks', label: 'Nhiệm vụ Chéo FB & Ví Ảo', icon: '⚡' },
      { route: 'kiosks', label: 'Kiosk của tôi', icon: '🏪' },
      { route: 'payments', label: 'Lịch sử Thanh toán', icon: '💰' },
    ],
  },
];

// Menu Dành cho Kiểm duyệt viên (Reviewer)
export const REVIEWER_NAV_SECTIONS = [
  {
    label: 'Kiểm duyệt',
    items: [
      { route: 'registration-requests', label: 'Duyệt đăng ký', icon: '✅' },
      { route: 'kiosks', label: 'Danh sách Kiosk', icon: '🏪' },
    ],
  },
];

// Fallback tương thích ngược
export const NAV_SECTIONS = ADMIN_NAV_SECTIONS;
