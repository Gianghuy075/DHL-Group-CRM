import { AuthService } from '../services/AuthService.js';
import { escapeHtml } from '../utils/html.js';

export function LoginPage({ message = '' } = {}) {
  return `
    <main class="auth-shell">
      <section class="auth-card">
        <div class="auth-logo">🏪</div>
        <h1>Đăng nhập</h1>
        <p>Hệ thống quản lý Kiosk · Diễn Châu - À Đây Rồi</p>
        <div id="login-error" class="form-error ${message ? '' : 'hidden'}">${escapeHtml(message)}</div>
        <form id="login-form" novalidate>
          <label class="form-group">
            <span>Tên đăng nhập</span>
            <input id="login-username" class="form-control" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required />
          </label>
          <label class="form-group">
            <span>Mật khẩu</span>
            <input id="login-password" class="form-control" type="password" autocomplete="current-password" required />
          </label>
          <button id="login-submit" class="btn-primary auth-submit" type="submit">Đăng nhập</button>
        </form>
        <a class="public-register-link" href="#/register" data-open-register>Chưa có tài khoản? Đăng ký</a>
      </section>
    </main>
  `;
}

LoginPage.afterRender = function afterRenderLogin() {
  document.querySelector('[data-open-register]')?.addEventListener('click', (event) => {
    event.preventDefault();
    window.location.hash = '#/register';
    window.location.reload();
  });

  document.getElementById('login-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = document.getElementById('login-username')?.value.trim();
    const password = document.getElementById('login-password')?.value || '';
    const button = document.getElementById('login-submit');
    const errorElement = document.getElementById('login-error');

    if (!username || !password) {
      showError(errorElement, 'Vui lòng nhập tên đăng nhập và mật khẩu.');
      return;
    }

    setLoading(button, true);
    errorElement?.classList.add('hidden');

    try {
      await AuthService.signInWithUsername(username, password);
      window.location.hash = '#/dashboard';
      window.location.reload();
    } catch (error) {
      showError(errorElement, error?.message || 'Sai tên đăng nhập hoặc mật khẩu.');
      setLoading(button, false);
    }
  });
};

function showError(element, message) {
  if (!element) return;
  element.textContent = message;
  element.classList.remove('hidden');
}

function setLoading(button, loading) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? 'Đang đăng nhập...' : 'Đăng nhập';
}
