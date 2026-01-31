
import requests
import json
import time

BASE_URL = "http://localhost:5000"

def test_api():
    print("--- Starting API Test ---")
    
    # 1. Check Root
    try:
        print(f"Checking {BASE_URL}/ ...")
        resp = requests.get(f"{BASE_URL}/", timeout=5)
        print(f"Root Status: {resp.status_code}")
        print(f"Root Response: {resp.text}")
    except Exception as e:
        print(f"Root Check Failed: {e}")
        return

    # 2. Login
    print("\nAttempting Login...")
    login_url = f"{BASE_URL}/token"
    # Try default credentials or register
    username = "test_user_file"
    password = "password123"
    
    # Register
    try:
        reg_resp = requests.post(f"{BASE_URL}/register", json={
            "username": username, "password": password, "email": "test@test.com", "full_name": "Test User"
        })
        print(f"Register status: {reg_resp.status_code}")
    except:
        pass

    # Login
    try:
        resp = requests.post(login_url, data={"username": username, "password": password})
        if resp.status_code != 200:
            print(f"Login Failed: {resp.text}")
            return
        
        token = resp.json()["access_token"]
        print(f"Login Successful. Token: {token[:10]}...")
    except Exception as e:
        print(f"Login Exception: {e}")
        return

    # 3. Upload
    print("\nAttempting Upload...")
    upload_url = f"{BASE_URL}/upload"
    headers = {"Authorization": f"Bearer {token}"}
    files = {'file': ('test_file.txt', 'Hello content', 'text/plain')}
    
    try:
        u_resp = requests.post(upload_url, headers=headers, files=files)
        print(f"Upload Status: {u_resp.status_code}")
        print(f"Upload Response: {u_resp.text}")
    except Exception as e:
        print(f"Upload Exception: {e}")

    # 4. List
    print("\nListing Files...")
    list_url = f"{BASE_URL}/files"
    try:
        l_resp = requests.get(list_url, headers=headers)
        print(f"List Status: {l_resp.status_code}")
        print(f"List Response: {l_resp.text}")
    except Exception as e:
        print(f"List Exception: {e}")

if __name__ == "__main__":
    test_api()
