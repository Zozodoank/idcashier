// =====================================================
// Attendance Domain Types
// =====================================================

export interface Device {
  id: string
  device_serial: string
  tenant_id: string
  name: string | null
  secret: string | null
  active: boolean
  created_at: string
}

export interface DeviceEmployeeMapping {
  id: number
  tenant_id: string
  device_id: string
  device_employee_id: string // PIN/card from machine
  employee_id: string
  active: boolean
  created_at: string
}

export interface AttendanceLog {
  id: number
  tenant_id: string
  device_id: string
  device_employee_id: string
  employee_id: string | null
  type: 'clock-in' | 'clock-out' | null
  machine_ts: string | null
  ts: string
  dedupe_key: string
  received_at: string
}

export interface EmployeeAttendance {
  id: string
  employee_id: string
  attendance_date: string
  clock_in: string | null
  clock_out: string | null
  status: string
  notes: string | null
  created_at: string
  updated_at: string
  // Joined data
  employees?: {
    id: string
    name: string
    email: string | null
  }
}

export interface Employee {
  id: string
  tenant_id: string
  name: string
  email: string | null
  is_active: boolean
}

