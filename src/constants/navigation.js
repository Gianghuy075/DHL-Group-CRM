export const PAGE_TITLES = {
  dashboard: 'Tổng quan hệ thống',
  customers: 'Quản lý Khách hàng',
  'customer-detail': 'Chi tiết Khách hàng',
  kiosks: 'Quản lý Kiosk',
  'kiosk-detail': 'Chi tiết Kiosk',
  payments: 'Quản lý Thanh toán & Doanh thu',
  'facebook-tasks': 'Dịch vụ Facebook & Ví Ảo',
  categories: 'Quản lý Danh mục',
  'business-types': 'Loại hình Kinh doanh',
  logs: 'Lịch sử thay đổi',
  settings: 'Cài đặt hệ thống',
  register: 'Đăng ký Kiosk',
  'registration-requests': 'Duyệt đơn đăng ký',
  'task-review': 'Duyệt bằng chứng nhiệm vụ',
  staff: 'Quản lý Tài khoản',
  reports: 'Báo cáo Doanh thu',
  profile: 'Tài khoản & Xác thực FB',
};

// Sub-menu Dịch vụ Facebook Tương tác chéo
export const FACEBOOK_SUB_MENU = [
  { type: 'like_post', label: 'Like chéo', icon: '👍' },
  { type: 'like_high_val', label: 'Like chéo giá cao', icon: '💎' },
  { type: 'like_multi', label: 'Like chéo 3', icon: '🔥' },
  { type: 'like_page', label: 'Like page chéo', icon: '🚩' },
  { type: 'reaction_post', label: 'Cảm xúc chéo', icon: '❤️' },
  { type: 'reaction_comment', label: 'Cảm xúc CMT chéo', icon: '💬' },
  { type: 'follow_profile', label: 'Theo dõi chéo', icon: '👤' },
  { type: 'share_post', label: 'Share chéo', icon: '🔄' },
  { type: 'join_group', label: 'Tham gia nhóm chéo', icon: '👥' },
];

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
      {
        route: 'facebook-tasks',
        label: 'Facebook',
        icon: '📘',
        children: FACEBOOK_SUB_MENU.map((sub) => ({
          route: 'facebook-tasks',
          query: `type=${sub.type}`,
          label: sub.label,
          icon: sub.icon,
          taskType: sub.type,
        })),
      },
      { route: 'customers', label: 'Khách hàng', icon: '👥' },
      { route: 'kiosks', label: 'Quản lý Kiosk', icon: '🏪' },
      { route: 'payments', label: 'Duyệt Thanh toán', icon: '💰' },
    ],
  },
  {
    label: 'Duyệt & Phân quyền',
    items: [
      { route: 'registration-requests', label: 'Duyệt đăng ký', icon: '✅' },
      { route: 'task-review', label: 'Duyệt nhiệm vụ FB', icon: '🔍' },
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
    label: 'DỊCH VỤ CỦA TÔI',
    items: [
      {
        route: 'facebook-tasks',
        label: 'Facebook',
        icon: '📘',
        children: FACEBOOK_SUB_MENU.map((sub) => ({
          route: 'facebook-tasks',
          query: `type=${sub.type}`,
          label: sub.label,
          icon: sub.icon,
          taskType: sub.type,
        })),
      },
      { route: 'kiosks', label: 'Kiosk của tôi', icon: '🏪' },
      { route: 'payments', label: 'Lịch sử Thanh toán', icon: '💰' },
      { route: 'profile', label: 'Tài khoản của tôi', icon: '👤' },
    ],
  },
];

// Fallback tương thích ngược
export const NAV_SECTIONS = ADMIN_NAV_SECTIONS;
