#!/usr/bin/env python3
"""Kill all uvicorn processes and clean caches for a fresh start."""
import os, shutil, subprocess, sys, time

root = os.path.dirname(os.path.abspath(__file__))

# 1. Kill uvicorn with taskkill (reliable on Windows)
try:
    subprocess.run(["taskkill", "/F", "/IM", "python3.13.exe"], capture_output=True, timeout=10)
    time.sleep(1)
except Exception as e:
    print(f"taskkill warning: {e}")

# Also try pkill if available
try:
    subprocess.run(["bash", "-c", "pkill -9 -f uvicorn 2>/dev/null || true"], capture_output=True, timeout=5)
except Exception:
    pass

time.sleep(2)

# 2. Remove DB file
db_path = os.path.join(root, "glow.db")
if os.path.exists(db_path):
    os.remove(db_path)
    print(f"Removed {db_path}")

# 3. Clear all __pycache__ under apps/
apps_dir = os.path.join(root, "apps")
for dirpath, dirnames, filenames in os.walk(apps_dir):
    for d in list(dirnames):
        if d == "__pycache__":
            full = os.path.join(dirpath, d)
            try:
                shutil.rmtree(full)
                print(f"Cleaned {full}")
            except Exception as e:
                print(f"Warning cleaning {full}: {e}")

# 4. Also clear pycache in root-level python files if any
for p in ["_e2e.py", "_reset.py", "_smoke_test.py", "_kill_uv.py", "_kill_uv2.py", "_prep.py", "_diagnose.py"]:
    full = os.path.join(root, p)
    if os.path.exists(full):
        pycache = os.path.join(root, "__pycache__")
        if os.path.exists(pycache):
            try:
                shutil.rmtree(pycache)
                print(f"Cleaned root __pycache__")
            except Exception:
                pass

print("CLEANED - ready for fresh start")
