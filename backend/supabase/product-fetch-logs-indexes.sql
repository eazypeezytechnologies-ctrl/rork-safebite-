-- Performance indexes for product_fetch_logs table
-- These indexes optimize common query patterns for observability and analytics

-- Partial index for recent logs (last 30 days)
-- Significantly improves performance for dashboard queries and recent activity monitoring
create index if not exists product_fetch_logs_recent_idx
  on public.product_fetch_logs(created_at desc)
  where created_at > now() - interval '30 days';

-- Index for barcode lookups (common for debugging specific products)
create index if not exists product_fetch_logs_barcode_idx
  on public.product_fetch_logs(barcode);

-- Index for source analysis (helps identify which APIs are performing well)
create index if not exists product_fetch_logs_source_idx
  on public.product_fetch_logs(source);

-- Composite index for error analysis (find failures by source)
create index if not exists product_fetch_logs_source_success_idx
  on public.product_fetch_logs(source, success)
  where success = false;

-- Index for latency analysis (find slow requests)
create index if not exists product_fetch_logs_latency_idx
  on public.product_fetch_logs(latency_ms desc)
  where latency_ms > 1000;
