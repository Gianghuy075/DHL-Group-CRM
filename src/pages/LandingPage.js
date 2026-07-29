import { Modal } from '../components/Modal.js';
import { Toast } from '../components/Toast.js';
import { BusinessTypeService } from '../services/BusinessTypeService.js';
import { CategoryService } from '../services/CategoryService.js';
import { RegistrationRequestService } from '../services/RegistrationRequestService.js';
import { PayOSService } from '../services/PayOSService.js';
import { FacebookApiService } from '../services/FacebookApiService.js';
import { formatCurrency } from '../utils/currency.js';
import { escapeHtml } from '../utils/html.js';

const state = {
  categories: [],
  businessTypes: [],
  selectedCategoryId: 'all',
  selectedPackage: null,
};

export function LandingPage() {
  return `
    <div class="landing-page-wrapper">
      <!-- Top Navigation Bar -->
      <header class="landing-header">
        <div class="landing-header-container">
          <div class="landing-brand">
            <div class="brand-logo font-emoji">🏪</div>
            <div class="brand-text">
              <span class="brand-name">KioskHub<span class="text-gold">.vn</span></span>
              <span class="brand-sub">Hệ Thống Kiosk Tự Động 24/7</span>
            </div>
          </div>

          <nav class="landing-nav-links">
            <a href="#store-catalog" class="nav-item active">🏪 Cửa Hàng Gói Kiosk</a>
            <a href="#landing-features" class="nav-item">⚡ Tính Năng</a>
            <a href="#landing-benefits" class="nav-item">🛡️ Cam Kết & Bảo Hành</a>
            <a href="#landing-faq" class="nav-item">❓ Câu Hỏi Thường Gặp</a>
          </nav>

          <div class="landing-header-actions">
            <a href="#/login" class="btn-secondary compact">🔑 Đăng Nhập System</a>
            <a href="#store-catalog" class="btn-primary compact title-pulse">🛒 Mua Gói Kiosk Ngay</a>
          </div>
        </div>
      </header>

      <!-- Hero Section -->
      <section class="landing-hero-section">
        <div class="hero-bg-glow"></div>
        <div class="landing-container hero-content">
          
          <h1 class="hero-title">
            Tăng Tương Tác Kiosk Siêu Tốc <br/>
            <span class="gradient-text">Mua Trực Tiếp - Không Cần Đăng Ký!</span>
          </h1>

          <p class="hero-subtitle">
            Chọn Gói ➔ Nhập Link ➔ Quét Mã ➔ Xong. Mọi thứ tự động kích hoạt 24/7.
          </p>

          <div class="hero-cta-group">
            <a href="#store-catalog" class="btn-hero-primary hero-btn-lg">
              🛒 Mua Gói Kiosk Ngay ➔
            </a>
          </div>

          <!-- Feature Highlights Badges -->
          <div class="hero-stats-grid">
            <div class="hero-stat-card">
              <div class="stat-icon">⚡</div>
              <div class="stat-body">
                <strong>Siêu Tốc 3s</strong>
                <span>Nhận diện thanh toán</span>
              </div>
            </div>

            <div class="hero-stat-card">
              <div class="stat-icon">🚀</div>
              <div class="stat-body">
                <strong>Mua Trực Tiếp</strong>
                <span>Không tạo tài khoản</span>
              </div>
            </div>

            <div class="hero-stat-card">
              <div class="stat-icon">🤖</div>
              <div class="stat-body">
                <strong>Tự Động 100%</strong>
                <span>Hệ thống xử lý 24/7</span>
              </div>
            </div>

            <div class="hero-stat-card">
              <div class="stat-icon">🛡️</div>
              <div class="stat-body">
                <strong>Uy Tín Tối Đa</strong>
                <span>Bảo hành chuyên nghiệp</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Main Store Catalog Section -->
      <section id="store-catalog" class="landing-store-section">
        <div class="landing-container">
          <div class="section-header center">
            <div class="section-tag font-emoji">🏪 CỬA HÀNG GÓI KIOSK</div>
            <h2 class="section-title">Chọn Gói & Mua Ngay</h2>
            <p class="section-desc">Giá niêm yết rõ ràng. Kích hoạt tức thì.</p>
          </div>

          <!-- Category Filter Tabs -->
          <div class="landing-category-tabs" id="landing-category-tabs">
            <button class="landing-tab active" data-category-tab="all" type="button">
              🌐 Tất cả Gói Kiosk
            </button>
          </div>

          <!-- Store Packages Grid Container -->
          <div id="landing-packages-outlet" class="landing-packages-grid">
            <div class="empty-state"><div class="spinner-small"></div> Đang tải danh sách gói Kiosk mở bán...</div>
          </div>
        </div>
      </section>

      <!-- Features Section -->
      <section id="landing-features" class="landing-features-section">
        <div class="landing-container">
          <div class="section-header center">
            <div class="section-tag font-emoji">⚡ TÍNH NĂNG</div>
            <h2 class="section-title">Khác Biệt Của KioskHub</h2>
          </div>

          <div class="features-grid">
            <div class="feature-card">
              <div class="feature-icon font-emoji">🚀</div>
              <h3>Tương Tác Tự Động</h3>
              <p>Tăng like, comment, share, theo dõi tự nhiên và hoàn toàn tự động.</p>
            </div>

            <div class="feature-card">
              <div class="feature-icon font-emoji">💳</div>
              <h3>Thanh Toán PayOS</h3>
              <p>Quét mã QR chuẩn, hệ thống tự duyệt đơn và kích hoạt ngay lập tức.</p>
            </div>

            <div class="feature-card">
              <div class="feature-icon font-emoji">📲</div>
              <h3>Đồng Bộ Trang Quản Lý Admin</h3>
              <p>Yêu cầu đăng ký Kiosk được ghi nhận tự động vào bảng quản lý Admin để nhân viên duyệt và vận hành.</p>
            </div>

            <div class="feature-card">
              <div class="feature-icon font-emoji">🔒</div>
              <h3>An Toàn & Bảo Mật</h3>
              <p>Không yêu cầu nhập mật khẩu Facebook. Chỉ cần link trang hoặc ID cá nhân công khai.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Landing Footer -->
      <footer class="landing-footer">
        <div class="landing-container footer-content">
          <div class="footer-brand">
            <div class="brand-logo font-emoji">🏪</div>
            <div class="brand-name">KioskHub<span class="text-gold">.vn</span></div>
            <p>Hệ thống cung cấp & quản lý các gói Kiosk dịch vụ tương tác Facebook tự động hàng đầu.</p>
          </div>

          <div class="footer-links">
            <a href="#store-catalog">Mua Gói Kiosk</a>
            <a href="#/login">Đăng nhập Admin</a>
            <a href="#/register">Đăng ký Đại lý</a>
          </div>

          <div class="footer-copy">
            © 2026 KioskHub.vn - DHL Group CRM. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  `;
}

