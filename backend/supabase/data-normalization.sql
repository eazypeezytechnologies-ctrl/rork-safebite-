-- Data Normalization Tables and Functions
-- Ensures consistent allergen detection across multiple data sources

-- Allergen Aliases Table - Maps various ingredient names to canonical allergens
create table if not exists public.allergen_aliases (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  alias text not null unique,
  confidence numeric(3,2) not null default 1.0,
  category text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists allergen_aliases_canonical_idx on public.allergen_aliases(canonical_name);
create index if not exists allergen_aliases_alias_idx on public.allergen_aliases(lower(alias));

-- Seed canonical allergens with common aliases
insert into public.allergen_aliases (canonical_name, alias, confidence, category) values
  -- Milk/Dairy
  ('Milk', 'milk', 1.0, 'dairy'),
  ('Milk', 'dairy', 1.0, 'dairy'),
  ('Milk', 'casein', 1.0, 'dairy'),
  ('Milk', 'caseinate', 1.0, 'dairy'),
  ('Milk', 'sodium caseinate', 1.0, 'dairy'),
  ('Milk', 'calcium caseinate', 1.0, 'dairy'),
  ('Milk', 'whey', 1.0, 'dairy'),
  ('Milk', 'whey protein', 1.0, 'dairy'),
  ('Milk', 'lactose', 1.0, 'dairy'),
  ('Milk', 'lactalbumin', 1.0, 'dairy'),
  ('Milk', 'lactoglobulin', 1.0, 'dairy'),
  ('Milk', 'cream', 0.95, 'dairy'),
  ('Milk', 'butter', 0.95, 'dairy'),
  ('Milk', 'butterfat', 1.0, 'dairy'),
  ('Milk', 'buttermilk', 1.0, 'dairy'),
  ('Milk', 'ghee', 0.9, 'dairy'),
  ('Milk', 'cheese', 1.0, 'dairy'),
  ('Milk', 'yogurt', 1.0, 'dairy'),
  ('Milk', 'yoghurt', 1.0, 'dairy'),
  ('Milk', 'kefir', 1.0, 'dairy'),
  ('Milk', 'curds', 0.95, 'dairy'),
  ('Milk', 'lactulose', 0.8, 'dairy'),
  ('Milk', 'milk solids', 1.0, 'dairy'),
  ('Milk', 'nonfat milk', 1.0, 'dairy'),
  ('Milk', 'skim milk', 1.0, 'dairy'),
  ('Milk', 'whole milk', 1.0, 'dairy'),
  ('Milk', 'milk powder', 1.0, 'dairy'),
  ('Milk', 'dried milk', 1.0, 'dairy'),
  ('Milk', 'condensed milk', 1.0, 'dairy'),
  ('Milk', 'evaporated milk', 1.0, 'dairy'),
  ('Milk', 'half and half', 1.0, 'dairy'),
  ('Milk', 'sour cream', 1.0, 'dairy'),
  ('Milk', 'ice cream', 0.95, 'dairy'),
  ('Milk', 'custard', 0.85, 'dairy'),
  ('Milk', 'pudding', 0.7, 'dairy'),
  ('Milk', 'recaldent', 0.9, 'dairy'),
  
  -- Egg
  ('Egg', 'egg', 1.0, 'egg'),
  ('Egg', 'eggs', 1.0, 'egg'),
  ('Egg', 'albumin', 1.0, 'egg'),
  ('Egg', 'albumen', 1.0, 'egg'),
  ('Egg', 'egg white', 1.0, 'egg'),
  ('Egg', 'egg yolk', 1.0, 'egg'),
  ('Egg', 'globulin', 0.8, 'egg'),
  ('Egg', 'livetin', 1.0, 'egg'),
  ('Egg', 'lysozyme', 0.9, 'egg'),
  ('Egg', 'mayonnaise', 0.95, 'egg'),
  ('Egg', 'meringue', 1.0, 'egg'),
  ('Egg', 'ovalbumin', 1.0, 'egg'),
  ('Egg', 'ovomucin', 1.0, 'egg'),
  ('Egg', 'ovomucoid', 1.0, 'egg'),
  ('Egg', 'ovovitellin', 1.0, 'egg'),
  ('Egg', 'silici albuminate', 0.85, 'egg'),
  ('Egg', 'vitellin', 1.0, 'egg'),
  ('Egg', 'dried egg', 1.0, 'egg'),
  ('Egg', 'egg powder', 1.0, 'egg'),
  ('Egg', 'egg lecithin', 1.0, 'egg'),
  ('Egg', 'whole egg', 1.0, 'egg'),
  
  -- Peanuts
  ('Peanuts', 'peanut', 1.0, 'legume'),
  ('Peanuts', 'peanuts', 1.0, 'legume'),
  ('Peanuts', 'groundnut', 1.0, 'legume'),
  ('Peanuts', 'groundnuts', 1.0, 'legume'),
  ('Peanuts', 'arachis', 1.0, 'legume'),
  ('Peanuts', 'arachis oil', 1.0, 'legume'),
  ('Peanuts', 'arachis hypogaea', 1.0, 'legume'),
  ('Peanuts', 'peanut oil', 0.85, 'legume'),
  ('Peanuts', 'peanut butter', 1.0, 'legume'),
  ('Peanuts', 'peanut flour', 1.0, 'legume'),
  ('Peanuts', 'beer nuts', 0.9, 'legume'),
  ('Peanuts', 'monkey nuts', 1.0, 'legume'),
  ('Peanuts', 'earth nuts', 0.95, 'legume'),
  ('Peanuts', 'mandelonas', 0.9, 'legume'),
  
  -- Tree Nuts
  ('Tree Nuts', 'almond', 1.0, 'tree_nut'),
  ('Tree Nuts', 'almonds', 1.0, 'tree_nut'),
  ('Tree Nuts', 'walnut', 1.0, 'tree_nut'),
  ('Tree Nuts', 'walnuts', 1.0, 'tree_nut'),
  ('Tree Nuts', 'cashew', 1.0, 'tree_nut'),
  ('Tree Nuts', 'cashews', 1.0, 'tree_nut'),
  ('Tree Nuts', 'pecan', 1.0, 'tree_nut'),
  ('Tree Nuts', 'pecans', 1.0, 'tree_nut'),
  ('Tree Nuts', 'pistachio', 1.0, 'tree_nut'),
  ('Tree Nuts', 'pistachios', 1.0, 'tree_nut'),
  ('Tree Nuts', 'hazelnut', 1.0, 'tree_nut'),
  ('Tree Nuts', 'hazelnuts', 1.0, 'tree_nut'),
  ('Tree Nuts', 'filbert', 1.0, 'tree_nut'),
  ('Tree Nuts', 'filberts', 1.0, 'tree_nut'),
  ('Tree Nuts', 'macadamia', 1.0, 'tree_nut'),
  ('Tree Nuts', 'macadamias', 1.0, 'tree_nut'),
  ('Tree Nuts', 'brazil nut', 1.0, 'tree_nut'),
  ('Tree Nuts', 'brazil nuts', 1.0, 'tree_nut'),
  ('Tree Nuts', 'pine nut', 1.0, 'tree_nut'),
  ('Tree Nuts', 'pine nuts', 1.0, 'tree_nut'),
  ('Tree Nuts', 'pignoli', 1.0, 'tree_nut'),
  ('Tree Nuts', 'praline', 0.9, 'tree_nut'),
  ('Tree Nuts', 'marzipan', 0.95, 'tree_nut'),
  ('Tree Nuts', 'nougat', 0.85, 'tree_nut'),
  ('Tree Nuts', 'gianduja', 0.95, 'tree_nut'),
  ('Tree Nuts', 'nut butter', 0.9, 'tree_nut'),
  ('Tree Nuts', 'nut meal', 0.95, 'tree_nut'),
  ('Tree Nuts', 'nut paste', 0.95, 'tree_nut'),
  ('Tree Nuts', 'chestnut', 1.0, 'tree_nut'),
  ('Tree Nuts', 'chestnuts', 1.0, 'tree_nut'),
  
  -- Soy
  ('Soy', 'soy', 1.0, 'legume'),
  ('Soy', 'soya', 1.0, 'legume'),
  ('Soy', 'soybean', 1.0, 'legume'),
  ('Soy', 'soybeans', 1.0, 'legume'),
  ('Soy', 'soy lecithin', 0.85, 'legume'),
  ('Soy', 'soya lecithin', 0.85, 'legume'),
  ('Soy', 'lecithin (soy)', 0.85, 'legume'),
  ('Soy', 'edamame', 1.0, 'legume'),
  ('Soy', 'tofu', 1.0, 'legume'),
  ('Soy', 'tempeh', 1.0, 'legume'),
  ('Soy', 'miso', 1.0, 'legume'),
  ('Soy', 'natto', 1.0, 'legume'),
  ('Soy', 'soy sauce', 1.0, 'legume'),
  ('Soy', 'shoyu', 1.0, 'legume'),
  ('Soy', 'tamari', 1.0, 'legume'),
  ('Soy', 'soy protein', 1.0, 'legume'),
  ('Soy', 'soy flour', 1.0, 'legume'),
  ('Soy', 'soy milk', 1.0, 'legume'),
  ('Soy', 'soybean oil', 0.7, 'legume'),
  ('Soy', 'textured vegetable protein', 0.85, 'legume'),
  ('Soy', 'tvp', 0.85, 'legume'),
  ('Soy', 'hydrolyzed soy protein', 1.0, 'legume'),
  
  -- Wheat/Gluten
  ('Wheat', 'wheat', 1.0, 'grain'),
  ('Wheat', 'gluten', 1.0, 'grain'),
  ('Wheat', 'flour', 0.9, 'grain'),
  ('Wheat', 'bread', 0.85, 'grain'),
  ('Wheat', 'semolina', 1.0, 'grain'),
  ('Wheat', 'durum', 1.0, 'grain'),
  ('Wheat', 'einkorn', 1.0, 'grain'),
  ('Wheat', 'emmer', 1.0, 'grain'),
  ('Wheat', 'farina', 1.0, 'grain'),
  ('Wheat', 'kamut', 1.0, 'grain'),
  ('Wheat', 'spelt', 1.0, 'grain'),
  ('Wheat', 'triticale', 1.0, 'grain'),
  ('Wheat', 'bulgur', 1.0, 'grain'),
  ('Wheat', 'couscous', 1.0, 'grain'),
  ('Wheat', 'seitan', 1.0, 'grain'),
  ('Wheat', 'wheat starch', 0.85, 'grain'),
  ('Wheat', 'wheat germ', 1.0, 'grain'),
  ('Wheat', 'wheat bran', 1.0, 'grain'),
  ('Wheat', 'wheat flour', 1.0, 'grain'),
  ('Wheat', 'whole wheat', 1.0, 'grain'),
  ('Wheat', 'cracker meal', 0.8, 'grain'),
  ('Wheat', 'hydrolyzed wheat protein', 1.0, 'grain'),
  ('Wheat', 'modified food starch', 0.5, 'grain'),
  
  -- Fish
  ('Fish', 'fish', 1.0, 'seafood'),
  ('Fish', 'anchovy', 1.0, 'seafood'),
  ('Fish', 'anchovies', 1.0, 'seafood'),
  ('Fish', 'salmon', 1.0, 'seafood'),
  ('Fish', 'tuna', 1.0, 'seafood'),
  ('Fish', 'cod', 1.0, 'seafood'),
  ('Fish', 'tilapia', 1.0, 'seafood'),
  ('Fish', 'halibut', 1.0, 'seafood'),
  ('Fish', 'bass', 0.95, 'seafood'),
  ('Fish', 'catfish', 1.0, 'seafood'),
  ('Fish', 'flounder', 1.0, 'seafood'),
  ('Fish', 'haddock', 1.0, 'seafood'),
  ('Fish', 'herring', 1.0, 'seafood'),
  ('Fish', 'mackerel', 1.0, 'seafood'),
  ('Fish', 'perch', 1.0, 'seafood'),
  ('Fish', 'pike', 1.0, 'seafood'),
  ('Fish', 'pollock', 1.0, 'seafood'),
  ('Fish', 'sardine', 1.0, 'seafood'),
  ('Fish', 'sardines', 1.0, 'seafood'),
  ('Fish', 'snapper', 1.0, 'seafood'),
  ('Fish', 'sole', 1.0, 'seafood'),
  ('Fish', 'swordfish', 1.0, 'seafood'),
  ('Fish', 'trout', 1.0, 'seafood'),
  ('Fish', 'fish sauce', 1.0, 'seafood'),
  ('Fish', 'fish oil', 0.9, 'seafood'),
  ('Fish', 'omega-3', 0.6, 'seafood'),
  ('Fish', 'surimi', 1.0, 'seafood'),
  ('Fish', 'worcestershire sauce', 0.7, 'seafood'),
  ('Fish', 'caesar dressing', 0.75, 'seafood'),
  
  -- Shellfish
  ('Shellfish', 'shellfish', 1.0, 'seafood'),
  ('Shellfish', 'shrimp', 1.0, 'seafood'),
  ('Shellfish', 'prawn', 1.0, 'seafood'),
  ('Shellfish', 'prawns', 1.0, 'seafood'),
  ('Shellfish', 'crab', 1.0, 'seafood'),
  ('Shellfish', 'lobster', 1.0, 'seafood'),
  ('Shellfish', 'crayfish', 1.0, 'seafood'),
  ('Shellfish', 'crawfish', 1.0, 'seafood'),
  ('Shellfish', 'langoustine', 1.0, 'seafood'),
  ('Shellfish', 'clam', 1.0, 'seafood'),
  ('Shellfish', 'clams', 1.0, 'seafood'),
  ('Shellfish', 'mussel', 1.0, 'seafood'),
  ('Shellfish', 'mussels', 1.0, 'seafood'),
  ('Shellfish', 'oyster', 1.0, 'seafood'),
  ('Shellfish', 'oysters', 1.0, 'seafood'),
  ('Shellfish', 'scallop', 1.0, 'seafood'),
  ('Shellfish', 'scallops', 1.0, 'seafood'),
  ('Shellfish', 'squid', 1.0, 'seafood'),
  ('Shellfish', 'calamari', 1.0, 'seafood'),
  ('Shellfish', 'octopus', 1.0, 'seafood'),
  ('Shellfish', 'snail', 0.9, 'seafood'),
  ('Shellfish', 'escargot', 0.9, 'seafood'),
  ('Shellfish', 'abalone', 1.0, 'seafood'),
  ('Shellfish', 'cockle', 1.0, 'seafood'),
  ('Shellfish', 'whelk', 1.0, 'seafood'),
  ('Shellfish', 'krill', 1.0, 'seafood'),
  
  -- Sesame
  ('Sesame', 'sesame', 1.0, 'seed'),
  ('Sesame', 'sesame seed', 1.0, 'seed'),
  ('Sesame', 'sesame seeds', 1.0, 'seed'),
  ('Sesame', 'sesame oil', 1.0, 'seed'),
  ('Sesame', 'tahini', 1.0, 'seed'),
  ('Sesame', 'tahina', 1.0, 'seed'),
  ('Sesame', 'halvah', 0.95, 'seed'),
  ('Sesame', 'halva', 0.95, 'seed'),
  ('Sesame', 'hummus', 0.8, 'seed'),
  ('Sesame', 'benne seeds', 1.0, 'seed'),
  ('Sesame', 'gingelly oil', 1.0, 'seed'),
  ('Sesame', 'sesamol', 1.0, 'seed'),
  ('Sesame', 'sesamolin', 1.0, 'seed'),
  
  -- Mustard
  ('Mustard', 'mustard', 1.0, 'spice'),
  ('Mustard', 'mustard seed', 1.0, 'spice'),
  ('Mustard', 'mustard oil', 1.0, 'spice'),
  ('Mustard', 'mustard flour', 1.0, 'spice'),
  ('Mustard', 'mustard powder', 1.0, 'spice'),
  
  -- Celery
  ('Celery', 'celery', 1.0, 'vegetable'),
  ('Celery', 'celeriac', 1.0, 'vegetable'),
  ('Celery', 'celery salt', 1.0, 'vegetable'),
  ('Celery', 'celery seed', 1.0, 'vegetable'),
  
  -- Lupin
  ('Lupin', 'lupin', 1.0, 'legume'),
  ('Lupin', 'lupine', 1.0, 'legume'),
  ('Lupin', 'lupini', 1.0, 'legume'),
  ('Lupin', 'lupin flour', 1.0, 'legume'),
  ('Lupin', 'lupin seed', 1.0, 'legume'),
  
  -- Mollusks
  ('Mollusks', 'mollusk', 1.0, 'seafood'),
  ('Mollusks', 'mollusks', 1.0, 'seafood'),
  ('Mollusks', 'mollusc', 1.0, 'seafood'),
  ('Mollusks', 'molluscs', 1.0, 'seafood'),
  
  -- Sulfites
  ('Sulfites', 'sulfite', 1.0, 'additive'),
  ('Sulfites', 'sulfites', 1.0, 'additive'),
  ('Sulfites', 'sulphite', 1.0, 'additive'),
  ('Sulfites', 'sulphites', 1.0, 'additive'),
  ('Sulfites', 'sulfur dioxide', 1.0, 'additive'),
  ('Sulfites', 'sulphur dioxide', 1.0, 'additive'),
  ('Sulfites', 'sodium sulfite', 1.0, 'additive'),
  ('Sulfites', 'sodium bisulfite', 1.0, 'additive'),
  ('Sulfites', 'sodium metabisulfite', 1.0, 'additive'),
  ('Sulfites', 'potassium bisulfite', 1.0, 'additive'),
  ('Sulfites', 'potassium metabisulfite', 1.0, 'additive')
on conflict (alias) do nothing;

-- Add updated_at trigger
create or replace function update_allergen_aliases_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists allergen_aliases_updated_at_trigger on public.allergen_aliases;
create trigger allergen_aliases_updated_at_trigger
  before update on public.allergen_aliases
  for each row
  execute function update_allergen_aliases_updated_at();

-- Extend products table with normalization fields
alter table public.products
  add column if not exists source_url text,
  add column if not exists confidence numeric(3,2) default 1.0,
  add column if not exists ingredients_raw text,
  add column if not exists ingredients_tokens text[],
  add column if not exists detected_allergens jsonb default '[]'::jsonb,
  add column if not exists normalized_at timestamptz;

-- Function to lookup canonical allergen from alias
create or replace function get_canonical_allergen(p_alias text)
returns table(canonical_name text, confidence numeric)
language sql stable
as $$
  select canonical_name, confidence
  from public.allergen_aliases
  where lower(alias) = lower(p_alias)
  limit 1;
$$;

-- Function to detect allergens in text using aliases table
create or replace function detect_allergens_in_text(p_text text)
returns jsonb
language plpgsql stable
as $$
declare
  v_result jsonb := '[]'::jsonb;
  v_alias record;
  v_lower_text text;
begin
  if p_text is null or p_text = '' then
    return v_result;
  end if;
  
  v_lower_text := lower(p_text);
  
  for v_alias in 
    select distinct on (canonical_name) 
      canonical_name, 
      alias,
      confidence,
      category
    from public.allergen_aliases
    where v_lower_text like '%' || lower(alias) || '%'
    order by canonical_name, confidence desc
  loop
    v_result := v_result || jsonb_build_object(
      'allergen', v_alias.canonical_name,
      'matched', v_alias.alias,
      'confidence', v_alias.confidence,
      'category', v_alias.category
    );
  end loop;
  
  return v_result;
end;
$$;

-- RLS policies
alter table public.allergen_aliases enable row level security;

create policy "Anyone can read allergen aliases"
  on public.allergen_aliases
  for select
  using (true);

create policy "Service role can manage allergen aliases"
  on public.allergen_aliases
  for all
  using (true)
  with check (true);

comment on table public.allergen_aliases is 'Maps ingredient aliases to canonical allergen names for consistent detection';
comment on column public.allergen_aliases.canonical_name is 'The standardized allergen name (e.g., Milk, Egg, Peanuts)';
comment on column public.allergen_aliases.alias is 'Alternative name or ingredient that indicates this allergen';
comment on column public.allergen_aliases.confidence is 'Confidence score 0-1 that this alias indicates the allergen';
comment on column public.allergen_aliases.category is 'Category grouping (dairy, legume, seafood, etc.)';
