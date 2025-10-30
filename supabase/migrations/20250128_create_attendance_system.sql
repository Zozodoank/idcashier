-- Migration: Create Attendance System
-- Phase 3: Attendance tracking, leave management, salary adjustments

-- =====================================================
-- 1. EMPLOYEE ATTENDANCE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS employee_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  clock_in TIMESTAMP,
  clock_out TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'present', -- present, absent, late, half_day, leave
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_employee_date UNIQUE (employee_id, attendance_date)
);

-- Indexes for performance
CREATE INDEX idx_attendance_employee ON employee_attendance(employee_id);
CREATE INDEX idx_attendance_date ON employee_attendance(attendance_date);
CREATE INDEX idx_attendance_status ON employee_attendance(status);

-- =====================================================
-- 2. EMPLOYEE LEAVE REQUESTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS employee_leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type VARCHAR(50) NOT NULL, -- sick, annual, unpaid, emergency, etc.
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INTEGER NOT NULL,
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  affects_salary BOOLEAN DEFAULT false,
  affects_profit_share BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_leave_employee ON employee_leave_requests(employee_id);
CREATE INDEX idx_leave_status ON employee_leave_requests(status);
CREATE INDEX idx_leave_dates ON employee_leave_requests(start_date, end_date);

-- =====================================================
-- 3. SALARY ADJUSTMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS employee_salary_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month INTEGER NOT NULL, -- 1-12
  year INTEGER NOT NULL,
  adjustment_type VARCHAR(50) NOT NULL, -- absence_deduction, bonus, penalty, etc.
  amount NUMERIC(15,2) NOT NULL, -- positive for addition, negative for deduction
  reason TEXT,
  related_attendance_id UUID REFERENCES employee_attendance(id),
  related_leave_id UUID REFERENCES employee_leave_requests(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_month CHECK (month >= 1 AND month <= 12),
  CONSTRAINT valid_year CHECK (year >= 2020 AND year <= 2100)
);

-- Indexes
CREATE INDEX idx_salary_adj_employee ON employee_salary_adjustments(employee_id);
CREATE INDEX idx_salary_adj_period ON employee_salary_adjustments(year, month);

-- =====================================================
-- 4. ADD COLUMNS TO EMPLOYEES TABLE
-- =====================================================
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS annual_leave_quota INTEGER DEFAULT 12,
ADD COLUMN IF NOT EXISTS current_leave_balance INTEGER DEFAULT 12,
ADD COLUMN IF NOT EXISTS work_schedule JSONB DEFAULT '{"monday":true,"tuesday":true,"wednesday":true,"thursday":true,"friday":true,"saturday":false,"sunday":false}'::jsonb;

-- =====================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE employee_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_salary_adjustments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 6. RLS POLICIES - EMPLOYEE ATTENDANCE
-- =====================================================

-- Policy: Users can view attendance for their tenant
CREATE POLICY "Users can view attendance for their tenant"
ON employee_attendance
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM employees
    WHERE employees.id = employee_attendance.employee_id
    AND (
      employees.user_id = auth.uid()
      OR employees.tenant_id = auth.uid()
      OR employees.tenant_id = (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
    )
  )
);

-- Policy: Users can insert attendance for their tenant
CREATE POLICY "Users can insert attendance for their tenant"
ON employee_attendance
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM employees
    WHERE employees.id = employee_attendance.employee_id
    AND (
      employees.user_id = auth.uid()
      OR employees.tenant_id = auth.uid()
      OR employees.tenant_id = (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
    )
  )
);

-- Policy: Users can update attendance for their tenant
CREATE POLICY "Users can update attendance for their tenant"
ON employee_attendance
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM employees
    WHERE employees.id = employee_attendance.employee_id
    AND (
      employees.user_id = auth.uid()
      OR employees.tenant_id = auth.uid()
      OR employees.tenant_id = (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
    )
  )
);

-- Policy: Users can delete attendance for their tenant
CREATE POLICY "Users can delete attendance for their tenant"
ON employee_attendance
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM employees
    WHERE employees.id = employee_attendance.employee_id
    AND (
      employees.user_id = auth.uid()
      OR employees.tenant_id = auth.uid()
      OR employees.tenant_id = (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
    )
  )
);

-- =====================================================
-- 7. RLS POLICIES - LEAVE REQUESTS
-- =====================================================

-- Policy: Users can view leave requests for their tenant
CREATE POLICY "Users can view leave requests for their tenant"
ON employee_leave_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM employees
    WHERE employees.id = employee_leave_requests.employee_id
    AND (
      employees.user_id = auth.uid()
      OR employees.tenant_id = auth.uid()
      OR employees.tenant_id = (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
    )
  )
);

-- Policy: Users can insert leave requests for their tenant
CREATE POLICY "Users can insert leave requests for their tenant"
ON employee_leave_requests
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM employees
    WHERE employees.id = employee_leave_requests.employee_id
    AND (
      employees.user_id = auth.uid()
      OR employees.tenant_id = auth.uid()
      OR employees.tenant_id = (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
    )
  )
);

