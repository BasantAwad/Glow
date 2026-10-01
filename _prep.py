import psutil, time, os, signal

# 1. Kill all uvicorn glow_api processes
killed = []
for p in psutil.process_iter(['pid', 'name', 'cmdline']):
    try:
        cl = p.cmdline() or []
        if 'uvicorn glow_api.main:app' in ' '.join(cl) and 'python' in (p.name() or ''):
            p.kill()
            killed.append(p.pid)
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        pass

print(f'Killed uvicorn PIDs: {killed}')

# Brief pause then re-check
time.sleep(2)
remaining = []
for p in psutil.process_iter(['pid', 'name', 'cmdline']):
    try:
        cl = p.cmdline() or []
        if 'uvicorn glow_api.main:app' in ' '.join(cl) and 'python' in (p.name() or ''):
            remaining.append(p.pid)
    except:
        pass

if remaining:
    print(f'WARNING: {len(remaining)} uvicorn(s) still running: {remaining}')
else:
    print('All uvicorn glow_api processes stopped')

# 2. Remove old DB
glow_db = os.path.join(os.getcwd(), 'glow.db')
if os.path.exists(glow_db):
    os.remove(glow_db)
    print(f'Removed {glow_db}')

# 3. Clear __pycache__
for root, dirs, files in os.walk('apps'):
    for d in dirs:
        if d == '__pycache__':
            path = os.path.join(root, d)
            try:
                for f in os.listdir(path):
                    os.remove(os.path.join(path, f))
                os.rmdir(path)
            except:
                pass
print('Cleared __pycache__ dirs')

print('READY')
