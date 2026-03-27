-- SafeBite: Complete Database Reset and Migration
-- This script safely checks current state and creates/fixes all tables
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- STEP 1: Check and create base tables first
-- ==========================================

-- Create users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        CREATE TABLE public.users (
          id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
          email TEXT NOT NULL UNIQUE,
          is_admin BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_login_at TIMESTAMP WITH TIME ZONE,
          settings JSONB DEFAULT '{"notifications": true, "autoSync": true, "theme": "auto"}'::JSONB
        );
        RAISE NOTICE 'Created users table';
    END IF;
END $$;

-- Create profiles table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        CREATE TABLE public.profiles (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE 'Created profiles table';
    END IF;
END $$;

-- Create products table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
        CREATE TABLE public.products (
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
          cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          scan_count INTEGER DEFAULT 0
        );
        RAISE NOTICE 'Created products table';
    END IF;
END $$;

-- ==========================================
-- STEP 2: Create scan_history table
-- ==========================================

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scan_history') THEN
        CREATE TABLE public.scan_history (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
          product_code TEXT NOT NULL,
          product_name TEXT,
          verdict TEXT NOT NULL CHECK (verdict IN ('safe', 'caution', 'danger')),
          scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          location JSONB,
          synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE 'Created scan_history table';
    ELSE
        -- Table exists, check if profile_id column exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'scan_history' AND column_name = 'profile_id'
        ) THEN
            ALTER TABLE public.scan_history ADD COLUMN profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added profile_id to scan_history';
        END IF;
    END IF;
END $$;

-- ==========================================
-- STEP 3: Create favorites table
-- ==========================================

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'favorites') THEN
        CREATE TABLE public.favorites (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
          product_code TEXT NOT NULL,
          product_name TEXT,
          added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, profile_id, product_code)
        );
        RAISE NOTICE 'Created favorites table';
    ELSE
        -- Table exists, check if profile_id column exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'favorites' AND column_name = 'profile_id'
        ) THEN
            ALTER TABLE public.favorites ADD COLUMN profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added profile_id to favorites';
            
            -- Add unique constraint
            ALTER TABLE public.favorites DROP CONSTRAINT IF EXISTS favorites_user_id_profile_id_product_code_key;
            ALTER TABLE public.favorites ADD CONSTRAINT favorites_user_id_profile_id_product_code_key UNIQUE(user_id, profile_id, product_code);
        END IF;
    END IF;
END $$;

-- ==========================================
-- STEP 4: Create remaining tables
-- ==========================================

-- Create shopping_list table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shopping_list') THEN
        CREATE TABLE public.shopping_list (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          product_code TEXT,
          product_name TEXT NOT NULL,
          quantity INTEGER DEFAULT 1,
          checked BOOLEAN DEFAULT FALSE,
          added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE 'Created shopping_list table';
    END IF;
END $$;

-- Create analytics table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'analytics') THEN
        CREATE TABLE public.analytics (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL,
          event_data JSONB,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE 'Created analytics table';
    END IF;
END $$;

-- Create recall_cache table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recall_cache') THEN
        CREATE TABLE public.recall_cache (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          product_code TEXT,
          search_query TEXT,
          recalls JSONB DEFAULT '[]'::JSONB,
          cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL
        );
        RAISE NOTICE 'Created recall_cache table';
    END IF;
END $$;

-- ==========================================
-- STEP 5: Enable RLS on all tables
-- ==========================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recall_cache ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- STEP 6: Create/replace all policies
-- ==========================================

-- Users policies
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
CREATE POLICY "Users can view own data" ON public.users FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own data" ON public.users;
CREATE POLICY "Users can update own data" ON public.users FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own data" ON public.users;
CREATE POLICY "Users can insert own data" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- Profiles policies
DROP POLICY IF EXISTS "Users can view own profiles" ON public.profiles;
CREATE POLICY "Users can view own profiles" ON public.profiles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own profiles" ON public.profiles;
CREATE POLICY "Users can create own profiles" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profiles" ON public.profiles;
CREATE POLICY "Users can update own profiles" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own profiles" ON public.profiles;
CREATE POLICY "Users can delete own profiles" ON public.profiles FOR DELETE USING (auth.uid() = user_id);

-- Products policies
DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
CREATE POLICY "Products are viewable by everyone" ON public.products FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Products can be inserted by authenticated users" ON public.products;
CREATE POLICY "Products can be inserted by authenticated users" ON public.products FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Products can be updated by authenticated users" ON public.products;
CREATE POLICY "Products can be updated by authenticated users" ON public.products FOR UPDATE USING (auth.role() = 'authenticated');

-- Scan history policies
DROP POLICY IF EXISTS "Users can view own scan history" ON public.scan_history;
CREATE POLICY "Users can view own scan history" ON public.scan_history FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own scan history" ON public.scan_history;
CREATE POLICY "Users can insert own scan history" ON public.scan_history FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own scan history" ON public.scan_history;
CREATE POLICY "Users can delete own scan history" ON public.scan_history FOR DELETE USING (auth.uid() = user_id);

-- Favorites policies
DROP POLICY IF EXISTS "Users can view own favorites" ON public.favorites;
CREATE POLICY "Users can view own favorites" ON public.favorites FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own favorites" ON public.favorites;
CREATE POLICY "Users can create own favorites" ON public.favorites FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own favorites" ON public.favorites;
CREATE POLICY "Users can delete own favorites" ON public.favorites FOR DELETE USING (auth.uid() = user_id);

-- Shopping list policies
DROP POLICY IF EXISTS "Users can view own shopping list" ON public.shopping_list;
CREATE POLICY "Users can view own shopping list" ON public.shopping_list FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own shopping list" ON public.shopping_list;
CREATE POLICY "Users can manage own shopping list" ON public.shopping_list FOR ALL USING (auth.uid() = user_id);

-- Analytics policies
DROP POLICY IF EXISTS "Users can insert own analytics" ON public.analytics;
CREATE POLICY "Users can insert own analytics" ON public.analytics FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all analytics" ON public.analytics;
CREATE POLICY "Admins can view all analytics" ON public.analytics FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Recall cache policies
DROP POLICY IF EXISTS "Recall cache is viewable by everyone" ON public.recall_cache;
CREATE POLICY "Recall cache is viewable by everyone" ON public.recall_cache FOR SELECT USING (TRUE);

-- ==========================================
-- STEP 7: Create indexes
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_user_id ON public.scan_history(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_profile_id ON public.scan_history(profile_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_scanned_at ON public.scan_history(scanned_at);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_profile_id ON public.favorites(profile_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_user_id ON public.shopping_list(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON public.analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON public.analytics(timestamp);
CREATE INDEX IF NOT EXISTS idx_products_code ON public.products(code);
CREATE INDEX IF NOT EXISTS idx_recall_cache_product_code ON public.recall_cache(product_code);
CREATE INDEX IF NOT EXISTS idx_recall_cache_expires_at ON public.recall_cache(expires_at);

-- ==========================================
-- STEP 8: Create triggers and functions
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

CREATE OR REPLACE FUNCTION increment_scan_count(product_code TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.products
  SET scan_count = scan_count + 1, last_fetched_at = NOW()
  WHERE code = product_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- STEP 9: Grant permissions
-- ==========================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- ==========================================
-- VERIFICATION
-- ==========================================

SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') AS columns
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name IN ('users', 'profiles', 'products', 'scan_history', 'favorites', 'shopping_list', 'analytics', 'recall_cache')
ORDER BY table_name;

SELECT '✅ Database migration completed successfully!' AS status;
