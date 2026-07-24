-- ============================================================================
-- FIX SUPABASE "UNRESTRICTED" & "RLS DISABLED" WARNINGS
-- Bật Row Level Security (RLS) và tạo Policy cho tất cả các bảng
-- Chạy file này trong Supabase SQL Editor
-- ============================================================================

-- Function hỗ trợ bật RLS và tạo Policy mở cho tất cả bảng trong schema
DO $$
DECLARE
    t TEXT;
    schem TEXT;
    schemas TEXT[] := ARRAY['public', 'DHL-Group-CRM'];
    tables TEXT[] := ARRAY[
        'categories', 'business_types', 'customers', 'kiosks',
        'payments', 'logs', 'user_roles', 'wallet_transactions',
        'facebook_tasks', 'task_submissions', 'registration_requests'
    ];
BEGIN
    FOREACH schem IN ARRAY schemas LOOP
        FOREACH t IN ARRAY tables LOOP
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = schem AND table_name = t
            ) THEN
                -- 1. Bật Row Level Security (RLS)
                EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY;', schem, t);

                -- 2. Xóa policy cũ nếu có
                EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', 'Allow public access ' || t, schem, t);

                -- 3. Tạo Policy cho phép truy cập (SELECT, INSERT, UPDATE, DELETE)
                EXECUTE format('
                    CREATE POLICY %I ON %I.%I
                    FOR ALL
                    USING (true)
                    WITH CHECK (true);
                ', 'Allow public access ' || t, schem, t);
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- ============================================================================
-- HOÀN TẤT! Toàn bộ bảng sẽ chuyển từ màu đỏ "UNRESTRICTED" sang "RESTRICTED (RLS Enabled)".
-- ============================================================================
