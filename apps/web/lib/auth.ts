/**
 * Glow auth store — client side of the credential flow.
 *
 * Token is kept in memory + sessionStorage (cleared when the browser tab
 * closes) rather than localStorage, to shorten the window an XSS could
 * exploit. The backend remains the sole authority for all decisions.
 */

import { apiFetch, API_BASE, getApiErrorMessage } from "./glow-api";

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
  return {
    token: sessionStorage.getItem(TOKEN_KEY),
    userId: sessionStorage.getItem(USER_KEY),
    displayName: sessionStorage.getItem(NAME_KEY),
  };
}

export function setStoredAuth(auth: AuthState): void {
  if (!auth.token || !auth.userId) {
    clearStoredAuth();
    return;
  }
  sessionStorage.setItem(TOKEN_KEY, auth.token);
  sessionStorage.setItem(USER_KEY, auth.userId);
  if (auth.displayName) sessionStorage.setItem(NAME_KEY, auth.displayName);
}

export function clearStoredAuth(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(NAME_KEY);
}

export type RegisterInput = {
  email: string;
  password: string;
  display_name?: string;
  is_adult_confirmed: boolean;
  diagnosis_disclosed: boolean;
  diagnosis_note?: string;
  locale?: string;
};

export async function apiRegister(input: RegisterInput): Promise<AuthState> {
  const res = await apiFetch(`${API_BASE}/auth/register`, {
    method: "POST",
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

/** Authenticated fetch helper. Throws on 401 so pages can redirect to /login. */
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
  return fetch(`${API_BASE}${path}`, { ...init, headers, body });
}
