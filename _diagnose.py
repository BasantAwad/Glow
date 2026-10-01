import sys, os, glob

print("=== sys.path ===")
for i, p in enumerate(sys.path):
    print(f"  [{i}] {p}")

print("\n=== Searching for glow_api on sys.path ===")
for p in sys.path:
    if not p or not os.path.isdir(p):
        continue
    ga_dir = os.path.join(p, "glow_api")
    if os.path.isdir(ga_dir):
        main_py = os.path.join(ga_dir, "main.py")
        init_py = os.path.join(ga_dir, "__init__.py")
        eggs = glob.glob(os.path.join(p, "glow_api*.egg-info"))
        print(f"\n  glow_api DIR: {ga_dir}")
        print(f"    __init__.py: {os.path.isfile(init_py)}")
        print(f"    main.py: {os.path.isfile(main_py)}")
        if eggs:
            print(f"    egg-info: {eggs}")
        if os.path.isfile(main_py):
            import datetime
            mtime = os.path.getmtime(main_py)
            print(f"    main.py mtime: {datetime.datetime.fromtimestamp(mtime)}")
        # Show first line of main.py if it exists
        if os.path.isfile(main_py):
            with open(main_py) as f:
                print(f"    main.py first line: {f.readline().rstrip()}")

# Now actually import it the way uvicorn does
print("\n=== Actual import resolution ===")
import glow_api
print(f"glow_api.__file__ = {glow_api.__file__}")
print(f"glow_api.__path__ = {glow_api.__path__}")

import glow_api.main
print(f"glow_api.main.__file__ = {glow_api.main.__file__}")

# Check what main.py actually does at module level
import inspect
src = inspect.getsource(glow_api.main)
print(f"\n=== main.py source (first 500 chars) ===")
print(src[:500])
