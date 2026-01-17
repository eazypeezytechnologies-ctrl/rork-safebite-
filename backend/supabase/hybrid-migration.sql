-- SafeBite: Hybrid Migration
-- Adds lookup tables for allergies and diets while keeping existing TEXT[] fields
-- This is NON-DESTRUCTIVE - existing data and functionality remain intact

-- ==========================================
-- STEP 1: CREATE LOOKUP TABLES
-- ==========================================

-- Allergies lookup table with common allergens
CREATE TABLE IF NOT EXISTS public.allergies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  category TEXT,
  description TEXT,
  severity_info TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Diets lookup table
CREATE TABLE IF NOT EXISTS public.diets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  restrictions TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- STEP 2: CREATE JOIN TABLES
-- ==========================================

-- Profile allergies join table (normalized relationship)
CREATE TABLE IF NOT EXISTS public.profile_allergies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  allergy_id UUID NOT NULL REFERENCES public.allergies(id) ON DELETE RESTRICT,
  severity TEXT NOT NULL DEFAULT 'moderate' CHECK (severity IN ('mild', 'moderate', 'severe')),
  notes TEXT,
  diagnosed_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(profile_id, allergy_id)
);

-- Profile diets join table
CREATE TABLE IF NOT EXISTS public.profile_diets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  diet_id UUID NOT NULL REFERENCES public.diets(id) ON DELETE RESTRICT,
  start_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(profile_id, diet_id)
);

-- ==========================================
-- STEP 3: ADD OPTIONAL COLUMNS TO PROFILES
-- ==========================================

-- Add diets array for backward compatibility (similar to existing allergens)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS diets TEXT[] DEFAULT '{}';

-- Add allergy severity map for enhanced tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS allergy_severities JSONB DEFAULT '{}'::JSONB;

-- ==========================================
-- STEP 4: ENABLE RLS
-- ==========================================

ALTER TABLE public.allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_diets ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- STEP 5: CREATE POLICIES
-- ==========================================

-- Allergies: Public read (lookup table)
DROP POLICY IF EXISTS "Allergies are viewable by everyone" ON public.allergies;
CREATE POLICY "Allergies are viewable by everyone" ON public.allergies
  FOR SELECT USING (TRUE);

-- Allergies: Only admins can modify
DROP POLICY IF EXISTS "Admins can manage allergies" ON public.allergies;
CREATE POLICY "Admins can manage allergies" ON public.allergies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Diets: Public read (lookup table)
DROP POLICY IF EXISTS "Diets are viewable by everyone" ON public.diets;
CREATE POLICY "Diets are viewable by everyone" ON public.diets
  FOR SELECT USING (TRUE);

-- Diets: Only admins can modify
DROP POLICY IF EXISTS "Admins can manage diets" ON public.diets;
CREATE POLICY "Admins can manage diets" ON public.diets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Profile allergies: Users can manage their own profile's allergies
DROP POLICY IF EXISTS "Users can view own profile allergies" ON public.profile_allergies;
CREATE POLICY "Users can view own profile allergies" ON public.profile_allergies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = profile_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage own profile allergies" ON public.profile_allergies;
CREATE POLICY "Users can manage own profile allergies" ON public.profile_allergies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = profile_id AND p.user_id = auth.uid()
    )
  );

-- Profile diets: Users can manage their own profile's diets
DROP POLICY IF EXISTS "Users can view own profile diets" ON public.profile_diets;
CREATE POLICY "Users can view own profile diets" ON public.profile_diets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = profile_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage own profile diets" ON public.profile_diets;
CREATE POLICY "Users can manage own profile diets" ON public.profile_diets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = profile_id AND p.user_id = auth.uid()
    )
  );

