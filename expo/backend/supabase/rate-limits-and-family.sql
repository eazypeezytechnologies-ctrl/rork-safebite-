-- ============================================
-- RATE LIMITS AND FAMILY GROUPS MIGRATION
-- ============================================
-- IMPORTANT: Run schema.sql first, OR uncomment the family_groups section below
-- This file assumes public.family_groups already exists from schema.sql

-- Rate Limits Table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: clients cannot directly access this table

-- Rate Limit Check Function
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

-- Revoke from anon, grant to authenticated
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INT, INT) TO authenticated;


-- ============================================
-- FAMILY GROUPS (if not created by schema.sql)
-- ============================================
-- Uncomment this block if family_groups doesn't exist yet:
/*
CREATE TABLE IF NOT EXISTS public.family_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  member_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.family_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own family groups" ON public.family_groups
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own family groups" ON public.family_groups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own family groups" ON public.family_groups
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own family groups" ON public.family_groups
  FOR DELETE USING (auth.uid() = user_id);
*/

-- ============================================
-- FAMILY GROUP MEMBERS (many-to-many relationship)
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


-- Family Group Invites Table
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


-- Indexes
CREATE INDEX IF NOT EXISTS idx_family_group_members_user ON public.family_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_group_members_group ON public.family_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_family_group_invites_token ON public.family_group_invites(token);
CREATE INDEX IF NOT EXISTS idx_family_group_invites_email ON public.family_group_invites(invited_email);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON public.rate_limits(reset_at);
