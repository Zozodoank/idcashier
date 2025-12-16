import requests
import uuid

BASE_URL = "http://localhost:3000"
TIMEOUT = 30
TOKEN = "your_valid_token_here"  # Replace with a valid auth token
HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {TOKEN}"
}

def check_employee_role_and_attendance_management():
    created_employee_id = None
    created_attendance_id = None
    try:
        # Step 1: Create a new employee with a role assigned
        employee_payload = {
            "name": "Test Employee " + str(uuid.uuid4()),
            "email": f"test_employee_{uuid.uuid4().hex[:8]}@example.com",
            "role_key": "staff"
        }
        response = requests.post(f"{BASE_URL}/api/employees", json=employee_payload, headers=HEADERS, timeout=TIMEOUT)
        assert response.status_code == 201, f"Failed to create employee: {response.text}"
        employee = response.json()
        created_employee_id = employee.get("id")
        assert created_employee_id is not None, "Employee ID is missing after creation"
        assert employee.get("role_key") == "staff", "Employee role is not assigned correctly"

        # Step 2: Try to update employee role - permission enforcement (assuming only admin can change role)
        update_role_payload = {"role_key": "manager"}
        response = requests.put(f"{BASE_URL}/api/employees/{created_employee_id}/role", json=update_role_payload, headers=HEADERS, timeout=TIMEOUT)
        # Assuming response 403 Forbidden if no permission, or 200 OK if allowed
        assert response.status_code in (200, 403), f"Unexpected status for role update: {response.status_code}"
        if response.status_code == 200:
            updated_employee = response.json()
            assert updated_employee.get("role_key") == "manager", "Role update failed"
        else:
            error = response.json()
            assert "permission" in error.get("message", "").lower(), "Role update denied but no permission error message"

        # Step 3: Record attendance for the employee
        attendance_payload = {
            "employee_id": created_employee_id,
            "date": "2025-11-19",
            "status": "present",
            "check_in_time": "09:00:00",
            "check_out_time": "17:00:00"
        }
        response = requests.post(f"{BASE_URL}/api/attendance", json=attendance_payload, headers=HEADERS, timeout=TIMEOUT)
        assert response.status_code == 201, f"Failed to create attendance record: {response.text}"
        attendance = response.json()
        created_attendance_id = attendance.get("id")
        assert created_attendance_id is not None, "Attendance record ID missing after creation"
        assert attendance.get("status") == "present", "Attendance status not recorded correctly"

        # Step 4: Retrieve attendance records for employee
        response = requests.get(f"{BASE_URL}/api/employees/{created_employee_id}/attendance", headers=HEADERS, timeout=TIMEOUT)
        assert response.status_code == 200, f"Failed to get attendance records: {response.text}"
        attendance_list = response.json()
        assert any(a.get("id") == created_attendance_id for a in attendance_list), "Recorded attendance not found in retrieval"

    finally:
        # Cleanup attendance record
        if created_attendance_id:
            try:
                requests.delete(f"{BASE_URL}/api/attendance/{created_attendance_id}", headers=HEADERS, timeout=TIMEOUT)
            except Exception:
                pass

        # Cleanup created employee
        if created_employee_id:
            try:
                requests.delete(f"{BASE_URL}/api/employees/{created_employee_id}", headers=HEADERS, timeout=TIMEOUT)
            except Exception:
                pass

check_employee_role_and_attendance_management()