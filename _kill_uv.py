import psutil

for p in psutil.process_iter(['pid','name','cmdline']):
    cl = p.info['cmdline'] or []
    joined = ' '.join(cl)
    if 'uvicorn glow_api.main:app' in joined and 'python' in (p.info['name'] or ''):
        print(f'PID {p.pid}: {joined[:120]}')
        try:
            p.kill()
            print(f'  killed')
        except Exception as e:
            print(f'  kill failed: {e}')
print('done')
