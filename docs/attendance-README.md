# Multi-Tenant Attendance Ingest System

Complete implementation of attendance machine integration for the idCashier system.

## Architecture Overview

```
Attendance Machine (Fingerprint/PIN)
    ↓ POST /attendance-ingest
Edge Function (Deno/TypeScript)
    ↓ validate, HMAC check
attendance_logs (raw, immutable)
    ↓ trigger: resolve employee_id via mapping
    ↓ trigger: sync to employee_attendance
employee_attendance (UI display)
    ↓ React components
Owner Dashboard
```

## Key Features

✅ **Multi-Tenant Isolation**: Uses existing `users.tenant_id`  
✅ **Single Ingest Endpoint**: One URL for all devices  
✅ **Auto-Sync**: Raw logs → employee_attendance via triggers  
✅ **PIN Mapping**: Device PIN → employees.id lookup table  
✅ **Deduplication**: SHA-256 based, prevents double-posting  
✅ **Optional HMAC**: Signature verification per device  
✅ **Clock Skew Handling**: Machine timestamp + server timestamp  
✅ **Realtime Updates**: React components with Supabase subscriptions  
✅ **RLS Secured**: Row-level security on all tables  

## Database Schema

### New Tables

- **devices**: Physical attendance machines
- **device_employee_mappings**: PIN → employee lookup
- **attendance_logs**: Raw immutable logs from devices

### Triggers

1. `fn_resolve_log_employee()`: Auto-resolve employee_id from mapping
2. `fn_apply_attendance_log()`: Sync to employee_attendance (upsert clock times)
3. `fn_backfill_unmapped_logs()`: Manual backfill after creating mappings

### RPC Functions

- `register_device(serial, name, secret)`: Device onboarding
- `map_device_employee(device_id, pin, employee_id)`: Create PIN mapping

## Files Created

### SQL Migrations
- `supabase/migrations/20250128_attendance_machine_ingest.sql` (schema, RLS, triggers)
- `supabase/migrations/20250128_attendance_rpc_helpers.sql` (RPC functions)

### Edge Function
- `supabase/functions/attendance-ingest/index.ts` (ingestion endpoint)

### React Components (TypeScript)
- `src/types/attendance.ts` (type definitions)
- `src/components/attendance/DeviceOnboardingForm.tsx`
- `src/components/attendance/EmployeeMappingForm.tsx`
- `src/components/attendance/AttendanceReport.tsx`

### Documentation
- `docs/attendance-ingest-tests.md` (cURL test examples)
- `docs/attendance-deployment.md` (deployment & operations guide)
- `docs/attendance-README.md` (this file)

## Quick Start

### 1. Apply Migrations

```bash
supabase db push
```

### 2. Deploy Edge Function

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-key"
supabase functions deploy attendance-ingest
```

### 3. Register Device (React UI or SQL)

```sql
SELECT register_device('DEV001', 'Main Entrance', 'optional-secret');
```

### 4. Create Employee Mapping

```sql
SELECT map_device_employee('[device-id]', '1234', '[employee-id]');
```

### 5. Test Ingest

```bash
curl -X POST https://PROJECT.supabase.co/functions/v1/attendance-ingest \
  -H "Content-Type: application/json" \
  -d '{"device_serial":"DEV001","pin":"1234","type":"clock-in"}'
```

### 6. View Report

Open React App → Attendance Report component

## API Endpoint

**POST** `https://[PROJECT-ID].supabase.co/functions/v1/attendance-ingest`

**Headers**:
- `Content-Type: application/json`
- `X-Signature: [hmac-sha256]` (if device has secret)

**Body**:
```json
{
  "device_serial": "DEV001",
  "pin": "1234",
  "type": "clock-in",
  "timestamp": "2025-01-28T08:00:00Z"
}
```

**Response**:
```json
{
  "success": true,
  "stored": true
}
```

## React Component Usage

```tsx
import { DeviceOnboardingForm } from '@/components/attendance/DeviceOnboardingForm'
import { EmployeeMappingForm } from '@/components/attendance/EmployeeMappingForm'
import { AttendanceReport } from '@/components/attendance/AttendanceReport'

function AttendancePage() {
  return (
    <div>
      <DeviceOnboardingForm />
      <EmployeeMappingForm />
      <AttendanceReport />
    </div>
  )
}
```

## Data Flow

### Clock-In Flow

1. Machine POSTs to Edge Function:
   ```json
   {"device_serial":"DEV001","pin":"1234","type":"clock-in"}
   ```

