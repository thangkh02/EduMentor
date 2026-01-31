
import requests
import json

BASE_URL = "http://localhost:5000"

# 1. Login to get token
def login(username, password):
    url = f"{BASE_URL}/token"
    # Use form data for OAuth2
    data = {
        "username": username,
        "password": password
    }
    try:
        response = requests.post(url, data=data)
        if response.status_code == 200:
            token = response.json().get("access_token")
            print(f"Login successful. Token: {token[:20]}...")
            return token
        else:
            print(f"Login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Login error: {e}")
        return None

# 2. Upload file
def upload_file(token):
    url = f"{BASE_URL}/upload"
    headers = {"Authorization": f"Bearer {token}"}
    files = {'file': ('test_doc.txt', 'This is a test document content.', 'text/plain')}
    
    try:
        response = requests.post(url, headers=headers, files=files)
        print(f"Upload Status: {response.status_code}")
        print(f"Upload Response: {response.text}")
        return response.status_code == 200
    except Exception as e:
        print(f"Upload error: {e}")
        return False

# 3. List files
def list_files(token):
    url = f"{BASE_URL}/files"
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(url, headers=headers)
        print(f"List Files Status: {response.status_code}")
        print(f"List Files Response: {response.text}")
    except Exception as e:
        print(f"List Files error: {e}")

if __name__ == "__main__":
    # Create a user first if needed, or use existing one.
    # I'll assume 'testuser1' exists or I can register one.
    # Let's try registering first just in case.
    reg_url = f"{BASE_URL}/register"
    reg_data = {
        "username": "debug_user",
        "password": "password123",
        "email": "debug@example.com",
        "full_name": "Debug User"
    }
    requests.post(reg_url, json=reg_data) # Ignore result, might fail if exists
    
    token = login("debug_user", "password123")
    
    if token:
        upload_file(token)
        list_files(token)
