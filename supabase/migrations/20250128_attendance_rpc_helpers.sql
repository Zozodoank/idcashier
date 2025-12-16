-- =====================================================
-- RPC Helper Functions for Attendance Device Management
-- Security DEFINER: runs with elevated privileges but validates tenant
-- =====================================================

-- =====================================================
-- 1. REGISTER_DEVICE: onboard new attendance machine
-- =====================================================

CREATE OR REPLACE FUNCTION register_device(
  p_device_serial TEXT,
  p_name TEXT DEFAULT NULL,
  p_secret TEXT DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_device_id UUID;
BEGIN
  -- Resolve caller's tenant_id from users table
  SELECT tenant_id INTO v_tenant_id
  FROM users
  WHERE id = auth.uid();

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'User not found or has no tenant_id';
  END IF;

  -- Upsert device (update if serial exists for this tenant)
  INSERT INTO devices (
    device_serial,
    tenant_id,
    name,
    secret,
    active,
    created_at
  ) VALUES (
    p_device_serial,
    v_tenant_id,
    p_name,
    p_secret,
    true,
    NOW()
  )
  ON CONFLICT (device_serial)
  DO UPDATE SET
    name = COALESCE(p_name, devices.name),
    secret = COALESCE(p_secret, devices.secret),
    active = true,
    created_at = devices.created_at -- preserve original
  WHERE devices.tenant_id = v_tenant_id -- safety: only update if same tenant
  RETURNING id INTO v_device_id;

  -- If conflict was with different tenant, return null (forbidden)
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Device serial % already registered to different tenant', p_device_serial;
  END IF;

  RETURN v_device_id;
END;
$$;

COMMENT ON FUNCTION register_device IS 'Register or update attendance device for current user tenant';

-- =====================================================
-- 2. MAP_DEVICE_EMPLOYEE: link device PIN to employee
-- =====================================================

CREATE OR REPLACE FUNCTION map_device_employee(
  p_device_id UUID,
  p_device_employee_id TEXT,
  p_employee_id UUID
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_device_tenant_id UUID;
  v_employee_tenant_id UUID;
BEGIN
  -- Resolve caller's tenant_id
  SELECT tenant_id INTO v_tenant_id
  FROM users
  WHERE id = auth.uid();

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'User not found or has no tenant_id';
  END IF;

  -- Validate device belongs to caller's tenant
  SELECT tenant_id INTO v_device_tenant_id
  FROM devices
  WHERE id = p_device_id;

  IF v_device_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Device not found';
  END IF;

  IF v_device_tenant_id != v_tenant_id THEN
    RAISE EXCEPTION 'Device does not belong to your tenant';
  END IF;

  -- Validate employee belongs to caller's tenant
  SELECT tenant_id INTO v_employee_tenant_id
  FROM employees
  WHERE id = p_employee_id;

  IF v_employee_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  IF v_employee_tenant_id != v_tenant_id THEN
    RAISE EXCEPTION 'Employee does not belong to your tenant';
  END IF;

  -- Upsert mapping
  INSERT INTO device_employee_mappings (
    tenant_id,
    device_id,
    device_employee_id,
    employee_id,
    active,
    created_at
  ) VALUES (
    v_tenant_id,
    p_device_id,
    p_device_employee_id,
    p_employee_id,
    true,
    NOW()
  )
  ON CONFLICT (device_id, device_employee_id)
  DO UPDATE SET
    employee_id = p_employee_id,
    active = true,
    tenant_id = v_tenant_id; -- safety update

END;
$$;

COMMENT ON FUNCTION map_device_employee IS 'Map device PIN/card to employees.id with tenant validation';

-- =====================================================
-- GRANT EXECUTE TO AUTHENTICATED USERS
-- =====================================================

GRANT EXECUTE ON FUNCTION register_device TO authenticated;
GRANT EXECUTE ON FUNCTION map_device_employee TO authenticated;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

