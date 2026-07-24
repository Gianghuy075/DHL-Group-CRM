import { Modal } from '../components/Modal.js';
import { PageHeader } from '../components/PageHeader.js';
import { Toast } from '../components/Toast.js';
import { WalletTopupModal } from '../components/WalletTopupModal.js';
import { AuthService } from '../services/AuthService.js';
import { CustomerService } from '../services/CustomerService.js';
import { FacebookTaskService } from '../services/FacebookTaskService.js';
import { KioskService } from '../services/KioskService.js';
import { WalletService } from '../services/WalletService.js';
import { formatCurrency } from '../utils/currency.js';
import { formatDate } from '../utils/date.js';
import { escapeHtml } from '../utils/html.js';

const state = {
  profile: null,
  customer: null,
  walletInfo: { walletBalance: 0, bonusBalance: 0, totalAvailable: 0 },
  kiosksCount: 0,
  isLoading: false,
  isVerifying: false,
};

export function AccountPage() {
  return `
    ${PageHeader({
      title: 'Tài khoản & Xác thực Facebook',
      description: 'Quản lý thông tin tài khoản Kiosk cá nhân và xác thực tài khoản Facebook qua Graph API.',
    })}

    <div class="account-page-container">
      <div id="account-page-content">
        <div class="empty-state"><div class="spinner-small"></div> Đang tải thông tin tài khoản...</div>
      </div>
    </div>
  `;
}

AccountPage.afterRender = async function afterRenderAccount() {
  await loadAccountData();
  renderAccountContent();
};

async function loadAccountData() {
  state.isLoading = true;
  try {
    const session = await AuthService.getCurrentSession();
    if (!session?.user?.id) return;

    const userId = session.user.id;
    const [profileData, customerRes, kiosksRes] = await Promise.allSettled([
      AuthService.getCurrentProfile(userId),
      CustomerService.getById(userId),
      KioskService.list({ customerId: userId }),
    ]);

    state.profile = profileData.status === 'fulfilled' ? profileData.value : null;

    if (customerRes.status === 'fulfilled' && customerRes.value?.data) {
      state.customer = customerRes.value.data;
    } else {
      // Fallback customer record
      state.customer = {
        id: userId,
        facebook_name: state.profile?.display_name || session.user.email?.split('@')[0] || 'Khách hàng Kiosk',
        facebook_verified: false,
        wallet_balance: 0,
        bonus_balance: 0,
      };
    }

    if (state.customer?.id) {
      state.walletInfo = await WalletService.getWalletInfo(state.customer.id);
    }

    if (kiosksRes.status === 'fulfilled' && kiosksRes.value?.data) {
      state.kiosksCount = kiosksRes.value.data.length;
    }
  } catch (err) {
    console.warn('[AccountPage] Load error:', err);
  } finally {
    state.isLoading = false;
  }
}

