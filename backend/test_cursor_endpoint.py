import requests
import json
from datetime import datetime
import time

# Configuration
BASE_URL = "http://localhost:8000"
USERNAME = "testuser"
PASSWORD = "password"
SESSION_NAME = "Cursor API Test"

def login():
    """Log in and get authentication token"""
    login_data = {
        "username": USERNAME,
        "password": PASSWORD
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/token", data=login_data)
        response.raise_for_status()
        token_data = response.json()
        return token_data["access_token"]
    except Exception as e:
        print(f"Login failed: {e}")
        return None

def create_session(token):
    """Create a new session"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    session_data = {
        "name": SESSION_NAME,
        "deviceInfo": "Test Script"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/sessions", 
                                 headers=headers, 
                                 json=session_data)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Session creation failed: {e}")
        return None

def send_cursor_data(token, session_id):
    """Send a test batch of cursor data"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Create sample cursor data (10 points)
    cursor_data = []
    timestamp = int(time.time() * 1000)  # Current time in milliseconds
    
    for i in range(10):
        cursor_data.append({
            "x": 100 + i * 10,  # Simple increasing x values
            "y": 200 + i * 5,   # Simple increasing y values
            "timestamp": timestamp + (i * 100)  # Timestamps 100ms apart
        })
    
    try:
        print(f"Sending {len(cursor_data)} cursor points to session {session_id}")
        response = requests.post(f"{BASE_URL}/api/sessions/{session_id}/cursor/batch", 
                                 headers=headers, 
                                 json=cursor_data)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Sending cursor data failed: {e}")
        if hasattr(e, 'response') and e.response:
            print(f"Response status: {e.response.status_code}")
            print(f"Response text: {e.response.text}")
        return None

def verify_cursor_data(token, session_id):
    """Verify cursor data was stored by retrieving it"""
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    try:
        response = requests.get(f"{BASE_URL}/api/sessions/{session_id}/cursor", 
                                headers=headers)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Verification failed: {e}")
        return None

def main():
    print("Starting cursor endpoint test...")
    
    # Step 1: Login
    token = login()
    if not token:
        print("Failed to log in. Exiting.")
        return
    print("Login successful.")
    
    # Step 2: Create a session
    session = create_session(token)
    if not session:
        print("Failed to create session. Exiting.")
        return
    
    session_id = session["id"]
    print(f"Created session with ID: {session_id}")
    
    # Step 3: Send cursor data
    result = send_cursor_data(token, session_id)
    if not result:
        print("Failed to send cursor data. Exiting.")
        return
    
    print(f"Cursor data sent successfully: {result}")
    
    # Step 4: Verify cursor data was stored
    verification = verify_cursor_data(token, session_id)
    if not verification:
        print("Failed to verify cursor data. Exiting.")
        return
    
    print(f"Cursor data verification: {json.dumps(verification, indent=2)}")
    if verification.get("points") and len(verification.get("points")) > 0:
        print(f"SUCCESS: Found {len(verification.get('points'))} cursor points in the database.")
    else:
        print("ERROR: No cursor points found in database.")
    
    print("Test completed.")

if __name__ == "__main__":
    main() 