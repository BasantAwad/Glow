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

export const API_BASE = process.env.NEXT_PUBLIC_GLOW_API_URL ?? "http://127.0.0.1:8000";

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

export class GlowApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.name = "GlowApiError";
    this.status = status;
    this.code = code;
  }
}

type TokenState = { token: string | null; userId: string | null };

const state: TokenState = { token: null, userId: null };

const STORAGE_KEY = "glow.dev.token";
const USER_KEY = "glow.dev.userId";

/** Wrap fetch and convert network-level errors to GlowApiOfflineError. */
export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    // TypeError: Failed to fetch — server is unreachable
    if (err instanceof TypeError) throw new GlowApiOfflineError();
    throw err;
  }
}

/** Convert an API failure into a short message suitable for the UI. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof GlowApiOfflineError) {
    return "Glow is temporarily unavailable. Please check that the support service is running and try again.";
  }
  if (error instanceof GlowApiError) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}

async function throwApiError(response: Response, fallback: string): Promise<never> {
  let payload: { detail?: unknown; error?: unknown; code?: unknown } = {};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    // Use the status-based fallback when the server returned no JSON body.
  }

  const code = typeof payload.code === "string" ? payload.code : null;
  const detail = typeof payload.detail === "string" ? payload.detail : null;
  let message = fallback;
  if (response.status === 401) message = "Your session has expired. Please sign in again.";
  else if (response.status === 403) message = "This action is not available for your account yet.";
  else if (response.status === 409) message = "That action is already in progress. Please try again.";
  else if (response.status === 422) message = "Please check the information and try again.";
  else if (response.status === 503) message = "Glow's support service is temporarily unavailable. Please try again shortly.";
  else if (response.status >= 500) message = "Glow had trouble completing that. Please try again shortly.";
  else if (detail && detail.length < 180) message = detail;
  throw new GlowApiError(response.status, message, code);
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
  if (!res.ok) await throwApiError(res, "Could not start your Glow session.");
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
  if (!res.ok) await throwApiError(res, "Could not start a support session.");
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
  if (!res.ok) await throwApiError(res, "Glow could not respond just now. Please try again.");
  const data = (await res.json()) as { reply: string };
  return data.reply;
}

export function voiceSocketUrl(sessionId: string): string {
  // token appended by caller after ensureSession()
  return `${API_BASE.replace(/^http/, "ws")}/sessions/${encodeURIComponent(sessionId)}/voice/stream`;
}

export const apiBase = API_BASE;
