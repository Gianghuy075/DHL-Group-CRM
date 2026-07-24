import { Modal } from './Modal.js';
import { Toast } from './Toast.js';
import { PayOSService } from '../services/PayOSService.js';
import { WalletService } from '../services/WalletService.js';
import { formatCurrency } from '../utils/currency.js';
import { escapeHtml } from '../utils/html.js';

let activePaymentState = null;
let pollingTimer = null;

export const PayOSPaymentModal = {
  /**
   * Opens the PayOS 3-step payment modal flow
   */
  async open({
    title = 'Thanh toán dịch vụ',
    amount = 0,
    description = '',
    customerId = null,
    customerName = '',
    kioskName = '',
    months = 1,
    onSuccess = async () => { },
    onCancel = () => { },
  }) {
    this.stopPolling();

    activePaymentState = {
      step: 1, // 1: Summary, 2: PayOS QR, 3: Verification
      title,
      amount: Number(amount),
      description: description || 'Thanh toán Kiosk DHL',
      customerId,
      customerName,
      kioskName,
      months,
      onSuccess,
      onCancel,
      payosInfo: null,
      walletInfo: null,
      verificationStatus: 'PENDING', // PENDING, PAID, FAILED
      isVerifying: false,
    };

    if (customerId) {
      activePaymentState.walletInfo = await WalletService.getWalletInfo(customerId);
    }

    renderCurrentStep();
  },

  stopPolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  },
};

function renderCurrentStep() {
  PayOSPaymentModal.stopPolling();
  if (!activePaymentState) return;

  switch (activePaymentState.step) {
    case 1:
      renderStep1Summary();
      break;
    case 2:
      renderStep2QRTransfer();
      break;
    case 3:
      renderStep3Verification();
      break;
    default:
      Modal.close();
  }
}

/**
 * STEP 1: Summary & Payment Method Selection
 */
function renderStep1Summary() {
  const { title, amount, customerName, kioskName, months, description, walletInfo } = activePaymentState;
  const hasWallet = Boolean(walletInfo && walletInfo.totalAvailable >= amount);

  Modal.open({
    title: `[Bước 1/3] ${title}`,
    body: `
      <div class="payos-modal-container">
        <div class="payos-stepper">
          <div class="payos-step active"><span>1</span><strong>Xác nhận</strong></div>
          <div class="payos-step-line"></div>
          <div class="payos-step"><span>2</span><strong>Chuyển khoản QR</strong></div>
          <div class="payos-step-line"></div>
          <div class="payos-step"><span>3</span><strong>Xác thực</strong></div>
        </div>

        <div class="payos-summary-box">
          <div class="setting-item">
            <span class="setting-name">Khách hàng</span>
            <span class="setting-value detail-value">${escapeHtml(customerName || '—')}</span>
          </div>
          ${kioskName ? `
            <div class="setting-item">
              <span class="setting-name">Kiosk</span>
              <span class="setting-value detail-value">${escapeHtml(kioskName)}</span>
            </div>
          ` : ''}
          ${months ? `
            <div class="setting-item">
              <span class="setting-name">Thời hạn</span>
              <span class="setting-value detail-value">${months} tháng</span>
            </div>
          ` : ''}
          <div class="setting-item">
            <span class="setting-name">Nội dung thanh toán</span>
            <span class="setting-value detail-value">${escapeHtml(description)}</span>
          </div>
          <div class="setting-item highlight">
            <span class="setting-name">Tổng tiền cần thanh toán</span>
            <span class="setting-value strong-cell text-primary-gold">${formatCurrency(amount)}</span>
          </div>
        </div>

        ${walletInfo ? `
          <div class="payos-wallet-option ${hasWallet ? 'available' : 'insufficient'}">
            <div class="wallet-option-header">
              <span class="wallet-icon">💳</span>
              <div>
                <strong>Thanh toán bằng Ví Ảo (Ví web)</strong>
                <div class="muted-text">
                  Số dư khả dụng: <strong>${formatCurrency(walletInfo.totalAvailable)}</strong>
                  ${walletInfo.bonusBalance > 0 ? ` <span class="badge-bonus">(Gồm ${formatCurrency(walletInfo.bonusBalance)} thưởng)</span>` : ''}
                </div>
              </div>
            </div>
            ${hasWallet ? `
              <button class="btn-secondary compact" type="button" id="payos-pay-via-wallet-btn">Dùng Ví ảo thanh toán ngay</button>
            ` : `
              <div class="wallet-warning">Số dư ví không đủ (${formatCurrency(walletInfo.totalAvailable)} < ${formatCurrency(amount)}). Vui lòng chọn thanh toán qua QR.</div>
            `}
          </div>
        ` : ''}

        <div class="modal-actions">
          <button class="btn-secondary" type="button" id="payos-cancel-btn">Hủy</button>
          <button class="btn-primary" type="button" id="payos-goto-step2-btn">
            Tạo mã QR Chuyển khoản ➔
          </button>
        </div>
      </div>
    `,
  });

  document.getElementById('payos-cancel-btn')?.addEventListener('click', () => {
    activePaymentState?.onCancel?.();
    Modal.close();
  });

  document.getElementById('payos-pay-via-wallet-btn')?.addEventListener('click', handleWalletPayment);

  document.getElementById('payos-goto-step2-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('payos-goto-step2-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang tạo mã QR ...';
    }

    try {
      const payosInfo = await PayOSService.createPaymentLink({
        amount: activePaymentState.amount,
        description: activePaymentState.description,
        customerName: activePaymentState.customerName,
      });

      activePaymentState.payosInfo = payosInfo;
      activePaymentState.step = 2;
      renderCurrentStep();
    } catch (err) {
      Toast.show(err?.message || 'Không thể tạo liên kết thanh toán. Vui lòng thử lại.');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Tạo mã QR Chuyển khoản ➔';
      }
    }
  });
}

