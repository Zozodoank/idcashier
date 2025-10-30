# Attendance Ingest API - Testing Guide

## Endpoint

```
POST https://[PROJECT-ID].supabase.co/functions/v1/attendance-ingest
```

## Test Prerequisites

1. Register a device first via React UI or SQL:
   ```sql
   INSERT INTO devices (device_serial, tenant_id, name, active)
   VALUES ('DEV001', '[YOUR-TENANT-ID]', 'Test Device', true);
   ```

2. Create employee mapping (or ingest will create log with employee_id=null):
   ```sql
   INSERT INTO device_employee_mappings (tenant_id, device_id, device_employee_id, employee_id, active)
   VALUES ('[TENANT-ID]', '[DEVICE-ID]', '1234', '[EMPLOYEE-ID]', true);
   ```

---

## Test 1: Valid POST (no HMAC)

```bash
curl -X POST \
  https://PROJECT.supabase.co/functions/v1/attendance-ingest \
  -H "Content-Type: application/json" \
  -d '{
    "device_serial": "DEV001",
    "pin": "1234",
    "type": "clock-in",
    "timestamp": "2025-01-28T08:00:00Z"
  }'
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "stored": true
}
```

---

## Test 2: Duplicate Event (dedupe)

```bash
# Send same payload again
curl -X POST \
  https://PROJECT.supabase.co/functions/v1/attendance-ingest \
  -H "Content-Type: application/json" \
  -d '{
    "device_serial": "DEV001",
    "pin": "1234",
    "type": "clock-in",
    "timestamp": "2025-01-28T08:00:00Z"
  }'
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "stored": false,
  "reason": "Duplicate event (dedupe_key conflict)"
}
```

---

## Test 3: Device Not Found

```bash
curl -X POST \
  https://PROJECT.supabase.co/functions/v1/attendance-ingest \
  -H "Content-Type: application/json" \
  -d '{
    "device_serial": "NONEXISTENT",
    "pin": "1234",
    "type": "clock-in"
  }'
```

**Expected Response** (404 Not Found):
```json
{
  "success": false,
  "stored": false,
  "error": "Device not found or inactive"
}
```

---

## Test 4: Missing Required Fields

```bash
curl -X POST \
  https://PROJECT.supabase.co/functions/v1/attendance-ingest \
  -H "Content-Type: application/json" \
  -d '{
    "device_serial": "DEV001"
  }'
```

**Expected Response** (400 Bad Request):
```json
{
  "success": false,
  "stored": false,
  "error": "Missing required fields: device_serial and pin"
}
```

---

## Test 5: Clock-out Event

```bash
curl -X POST \
  https://PROJECT.supabase.co/functions/v1/attendance-ingest \
  -H "Content-Type: application/json" \
  -d '{
    "device_serial": "DEV001",
    "pin": "1234",
    "type": "clock-out",
    "timestamp": "2025-01-28T17:00:00Z"
  }'
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "stored": true
}
```

**Verify in DB**:
```sql
SELECT * FROM employee_attendance 
WHERE employee_id = '[EMPLOYEE-ID]' 
AND attendance_date = '2025-01-28';
-- Should show both clock_in and clock_out times
```

---

## Test 6: With HMAC Signature (device has secret)

### Setup Device with Secret

```sql
UPDATE devices 
SET secret = 'mysecretkey' 
WHERE device_serial = 'DEV001';
```

### Generate Signature

```bash
# Body to send
BODY='{"device_serial":"DEV001","pin":"1234","type":"clock-in"}'

# Compute HMAC-SHA256
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "mysecretkey" -hex | awk '{print $2}')

echo "Signature: $SIGNATURE"
```

### Send Request with Signature

```bash
curl -X POST \
  https://PROJECT.supabase.co/functions/v1/attendance-ingest \
  -H "Content-Type: application/json" \
  -H "X-Signature: $SIGNATURE" \
  -d "$BODY"
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "stored": true
}
```

---

## Test 7: Invalid HMAC Signature

```bash
curl -X POST \
  https://PROJECT.supabase.co/functions/v1/attendance-ingest \
  -H "Content-Type: application/json" \
  -H "X-Signature: invalid_signature" \
  -d '{
    "device_serial": "DEV001",
    "pin": "1234",
    "type": "clock-in"
  }'
```

