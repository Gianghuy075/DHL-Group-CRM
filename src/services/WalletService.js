import { requireSupabaseClient, runQuery } from './BaseService.js';
import { PayOSService } from './PayOSService.js';

export const DEPOSIT_BONUS_TIERS = [
  { amount: 500000, bonus: 0, label: 'Nạp 500.000 đ' },
  { amount: 1000000, bonus: 0, label: 'Nạp 1.000.000 đ', recommended: true },
  { amount: 2000000, bonus: 0, label: 'Nạp 2.000.000 đ' },
  { amount: 5000000, bonus: 0, label: 'Nạp 5.000.000 đ' },
];

export const WalletService = {
  /**
   * Get Customer's Wallet Balance
   */
  async getWalletInfo(customerId) {
    if (!customerId) return { walletBalance: 0, bonusBalance: 0, totalAvailable: 0 };

    const supabase = requireSupabaseClient();
    if (!supabase) return { walletBalance: 0, bonusBalance: 0, totalAvailable: 0 };

    try {
      const { data: customer } = await runQuery(
        supabase
          .from('customers')
          .select('wallet_balance')
          .eq('id', customerId)
          .single(),
      );

      const walletBalance = Number(customer?.wallet_balance || 0);

      return {
        walletBalance,
        bonusBalance: 0,
        totalAvailable: walletBalance,
      };
    } catch (error) {
      console.warn('[WalletService] Failed to load wallet info:', error);
      return { walletBalance: 0, bonusBalance: 0, totalAvailable: 0 };
    }
  },

  /**
   * List Wallet Transactions for a customer
   */
  async listTransactions(customerId) {
    if (!customerId) return { data: [] };

    const supabase = requireSupabaseClient();
    if (!supabase) return { data: [] };

    try {
      return await runQuery(
        supabase
          .from('wallet_transactions')
          .select('*')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false }),
      );
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
   * Initiates a Wallet Top-up request via PayOS
   */
  async createTopupRequest({ customerId, amount, customerName = '' }) {
    if (!customerId) throw new Error('Cần thông tin Khách hàng để nạp ví.');
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount < 10000) {
      throw new Error('Số tiền nạp tối thiểu là 10.000 đ.');
    }

    const orderCode = PayOSService.generateOrderCode();
    const description = `NAP VI ${orderCode}`;

    const payosResult = await PayOSService.createPaymentLink({
      orderCode,
      amount: numericAmount,
      description,
      customerName,
    });

    // Save pending transaction to DB if Supabase client available
    const supabase = requireSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('wallet_transactions').insert([{
          customer_id: customerId,
          transaction_type: 'deposit',
          amount: numericAmount,
          bonus_amount: 0,
          order_code: orderCode,
          payment_method: 'payos',
          status: 'pending',
          description: `Nạp ví qua PayOS ${orderCode}`,
        }]);
      } catch (err) {
        console.warn('[WalletService] Could not record pending deposit transaction:', err);
      }
    }

    return {
      ...payosResult,
      bonusAmount: 0,
      totalReceived: numericAmount,
    };
  },

  /**
   * Confirms a pending deposit transaction & credits customer balance
   */
  async confirmDeposit({ customerId, orderCode, amount, description }) {
    const supabase = requireSupabaseClient();
    if (!supabase) throw new Error('Chưa kết nối Supabase client.');

    // Try RPC function process_wallet_deposit
    try {
      const { data, error } = await supabase.rpc('process_wallet_deposit', {
        p_customer_id: customerId,
        p_amount: Number(amount),
        p_bonus_amount: 0,
        p_order_code: Number(orderCode),
        p_description: description || `Nạp tiền qua PayOS ${orderCode}`,
      });

      if (!error && data?.success) {
        return data;
      }
    } catch (err) {
      console.warn('[WalletService] RPC process_wallet_deposit not available, running fallback:', err);
    }

    // Direct fallback table update
    const walletInfo = await WalletService.getWalletInfo(customerId);
    const newWalletBalance = walletInfo.walletBalance + Number(amount);

    await runQuery(
      supabase
        .from('customers')
        .update({
          wallet_balance: newWalletBalance,
        })
        .eq('id', customerId),
    );

    // Update or insert transaction record
    if (orderCode) {
      await supabase
        .from('wallet_transactions')
        .update({ status: 'completed' })
        .eq('order_code', orderCode);
    } else {
      await supabase.from('wallet_transactions').insert([{
        customer_id: customerId,
        transaction_type: 'deposit',
        amount: Number(amount),
        bonus_amount: 0,
        payment_method: 'payos',
        status: 'completed',
        description: description || 'Nạp ví ảo thành công',
      }]);
    }

    return { success: true, newBalance: newWalletBalance };
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
