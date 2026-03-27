-- ============================================================
-- SafeBite / Allergy Guardian — P0 Security Hardening Migration
-- Run in Supabase SQL Editor in order (idempotent where possible)
-- ============================================================

-- ============================================================
-- 1. CORE TABLES (ensure they exist with correct columns)
-- ============================================================

-- 1a. users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1b. families table (the multi-tenant anchor)
CREATE TABLE IF NOT EXISTS families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  max_members INT DEFAULT 6,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1c. family_members join table (replaces member_ids array)
CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(family_id, user_id)
);

-- 1d. Add family_id to profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'family_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN family_id UUID REFERENCES families(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 1e. Add family_id to scan_history if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_history' AND column_name = 'family_id'
  ) THEN
    ALTER TABLE scan_history ADD COLUMN family_id UUID REFERENCES families(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 1f. Add family_id to favorites if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'favorites' AND column_name = 'family_id'
  ) THEN
    ALTER TABLE favorites ADD COLUMN family_id UUID REFERENCES families(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 1g. Add family_id to shopping_list if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopping_list' AND column_name = 'family_id'
  ) THEN
    ALTER TABLE shopping_list ADD COLUMN family_id UUID REFERENCES families(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 2. SECURE INVITATIONS TABLE (hashed tokens, one-time use)
-- ============================================================

CREATE TABLE IF NOT EXISTS secure_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  invite_type TEXT NOT NULL CHECK (invite_type IN ('app', 'family')),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  invited_email TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_secure_invitations_token_hash ON secure_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_secure_invitations_family_id ON secure_invitations(family_id);
CREATE INDEX IF NOT EXISTS idx_secure_invitations_status ON secure_invitations(status) WHERE status = 'pending';

-- ============================================================
-- 3. AUDIT EVENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  family_id UUID REFERENCES families(id) ON DELETE SET NULL,
  profile_id UUID,
  target_id TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_family_id ON audit_events(family_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at DESC);

-- ============================================================
-- 4. ADMIN VIEW-AS LOG (time-limited, audited)
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_view_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  target_family_id UUID NOT NULL REFERENCES families(id),
  reason TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  ended_at TIMESTAMPTZ,
  CONSTRAINT valid_session CHECK (expires_at > started_at)
);

-- ============================================================
-- 5. RATE LIMITING TABLE (server-side)
-- ============================================================

CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  window_start TIMESTAMPTZ DEFAULT now(),
  request_count INT DEFAULT 1,
  UNIQUE(user_id, action_type, window_start)
);

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID,
  p_action TEXT,
  p_max_requests INT,
  p_window_minutes INT
) RETURNS BOOLEAN AS $$
DECLARE
  v_count INT;
  v_window_start TIMESTAMPTZ;
BEGIN
  v_window_start := now() - (p_window_minutes || ' minutes')::interval;

  SELECT COALESCE(SUM(request_count), 0) INTO v_count
  FROM rate_limits
  WHERE user_id = p_user_id
    AND action_type = p_action
    AND window_start >= v_window_start;

  IF v_count >= p_max_requests THEN
    RETURN FALSE;
  END IF;

  INSERT INTO rate_limits (user_id, action_type, window_start, request_count)
  VALUES (p_user_id, p_action, date_trunc('minute', now()), 1)
  ON CONFLICT (user_id, action_type, window_start)
  DO UPDATE SET request_count = rate_limits.request_count + 1;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup old rate limit records (run periodically)
CREATE OR REPLACE FUNCTION cleanup_rate_limits() RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits WHERE window_start < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. HELPER FUNCTION: check family membership
-- ============================================================

