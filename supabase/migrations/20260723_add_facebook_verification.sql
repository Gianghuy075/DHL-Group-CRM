-- Add Facebook verification fields to public.customers
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS facebook_verified BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS facebook_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS friend_count INT DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS follower_count INT DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS is_public_profile BOOLEAN DEFAULT FALSE NOT NULL;

-- Index for facebook_verified
CREATE INDEX IF NOT EXISTS idx_customers_fb_verified ON public.customers(facebook_verified);
