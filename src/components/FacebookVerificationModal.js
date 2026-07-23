import { Modal } from './Modal.js';
import { Toast } from './Toast.js';
import { FacebookApiService } from '../services/FacebookApiService.js';
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

          <form id="fb-verify-form" class="modal-form" novalidate>
            <div id="fb-verify-error" class="form-error hidden"></div>

            <label class="form-group">
              <span>Đường dẫn Facebook Cá nhân / ID Facebook *</span>
              <input class="form-control" id="fb-verify-input" type="text" placeholder="https://www.facebook.com/username hoặc 1000..." value="${escapeHtml(currentFacebookUrl || currentFacebookId)}" required />
              <small class="field-optional text-gold" id="fb-detected-id-info"></small>
            </label>

            <div id="fb-verify-result-outlet"></div>

            <div class="modal-actions">
              <button class="btn-secondary" type="button" data-modal-close>Hủy</button>
              <button class="btn-primary" type="submit" id="fb-verify-submit-btn">
                Kiểm tra qua Graph API v19.0 ➔
              </button>
            </div>
          </form>
        </div>
      `,
    });

    const verifyInput = document.getElementById('fb-verify-input');
    const infoEl = document.getElementById('fb-detected-id-info');

    const updateDetectedInfo = () => {
      const extracted = FacebookApiService.extractFacebookId(verifyInput?.value || '');
      if (infoEl) {
        infoEl.textContent = extracted ? `⚡ Tự động nhận diện ID: ${extracted}` : '';
      }
    };

    verifyInput?.addEventListener('input', updateDetectedInfo);
    updateDetectedInfo();

    const form = document.getElementById('fb-verify-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('fb-verify-input')?.value.trim();
      if (!input) {
        showError('Vui lòng nhập Facebook ID hoặc Link trang cá nhân.');
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
                  Facebook Name: <strong>${escapeHtml(result.name)}</strong> (ID: <code>${escapeHtml(result.facebookId)}</code>)<br/>
                  Bạn bè / Followers: <strong class="text-gold">${result.friendCount + result.followerCount}</strong> (Đạt chuẩn >= 100)<br/>
                  Chế độ: <strong class="text-green">Công khai / Creator Mode</strong>
                </div>
              </div>
            `;
          }

          if (customerId) {
            await CustomerService.updateFacebookVerification(customerId, {
              verified: true,
              friendCount: result.friendCount,
              followerCount: result.followerCount,
              isPublic: result.isPublic,
              facebookId: result.facebookId,
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
