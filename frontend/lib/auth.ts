"use client";

const TOKEN_KEY = "courtify_badminton_access_token";

function canUseBrowserStorage(): boolean {
  return typeof window !== "undefined";
}

function readStorage(storage: Storage): string | null {
  try {
    return storage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function removeStorageToken(storage: Storage): void {
  try {
    storage.removeItem(TOKEN_KEY);
  } catch {
    // Storage can be unavailable under strict browser privacy settings.
  }
}

export function getAccessToken(): string | null {
  if (!canUseBrowserStorage()) {
    return null;
  }

  const persistentToken = readStorage(window.localStorage);
  if (persistentToken) {
    return persistentToken;
  }

  // Migrate existing sessions created before localStorage persistence.
  const legacySessionToken = readStorage(window.sessionStorage);
  if (!legacySessionToken) {
    return null;
  }

  try {
    window.localStorage.setItem(TOKEN_KEY, legacySessionToken);
    window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    return legacySessionToken;
  }

  return legacySessionToken;
}

export function setAccessToken(token: string): void {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(TOKEN_KEY, token);
  removeStorageToken(window.sessionStorage);
}

export function clearAccessToken(): void {
  if (!canUseBrowserStorage()) {
    return;
  }

  removeStorageToken(window.localStorage);
  removeStorageToken(window.sessionStorage);
}

export function logout(redirectTo = "/login"): void {
  clearAccessToken();
  window.location.assign(redirectTo);
}

export function hasAccessToken(): boolean {
  return getAccessToken() !== null;
}