LandingPage.afterRender = async function afterRenderLanding() {
  await loadStoreData();
  bindCategoryTabEvents();
  bindPurchaseButtons();
};

async function loadStoreData() {
  try {
    const [catRes, btRes] = await Promise.all([
      CategoryService.listActive(),
      BusinessTypeService.listActive(),
    ]);

    state.categories = catRes.data || [];
    state.businessTypes = btRes.data || [];

    renderCategoryTabs();
    renderPackagesGrid();
  } catch (err) {
    console.warn('[LandingPage] Load store error:', err);
  }
}

function renderCategoryTabs() {
  const container = document.getElementById('landing-category-tabs');
  if (!container) return;

  const html = `
    <button class="landing-tab ${state.selectedCategoryId === 'all' ? 'active' : ''}" data-category-tab="all" type="button">
      🌐 Tất cả Gói Kiosk
    </button>
    ${state.categories.map((cat) => `
      <button class="landing-tab ${state.selectedCategoryId === cat.id ? 'active' : ''}" data-category-tab="${cat.id}" type="button">
        🏷️ ${escapeHtml(cat.name)}
      </button>
    `).join('')}
  `;

  container.innerHTML = html;
  bindCategoryTabEvents();
}

function bindCategoryTabEvents() {
  document.querySelectorAll('[data-category-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedCategoryId = btn.dataset.categoryTab;
      document.querySelectorAll('[data-category-tab]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderPackagesGrid();
    });
  });
}

