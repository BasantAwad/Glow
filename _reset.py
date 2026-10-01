import psutil, time, os, shutil

# 1. Kill all uvicorn
killed = []
for p in psutil.process_iter(['pid', 'name', 'cmdline']):
    try:
        cl = p.cmdline() or []
        if 'uvicorn glow_api.main:app' in ' '.join(cl) and 'python' in (p.name() or ''):
            p.kill()
            killed.append(p.pid)
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        pass
print(f'Killed: {killed}')

time.sleep(2)

# 2. Remove DB
glow_db = 'glow.db'
if os.path.exists(glow_db):
    os.remove(glow_db)
    print(f'Removed {glow_db}')

# 3. Clear all __pycache__ under apps/
for root, dirs, files in os.walk('apps'):
    for d in list(dirs):
        if d == '__pycache__':
            shutil.rmtree(os.path.join(root, d), ignore_errors=True)
print('Cleared __pycache__')

# 4. Double-check no uvicorn still alive
remaining = []
for p in psutil.process_iter(['pid', 'name', 'cmdline']):
    try:
        cl = p.cmdline() or []
        if 'uvicorn glow_api.main:app' in ' '.join(cl) and 'python' in (p.name() or ''):
            remaining.append(p.pid)
    except:
        pass
if remaining:
    print(f'WARNING still running: {remaining}')
else:
    print('All clear - port 8000 is free')

print('DONE')
