import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Phương thức không được hỗ trợ' }), {
      status: 405,
      headers,
    });
  }

  try {
    const clientId = Deno.env.get('PAYOS_CLIENT_ID') || '';
    const apiKey = Deno.env.get('PAYOS_API_KEY') || '';
    const checksumKey = Deno.env.get('PAYOS_CHECKSUM_KEY') || '';
    const apiEndpoint = Deno.env.get('PAYOS_API_ENDPOINT') || 'https://api-merchant.payos.vn/v2';

    if (!clientId || !apiKey || !checksumKey) {
      return new Response(
        JSON.stringify({
          error: 'Chưa cấu hình biến môi trường PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY trong Supabase Secrets.',
        }),
        { status: 500, headers },
      );
    }

    const body = await req.json();
    const { action } = body;

    // ACTION 1: Khởi tạo liên kết thanh toán PayOS
    if (action === 'create_link') {
      const { amount, description, orderCode, cancelUrl, returnUrl, buyerName } = body;
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

      const signature = await calculateHmacSha256(payload, checksumKey);

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
        return new Response(
          JSON.stringify({
            success: true,
            orderCode: normalizedOrderCode,
            checkoutUrl: result.data.checkoutUrl,
            qrCode: result.data.qrCode,
            accountNo: result.data.accountNumber || '',
            accountName: result.data.accountName || '',
            amount: payload.amount,
            description: cleanDescription,
          }),
          { status: 200, headers },
        );
      }

      return new Response(
        JSON.stringify({
          error: result.desc || result.message || 'Không thể tạo đơn PayOS',
        }),
        { status: 400, headers },
      );
    }

    // ACTION 2: Kiểm tra trạng thái đơn hàng PayOS
    if (action === 'check_status') {
      const { orderCode } = body;
      if (!orderCode) {
        return new Response(JSON.stringify({ error: 'Thiếu orderCode' }), { status: 400, headers });
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
          return new Response(
            JSON.stringify({
              success: true,
              status: result.data.status,
              isPaid: result.data.status === 'PAID',
              amount: result.data.amount,
              amountPaid: result.data.amountPaid,
            }),
            { status: 200, headers },
          );
        }
      }

      return new Response(
        JSON.stringify({ success: false, status: 'PENDING', isPaid: false }),
        { status: 200, headers },
      );
    }

    return new Response(JSON.stringify({ error: 'Action không hợp lệ' }), { status: 400, headers });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Lỗi xử lý hệ thống' }),
      { status: 500, headers },
    );
  }
});

function generateOrderCode(): number {
  const timestampStr = Date.now().toString().slice(-9);
  const randomStr = Math.floor(100 + Math.random() * 900).toString();
  return parseInt(timestampStr + randomStr, 10);
}

async function calculateHmacSha256(data: Record<string, any>, checksumKey: string): Promise<string> {
  const sortedKeys = Object.keys(data).sort();
  const signatureData = sortedKeys.map((key) => `${key}=${data[key] ?? ''}`).join('&');

  const encoder = new TextEncoder();
  const keyData = encoder.encode(checksumKey);
  const msgData = encoder.encode(signatureData);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