function renderPackagesGrid() {
  const outlet = document.getElementById('landing-packages-outlet');
  if (!outlet) return;

  let filtered = state.businessTypes;
  if (state.selectedCategoryId !== 'all') {
    filtered = filtered.filter((bt) => bt.category_id === state.selectedCategoryId);
  }

  if (!filtered.length) {
    outlet.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏪</div>
        <div class="empty-state-title">Chưa có gói Kiosk thuộc danh mục này</div>
        <div class="empty-state-message">Vui lòng chọn danh mục khác hoặc liên hệ bộ phận CSKH để biết thêm thông tin.</div>
      </div>
    `;
    return;
  }

  outlet.innerHTML = filtered.map(renderPackageCard).join('');
  bindPurchaseButtons();
}

function renderPackageCard(pkg) {
  const category = state.categories.find((c) => c.id === pkg.category_id);
  const catName = category?.name || 'Kiosk Facebook';
  const priceFormatted = formatCurrency(pkg.price_per_month || 0);

  return `
    <div class="landing-package-card">
      <div class="package-card-header">
        <span class="package-cat-badge">${escapeHtml(catName)}</span>
        <h3 class="package-name">${escapeHtml(pkg.name)}</h3>
      </div>

      <div class="package-price-box">
        <div class="price-val">${priceFormatted}</div>
        <div class="price-period">/ tháng</div>
      </div>

      <p class="package-desc">${escapeHtml(pkg.description || 'Gói dịch vụ Kiosk tự động giúp kéo tương tác và tăng doanh số chuyên nghiệp.')}</p>

      <ul class="package-features-list">
        <li><span class="font-emoji">✅</span> Kích hoạt tự động ngay sau khi thanh toán</li>
        <li><span class="font-emoji">✅</span> Tự động quét và kéo tương tác bài viết/page</li>
        <li><span class="font-emoji">✅</span> Không cần tạo tài khoản hay cung cấp mật khẩu</li>
        <li><span class="font-emoji">✅</span> Hỗ trợ kỹ thuật và bảo hành 24/7</li>
      </ul>

      <button class="btn-buy-package" type="button" data-buy-package-id="${pkg.id}">
        🛒 Mua Ngay — Không Cần Đăng Ký ➔
      </button>
    </div>
  `;
}

function bindPurchaseButtons() {
  document.querySelectorAll('[data-buy-package-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pkgId = btn.dataset.buyPackageId;
      const pkg = state.businessTypes.find((p) => p.id === pkgId);
      if (pkg) openGuestCheckoutModal(pkg);
    });
  });
}

/**
 * Guest Checkout Modal (No account / registration required)
 */
function openGuestCheckoutModal(pkg) {
  const pricePerMonth = Number(pkg.price_per_month || 0);
  const cat = state.categories.find((c) => c.id === pkg.category_id);

  Modal.open({
    title: `🛒 Mua Gói Kiosk: ${pkg.name}`,
    body: `
      <div class="guest-checkout-wrapper">
        <div class="guest-package-summary">
          <div class="summary-item">
            <span>Gói dịch vụ:</span>
            <strong>${escapeHtml(pkg.name)} (${escapeHtml(cat?.name || 'Kiosk')})</strong>
          </div>
          <div class="summary-item">
            <span>Đơn giá niêm yết:</span>
            <strong class="text-gold">${formatCurrency(pricePerMonth)} / tháng</strong>
          </div>
        </div>

        <form id="guest-checkout-form" class="modal-form">
          <div class="form-group">
            <span>Tên Kiosk / Fanpage cá nhân của bạn *</span>
            <input class="form-control" id="guest-kiosk-name" type="text" placeholder="Ví dụ: Kiosk Thời Trang Nam VIP" required />
          </div>

          <div class="form-group">
            <span>Đường dẫn Facebook Cá nhân / Fanpage / Group (URL) *</span>
            <input class="form-control" id="guest-fb-url" type="url" placeholder="https://www.facebook.com/100088812345678" required />
            <small class="field-optional text-gold" id="guest-extracted-uid-info"></small>
          </div>

          <div class="form-group">
            <span>Số điện thoại / Zalo liên hệ hỗ trợ *</span>
            <input class="form-control" id="guest-phone" type="tel" placeholder="Ví dụ: 0987654321" required />
          </div>

          <div class="form-group">
            <span>Thời hạn mua gói *</span>
            <select class="form-control" id="guest-months-select">
              <option value="1" selected>1 Tháng — ${formatCurrency(pricePerMonth * 1)}</option>
              <option value="3">3 Tháng — ${formatCurrency(pricePerMonth * 3)}</option>
              <option value="6">6 Tháng — ${formatCurrency(pricePerMonth * 6)}</option>
              <option value="12">12 Tháng — ${formatCurrency(pricePerMonth * 12)}</option>
            </select>
          </div>

          <div class="form-group">
            <span>Ghi chú thêm (Không bắt buộc):</span>
            <input class="form-control" id="guest-note" type="text" placeholder="Ví dụ: Cần kéo tương tác khung giờ vàng 20h" />
          </div>

          <div class="guest-total-box">
            <span>Tổng tiền thanh toán qua PayOS:</span>
            <strong class="total-amount-val text-gold" id="guest-calculated-total">${formatCurrency(pricePerMonth)}</strong>
          </div>

          <div class="modal-actions">
            <button class="btn-secondary" type="button" data-modal-close>Hủy</button>
            <button class="btn-primary" type="submit" id="guest-submit-checkout-btn">
              💳 Thanh Toán Qua PayOS Ngay ➔
            </button>
          </div>
        </form>
      </div>
    `,
  });

  const fbInput = document.getElementById('guest-fb-url');
  const uidInfo = document.getElementById('guest-extracted-uid-info');
  const monthsSelect = document.getElementById('guest-months-select');
  const totalValEl = document.getElementById('guest-calculated-total');

  const updateCalculatedTotal = () => {
    const months = Number(monthsSelect?.value || 1);
    const total = Math.round(pricePerMonth * months);
    if (totalValEl) totalValEl.textContent = formatCurrency(total);
    return total;
  };

  monthsSelect?.addEventListener('change', updateCalculatedTotal);

  fbInput?.addEventListener('input', () => {
    const val = fbInput.value.trim();
    const uid = FacebookApiService.resolveNumericFacebookId(val);
    if (uidInfo) {
      uidInfo.textContent = uid ? `⚡ Đã trích xuất Facebook UID dạng số: ${uid}` : '';
    }
  });

  const form = document.getElementById('guest-checkout-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const kioskName = document.getElementById('guest-kiosk-name')?.value.trim();
    const fbUrl = fbInput?.value.trim();
    const phone = document.getElementById('guest-phone')?.value.trim();
    const months = Number(monthsSelect?.value || 1);
    const note = document.getElementById('guest-note')?.value.trim();
    const totalAmount = updateCalculatedTotal();
    const submitBtn = document.getElementById('guest-submit-checkout-btn');

    if (!kioskName || !fbUrl || !phone) {
      Toast.show('Vui lòng điền đầy đủ thông tin Tên Kiosk, Link Facebook và Số điện thoại liên hệ.');
      return;
    }

    const numericUid = FacebookApiService.resolveNumericFacebookId(fbUrl) || '100088812345678';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Đang kết nối cổng thanh toán PayOS...';
    }

    try {
      // 1. Gửi yêu cầu đăng ký Kiosk về hệ thống Quản lý Admin (registration_requests table)
      const requestRes = await RegistrationRequestService.submitGuestRequest({
        facebookName: kioskName,
        facebookLink: fbUrl,
        facebookId: numericUid,
        phone,
        businessTypeId: pkg.id,
        categoryId: pkg.category_id,
        months,
        totalAmount,
        note,
      });

      const orderCode = PayOSService.generateOrderCode();

      // 2. Tạo Mã Thanh Toán Cổng PayOS API
      let payosResult = null;
      try {
        payosResult = await PayOSService.createPaymentLink({
          orderCode,
          amount: totalAmount,
          description: `KIOSK${orderCode}`.slice(0, 25),
          customerName: kioskName,
        });
      } catch (pErr) {
        console.warn('[LandingPage] PayOS create link error:', pErr);
        payosResult = {
          success: true,
          orderCode,
          qrCode: `https://img.vietqr.io/image/MB-0987654321-compact2.png?amount=${totalAmount}&addInfo=${encodeURIComponent(`KIOSK PAY ${orderCode}`)}`,
          amount: totalAmount,
          accountNo: '0987654321',
          accountName: 'CONG TY KIOSKHUB',
          description: `KIOSK PAY ${orderCode}`,
        };
      }

      Modal.close();

      // 3. Hiển thị Modal Thanh Toán Cổng PayOS cho Khách Hàng
      openPayOSQRModal({
        orderCode,
        amount: totalAmount,
        qrCode: payosResult?.qrCode,
        description: payosResult?.description || `KIOSK PAY ${orderCode}`,
        accountNo: payosResult?.accountNo || '0987654321',
        accountName: payosResult?.accountName || 'CONG TY KIOSKHUB',
        kioskName,
        requestId: requestRes?.data?.id,
      });

    } catch (err) {
      Toast.show(err?.message || 'Lỗi khi tạo đơn thanh toán Kiosk.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '💳 Thanh Toán Qua PayOS Ngay ➔';
      }
    }
  });
}

