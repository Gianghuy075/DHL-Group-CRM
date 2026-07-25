-- ==========================================================================
-- Local (self-managed) auth: store password hashes on user_roles and make
-- username unique. Auth is now handled by the NestJS backend (HS256 JWT),
-- no longer by Supabase Auth.
-- ==========================================================================
ALTER TABLE "DHL-Group-CRM".user_roles
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Usernames must be unique (only enforced for non-null usernames).
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_username
  ON "DHL-Group-CRM".user_roles (username)
  WHERE username IS NOT NULL;
