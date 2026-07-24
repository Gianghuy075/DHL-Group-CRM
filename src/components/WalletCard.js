import { Modal } from './Modal.js';
import { WalletService } from '../services/WalletService.js';
import { WalletTopupModal } from './WalletTopupModal.js';
import { formatCurrency } from '../utils/currency.js';
import { escapeHtml } from '../utils/html.js';

export function WalletCard({ customer, walletInfo, onUpdated } = {}) {
  const walletBalance = Number(walletInfo?.walletBalance || customer?.wallet_balance || 0);
  const bonusBalance = Number(walletInfo?.bonusBalance || customer?.bonus_balance || 0);
  const totalAvailable = walletBalance + bonusBalance;

  return `
    <div class="wallet-card">
      <div class="wallet-card-header">
        <div class="wallet-card-title">
          <span class="wallet-icon font-emoji">💳</span>
          <div>
            <strong>Ví Ảo Chăm Sóc Sức Khỏe & Dịch Vụ</strong>
            <div class="wallet-subtitle">Tài khoản thanh toán dịch vụ & ưu đãi CRM</div>
          </div>
        </div>
        <div class="wallet-actions-group">
          <button class="btn-secondary compact" type="button" data-wallet-history="${escapeHtml(customer?.id || '')}">Lịch sử ví</button>
          <button class="btn-primary compact" type="button" data-wallet-topup="${escapeHtml(customer?.id || '')}" data-customer-name="${escapeHtml(customer?.facebook_name || '')}">+ Nạp tiền vào Ví</button>
        </div>
      </div>

      <div class="wallet-balances-grid">
        <div class="balance-item primary">
          <span class="balance-label">Số dư chính</span>
          <span class="balance-value text-gold">${formatCurrency(walletBalance)}</span>
        </div>
        <div class="balance-item bonus">
          <span class="balance-label">Số dư thưởng (Ưu đãi)</span>
          <span class="balance-value text-bonus">+${formatCurrency(bonusBalance)}</span>
        </div>
        <div class="balance-item total">
          <span class="balance-label">Tổng số dư khả dụng</span>
          <span class="balance-value strong-cell">${formatCurrency(totalAvailable)}</span>
        </div>
      </div>
    </div>
  `;
}

WalletCard.bindEvents = function bindEvents(container, { customerId, customerName, onUpdated } = {}) {
  if (!container) return;

  container.querySelector('[data-wallet-topup]')?.addEventListener('click', () => {
    WalletTopupModal.open({
      customerId,
      customerName,
      onTopupSuccess: async () => {
        await onUpdated?.();
      },
    });
  });

  container.querySelector('[data-wallet-history]')?.addEventListener('click', async () => {
    openWalletHistoryModal(customerId, customerName);
  });
};

async function openWalletHistoryModal(customerId, customerName) {
  Modal.open({
    title: `Lịch sử Giao dịch Ví Ảo - ${escapeHtml(customerName || '—')}`,
    body: `<div class="empty-state"><div class="spinner-small"></div> Đang tải lịch sử giao dịch ví...</div>`,
  });

  try {
    const { data: txs } = await WalletService.listTransactions(customerId);

    if (!txs || !txs.length) {
      Modal.open({
        title: `Lịch sử Giao dịch Ví Ảo - ${escapeHtml(customerName || '—')}`,
        body: `
          <div class="empty-state">
            <div class="empty-state-icon">📜</div>
            <div class="empty-state-title">Chưa có giao dịch ví nào</div>
            <div class="empty-state-message">Các giao dịch nạp ví và thanh toán dịch vụ bằng ví sẽ hiển thị tại đây.</div>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" type="button" data-modal-close>Đóng</button>
          </div>
        `,
      });
      return;
    }

    Modal.open({
      title: `Lịch sử Giao dịch Ví Ảo - ${escapeHtml(customerName || '—')}`,
      body: `
        <div class="wallet-history-table-container">
          <table class="data-table compact-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Loại GD</th>
                <th>Số tiền</th>
                <th>Tiền thưởng</th>
                <th>Trạng thái</th>
                <th>Mô tả</th>
              </tr>
            </thead>
            <tbody>
              ${txs.map((tx) => `
                <tr>
                  <td>${formatDateTime(tx.created_at)}</td>
                  <td>${renderTxType(tx.transaction_type)}</td>
                  <td class="strong-cell ${Number(tx.amount) >= 0 ? 'text-green' : 'text-danger'}">
                    ${Number(tx.amount) >= 0 ? '+' : ''}${formatCurrency(tx.amount)}
                  </td>
                  <td>${Number(tx.bonus_amount) > 0 ? `<span class="text-bonus">+${formatCurrency(tx.bonus_amount)}</span>` : '—'}</td>
                  <td>${renderTxStatus(tx.status)}</td>
                  <td>${escapeHtml(tx.description || '—')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" type="button" data-modal-close>Đóng</button>
        </div>
      `,
    });
  } catch (err) {
    Modal.open({
      title: 'Lịch sử Ví Ảo',
      body: `<div class="empty-state">Không thể tải lịch sử giao dịch: ${escapeHtml(err?.message || '')}</div>`,
    });
  }
}

function renderTxType(type) {
  switch (type) {
    case 'deposit':
      return '<span class="badge badge-completed">Nạp tiền</span>';
    case 'spending':
      return '<span class="badge badge-pending">Thanh toán</span>';
    case 'bonus':
      return '<span class="badge badge-active">Tiền thưởng</span>';
    default:
      return `<span class="badge">${escapeHtml(type)}</span>`;
  }
}

function renderTxStatus(status) {
  if (status === 'completed') return '<span class="status-dot green">Hoàn tất</span>';
  if (status === 'pending') return '<span class="status-dot yellow">Đang chờ</span>';
  return `<span class="status-dot red">${escapeHtml(status)}</span>`;
}

function formatDateTime(val) {
  if (!val) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(val));
}
