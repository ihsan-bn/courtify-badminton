"use client";

const TOKEN_KEY = "courtify_badminton_access_token";

function canUseBrowserStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.sessionStorage);
}

export function getAccessToken(): string | null {
  if (!canUseBrowserStorage()) {
    return null;
  }
  return window.sessionStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  if (!canUseBrowserStorage()) {
    return;
  }
  window.sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  if (!canUseBrowserStorage()) {
    return;
  }
  window.sessionStorage.removeItem(TOKEN_KEY);
}

export function logout(redirectTo = "/login"): void {
  clearAccessToken();
  window.location.assign(redirectTo);
}

export function hasAccessToken(): boolean {
  return getAccessToken() !== null;
}