CREATE OR REPLACE FUNCTION is_family_member(p_user_id UUID, p_family_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM family_members
    WHERE user_id = p_user_id AND family_id = p_family_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_family_owner(p_user_id UUID, p_family_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM families
    WHERE id = p_family_id AND owner_user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_user_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = p_user_id AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION family_member_count(p_family_id UUID)
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM family_members WHERE family_id = p_family_id;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- 7. ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE secure_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_view_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Also enable on legacy tables if they exist
DO $$ BEGIN
  EXECUTE 'ALTER TABLE family_invitations ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE family_groups ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ============================================================
-- 8. RLS POLICIES
-- ============================================================

-- Drop existing policies first (idempotent)
DO $$ BEGIN
  DROP POLICY IF EXISTS users_self_read ON users;
  DROP POLICY IF EXISTS users_self_update ON users;
  DROP POLICY IF EXISTS users_admin_read ON users;
  DROP POLICY IF EXISTS users_insert ON users;
END $$;

-- 8a. users: read own row, admins read all
CREATE POLICY users_self_read ON users
  FOR SELECT USING (id = auth.uid() OR is_user_admin(auth.uid()));

CREATE POLICY users_self_update ON users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY users_insert ON users
  FOR INSERT WITH CHECK (id = auth.uid());

-- 8b. families: owner full control, members read
DO $$ BEGIN
  DROP POLICY IF EXISTS families_owner_all ON families;
  DROP POLICY IF EXISTS families_member_read ON families;
  DROP POLICY IF EXISTS families_insert ON families;
  DROP POLICY IF EXISTS families_admin_read ON families;
END $$;

CREATE POLICY families_owner_all ON families
  FOR ALL USING (owner_user_id = auth.uid());

CREATE POLICY families_member_read ON families
  FOR SELECT USING (is_family_member(auth.uid(), id));

CREATE POLICY families_admin_read ON families
  FOR SELECT USING (is_user_admin(auth.uid()));

-- 8c. family_members: members see own family, owner manages
DO $$ BEGIN
  DROP POLICY IF EXISTS fm_self_read ON family_members;
  DROP POLICY IF EXISTS fm_owner_manage ON family_members;
  DROP POLICY IF EXISTS fm_admin_read ON family_members;
END $$;

CREATE POLICY fm_self_read ON family_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_family_member(auth.uid(), family_id)
  );

CREATE POLICY fm_owner_manage ON family_members
  FOR ALL USING (
    is_family_owner(auth.uid(), family_id)
  );

CREATE POLICY fm_admin_read ON family_members
  FOR SELECT USING (is_user_admin(auth.uid()));

-- 8d. profiles: own rows OR family membership
DO $$ BEGIN
  DROP POLICY IF EXISTS profiles_own_read ON profiles;
  DROP POLICY IF EXISTS profiles_own_write ON profiles;
  DROP POLICY IF EXISTS profiles_family_read ON profiles;
  DROP POLICY IF EXISTS profiles_admin_read ON profiles;
  DROP POLICY IF EXISTS profiles_insert ON profiles;
END $$;

CREATE POLICY profiles_own_read ON profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY profiles_own_write ON profiles
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY profiles_insert ON profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY profiles_family_read ON profiles
  FOR SELECT USING (
    family_id IS NOT NULL
    AND is_family_member(auth.uid(), family_id)
  );

CREATE POLICY profiles_admin_read ON profiles
  FOR SELECT USING (is_user_admin(auth.uid()));

-- Allow user to delete own profiles
DO $$ BEGIN
  DROP POLICY IF EXISTS profiles_own_delete ON profiles;
END $$;
CREATE POLICY profiles_own_delete ON profiles
  FOR DELETE USING (user_id = auth.uid());

-- 8e. scan_history: own rows OR family membership
DO $$ BEGIN
  DROP POLICY IF EXISTS scan_own ON scan_history;
  DROP POLICY IF EXISTS scan_family_read ON scan_history;
  DROP POLICY IF EXISTS scan_insert ON scan_history;
  DROP POLICY IF EXISTS scan_admin_read ON scan_history;
  DROP POLICY IF EXISTS scan_own_delete ON scan_history;
END $$;

CREATE POLICY scan_own ON scan_history
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY scan_family_read ON scan_history
  FOR SELECT USING (
    family_id IS NOT NULL
    AND is_family_member(auth.uid(), family_id)
  );

CREATE POLICY scan_insert ON scan_history
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY scan_own_delete ON scan_history
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY scan_admin_read ON scan_history
  FOR SELECT USING (is_user_admin(auth.uid()));

-- 8f. favorites: own rows OR family membership
DO $$ BEGIN
  DROP POLICY IF EXISTS fav_own ON favorites;
  DROP POLICY IF EXISTS fav_family_read ON favorites;
  DROP POLICY IF EXISTS fav_insert ON favorites;
  DROP POLICY IF EXISTS fav_own_delete ON favorites;
END $$;

CREATE POLICY fav_own ON favorites
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY fav_family_read ON favorites
  FOR SELECT USING (
    family_id IS NOT NULL
    AND is_family_member(auth.uid(), family_id)
  );

CREATE POLICY fav_insert ON favorites
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY fav_own_delete ON favorites
  FOR DELETE USING (user_id = auth.uid());

-- 8g. shopping_list: own rows OR family membership
DO $$ BEGIN
  DROP POLICY IF EXISTS shop_own ON shopping_list;
  DROP POLICY IF EXISTS shop_family_read ON shopping_list;
  DROP POLICY IF EXISTS shop_insert ON shopping_list;
  DROP POLICY IF EXISTS shop_own_write ON shopping_list;
  DROP POLICY IF EXISTS shop_own_delete ON shopping_list;
END $$;

CREATE POLICY shop_own ON shopping_list
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY shop_family_read ON shopping_list
  FOR SELECT USING (
    family_id IS NOT NULL
    AND is_family_member(auth.uid(), family_id)
  );

CREATE POLICY shop_insert ON shopping_list
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY shop_own_write ON shopping_list
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY shop_own_delete ON shopping_list
  FOR DELETE USING (user_id = auth.uid());

-- 8h. products: global read for all authenticated, write for authenticated
DO $$ BEGIN
  DROP POLICY IF EXISTS products_read ON products;
  DROP POLICY IF EXISTS products_insert ON products;
  DROP POLICY IF EXISTS products_update ON products;
END $$;

CREATE POLICY products_read ON products
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY products_insert ON products
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY products_update ON products
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- 8i. secure_invitations
DO $$ BEGIN
  DROP POLICY IF EXISTS invites_creator ON secure_invitations;
  DROP POLICY IF EXISTS invites_family_owner ON secure_invitations;
  DROP POLICY IF EXISTS invites_redeem ON secure_invitations;
  DROP POLICY IF EXISTS invites_admin ON secure_invitations;
END $$;

CREATE POLICY invites_creator ON secure_invitations
  FOR ALL USING (created_by = auth.uid());

CREATE POLICY invites_family_owner ON secure_invitations
  FOR SELECT USING (
    family_id IS NOT NULL
    AND is_family_owner(auth.uid(), family_id)
  );

CREATE POLICY invites_redeem ON secure_invitations
  FOR SELECT USING (
    status = 'pending'
    AND expires_at > now()
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY invites_admin ON secure_invitations
  FOR SELECT USING (is_user_admin(auth.uid()));

-- 8j. audit_events: admin read only, insert for authenticated
DO $$ BEGIN
  DROP POLICY IF EXISTS audit_admin_read ON audit_events;
  DROP POLICY IF EXISTS audit_insert ON audit_events;
END $$;

CREATE POLICY audit_admin_read ON audit_events
  FOR SELECT USING (is_user_admin(auth.uid()));

CREATE POLICY audit_insert ON audit_events
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 8k. admin_view_sessions: admin only
DO $$ BEGIN
  DROP POLICY IF EXISTS avs_admin ON admin_view_sessions;
END $$;

CREATE POLICY avs_admin ON admin_view_sessions
  FOR ALL USING (is_user_admin(auth.uid()));

-- 8l. rate_limits: own rows only
DO $$ BEGIN
  DROP POLICY IF EXISTS rl_own ON rate_limits;
END $$;

CREATE POLICY rl_own ON rate_limits
  FOR ALL USING (user_id = auth.uid());

-- 8m. Legacy tables policies (if they exist)
DO $$ BEGIN
  DROP POLICY IF EXISTS fg_own ON family_groups;
  EXECUTE 'CREATE POLICY fg_own ON family_groups FOR ALL USING (user_id = auth.uid())';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS fi_own ON family_invitations;
  EXECUTE 'CREATE POLICY fi_own ON family_invitations FOR ALL USING (inviter_id = auth.uid())';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS us_own ON user_settings;
  EXECUTE 'CREATE POLICY us_own ON user_settings FOR ALL USING (user_id = auth.uid())';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS ua_own ON user_activity;
  EXECUTE 'CREATE POLICY ua_own ON user_activity FOR ALL USING (user_id = auth.uid())';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ============================================================
-- 9. AGGREGATED VIEWS FOR ADMIN (no raw PII exposed)
-- ============================================================

CREATE OR REPLACE VIEW admin_metrics AS
SELECT
  (SELECT COUNT(*) FROM users) AS total_users,
  (SELECT COUNT(*) FROM users WHERE is_admin = TRUE) AS admin_users,
  (SELECT COUNT(*) FROM users WHERE is_admin = FALSE) AS regular_users,
  (SELECT COUNT(*) FROM profiles) AS total_profiles,
  (SELECT COUNT(*) FROM scan_history) AS total_scans,
  (SELECT COUNT(*) FROM favorites) AS total_favorites,
  (SELECT COUNT(*) FROM families) AS total_families,
  (SELECT COUNT(*) FROM family_members) AS total_family_members,
  (SELECT COUNT(*) FROM secure_invitations WHERE status = 'pending') AS pending_invites,
  (SELECT COUNT(*) FROM secure_invitations WHERE status = 'accepted') AS accepted_invites,
  (SELECT COUNT(*) FROM products) AS total_products,
  (SELECT COUNT(*) FROM audit_events WHERE created_at > now() - interval '24 hours') AS events_last_24h,
  (SELECT COUNT(*) FROM audit_events WHERE created_at > now() - interval '7 days') AS events_last_7d;

CREATE OR REPLACE VIEW admin_scan_stats AS
SELECT
  date_trunc('day', scanned_at) AS scan_date,
  COUNT(*) AS scan_count,
  COUNT(DISTINCT user_id) AS unique_users
FROM scan_history
WHERE scanned_at > now() - interval '30 days'
GROUP BY date_trunc('day', scanned_at)
ORDER BY scan_date DESC;

CREATE OR REPLACE VIEW admin_error_rates AS
SELECT
  event_type,
  COUNT(*) AS event_count,
  date_trunc('hour', created_at) AS event_hour
FROM audit_events
WHERE event_type LIKE 'error.%'
  AND created_at > now() - interval '24 hours'
GROUP BY event_type, date_trunc('hour', created_at)
ORDER BY event_hour DESC;

-- ============================================================
-- 10. STORAGE POLICIES (run separately if buckets exist)
-- ============================================================

-- Make scan-photos bucket PRIVATE (create if not exists)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('scan-photos', 'scan-photos', false)
-- ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage policy: users can only access their own folder
-- CREATE POLICY storage_own_read ON storage.objects
--   FOR SELECT USING (
--     bucket_id = 'scan-photos'
--     AND (storage.foldername(name))[1] = auth.uid()::text
--   );

-- CREATE POLICY storage_own_insert ON storage.objects
--   FOR INSERT WITH CHECK (
--     bucket_id = 'scan-photos'
--     AND (storage.foldername(name))[1] = auth.uid()::text
--   );

-- CREATE POLICY storage_family_read ON storage.objects
--   FOR SELECT USING (
--     bucket_id = 'scan-photos'
--     AND EXISTS (
--       SELECT 1 FROM family_members fm
--       WHERE fm.user_id = auth.uid()
--         AND fm.family_id::text = (storage.foldername(name))[2]
--     )
--   );

-- ============================================================
-- 11. PERFORMANCE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_family_id ON profiles(family_id) WHERE family_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scan_history_user_id ON scan_history(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_family_id ON scan_history(family_id) WHERE family_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scan_history_scanned_at ON scan_history(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_family_id ON favorites(family_id) WHERE family_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (product_name gin_trgm_ops);

-- Note: gin_trgm_ops requires pg_trgm extension:
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 12. ENFORCE MAX FAMILY MEMBERS VIA TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_family_member_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_count INT;
  v_max INT;
BEGIN
  SELECT max_members INTO v_max FROM families WHERE id = NEW.family_id;
  SELECT COUNT(*) INTO v_count FROM family_members WHERE family_id = NEW.family_id;

  IF v_count >= COALESCE(v_max, 6) THEN
    RAISE EXCEPTION 'Family has reached maximum member limit of %', COALESCE(v_max, 6);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_family_limit ON family_members;
CREATE TRIGGER trg_enforce_family_limit
  BEFORE INSERT ON family_members
  FOR EACH ROW
  EXECUTE FUNCTION enforce_family_member_limit();
