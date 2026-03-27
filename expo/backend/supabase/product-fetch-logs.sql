-- Product Fetch Logs Table
-- Enterprise-ready observability for product data acquisition

create table if not exists public.product_fetch_logs (
  id uuid primary key default gen_random_uuid(),
  barcode text not null,
  source text not null,
  success boolean not null,
  latency_ms int not null,
  error_message text,
  http_status int,
  from_cache boolean not null default false,
  cache_hit boolean,
  cache_expired boolean,
  confidence float,
  created_at timestamptz not null default now()
);

-- Data integrity constraints
alter table public.product_fetch_logs
  add constraint product_fetch_logs_latency_nonneg check (latency_ms >= 0);

alter table public.product_fetch_logs
  add constraint product_fetch_logs_http_status_range
  check (http_status is null or (http_status between 100 and 599));

alter table public.product_fetch_logs
  add constraint product_fetch_logs_confidence_range
  check (confidence is null or (confidence >= 0 and confidence <= 1));

-- Indexes for efficient querying
create index if not exists product_fetch_logs_barcode_idx 
  on public.product_fetch_logs(barcode);

create index if not exists product_fetch_logs_source_idx 
  on public.product_fetch_logs(source);

create index if not exists product_fetch_logs_created_at_idx 
  on public.product_fetch_logs(created_at desc);

create index if not exists product_fetch_logs_success_idx 
  on public.product_fetch_logs(success);

-- Composite index for common queries
create index if not exists product_fetch_logs_source_success_idx 
  on public.product_fetch_logs(source, success, created_at desc);

-- RLS policies
alter table public.product_fetch_logs enable row level security;

-- Drop overly-permissive policy if it exists
drop policy if exists "Service role can manage fetch logs" on public.product_fetch_logs;

-- Note: Service role bypasses RLS automatically in Supabase
-- No explicit policy needed for service role operations
-- This table should only be written to by backend services

-- Aggregate view for dashboard metrics
create or replace view public.product_fetch_stats as
select 
  source,
  count(*) as total_requests,
  count(*) filter (where success = true) as successful_requests,
  count(*) filter (where success = false) as failed_requests,
  round(100.0 * count(*) filter (where success = true) / nullif(count(*), 0), 2) as success_rate,
  round(avg(latency_ms)) as avg_latency_ms,
  round(percentile_cont(0.5) within group (order by latency_ms)) as p50_latency_ms,
  round(percentile_cont(0.95) within group (order by latency_ms)) as p95_latency_ms,
  round(percentile_cont(0.99) within group (order by latency_ms)) as p99_latency_ms,
  min(created_at) as first_request_at,
  max(created_at) as last_request_at
from public.product_fetch_logs
where created_at > now() - interval '24 hours'
group by source
order by total_requests desc;

-- Hourly stats for trending
create or replace view public.product_fetch_hourly_stats as
select 
  date_trunc('hour', created_at) as hour,
  source,
  count(*) as requests,
  count(*) filter (where success = true) as successes,
  round(avg(latency_ms)) as avg_latency_ms
from public.product_fetch_logs
where created_at > now() - interval '7 days'
group by date_trunc('hour', created_at), source
order by hour desc, requests desc;

-- Function to get fetch stats for a specific barcode
create or replace function get_barcode_fetch_history(p_barcode text, p_limit int default 20)
returns table (
  source text,
  success boolean,
  latency_ms int,
  error_message text,
  from_cache boolean,
  created_at timestamptz
)
language sql
as $$
  select source, success, latency_ms, error_message, from_cache, created_at
  from public.product_fetch_logs
  where barcode = p_barcode
  order by created_at desc
  limit p_limit;
$$;

-- Cleanup function to remove old logs (keep 30 days by default)
create or replace function cleanup_old_fetch_logs(p_days_to_keep int default 30)
returns int
language plpgsql
as $$
declare
  v_deleted int;
begin
  delete from public.product_fetch_logs 
  where created_at < now() - (p_days_to_keep || ' days')::interval;
  
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;
