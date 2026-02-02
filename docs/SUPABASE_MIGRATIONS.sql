-- =====================================================
-- SafeBite / Allergy Guardian - Supabase Migrations
-- Run these in your Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. Family Invitations Table
-- =====================================================
CREATE TABLE IF NOT EXISTS family_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_group_id UUID NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for token lookups (used when accepting invites)
CREATE INDEX IF NOT EXISTS idx_family_invitations_token ON family_invitations(token);

-- Index for family group lookups
CREATE INDEX IF NOT EXISTS idx_family_invitations_family_group ON family_invitations(family_group_id);

-- Index for user's pending invitations
CREATE INDEX IF NOT EXISTS idx_family_invitations_email_status ON family_invitations(email, status) WHERE status = 'pending';

-- RLS Policies for family_invitations
ALTER TABLE family_invitations ENABLE ROW LEVEL SECURITY;

-- Users can view invitations they created or are addressed to them
CREATE POLICY "Users can view their invitations" ON family_invitations
  FOR SELECT USING (
    inviter_id = auth.uid() OR 
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Users can create invitations for groups they own
CREATE POLICY "Users can create invitations for their groups" ON family_invitations
  FOR INSERT WITH CHECK (
    inviter_id = auth.uid() AND
    EXISTS (SELECT 1 FROM family_groups WHERE id = family_group_id AND user_id = auth.uid())
  );

-- Users can update invitations addressed to them (accept/decline)
CREATE POLICY "Users can update invitations addressed to them" ON family_invitations
  FOR UPDATE USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Users can delete/revoke invitations they created
CREATE POLICY "Users can delete their invitations" ON family_invitations
  FOR DELETE USING (inviter_id = auth.uid());

-- =====================================================
-- 2. Profiles Table - Add Eczema Trigger Columns
-- =====================================================
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS track_eczema_triggers BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS eczema_trigger_groups TEXT[] DEFAULT '{}';

-- =====================================================
-- 3. Products Table - Add scan_count for popularity
-- =====================================================
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS scan_count INTEGER DEFAULT 0;

-- Index for product search by name (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_products_name_lower ON products(LOWER(product_name));

-- Index for product search by brand
CREATE INDEX IF NOT EXISTS idx_products_brands_lower ON products(LOWER(brands));

-- Index for popular products
CREATE INDEX IF NOT EXISTS idx_products_scan_count ON products(scan_count DESC NULLS LAST);

-- =====================================================
-- 4. Scan History - Fix timestamp column
-- =====================================================
-- Check if the column exists and create appropriate index
-- The column is 'scanned_at' based on the hooks/useSupabase.ts

-- Index for user's scan history (most recent first)
CREATE INDEX IF NOT EXISTS idx_scan_history_user_scanned 
ON scan_history(user_id, scanned_at DESC);

-- Index for product name search in scan history
CREATE INDEX IF NOT EXISTS idx_scan_history_product_name 
ON scan_history(user_id, LOWER(product_name));

-- =====================================================
-- 5. User Subscriptions Table (for future use)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'individual', 'family')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'canceled', 'past_due', 'expired')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  trial_end TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS for subscriptions
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription" ON user_subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own subscription" ON user_subscriptions
  FOR UPDATE USING (user_id = auth.uid());

-- =====================================================
-- 6. Admin Settings Table
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default settings
INSERT INTO admin_settings (key, value) VALUES 
  ('subscriptions_enabled', 'false'::jsonb),
  ('testing_mode', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- RLS for admin settings (admins only)
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read admin settings" ON admin_settings
  FOR SELECT USING (true);

CREATE POLICY "Only admins can update settings" ON admin_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );

-- =====================================================
-- 7. Helper Function: Increment product scan count
-- =====================================================
CREATE OR REPLACE FUNCTION increment_product_scan_count(product_code TEXT)
RETURNS void AS $$
BEGIN
  UPDATE products 
  SET scan_count = COALESCE(scan_count, 0) + 1
  WHERE code = product_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. Helper Function: Clean expired invitations
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS void AS $$
BEGIN
  UPDATE family_invitations 
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VERIFICATION QUERIES (run these to check setup)
-- =====================================================
-- SELECT * FROM information_schema.tables WHERE table_name = 'family_invitations';
-- SELECT * FROM information_schema.columns WHERE table_name = 'profiles' AND column_name IN ('track_eczema_triggers', 'eczema_trigger_groups');
-- SELECT * FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'scan_count';
