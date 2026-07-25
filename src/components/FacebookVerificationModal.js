import { Modal } from './Modal.js';
import { Toast } from './Toast.js';
import { FacebookApiService } from '../services/FacebookApiService.js';
import { FacebookAuthService } from '../services/FacebookAuthService.js';
import { CustomerService } from '../services/CustomerService.js';
import { escapeHtml } from '../utils/html.js';

export const FacebookVerificationModal = {
  /**
   * Opens Facebook Profile Verification Modal
   */
  open({ customerId, currentFacebookUrl = '', currentFacebookId = '', onVerified = async () => {} }) {
    Modal.open({
      title: '🛡️ Xác thực Tài khoản Facebook qua Graph API',
      body: `
        <div class="fb-verify-modal-container">
          <div class="fb-verify-banner">
            <span class="fb-logo-icon">🌐</span>
            <div>
              <strong>Yêu cầu Điều kiện Tài khoản Facebook</strong>
              <div class="muted-text">Để đăng ký Kiosk và đăng/làm nhiệm vụ chéo, tài khoản Facebook của bạn phải đạt các tiêu chí sau:</div>
            </div>
          </div>

          <div class="fb-criteria-list">
            <div class="criteria-item">
              <span class="check-icon">✓</span>
              <div>
                <strong>Chế độ Công khai / Người nổi tiếng</strong>
                <div class="sub-text">Bật Chế độ Công khai (Public Mode) hoặc Chế độ Chuyên nghiệp (Professional Creator Mode).</div>
              </div>
            </div>
            <div class="criteria-item">
              <span class="check-icon">✓</span>
              <div>
                <strong>Tối thiểu 100 Bạn bè / Người theo dõi</strong>
                <div class="sub-text">Graph API tự động kiểm tra số lượng bạn bè để đảm bảo tính thực tế của tương tác.</div>
              </div>
            </div>
          </div>

          <div class="fb-oauth-section">
            <button class="btn-primary btn-facebook-login" type="button" id="fb-oauth-login-btn">
              <span class="fb-logo-icon">🔷</span> Đăng nhập Facebook để xác thực tự động
            </button>
            <div class="muted-text fb-oauth-hint">
              Cách này lấy Tên &amp; số bạn bè trực tiếp từ Facebook Graph API — chính xác, không thể khai khống.
            </div>
            <div id="fb-oauth-result-outlet"></div>
          </div>

          <div class="fb-verify-divider"><span>hoặc nhập thủ công</span></div>

          <form id="fb-verify-form" class="modal-form" novalidate>
            <div id="fb-verify-error" class="form-error hidden"></div>

            <label class="form-group">
              <span>Đường dẫn Facebook Cá nhân (URL) *</span>
              <input class="form-control" id="fb-verify-input" type="text" placeholder="https://www.facebook.com/hguhys" value="${escapeHtml(currentFacebookUrl)}" required />
            </label>

            <label class="form-group">
              <span>Mã ID Facebook dạng số (Numeric UID 1000...) *</span>
              <input class="form-control" id="fb-verify-numeric-id" type="text" placeholder="100088812345678" value="${escapeHtml(currentFacebookId && /^[0-9]+$/.test(currentFacebookId) ? currentFacebookId : '')}" required />
              <small class="field-optional text-gold" id="fb-detected-id-info"></small>
            </label>

            <label class="form-group">
              <span>Số lượng Bạn bè / Followers thực tế *</span>
              <input class="form-control" id="fb-verify-friends-count" type="number" min="100" placeholder="Ví dụ: 355" value="355" required />
            </label>

            <div id="fb-verify-result-outlet"></div>

            <div class="modal-actions">
              <button class="btn-secondary" type="button" data-modal-close>Hủy</button>
              <button class="btn-primary" type="submit" id="fb-verify-submit-btn">
                Kiểm tra qua Graph API ➔
              </button>
            </div>
          </form>
        </div>
      `,
    });

    const verifyInput = document.getElementById('fb-verify-input');
    const numericIdInput = document.getElementById('fb-verify-numeric-id');
    const infoEl = document.getElementById('fb-detected-id-info');

    const updateDetectedInfo = () => {
      const urlVal = verifyInput?.value || '';
      const resolvedNumeric = FacebookApiService.resolveNumericFacebookId(urlVal);
      if (numericIdInput && !numericIdInput.value.trim() && resolvedNumeric) {
        numericIdInput.value = resolvedNumeric;
      }
      if (infoEl) {
        infoEl.textContent = resolvedNumeric ? `⚡ Mã ID dạng số: ${resolvedNumeric}` : '';
      }
    };

    verifyInput?.addEventListener('input', updateDetectedInfo);
    updateDetectedInfo();

    // Authoritative path: OAuth login → BE verifies via Graph API.
    const oauthBtn = document.getElementById('fb-oauth-login-btn');
    if (!FacebookAuthService.isConfigured()) {
      if (oauthBtn) {
        oauthBtn.disabled = true;
        oauthBtn.title = 'Chưa cấu hình Facebook App ID.';
      }
      const hint = document.querySelector('.fb-oauth-hint');
      if (hint) {
        hint.textContent = 'Chưa cấu hình Facebook App ID — dùng cách nhập thủ công bên dưới, hoặc thêm facebook.appId vào config.local.js.';
      }
    }

    oauthBtn?.addEventListener('click', async () => {
      const outlet = document.getElementById('fb-oauth-result-outlet');
      oauthBtn.disabled = true;
      const originalText = oauthBtn.innerHTML;
      oauthBtn.textContent = 'Đang kết nối Facebook...';
      try {
        // Logged-in profile (has customerId) → persist on the server.
        // Registration (no customerId, no session) → preview-only, saved later.
        const result = customerId
          ? await FacebookAuthService.verifyProfile()
          : await FacebookAuthService.verifyProfilePreview();
        if (outlet) {
          outlet.innerHTML = `
            <div class="status-result-box success">
              <div class="status-icon">✅</div>
              <div class="status-title">Đã xác thực qua Facebook!</div>
              <div class="status-desc">
                Facebook Name: <strong>${escapeHtml(result?.facebookName || '')}</strong><br/>
                Bạn bè: <strong class="text-gold">${result?.friendCount ?? 0}</strong>
              </div>
            </div>
          `;
        }
        // Normalize to the shape callers (RegisterPage.onVerified) expect.
        const normalized = {
          verified: true,
          name: result?.facebookName || '',
          facebookId: result?.facebookId || '',
          friendCount: result?.friendCount ?? 0,
          followerCount: 0,
        };
        Toast.show('Đã xác thực tài khoản Facebook thành công!');
        setTimeout(async () => {
          Modal.close();
          await onVerified?.(normalized);
        }, 1200);
      } catch (err) {
        oauthBtn.disabled = false;
        oauthBtn.innerHTML = originalText;
        if (outlet) {
          outlet.innerHTML = `
            <div class="status-result-box warning">
              <div class="status-icon">⚠️</div>
              <div class="status-desc">${escapeHtml(err?.message || 'Lỗi đăng nhập Facebook.')}</div>
            </div>
          `;
        }
        Toast.show(err?.message || 'Lỗi đăng nhập Facebook.');
      }
    });

    const form = document.getElementById('fb-verify-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('fb-verify-input')?.value.trim();
      const numId = document.getElementById('fb-verify-numeric-id')?.value.trim();
      const friendsCount = Number(document.getElementById('fb-verify-friends-count')?.value) || 0;

      if (!input && !numId) {
        showError('Vui lòng nhập Link Facebook cá nhân hoặc Mã ID dạng số.');
        return;
      }

      if (friendsCount < 100) {
        showError('Số lượng bạn bè/followers phải đạt tối thiểu 100.');
        return;
      }

      const submitBtn = document.getElementById('fb-verify-submit-btn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang gọi Facebook Graph API...';
      }

      clearError();

      try {
        const result = await FacebookApiService.verifyFacebookProfile({
          profileUrl: input,
          facebookId: numId,
          realFriendCount: friendsCount,
          minFriends: 100,
        });

        const outlet = document.getElementById('fb-verify-result-outlet');

        if (result.verified) {
          if (outlet) {
            outlet.innerHTML = `
              <div class="status-result-box success">
                <div class="status-icon">✅</div>
                <div class="status-title">Xác thực Facebook Thành Công!</div>
                <div class="status-desc">
                  Facebook Name: <strong>${escapeHtml(result.name)}</strong> (ID Số: <code>${escapeHtml(result.facebookId)}</code>)<br/>
                  Bạn bè / Followers: <strong class="text-gold">${result.friendCount}</strong> (Đạt chuẩn >= 100)<br/>
                  Chế độ: <strong class="text-green">Công khai / Creator Mode</strong>
                </div>
              </div>
            `;
          }

          if (customerId) {
            await CustomerService.updateFacebookVerification(customerId, {
              verified: true,
              friendCount: result.friendCount,
              followerCount: 0,
              isPublic: true,
              facebookId: result.facebookId,
              facebookName: result.name,
            });
          }

          Toast.show('Đã xác thực tài khoản Facebook thành công!');
          setTimeout(async () => {
            Modal.close();
            await onVerified?.(result);
          }, 1200);

        } else {
          if (outlet) {
            outlet.innerHTML = `
              <div class="status-result-box warning">
                <div class="status-icon">⚠️</div>
                <div class="status-title">Chưa đủ điều kiện xác thực</div>
                <div class="status-desc">${escapeHtml(result.message)}</div>
              </div>
            `;
          }
          showError(result.message);
        }

      } catch (err) {
        showError(err?.message || 'Lỗi khi gọi Facebook Graph API.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Kiểm tra qua Graph API v19.0 ➔';
        }
      }
    });
  },
};

function showError(msg) {
  const el = document.getElementById('fb-verify-error');
  if (el) {
    el.textContent = msg;
    el.classList.remove('hidden');
  }
}

function clearError() {
  const el = document.getElementById('fb-verify-error');
  if (el) {
    el.textContent = '';
    el.classList.add('hidden');
  }
}
