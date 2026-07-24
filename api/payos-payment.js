const crypto = require('crypto');

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Phương thức không được hỗ trợ' });
  }

  try {
    // Đọc biến môi trường từ Vercel Environment Variables hoặc dùng key đầy đủ 64 ký tự
    const clientId = String(process.env.PAYOS_CLIENT_ID || '9cf9982b-46e0-44df-a7b3-c43a27303bb0').trim();
    const apiKey = String(process.env.PAYOS_API_KEY || 'eed33900-3e06-4963-835e-968dbc8aec18').trim();
    const checksumKey = String(process.env.PAYOS_CHECKSUM_KEY || 'da9ff359d5a66c705e7e5f94fb90719c327d983ce91f831fe7ef1c1b688dc143').trim().replace(/^["']|["']$/g, '');
    const apiEndpoint = String(process.env.PAYOS_API_ENDPOINT || 'https://api-merchant.payos.vn/v2').trim();

    const { action } = req.body || {};

    // ACTION 1: Tạo liên kết nạp tiền PayOS
    if (action === 'create_link') {
      const { amount, description, orderCode, cancelUrl, returnUrl, buyerName } = req.body;
      const normalizedOrderCode = Number(orderCode) || generateOrderCode();
      const cleanDescription = (description || `DHL${normalizedOrderCode}`)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .slice(0, 25);

      const payload = {
        amount: Number(amount),
        cancelUrl: cancelUrl || 'https://kiosk.dhl-group.com',
        description: cleanDescription,
        orderCode: normalizedOrderCode,
        returnUrl: returnUrl || 'https://kiosk.dhl-group.com',
      };

      const signature = calculateHmacSha256(payload, checksumKey);

      const response = await fetch(`${apiEndpoint}/payment-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': clientId,
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          ...payload,
          signature,
          buyerName: buyerName || undefined,
        }),
      });

      const result = await response.json();
      if (response.ok && result.code === '00' && result.data) {
        return res.status(200).json({
          success: true,
          orderCode: normalizedOrderCode,
          checkoutUrl: result.data.checkoutUrl,
          qrCode: result.data.qrCode,
          accountNo: result.data.accountNumber || '',
          accountName: result.data.accountName || '',
          amount: payload.amount,
          description: cleanDescription,
        });
      }

      return res.status(400).json({
        error: result.desc || result.message || 'Không thể tạo đơn PayOS',
      });
    }

    // ACTION 2: Kiểm tra trạng thái đơn nạp PayOS
    if (action === 'check_status') {
      const { orderCode } = req.body;
      if (!orderCode) {
        return res.status(400).json({ error: 'Thiếu orderCode' });
      }

      const response = await fetch(`${apiEndpoint}/payment-requests/${orderCode}`, {
        method: 'GET',
        headers: {
          'x-client-id': clientId,
          'x-api-key': apiKey,
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.code === '00' && result.data) {
          return res.status(200).json({
            success: true,
            status: result.data.status,
            isPaid: result.data.status === 'PAID',
            amount: result.data.amount,
            amountPaid: result.data.amountPaid,
          });
        }
      }

      return res.status(200).json({ success: false, status: 'PENDING', isPaid: false });
    }

    return res.status(400).json({ error: 'Action không hợp lệ' });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Lỗi xử lý máy chủ' });
  }
};

function generateOrderCode() {
  const timestampStr = Date.now().toString().slice(-9);
  const randomStr = Math.floor(100 + Math.random() * 900).toString();
  return parseInt(timestampStr + randomStr, 10);
}

function calculateHmacSha256(data, checksumKey) {
  const sortedKeys = Object.keys(data).sort();
  const signatureData = sortedKeys.map((key) => `${key}=${data[key] ?? ''}`).join('&');
  return crypto.createHmac('sha256', checksumKey).update(signatureData).digest('hex');
}