2. Edge Function:
   - Validates device exists & active
   - Checks HMAC signature (if secret set)
   - Computes dedupe_key
   - Inserts to `attendance_logs`

3. BEFORE INSERT Trigger:
   - Looks up `employee_id` from `device_employee_mappings`
   - Sets `ts` from `machine_ts` if provided

4. AFTER INSERT Trigger:
   - Calculates `attendance_date = ts::date`
   - Upserts `employee_attendance`:
     - If clock-in: set/update clock_in to earliest time
     - If clock-out: set/update clock_out to latest time
   - Skips if `employee_id` is null (unmapped PIN)

5. React Component (realtime):
   - Subscribes to `attendance_logs` INSERT events
   - Refreshes report automatically

### Clock-Out Flow

Same as clock-in, but `type: "clock-out"` updates `clock_out` field.

## Unmapped PIN Handling

If device sends PIN not in `device_employee_mappings`:

1. Log created with `employee_id = NULL`
2. NOT synced to `employee_attendance` (trigger skips)
3. After creating mapping:
   ```sql
   SELECT fn_backfill_unmapped_logs('[tenant-id]', '[device-id]');
   ```
4. Backfill resolves `employee_id` and syncs to `employee_attendance`

## Security

- **Edge Function**: Uses service_role_key, bypasses RLS (OK for ingest)
- **React Components**: Use anon key, RLS enforces tenant isolation
- **RLS Policies**: All tables check `users.tenant_id = record.tenant_id`
- **HMAC Verification**: Optional per-device signature validation
- **Deduplication**: Prevents replay attacks via unique dedupe_key

## Monitoring

### SQL Queries

```sql
-- Recent logs
SELECT * FROM attendance_logs ORDER BY received_at DESC LIMIT 10;

-- Unmapped PINs
SELECT device_employee_id, COUNT(*) 
FROM attendance_logs 
WHERE employee_id IS NULL 
GROUP BY device_employee_id;

-- Today's attendance
SELECT e.name, ea.clock_in, ea.clock_out
FROM employee_attendance ea
JOIN employees e ON e.id = ea.employee_id
WHERE ea.attendance_date = CURRENT_DATE;
```

### Supabase Dashboard

- Edge Functions → attendance-ingest → Logs
- Filter by status codes (200, 404, 401, 500)
- Monitor execution time

## Troubleshooting

| Problem | Solution |
|---------|----------|
| 404 Device not found | Check `devices.active = true`, serial matches |
| 401 Invalid signature | Verify HMAC secret, algorithm (SHA-256) |
| Stored but not synced | Check mapping exists, run backfill |
| Duplicate stored:false | Expected behavior, dedupe working |
| Clock times not updating | Check trigger enabled, view logs |

## Testing

See `docs/attendance-ingest-tests.md` for comprehensive test cases:
- Valid POST (no HMAC)
- Duplicate (dedupe)
- Device not found
- Invalid signature
- Clock-out event
- Unmapped PIN
- Custom event_id

## Deployment Checklist

- [ ] Database migrations applied
- [ ] Edge Function deployed
- [ ] Secrets configured (service_role_key)
- [ ] Test device registered
- [ ] Employee mapping created
- [ ] End-to-end test passed
- [ ] React components integrated
- [ ] Monitoring configured

## Production Considerations

### Rate Limiting

Implement device-level rate limiting:
- In-memory map (simple, resets on cold start)
- Upstash Redis (persistent, distributed)

### Clock Skew

- Current: Uses `machine_ts` if provided, else server time
- Future: Add per-tenant timezone support

### Data Retention

- Archive `attendance_logs` after 1 year
- Keep `employee_attendance` indefinitely for reports

### Alerts

- Webhook for unmapped PINs (Slack/Discord)
- Error alerts for 5xx responses
- Daily summary email

## Integration with Physical Devices

Configure your attendance machine to POST to:
```
URL: https://[PROJECT].supabase.co/functions/v1/attendance-ingest
Method: POST
Content-Type: application/json
Body Format: {"device_serial":"DEV001","pin":"1234","type":"clock-in"}
```

For HMAC-enabled devices:
```
Header: X-Signature: [hex(hmac_sha256(secret, body))]
```

## Support

- Test Guide: `docs/attendance-ingest-tests.md`
- Deployment: `docs/attendance-deployment.md`
- Database Schema: Check migration files
- API Spec: See Edge Function code

## License

Part of idCashier project.

