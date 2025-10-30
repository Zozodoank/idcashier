# Attendance Machine Ingest - Deployment Guide

## Prerequisites

- Supabase project initialized
- Supabase CLI installed: `npm install -g supabase`
- Database migrations applied
- React app configured with Supabase client

---

## Step 1: Apply Database Migrations

### Run Migrations

```bash
cd your-project-root

# Apply main schema migration
supabase db push

# Or apply specific migrations
supabase migration up 20250128_attendance_machine_ingest
supabase migration up 20250128_attendance_rpc_helpers
```

### Verify Tables Created

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('devices', 'device_employee_mappings', 'attendance_logs');
```

### Check Triggers

```sql
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';
```

Expected triggers:
- `trigger_resolve_log_employee` on `attendance_logs` (BEFORE INSERT)
- `trigger_apply_attendance_log` on `attendance_logs` (AFTER INSERT)

---

## Step 2: Configure Edge Function Secrets

### Get Supabase Credentials

From Supabase Dashboard → Settings → API:
- Project URL: `https://[PROJECT-ID].supabase.co`
- Service Role Key (secret): `eyJh...` (⚠️ NEVER commit this)

### Set Secrets (Production)

```bash
# Set service role key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="eyJh..."

# Verify URL env (auto-set by Supabase)
supabase secrets list
```

### Local Development (.env.local)

Create `supabase/.env.local`:
```env
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=eyJh...your-local-service-role-key
```

⚠️ Add to `.gitignore`:
```
supabase/.env.local
.env
.env.local
```

---

## Step 3: Deploy Edge Function

### Initialize Function (if not exists)

```bash
supabase functions new attendance-ingest
```

### Deploy to Production

```bash
# Deploy function
supabase functions deploy attendance-ingest

# Verify deployment
supabase functions list
```

### Test Deployment

```bash
curl https://[PROJECT-ID].supabase.co/functions/v1/attendance-ingest \
  -H "Content-Type: application/json" \
  -d '{"device_serial":"TEST","pin":"1234","type":"clock-in"}'

# Expected: 404 (device not found) = function working
```

---

## Step 4: Local Development

### Serve Function Locally

```bash
# Start Supabase local stack
supabase start

# Serve function (no JWT verification for machine POST)
supabase functions serve attendance-ingest --no-verify-jwt --env-file supabase/.env.local
```

Function available at: `http://localhost:54321/functions/v1/attendance-ingest`

### Test Local Function

```bash
curl -X POST http://localhost:54321/functions/v1/attendance-ingest \
  -H "Content-Type: application/json" \
  -d '{
    "device_serial": "DEV001",
    "pin": "1234",
    "type": "clock-in"
  }'
```

---

## Step 5: React App Configuration

### Install Dependencies

```bash
npm install @supabase/supabase-js date-fns
```

### Configure Supabase Client

Ensure `src/lib/supabaseClient.ts` uses **anon key** (not service role):

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Environment Variables (.env)

```env
VITE_SUPABASE_URL=https://[PROJECT-ID].supabase.co
VITE_SUPABASE_ANON_KEY=eyJh...anon-key
```

### Import Components

```typescript
import { DeviceOnboardingForm } from '@/components/attendance/DeviceOnboardingForm'
import { EmployeeMappingForm } from '@/components/attendance/EmployeeMappingForm'
import { AttendanceReport } from '@/components/attendance/AttendanceReport'
```

---

## Step 6: Create Initial Data

### Register Test Device

Via React UI → Device Onboarding Form:
- Serial: `DEV001`
- Name: `Test Device`
- Secret: (optional) `testsecret123`

Or via SQL:
```sql
-- Get your tenant_id
SELECT id, tenant_id FROM users WHERE email = 'your@email.com';

-- Insert device
INSERT INTO devices (device_serial, tenant_id, name, secret, active)
VALUES ('DEV001', '[YOUR-TENANT-ID]', 'Test Device', 'testsecret123', true);
```

### Create Employee Mapping

Via React UI → Employee Mapping Form:
- Device: `DEV001`
- PIN: `1234`
- Employee: Select from dropdown

