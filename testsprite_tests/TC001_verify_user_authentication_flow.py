import requests
import uuid
import time

BASE_URL = "http://localhost:3000"
HEADERS = {
    "Content-Type": "application/json"
}
TIMEOUT = 30

def verify_user_authentication_flow():
    # Use unique email to avoid conflicts
    unique_email = f"testuser_{uuid.uuid4().hex[:8]}@example.com"
    password = "StrongPass!123"
    new_password = "NewStrongPass!123"
    session_token = None

    try:
        # 1. Register new user
        register_payload = {
            "email": unique_email,
            "password": password
        }
        register_response = requests.post(
            f"{BASE_URL}/auth/v1/signup",
            json=register_payload,
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert register_response.status_code in (200,201), f"Registration failed: {register_response.text}"
        register_data = register_response.json()
        assert "user" in register_data, "Registration response missing user data"
        assert register_data["user"]["email"] == unique_email, "Registered email mismatch"

        # 2. Login with registered user
        login_payload = {
            "email": unique_email,
            "password": password
        }
        login_response = requests.post(
            f"{BASE_URL}/auth/v1/token?grant_type=password",
            json=login_payload,
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        login_data = login_response.json()
        assert "access_token" in login_data, "Login response missing access_token"
        session_token = login_data["access_token"]

        auth_headers = {
            "Authorization": f"Bearer {session_token}",
            "Content-Type": "application/json"
        }

        # 3. Request password reset (initiate)
        reset_payload = {
            "email": unique_email
        }
        reset_response = requests.post(
            f"{BASE_URL}/auth/v1/recover",
            json=reset_payload,
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert reset_response.status_code in (200, 202), f"Password reset request failed: {reset_response.text}"

        # --------------------------------------------------------------
        # Normally, password reset flow sends email with link or token.
        # For testing, we'll simulate reset using an assumed endpoint or flow.
        # Assuming we have an endpoint to directly reset password for testing:
        # --------------------------------------------------------------

        # 4. Reset the password (simulate password reset confirmation)
        reset_confirm_payload = {
            "email": unique_email,
            "new_password": new_password,
            "access_token": session_token  # Using access_token for auth to reset password in test
        }
        reset_confirm_response = requests.post(
            f"{BASE_URL}/auth/v1/reset-password",
            json=reset_confirm_payload,
            headers=auth_headers,
            timeout=TIMEOUT
        )
        # Password reset might return 200 on success or 204 no content
        assert reset_confirm_response.status_code in (200, 204), f"Password reset confirmation failed: {reset_confirm_response.text}"

        # 5. Login with new password to validate password change
        login_new_payload = {
            "email": unique_email,
            "password": new_password
        }
        login_new_response = requests.post(
            f"{BASE_URL}/auth/v1/token?grant_type=password",
            json=login_new_payload,
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert login_new_response.status_code == 200, f"Login with new password failed: {login_new_response.text}"
        login_new_data = login_new_response.json()
        assert "access_token" in login_new_data, "Login response missing access_token after password reset"
        new_session_token = login_new_data["access_token"]

        # 6. Session management validation: user details endpoint with token
        user_response = requests.get(
            f"{BASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {new_session_token}"},
            timeout=TIMEOUT
        )
        assert user_response.status_code == 200, f"User info retrieval failed: {user_response.text}"
        user_data = user_response.json()
        assert user_data["email"] == unique_email, "Session user email mismatch"

    finally:
        # Cleanup: delete the test user account if possible
        # Assuming there is an endpoint to delete user by admin or user with token
        if session_token:
            try:
                del_response = requests.delete(
                    f"{BASE_URL}/auth/v1/user",
                    headers={"Authorization": f"Bearer {session_token}"},
                    timeout=TIMEOUT
                )
                assert del_response.status_code in (200,204), f"User deletion failed: {del_response.text}"
            except Exception:
                pass

verify_user_authentication_flow()
