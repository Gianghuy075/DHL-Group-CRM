import { requireSupabaseClient, runQuery } from './BaseService.js';
import { PayOSService } from './PayOSService.js';

export const DEPOSIT_BONUS_TIERS = [
  { amount: 500000, bonus: 50000, label: 'Nạp 500.000 đ', badge: '+50k Thưởng (10%)' },
  { amount: 1000000, bonus: 150000, label: 'Nạp 1.000.000 đ', badge: '+150k Thưởng (15%)', recommended: true },
  { amount: 2000000, bonus: 400000, label: 'Nạp 2.000.000 đ', badge: '+400k Thưởng (20%)' },
  { amount: 5000000, bonus: 1200000, label: 'Nạp 5.000.000 đ', badge: '+1.2M Thưởng (24%)' },
];

export const WalletService = {
  /**
   * Get Customer's Wallet Balance and Bonus Balance
   */
  async getWalletInfo(customerId) {
    if (!customerId) return { walletBalance: 0, bonusBalance: 0, totalAvailable: 0 };

    const supabase = requireSupabaseClient();
    if (!supabase) return { walletBalance: 0, bonusBalance: 0, totalAvailable: 0 };

    try {
      const { data: customer } = await runQuery(
        supabase
          .from('customers')
          .select('wallet_balance, bonus_balance')
          .eq('id', customerId)
          .single(),
      );

      const walletBalance = Number(customer?.wallet_balance || 0);
      const bonusBalance = Number(customer?.bonus_balance || 0);

      return {
        walletBalance,
        bonusBalance,
        totalAvailable: walletBalance + bonusBalance,
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
   * Calculate bonus for a given deposit amount
   */
  calculateBonus(amount) {
    const numericAmount = Number(amount || 0);
    const tier = DEPOSIT_BONUS_TIERS.find((t) => t.amount === numericAmount);
    if (tier) return tier.bonus;

    // Default tiered bonus for custom amount
    if (numericAmount >= 5000000) return Math.floor(numericAmount * 0.24);
    if (numericAmount >= 2000000) return Math.floor(numericAmount * 0.20);
    if (numericAmount >= 1000000) return Math.floor(numericAmount * 0.15);
    if (numericAmount >= 500000) return Math.floor(numericAmount * 0.10);
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

    const bonusAmount = WalletService.calculateBonus(numericAmount);
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
          bonus_amount: bonusAmount,
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
      bonusAmount,
      totalReceived: numericAmount + bonusAmount,
    };
  },

  /**
   * Confirms a pending deposit transaction & credits customer balance
   */
  async confirmDeposit({ customerId, orderCode, amount, bonusAmount, description }) {
    const supabase = requireSupabaseClient();
    if (!supabase) throw new Error('Chưa kết nối Supabase client.');

    // Try RPC function process_wallet_deposit
    try {
      const { data, error } = await supabase.rpc('process_wallet_deposit', {
        p_customer_id: customerId,
        p_amount: Number(amount),
        p_bonus_amount: Number(bonusAmount || 0),
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
    const newBonusBalance = walletInfo.bonusBalance + Number(bonusAmount || 0);

    await runQuery(
      supabase
        .from('customers')
        .update({
          wallet_balance: newWalletBalance,
          bonus_balance: newBonusBalance,
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
        bonus_amount: Number(bonusAmount || 0),
        status: 'completed',
        description: description || 'Nạp ví ảo qua PayOS',
      }]);
    }

    return {
      success: true,
      wallet_balance: newWalletBalance,
      bonus_balance: newBonusBalance,
    };
  },

  /**
   * Pay for service using Wallet Balance
   */
  async payWithWallet({ customerId, amount, description }) {
    if (!customerId) throw new Error('Khách hàng không hợp lệ.');
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw new Error('Số tiền thanh toán không hợp lệ.');
    }

    const supabase = requireSupabaseClient();
    if (!supabase) throw new Error('Chưa kết nối Supabase.');

    // Try RPC function pay_via_wallet
    try {
      const { data, error } = await supabase.rpc('pay_via_wallet', {
        p_customer_id: customerId,
        p_amount: numericAmount,
        p_description: description || 'Thanh toán dịch vụ bằng Ví Ảo',
      });

      if (!error && data?.success) {
        return data;
      }
    } catch (err) {
      console.warn('[WalletService] RPC pay_via_wallet error, running direct fallback:', err);
    }

    // Fallback direct check & deduction
    const { walletBalance, bonusBalance, totalAvailable } = await WalletService.getWalletInfo(customerId);
    if (totalAvailable < numericAmount) {
      throw new Error(`Số dư ví không đủ (Hiện có: ${totalAvailable.toLocaleString('vi-VN')} đ, Cần: ${numericAmount.toLocaleString('vi-VN')} đ). Vui lòng nạp thêm tiền vào ví.`);
    }

    let deductMain = 0;
    let deductBonus = 0;
    if (walletBalance >= numericAmount) {
      deductMain = numericAmount;
    } else {
      deductMain = walletBalance;
      deductBonus = numericAmount - walletBalance;
    }

    const newWalletBalance = walletBalance - deductMain;
    const newBonusBalance = bonusBalance - deductBonus;

    await runQuery(
      supabase
        .from('customers')
        .update({
          wallet_balance: newWalletBalance,
          bonus_balance: newBonusBalance,
        })
        .eq('id', customerId),
    );

    await supabase.from('wallet_transactions').insert([{
      customer_id: customerId,
      transaction_type: 'spending',
      amount: -numericAmount,
      status: 'completed',
      description: description || 'Thanh toán bằng Ví Ảo',
    }]);

    return {
      success: true,
      remaining_wallet_balance: newWalletBalance,
      remaining_bonus_balance: newBonusBalance,
    };
  },
};
