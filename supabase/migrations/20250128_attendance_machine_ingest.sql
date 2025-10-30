-- =====================================================
-- Multi-tenant Attendance Machine Ingest System
-- Integration: raw logs → auto-sync to employee_attendance
-- Tenanting: uses existing users.tenant_id
-- =====================================================

-- =====================================================
-- 1. TABLES
-- =====================================================

-- Physical attendance machines (fingerprint/PIN devices)
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_serial TEXT UNIQUE NOT NULL, -- unique serial from manufacturer
  tenant_id UUID NOT NULL,            -- references users.tenant_id (no FK)
  name TEXT,                           -- friendly name
  secret TEXT NULL,                    -- HMAC secret for signature verification (optional)
  active BOOLEAN DEFAULT true,         -- device status
  created_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE devices IS 'Physical attendance machines';
COMMENT ON COLUMN devices.device_serial IS 'Unique manufacturer serial number';
COMMENT ON COLUMN devices.secret IS 'HMAC secret for X-Signature verification (null = no auth)';

-- Employee PIN/card ID → employees.id mapping per device
CREATE TABLE IF NOT EXISTS device_employee_mappings (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,                                         -- denormalized for RLS
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  device_employee_id TEXT NOT NULL,                                -- PIN/card from machine
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(device_id, device_employee_id)
);
COMMENT ON TABLE device_employee_mappings IS 'Maps device PIN/card to employees.id';
COMMENT ON COLUMN device_employee_mappings.device_employee_id IS 'PIN/card ID from attendance machine';

-- Raw attendance logs from machines (immutable append-only)
CREATE TABLE IF NOT EXISTS attendance_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,                                         -- denormalized for RLS
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  device_employee_id TEXT NOT NULL,                                -- raw PIN from machine
  employee_id UUID NULL REFERENCES employees(id) ON DELETE SET NULL, -- resolved via mapping
  type TEXT NULL CHECK (type IN ('clock-in', 'clock-out')),       -- punch direction
  machine_ts TIMESTAMPTZ NULL,                                     -- timestamp from machine (if provided)
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),                           -- server timestamp (source of truth)
  dedupe_key TEXT UNIQUE NOT NULL,                                 -- sha256(serial|pin|ts|type)
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()                   -- ingest time
);
COMMENT ON TABLE attendance_logs IS 'Raw immutable logs from attendance machines';
COMMENT ON COLUMN attendance_logs.machine_ts IS 'Timestamp from machine clock (may have skew)';
COMMENT ON COLUMN attendance_logs.ts IS 'Server timestamp (canonical)';
COMMENT ON COLUMN attendance_logs.dedupe_key IS 'Deduplication key to prevent double-posting';

-- =====================================================
-- 2. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_devices_tenant ON devices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_devices_serial ON devices(device_serial); -- fast lookup

CREATE INDEX IF NOT EXISTS idx_mappings_tenant ON device_employee_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mappings_device ON device_employee_mappings(device_id);
CREATE INDEX IF NOT EXISTS idx_mappings_employee ON device_employee_mappings(employee_id);

CREATE INDEX IF NOT EXISTS idx_att_logs_tenant_ts ON attendance_logs(tenant_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_att_logs_emp ON attendance_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_att_logs_device ON attendance_logs(device_id);

-- =====================================================
-- 3. RLS ENABLE
-- =====================================================

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_employee_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_attendance ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. RLS POLICIES - DEVICES
-- =====================================================

-- NOTE: Edge Function uses SERVICE_ROLE_KEY → bypasses RLS

CREATE POLICY "users_select_devices" 
ON devices FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
    AND u.tenant_id = devices.tenant_id
  )
);

CREATE POLICY "users_insert_devices" 
ON devices FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
    AND u.tenant_id = devices.tenant_id
  )
);

CREATE POLICY "users_update_devices" 
ON devices FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
    AND u.tenant_id = devices.tenant_id
  )
);

CREATE POLICY "users_delete_devices" 
ON devices FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
    AND u.tenant_id = devices.tenant_id
  )
);

-- =====================================================
-- 5. RLS POLICIES - DEVICE_EMPLOYEE_MAPPINGS
-- =====================================================

CREATE POLICY "users_select_mappings" 
ON device_employee_mappings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
    AND u.tenant_id = device_employee_mappings.tenant_id
  )
);

CREATE POLICY "users_insert_mappings" 
ON device_employee_mappings FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
    AND u.tenant_id = device_employee_mappings.tenant_id
  )
);

CREATE POLICY "users_update_mappings" 
ON device_employee_mappings FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
    AND u.tenant_id = device_employee_mappings.tenant_id
  )
);

CREATE POLICY "users_delete_mappings" 
ON device_employee_mappings FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
    AND u.tenant_id = device_employee_mappings.tenant_id
  )
);

-- =====================================================
-- 6. RLS POLICIES - ATTENDANCE_LOGS
-- =====================================================

-- SELECT only (no INSERT policy → Edge Function uses service_role)
CREATE POLICY "users_select_logs" 
ON attendance_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
    AND u.tenant_id = attendance_logs.tenant_id
  )
);

-- =====================================================
-- 7. RLS POLICIES - EMPLOYEE_ATTENDANCE (existing table)
-- =====================================================

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS "users_select_employee_attendance" ON employee_attendance;

CREATE POLICY "users_select_employee_attendance" 
ON employee_attendance FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users u, employees e
    WHERE u.id = auth.uid()
    AND e.id = employee_attendance.employee_id
    AND u.tenant_id = e.tenant_id
  )
);

-- =====================================================
-- 8. TRIGGER FUNCTIONS
-- =====================================================

