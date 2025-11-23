#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PlatformIO post-build script
Tự động upload firmware lên server sau khi build thành công
"""

Import("env")
import subprocess
import sys
from pathlib import Path

def after_build(source, target, env):
    """Callback sau khi build thành công"""
    firmware_path = str(target[0])
    script_dir = Path(env["PROJECT_DIR"])
    upload_script = script_dir / "upload_to_server.py"
    
    print("\n" + "="*60)
    print("POST-BUILD: Running upload script...")
    print("="*60)
    
    try:
        # Gọi script upload
        result = subprocess.run(
            [sys.executable, str(upload_script), firmware_path],
            cwd=str(script_dir),
            capture_output=False,
            text=True
        )
        
        if result.returncode == 0:
            print("[POST-BUILD] Upload completed successfully!")
        else:
            print("[POST-BUILD] Upload failed, but build is OK")
            
    except Exception as e:
        print(f"[POST-BUILD] Error running upload script: {e}")
        print("[POST-BUILD] Build completed, but upload failed")

# Hook vào sau khi build firmware.bin
env.AddPostAction("$BUILD_DIR/${PROGNAME}.bin", after_build)

