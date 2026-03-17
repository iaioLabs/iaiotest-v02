/**
 * authService.ts — iaio Test v2
 * 
 * Simple wrapper for chrome.identity to handle Google Auth.
 */

export interface UserSession {
  email: string;
  name: string;
  token: string;
}

export const AUTH_STORAGE_KEY = 'iaio_auth_session';

export async function loginWithGoogle(): Promise<UserSession> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'googleLogin' }, async (response) => {
      if (response?.success && response.session) {
        // Save session locally
        await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: response.session });
        resolve(response.session);
      } else {
        reject(response?.error || 'Login failed');
      }
    });
  });
}

/**
 * Retrieves the current session from storage if it exists.
 */
export async function getSession(): Promise<UserSession | null> {
  const result = await chrome.storage.local.get(AUTH_STORAGE_KEY);
  return result[AUTH_STORAGE_KEY] || null;
}

/**
 * Clears the session and revokes the token.
 */
export async function logout(): Promise<void> {
  const session = await getSession();
  if (session) {
    chrome.runtime.sendMessage({ action: 'googleLogout', token: session.token });
  }
  await chrome.storage.local.remove(AUTH_STORAGE_KEY);
}
