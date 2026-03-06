-- SafeBite: Profile Documents + Dietary Fields Migration
-- Run this in the Supabase SQL Editor

-- ==========================================
-- STEP 1: CREATE profile_documents TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.profile_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profile_documents ENABLE ROW LEVEL SECURITY;

-- Only owner can select their documents
CREATE POLICY "Users can view own documents"
  ON public.profile_documents
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only owner can insert their documents
CREATE POLICY "Users can insert own documents"
  ON public.profile_documents
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only owner can delete their documents
CREATE POLICY "Users can delete own documents"
  ON public.profile_documents
  FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_profile_documents_user_id
  ON public.profile_documents(user_id);

CREATE INDEX IF NOT EXISTS idx_profile_documents_profile_id
  ON public.profile_documents(profile_id);

-- ==========================================
-- STEP 2: EXTEND profiles TABLE
-- ==========================================

-- Add dietary_rules jsonb column (if not present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'dietary_rules'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN dietary_rules JSONB DEFAULT '{}'::JSONB;
  END IF;
END $$;

-- Add avoid_ingredients text[] column (if not present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'avoid_ingredients'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN avoid_ingredients TEXT[] DEFAULT '{}'::TEXT[];
  END IF;
END $$;

-- ==========================================
-- STEP 3: CREATE STORAGE BUCKET (private)
-- ==========================================

-- Create the storage bucket for profile documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-documents', 'profile-documents', false)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- STEP 4: STORAGE RLS POLICIES
-- ==========================================

-- Owner can upload files to their own folder: profile-documents/{user_id}/...
CREATE POLICY "Users can upload own profile documents"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'profile-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Owner can read their own files
CREATE POLICY "Users can read own profile documents"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'profile-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Owner can delete their own files
CREATE POLICY "Users can delete own profile documents"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'profile-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ==========================================
-- STEP 5: GRANT PERMISSIONS
-- ==========================================

GRANT ALL ON public.profile_documents TO authenticated;

-- ==========================================
-- VERIFICATION
-- ==========================================

SELECT 'profile_documents table' AS item,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profile_documents'
  ) AS created;

SELECT 'dietary_rules column' AS item,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'dietary_rules'
  ) AS exists;

SELECT 'avoid_ingredients column' AS item,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avoid_ingredients'
  ) AS exists;

SELECT 'profile-documents bucket' AS item,
  EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'profile-documents'
  ) AS exists;

SELECT '✅ Profile documents migration completed!' AS message;
