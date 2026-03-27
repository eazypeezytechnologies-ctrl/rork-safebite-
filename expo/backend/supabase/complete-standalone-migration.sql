-- ============================================
-- SAFEBITE COMPLETE STANDALONE MIGRATION
-- ============================================
-- Run this file to set up all tables in the correct order
-- This is a standalone migration that handles all dependencies

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USERS TABLE (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{"notifications": true, "autoSync": true, "theme": "auto"}'::JSONB
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own data" ON public.users;
CREATE POLICY "Users can view own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own data" ON public.users;
CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- 2. PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT,
  date_of_birth DATE,
  allergens TEXT[] DEFAULT '{}',
  custom_keywords TEXT[] DEFAULT '{}',
  has_anaphylaxis BOOLEAN DEFAULT FALSE,
  emergency_contacts JSONB DEFAULT '[]'::JSONB,
  medications TEXT[] DEFAULT '{}',
  avatar_color TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profiles" ON public.profiles;
CREATE POLICY "Users can view own profiles" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own profiles" ON public.profiles;
CREATE POLICY "Users can create own profiles" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profiles" ON public.profiles;
CREATE POLICY "Users can update own profiles" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own profiles" ON public.profiles;
CREATE POLICY "Users can delete own profiles" ON public.profiles
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 3. PRODUCTS CACHE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.products (
  code TEXT PRIMARY KEY,
  product_name TEXT,
  brands TEXT,
  image_url TEXT,
  image_front_url TEXT,
  ingredients_text TEXT,
  allergens TEXT,
  allergens_tags TEXT[],
  traces TEXT,
  traces_tags TEXT[],
  categories TEXT,
  categories_tags TEXT[],
  source TEXT NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT now(),
  last_fetched_at TIMESTAMPTZ DEFAULT now(),
  scan_count INTEGER DEFAULT 0
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
CREATE POLICY "Products are viewable by everyone" ON public.products
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Products can be inserted by authenticated users" ON public.products;
CREATE POLICY "Products can be inserted by authenticated users" ON public.products
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Products can be updated by authenticated users" ON public.products;
CREATE POLICY "Products can be updated by authenticated users" ON public.products
  FOR UPDATE USING (auth.role() = 'authenticated');

-- ============================================
-- 4. FAMILY GROUPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.family_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  member_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.family_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own family groups" ON public.family_groups;
CREATE POLICY "Users can view own family groups" ON public.family_groups
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own family groups" ON public.family_groups;
CREATE POLICY "Users can create own family groups" ON public.family_groups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own family groups" ON public.family_groups;
CREATE POLICY "Users can update own family groups" ON public.family_groups
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own family groups" ON public.family_groups;
CREATE POLICY "Users can delete own family groups" ON public.family_groups
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 5. FAMILY GROUP MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.family_group_members (
  group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

ALTER TABLE public.family_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_select" ON public.family_group_members;
CREATE POLICY "members_select"
ON public.family_group_members FOR SELECT
USING (
  user_id = auth.uid() OR
  group_id IN (SELECT group_id FROM public.family_group_members WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "members_insert" ON public.family_group_members;
CREATE POLICY "members_insert"
ON public.family_group_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.family_group_members
    WHERE group_id = family_group_members.group_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "members_delete" ON public.family_group_members;
CREATE POLICY "members_delete"
ON public.family_group_members FOR DELETE
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.family_group_members m
    WHERE m.group_id = family_group_members.group_id
    AND m.user_id = auth.uid()
    AND m.role IN ('owner', 'admin')
  )
);

-- ============================================
-- 6. FAMILY GROUP INVITES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.family_group_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.family_group_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invites_select" ON public.family_group_invites;
CREATE POLICY "invites_select"
ON public.family_group_invites FOR SELECT
USING (
  invited_email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
  group_id IN (SELECT group_id FROM public.family_group_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
);

DROP POLICY IF EXISTS "invites_insert" ON public.family_group_invites;
CREATE POLICY "invites_insert"
ON public.family_group_invites FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.family_group_members
    WHERE group_id = family_group_invites.group_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "invites_delete" ON public.family_group_invites;
CREATE POLICY "invites_delete"
ON public.family_group_invites FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.family_group_members
    WHERE group_id = family_group_invites.group_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

-- ============================================
-- 7. USER SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  active_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  active_family_group_id UUID REFERENCES public.family_groups(id) ON DELETE SET NULL,
  view_mode TEXT DEFAULT 'individual' CHECK (view_mode IN ('individual', 'family')),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can view own settings" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own settings" ON public.user_settings;
CREATE POLICY "Users can manage own settings" ON public.user_settings
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 8. SCAN HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.scan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  product_code TEXT NOT NULL,
  product_name TEXT,
  verdict TEXT CHECK (verdict IN ('safe', 'caution', 'danger')),
  scanned_at TIMESTAMPTZ DEFAULT now(),
  location JSONB,
  synced_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own scan history" ON public.scan_history;
CREATE POLICY "Users can view own scan history" ON public.scan_history
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own scan history" ON public.scan_history;
CREATE POLICY "Users can insert own scan history" ON public.scan_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own scan history" ON public.scan_history;
CREATE POLICY "Users can delete own scan history" ON public.scan_history
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 9. FAVORITES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  product_code TEXT NOT NULL,
  product_name TEXT,
  added_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, product_code)
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own favorites" ON public.favorites;
CREATE POLICY "Users can view own favorites" ON public.favorites
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own favorites" ON public.favorites;
CREATE POLICY "Users can create own favorites" ON public.favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own favorites" ON public.favorites;
CREATE POLICY "Users can delete own favorites" ON public.favorites
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 10. SHOPPING LIST TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.shopping_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_code TEXT,
  product_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  checked BOOLEAN DEFAULT FALSE,
  added_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.shopping_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own shopping list" ON public.shopping_list;
CREATE POLICY "Users can view own shopping list" ON public.shopping_list
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own shopping list" ON public.shopping_list;
CREATE POLICY "Users can manage own shopping list" ON public.shopping_list
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 11. ANALYTICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  timestamp TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own analytics" ON public.analytics;
CREATE POLICY "Users can insert own analytics" ON public.analytics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all analytics" ON public.analytics;
CREATE POLICY "Admins can view all analytics" ON public.analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- ============================================
-- 12. RECALL CACHE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.recall_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code TEXT,
  search_query TEXT,
  recalls JSONB DEFAULT '[]'::JSONB,
  cached_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.recall_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recall cache is viewable by everyone" ON public.recall_cache;
CREATE POLICY "Recall cache is viewable by everyone" ON public.recall_cache
  FOR SELECT USING (TRUE);

-- ============================================
-- 13. RATE LIMITS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 14. RATE LIMIT FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_key TEXT, p_limit INT, p_window_seconds INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_allowed BOOLEAN := true;
BEGIN
  INSERT INTO public.rate_limits(key, count, reset_at)
  VALUES (p_key, 1, v_now + make_interval(secs => p_window_seconds))
  ON CONFLICT (key) DO UPDATE
    SET count = CASE
      WHEN rate_limits.reset_at <= v_now THEN 1
      ELSE rate_limits.count + 1
    END,
    reset_at = CASE
      WHEN rate_limits.reset_at <= v_now THEN v_now + make_interval(secs => p_window_seconds)
      ELSE rate_limits.reset_at
    END;

  SELECT (count <= p_limit) INTO v_allowed
  FROM public.rate_limits
  WHERE key = p_key;

  RETURN v_allowed;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INT, INT) TO authenticated;

-- ============================================
-- 15. UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 16. TRIGGERS
-- ============================================
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shopping_list_updated_at ON public.shopping_list;
CREATE TRIGGER update_shopping_list_updated_at
  BEFORE UPDATE ON public.shopping_list
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_family_groups_updated_at ON public.family_groups;
CREATE TRIGGER update_family_groups_updated_at
  BEFORE UPDATE ON public.family_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 17. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_user_id ON public.scan_history(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_profile_id ON public.scan_history(profile_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_scanned_at ON public.scan_history(scanned_at);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_product_code ON public.favorites(product_code);
CREATE INDEX IF NOT EXISTS idx_shopping_list_user_id ON public.shopping_list(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON public.analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON public.analytics(timestamp);
CREATE INDEX IF NOT EXISTS idx_products_code ON public.products(code);
CREATE INDEX IF NOT EXISTS idx_recall_cache_product_code ON public.recall_cache(product_code);
CREATE INDEX IF NOT EXISTS idx_recall_cache_expires_at ON public.recall_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_family_groups_user_id ON public.family_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_family_group_members_user ON public.family_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_group_members_group ON public.family_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_family_group_invites_token ON public.family_group_invites(token);
CREATE INDEX IF NOT EXISTS idx_family_group_invites_email ON public.family_group_invites(invited_email);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON public.rate_limits(reset_at);
