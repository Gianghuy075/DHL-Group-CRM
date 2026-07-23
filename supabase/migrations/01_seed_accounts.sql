-- ============================================================================
-- SEED DATA: 3 Tài khoản Demo (Admin, User1, User2)
-- ============================================================================
-- QUAN TRỌNG: File này cần chạy SAU khi đã chạy 00_complete_database.sql
--
-- Vì Supabase Auth KHÔNG cho phép INSERT trực tiếp vào auth.users qua SQL Editor,
-- bạn cần TẠO 3 TÀI KHOẢN bằng 1 trong 2 cách sau:
--
-- ═══════════════════════════════════════════════════════════════════════════
-- CÁCH 1: Tạo User qua Supabase Dashboard (Khuyến nghị)
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Vào Supabase Dashboard → Authentication → Users
-- 2. Bấm "Add User" → "Create New User"
-- 3. Tạo lần lượt 3 tài khoản:
--
--    Tài khoản 1 (Admin):
--      Email: admin@dhl-kiosk.com
--      Password: admin
--      ☑ Auto Confirm (bật)
--
--    Tài khoản 2 (User thường):
--      Email: user1@dhl-kiosk.com
--      Password: 123
--      ☑ Auto Confirm (bật)
--
--    Tài khoản 3 (User có dữ liệu dịch vụ):
--      Email: user2@dhl-kiosk.com
--      Password: 123
--      ☑ Auto Confirm (bật)
--
-- 4. Sau khi tạo xong, copy UUID của từng user từ cột "User UID"
-- 5. Thay thế 3 UUID bên dưới rồi chạy phần còn lại của file SQL này
--
-- ═══════════════════════════════════════════════════════════════════════════
-- CÁCH 2: Tạo User qua Supabase SQL Editor (Nâng cao)
-- ═══════════════════════════════════════════════════════════════════════════
-- Chạy đoạn SQL bên dưới trong SQL Editor:

-- Tạo 3 auth users
INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    aud, role, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token
) VALUES
(
    'a0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'admin@dhl-kiosk.com',
    crypt('admin', gen_salt('bf')),
    NOW(),
    'authenticated', 'authenticated',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Admin DHL"}',
    NOW(), NOW(), ''
),
(
    'a0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'user1@dhl-kiosk.com',
    crypt('123', gen_salt('bf')),
    NOW(),
    'authenticated', 'authenticated',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"User 1"}',
    NOW(), NOW(), ''
),
(
    'a0000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'user2@dhl-kiosk.com',
    crypt('123', gen_salt('bf')),
    NOW(),
    'authenticated', 'authenticated',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"User 2"}',
    NOW(), NOW(), ''
)
ON CONFLICT (id) DO NOTHING;

