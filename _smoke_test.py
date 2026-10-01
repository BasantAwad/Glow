#!/usr/bin/env python3
"""End-to-end smoke test for Glow API."""
import json, urllib.request, urllib.error, sys

BASE = "http://127.0.0.1:8000"

def req(method, path, body=None, token=None):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, data=data, headers=headers, method=method))
        return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

print("=== 1. Register ===")
status, resp = req("POST", "/auth/register", {
    "email": "testuser@example.com",
    "password": "securepass123",
    "display_name": "Test User",
})
print(f"  status={status}")
print(f"  response={resp}")

if status not in (200, 201):
    print("  FAILED to register")
    sys.exit(1)

user_id = resp.get("id") or resp.get("user_id")
token = resp.get("access_token") or resp.get("token")
print(f"  user_id={user_id} token={token[:30]}...")

print("\n=== 2. Login ===")
status, resp = req("POST", "/auth/login", {
    "email": "testuser@example.com",
    "password": "securepass123",
})
print(f"  status={status}")
print(f"  response keys={list(resp.keys()) if isinstance(resp,dict) else type(resp)}")
token2 = resp.get("access_token") or resp.get("token")
if token2:
    token = token2
    print(f"  new token={token[:30]}...")

print("\n=== 3. Create Session ===")
status, resp = req("POST", "/sessions", {"locale": "en"}, token=token)
print(f"  status={status}")
print(f"  response={resp}")
session_id = resp.get("id") or resp.get("session_id")
if not session_id:
    print("  FAILED - no session id")
    sys.exit(1)
print(f"  session_id={session_id}")

print("\n=== 4. Send Message (context-aware test) ===")
status, resp = req("POST", f"/sessions/{session_id}/message", {
    "message": "I've been feeling really anxious about work lately, what should I do?"
}, token=token)
print(f"  status={status}")
print(f"  response keys={list(resp.keys())}")
assistant_msg = resp.get("assistant_message") or resp.get("message") or resp.get("response") or resp.get("text") or ""
print(f"  assistant reply ({len(assistant_msg)} chars):")
print(f"  ---")
print(assistant_msg[:500])
print(f"  ---")

if not assistant_msg:
    print("\n  FAILED - empty reply")
    sys.exit(1)

# Check if the reply is context-aware (mentions anxiety/work)
checks = ["anxious", "anxiety", "work", "stress", "feel", "you're", "you are"]
hits = sum(1 for c in checks if c.lower() in assistant_msg.lower())
print(f"\n  Context awareness: {hits}/{len(checks)} keywords matched")

print("\n=== 5. Journal entry ===")
status, resp = req("POST", "/journal", {
    "entry": "Today was tough. Felt anxious all day at work.",
    "mood": "anxious",
}, token=token)
print(f"  status={status} response={resp}")

print("\n=== 6. Get Sessions History ===")
status, resp = req("GET", "/sessions/history", token=token)
print(f"  status={status}")
sessions = resp.get("sessions") or resp.get("data") or []
print(f"  sessions count={len(sessions)}")
for s in sessions[:3]:
    print(f"    - {s.get('id','?')}: {s.get('created_at','?')} | msgs={s.get('message_count', s.get('message_count', '?'))}")

print("\n=== 7. Session Doctor Summary ===")
status, resp = req("GET", f"/sessions/{session_id}/doctor-summary", token=token)
print(f"  status={status}")
summary = resp.get("summary") or resp.get("text") or resp.get("doctor_summary") or ""
print(f"  summary ({len(summary)} chars): {summary[:200]}")

print("\n=== 8. Profile ===")
status, resp = req("GET", "/profile", token=token)
print(f"  status={status}")
print(f"  profile={json.dumps(resp, indent=2)[:300]}")

print("\n=== 9. Dev Bootstrap (check existing users) ===")
status, resp = req("POST", "/auth/dev-bootstrap", {"action": "status"})
print(f"  status={status}")
print(f"  response={resp}")

print("\n=== ALL TESTS COMPLETE ===")
