-- Fix missing profile_id column in scan_history and favorites tables
-- Run this in Supabase SQL Editor

-- Check and add profile_id to scan_history if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'scan_history' 
        AND column_name = 'profile_id'
    ) THEN
        -- Add the column
        ALTER TABLE public.scan_history 
        ADD COLUMN profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
        
        -- Create index
        CREATE INDEX IF NOT EXISTS idx_scan_history_profile_id ON public.scan_history(profile_id);
        
        RAISE NOTICE 'Added profile_id column to scan_history table';
    ELSE
        RAISE NOTICE 'profile_id column already exists in scan_history table';
    END IF;
END $$;

-- Check and add profile_id to favorites if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'favorites' 
        AND column_name = 'profile_id'
    ) THEN
        -- Add the column
        ALTER TABLE public.favorites 
        ADD COLUMN profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
        
        -- Create index
        CREATE INDEX IF NOT EXISTS idx_favorites_profile_id ON public.favorites(profile_id);
        
        -- Add unique constraint
        ALTER TABLE public.favorites 
        DROP CONSTRAINT IF EXISTS favorites_user_id_profile_id_product_code_key;
        
        ALTER TABLE public.favorites 
        ADD CONSTRAINT favorites_user_id_profile_id_product_code_key 
        UNIQUE(user_id, profile_id, product_code);
        
        RAISE NOTICE 'Added profile_id column to favorites table';
    ELSE
        RAISE NOTICE 'profile_id column already exists in favorites table';
    END IF;
END $$;

-- Verify the changes
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('scan_history', 'favorites')
AND column_name = 'profile_id';

SELECT 'Migration completed - profile_id columns checked/added!' AS status;
