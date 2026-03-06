-- SafeBite Supabase Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE,
  settings JSONB DEFAULT '{"notifications": true, "autoSync": true, "theme": "auto"}'::JSONB
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
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
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  dietary_rules JSONB DEFAULT '{}'::JSONB,
  avoid_ingredients TEXT[] DEFAULT '{}'::TEXT[]
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profiles" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own profiles" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profiles" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profiles" ON public.profiles
  FOR DELETE USING (auth.uid() = user_id);

-- Profile documents table
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

CREATE POLICY "Users can view own documents" ON public.profile_documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents" ON public.profile_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents" ON public.profile_documents
  FOR DELETE USING (auth.uid() = user_id);

-- Products cache table
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
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scan_count INTEGER DEFAULT 0
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products are viewable by everyone" ON public.products
  FOR SELECT USING (TRUE);

CREATE POLICY "Products can be inserted by authenticated users" ON public.products
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Products can be updated by authenticated users" ON public.products
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Scan history table
CREATE TABLE IF NOT EXISTS public.scan_history (
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

ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scan history" ON public.scan_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scan history" ON public.scan_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own scan history" ON public.scan_history
  FOR DELETE USING (auth.uid() = user_id);

-- Favorites table
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  product_name TEXT,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, profile_id, product_code)
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites" ON public.favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own favorites" ON public.favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites" ON public.favorites
  FOR DELETE USING (auth.uid() = user_id);

-- Shopping list table
CREATE TABLE IF NOT EXISTS public.shopping_list (
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

ALTER TABLE public.shopping_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own shopping list" ON public.shopping_list
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own shopping list" ON public.shopping_list
  FOR ALL USING (auth.uid() = user_id);

-- Analytics table
CREATE TABLE IF NOT EXISTS public.analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own analytics" ON public.analytics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all analytics" ON public.analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Recall cache table
CREATE TABLE IF NOT EXISTS public.recall_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_code TEXT,
  search_query TEXT,
  recalls JSONB DEFAULT '[]'::JSONB,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

ALTER TABLE public.recall_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recall cache is viewable by everyone" ON public.recall_cache
  FOR SELECT USING (TRUE);

-- Family groups table
CREATE TABLE IF NOT EXISTS public.family_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  member_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

-- User settings table (for active profile, view mode, etc.)
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  active_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  active_family_group_id UUID REFERENCES public.family_groups(id) ON DELETE SET NULL,
  view_mode TEXT DEFAULT 'individual' CHECK (view_mode IN ('individual', 'family')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own settings" ON public.user_settings
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_scan_history_user_id ON public.scan_history(user_id);
CREATE INDEX idx_scan_history_profile_id ON public.scan_history(profile_id);
CREATE INDEX idx_scan_history_scanned_at ON public.scan_history(scanned_at);
CREATE INDEX idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX idx_shopping_list_user_id ON public.shopping_list(user_id);
CREATE INDEX idx_analytics_user_id ON public.analytics(user_id);
CREATE INDEX idx_analytics_timestamp ON public.analytics(timestamp);
CREATE INDEX idx_products_code ON public.products(code);
CREATE INDEX idx_recall_cache_product_code ON public.recall_cache(product_code);
CREATE INDEX idx_recall_cache_expires_at ON public.recall_cache(expires_at);
CREATE INDEX idx_family_groups_user_id ON public.family_groups(user_id);
CREATE INDEX idx_profile_documents_user_id ON public.profile_documents(user_id);
CREATE INDEX idx_profile_documents_profile_id ON public.profile_documents(profile_id);
CREATE INDEX idx_user_settings_user_id ON public.user_settings(user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shopping_list_updated_at
  BEFORE UPDATE ON public.shopping_list
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_family_groups_updated_at
  BEFORE UPDATE ON public.family_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
