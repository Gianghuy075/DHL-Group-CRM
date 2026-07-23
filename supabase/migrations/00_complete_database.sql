-- ============================================================================
-- DHL-GROUP-CRM KIOSK MANAGEMENT - COMPLETE DATABASE SCHEMA
-- Supabase PostgreSQL - Chạy toàn bộ file này 1 lần trong SQL Editor
-- ============================================================================

-- ==========================================================================
-- 1. BẢNG: categories (Danh mục)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    sort_order INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ==========================================================================
-- 2. BẢNG: business_types (Loại hình kinh doanh)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.business_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    price_per_month NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    sort_order INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_business_types_category ON public.business_types(category_id);

-- ==========================================================================
-- 3. BẢNG: customers (Khách hàng)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    facebook_name VARCHAR(255),
    facebook_id VARCHAR(100),
    facebook_link TEXT,
    facebook_group_link TEXT,
    phone VARCHAR(20),
    address TEXT,
    status VARCHAR(20) DEFAULT 'potential' NOT NULL,
    note TEXT,
    total_paid NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    total_kiosks INT DEFAULT 0 NOT NULL,
    -- Ví Ảo KioskHub
    wallet_balance NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    bonus_balance NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    -- Xác thực Facebook Graph API
    facebook_verified BOOLEAN DEFAULT FALSE NOT NULL,
    facebook_verified_at TIMESTAMPTZ,
    friend_count INT DEFAULT 0 NOT NULL,
    follower_count INT DEFAULT 0 NOT NULL,
    is_public_profile BOOLEAN DEFAULT FALSE NOT NULL,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_fb_verified ON public.customers(facebook_verified);

-- ==========================================================================
-- 4. BẢNG: kiosks (Kiosk)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.kiosks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    facebook_name VARCHAR(255),
    facebook_id VARCHAR(100),
    facebook_link TEXT,
    facebook_group_link TEXT,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    business_type_id UUID REFERENCES public.business_types(id) ON DELETE SET NULL,
    start_date DATE,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    auto_approve BOOLEAN DEFAULT FALSE NOT NULL,
    total_paid NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kiosks_customer ON public.kiosks(customer_id);
CREATE INDEX IF NOT EXISTS idx_kiosks_status ON public.kiosks(status);
CREATE INDEX IF NOT EXISTS idx_kiosks_end_date ON public.kiosks(end_date);
CREATE INDEX IF NOT EXISTS idx_kiosks_business_type ON public.kiosks(business_type_id);

-- ==========================================================================
-- 5. BẢNG: payments (Thanh toán Kiosk)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    kiosk_id UUID REFERENCES public.kiosks(id) ON DELETE CASCADE,
    start_date DATE,
    end_date DATE,
    months INT DEFAULT 1 NOT NULL,
    price_per_month NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    discount NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    discount_reason TEXT,
    total_amount NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    payment_method VARCHAR(30) DEFAULT 'transfer',
    payment_status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    confirmed_by TEXT,
    confirmed_at TIMESTAMPTZ,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_customer ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_kiosk ON public.payments(kiosk_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(payment_status);

-- ==========================================================================
-- 6. BẢNG: logs (Lịch sử thay đổi hệ thống)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_action ON public.logs(action);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON public.logs(created_at);

-- ==========================================================================
-- 7. BẢNG: user_roles (Phân quyền người dùng)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    role VARCHAR(30) DEFAULT 'user' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);

-- ==========================================================================
-- 8. BẢNG: wallet_transactions (Lịch sử Ví Ảo KioskHub)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('deposit', 'spending', 'bonus', 'refund')),
    amount NUMERIC(15, 2) NOT NULL,
    bonus_amount NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    order_code BIGINT UNIQUE,
    payment_method VARCHAR(30) DEFAULT 'payos',
    status VARCHAR(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    description TEXT,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_customer ON public.wallet_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_order_code ON public.wallet_transactions(order_code);

-- ==========================================================================
-- 9. BẢNG: facebook_tasks (9 Dịch vụ Tương tác Chéo Facebook)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.facebook_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creator_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    task_type VARCHAR(30) NOT NULL CHECK (task_type IN (
        'like_post', 'like_high_val', 'like_multi', 'like_page',
        'reaction_post', 'reaction_comment', 'follow_profile',
        'share_post', 'join_group'
    )),
    post_url TEXT NOT NULL,
    facebook_target_id VARCHAR(100),
    target_quantity INT NOT NULL CHECK (target_quantity > 0),
    completed_quantity INT DEFAULT 0 NOT NULL,
    unit_price NUMERIC(15, 2) NOT NULL CHECK (unit_price > 0),
    total_cost NUMERIC(15, 2) NOT NULL CHECK (total_cost > 0),
    status VARCHAR(20) DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'completed', 'cancelled', 'rejected_by_admin')),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_facebook_tasks_status ON public.facebook_tasks(status);