-- QUAN TRỌNG: GoTrue (Auth) đọc các cột token vào kiểu string, nếu để NULL sẽ lỗi
-- "Database error querying schema" khi đăng nhập. Ép về '' cho các user seed.
UPDATE auth.users SET
    confirmation_token         = COALESCE(confirmation_token, ''),
    recovery_token             = COALESCE(recovery_token, ''),
    email_change               = COALESCE(email_change, ''),
    email_change_token_new     = COALESCE(email_change_token_new, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    phone_change               = COALESCE(phone_change, ''),
    phone_change_token         = COALESCE(phone_change_token, ''),
    reauthentication_token     = COALESCE(reauthentication_token, '')
WHERE email IN ('admin@dhl-kiosk.com', 'user1@dhl-kiosk.com', 'user2@dhl-kiosk.com');

-- Tạo identities cho auth users
INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
VALUES
(
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'admin@dhl-kiosk.com',
    'email',
    jsonb_build_object('sub', 'a0000000-0000-0000-0000-000000000001', 'email', 'admin@dhl-kiosk.com'),
    NOW(), NOW(), NOW()
),
(
    'a0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000002',
    'user1@dhl-kiosk.com',
    'email',
    jsonb_build_object('sub', 'a0000000-0000-0000-0000-000000000002', 'email', 'user1@dhl-kiosk.com'),
    NOW(), NOW(), NOW()
),
(
    'a0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000003',
    'user2@dhl-kiosk.com',
    'email',
    jsonb_build_object('sub', 'a0000000-0000-0000-0000-000000000003', 'email', 'user2@dhl-kiosk.com'),
    NOW(), NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- PHẦN 2: Dữ liệu user_roles (Phân quyền)
-- ============================================================================
INSERT INTO "DHL-Group-CRM".user_roles (user_id, username, display_name, role, is_active) VALUES
('a0000000-0000-0000-0000-000000000001', 'admin', 'Admin DHL', 'admin', TRUE),
('a0000000-0000-0000-0000-000000000002', 'user1', 'Người dùng 1', 'user', TRUE),
('a0000000-0000-0000-0000-000000000003', 'user2', 'Người dùng 2 (Dịch vụ)', 'user', TRUE)
ON CONFLICT DO NOTHING;


-- ============================================================================
-- PHẦN 3: Dữ liệu Danh mục & Loại hình kinh doanh
-- ============================================================================
INSERT INTO "DHL-Group-CRM".categories (id, name, description, is_active, sort_order) VALUES
('c0000000-0000-0000-0000-000000000001', 'Thời trang', 'Thời trang, quần áo, giày dép', TRUE, 1),
('c0000000-0000-0000-0000-000000000002', 'Ẩm thực', 'Đồ ăn, thức uống, nhà hàng', TRUE, 2),
('c0000000-0000-0000-0000-000000000003', 'Làm đẹp', 'Mỹ phẩm, spa, chăm sóc sắc đẹp', TRUE, 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "DHL-Group-CRM".business_types (id, category_id, name, price_per_month, description, is_active, sort_order) VALUES
('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Thời trang Nam', 500000, 'Kiosk thời trang nam', TRUE, 1),
('b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Thời trang Nữ', 600000, 'Kiosk thời trang nữ', TRUE, 2),
('b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'Trà sữa & Đồ uống', 450000, 'Kiosk trà sữa, nước ép', TRUE, 3),
('b0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000003', 'Mỹ phẩm Online', 700000, 'Kiosk bán mỹ phẩm', TRUE, 4)
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- PHẦN 4: Dữ liệu Khách hàng (customers) cho user1 và user2
-- ============================================================================

-- User1: Khách hàng mới, chưa có dịch vụ
INSERT INTO "DHL-Group-CRM".customers (id, facebook_name, facebook_id, phone, address, status, note, wallet_balance, bonus_balance) VALUES
('a0000000-0000-0000-0000-000000000002',
 'Nguyen Van User1', '100088812345', '0901234567', 'Hà Nội',
 'potential', 'Tài khoản user1 demo', 0, 0)
ON CONFLICT (id) DO NOTHING;

-- User2: Khách hàng đã có dịch vụ, có tiền ví, đã xác thực FB
INSERT INTO "DHL-Group-CRM".customers (id, facebook_name, facebook_id, facebook_link, phone, address, status, note,
    total_paid, total_kiosks, wallet_balance, bonus_balance,
    facebook_verified, facebook_verified_at, friend_count, follower_count, is_public_profile)
VALUES
('a0000000-0000-0000-0000-000000000003',
 'Tran Thi User2', '100099912345', 'https://www.facebook.com/user2.demo', '0912345678', 'TP Hồ Chí Minh',
 'active', 'Tài khoản user2 demo đầy đủ dịch vụ',
 1200000, 2, 750000, 150000,
 TRUE, NOW(), 285, 120, TRUE)
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- PHẦN 5: Dữ liệu Kiosk cho User2
-- ============================================================================
INSERT INTO "DHL-Group-CRM".kiosks (id, customer_id, facebook_name, facebook_id, facebook_link, category_id, business_type_id,
    start_date, end_date, status, auto_approve, total_paid)
VALUES
-- Kiosk 1: Đang hoạt động
('d0000000-0000-0000-0000-000000000001',
 'a0000000-0000-0000-0000-000000000003',
 'Shop User2 - Thời Trang', '100099912345', 'https://www.facebook.com/user2.demo',
 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
 CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '60 days',
 'active', FALSE, 500000),
-- Kiosk 2: Đang hoạt động
('d0000000-0000-0000-0000-000000000002',
 'a0000000-0000-0000-0000-000000000003',
 'Shop User2 - Trà Sữa', '100099912345', 'https://www.facebook.com/user2.demo',
 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003',
 CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '75 days',
 'active', FALSE, 700000)
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- PHẦN 6: Dữ liệu Thanh toán cho User2
-- ============================================================================
INSERT INTO "DHL-Group-CRM".payments (id, customer_id, kiosk_id, start_date, end_date, months, price_per_month,
    discount, discount_reason, total_amount, payment_method, payment_status, confirmed_at)
VALUES
('e0000000-0000-0000-0000-000000000001',
 'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001',
 CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '60 days',
 3, 500000, 300000, 'Ưu đãi khách hàng mới', 1200000,
 'transfer', 'completed', NOW()),
('e0000000-0000-0000-0000-000000000002',
 'a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002',
 CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '75 days',
 2, 450000, 0, NULL, 900000,
 'transfer', 'completed', NOW())
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- PHẦN 7: Dữ liệu Ví Ảo cho User2
-- ============================================================================
INSERT INTO "DHL-Group-CRM".wallet_transactions (customer_id, transaction_type, amount, bonus_amount, status, description) VALUES
('a0000000-0000-0000-0000-000000000003', 'deposit', 1000000, 150000, 'completed', 'Nạp ví qua PayOS - Demo'),
('a0000000-0000-0000-0000-000000000003', 'spending', -250000, 0, 'completed', 'Đăng nhiệm vụ Like chéo (x50)');


-- ============================================================================
-- PHẦN 8: Dữ liệu Nhiệm vụ Chéo Facebook cho User2
-- ============================================================================
INSERT INTO "DHL-Group-CRM".facebook_tasks (id, creator_id, task_type, post_url, facebook_target_id,
    target_quantity, completed_quantity, unit_price, total_cost, status, note)
VALUES
-- Nhiệm vụ 1: Like chéo - Đang chạy
('f0000000-0000-0000-0000-000000000001',
 'a0000000-0000-0000-0000-000000000003',
 'like_post',
 'https://www.facebook.com/user2.demo/posts/123456789',
 '123456789',
 50, 12, 500, 25000,
 'active', 'Like bài viết mới nhất của shop'),
-- Nhiệm vụ 2: Share chéo - Đang chạy
('f0000000-0000-0000-0000-000000000002',
 'a0000000-0000-0000-0000-000000000003',
 'share_post',
 'https://www.facebook.com/user2.demo/posts/987654321',
 '987654321',
 30, 5, 1500, 45000,
 'active', 'Share bài khuyến mãi cuối tuần'),
-- Nhiệm vụ 3: Follow chéo - Đã hoàn thành
('f0000000-0000-0000-0000-000000000003',
 'a0000000-0000-0000-0000-000000000003',
 'follow_profile',
 'https://www.facebook.com/user2.demo',
 'user2.demo',
 20, 20, 900, 18000,
 'completed', 'Theo dõi trang cá nhân shop')
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- HOÀN TẤT SEED DATA!
-- ============================================================================
-- Đăng nhập:
--   Admin:  admin@dhl-kiosk.com / admin
--   User1:  user1@dhl-kiosk.com / 123
--   User2:  user2@dhl-kiosk.com / 123  (có sẵn kiosk, ví, nhiệm vụ FB)
-- ============================================================================