-- ==========================================
-- STEP 6: CREATE INDEXES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_allergies_name ON public.allergies(name);
CREATE INDEX IF NOT EXISTS idx_diets_name ON public.diets(name);
CREATE INDEX IF NOT EXISTS idx_profile_allergies_profile_id ON public.profile_allergies(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_allergies_allergy_id ON public.profile_allergies(allergy_id);
CREATE INDEX IF NOT EXISTS idx_profile_diets_profile_id ON public.profile_diets(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_diets_diet_id ON public.profile_diets(diet_id);

-- ==========================================
-- STEP 7: SEED COMMON ALLERGIES
-- ==========================================

INSERT INTO public.allergies (name, aliases, category, description, severity_info) VALUES
  ('Peanuts', ARRAY['peanut', 'groundnut', 'arachis', 'monkey nuts'], 'Legumes', 'One of the most common and severe food allergies', 'Can cause anaphylaxis'),
  ('Tree Nuts', ARRAY['almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'brazil nut', 'macadamia', 'hazelnut', 'chestnut'], 'Nuts', 'Allergy to nuts that grow on trees', 'Can cause anaphylaxis'),
  ('Milk', ARRAY['dairy', 'lactose', 'casein', 'whey', 'cream', 'butter', 'cheese', 'yogurt'], 'Dairy', 'Allergy to cow''s milk proteins', 'Severity varies; can cause anaphylaxis'),
  ('Eggs', ARRAY['egg', 'albumin', 'globulin', 'lysozyme', 'mayonnaise', 'meringue'], 'Animal Products', 'Allergy to egg proteins (usually whites)', 'Severity varies'),
  ('Wheat', ARRAY['gluten', 'flour', 'bread', 'semolina', 'durum', 'spelt', 'kamut'], 'Grains', 'Allergy to wheat proteins', 'Different from celiac disease'),
  ('Soy', ARRAY['soya', 'soybean', 'edamame', 'tofu', 'tempeh', 'miso', 'soy sauce'], 'Legumes', 'Allergy to soybean proteins', 'Usually mild; can cause anaphylaxis'),
  ('Fish', ARRAY['cod', 'salmon', 'tuna', 'halibut', 'sardine', 'anchovy', 'bass', 'trout'], 'Seafood', 'Allergy to finned fish', 'Can cause anaphylaxis'),
  ('Shellfish', ARRAY['shrimp', 'crab', 'lobster', 'clam', 'mussel', 'oyster', 'scallop', 'crawfish'], 'Seafood', 'Allergy to crustaceans and mollusks', 'Can cause anaphylaxis'),
  ('Sesame', ARRAY['sesame seeds', 'tahini', 'halvah', 'hummus'], 'Seeds', 'Allergy to sesame seeds and oil', 'Increasing prevalence; can cause anaphylaxis'),
  ('Mustard', ARRAY['mustard seed', 'mustard oil', 'mustard powder'], 'Spices', 'Allergy to mustard seeds', 'Common in Europe'),
  ('Celery', ARRAY['celeriac', 'celery salt', 'celery seed'], 'Vegetables', 'Allergy to celery and celeriac', 'Common in Europe'),
  ('Lupin', ARRAY['lupine', 'lupini beans'], 'Legumes', 'Allergy to lupin beans and flour', 'Cross-reactivity with peanuts'),
  ('Mollusks', ARRAY['squid', 'octopus', 'snail', 'escargot'], 'Seafood', 'Allergy to mollusks', 'May be separate from shellfish allergy'),
  ('Sulfites', ARRAY['sulphites', 'sulfur dioxide', 'sodium sulfite', 'sodium bisulfite'], 'Preservatives', 'Sensitivity to sulfite preservatives', 'Common in wine and dried fruits'),
  ('Corn', ARRAY['maize', 'cornstarch', 'corn syrup', 'corn oil', 'popcorn'], 'Grains', 'Allergy to corn proteins', 'Can be difficult to avoid'),
  ('Coconut', ARRAY['coconut oil', 'coconut milk', 'coconut cream'], 'Tree Nuts', 'Allergy to coconut (botanically a fruit)', 'FDA classifies as tree nut'),
  ('Latex-Fruit', ARRAY['banana', 'avocado', 'kiwi', 'chestnut', 'papaya', 'mango'], 'Cross-Reactive', 'Foods that cross-react with latex allergy', 'Common in latex-allergic individuals'),
  ('Red Meat', ARRAY['beef', 'pork', 'lamb', 'alpha-gal'], 'Animal Products', 'Alpha-gal syndrome (tick-bite related)', 'Delayed reaction (3-6 hours)')
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  severity_info = EXCLUDED.severity_info;

-- ==========================================
-- STEP 8: SEED COMMON DIETS
-- ==========================================

INSERT INTO public.diets (name, description, restrictions) VALUES
  ('Vegetarian', 'No meat or fish, may include dairy and eggs', ARRAY['meat', 'poultry', 'fish', 'seafood']),
  ('Vegan', 'No animal products of any kind', ARRAY['meat', 'poultry', 'fish', 'seafood', 'dairy', 'eggs', 'honey', 'gelatin']),
  ('Pescatarian', 'Vegetarian diet that includes fish and seafood', ARRAY['meat', 'poultry']),
  ('Gluten-Free', 'No gluten-containing grains', ARRAY['wheat', 'barley', 'rye', 'triticale', 'spelt', 'kamut']),
  ('Dairy-Free', 'No dairy products', ARRAY['milk', 'cheese', 'butter', 'cream', 'yogurt', 'casein', 'whey']),
  ('Keto', 'Very low carbohydrate, high fat diet', ARRAY['sugar', 'grains', 'starches', 'most fruits']),
  ('Paleo', 'Based on foods presumed available to Paleolithic humans', ARRAY['grains', 'legumes', 'dairy', 'refined sugar', 'processed foods']),
  ('Halal', 'Foods permissible under Islamic law', ARRAY['pork', 'alcohol', 'non-halal meat']),
  ('Kosher', 'Foods conforming to Jewish dietary laws', ARRAY['pork', 'shellfish', 'mixing meat and dairy']),
  ('Low-FODMAP', 'Reduces fermentable carbohydrates', ARRAY['high-fructose foods', 'lactose', 'wheat', 'garlic', 'onion', 'legumes']),
  ('Whole30', '30-day elimination diet', ARRAY['sugar', 'alcohol', 'grains', 'legumes', 'soy', 'dairy']),
  ('Mediterranean', 'Based on traditional Mediterranean cuisine', ARRAY['processed foods', 'refined grains', 'added sugars']),
  ('Low-Sodium', 'Reduced sodium intake', ARRAY['high-sodium foods', 'processed foods', 'cured meats']),
  ('Diabetic-Friendly', 'Blood sugar management focused', ARRAY['high-glycemic foods', 'added sugars', 'refined carbs']),
  ('Raw Food', 'Primarily uncooked, unprocessed foods', ARRAY['cooked foods', 'processed foods', 'pasteurized items'])
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  restrictions = EXCLUDED.restrictions;

-- ==========================================
-- STEP 9: HELPER FUNCTIONS
-- ==========================================

-- Function to sync TEXT[] allergens to normalized table
CREATE OR REPLACE FUNCTION sync_profile_allergens_to_normalized()
RETURNS TRIGGER AS $$
DECLARE
  allergen_name TEXT;
  allergy_uuid UUID;
BEGIN
  -- Only process if allergens array changed
  IF OLD.allergens IS DISTINCT FROM NEW.allergens THEN
    -- Remove existing normalized allergies for this profile
    DELETE FROM public.profile_allergies WHERE profile_id = NEW.id;
    
    -- Add new normalized allergies
    IF NEW.allergens IS NOT NULL AND array_length(NEW.allergens, 1) > 0 THEN
      FOREACH allergen_name IN ARRAY NEW.allergens LOOP
        -- Find matching allergy (case-insensitive)
        SELECT id INTO allergy_uuid 
        FROM public.allergies 
        WHERE LOWER(name) = LOWER(allergen_name)
           OR LOWER(allergen_name) = ANY(SELECT LOWER(unnest(aliases)));
        
        -- If found, create the relationship
        IF allergy_uuid IS NOT NULL THEN
          INSERT INTO public.profile_allergies (profile_id, allergy_id, severity)
          VALUES (NEW.id, allergy_uuid, COALESCE(
            (NEW.allergy_severities->>allergen_name)::TEXT, 
            'moderate'
          ))
          ON CONFLICT (profile_id, allergy_id) DO UPDATE SET
            severity = EXCLUDED.severity;
        END IF;
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all allergen names for a profile (combining both sources)
CREATE OR REPLACE FUNCTION get_profile_allergens(p_profile_id UUID)
RETURNS TEXT[] AS $$
DECLARE
  result TEXT[];
BEGIN
  -- Get allergens from normalized table
  SELECT ARRAY_AGG(DISTINCT a.name)
  INTO result
  FROM public.profile_allergies pa
  JOIN public.allergies a ON a.id = pa.allergy_id
  WHERE pa.profile_id = p_profile_id;
  
  -- If empty, fall back to TEXT[] column
  IF result IS NULL OR array_length(result, 1) IS NULL THEN
    SELECT allergens INTO result
    FROM public.profiles
    WHERE id = p_profile_id;
  END IF;
  
  RETURN COALESCE(result, '{}');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get profile with enriched allergy data
CREATE OR REPLACE FUNCTION get_profile_with_allergies(p_profile_id UUID)
RETURNS TABLE (
  profile_id UUID,
  profile_name TEXT,
  allergy_name TEXT,
  allergy_category TEXT,
  severity TEXT,
  aliases TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    a.name,
    a.category,
    pa.severity,
    a.aliases
  FROM public.profiles p
  LEFT JOIN public.profile_allergies pa ON pa.profile_id = p.id
  LEFT JOIN public.allergies a ON a.id = pa.allergy_id
  WHERE p.id = p_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- STEP 10: CREATE SYNC TRIGGER (OPTIONAL)
-- Uncomment to auto-sync TEXT[] to normalized tables
-- ==========================================

-- DROP TRIGGER IF EXISTS sync_allergens_trigger ON public.profiles;
-- CREATE TRIGGER sync_allergens_trigger
--   AFTER INSERT OR UPDATE ON public.profiles
--   FOR EACH ROW
--   EXECUTE FUNCTION sync_profile_allergens_to_normalized();

-- ==========================================
-- STEP 11: GRANT PERMISSIONS
-- ==========================================

GRANT SELECT ON public.allergies TO anon, authenticated;
GRANT SELECT ON public.diets TO anon, authenticated;
GRANT ALL ON public.profile_allergies TO authenticated;
GRANT ALL ON public.profile_diets TO authenticated;
GRANT EXECUTE ON FUNCTION get_profile_allergens TO authenticated;
GRANT EXECUTE ON FUNCTION get_profile_with_allergies TO authenticated;

-- ==========================================
-- VERIFICATION
-- ==========================================

SELECT 'Hybrid migration completed!' AS status;
SELECT 'Tables created: allergies, diets, profile_allergies, profile_diets' AS tables;
SELECT COUNT(*) || ' allergies seeded' AS allergies FROM public.allergies;
SELECT COUNT(*) || ' diets seeded' AS diets FROM public.diets;
