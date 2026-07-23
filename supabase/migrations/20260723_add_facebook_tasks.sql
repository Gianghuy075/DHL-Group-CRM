-- Create facebook_tasks table supporting all 9 Facebook cross-interaction service types
CREATE TABLE IF NOT EXISTS public.facebook_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creator_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    task_type VARCHAR(30) NOT NULL CHECK (task_type IN (
        'like_post', 'like_high_val', 'like_multi', 'like_page', 
        'reaction_post', 'reaction_comment', 'follow_profile', 
        'share_post', 'join_group', 'like', 'share', 'comment', 'follow', 'reaction'
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

-- Create task_submissions table
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_facebook_tasks_status ON public.facebook_tasks(status);
CREATE INDEX IF NOT EXISTS idx_facebook_tasks_creator ON public.facebook_tasks(creator_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_task ON public.task_submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_worker ON public.task_submissions(worker_id);

-- RPC Function: Process Task Worker Reward
CREATE OR REPLACE FUNCTION process_task_reward(
    p_submission_id UUID,
    p_worker_id UUID,
    p_reward_amount NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_task_id UUID;
BEGIN
    -- Update submission status to approved
    UPDATE public.task_submissions
    SET status = 'approved',
        updated_at = NOW()
    WHERE id = p_submission_id AND status = 'pending'
    RETURNING task_id INTO v_task_id;

    IF v_task_id IS NULL THEN
        RAISE EXCEPTION 'Nhiệm vụ không tồn tại hoặc đã được xử lý.';
    END IF;

    -- Increment completed count on task
    UPDATE public.facebook_tasks
    SET completed_quantity = completed_quantity + 1,
        status = CASE WHEN completed_quantity + 1 >= target_quantity THEN 'completed' ELSE status END,
        updated_at = NOW()
    WHERE id = v_task_id;

    -- Credit reward to Worker's wallet
    UPDATE public.customers
    SET wallet_balance = COALESCE(wallet_balance, 0) + p_reward_amount,
        updated_at = NOW()
    WHERE id = p_worker_id;

    -- Log transaction
    INSERT INTO public.wallet_transactions (
        customer_id,
        transaction_type,
        amount,
        status,
        description
    ) VALUES (
        p_worker_id,
        'bonus',
        p_reward_amount,
        'completed',
        'Thưởng hoàn thành nhiệm vụ chéo Facebook'
    );

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
