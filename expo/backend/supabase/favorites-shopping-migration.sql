-- FAVORITES
-- Note: products table uses 'code TEXT' as primary key, not 'id UUID'
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_code text not null,
  product_name text,
  created_at timestamptz not null default now(),
  unique (user_id, product_code)
);

alter table public.favorites enable row level security;

drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own"
on public.favorites for select
using (user_id = auth.uid());

drop policy if exists "favorites_write_own" on public.favorites;
create policy "favorites_write_own"
on public.favorites for insert
with check (user_id = auth.uid());

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own"
on public.favorites for delete
using (user_id = auth.uid());


-- SHOPPING LIST
create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_code text,
  label text,
  quantity int not null default 1,
  checked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.shopping_list_items enable row level security;

drop policy if exists "shopping_select_own" on public.shopping_list_items;
create policy "shopping_select_own"
on public.shopping_list_items for select
using (user_id = auth.uid());

drop policy if exists "shopping_write_own" on public.shopping_list_items;
create policy "shopping_write_own"
on public.shopping_list_items for insert
with check (user_id = auth.uid());

drop policy if exists "shopping_update_own" on public.shopping_list_items;
create policy "shopping_update_own"
on public.shopping_list_items for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "shopping_delete_own" on public.shopping_list_items;
create policy "shopping_delete_own"
on public.shopping_list_items for delete
using (user_id = auth.uid());


-- SCAN HISTORY (alternative simpler version)
-- Note: The main schema.sql has a more complete scan_history table
-- This is a simplified version if you need to create it fresh
create table if not exists public.scan_history_simple (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_code text,
  barcode text,
  scanned_at timestamptz not null default now()
);

alter table public.scan_history_simple enable row level security;

drop policy if exists "scan_history_simple_select_own" on public.scan_history_simple;
create policy "scan_history_simple_select_own"
on public.scan_history_simple for select
using (user_id = auth.uid());

drop policy if exists "scan_history_simple_write_own" on public.scan_history_simple;
create policy "scan_history_simple_write_own"
on public.scan_history_simple for insert
with check (user_id = auth.uid());

drop policy if exists "scan_history_simple_delete_own" on public.scan_history_simple;
create policy "scan_history_simple_delete_own"
on public.scan_history_simple for delete
using (user_id = auth.uid());

-- Indexes for performance
create index if not exists idx_favorites_user_product on public.favorites(user_id, product_code);
create index if not exists idx_shopping_list_items_user on public.shopping_list_items(user_id);
create index if not exists idx_scan_history_simple_user on public.scan_history_simple(user_id);