Or via SQL:
```sql
INSERT INTO device_employee_mappings (
  tenant_id, device_id, device_employee_id, employee_id, active
)
VALUES (
  '[TENANT-ID]',
  (SELECT id FROM devices WHERE device_serial = 'DEV001'),
  '1234',
  '[EMPLOYEE-ID]',
  true
);
```

---

## Step 7: Test End-to-End Flow

### 1. Send Clock-In from "Device"

```bash
curl -X POST https://[PROJECT].supabase.co/functions/v1/attendance-ingest \
  -H "Content-Type: application/json" \
  -d '{
    "device_serial": "DEV001",
    "pin": "1234",
    "type": "clock-in",
    "timestamp": "2025-01-28T08:00:00Z"
  }'
```

### 2. Verify Raw Log Created

```sql
SELECT * FROM attendance_logs ORDER BY received_at DESC LIMIT 1;
```

### 3. Verify Auto-Sync to employee_attendance

```sql
SELECT * FROM employee_attendance 
WHERE attendance_date = CURRENT_DATE 
ORDER BY created_at DESC;
```

Should show:
- `clock_in` = 08:00:00
- `employee_id` = (your employee UUID)
- `status` = 'present'

### 4. Send Clock-Out

```bash
curl -X POST https://[PROJECT].supabase.co/functions/v1/attendance-ingest \
  -H "Content-Type: application/json" \
  -d '{
    "device_serial": "DEV001",
    "pin": "1234",
    "type": "clock-out",
    "timestamp": "2025-01-28T17:00:00Z"
  }'
```

### 5. Verify Clock-Out Updated

```sql
SELECT clock_in, clock_out FROM employee_attendance 
WHERE attendance_date = CURRENT_DATE 
AND employee_id = '[EMPLOYEE-ID]';
```

Should show:
- `clock_in` = 08:00:00
- `clock_out` = 17:00:00

### 6. View in React App

Open React App → Attendance Report:
- Should display today's record
- Real-time toggle → future updates appear automatically

---

## Step 8: Monitoring & Operations

### Dashboard Monitoring

Supabase Dashboard → Functions → attendance-ingest:
- **Invocations**: Track request count
- **Errors**: Filter by 4xx/5xx
- **Execution Time**: Monitor latency
- **Logs**: View console.error() outputs

### SQL Monitoring Queries

**Recent logs (last hour)**:
```sql
SELECT 
  device_employee_id,
  employee_id,
  type,
  ts,
  received_at
FROM attendance_logs 
WHERE received_at > NOW() - INTERVAL '1 hour'
ORDER BY received_at DESC;
```

**Unmapped PINs (need attention)**:
```sql
SELECT 
  device_id,
  device_employee_id,
  COUNT(*) as log_count
FROM attendance_logs 
WHERE employee_id IS NULL 
GROUP BY device_id, device_employee_id
ORDER BY log_count DESC;
```

**Today's attendance summary**:
```sql
SELECT 
  e.name,
  ea.clock_in,
  ea.clock_out,
  CASE 
    WHEN ea.clock_out IS NOT NULL THEN 
      EXTRACT(EPOCH FROM (ea.clock_out - ea.clock_in))/3600 
    ELSE NULL 
  END as hours_worked
FROM employee_attendance ea
JOIN employees e ON e.id = ea.employee_id
WHERE ea.attendance_date = CURRENT_DATE
ORDER BY ea.clock_in;
```

### Backfill Unmapped Logs

After creating new mappings:
```sql
-- Backfill for specific device
SELECT fn_backfill_unmapped_logs('[TENANT-ID]', '[DEVICE-ID]');

-- Backfill for all devices in tenant
SELECT fn_backfill_unmapped_logs('[TENANT-ID]', NULL);
```

---

## Step 9: Rate Limiting (Optional)

### Option A: Device-Level Throttle

Add to Edge Function:
```typescript
// Simple in-memory rate limit (resets on cold start)
const rateLimits = new Map<string, number[]>()

function checkRateLimit(deviceSerial: string): boolean {
  const now = Date.now()
  const window = 60000 // 1 minute
  const maxRequests = 100

  if (!rateLimits.has(deviceSerial)) {
    rateLimits.set(deviceSerial, [])
  }

  const requests = rateLimits.get(deviceSerial)!
  const recentRequests = requests.filter(t => t > now - window)
  
  if (recentRequests.length >= maxRequests) {
    return false // rate limited
  }

  recentRequests.push(now)
  rateLimits.set(deviceSerial, recentRequests)
  return true
}
```

