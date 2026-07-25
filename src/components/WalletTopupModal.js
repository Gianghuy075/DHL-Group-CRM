import { Modal } from './Modal.js';
import { Toast } from './Toast.js';
import { DEPOSIT_BONUS_TIERS, WalletService } from '../services/WalletService.js';
import { formatCurrency } from '../utils/currency.js';
import { escapeHtml } from '../utils/html.js';

let activeTopupState = null;
let topupPollingTimer = null;

export const WalletTopupModal = {
  /**
   * Opens the Wallet Topup Modal dialog
   */
  open({ customerId, customerName = '', onTopupSuccess = async () => { } }) {
    if (!customerId) {
      Toast.show('Không xác định được Khách hàng để nạp ví.');
      return;
    }

    activeTopupState = {
      customerId,
      customerName,
      onTopupSuccess,
      selectedAmount: 1000000,
      selectedBonus: 150000,
      step: 1, // 1: Select Tier, 2: PayOS QR & Polling, 3: Success
      payosInfo: null,
    };

    renderTopupStep1();
  },

  stopPolling() {
    if (topupPollingTimer) {
      clearInterval(topupPollingTimer);
      topupPollingTimer = null;
    }
  },
};

function renderTopupStep1() {
  WalletTopupModal.stopPolling();
  const { customerName, selectedAmount, selectedBonus } = activeTopupState;

  Modal.open({
    title: '💰 Nạp tiền vào Ví KioskHub',
    body: `
      <div class="wallet-topup-container">
        <div class="topup-header-banner">
          <div>
            <div class="topup-subtitle">Nạp tiền vào Ví Ảo KioskHub</div>
            <div class="topup-user-name">Khách hàng: <strong>${escapeHtml(customerName || '—')}</strong></div>
          </div>
        </div>

        <div class="topup-tiers-grid">
          ${DEPOSIT_BONUS_TIERS.map((tier) => `
            <div class="topup-tier-card ${tier.amount === selectedAmount ? 'selected' : ''} ${tier.recommended ? 'recommended' : ''}" data-tier-amount="${tier.amount}" data-tier-bonus="0">
              ${tier.recommended ? '<div class="tier-ribbon">Phổ biến</div>' : ''}
              <div class="tier-amount">${formatCurrency(tier.amount)}</div>
            </div>
          `).join('')}
        </div>

        <div class="topup-custom-input">
          <label class="form-group">
            <span>Hoặc nhập số tiền nạp tùy chỉnh (VNĐ)</span>
            <input class="form-control" id="wallet-custom-amount" type="number" min="10000" step="50000" placeholder="Ví dụ: 300000" value="${selectedAmount}" />
          </label>
        </div>

        <div class="topup-summary-bar" id="topup-summary-preview">
          <div class="total">Số tiền nạp vào Ví: <strong class="text-gold" id="topup-preview-total">${formatCurrency(selectedAmount)}</strong></div>
        </div>

        <div class="modal-actions">
          <button class="btn-secondary" type="button" id="wallet-topup-close-btn">Hủy</button>
          <button class="btn-secondary" type="button" id="wallet-topup-dev-btn" title="Nạp thẳng vào ví, bỏ qua PayOS (chỉ dùng để test)">⚡ Đã thanh toán (dev)</button>
          <button class="btn-primary" type="button" id="wallet-topup-submit-btn">
            Tạo Mã Nạp ➔
          </button>
        </div>
      </div>
    `,
  });

  // Bind Tier Click Events
  document.querySelectorAll('[data-tier-amount]').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('[data-tier-amount]').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      const amount = Number(card.dataset.tierAmount);
      const bonus = Number(card.dataset.tierBonus);
      activeTopupState.selectedAmount = amount;
      activeTopupState.selectedBonus = bonus;

      const input = document.getElementById('wallet-custom-amount');
      if (input) input.value = amount;

      updateTopupPreview();
    });
  });

  // Custom Input Event
  document.getElementById('wallet-custom-amount')?.addEventListener('input', (e) => {
    const val = Number(e.target.value || 0);
    activeTopupState.selectedAmount = val;
    activeTopupState.selectedBonus = WalletService.calculateBonus(val);
    document.querySelectorAll('[data-tier-amount]').forEach((c) => c.classList.remove('selected'));
    updateTopupPreview();
  });

  document.getElementById('wallet-topup-close-btn')?.addEventListener('click', Modal.close);

  // DEV: nạp thẳng vào ví, bỏ qua PayOS (BE chặn ở production).
  document.getElementById('wallet-topup-dev-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('wallet-topup-dev-btn');
    const amount = Number(activeTopupState.selectedAmount || 0);
    if (!amount || amount < 1) {
      Toast.show('Vui lòng nhập số tiền nạp hợp lệ.');
      return;
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang nạp...';
    }
    try {
      const result = await WalletService.devCredit(amount);
      WalletTopupModal.stopPolling();
      Modal.open({
        title: '🎉 Nạp Ví (dev) Thành Công!',
        body: `
          <div class="status-result-box success">
            <div class="status-icon">✅</div>
            <div class="status-title">Đã cộng tiền vào ví (dev)</div>
            <div class="status-desc">
              Số tiền nạp: <strong>${formatCurrency(amount)}</strong><br/>
              Số dư Ví mới: <strong class="text-gold">${formatCurrency(result?.wallet_balance ?? amount)}</strong>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn-primary" type="button" id="topup-dev-done-btn">Đóng</button>
          </div>
        `,
      });
      document.getElementById('topup-dev-done-btn')?.addEventListener('click', async () => {
        Modal.close();
        await activeTopupState.onTopupSuccess?.();
      });
    } catch (err) {
      Toast.show(err?.message || 'Không thể nạp ví (dev).');
      if (btn) {
        btn.disabled = false;
        btn.textContent = '⚡ Đã thanh toán (dev)';
      }
    }
  });

  document.getElementById('wallet-topup-submit-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('wallet-topup-submit-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang kết nối...';
    }

    try {
      const topupReq = await WalletService.createTopupRequest({
        customerId: activeTopupState.customerId,
        amount: activeTopupState.selectedAmount,
        customerName: activeTopupState.customerName,
      });

      activeTopupState.payosInfo = topupReq;
      renderTopupStep2QR();
    } catch (err) {
      Toast.show(err?.message || 'Không thể tạo mã nạp ví.');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Tạo Mã Nạp ➔';
      }
    }
  });
}

