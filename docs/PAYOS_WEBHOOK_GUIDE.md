# Hướng Dẫn Tích Hợp Webhook PayOS Cho DHL Group CRM & Ví Ảo

Tài liệu hướng dẫn cấu hình và triển khai Webhook PayOS cho dự án DHL Group CRM (tự động nhận thanh toán Kiosk và nạp Ví Ảo).

---

## 1. Thông Tin Cấu Hình PayOS

- **Client ID**: `9cf9982b-46e0-44df-a7b3-c43a27303bb0`
- **API Key**: `eed33900-3e06-4963-835e-968dbc8aec18`
- **Checksum Key**: `eed33900-3e06-4963-835e-968dbc8aec18`
- **Domain Deploy**: `https://nguyenthanhhan888.github.io/DHL-Group-CRM/#/login`
- **Tài liệu tham khảo**: [https://payos.vn/docs/du-lieu-tra-ve/webhook/](https://payos.vn/docs/du-lieu-tra-ve/webhook/)

---

## 2. Cấu Trúc Dữ Liệu Webhook PayOS Trả Về

Khi có giao dịch chuyển khoản thành công, PayOS gửi một thông báo `POST` đến Webhook URL:

```json
{
  "code": "00",
  "desc": "success",
  "data": {
    "orderCode": 123456789,
    "amount": 1000000,
    "description": "NAP VI 123456789",
    "accountNumber": "088812102004",
    "reference": "FT2401010001",
    "transactionDateTime": "2026-07-23 11:34:00",
    "paymentLinkId": "pl_123456",
    "code": "00",
    "responseCode": "00"
  },
  "signature": "a1b2c3d4..."
}
```

---

## 3. Mã Nguồn Mẫu Supabase Edge Function (Node.js/Deno)

Lưu file tại `supabase/functions/payos-webhook/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const CHECKSUM_KEY = "eed33900-3e06-4963-835e-968dbc8aec18";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 455 });
  }

  try {
    const payload = await req.json();
    const { data, signature } = payload;

    if (!data || !signature) {
      return new Response("Invalid payload", { status: 400 });
    }

    // Verify Signature HMAC SHA-256
    const sortedData = Object.keys(data)
      .sort()
      .map((key) => `${key}=${data[key] ?? ''}`)
      .join('&');

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(CHECKSUM_KEY),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(sortedData));
    const calculatedSig = Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (calculatedSig !== signature) {
      return new Response("Signature verification failed", { status: 400 });
    }

    // Connect Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const orderCode = data.orderCode;
    const amount = data.amount;
    const description = data.description || "";

    // 1. Kiểm tra nếu giao dịch là nạp ví (NAP VI)
    const { data: tx } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("order_code", orderCode)
      .single();

    if (tx && tx.status === "pending") {
      await supabase.rpc("process_wallet_deposit", {
        p_customer_id: tx.customer_id,
        p_amount: tx.amount,
        p_bonus_amount: tx.bonus_amount,
        p_order_code: orderCode,
        p_description: `PayOS Webhook Nạp Ví ${orderCode}`
      });

      return new Response(JSON.stringify({ success: true, message: "Wallet credited" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Kiểm tra nếu là thanh toán đơn Kiosk trực tiếp
    const { data: payment } = await supabase
      .from("payments")
      .select("*")
      .eq("payment_status", "pending")
      .single();

    if (payment) {
      await supabase
        .from("payments")
        .update({ payment_status: "completed", updated_at: new Date() })
        .eq("id", payment.id);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
```

---

## 4. Hướng Dẫn Kích Hoạt Trên Kênh Quản Trị PayOS

1. Đăng nhập vào trang quản trị PayOS: [https://my.payos.vn/](https://my.payos.vn/)
2. Chọn kênh thanh toán đã tạo với Client ID `9cf9982b-46e0-44df-a7b3-c43a27303bb0`.
3. Vào mục **Cấu hình Webhook**.
4. Dán URL Webhook của bạn (ví dụ: `https://<YOUR_SUPABASE_PROJECT>.supabase.co/functions/v1/payos-webhook`).
5. Nhấn **Xác nhận & Kiểm tra Webhook**.