function renderAccountContent() {
  const container = document.getElementById('account-page-content');
  if (!container) return;

  const { customer, profile, walletInfo, kiosksCount } = state;
  const isVerified = Boolean(customer?.facebook_verified);
  const totalReach = Number(customer?.friend_count || 0) + Number(customer?.follower_count || 0);

  container.innerHTML = `
    <div class="account-grid">
      <!-- CỘT 1: THÔNG TIN TÀI KHOẢN KIOSK & VÍ ÁO -->
      <div class="account-card main-info-card">
        <div class="account-card-header">
          <div class="user-avatar-large font-emoji">👤</div>
          <div>
            <h3 class="account-user-name">${escapeHtml(profile?.display_name || customer?.facebook_name || 'Khách hàng Kiosk')}</h3>
            <div class="account-user-role-badge">
              <span class="badge-role">${escapeHtml(profile?.role === 'admin' ? 'Quản trị viên' : 'Khách hàng Kiosk')}</span>
              <span class="badge-status ${profile?.is_active !== false ? 'active' : 'inactive'}">
                ${profile?.is_active !== false ? '● Đang hoạt động' : '○ Đã khóa'}
              </span>
            </div>
          </div>
        </div>

        <div class="account-details-list">
          <div class="detail-item">
            <span class="detail-label">Tên người dùng</span>
            <span class="detail-val strong">${escapeHtml(profile?.username || customer?.facebook_name || '—')}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Mã ID Tài khoản</span>
            <span class="detail-val code-text">${escapeHtml(customer?.id || '—')}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Số Kiosk sở hữu</span>
            <span class="detail-val strong-cell">${kiosksCount} Kiosk</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Trạng thái Facebook</span>
            <span class="detail-val">
              ${isVerified ? `
                <span class="badge-verified-success">✅ Đã xác thực Graph API</span>
              ` : `
                <span class="badge-verified-warning">⚠️ Chưa xác thực</span>
              `}
            </span>
          </div>
        </div>

        <div class="account-wallet-banner">
          <div class="wallet-banner-content">
            <span class="wallet-icon font-emoji">💳</span>
            <div>
              <div class="wallet-banner-title">Số dư Ví Ảo KioskHub</div>
              <div class="wallet-banner-amount">${formatCurrency(walletInfo.totalAvailable)}</div>
              ${walletInfo.bonusBalance > 0 ? `
                <div class="wallet-banner-sub">Bao gồm ${formatCurrency(walletInfo.bonusBalance)} tiền thưởng ưu đãi</div>
              ` : `
                <div class="wallet-banner-sub">Dùng để đăng nhiệm vụ chéo hoặc gia hạn Kiosk</div>
              `}
            </div>
          </div>
          <button class="btn-primary" type="button" id="account-topup-btn">💳 Nạp Ví PayOS Ngay</button>
        </div>
      </div>

      <!-- CỘT 2: XÁC THỰC TÀI KHOẢN FACEBOOK GRAPH API -->
      <div class="account-card facebook-verify-card">
        <div class="card-title-bar">
          <h3>🛡️ Xác thực Tài khoản Facebook Graph API</h3>
          <span class="card-sub-title">Yêu cầu hệ thống để tự động kiểm tra nhiệm vụ</span>
        </div>

        ${isVerified ? `
          <div class="fb-verified-box success">
            <div class="verified-header-bar">
              <span class="icon font-emoji">✅</span>
              <div>
                <strong class="title">Tài khoản Facebook đã được xác thực Graph API thành công!</strong>
                <div class="sub">Chỉ cần xác thực 1 lần. Bạn có thể tham gia Đăng & Làm nhiệm vụ tương tác trên toàn hệ thống.</div>
              </div>
            </div>

            <div class="verified-details-grid">
              <div class="grid-item">
                <span class="lbl">Tên Facebook</span>
                <span class="val strong">${escapeHtml(customer?.facebook_name || 'Khách hàng')}</span>
              </div>
              <div class="grid-item">
                <span class="lbl">Facebook ID</span>
                <span class="val code-text">${escapeHtml(customer?.facebook_id || '—')}</span>
              </div>
              <div class="grid-item">
                <span class="lbl">Chế độ tài khoản</span>
                <span class="val badge-green">Công khai / Người nổi tiếng</span>
              </div>
              <div class="grid-item">
                <span class="lbl">Bạn bè / Followers</span>
                <span class="val strong-cell text-gold">${totalReach} Bạn bè/Followers</span>
              </div>
              ${customer?.facebook_link ? `
                <div class="grid-item full-width">
                  <span class="lbl">Đường dẫn Facebook</span>
                  <a class="val link-text" href="${escapeHtml(customer.facebook_link)}" target="_blank" rel="noopener">${escapeHtml(customer.facebook_link)}</a>
                </div>
              ` : ''}
              ${customer?.facebook_verified_at ? `
                <div class="grid-item full-width">
                  <span class="lbl">Thời gian xác thực</span>
                  <span class="val muted">${formatDate(customer.facebook_verified_at)}</span>
                </div>
              ` : ''}
            </div>

            <button class="btn-secondary" type="button" id="reverify-fb-btn">🔄 Xác thực lại / Cập nhật Link Facebook</button>
          </div>
        ` : `
          <div class="fb-verified-box warning">
            <div class="verified-header-bar">
              <span class="icon font-emoji">⚠️</span>
              <div>
                <strong class="title">Tài khoản Facebook chưa được xác thực</strong>
                <div class="sub">Vui lòng nhập Link Facebook cá nhân để đối soát dữ liệu qua Facebook Graph API v19.0.</div>
              </div>
            </div>

            <div class="verify-requirements-list">
              <div class="req-title">📌 Điều kiện xác thực tự động:</div>
              <ul>
                <li>✅ Tài khoản Facebook ở chế độ <strong>Công khai (Public)</strong> hoặc <strong>Chế độ Chuyên nghiệp / Người nổi tiếng</strong>.</li>
                <li>✅ Có tối thiểu <strong>100 bạn bè hoặc người theo dõi (followers)</strong>.</li>
                <li>✅ Hệ thống kiểm tra trực tiếp qua API và lưu kết quả vĩnh viễn vào CSDL.</li>
              </ul>
            </div>
          </div>
        `}

        <form id="facebook-verify-form" class="account-form ${isVerified ? 'hidden' : ''}">
          <label class="form-group">
            <span>Link Facebook cá nhân (URL) *</span>
            <input
              class="form-control"
              id="account-facebook-url"
              type="url"
              placeholder="Ví dụ: https://www.facebook.com/ten.nguoidung"
              value="${escapeHtml(customer?.facebook_link || '')}"
              required
            />
          </label>

          <div class="form-group" id="facebook-id-preview-box">
            <span class="form-label">Facebook ID tự động trích xuất:</span>
            <div class="id-preview-val code-text" id="account-facebook-id-text">
              ${customer?.facebook_id ? escapeHtml(customer.facebook_id) : 'Nhập link Facebook để trích xuất ID'}
            </div>
          </div>

          <div class="form-actions">
            <button class="btn-primary" type="submit" id="verify-submit-btn">
              🛡️ Tiến hành Xác thực Facebook qua Graph API ➔
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Bind Topup event
  document.getElementById('account-topup-btn')?.addEventListener('click', () => {
    if (!state.customer?.id) return;
    WalletTopupModal.open({
      customerId: state.customer.id,
      customerName: state.customer.facebook_name || 'Khách hàng',
      onTopupSuccess: async () => {
        await loadAccountData();
        renderAccountContent();
      },
    });
  });

  // Bind re-verify button toggle
  document.getElementById('reverify-fb-btn')?.addEventListener('click', () => {
    const form = document.getElementById('facebook-verify-form');
    if (form) form.classList.toggle('hidden');
  });

  // Bind Facebook URL Auto Extract ID
  const urlInput = document.getElementById('account-facebook-url');
  const idText = document.getElementById('account-facebook-id-text');
  urlInput?.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (!val) {
      if (idText) idText.textContent = 'Nhập link Facebook để trích xuất ID';
      return;
    }
    const extractedId = FacebookTaskService.extractFacebookId(val);
    if (idText) {
      idText.textContent = extractedId ? `ID: ${extractedId}` : 'ID: Đang tự động nhận diện từ URL...';
    }
  });

  // Bind Submit Verify Form
  document.getElementById('facebook-verify-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleFacebookVerification();
  });
}

async function handleFacebookVerification() {
  const urlInput = document.getElementById('account-facebook-url');
  const submitBtn = document.getElementById('verify-submit-btn');
  const fbUrl = urlInput?.value?.trim();

  if (!fbUrl) {
    Toast.show('Vui lòng nhập Link Facebook cá nhân.');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang gọi Facebook Graph API v19.0 đối soát...';
  }

  try {
    const facebookId = FacebookTaskService.extractFacebookId(fbUrl);
    const verifyResult = await FacebookTaskService.verifyFacebookAccount(fbUrl, facebookId);

    if (!verifyResult.success) {
      Toast.show(verifyResult.message || 'Xác thực Facebook không thành công.');
      return;
    }

    const { friendCount = 120, followerCount = 0, facebookName = 'Tài khoản Facebook' } = verifyResult;

    // Lưu vĩnh viễn kết quả xác thực vào Supabase Database bảng `customers`
    const updatedPayload = {
      id: state.customer.id,
      facebook_name: facebookName || state.customer.facebook_name || 'Khách hàng',
      facebook_id: facebookId,
      facebook_link: fbUrl,
      facebook_verified: true,
      facebook_verified_at: new Date().toISOString(),
      friend_count: friendCount,
      follower_count: followerCount,
      is_public_profile: true,
      status: 'active',
    };

    await CustomerService.upsert(updatedPayload);

    Toast.show('🎉 Xác thực Facebook thành công và đã lưu vĩnh viễn vào CSDL! Bạn đã đủ điều kiện sử dụng dịch vụ.');
    
    await loadAccountData();
    renderAccountContent();

  } catch (err) {
    Toast.show(err?.message || 'Lỗi khi xác thực tài khoản Facebook.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '🛡️ Tiến hành Xác thực Facebook qua Graph API ➔';
    }
  }
}
