import psutil, time

for p in psutil.process_iter(['pid','name','cmdline']):
    cl = p.info['cmdline'] or []
    if 'uvicorn glow_api.main:app' in ' '.join(cl) and 'python' in (p.info['name'] or ''):
        print(f'Killing PID {p.pid}')
        try:
            p.kill()
        except Exception as e:
            print(f'  failed: {e}')

# Wait and retry up to 5 times
for attempt in range(5):
    time.sleep(1)
    remaining = False
    for p in psutil.process_iter(['pid','name','cmdline']):
        cl = p.info['cmdline'] or []
        if 'uvicorn glow_api.main:app' in ' '.join(cl) and 'python' in (p.info['name'] or ''):
            print(f'  still alive PID {p.pid} (attempt {attempt+1})')
            remaining = True
            break
    if not remaining:
        print('  all uvicorn processes gone')
        break

print('done')