**Expected Response** (401 Unauthorized):
```json
{
  "success": false,
  "stored": false,
  "error": "Invalid signature"
}
```

---

## Test 8: Unmapped Employee (PIN not in mappings)

```bash
curl -X POST \
  https://PROJECT.supabase.co/functions/v1/attendance-ingest \
  -H "Content-Type: application/json" \
  -d '{
    "device_serial": "DEV001",
    "pin": "9999",
    "type": "clock-in"
  }'
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "stored": true
}
```

**Verify**:
```sql
-- Log created but employee_id is null
SELECT * FROM attendance_logs WHERE device_employee_id = '9999';

-- NOT synced to employee_attendance (trigger skips if employee_id null)
```

**Backfill after creating mapping**:
```sql
-- Create mapping
INSERT INTO device_employee_mappings (tenant_id, device_id, device_employee_id, employee_id, active)
VALUES ('[TENANT]', '[DEVICE]', '9999', '[EMPLOYEE]', true);

-- Backfill
SELECT fn_backfill_unmapped_logs('[TENANT-ID]', '[DEVICE-ID]');
```

---

## Test 9: No Timestamp (use server time)

```bash
curl -X POST \
  https://PROJECT.supabase.co/functions/v1/attendance-ingest \
  -H "Content-Type: application/json" \
  -d '{
    "device_serial": "DEV001",
    "pin": "1234",
    "type": "clock-in"
  }'
```

**Expected**: Uses server's current timestamp

---

## Test 10: Custom Event ID (dedupe)

```bash
curl -X POST \
  https://PROJECT.supabase.co/functions/v1/attendance-ingest \
  -H "Content-Type: application/json" \
  -d '{
    "device_serial": "DEV001",
    "pin": "1234",
    "type": "clock-in",
    "event_id": "custom-unique-id-123"
  }'
```

**Expected**: Uses `event_id` as dedupe_key instead of computed hash

---

## Monitoring & Debugging

### View Recent Logs
```sql
SELECT * FROM attendance_logs 
ORDER BY received_at DESC 
LIMIT 10;
```

### Check Sync Status
```sql
-- Logs with resolved employee
SELECT COUNT(*) FROM attendance_logs WHERE employee_id IS NOT NULL;

-- Logs without mapping (unmapped PINs)
SELECT COUNT(*) FROM attendance_logs WHERE employee_id IS NULL;
```

### Supabase Logs
- Go to Supabase Dashboard → Edge Functions → attendance-ingest → Logs
- Filter by error/status codes
- Check execution time

---

## CORS Test (OPTIONS)

```bash
curl -X OPTIONS \
  https://PROJECT.supabase.co/functions/v1/attendance-ingest \
  -H "Origin: https://example.com" \
  -v
```

**Expected Headers**:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-Signature
```

---

## Load Testing

### Bulk Insert (simulate multiple punches)

```bash
for i in {1..10}; do
  curl -X POST \
    https://PROJECT.supabase.co/functions/v1/attendance-ingest \
    -H "Content-Type: application/json" \
    -d "{
      \"device_serial\": \"DEV001\",
      \"pin\": \"$i\",
      \"type\": \"clock-in\",
      \"timestamp\": \"$(date -u -Iseconds)\"
    }" &
done
wait
```

---

## Success Criteria

✅ Valid requests return 200 with `stored: true`  
✅ Duplicates return 200 with `stored: false`  
✅ Invalid device returns 404  
✅ Missing fields return 400  
✅ HMAC verification works correctly  
✅ Logs appear in `attendance_logs` table  
✅ Mapped employees sync to `employee_attendance`  
✅ Clock-in sets earliest time, clock-out sets latest  
✅ Unmapped PINs create logs without syncing  
✅ Backfill function resolves unmapped logs  

---

## Troubleshooting

**Problem**: 404 Device not found  
**Fix**: Check `devices.active = true` and `device_serial` matches

**Problem**: 401 Invalid signature  
**Fix**: Ensure secret matches, signature algorithm is HMAC-SHA256, hex format

**Problem**: Stored but not in employee_attendance  
**Fix**: Check `device_employee_mappings` exists, run backfill function

**Problem**: Clock times not updating  
**Fix**: Check trigger `fn_apply_attendance_log` is enabled, check logs for errors

