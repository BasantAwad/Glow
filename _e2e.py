import urllib.request, json, sys, time

BASE = 'http://127.0.0.1:8000'
P, F = 0, 0

def ok(n, c, d=''):
    global P, F
    if c:
        P += 1
        print(f'  [PASS] {n}\n{d}')
    else:
        F += 1
        print(f'  [FAIL] {n}: {d}')

def post(path, body, token=None, timeout=30):
    url = BASE + path
    data = json.dumps(body).encode()
    h = {'Content-Type': 'application/json'}
    if token:
        h['Authorization'] = 'Bearer ' + token
    return urllib.request.urlopen(urllib.request.Request(url, data=data, headers=h, method='POST'), timeout=timeout)

def get(path, token=None, timeout=10):
    url = BASE + path
    h = {}
    if token:
        h['Authorization'] = 'Bearer ' + token
    return urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=timeout)

# 1. Login via dev-bootstrap
t0 = time.time()
try:
    r = post('/auth/dev-bootstrap', {'action': 'login', 'email': 'qa@example.com', 'password': 'QAsecure123!'}, timeout=5)
    body = json.loads(r.read())
    tok = body.get('token') or body.get('access_token')
    uid = body.get('user_id')
    ok('1. login', bool(tok), f'uid={uid} token_present={bool(tok)}')
    if not tok:
        sys.exit(1)
except Exception as e:
    ok('1. login', False, str(e)[:200])
    sys.exit(1)

# 2. Create session
try:
    r = post('/sessions', {'locale': 'en'}, tok, timeout=5)
    body = json.loads(r.read())
    sid = body.get('session_id') or body.get('id')
    ok('2. create session', bool(sid), f'sid={sid} status={r.status}')
    if not sid:
        sys.exit(1)
except Exception as e:
    ok('2. create session', False, str(e)[:200])
    sys.exit(1)

# 3. Send first message (local model — must be fast)
t0 = time.time()
try:
    r = post(f'/sessions/{sid}/message', {'content': 'I have been feeling really anxious about my job lately and I dont know what to do.'}, tok, timeout=10)
    body = json.loads(r.read())
    dt = time.time() - t0
    reply = body.get('reply', '')
    ok('3. message 1', r.status == 200 and len(reply) > 30,
       f'reply_len={len(reply)} latency={dt:.2f}s\n   reply: {reply[:200]}')
except Exception as e:
    dt = time.time() - t0
    ok('3. message 1', False, f'after {dt:.1f}s: {e}')

# 4. Follow-up — context-awareness check
t1 = time.time()
try:
    r = post(f'/sessions/{sid}/message', {'content': 'Yeah and also my coworkers are being difficult.'}, tok, timeout=10)
    body = json.loads(r.read())
    dt = time.time() - t1
    reply = body.get('reply', '')
    ctx_aware = any(w in reply.lower() for w in ['job', 'work', 'coworker', 'colleague'])
    ok('4. follow-up (context-aware)', r.status == 200 and len(reply) > 30 and ctx_aware,
       f'reply_len={len(reply)} latency={dt:.2f}s ctx_aware={ctx_aware}\n   reply: {reply[:200]}')
except Exception as e:
    dt = time.time() - t1
    ok('4. follow-up', False, f'after {dt:.1f}s: {e}')

# 5. Mood
try:
    r = post(f'/sessions/{sid}/mood', {'mood': 3}, tok, timeout=5)
    body = json.loads(r.read())
    ok('5. mood', r.status == 200, f'status={r.status} resp={json.dumps(body)[:120]}')
except Exception as e:
    ok('5. mood', False, str(e)[:200])

# 6. Journal
try:
    r = post('/journal', {'entry': 'Had a rough night sleep-wise. Still feeling tired today.', 'mood': 2}, tok, timeout=5)
    body = json.loads(r.read())
    ok('6. journal', r.status in (200, 201), f'status={r.status}')
except Exception as e:
    ok('6. journal', False, str(e)[:200])

# 7. Second session + message
try:
    r = post('/sessions', {'locale': 'en'}, tok, timeout=5)
    body = json.loads(r.read())
    sid2 = body.get('session_id') or body.get('id')
    r = post(f'/sessions/{sid2}/message', {'content': 'Hi there'}, tok, timeout=10)
    body = json.loads(r.read())
    ok('7. second session + message', r.status == 200 and len(body.get('reply', '')) > 20,
       f'sid2={sid2} reply={body.get("reply", "")[:100]}')
except Exception as e:
    ok('7. second session', False, str(e)[:200])

# 8. Sessions list
try:
    r = get('/sessions', tok, timeout=5)
    body = json.loads(r.read())
    items = body.get('items', [])
    ok('8. list sessions', r.status == 200 and isinstance(items, list),
       f'count={len(items)} status={r.status}')
except Exception as e:
    ok('8. list sessions', False, str(e)[:200])

# 9. Profile
try:
    r = get('/profile', tok, timeout=5)
    body = json.loads(r.read())
    ok('9. profile', r.status == 200 and 'user_id' in body,
       f'status={r.status} keys={list(body.keys())[:5]}')
except Exception as e:
    ok('9. profile', False, str(e)[:200])

# 10. Healthz
try:
    r = get('/healthz', timeout=3)
    ok('10. healthz', r.status == 200, f'status={r.status}')
except Exception as e:
    ok('10. healthz', False, str(e)[:200])

print(f'\n===== {P} PASSED / {F} FAILED =====')
