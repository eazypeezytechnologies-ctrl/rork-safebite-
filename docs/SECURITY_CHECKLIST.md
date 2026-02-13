# P0 Security Hardening — Checklist & Test Plan

**Build:** 2026-02-13-v11-security-hardening  
**Target:** 7 test families onboarding

---

## 1. RLS Policies (run SECURITY_MIGRATION.sql first)

| Table | RLS Enabled | Self-read | Self-write | Family-read | Admin-read | No public |
|---|---|---|---|---|---|---|
| users | YES | YES | YES (own row) | N/A | YES | YES |
| families | YES | owner | owner | members | YES | YES |
| family_members | YES | own rows | owner manages | members see family | YES | YES |
| profiles | YES | own rows | own rows | via family_id | YES | YES |
| scan_history | YES | own rows | insert own | via family_id | YES | YES |
| favorites | YES | own rows | insert/delete own | via family_id | YES | YES |
| shopping_list | YES | own rows | CRUD own | via family_id | YES | YES |
| products | YES | all auth'd | all auth'd | N/A (global) | YES | YES |
| secure_invitations | YES | creator | creator | family owner reads | YES | YES |
| audit_events | YES | NO | insert only | NO | YES (read) | YES |
| admin_view_sessions | YES | NO | NO | NO | YES | YES |
| rate_limits | YES | own rows | own rows | NO | NO | YES |

## 2. Invite Security Rules

- [x] Tokens generated with 48-char cryptographic randomness
- [x] Tokens stored as SHA-256 hashes (never raw in DB)
- [x] Expiration: 72 hours from creation
- [x] One-time use: status changes on redeem (accepted/declined/expired/revoked)
- [x] Optional email pinning (if email set, only that email can redeem)
- [x] Max 6 family members enforced (DB trigger + app-side check)
- [x] Rate limited: max 10 invites per 10 minutes per user
- [x] Owner or creator can revoke pending invites

## 3. Storage Security

- [ ] `scan-photos` bucket set to PRIVATE (run storage SQL in Supabase dashboard)
- [ ] Storage policies enforce path scoping: `{user_id}/{family_id}/`
- [ ] Use signed URLs for reads (storageService.ts)
- [ ] Uploads scoped to user's own folder

## 4. Admin Controls

- [x] Admin determined server-side via `users.is_admin` column (not client boolean)
- [x] Admin view-as sessions are time-limited (15 min default) and logged
- [x] Admin dashboard uses aggregated metrics view (no raw PII)
- [x] Audit events table logs all sensitive actions
- [x] Admin cannot bypass RLS by default (uses same Supabase client)

## 5. Rate Limiting

| Action | Limit | Window |
|---|---|---|
| Login | 5 | 5 min |
| Signup | 3 | 10 min |
| Create invite | 10 | 10 min |
| Redeem invite | 5 | 5 min |
| Barcode lookup | 30 | 1 min |
| Photo analysis | 10 | 5 min |
| Search | 30 | 1 min |
| Create profile | 10 | 10 min |
| Create family | 5 | 10 min |

## 6. Audit Logging

Events logged:
- `auth.sign_in`, `auth.sign_out`, `auth.sign_up`
- `profile.create`, `profile.update`, `profile.delete`
- `scan.barcode`, `scan.photo`, `scan.save_product`
- `family.create`, `family.join`, `family.leave`, `family.delete`
- `invite.create`, `invite.redeem`, `invite.revoke`, `invite.decline`
- `admin.view_as`, `admin.override_verdict`
- `error.*` (scan_failed, save_failed, invite_failed, auth_failed)

Batched writes (5s intervals, max 20 per batch). Immediate writes for security-critical events.

---

## 7-Family Test Plan

### Setup
1. Run `docs/SECURITY_MIGRATION.sql` in Supabase SQL Editor
2. Create 7 test user accounts (family_a@test.com through family_g@test.com)
3. Each user creates a family group and invites 1-2 members

### Cross-Family Isolation Tests

| # | Test | Expected | Pass? |
|---|---|---|---|
| 1 | Family A owner queries profiles | Only sees Family A profiles | |
| 2 | Family A member queries scan_history | Only sees Family A scans | |
| 3 | Family B member tries to read Family A profiles | Returns empty / 403 | |
| 4 | Family B member tries to query Family A scan_history | Returns empty | |
| 5 | Family A owner creates invite | Invite stored with hashed token | |
| 6 | Family B member tries to redeem Family A invite (wrong email) | Rejected | |
| 7 | Family A invite redeemed by correct user | User added to Family A members | |
| 8 | Same invite token used again | Rejected (already used) | |
| 9 | Expired invite token used | Rejected (expired) | |
| 10 | Revoked invite token used | Rejected (revoked) | |
| 11 | 7th member tries to join 6-member family | Rejected (limit) | |
| 12 | Non-admin tries to access admin_metrics view | Returns empty / error | |
| 13 | Admin queries admin_metrics | Returns aggregated counts | |
| 14 | Family A deletes family group | Members lose access, cascade deletes | |

### Verification Script (run as each test user)

```sql
-- As Family A user: should only see own family data
SELECT * FROM profiles; -- only Family A profiles
SELECT * FROM scan_history; -- only Family A scans
SELECT * FROM favorites; -- only Family A favorites

-- As Family B user: should NOT see Family A data
SELECT * FROM profiles WHERE family_id = '<family_a_id>'; -- empty
SELECT * FROM scan_history WHERE family_id = '<family_a_id>'; -- empty

-- Verify invite is hashed
SELECT token_hash FROM secure_invitations; -- no raw tokens visible

-- Verify audit log (admin only)
SELECT event_type, count(*) FROM audit_events GROUP BY event_type;
```

### Quick Smoke Test (5 minutes)

1. Login as test user → confirm no freeze, audit event logged
2. Create family group → confirm in DB with owner as member
3. Create invite → share link contains token, DB has hash (not raw token)
4. Redeem invite from different account → member added, count correct
5. Try redeeming same link again → rejected
6. Check admin dashboard → shows aggregated metrics, no PII
7. Check audit_events table → events present for all actions above