-- BEFORE INSERT: resolve employee_id from mapping, use machine_ts if provided
CREATE OR REPLACE FUNCTION fn_resolve_log_employee()
RETURNS TRIGGER AS $$
BEGIN
  -- Resolve employee_id from device_employee_mappings
  IF NEW.employee_id IS NULL THEN
    SELECT m.employee_id INTO NEW.employee_id
    FROM device_employee_mappings m
    WHERE m.device_id = NEW.device_id
      AND m.device_employee_id = NEW.device_employee_id
      AND m.tenant_id = NEW.tenant_id
      AND m.active = true
    LIMIT 1;
  END IF;

  -- Use machine_ts if ts not explicitly set and machine_ts is provided
  IF NEW.ts IS NULL OR NEW.ts = NOW() THEN
    IF NEW.machine_ts IS NOT NULL THEN
      NEW.ts := NEW.machine_ts;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_resolve_log_employee
BEFORE INSERT ON attendance_logs
FOR EACH ROW
EXECUTE FUNCTION fn_resolve_log_employee();

-- AFTER INSERT: sync to employee_attendance
CREATE OR REPLACE FUNCTION fn_apply_attendance_log()
RETURNS TRIGGER AS $$
DECLARE
  v_attendance_date DATE;
BEGIN
  -- Skip if employee_id not resolved (unmapped PIN)
  IF NEW.employee_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate attendance date (UTC, TODO: per-tenant timezone)
  v_attendance_date := (NEW.ts AT TIME ZONE 'UTC')::DATE;

  -- Upsert employee_attendance
  INSERT INTO employee_attendance (
    employee_id,
    attendance_date,
    clock_in,
    clock_out,
    status,
    created_at,
    updated_at
  ) VALUES (
    NEW.employee_id,
    v_attendance_date,
    CASE WHEN NEW.type = 'clock-in' THEN NEW.ts ELSE NULL END,
    CASE WHEN NEW.type = 'clock-out' THEN NEW.ts ELSE NULL END,
    'present', -- default status
    NOW(),
    NOW()
  )
  ON CONFLICT (employee_id, attendance_date)
  DO UPDATE SET
    clock_in = CASE 
      WHEN NEW.type = 'clock-in' THEN
        CASE 
          WHEN employee_attendance.clock_in IS NULL THEN NEW.ts
          WHEN NEW.ts < employee_attendance.clock_in THEN NEW.ts
          ELSE employee_attendance.clock_in
        END
      ELSE employee_attendance.clock_in
    END,
    clock_out = CASE 
      WHEN NEW.type = 'clock-out' THEN
        CASE 
          WHEN employee_attendance.clock_out IS NULL THEN NEW.ts
          WHEN NEW.ts > employee_attendance.clock_out THEN NEW.ts
          ELSE employee_attendance.clock_out
        END
      ELSE employee_attendance.clock_out
    END,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_apply_attendance_log
AFTER INSERT ON attendance_logs
FOR EACH ROW
EXECUTE FUNCTION fn_apply_attendance_log();

-- =====================================================
-- 9. BACKFILL FUNCTION
-- =====================================================

-- Manual backfill: resolve unmapped logs after creating new mappings
CREATE OR REPLACE FUNCTION fn_backfill_unmapped_logs(
  p_tenant_id UUID,
  p_device_id UUID DEFAULT NULL
)
RETURNS TABLE(updated_count BIGINT) AS $$
DECLARE
  v_count BIGINT;
BEGIN
  -- Update attendance_logs.employee_id via mapping
  WITH updated AS (
    UPDATE attendance_logs al
    SET employee_id = m.employee_id
    FROM device_employee_mappings m
    WHERE al.employee_id IS NULL
      AND al.tenant_id = p_tenant_id
      AND (p_device_id IS NULL OR al.device_id = p_device_id)
      AND al.device_id = m.device_id
      AND al.device_employee_id = m.device_employee_id
      AND al.tenant_id = m.tenant_id
      AND m.active = true
    RETURNING al.id, al.employee_id, al.ts, al.type
  )
  -- Re-sync to employee_attendance
  , synced AS (
    INSERT INTO employee_attendance (
      employee_id,
      attendance_date,
      clock_in,
      clock_out,
      status,
      created_at,
      updated_at
    )
    SELECT
      u.employee_id,
      (u.ts AT TIME ZONE 'UTC')::DATE,
      CASE WHEN u.type = 'clock-in' THEN u.ts ELSE NULL END,
      CASE WHEN u.type = 'clock-out' THEN u.ts ELSE NULL END,
      'present',
      NOW(),
      NOW()
    FROM updated u
    ON CONFLICT (employee_id, attendance_date)
    DO UPDATE SET
      clock_in = CASE 
        WHEN EXCLUDED.clock_in IS NOT NULL THEN
          CASE 
            WHEN employee_attendance.clock_in IS NULL THEN EXCLUDED.clock_in
            WHEN EXCLUDED.clock_in < employee_attendance.clock_in THEN EXCLUDED.clock_in
            ELSE employee_attendance.clock_in
          END
        ELSE employee_attendance.clock_in
      END,
      clock_out = CASE 
        WHEN EXCLUDED.clock_out IS NOT NULL THEN
          CASE 
            WHEN employee_attendance.clock_out IS NULL THEN EXCLUDED.clock_out
            WHEN EXCLUDED.clock_out > employee_attendance.clock_out THEN EXCLUDED.clock_out
            ELSE employee_attendance.clock_out
          END
        ELSE employee_attendance.clock_out
      END,
      updated_at = NOW()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM synced;

  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_backfill_unmapped_logs IS 'Backfill employee_id and sync to employee_attendance after creating new mappings';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