CREATE INDEX IF NOT EXISTS idx_facebook_tasks_creator ON public.facebook_tasks(creator_id);

-- ==========================================================================
-- 10. BẢNG: task_submissions (Bằng chứng làm nhiệm vụ chéo)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.task_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES public.facebook_tasks(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    proof_image_url TEXT,
    proof_data JSONB,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    reward_amount NUMERIC(15, 2) NOT NULL CHECK (reward_amount > 0),
    verified_via_api BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_submissions_task ON public.task_submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_worker ON public.task_submissions(worker_id);


-- ============================================================================
-- STORED PROCEDURES (RPC Functions)
-- ============================================================================

-- ==========================================================================
-- RPC 1: confirm_payment — Xác nhận thanh toán Kiosk
-- ==========================================================================
CREATE OR REPLACE FUNCTION confirm_payment(payment_id_input UUID)
RETURNS VOID AS $$
DECLARE
    v_payment RECORD;
BEGIN
    SELECT * INTO v_payment
    FROM public.payments
    WHERE id = payment_id_input AND payment_status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy thanh toán chờ duyệt.';
    END IF;

    -- Update payment status
    UPDATE public.payments
    SET payment_status = 'completed',
        confirmed_at = NOW(),
        updated_at = NOW()
    WHERE id = payment_id_input;

    -- Activate Kiosk
    UPDATE public.kiosks
    SET status = 'active',
        start_date = COALESCE(v_payment.start_date, CURRENT_DATE),
        end_date = COALESCE(v_payment.end_date, CURRENT_DATE + INTERVAL '1 month'),
        total_paid = COALESCE(total_paid, 0) + v_payment.total_amount,
        updated_at = NOW()
    WHERE id = v_payment.kiosk_id;

    -- Update customer
    UPDATE public.customers
    SET status = 'active',
        total_paid = COALESCE(total_paid, 0) + v_payment.total_amount,
        updated_at = NOW()
    WHERE id = v_payment.customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================================================
-- RPC 2: submit_registration_request — Đăng ký trực tuyến (Tạo Customer + Kiosk + Payment)
-- ==========================================================================
CREATE OR REPLACE FUNCTION submit_registration_request(
    facebook_name_input TEXT,
    phone_input TEXT,
    facebook_id_input TEXT DEFAULT NULL,
    facebook_link_input TEXT DEFAULT NULL,
    address_input TEXT DEFAULT NULL,
    note_input TEXT DEFAULT NULL,
    category_id_input UUID DEFAULT NULL,
    business_type_id_input UUID DEFAULT NULL,
    months_input INT DEFAULT 1,
    discount_input NUMERIC DEFAULT 0,
    discount_reason_input TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_customer_id UUID;
    v_kiosk_id UUID;
    v_payment_id UUID;
    v_business_type RECORD;
    v_start_date DATE;
    v_end_date DATE;
    v_subtotal NUMERIC;
    v_total_amount NUMERIC;
BEGIN
    -- Get business type
    SELECT * INTO v_business_type
    FROM public.business_types
    WHERE id = business_type_id_input AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Loại hình kinh doanh không hợp lệ.';
    END IF;

    -- Calculate dates and amounts
    v_start_date := CURRENT_DATE;
    v_end_date := CURRENT_DATE + (months_input || ' months')::INTERVAL;
    v_subtotal := v_business_type.price_per_month * months_input;
    v_total_amount := GREATEST(v_subtotal - COALESCE(discount_input, 0), 0);

    -- Create customer
    INSERT INTO public.customers (
        facebook_name, phone, facebook_id, facebook_link, address, note, status
    ) VALUES (
        facebook_name_input, phone_input, facebook_id_input, facebook_link_input,
        address_input, note_input, 'pending'
    ) RETURNING id INTO v_customer_id;

    -- Create kiosk
    INSERT INTO public.kiosks (
        customer_id, facebook_name, facebook_id, facebook_link,
        category_id, business_type_id, start_date, end_date, status
    ) VALUES (
        v_customer_id, facebook_name_input, facebook_id_input, facebook_link_input,
        category_id_input, business_type_id_input, v_start_date, v_end_date, 'pending'
    ) RETURNING id INTO v_kiosk_id;

    -- Create payment
    INSERT INTO public.payments (
        customer_id, kiosk_id, start_date, end_date, months,
        price_per_month, discount, discount_reason, total_amount,
        payment_method, payment_status
    ) VALUES (
        v_customer_id, v_kiosk_id, v_start_date, v_end_date, months_input,
        v_business_type.price_per_month, COALESCE(discount_input, 0),
        discount_reason_input, v_total_amount, 'transfer', 'pending'
    ) RETURNING id INTO v_payment_id;

    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================================================
-- RPC 3: process_wallet_deposit — Nạp tiền Ví Ảo qua PayOS
-- ==========================================================================
CREATE OR REPLACE FUNCTION process_wallet_deposit(
    p_customer_id UUID,
    p_amount NUMERIC,
    p_bonus_amount NUMERIC,
    p_order_code BIGINT,
    p_description TEXT
) RETURNS JSONB AS $$
DECLARE
    v_transaction_id UUID;
    v_new_balance NUMERIC;
    v_new_bonus NUMERIC;
BEGIN
    INSERT INTO public.wallet_transactions (
        customer_id, transaction_type, amount, bonus_amount,
        order_code, status, description
    ) VALUES (
        p_customer_id, 'deposit', p_amount, p_bonus_amount,
        p_order_code, 'completed', p_description
    ) RETURNING id INTO v_transaction_id;

    UPDATE public.customers
    SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount,
        bonus_balance = COALESCE(bonus_balance, 0) + p_bonus_amount,
        updated_at = NOW()
    WHERE id = p_customer_id
    RETURNING wallet_balance, bonus_balance INTO v_new_balance, v_new_bonus;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'wallet_balance', v_new_balance,
        'bonus_balance', v_new_bonus
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================================================
-- RPC 4: pay_via_wallet — Thanh toán dịch vụ bằng Ví Ảo
-- ==========================================================================
CREATE OR REPLACE FUNCTION pay_via_wallet(
    p_customer_id UUID,
    p_amount NUMERIC,
    p_description TEXT
) RETURNS JSONB AS $$
DECLARE
    v_current_balance NUMERIC;
    v_current_bonus NUMERIC;
    v_total_available NUMERIC;
    v_deduct_bonus NUMERIC := 0;
    v_deduct_main NUMERIC := 0;
    v_transaction_id UUID;
BEGIN
    SELECT COALESCE(wallet_balance, 0), COALESCE(bonus_balance, 0)
    INTO v_current_balance, v_current_bonus
    FROM public.customers
    WHERE id = p_customer_id;

    v_total_available := v_current_balance + v_current_bonus;

    IF v_total_available < p_amount THEN
        RAISE EXCEPTION 'Số dư ví không đủ (Cần %, Hiện có %).', p_amount, v_total_available;
    END IF;

    IF v_current_balance >= p_amount THEN
        v_deduct_main := p_amount;
    ELSE
        v_deduct_main := v_current_balance;
        v_deduct_bonus := p_amount - v_current_balance;
    END IF;

    UPDATE public.customers
    SET wallet_balance = wallet_balance - v_deduct_main,
        bonus_balance = bonus_balance - v_deduct_bonus,
        updated_at = NOW()
    WHERE id = p_customer_id;

    INSERT INTO public.wallet_transactions (
        customer_id, transaction_type, amount, status, description
    ) VALUES (
        p_customer_id, 'spending', -p_amount, 'completed', p_description
    ) RETURNING id INTO v_transaction_id;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'remaining_wallet_balance', v_current_balance - v_deduct_main,
        'remaining_bonus_balance', v_current_bonus - v_deduct_bonus
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================================================
-- RPC 5: process_task_reward — Trả thưởng nhiệm vụ chéo Facebook
-- ==========================================================================
CREATE OR REPLACE FUNCTION process_task_reward(
    p_submission_id UUID,
    p_worker_id UUID,
    p_reward_amount NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_task_id UUID;
BEGIN
    UPDATE public.task_submissions
    SET status = 'approved', updated_at = NOW()
    WHERE id = p_submission_id AND status = 'pending'
    RETURNING task_id INTO v_task_id;

    IF v_task_id IS NULL THEN
        RAISE EXCEPTION 'Nhiệm vụ không tồn tại hoặc đã được xử lý.';
    END IF;

    UPDATE public.facebook_tasks
    SET completed_quantity = completed_quantity + 1,
        status = CASE WHEN completed_quantity + 1 >= target_quantity THEN 'completed' ELSE status END,
        updated_at = NOW()
    WHERE id = v_task_id;

    UPDATE public.customers
    SET wallet_balance = COALESCE(wallet_balance, 0) + p_reward_amount,
        updated_at = NOW()
    WHERE id = p_worker_id;

    INSERT INTO public.wallet_transactions (
        customer_id, transaction_type, amount, status, description
    ) VALUES (
        p_worker_id, 'bonus', p_reward_amount, 'completed',
        'Thưởng hoàn thành nhiệm vụ chéo Facebook'
    );

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- ENABLE ROW LEVEL SECURITY (RLS) — Tùy chọn, có thể bật theo nhu cầu
-- ============================================================================
-- ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.business_types ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.kiosks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.facebook_tasks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HOÀN TẤT! Chạy file này 1 lần duy nhất trong Supabase SQL Editor.
-- ============================================================================
