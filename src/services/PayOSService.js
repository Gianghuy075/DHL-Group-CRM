import { PAYOS_CONFIG, calculatePayOSSignature } from '../constants/payos.js';

export const PayOSService = {
  /**
   * Generates a unique numeric order code for PayOS (max 15 digits integer)
   */
  generateOrderCode() {
    // Generate order code based on timestamp + 3 random digits
    const timestampStr = Date.now().toString().slice(-9);
    const randomStr = Math.floor(100 + Math.random() * 900).toString();
    return parseInt(timestampStr + randomStr, 10);
  },

  /**
   * Creates a PayOS Payment Request or fallback VietQR URL
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
      amount: Number(amount),
      cancelUrl,
      description: cleanDescription,
      orderCode: normalizedOrderCode,
      returnUrl,
    };

    const signature = await calculatePayOSSignature(payload);

    // Build VietQR image fallback URL
    const vietQrUrl = `https://img.vietqr.io/image/${PAYOS_CONFIG.bankId}-${PAYOS_CONFIG.accountNo}-compact2.png?amount=${payload.amount}&addInfo=${encodeURIComponent(cleanDescription)}&accountName=${encodeURIComponent(PAYOS_CONFIG.accountName)}`;

    try {
      // Call PayOS Merchant API
      const response = await fetch(`${PAYOS_CONFIG.apiEndpoint}/payment-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': PAYOS_CONFIG.clientId,
          'x-api-key': PAYOS_CONFIG.apiKey,
        },
        body: JSON.stringify({
          ...payload,
          signature,
          buyerName: customerName || undefined,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.code === '00' && result.data) {
          return {
            success: true,
            orderCode: normalizedOrderCode,
            checkoutUrl: result.data.checkoutUrl,
            qrCode: result.data.qrCode || vietQrUrl,
            amount: payload.amount,
            description: cleanDescription,
            accountNo: result.data.accountNumber || PAYOS_CONFIG.accountNo,
            accountName: result.data.accountName || PAYOS_CONFIG.accountName,
            bankName: PAYOS_CONFIG.bankId,
          };
        }
      }
    } catch (error) {
      console.warn('[PayOSService] Direct PayOS API call failed or CORS blocked. Falling back to VietQR format:', error);
    }

    // Fallback if API fails or CORS blocks in client-only mode
    return {
      success: true,
      orderCode: normalizedOrderCode,
      checkoutUrl: vietQrUrl,
      qrCode: vietQrUrl,
      amount: payload.amount,
      description: cleanDescription,
      accountNo: PAYOS_CONFIG.accountNo,
      accountName: PAYOS_CONFIG.accountName,
      bankName: PAYOS_CONFIG.bankId,
      isFallback: true,
    };
  },

  /**
   * Checks status of a payment request from PayOS API
   */
  async checkPaymentStatus(orderCode) {
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
            status: result.data.status, // PAID, PENDING, CANCELLED, PROCESSING
            isPaid: result.data.status === 'PAID',
            amount: result.data.amount,
            amountPaid: result.data.amountPaid,
            data: result.data,
          };
        }
      }
    } catch (error) {
      console.warn(`[PayOSService] Failed to check status for orderCode ${orderCode}:`, error);
    }

    return {
      success: false,
      status: 'PENDING',
      isPaid: false,
    };
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
