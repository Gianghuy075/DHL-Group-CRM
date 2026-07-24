import { PAYOS_CONFIG, calculatePayOSSignature } from '../constants/payos.js';
import { getSupabaseClient } from '../supabase/client.js';

export const PayOSService = {
  /**
   * Generates a unique numeric order code for PayOS (max 15 digits integer)
   */
  generateOrderCode() {
    const timestampStr = Date.now().toString().slice(-9);
    const randomStr = Math.floor(100 + Math.random() * 900).toString();
    return parseInt(timestampStr + randomStr, 10);
  },

  /**
   * Creates a PayOS Payment Request via Vercel API / Supabase Edge Function / Client fallback
   */
  async createPaymentLink({
    orderCode,
    amount,
    description,
    returnUrl = window.location.href,
    cancelUrl = window.location.href,
    customerName = '',
  }) {
    const normalizedOrderCode = orderCode || PayOSService.generateOrderCode();
    const cleanDescription = (description || `DHL${normalizedOrderCode}`)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .slice(0, 25);

    const payload = {
      action: 'create_link',
      amount: Number(amount),
      cancelUrl,
      description: cleanDescription,
      orderCode: normalizedOrderCode,
      returnUrl,
      buyerName: customerName || undefined,
    };

    // 1. Thử gọi Vercel Serverless Function (/api/payos-payment) nếu chạy trên Vercel
    try {
      const vercelRes = await fetch('/api/payos-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (vercelRes.ok) {
        const vercelData = await vercelRes.json();
        if (vercelData.success) {
          return {
            success: true,
            orderCode: vercelData.orderCode || normalizedOrderCode,
            checkoutUrl: vercelData.checkoutUrl,
            qrCode: vercelData.qrCode,
            accountNo: vercelData.accountNo || '',
            accountName: vercelData.accountName || '',
            amount: payload.amount,
            description: cleanDescription,
            viaVercel: true,
          };
        }
      }
    } catch (vErr) {
      // Bỏ qua nếu không chạy trên Vercel
    }

    // 2. Thử gọi Supabase Edge Function nếu đã deploy
    const supabase = getSupabaseClient();
    if (supabase?.functions) {
      try {
        const { data, error } = await supabase.functions.invoke('payos-payment', {
          body: payload,
        });

        if (!error && data?.success) {
          return {
            success: true,
            orderCode: data.orderCode || normalizedOrderCode,
            checkoutUrl: data.checkoutUrl,
            qrCode: data.qrCode,
            accountNo: data.accountNo || '',
            accountName: data.accountName || '',
            amount: payload.amount,
            description: cleanDescription,
            viaEdgeFunction: true,
          };
        }
      } catch (edgeErr) {
        console.warn('[PayOSService] Edge function invoke failed:', edgeErr);
      }
    }

    // 3. Fallback client side nếu cài ở window.DHL_CONFIG.payos
    if (!PAYOS_CONFIG.clientId || !PAYOS_CONFIG.apiKey) {
      throw new Error('Chưa cấu hình biến môi trường PAYOS_CLIENT_ID, PAYOS_API_KEY trên Vercel Environment Variables.');
    }

    const signature = await calculatePayOSSignature({
      amount: payload.amount,
      cancelUrl: payload.cancelUrl,
      description: payload.description,
      orderCode: payload.orderCode,
      returnUrl: payload.returnUrl,
    });

    const response = await fetch(`${PAYOS_CONFIG.apiEndpoint}/payment-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': PAYOS_CONFIG.clientId,
        'x-api-key': PAYOS_CONFIG.apiKey,
      },
      body: JSON.stringify({
        amount: payload.amount,
        cancelUrl: payload.cancelUrl,
        description: payload.description,
        orderCode: payload.orderCode,
        returnUrl: payload.returnUrl,
        signature,
        buyerName: customerName || undefined,
      }),
    });

    const result = await response.json();
    if (response.ok && result.code === '00' && result.data) {
      return {
        success: true,
        orderCode: normalizedOrderCode,
        checkoutUrl: result.data.checkoutUrl,
        qrCode: result.data.qrCode || `https://qr.payos.vn/${PAYOS_CONFIG.clientId}/${normalizedOrderCode}/${payload.amount}`,
        amount: payload.amount,
        description: cleanDescription,
        accountNo: result.data.accountNumber || '',
        accountName: result.data.accountName || '',
        bin: result.data.bin || '',
      };
    }

    throw new Error(result.desc || result.message || 'Không thể tạo đơn PayOS');
  },

  /**
   * Checks status of a payment request via Vercel API / Edge Function / Direct
   */
  async checkPaymentStatus(orderCode) {
    if (!orderCode) return { success: false, status: 'PENDING', isPaid: false };

    // 1. Thử Vercel Serverless API
    try {
      const vercelRes = await fetch('/api/payos-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_status', orderCode }),
      });

      if (vercelRes.ok) {
        const vercelData = await vercelRes.json();
        if (vercelData.success) {
          return {
            success: true,
            status: vercelData.status,
            isPaid: Boolean(vercelData.isPaid),
            amount: vercelData.amount,
            amountPaid: vercelData.amountPaid,
          };
        }
      }
    } catch (vErr) {}

    // 2. Thử Supabase Edge Function
    const supabase = getSupabaseClient();
    if (supabase?.functions) {
      try {
        const { data, error } = await supabase.functions.invoke('payos-payment', {
          body: { action: 'check_status', orderCode },
        });

        if (!error && data?.success) {
          return {
            success: true,
            status: data.status,
            isPaid: Boolean(data.isPaid),
            amount: data.amount,
            amountPaid: data.amountPaid,
          };
        }
      } catch (err) {}
    }

    // 3. Fallback direct client
    if (!PAYOS_CONFIG.clientId || !PAYOS_CONFIG.apiKey) {
      return { success: false, status: 'PENDING', isPaid: false };
    }

    try {
      const response = await fetch(`${PAYOS_CONFIG.apiEndpoint}/payment-requests/${orderCode}`, {
        method: 'GET',
        headers: {
          'x-client-id': PAYOS_CONFIG.clientId,
          'x-api-key': PAYOS_CONFIG.apiKey,
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.code === '00' && result.data) {
          return {
            success: true,
            status: result.data.status,
            isPaid: result.data.status === 'PAID',
            amount: result.data.amount,
            amountPaid: result.data.amountPaid,
            data: result.data,
          };
        }
      }
    } catch (error) {}

    return { success: false, status: 'PENDING', isPaid: false };
  },

  /**
   * Verifies Webhook Data Signature received from PayOS
   */
  async verifyWebhookData(webhookPayload) {
    if (!webhookPayload?.data || !webhookPayload?.signature) {
      return false;
    }

    const calculatedSig = await calculatePayOSSignature(
      webhookPayload.data,
      PAYOS_CONFIG.checksumKey,
    );

    return calculatedSig === webhookPayload.signature;
  },
};
