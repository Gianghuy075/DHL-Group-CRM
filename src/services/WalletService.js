import { requireSupabaseClient, runQuery } from './BaseService.js';
import { apiClient } from './apiClient.js';

export const DEPOSIT_BONUS_TIERS = [
  { amount: 500000, bonus: 0, label: 'Nạp 500.000 đ' },
  { amount: 1000000, bonus: 0, label: 'Nạp 1.000.000 đ', recommended: true },
  { amount: 2000000, bonus: 0, label: 'Nạp 2.000.000 đ' },
  { amount: 5000000, bonus: 0, label: 'Nạp 5.000.000 đ' },
];

export const WalletService = {
  /**
   * Get the authenticated customer's wallet balance from the backend.
   * `customerId` is accepted for call-site compatibility but ignored — the BE
   * derives the customer from the access token (never trusts a client id).
   */
  async getWalletInfo(customerId) {
    if (!customerId) return { walletBalance: 0, bonusBalance: 0, totalAvailable: 0 };
    try {
      const info = await apiClient.get('/wallet');
      const walletBalance = Number(info?.walletBalance || 0);
      return {
        walletBalance,
        bonusBalance: Number(info?.bonusBalance || 0),
        totalAvailable: Number(info?.totalAvailable ?? walletBalance),
      };
    } catch (error) {
      console.warn('[WalletService] Failed to load wallet info:', error);
      return { walletBalance: 0, bonusBalance: 0, totalAvailable: 0 };
    }
  },

  /**
   * List Wallet Transactions for the authenticated customer (via BE).
   */
  async listTransactions(customerId) {
    if (!customerId) return { data: [] };
    try {
      return await apiClient.get('/wallet/transactions');
    } catch (error) {
      console.warn('[WalletService] Failed to fetch wallet transactions:', error);
      return { data: [] };
    }
  },

  /**
   * Bonus balance removed - returns 0
   */
  calculateBonus() {
    return 0;
  },

  /**
   * Initiates a Wallet Top-up request. The BE signs the PayOS request with the
   * server-side checksum key and records the pending deposit.
   */
  async createTopupRequest({ customerId, amount, customerName = '' }) {
    if (!customerId) throw new Error('Cần thông tin Khách hàng để nạp ví.');
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount < 10000) {
      throw new Error('Số tiền nạp tối thiểu là 10.000 đ.');
    }

    const result = await apiClient.post('/wallet/topup', {
      amount: numericAmount,
      customerName,
      returnUrl: window.location.href,
      cancelUrl: window.location.href,
    });

    return {
      ...result,
      bonusAmount: 0,
      totalReceived: numericAmount,
    };
  },

  /**
   * DEV ONLY: credits the wallet instantly without going through PayOS.
   * Backed by POST /wallet/dev/credit (blocked in production on the BE).
   * Dùng để test nhanh luồng nạp tiền → mua gói Kiosk.
   */
  async devCredit(amount) {
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount < 1) {
      throw new Error('Số tiền nạp (dev) không hợp lệ.');
    }
    return await apiClient.post('/wallet/dev/credit', { amount: numericAmount });
  },

  /**
   * Polls the backend for a topup's payment status (server re-checks PayOS).
   */
  async checkTopupStatus(orderCode) {
    if (!orderCode) return { isPaid: false, status: 'PENDING' };
    try {
      return await apiClient.get(`/wallet/payment-status/${orderCode}`);
    } catch (error) {
      console.warn('[WalletService] Failed to check topup status:', error);
      return { isPaid: false, status: 'PENDING' };
    }
  },

  /**
   * Confirms a pending deposit. The BE re-verifies payment with PayOS and
   * credits the wallet idempotently using the server-recorded amount.
   */
  async confirmDeposit({ orderCode }) {
    if (!orderCode) throw new Error('Thiếu mã đơn nạp.');
    return await apiClient.post(`/wallet/confirm/${orderCode}`);
  },

  /**
   * Voids a pending deposit on PayOS when the user abandons the QR screen.
   * Best-effort (fire-and-forget from the UI): never throws, so leaving the
   * modal is never blocked by a network hiccup.
   */
  async cancelDeposit({ orderCode }) {
    if (!orderCode) return { cancelled: false };
    try {
      return await apiClient.post(`/wallet/cancel/${orderCode}`);
    } catch {
      return { cancelled: false };
    }
  },

  /**
   * Deducts funds from customer wallet balance for payment/task
   */
  async payWithWallet({ customerId, amount, description }) {
    const numericAmount = Number(amount);
    if (!customerId || isNaN(numericAmount) || numericAmount <= 0) {
      throw new Error('Thông tin thanh toán không hợp lệ.');
    }

    const walletInfo = await WalletService.getWalletInfo(customerId);
    if (walletInfo.totalAvailable < numericAmount) {
      throw new Error(`Số dư Ví Ảo không đủ (Số dư: ${walletInfo.totalAvailable.toLocaleString()} đ, Cần: ${numericAmount.toLocaleString()} đ). Vui lòng nạp thêm!`);
    }

    const supabase = requireSupabaseClient();
    if (!supabase) throw new Error('Chưa kết nối Supabase client.');

    // Deduct from wallet_balance
    const newWalletBalance = walletInfo.walletBalance - numericAmount;

    await runQuery(
      supabase
        .from('customers')
        .update({
          wallet_balance: Math.max(0, newWalletBalance),
        })
        .eq('id', customerId),
    );

    // Record payment transaction
    await supabase.from('wallet_transactions').insert([{
      customer_id: customerId,
      transaction_type: 'payment',
      amount: -numericAmount,
      bonus_amount: 0,
      payment_method: 'wallet',
      status: 'completed',
      description: description || 'Thanh toán qua Ví Ảo KioskHub',
    }]);

    return { success: true, newBalance: newWalletBalance };
  },

  /**
   * Adds reward funds to customer wallet when completing tasks
   */
  async rewardWorkerWallet({ workerId, amount, description }) {
    const numericAmount = Number(amount);
    if (!workerId || isNaN(numericAmount) || numericAmount <= 0) {
      throw new Error('Thông tin trả thưởng không hợp lệ.');
    }

    const walletInfo = await WalletService.getWalletInfo(workerId);
    const supabase = requireSupabaseClient();
    if (!supabase) throw new Error('Chưa kết nối Supabase client.');

    const newWalletBalance = walletInfo.walletBalance + numericAmount;

    await runQuery(
      supabase
        .from('customers')
        .update({
          wallet_balance: newWalletBalance,
        })
        .eq('id', workerId),
    );

    await supabase.from('wallet_transactions').insert([{
      customer_id: workerId,
      transaction_type: 'reward',
      amount: numericAmount,
      bonus_amount: 0,
      payment_method: 'wallet',
      status: 'completed',
      description: description || 'Nhận thưởng nhiệm vụ tương tác',
    }]);

    return { success: true, newBalance: newWalletBalance };
  },
};
