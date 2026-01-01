-- ============================================
-- UNIFY USERS TABLE MIGRATION (UPDATED)
-- ============================================

-- 1. Drop existing check constraint that strictly limits roles
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;

-- 2. Add new check constraint with EXTENDED roles (including 'buyer')
ALTER TABLE admin_users 
ADD CONSTRAINT admin_users_role_check 
CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'TECHNICIAN', 'INVENTORY', 'AUDITOR', 'buyer', 'user', 'BUYER'));

-- 3. Add missing columns to admin_users to support Customers
ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS full_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- 4. Make username nullable (Customers might only have email initially)
ALTER TABLE admin_users 
ALTER COLUMN username DROP NOT NULL;

-- 5. Add comment
COMMENT ON TABLE admin_users IS 'Unified Users Table (Admins, Staff, and Customers)';

-- 6. Migrate existing customers (if any) from users table to admin_users
INSERT INTO admin_users (email, password_hash, full_name, phone, role, is_active, created_at, updated_at)
SELECT email, password_hash, full_name, phone, role, is_active, created_at, updated_at
FROM users
ON CONFLICT (email) DO NOTHING;
