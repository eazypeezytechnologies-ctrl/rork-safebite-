-- Product Fetch Locks Table
-- Prevents thundering herd problem when multiple users scan the same uncached barcode

create table if not exists public.product_fetch_locks (
  barcode text primary key,
  locked_at timestamptz not null default now(),
  locked_by text,
  expires_at timestamptz not null default (now() + interval '30 seconds')
);

-- Index for cleanup of expired locks
create index if not exists product_fetch_locks_expires_idx 
  on public.product_fetch_locks(expires_at);

-- Function to acquire a lock (returns true if lock acquired, false if already locked)
create or replace function acquire_product_fetch_lock(
  p_barcode text,
  p_locked_by text default null,
  p_ttl_seconds int default 30
)
returns boolean
language plpgsql
as $$
declare
  v_acquired boolean := false;
begin
  -- Delete expired locks first
  delete from public.product_fetch_locks 
  where expires_at < now();

  -- Try to insert a new lock
  insert into public.product_fetch_locks (barcode, locked_by, locked_at, expires_at)
  values (p_barcode, p_locked_by, now(), now() + (p_ttl_seconds || ' seconds')::interval)
  on conflict (barcode) do nothing;

  -- Check if we got the lock
  select exists(
    select 1 from public.product_fetch_locks 
    where barcode = p_barcode 
    and (locked_by = p_locked_by or p_locked_by is null)
    and locked_at = (select max(locked_at) from public.product_fetch_locks where barcode = p_barcode)
  ) into v_acquired;

  return v_acquired;
end;
$$;

-- Function to release a lock
create or replace function release_product_fetch_lock(p_barcode text)
returns void
language plpgsql
as $$
begin
  delete from public.product_fetch_locks where barcode = p_barcode;
end;
$$;

-- Function to check if a barcode is currently locked
create or replace function is_product_fetch_locked(p_barcode text)
returns boolean
language plpgsql
as $$
begin
  return exists(
    select 1 from public.product_fetch_locks 
    where barcode = p_barcode 
    and expires_at > now()
  );
end;
$$;

-- Cleanup function to remove expired locks (can be called periodically)
create or replace function cleanup_expired_product_fetch_locks()
returns int
language plpgsql
as $$
declare
  v_deleted int;
begin
  delete from public.product_fetch_locks 
  where expires_at < now();
  
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- RLS policies
alter table public.product_fetch_locks enable row level security;

-- Allow backend service role full access
create policy "Service role can manage locks"
  on public.product_fetch_locks
  for all
  using (true)
  with check (true);