/**
 * STEP 2: PayOS VietQR Transfer Dialog with Live Polling
 */
function getQrCodeImageUrl(qrCode) {
  if (!qrCode) return '';
  if (qrCode.startsWith('http://') || qrCode.startsWith('https://') || qrCode.startsWith('data:image/')) {
    return qrCode;
  }
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}`;
}

function renderStep2QRTransfer() {
  const { payosInfo, amount } = activePaymentState;
  if (!payosInfo) {
    activePaymentState.step = 1;
    renderCurrentStep();
    return;
  }

  const qrImageUrl = getQrCodeImageUrl(payosInfo.qrCode);

  Modal.open({
    title: `[Bước 2/3] Quét mã QR Chuyển khoản`,
    className: 'modal-payos',
    body: `
      <div class="payos-modal-container">
        <div class="payos-stepper">
          <div class="payos-step completed"><span>✓</span><strong>Xác nhận</strong></div>
          <div class="payos-step-line active"></div>
          <div class="payos-step active"><span>2</span><strong>Chuyển khoản QR</strong></div>
          <div class="payos-step-line"></div>
          <div class="payos-step"><span>3</span><strong>Xác thực</strong></div>
        </div>

        <div class="payos-qr-wrapper">
          <div class="payos-qr-box">
            <img class="payos-qr-image" src="${escapeHtml(qrImageUrl)}" alt="Mã QR Chuyển khoản" />
            <div class="payos-qr-badge">Quét QR để thanh toán tự động</div>
          </div>

          <div class="payos-transfer-details">
            ${payosInfo.bankName ? `
              <div class="detail-row">
                <span class="detail-label">Ngân hàng</span>
                <span class="detail-val strong">${escapeHtml(payosInfo.bankName)}</span>
              </div>
            ` : ''}
            ${payosInfo.accountNo ? `
              <div class="detail-row">
                <span class="detail-label">Số tài khoản</span>
                <div class="detail-val-copy">
                  <span class="detail-val strong-cell" id="payos-copy-stk">${escapeHtml(payosInfo.accountNo)}</span>
                  <button class="btn-copy" type="button" data-copy="${escapeHtml(payosInfo.accountNo)}">Sao chép</button>
                </div>
              </div>
            ` : ''}
            ${payosInfo.accountName ? `
              <div class="detail-row">
                <span class="detail-label">Chủ tài khoản</span>
                <span class="detail-val">${escapeHtml(payosInfo.accountName)}</span>
              </div>
            ` : ''}
            <div class="detail-row">
              <span class="detail-label">Số tiền</span>
              <div class="detail-val-copy">
                <span class="detail-val strong-cell text-primary-gold">${formatCurrency(amount)}</span>
                <button class="btn-copy" type="button" data-copy="${amount}">Sao chép</button>
              </div>
            </div>
            <div class="detail-row highlight-row">
              <span class="detail-label">Nội dung CK chuẩn</span>
              <div class="detail-val-copy">
                <span class="detail-val code-text" id="payos-copy-content">${escapeHtml(payosInfo.description)}</span>
                <button class="btn-copy" type="button" data-copy="${escapeHtml(payosInfo.description)}">Sao chép</button>
              </div>
            </div>
          </div>
        </div>

        <div class="payos-polling-status" id="payos-polling-indicator">
          <span class="spinner-small"></span> Đang chờ thanh toán...
        </div>

        <div class="modal-actions">
          <button class="btn-secondary" type="button" id="payos-step2-back-btn">Quay lại</button>
          <button class="btn-primary" type="button" id="payos-step2-verify-btn">🔄 Đối soát ➔</button>
        </div>
      </div>
    `,
  });

  // Bind copy buttons
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.copy;
      navigator.clipboard.writeText(text).then(() => {
        Toast.show(`Đã sao chép: ${text}`);
      }).catch(() => {
        Toast.show('Không thể sao chép tự động.');
      });
    });
  });

  document.getElementById('payos-step2-back-btn')?.addEventListener('click', () => {
    activePaymentState.step = 1;
    renderCurrentStep();
  });

  document.getElementById('payos-step2-verify-btn')?.addEventListener('click', () => {
    activePaymentState.step = 3;
    renderCurrentStep();
  });

  // Start live polling every 3.5 seconds to check payment status automatically
  let pollAttempts = 0;
  pollingTimer = setInterval(async () => {
    pollAttempts += 1;
    if (pollAttempts > 100 || activePaymentState?.step !== 2) {
      PayOSPaymentModal.stopPolling();
      return;
    }

    const check = await PayOSService.checkPaymentStatus(payosInfo.orderCode);
    if (check.isPaid) {
      PayOSPaymentModal.stopPolling();
      Toast.show('Nhận phản hồi thanh toán thành công từ PayOS!');
      activePaymentState.verificationStatus = 'PAID';
      activePaymentState.step = 3;
      renderCurrentStep();
    }
  }, 3500);
}

/**
 * STEP 3: Verification Dialog (Paid / Pending check)
 */
async function renderStep3Verification() {
  Modal.open({
    title: `[Bước 3/3] Xác thực Thanh toán`,
    body: `
      <div class="payos-modal-container">
        <div class="payos-stepper">
          <div class="payos-step completed"><span>✓</span><strong>Xác nhận</strong></div>
          <div class="payos-step-line active"></div>
          <div class="payos-step completed"><span>✓</span><strong>Chuyển khoản QR</strong></div>
          <div class="payos-step-line active"></div>
          <div class="payos-step active"><span>3</span><strong>Xác thực</strong></div>
        </div>

        <div id="payos-verification-card" class="payos-verification-card">
          <div class="spinner-large"></div>
          <div class="verifying-text">Đang đối soát giao dịch với ngân hàng...</div>
        </div>

        <div class="modal-actions" id="payos-step3-actions">
          <button class="btn-secondary" type="button" disabled>Đang kiểm tra...</button>
        </div>
      </div>
    `,
  });

  await runVerificationCheck();
}

async function runVerificationCheck() {
  const container = document.getElementById('payos-verification-card');
  const actions = document.getElementById('payos-step3-actions');
  if (!container || !actions) return;

  const { payosInfo } = activePaymentState;

  // Check PayOS status
  let isPaid = activePaymentState.verificationStatus === 'PAID';
  if (!isPaid && payosInfo?.orderCode) {
    const check = await PayOSService.checkPaymentStatus(payosInfo.orderCode);
    if (check.isPaid) isPaid = true;
  }

  if (isPaid) {
    activePaymentState.verificationStatus = 'PAID';
    container.innerHTML = `
      <div class="status-result-box success">
        <div class="status-icon">🎉</div>
        <div class="status-title">Thanh toán Thành Công!</div>
        <div class="status-desc">Hệ thống đã xác nhận nhận đủ <strong>${formatCurrency(activePaymentState.amount)}</strong>.</div>
        <div class="status-meta">
          <span>Mã đơn hàng: <strong>${payosInfo?.orderCode || '—'}</strong></span>
          <span>Nội dung: <strong>${escapeHtml(activePaymentState.description)}</strong></span>
        </div>
      </div>
    `;

    actions.innerHTML = `
      <button class="btn-primary" type="button" id="payos-complete-btn">Hoàn tất & Kích hoạt ➔</button>
    `;

    document.getElementById('payos-complete-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('payos-complete-btn');
      if (btn) btn.disabled = true;
      try {
        await activePaymentState?.onSuccess?.(activePaymentState);
        Modal.close();
      } catch (err) {
        Toast.show(err?.message || 'Có lỗi khi hoàn tất kích hoạt.');
        if (btn) btn.disabled = false;
      }
    });

  } else {
    activePaymentState.verificationStatus = 'PENDING';
    container.innerHTML = `
      <div class="status-result-box warning">
        <div class="status-icon">⏳</div>
        <div class="status-title">Chưa nhận được tín hiệu thanh toán</div>
        <div class="status-desc">Hệ thống chưa ghi nhận chuyển khoản cho mã đơn <strong>${payosInfo?.orderCode || '—'}</strong>. Vui lòng đảm bảo bạn đã chuyển khoản đúng số tiền và nội dung.</div>
        <div class="status-note">Lưu ý: Ngân hàng có thể mất 1-3 phút để xử lý giao dịch.</div>
      </div>
    `;

    actions.innerHTML = `
      <button class="btn-secondary" type="button" id="payos-back-to-qr-btn">Quay lại mã QR</button>
      <button class="btn-primary" type="button" id="payos-recheck-btn">Kiểm tra lại lần nữa</button>
    `;

    document.getElementById('payos-back-to-qr-btn')?.addEventListener('click', () => {
      activePaymentState.step = 2;
      renderCurrentStep();
    });

    document.getElementById('payos-recheck-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('payos-recheck-btn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Đang đối soát lại...';
      }
      await runVerificationCheck();
    });
  }
}

async function handleWalletPayment() {
  const btn = document.getElementById('payos-pay-via-wallet-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Đang trừ số dư ví...';
  }

  try {
    const result = await WalletService.payWithWallet({
      customerId: activePaymentState.customerId,
      amount: activePaymentState.amount,
      description: activePaymentState.description,
    });

    Toast.show('Đã thanh toán thành công bằng số dư Ví Ảo!');
    await activePaymentState?.onSuccess?.({
      ...activePaymentState,
      paidViaWallet: true,
      result,
    });
    Modal.close();
  } catch (err) {
    Toast.show(err?.message || 'Không thể thanh toán bằng Ví Ảo.');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Dùng Ví ảo thanh toán ngay';
    }
  }
}