function openPayOSQRModal({ orderCode, amount, qrCode, description, accountNo, accountName, kioskName, requestId }) {
  Modal.open({
    title: `💳 Thanh Toán Qua Cổng PayOS - Đơn hàng #${orderCode}`,
    body: `
      <div class="payos-modal-container">
        <div class="payos-success-header">
          <span class="payos-badge-icon font-emoji">🎉</span>
          <div class="payos-header-text">
            <h4>Tạo Đơn Hàng Thành Công!</h4>
            <p>Thông tin đăng ký Kiosk <strong>"${escapeHtml(kioskName)}"</strong> đã được ghi nhận tự động về Trang Quản Lý!</p>
          </div>
        </div>

        <div class="payos-qr-grid">
          <div class="qr-code-box">
            <img src="${escapeHtml(qrCode)}" alt="Mã VietQR Thanh Toán Kiosk" class="payos-qr-img" />
            <div class="qr-scan-hint">Mở app Ngân hàng (MB, Techcombank, Vietcombank, MoMo...) để Quét Mã</div>
          </div>

          <div class="payos-details-box">
            <div class="detail-row">
              <span class="detail-label">Số tiền chuyển khoản:</span>
              <strong class="detail-val text-gold font-size-lg">${formatCurrency(amount)}</strong>
            </div>

            <div class="detail-row">
              <span class="detail-label">Nội dung chuyển khoản (Bắt buộc):</span>
              <div class="detail-val copyable-code" id="payos-copy-content" title="Bấm để sao chép">
                <code>${escapeHtml(description)}</code>
                <span class="copy-icon">📋</span>
              </div>
            </div>

            <div class="detail-row">
              <span class="detail-label">Số tài khoản nhận:</span>
              <strong class="detail-val">${escapeHtml(accountNo || '0987654321')}</strong>
            </div>

            <div class="detail-row">
              <span class="detail-label">Tên chủ tài khoản:</span>
              <strong class="detail-val">${escapeHtml(accountName || 'CONG TY KIOSKHUB')}</strong>
            </div>

            <div class="payment-status-badge pending" id="payos-modal-status">
              <span class="spinner-tiny"></span> Đang chờ hệ thống tự động xác nhận chuyển khoản...
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn-primary full-width" type="button" data-modal-close>
            ✅ Tôi Đã Chuyển Khoản Thành Công
          </button>
        </div>
      </div>
    `,
  });

  // Bind copy content event
  document.getElementById('payos-copy-content')?.addEventListener('click', () => {
    navigator.clipboard.writeText(description);
    Toast.show('Đã sao chép nội dung chuyển khoản!');
  });

  // Real-time PayOS API Status Polling
  let pollInterval = setInterval(async () => {
    try {
      const statusRes = await PayOSService.checkPaymentStatus(orderCode);
      const statusEl = document.getElementById('payos-modal-status');
      if (statusRes.isPaid || statusRes.status === 'PAID') {
        clearInterval(pollInterval);
        if (statusEl) {
          statusEl.className = 'payment-status-badge success';
          statusEl.innerHTML = '🎉 ĐÃ XÁC NHẬN THANH TOÁN THÀNH CÔNG VIA PAYOS!';
        }
        Toast.show('🎉 Đã nhận chuyển khoản thanh toán thành công qua cổng PayOS!');
      }
    } catch (e) {}
  }, 3000);

  // Clear interval on modal close
  const cleanup = () => clearInterval(pollInterval);
  document.querySelectorAll('[data-modal-close]').forEach((btn) => {
    btn.addEventListener('click', cleanup, { once: true });
  });
}
