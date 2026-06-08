/**
 * authService.ts — iaio Test v2
 *
 * Used in CONTENT SCRIPT context (Panel.tsx) — MUST NOT import the Supabase client.
 * All session operations are delegated to the background service worker via sendMessage.
 *
 * The background is the only context that safely instantiates the Supabase JS client.
 */

/** Typed session shape shared across Panel and Dashboard. */
export interface UserSession {
  user: {
    id: string;
    email: string;
    name: string;
  };
  /** Real Supabase JWT */
  access_token: string;
  /** Supabase refresh token — needed for setSession() in external Dashboard */
  refresh_token?: string;
}

/**
 * Retrieves the current session from the background service worker.
 * The background reads it from supabase.auth.getSession() (persisted in chrome.storage.local).
 */
export async function getSession(): Promise<UserSession | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getSession' }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[authService] getSession error:', chrome.runtime.lastError.message);
        resolve(null);
        return;
      }
      resolve(response?.session ?? null);
    });
  });
}

/**
 * Triggers the Google OAuth login via the background service worker.
 * The background performs the full signInWithIdToken flow and persists the session.
 */
export async function loginWithGoogle(): Promise<UserSession> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'googleLogin' }, async (response) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      if (!response?.success) {
        return reject(new Error(response?.error || 'Login failed'));
      }
      // Session is now stored — fetch it from background
      const session = await getSession();
      if (!session) return reject(new Error('Session not found after login'));
      resolve(session);
    });
  });
}

/**
 * Signs the user out. Background calls supabase.auth.signOut().
 */
export async function logout(): Promise<void> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'googleLogout' }, () => resolve());
  });
}