-- Policy: Users can update leave requests for their tenant
CREATE POLICY "Users can update leave requests for their tenant"
ON employee_leave_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM employees
    WHERE employees.id = employee_leave_requests.employee_id
    AND (
      employees.user_id = auth.uid()
      OR employees.tenant_id = auth.uid()
      OR employees.tenant_id = (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
    )
  )
);

-- Policy: Users can delete leave requests for their tenant
CREATE POLICY "Users can delete leave requests for their tenant"
ON employee_leave_requests
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM employees
    WHERE employees.id = employee_leave_requests.employee_id
    AND (
      employees.user_id = auth.uid()
      OR employees.tenant_id = auth.uid()
      OR employees.tenant_id = (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
    )
  )
);

-- =====================================================
-- 8. RLS POLICIES - SALARY ADJUSTMENTS
-- =====================================================

-- Policy: Users can view salary adjustments for their tenant
CREATE POLICY "Users can view salary adjustments for their tenant"
ON employee_salary_adjustments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM employees
    WHERE employees.id = employee_salary_adjustments.employee_id
    AND (
      employees.user_id = auth.uid()
      OR employees.tenant_id = auth.uid()
      OR employees.tenant_id = (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
    )
  )
);

-- Policy: Users can insert salary adjustments for their tenant
CREATE POLICY "Users can insert salary adjustments for their tenant"
ON employee_salary_adjustments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM employees
    WHERE employees.id = employee_salary_adjustments.employee_id
    AND (
      employees.user_id = auth.uid()
      OR employees.tenant_id = auth.uid()
      OR employees.tenant_id = (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
    )
  )
);

-- Policy: Users can update salary adjustments for their tenant
CREATE POLICY "Users can update salary adjustments for their tenant"
ON employee_salary_adjustments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM employees
    WHERE employees.id = employee_salary_adjustments.employee_id
    AND (
      employees.user_id = auth.uid()
      OR employees.tenant_id = auth.uid()
      OR employees.tenant_id = (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
    )
  )
);

-- Policy: Users can delete salary adjustments for their tenant
CREATE POLICY "Users can delete salary adjustments for their tenant"
ON employee_salary_adjustments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM employees
    WHERE employees.id = employee_salary_adjustments.employee_id
    AND (
      employees.user_id = auth.uid()
      OR employees.tenant_id = auth.uid()
      OR employees.tenant_id = (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
    )
  )
);

-- =====================================================
-- 9. TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Trigger for employee_attendance
CREATE OR REPLACE FUNCTION update_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_attendance_updated_at
BEFORE UPDATE ON employee_attendance
FOR EACH ROW
EXECUTE FUNCTION update_attendance_updated_at();

-- Trigger for employee_leave_requests
CREATE OR REPLACE FUNCTION update_leave_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_leave_updated_at
BEFORE UPDATE ON employee_leave_requests
FOR EACH ROW
EXECUTE FUNCTION update_leave_updated_at();

-- =====================================================
-- 10. HELPER FUNCTIONS
-- =====================================================

-- Function to calculate working days between two dates
CREATE OR REPLACE FUNCTION calculate_working_days(
  p_start_date DATE,
  p_end_date DATE,
  p_work_schedule JSONB DEFAULT '{"monday":true,"tuesday":true,"wednesday":true,"thursday":true,"friday":true,"saturday":false,"sunday":false}'::jsonb
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_current_date DATE := p_start_date;
  v_day_name TEXT;
BEGIN
  WHILE v_current_date <= p_end_date LOOP
    v_day_name := LOWER(TO_CHAR(v_current_date, 'Day'));
    v_day_name := TRIM(v_day_name);
    
    -- Check if this day is a working day
    IF (p_work_schedule->>v_day_name)::boolean THEN
      v_count := v_count + 1;
    END IF;
    
    v_current_date := v_current_date + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-approve leave and create attendance records
CREATE OR REPLACE FUNCTION approve_leave_request(p_leave_id UUID, p_approved_by UUID)
RETURNS VOID AS $$
DECLARE
  v_leave RECORD;
  v_current_date DATE;
BEGIN
  -- Get leave request details
  SELECT * INTO v_leave FROM employee_leave_requests WHERE id = p_leave_id;
  
  -- Update leave request status
  UPDATE employee_leave_requests
  SET status = 'approved',
      approved_by = p_approved_by,
      approved_at = NOW()
  WHERE id = p_leave_id;
  
  -- Create attendance records for each day
  v_current_date := v_leave.start_date;
  WHILE v_current_date <= v_leave.end_date LOOP
    INSERT INTO employee_attendance (
      employee_id,
      attendance_date,
      status,
      notes
    ) VALUES (
      v_leave.employee_id,
      v_current_date,
      'leave',
      'Leave: ' || v_leave.leave_type
    )
    ON CONFLICT (employee_id, attendance_date) 
    DO UPDATE SET status = 'leave', notes = 'Leave: ' || v_leave.leave_type;
    
    v_current_date := v_current_date + 1;
  END LOOP;
  
  -- Update leave balance if annual leave
  IF v_leave.leave_type = 'annual' THEN
    UPDATE employees
    SET current_leave_balance = current_leave_balance - v_leave.total_days
    WHERE id = v_leave.employee_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

