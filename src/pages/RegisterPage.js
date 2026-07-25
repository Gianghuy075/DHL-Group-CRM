import { AuthService } from '../services/AuthService.js';
import { escapeHtml } from '../utils/html.js';

// Đăng ký tài khoản đơn giản: username, tên hiển thị, mật khẩu, xác nhận mật khẩu.
// (Các phần đăng ký Kiosk / PayOS / xác thực Facebook đã được comment lại ở cuối file
//  để dùng lại sau này.)

export function RegisterPage() {
  return `
    <section class="form-card registration-card">
      <div class="auth-logo">🏪</div>
      <h1>Đăng ký tài khoản</h1>
      <p>Tạo tài khoản để nạp tiền và mua gói Kiosk.</p>

      <div id="registration-form-error" class="form-error hidden"></div>

      <form id="public-registration-form" novalidate>
        <label class="form-group">
          <span>Tên đăng nhập *</span>
          <input class="form-control" id="register-username" type="text"
                 autocomplete="username" autocapitalize="none" spellcheck="false"
                 placeholder="vd: kiosk_dienchau" required />
        </label>
        <label class="form-group">
          <span>Tên hiển thị *</span>
          <input class="form-control" id="register-display-name" type="text"
                 autocomplete="name" required />
        </label>
        <label class="form-group">
          <span>Mật khẩu *</span>
          <input class="form-control" id="register-password" type="password"
                 autocomplete="new-password" required />
        </label>
        <label class="form-group">
          <span>Xác nhận mật khẩu *</span>
          <input class="form-control" id="register-password-confirm" type="password"
                 autocomplete="new-password" required />
        </label>

        <div class="registration-actions">
          <button class="btn-primary auth-submit" id="register-submit-button" type="submit">Đăng ký</button>
        </div>
      </form>

      <a class="public-register-link" href="#/login" data-open-login>Đã có tài khoản? Đăng nhập</a>
    </section>
  `;
}

RegisterPage.afterRender = function afterRenderRegister() {
  document.querySelector('[data-open-login]')?.addEventListener('click', (event) => {
    event.preventDefault();
    window.location.hash = '#/login';
    window.location.reload();
  });

  document.getElementById('public-registration-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await submitRegistration();
  });
};

async function submitRegistration() {
  clearFormError();

  const username = readValue('register-username');
  const displayName = readValue('register-display-name');
  const password = document.getElementById('register-password')?.value || '';
  const confirm = document.getElementById('register-password-confirm')?.value || '';

  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
    showFormError('Tên đăng nhập 3-30 ký tự, chỉ gồm chữ, số và . _ -');
    return;
  }
  if (!displayName) {
    showFormError('Tên hiển thị là bắt buộc.');
    return;
  }
  if (password.length < 6) {
    showFormError('Mật khẩu tối thiểu 6 ký tự.');
    return;
  }
  if (password !== confirm) {
    showFormError('Mật khẩu xác nhận không khớp.');
    return;
  }

  const button = document.getElementById('register-submit-button');
  setSubmitting(button, true);

  try {
    await AuthService.register({ username, displayName, password });
    // Đăng ký thành công → đã có token, vào thẳng ứng dụng.
    window.location.hash = '#/dashboard';
    window.location.reload();
  } catch (error) {
    showFormError(error?.message || 'Không thể đăng ký tài khoản.');
    setSubmitting(button, false);
  }
}

function readValue(id) {
  return document.getElementById(id)?.value.trim() || '';
}

function showFormError(message) {
  const element = document.getElementById('registration-form-error');
  if (!element) return;
  element.textContent = message;
  element.classList.remove('hidden');
}

function clearFormError() {
  const element = document.getElementById('registration-form-error');
  if (!element) return;
  element.textContent = '';
  element.classList.add('hidden');
}

function setSubmitting(button, isSubmitting) {
  if (!button) return;
  button.disabled = isSubmitting;
  button.textContent = isSubmitting ? 'Đang đăng ký...' : 'Đăng ký';
}

/* ============================================================================
 * ĐĂNG KÝ KIOSK ĐẦY ĐỦ (PayOS + xác thực Facebook) — TẠM COMMENT LẠI
 * Giữ nguyên để khôi phục sau này khi cần luồng đăng ký Kiosk công khai.
 * ----------------------------------------------------------------------------
 *
 * import { PageHeader } from '../components/PageHeader.js';
 * import { PayOSPaymentModal } from '../components/PayOSPaymentModal.js';
 * import { FacebookVerificationModal } from '../components/FacebookVerificationModal.js';
 * import { FacebookApiService } from '../services/FacebookApiService.js';
 * import { BusinessTypeService } from '../services/BusinessTypeService.js';
 * import { CategoryService } from '../services/CategoryService.js';
 * import { RegistrationService } from '../services/RegistrationService.js';
 * import { formatCurrency } from '../utils/currency.js';
 * import { formatDate } from '../utils/date.js';
 *
 * const STEPS = ['Thông tin khách hàng', 'Loại hình và thời hạn', 'Thanh toán'];
 * // ... (form 3 bước: thông tin KH + xác thực FB, chọn loại hình/số tháng/giảm giá,
 * //      xem lại và thanh toán PayOS rồi gọi RegistrationService.submit)
 * // Toàn bộ mã nguồn cũ có trong lịch sử git (commit trước khi rút gọn form đăng ký).
 * ==========================================================================*/
