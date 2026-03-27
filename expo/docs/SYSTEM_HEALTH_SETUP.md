# SafeBite System Health & Auto-Remediation Setup Guide

This document provides complete instructions for setting up the automated system health monitoring and self-scan functionality.

## Overview

The system provides:
- **Automated Health Checks**: Daily scans of auth, database, APIs, queues, and storage
- **Auto-Remediation**: Automatic fixes for common issues (stuck jobs, stale cache)
- **Alert System**: Severity-based alerts with acknowledgment workflow
- **Admin Dashboard**: "While you were away" feed showing system activity

## Prerequisites

- Supabase project with Edge Functions enabled
- Admin access to Supabase Dashboard
- Environment variables configured (see below)

---

## Step 1: Run Database Migration

Execute the SQL migration to create the required tables:

```sql
-- Run this in Supabase SQL Editor
-- File: backend/supabase/system-health-migration.sql
```

This creates:
- `system_health_runs` - Track health check executions
- `system_health_checks` - Individual check results
- `system_actions` - Auto-remediation actions taken
- `system_alerts` - Alerts requiring attention
- `app_error_events` - Client/server error tracking
- `job_events` - Background job tracking
- `system_config` - Runtime configuration

### Verify RLS Policies

All tables have Row Level Security enabled:
- **Admin users**: Full read access to all system tables
- **Regular users**: No access to system tables
- **Service role**: Full access (for Edge Functions)

---

## Step 2: Deploy Edge Functions

### Option A: Using Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Deploy the self-scan-runner function
supabase functions deploy self-scan-runner --project-ref YOUR_PROJECT_REF
```

### Option B: Manual Deployment

1. Go to Supabase Dashboard > Edge Functions
2. Create a new function named `self-scan-runner`
3. Copy the code from `backend/supabase/functions/self-scan-runner.ts.template`

### Environment Variables for Edge Functions

In Supabase Dashboard > Edge Functions > Settings, ensure these are set:
- `SUPABASE_URL` (auto-set)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-set)

---

## Step 3: Configure Cron Jobs

### Daily Health Check (Recommended: 2 AM)

In Supabase Dashboard > Database > Extensions, enable `pg_cron` if not already enabled.

Then run:

```sql
-- Schedule daily health check at 2 AM UTC
SELECT cron.schedule(
  'daily-health-check',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/self-scan-runner',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{"trigger_type": "scheduled", "environment": "production"}'::jsonb
  );
  $$
);
```

### Optional: Lightweight Hourly Check

```sql
SELECT cron.schedule(
  'hourly-light-check',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/self-scan-runner',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{"trigger_type": "scheduled", "light_mode": true}'::jsonb
  );
  $$
);
```

**Important**: Replace `YOUR_PROJECT_REF` and `YOUR_SERVICE_ROLE_KEY` with your actual values. Store the service role key in Supabase Vault for production.

---

## Step 4: Configure Deep Links (Expo)

For password reset and email verification to work properly:

### 1. Update app.json

```json
{
  "expo": {
    "scheme": "safebite",
    "ios": {
      "associatedDomains": ["applinks:YOUR_DOMAIN.com"]
    },
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "safebite"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

### 2. Configure Supabase Redirect URLs

In Supabase Dashboard > Authentication > URL Configuration:

**Site URL:**
```
safebite://
```

**Redirect URLs (add all):**
```
safebite://
safebite://reset-password
safebite://auth/callback
exp://YOUR_EXPO_URL
http://localhost:8081
```

### 3. Handle Deep Links in App

The app already handles these routes:
- `/reset-password` - Password reset flow
- `/forgot-password` - Forgot password flow
- `/welcome` - Main entry point

---

## Step 5: Verify Installation

### Manual Test

1. Open the Admin Dashboard in the app
2. Navigate to "System Health" section
3. Click "Run Health Check"
4. Verify checks complete and results display

### Check Logs

```sql
-- View recent health runs
SELECT * FROM system_health_runs 
ORDER BY started_at DESC 
LIMIT 5;

-- View recent alerts
SELECT * FROM system_alerts 
WHERE resolved_at IS NULL 
ORDER BY created_at DESC;
```

---

## Health Checks Performed

| Check | Description | Thresholds |
|-------|-------------|------------|
| Auth Configuration | Verifies auth settings and routes | Pass if accessible |
| Database RLS | Confirms RLS on critical tables | Pass if all enabled |
| Product Lookup APIs | Tests external API connectivity | Fail if >1 API down |
| Queue Health | Checks for stuck jobs | Warn if any stuck >30min |
| Cron Health | Verifies scheduled runs | Warn if no run in 24h |
| Storage/Cache | Checks table sizes | Warn if >50k products |
| Error Trends | Monitors error rates | Warn if spike detected |

---

## Auto-Remediation Actions

The system automatically performs these safe actions:

| Action | Trigger | What It Does |
|--------|---------|--------------|
| Requeue Stuck Jobs | Jobs stuck >30min | Resets status to pending |
| Clean Expired Cache | Cache entries past TTL | Removes expired recall cache |
| Circuit Breaker | API failure rate >50% | Enables circuit breaker flag |

---

## Alerts

Alerts are generated for:
- Failed health checks
- High error rates
- API outages
- Stuck jobs

### Alert Severity Levels

| Level | Description | Action |
|-------|-------------|--------|
| `low` | Informational | Review when convenient |
| `medium` | Attention needed | Review within 24 hours |
| `high` | Action required | Review within 4 hours |
| `critical` | Immediate action | Review immediately |

---

## Security Considerations

1. **No secrets in logs**: All logging redacts sensitive data
2. **RLS enforced**: Users cannot access system tables
3. **Service role only**: Edge functions use service role for writes
4. **Audit trail**: All actions are logged with timestamps

---

## Troubleshooting

### Health checks not running

1. Verify cron job is scheduled: `SELECT * FROM cron.job;`
2. Check Edge Function logs in Supabase Dashboard
3. Ensure service role key is valid

### Alerts not appearing

1. Check if `system_alerts` table exists
2. Verify RLS policies allow admin read access
3. Check browser console for errors

### Dashboard not loading data

1. Verify user has admin role (`is_admin = true`)
2. Check network requests in browser dev tools
3. Ensure Supabase URL is correctly configured

---

## API Reference

### Trigger Manual Scan

```typescript
// From the app
const { triggerScan } = useSystemHealth();
triggerScan();

// Or via API
POST /functions/v1/self-scan-runner
Authorization: Bearer YOUR_SERVICE_KEY
Content-Type: application/json

{
  "environment": "production",
  "trigger_type": "manual"
}
```

### Query Health Data

```typescript
import { useSystemHealth } from '@/hooks/useSystemHealth';

const { 
  runs,           // Array of health runs
  latestRun,      // Most recent run
  alerts,         // Active alerts
  isLoading,
  triggerScan,    // Trigger manual scan
  acknowledgeAlert,
  resolveAlert 
} = useSystemHealth();
```

---

## File Reference

| File | Purpose |
|------|---------|
| `backend/supabase/system-health-migration.sql` | Database schema |
| `backend/supabase/functions/self-scan-runner.ts.template` | Edge function template |
| `hooks/useSystemHealth.ts` | React hook for health data |
| `components/SystemHealthDashboard.tsx` | Dashboard UI component |
| `app/(tabs)/admin-system-health.tsx` | Admin page |

---

## Support

For issues with the system health monitoring:
1. Check the troubleshooting section above
2. Review Edge Function logs in Supabase Dashboard
3. Check the `system_health_runs` table for error details
