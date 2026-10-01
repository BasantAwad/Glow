#!/usr/bin/env python3
"""
E2E smoke test for Glow API — validates full pipeline.
Run while uvicorn is serving on :8000.
"""
import json
import urllib.request
import urllib.error
import sys

BASE = "http://127.0.0.1:8000"
PASS, FAIL = 0, 0

def _req(method, path, body=None, token=None):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, data=data, headers=headers, method=method))
        return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw

def check(name, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  [PASS] {name}")
    else:
        FAIL += 1
        print(f"  [FAIL] {name} — {detail}")

def register_or_login():
    # Try login first
    s, r = _req("POST", "/auth/dev-bootstrap", {
        "action": "login",
        "email": "e2e_user@example.com",
        "password": "SecurePass123!",
    })
    if s == 200 and r.get("token"):
        tok = r["token"]
        uid = r.get("user_id") or r.get("id")
        return tok, uid
    # Register
    s, r = _req("POST", "/auth/dev-bootstrap", {
        "action": "register",
        "email": "e2e_user@example.com",
        "password": "SecurePass123!",
        "display_name": "E2E Test User",
        "born_at": "2000-01-01",
    })
    if s in (200, 201) and r.get("token"):
        return r["token"], r.get("user_id") or r.get("id")
    return None, None

print("=" * 60)
print("GLOW API END-TO-END SMOKE TEST")
print("=" * 60)

# 1. Auth
print("\n[1] AUTH")
tok, uid = register_or_login()
check("login/register succeeds", tok is not None, f"got token={str(tok)[:30]}")
if not tok:
    print("ABORT: no token"); sys.exit(1)

# 2. Create session
print("\n[2] SESSION")
s, r = _req("POST", "/sessions", {"locale": "en"}, token=tok)
sid = r.get("session_id") or r.get("id")
check("create session", bool(sid), f"status={s} body={r}")
if not sid:
    print("ABORT: no session"); sys.exit(1)

# 3. Send message & verify context awareness
print("\n[3] CHAT — context awareness")
s, r = _req("POST", f"/sessions/{sid}/message", {
    "content": "Hi, I've been feeling really anxious about my job lately and I don't know what to do.",
}, token=tok)
reply = r.get("reply", "") or r.get("assistant_message", "") or r.get("message", "") or ""
check("message send 200", s == 200, f"status={s}")
check("reply non-empty", len(reply) > 20, f"len={len(reply)}")
# Context keywords
kw = ["anxious", "anxiety", "job", "work", "stress", "feel", "you're", "you are", "glad", "here"]
hits = [k for k in kw if k in reply.lower()]
check(f"context keywords present ({len(hits)}/{len(kw)})", len(hits) >= 2, f"hits={hits}")

# 4. Follow-up (second message in same session — context continuity)
print("\n[4] CHAT — follow-up continuity")
s, r = _req("POST", f"/sessions/{sid}/message", {
    "content": "Yeah, my boss has been criticizing everything I do and it's really draining me.",
}, token=tok)
reply2 = r.get("reply", "") or r.get("assistant_message", "") or r.get("message", "") or ""
check("follow-up 200", s == 200, f"status={s}")
check("follow-up non-empty", len(reply2) > 20, f"len={len(reply2)}")
kw2 = ["boss", "criticism", "criticize", "drain", "feel", "work", "anxious"]
hits2 = [k for k in kw2 if k in reply2.lower()]
check(f"context keywords follow-up ({len(hits2)}/{len(kw2)})", len(hits2) >= 1, f"hits={hits2}")

# 5. Journal
print("\n[5] JOURNAL")
s, r = _req("POST", "/journal", {
    "content": "Today was a hard day. Felt anxious and overwhelmed at work.",
    "mood": "anxious",
}, token=tok)
jid = r.get("id") or r.get("journal_id")
check("journal create 200", s == 200, f"status={s}")
check("journal has id", jid is not None, f"id={jid}")

# 6. Mood
print("\n[6] MOOD")
s, r = _req("POST", "/mood", {"mood": "anxious", "intensity": 8}, token=tok)
check("mood record 200", s == 200, f"status={s}")

# 7. Sessions history
print("\n[7] SESSIONS HISTORY")
s, r = _req("GET", "/sessions/history", token=tok)
check("history 200", s == 200, f"status={s}")
sessions = []
if isinstance(r, dict):
    sessions = r.get("sessions", r.get("data", []))
check("history is list", isinstance(sessions, list), f"type={type(sessions)}")
check("history has entries", len(sessions) > 0, f"count={len(sessions)}")

# 8. Doctor summary
print("\n[8] DOCTOR SUMMARY")
s, r = _req("GET", f"/sessions/{sid}/doctor-summary", token=tok)
summary = r.get("summary", "") or r.get("text", "") or r.get("doctor_summary", "") or ""
check("doctor-summary 200", s == 200, f"status={s}")
check("summary non-empty", len(summary) > 20, f"len={len(summary)}")

# 9. Profile
print("\n[9] PROFILE")
s, r = _req("GET", "/profile", token=tok)
check("profile 200", s == 200, f"status={s}")

print("\n" + "=" * 60)
print(f"RESULTS: {PASS} passed, {FAIL} failed out of {PASS+FAIL}")
print("=" * 60)
if FAIL:
    sys.exit(1)