function updateTopupPreview() {
  const amount = activeTopupState.selectedAmount;
  const totEl = document.getElementById('topup-preview-total');

  if (totEl) totEl.textContent = formatCurrency(amount);
}

function getQrCodeImageUrl(qrCode) {
  if (!qrCode) return '';
  if (qrCode.startsWith('http://') || qrCode.startsWith('https://') || qrCode.startsWith('data:image/')) {
    return qrCode;
  }
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}`;
}

/**
 * Abandons the current pending PayOS order (user closed / went back). Stops the
 * poll and fires a best-effort void so it doesn't linger as "Chờ thanh toán".
 * Clears payosInfo so it can never be cancelled twice (back + onClose).
 */
function cancelActivePayosOrder() {
  WalletTopupModal.stopPolling();
  const orderCode = activeTopupState?.payosInfo?.orderCode;
  if (!orderCode) return;
  activeTopupState.payosInfo = null;
  WalletService.cancelDeposit({ orderCode });
}

function renderTopupStep2QR() {
  const { payosInfo, selectedAmount } = activeTopupState;

  const hasCheckoutUrl = Boolean(payosInfo.checkoutUrl && !payosInfo.isFallback);
  const accountNo = payosInfo.accountNo || '';
  const accountName = payosInfo.accountName || '';
  const qrImageUrl = getQrCodeImageUrl(payosInfo.qrCode);

  Modal.open({
    title: 'Cổng Thanh Toán Tự Động',
    className: 'modal-payos',
    // Closing the QR screen (× / overlay / Esc) voids the pending PayOS order.
    onClose: cancelActivePayosOrder,
    body: `
      <div class="wallet-topup-container">
        <div class="payos-qr-wrapper">
          <div class="payos-qr-box">
            <img class="payos-qr-image" src="${escapeHtml(qrImageUrl)}" alt="Mã QR thanh toán" />
            <div class="payos-qr-badge">Quét QR để nạp tiền</div>
          </div>

          <div class="payos-transfer-details">

            ${accountNo ? `
              <div class="detail-row">
                <span class="detail-label">Số tài khoản</span>
                <div class="detail-val-copy">
                  <span class="detail-val strong-cell">${escapeHtml(accountNo)}</span>
                  <button class="btn-copy" type="button" data-copy="${escapeHtml(accountNo)}">Sao chép</button>
                </div>
              </div>
            ` : ''}

            ${accountName ? `
              <div class="detail-row">
                <span class="detail-label">Chủ tài khoản</span>
                <span class="detail-val">${escapeHtml(accountName)}</span>
              </div>
            ` : ''}

            <div class="detail-row">
              <span class="detail-label">Số tiền nạp</span>
              <div class="detail-val-copy">
                <span class="detail-val strong-cell text-primary-gold">${formatCurrency(selectedAmount)}</span>
                <button class="btn-copy" type="button" data-copy="${selectedAmount}">Sao chép</button>
              </div>
            </div>
            <div class="detail-row highlight-row">
              <span class="detail-label">Nội dung nạp tiền</span>
              <div class="detail-val-copy">
                <span class="detail-val code-text">${escapeHtml(payosInfo.description)}</span>
                <button class="btn-copy" type="button" data-copy="${escapeHtml(payosInfo.description)}">Sao chép</button>
              </div>
            </div>
          </div>
        </div>


        <div class="modal-actions">
          <button class="btn-secondary" type="button" id="topup-step2-back">Quay lại</button>
          <button class="btn-primary" type="button" id="topup-step2-confirm">🔄 Đối Soát Tự Động ➔</button>
        </div>
      </div>
    `,
  });

  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.copy;
      navigator.clipboard.writeText(text).then(() => Toast.show(`Đã sao chép: ${text}`));
    });
  });

  document.getElementById('topup-step2-back')?.addEventListener('click', () => {
    // Going back abandons this order → void it on PayOS, then re-pick an amount.
    cancelActivePayosOrder();
    renderTopupStep1();
  });

  document.getElementById('topup-step2-confirm')?.addEventListener('click', () => {
    handleConfirmTopup(true);
  });

  // Polling for topup status via PayOS API
  let attempts = 0;
  topupPollingTimer = setInterval(async () => {
    attempts += 1;
    if (attempts > 120) {
      WalletTopupModal.stopPolling();
      return;
    }

    const check = await WalletService.checkTopupStatus(payosInfo.orderCode);
    if (check.isPaid) {
      WalletTopupModal.stopPolling();
      await executeWalletDepositCredit();
    }
  }, 3000);
}

async function handleConfirmTopup(manualClick = false) {
  const { payosInfo } = activeTopupState;
  const statusEl = document.getElementById('topup-status-indicator');
  const btn = document.getElementById('topup-step2-confirm');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Đang kiểm tra kết quả...';
  }

  if (statusEl) {
    statusEl.innerHTML = '<span class="spinner-small"></span> Đang truy vấn...';
  }

  try {
    const check = await WalletService.checkTopupStatus(payosInfo.orderCode);
    if (check.isPaid) {
      WalletTopupModal.stopPolling();
      await executeWalletDepositCredit();
    } else {
      if (manualClick) {
        Toast.show(`Chưa ghi nhận thanh toán cho mã đơn ${payosInfo.orderCode}. Vui lòng chuyển khoản đúng thông tin và thử lại.`);
      }
      if (statusEl) {
        statusEl.innerHTML = `⚠️ Chưa nhận được thanh toán cho mã đơn <strong>${payosInfo.orderCode}</strong>. Hệ thống sẽ tự động cập nhật ngay khi ngân hàng xử lý xong.`;
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🔄 Đối Soát ➔';
      }
    }
  } catch (err) {
    Toast.show(err?.message || 'Không thể đối soát.');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔄 Đối Soát ➔';
    }
  }
}

async function executeWalletDepositCredit() {
  const { customerId, payosInfo, selectedAmount, selectedBonus, onTopupSuccess } = activeTopupState;

  // Opening this loading modal also clears the QR screen's onClose hook, so the
  // now-paid order is never voided while we credit it.
  Modal.open({
    title: '⏳ Đang xác nhận thanh toán',
    body: `
      <div class="status-result-box">
        <div class="payos-loading-spinner"></div>
        <div class="status-title">Đang xử lý giao dịch...</div>
        <div class="status-desc">Hệ thống đang xác nhận thanh toán và cộng tiền vào Ví. Vui lòng không đóng cửa sổ này.</div>
      </div>
    `,
  });

  try {
    const result = await WalletService.confirmDeposit({
      orderCode: payosInfo.orderCode,
    });

    Modal.open({
      title: '🎉 Nạp Ví Ảo Thành Công!',
      body: `
        <div class="status-result-box success">
          <div class="status-icon">✅</div>
          <div class="status-title">Đã Xác Nhận Thanh Toán!</div>
          <div class="status-desc">
            Số tiền nạp: <strong>${formatCurrency(selectedAmount)}</strong><br/>
            Tiền thưởng ưu đãi: <strong class="text-bonus">+${formatCurrency(selectedBonus)}</strong><br/>
            Số dư Ví mới: <strong class="text-gold">${formatCurrency(result.wallet_balance || selectedAmount)}</strong>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-primary" type="button" id="topup-done-btn">Đóng</button>
        </div>
      `,
    });

    document.getElementById('topup-done-btn')?.addEventListener('click', async () => {
      Modal.close();
      await onTopupSuccess?.();
    });

  } catch (err) {
    Toast.show(err?.message || 'Lỗi khi cộng tiền ví. Vui lòng thử lại.');
    // Restore the QR screen (re-arms polling + onClose) so the user can retry.
    renderTopupStep2QR();
  }
}
