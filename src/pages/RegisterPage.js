import { AuthService } from '../services/AuthService.js';
import { escapeHtml } from '../utils/html.js';

export function RegisterPage() {
  return `
    <main class="auth-shell">
      <section class="auth-card" style="width: min(100%, 460px);">
        <div class="auth-logo">🏪</div>
        <h1>Đăng ký tài khoản</h1>
        <p>Hệ thống quản lý Kiosk · Diễn Châu - À Đây Rồi</p>

        <div id="registration-form-error" class="form-error hidden"></div>

        <form id="public-registration-form" novalidate>
          <label class="form-group">
            <span>Tên đăng nhập *</span>
            <input class="form-control" id="register-username" type="text"
                   autocomplete="username" autocapitalize="none" spellcheck="false"
                   placeholder="Tên tài khoản (vd: kiosk_dienchau)" required />
          </label>

          <label class="form-group">
            <span>Tên hiển thị / Tên Kiosk *</span>
            <input class="form-control" id="register-display-name" type="text"
                   placeholder="Họ tên hoặc tên thương hiệu Kiosk" autocomplete="name" required />
          </label>

          <div class="form-row">
            <label class="form-group">
              <span>Mật khẩu *</span>
              <input class="form-control" id="register-password" type="password"
                     autocomplete="new-password" placeholder="Tối thiểu 6 ký tự" required />
            </label>

            <label class="form-group">
              <span>Xác nhận mật khẩu *</span>
              <input class="form-control" id="register-password-confirm" type="password"
                     autocomplete="new-password" placeholder="Nhập lại mật khẩu" required />
            </label>
          </div>

          <button class="btn-primary auth-submit" id="register-submit-button" type="submit">Đăng ký tài khoản</button>
        </form>

        <a class="public-register-link" href="#/login" data-open-login>Đã có tài khoản? Đăng nhập</a>
      </section>
    </main>
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
    showFormError('Tên đăng nhập từ 3 - 30 ký tự (chữ, số và . _ -)');
    return;
  }
  if (!displayName) {
    showFormError('Vui lòng nhập tên hiển thị.');
    return;
  }
  if (password.length < 6) {
    showFormError('Mật khẩu phải chứa ít nhất 6 ký tự.');
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
    window.location.hash = '#/dashboard';
    window.location.reload();
  } catch (error) {
    showFormError(error?.message || 'Không thể tạo tài khoản.');
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
  button.textContent = isSubmitting ? 'Đang đăng ký...' : 'Đăng ký tài khoản';
}
