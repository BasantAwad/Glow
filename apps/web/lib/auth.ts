/**
 * Glow auth store — client side of the credential flow.
 *
 * The backend remains the sole authority for all decisions. This store keeps
 * a bearer token for API compatibility and also works with HttpOnly auth
 * cookies (sent automatically with credentials included).
 *
 * Tokens are persisted in localStorage so users do not lose their session on a
 * normal browser restart while the token is still valid. Legacy sessionStorage
 * values are migrated on read.
 */

import { apiFetch, API_BASE } from "./glow-api";

const TOKEN_KEY = "glow.auth.token";
const USER_KEY = "glow.auth.userId";
const NAME_KEY = "glow.auth.displayName";

export type AuthState = {
  token: string | null;
  userId: string | null;
  displayName: string | null;
};

export function getStoredAuth(): AuthState {
  if (typeof window === "undefined") return { token: null, userId: null, displayName: null };
  const token = localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  const userId = localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
  const displayName = localStorage.getItem(NAME_KEY) ?? sessionStorage.getItem(NAME_KEY);
  // Migrate legacy session-only auth to persistent local storage.
  if (token && !localStorage.getItem(TOKEN_KEY)) localStorage.setItem(TOKEN_KEY, token);
  if (userId && !localStorage.getItem(USER_KEY)) localStorage.setItem(USER_KEY, userId);
  if (displayName && !localStorage.getItem(NAME_KEY)) localStorage.setItem(NAME_KEY, displayName);
  return { token, userId, displayName };
}

export function setStoredAuth(auth: AuthState): void {
  if (!auth.token || !auth.userId) {
    clearStoredAuth();
    return;
  }
  localStorage.setItem(TOKEN_KEY, auth.token);
  localStorage.setItem(USER_KEY, auth.userId);
  if (auth.displayName) localStorage.setItem(NAME_KEY, auth.displayName);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(NAME_KEY);
  notifyAuthChange();
}

export function clearStoredAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(NAME_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(NAME_KEY);
  notifyAuthChange();
  // Best-effort server cookie clear; ignore failures.
  void fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).catch(() => undefined);
}

function notifyAuthChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("glow-auth-change"));
  }
}

export type RegisterInput = {
  email: string;
  password: string;
  display_name?: string;
  is_adult_confirmed: boolean;
  diagnosis_disclosed: boolean;
  diagnosis_note?: string;
  locale?: string;
  age: number;
  gender: "female" | "male" | "non_binary" | "prefer_not_to_say";
  medications?: string;
};

export async function apiRegister(input: RegisterInput): Promise<AuthState> {
  const res = await apiFetch(`${API_BASE}/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let detail = "Registration failed. Please check your details and try again.";
    try {
      const data = (await res.json()) as { detail?: string };
      if (data.detail && data.detail.length < 180) detail = data.detail;
    } catch {
      // Keep the safe fallback for non-JSON responses.
    }
    throw new Error(detail);
  }
  const data = await res.json();
  const auth: AuthState = {
    token: data.token,
    userId: data.user_id,
    displayName: data.display_name ?? null,
  };
  setStoredAuth(auth);
  return auth;
}

export async function apiLogin(email: string, password: string): Promise<AuthState> {
  const res = await apiFetch(`${API_BASE}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    let detail = "Sign in failed. Check your email and password and try again.";
    try {
      const data = (await res.json()) as { detail?: string };
      if (data.detail && data.detail.length < 180) detail = data.detail;
    } catch {
      // Keep the safe fallback for non-JSON responses.
    }
    throw new Error(detail);
  }
  const data = await res.json();
  const auth: AuthState = {
    token: data.token,
    userId: data.user_id,
    displayName: data.display_name ?? null,
  };
  setStoredAuth(auth);
  return auth;
}

/** Authenticated fetch helper. Sends bearer token when available and includes cookies. */
export async function authFetch(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<Response> {
  const { token } = getStoredAuth();
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let body = init?.body;
  if (init?.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  return fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: init?.credentials ?? "include",
    headers,
    body,
  });
}
