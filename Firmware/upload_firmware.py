#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script tự động upload firmware lên server sau khi PlatformIO build thành công.
Cách dùng: python upload_firmware.py [version]
Nếu không có version, sẽ lấy từ config.cpp
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
UPLOAD_KEY = "greenhouse_secret_key_2024"  # Phải khớp với server/greenhouse/upload.php

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
    print(f"[INFO] Firmware size: {file_size:,} bytes ({file_size/1024:.1f} KB)")
    print(f"[INFO] Version: {version}")
    print(f"[INFO] Server: {SERVER_URL}")
    print(f"[INFO] Uploading...")
    
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
                    print(f"[SUCCESS] Upload thành công!")
                    print(f"   Version: {data.get('version', 'N/A')}")
                    print(f"   Filename: {data.get('filename', 'N/A')}")
                    print(f"   Size: {data.get('size', 'N/A')}")
                    print(f"   URL: {data.get('download_url', 'N/A')}")
                    return True
                else:
                    print(f"[ERROR] Upload failed: {result.get('message')}")
                    return False
            else:
                print(f"[ERROR] HTTP Error {response.status_code}")
                print(response.text)
                return False
                
    except requests.exceptions.Timeout:
        print("[ERROR] Upload timeout (30s)")
        return False
    except requests.exceptions.ConnectionError:
        print("[ERROR] Không thể kết nối server")
        return False
    except Exception as e:
        print(f"[ERROR] Error: {e}")
        return False

def main():
    # Lấy version
    if len(sys.argv) > 1:
        version = sys.argv[1]
    else:
        version = get_version_from_code()
        if not version:
            print("[ERROR] Không tìm thấy version trong config.h")
            print("Usage: python upload_firmware.py [version]")
            sys.exit(1)
    
    # Đường dẫn firmware
    firmware_path = Path(__file__).parent / ".pio" / "build" / "esp32dev" / "firmware.bin"
    
    # Upload
    success = upload_firmware(str(firmware_path), version)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
