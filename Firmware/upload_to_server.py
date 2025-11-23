#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script upload firmware lên server
Cách dùng: python upload_to_server.py [firmware_path] [version]
"""

import requests
import os
import sys
import re
from pathlib import Path

# Fix encoding for Windows console
if sys.platform == "win32":
    import codecs
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

# Cấu hình server
SERVER_URL = "http://serverdung.ddns.net:8080/greenhouse/upload.php"
UPLOAD_KEY = "greenhouse_secret_key_2024"

def get_version_from_code():
    """Đọc version từ config.h"""
    config_h = Path(__file__).parent / "include" / "config.h"
    if not config_h.exists():
        return None
    
    content = config_h.read_text(encoding='utf-8')
    match = re.search(r'#define\s+FW_VERSION\s+"([^"]+)"', content)
    if match:
        return match.group(1)
    return None

def upload_firmware(firmware_path, version):
    """Upload firmware lên server"""
    if not os.path.exists(firmware_path):
        print(f"[ERROR] Không tìm thấy firmware: {firmware_path}")
        return False
    
    file_size = os.path.getsize(firmware_path)
    print(f"\n{'='*60}")
    print(f"[UPLOAD] Uploading firmware to server...")
    print(f"[INFO] Firmware: {firmware_path}")
    print(f"[INFO] Size: {file_size:,} bytes ({file_size/1024:.1f} KB)")
    print(f"[INFO] Version: {version}")
    print(f"[INFO] Server: {SERVER_URL}")
    print(f"{'='*60}")
    
    try:
        with open(firmware_path, 'rb') as f:
            files = {'firmware': ('greenhouse_latest.bin', f, 'application/octet-stream')}
            data = {
                'version': version,
                'upload_key': UPLOAD_KEY
            }
            
            response = requests.post(SERVER_URL, files=files, data=data, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    data = result.get('data', {})
                    print(f"\n[SUCCESS] Upload completed!")
                    print(f"   Version: {data.get('version', 'N/A')}")
                    print(f"   Filename: {data.get('filename', 'N/A')}")
                    print(f"   Size: {data.get('size', 'N/A')}")
                    print(f"   URL: {data.get('download_url', 'N/A')}")
                    print(f"{'='*60}\n")
                    return True
                else:
                    print(f"\n[ERROR] Upload failed: {result.get('message')}")
                    print(f"{'='*60}\n")
                    return False
            else:
                print(f"\n[ERROR] HTTP Error {response.status_code}")
                print(response.text)
                print(f"{'='*60}\n")
                return False
                
    except requests.exceptions.Timeout:
        print("\n[ERROR] Upload timeout (30s)")
        print(f"{'='*60}\n")
        return False
    except requests.exceptions.ConnectionError:
        print("\n[ERROR] Khong the ket noi server")
        print(f"{'='*60}\n")
        return False
    except Exception as e:
        print(f"\n[ERROR] {e}")
        print(f"{'='*60}\n")
        return False

def main():
    # Lấy arguments
    if len(sys.argv) < 2:
        print("[ERROR] Usage: python upload_to_server.py <firmware_path> [version]")
        sys.exit(1)
    
    firmware_path = sys.argv[1]
    
    # Lấy version
    if len(sys.argv) > 2:
        version = sys.argv[2]
    else:
        version = get_version_from_code()
        if not version:
            print("[ERROR] Không tìm thấy version trong config.h")
            sys.exit(1)
    
    # Upload
    success = upload_firmware(firmware_path, version)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()

