-- Create wallet fields on customers table if not exists
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(15, 2) DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS bonus_balance NUMERIC(15, 2) DEFAULT 0 NOT NULL;

-- Create wallet_transactions table
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

-- Index for wallet transactions
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_customer ON public.wallet_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_order_code ON public.wallet_transactions(order_code);

-- RPC Function: Confirm Wallet Deposit
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
    -- Insert completed transaction
    INSERT INTO public.wallet_transactions (
        customer_id,
        transaction_type,
        amount,
        bonus_amount,
        order_code,
        status,
        description
    ) VALUES (
        p_customer_id,
        'deposit',
        p_amount,
        p_bonus_amount,
        p_order_code,
        'completed',
        p_description
    ) RETURNING id INTO v_transaction_id;

    -- Update customer balance
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
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC Function: Spend from Wallet
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
        RAISE EXCEPTION 'Số dư ví không đủ để thực hiện thanh toán (Cần %, Hiện có %).', p_amount, v_total_available;
    END IF;

    -- Prioritize deducting main balance first, then bonus
    IF v_current_balance >= p_amount THEN
        v_deduct_main := p_amount;
        v_deduct_bonus := 0;
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
        customer_id,
        transaction_type,
        amount,
        status,
        description
    ) VALUES (
        p_customer_id,
        'spending',
        -p_amount,
        'completed',
        p_description
    ) RETURNING id INTO v_transaction_id;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'remaining_wallet_balance', v_current_balance - v_deduct_main,
        'remaining_bonus_balance', v_current_bonus - v_deduct_bonus
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
