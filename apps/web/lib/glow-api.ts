/**
 * Glow API client.
 *
 * The browser never decides safety, consent, or billing outcomes — it only
 * talks to the FastAPI backend, which enforces everything server-side.
 *
 * Dev bootstrap (development only): requests a session token by asking the
 * backend to issue a Glow JWT for a locally-registered dev user. In
 * production this is replaced by a real login flow; no other code changes.
 *
 * Network errors (API server offline) throw a GlowApiOfflineError with a
 * human-readable message rather than a raw "Failed to fetch" TypeError.
 */

export const API_BASE = process.env.NEXT_PUBLIC_GLOW_API_URL ?? "http://127.0.0.1:8600";

/** Thrown when the Glow API server cannot be reached at all. */
export class GlowApiOfflineError extends Error {
  constructor() {
    super(
      "Cannot reach the Glow API server. " +
        "Start it with:\n\n" +
        "  .tools\\python313\\Scripts\\uvicorn glow_api.main:app --app-dir apps\\api\\src --reload\n\n" +
        `Expected at: ${API_BASE}`,
    );
    this.name = "GlowApiOfflineError";
  }
}

type TokenState = { token: string | null; userId: string | null };

const state: TokenState = { token: null, userId: null };

const STORAGE_KEY = "glow.dev.token";
const USER_KEY = "glow.dev.userId";

/** Wrap fetch and convert network-level errors to GlowApiOfflineError. */
async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    // TypeError: Failed to fetch — server is unreachable
    if (err instanceof TypeError) throw new GlowApiOfflineError();
    throw err;
  }
}

/** Ensure a stable user identity + token exist (dev bootstrap via backend). */
export async function ensureSession(): Promise<{ token: string; userId: string }> {
  if (state.token && state.userId) return { token: state.token, userId: state.userId };

  const savedToken = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  const savedUser = typeof window !== "undefined" ? localStorage.getItem(USER_KEY) : null;

  if (savedToken && savedUser) {
    // Verify the saved token is still accepted. If the server is down this
    // will throw GlowApiOfflineError rather than silently failing.
    const res = await apiFetch(`${API_BASE}/sessions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${savedToken}` },
    });
    if (res.ok || res.status === 409) {
      state.token = savedToken;
      state.userId = savedUser;
      return { token: savedToken, userId: savedUser };
    }
    // Token rejected — clear storage and fall through to re-bootstrap.
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_KEY);
  }

  // Ask the backend dev-bootstrap endpoint for a fresh identity+token.
  const res = await apiFetch(`${API_BASE}/auth/dev-bootstrap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Auth bootstrap failed (HTTP ${res.status})`);
  const data = (await res.json()) as { token: string; user_id: string };

  state.token = data.token;
  state.userId = data.user_id;
  localStorage.setItem(STORAGE_KEY, data.token);
  localStorage.setItem(USER_KEY, data.user_id);
  return { token: data.token, userId: data.user_id };
}

export type StartSessionResult = { sessionId: string; state: string };

export async function startGlowSession(): Promise<StartSessionResult> {
  const { token } = await ensureSession();
  const res = await apiFetch(`${API_BASE}/sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Could not start session (HTTP ${res.status})`);
  const data = (await res.json()) as { session_id: string; state: string };
  return { sessionId: data.session_id, state: data.state };
}

export async function sendMessage(sessionId: string, content: string): Promise<string> {
  const { token } = await ensureSession();
  const res = await apiFetch(
    `${API_BASE}/sessions/${encodeURIComponent(sessionId)}/message`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    },
  );
  if (!res.ok) throw new Error(`Message failed (HTTP ${res.status})`);
  const data = (await res.json()) as { reply: string };
  return data.reply;
}

export function voiceSocketUrl(sessionId: string): string {
  // token appended by caller after ensureSession()
  return `${API_BASE.replace(/^http/, "ws")}/sessions/${encodeURIComponent(sessionId)}/voice/stream`;
}

export const apiBase = API_BASE;