### Option B: Upstash Redis (Production)

```typescript
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

async function checkRateLimit(deviceSerial: string): Promise<boolean> {
  const key = `rate:${deviceSerial}`
  const count = await redis.incr(key)
  if (count === 1) {
    await redis.expire(key, 60) // 1 minute window
  }
  return count <= 100 // max 100 requests/minute
}
```

---

## Step 10: Clock Skew Handling

### Current Implementation

- Uses `machine_ts` if provided
- Falls back to server `ts` (NOW())
- Both stored: `machine_ts` (audit) + `ts` (canonical)

### Per-Tenant Timezone (Future)

Add to `users` table:
```sql
ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'UTC';
```

Update trigger function:
```sql
v_attendance_date := (NEW.ts AT TIME ZONE v_user_timezone)::DATE;
```

---

## Step 11: Data Retention (Optional)

### Archive Old Logs

```sql
-- Create archive table
CREATE TABLE attendance_logs_archive (LIKE attendance_logs INCLUDING ALL);

-- Archive logs older than 1 year
WITH archived AS (
  DELETE FROM attendance_logs 
  WHERE ts < NOW() - INTERVAL '365 days'
  RETURNING *
)
INSERT INTO attendance_logs_archive SELECT * FROM archived;
```

⚠️ **Don't delete `employee_attendance`** - keep for reports

### Automated Cleanup (pg_cron)

```sql
SELECT cron.schedule(
  'archive-attendance-logs',
  '0 2 * * 0', -- Every Sunday 2 AM
  $$
  WITH archived AS (
    DELETE FROM attendance_logs 
    WHERE ts < NOW() - INTERVAL '365 days'
    RETURNING *
  )
  INSERT INTO attendance_logs_archive SELECT * FROM archived;
  $$
);
```

---

## Troubleshooting

### Function Not Found (404)
```bash
# Redeploy
supabase functions deploy attendance-ingest

# Check deployment
supabase functions list
```

### RLS Blocking Queries
- Edge Function uses service_role → bypasses RLS ✅
- React components use anon key → RLS applies
- Verify user has `tenant_id` in `users` table

### Trigger Not Firing
```sql
-- Check triggers exist
SELECT * FROM pg_trigger WHERE tgname LIKE '%attendance%';

-- Test trigger manually
INSERT INTO attendance_logs (tenant_id, device_id, device_employee_id, type, ts, dedupe_key)
VALUES (...);
-- Check employee_attendance for sync
```

### HMAC Signature Fails
- Ensure `device.secret` matches
- Body must be **exact** raw string (no whitespace changes)
- Algorithm: HMAC-SHA256, output: hex

---

## Security Checklist

✅ Service role key stored in secrets (not in code)  
✅ React app uses anon key (not service role)  
✅ RLS enabled on all user-facing tables  
✅ HMAC verification for production devices  
✅ `.env` files in `.gitignore`  
✅ Edge Function bypasses RLS via service_role (OK for ingest)  
✅ Tenant isolation via `users.tenant_id` check  

---

## Production Readiness

- [ ] Migrations applied to production DB
- [ ] Edge Function deployed
- [ ] Secrets configured (service_role_key)
- [ ] Test device registered
- [ ] At least one employee mapping created
- [ ] End-to-end test passed (clock-in → sync → report)
- [ ] Monitoring dashboard bookmarked
- [ ] Rate limiting configured (if needed)
- [ ] Backfill procedure documented for team
- [ ] Data retention policy defined

---

## Next Steps

1. **Physical Device Integration**: Configure your actual fingerprint machine to POST to your function URL
2. **Webhook Alerts**: Add Discord/Slack notifications for unmapped PINs
3. **Analytics**: Build dashboard for attendance patterns, late arrivals, etc.
4. **Mobile App**: Create employee self-service app to view attendance
5. **Export**: Add CSV/Excel export for payroll integration

