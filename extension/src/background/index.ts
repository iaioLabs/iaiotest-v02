/**
 * Background Service Worker — iaio Test v2
 *
 * Auth Flow:
 *  1. 'googleLogin' message → chrome.identity.launchWebAuthFlow (Implicit Flow)
 *     → gets Google id_token + access_token in one shot.
 *  2. supabase.auth.signInWithIdToken({ provider: 'google', token: id_token })
 *     → Supabase issues a REAL user JWT.
 *  3. Session is persisted in chrome.storage.local via the StorageAdapter in supabase.ts.
 *  4. 'createIssue' message → uploads screenshot to Storage, then inserts issue row.
 *
 * Screenshot Flow:
 *  1. Mask sensitive fields in the tab (password, credit card, etc.)
 *  2. Capture the visible tab
 *  3. Unmask fields
 *  4. Return screenshot to content script
 *  5. On report submit: upload screenshot PNG to 'screenshots' bucket → save path in issue row
 */

import { supabase, waitForStorage, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';

// Google OAuth config (must match manifest.json oauth2 client_id)
const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID as string;

if (!GOOGLE_CLIENT_ID) {
  throw new Error('❌ Error crítico: Google Client ID ausente para OAuth. Verifique VITE_GOOGLE_CLIENT_ID en .env');
}
const GOOGLE_REDIRECT_URI = `https://${chrome.runtime.id}.chromiumapp.org/`;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // ── Screenshot ──────────────────────────────────────────────────────────────
  if (request.action === 'captureScreenshot') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ success: false, error: 'No tab ID' });
      return true;
    }
    (async () => {
      try {
        await chrome.tabs.sendMessage(tabId, { action: 'maskSensitiveFields' });
        const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
        await chrome.tabs.sendMessage(tabId, { action: 'unmaskSensitiveFields' });
        sendResponse({ success: true, screenshot: dataUrl });
      } catch (err) {
        chrome.tabs.sendMessage(tabId, { action: 'unmaskSensitiveFields' }).catch(() => { });
        sendResponse({ success: false, error: (err as Error).message });
      }
    })();
    return true;
  }

  // ── Google Login ─────────────────────────────────────────────────────────────
  if (request.action === 'googleLogin') {
    (async () => {
      try {
        // Wait for the chrome.storage.local cache to be ready before any auth ops
        await waitForStorage();

        // Check if we already have a valid session first (avoid unnecessary re-login)
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession && existingSession.expires_at && existingSession.expires_at * 1000 > Date.now()) {

          sendResponse({ success: true });
          return;
        }

        // Build the Google OAuth Implicit Flow URL that returns BOTH access_token AND id_token
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
        authUrl.searchParams.set('response_type', 'token id_token');
        authUrl.searchParams.set('scope', 'openid email profile');
        const nonce = generateNonce();
        const hashedNonce = await hashNonce(nonce);
        authUrl.searchParams.set('nonce', hashedNonce); // Google embeds SHA-256(nonce) in id_token
        authUrl.searchParams.set('prompt', 'select_account');

        const redirectUrl = await new Promise<string>((resolve, reject) => {
          chrome.identity.launchWebAuthFlow(
            { url: authUrl.toString(), interactive: true },
            (redirectUrl) => {
              if (chrome.runtime.lastError || !redirectUrl) {
                reject(new Error(chrome.runtime.lastError?.message || 'Auth flow cancelled'));
              } else {
                resolve(redirectUrl);
              }
            }
          );
        });

        // Parse the fragment (#) from the redirect URL — tokens are in the hash
        const fragment = new URL(redirectUrl).hash.substring(1);
        const params = new URLSearchParams(fragment);
        const idToken = params.get('id_token');
        const accessToken = params.get('access_token');

        if (!idToken) {
          throw new Error('Google id_token not received. Check OAuth config.');
        }



        // Sign into Supabase with the real Google id_token
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
          access_token: accessToken ?? undefined,
          nonce, // raw nonce — Supabase hashes it internally and compares to id_token claim
        });

        if (error) throw error;
        if (!data.session) throw new Error('Supabase session not returned after signInWithIdToken');


        sendResponse({ success: true });
      } catch (err) {
        console.error('[Auth Error]', err);
        sendResponse({ success: false, error: (err as Error).message });
      }
    })();
    return true;
  }

  // ── Get Session (for content scripts that can't use Supabase client directly) ──
  if (request.action === 'getSession') {
    (async () => {
      try {
        await waitForStorage();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          sendResponse({
            success: true,
            session: {
              user: {
                id: session.user.id,
                email: session.user.email ?? '',
                name:
                  (session.user.user_metadata?.full_name as string) ||
                  (session.user.user_metadata?.name as string) ||
                  (session.user.email ?? 'User'),
              },
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            },
          });
        } else {
          sendResponse({ success: true, session: null });
        }
      } catch (err) {
        sendResponse({ success: false, session: null, error: (err as Error).message });
      }
    })();
    return true;
  }

  // ── Google Logout ────────────────────────────────────────────────────────────
  if (request.action === 'googleLogout') {
    (async () => {
      await supabase.auth.signOut();
      sendResponse({ success: true });
    })();
    return true;
  }

  // ── Create Issue ─────────────────────────────────────────────────────────────
  if (request.action === 'createIssue') {
    (async () => {
      try {
        await waitForStorage();

        // Get the current session to extract the real JWT
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          sendResponse({ success: false, error: 'No active session. User must be logged in.' });
          return;
        }

        const jwt = session.access_token;

        // ── Destructure screenshot from payload (keep the rest as issue fields) ──
        const { screenshotBase64, ...issueFields } = request.payload as {
          screenshotBase64?: string;
          [key: string]: any;
        };

        // ── Step 1: Upload screenshot to Supabase Storage ─────────────────────
        // Bucket 'screenshots' is PUBLIC → getPublicUrl() always returns an accessible URL.
        // All uploads are scoped to the user's folder for organisation: {userId}/issue_{ts}.png
        let screenshot_path: string | null = null;
        let screenshot_url: string | null = null;

        if (screenshotBase64) {
          const approxKB = Math.round(screenshotBase64.length * 0.75 / 1024);

          try {
            const blob = dataUrlToBlob(screenshotBase64);
            // User-scoped path prevents collisions and makes per-user RLS policies easy to add later
            const fileName = `${session.user.id}/issue_${Date.now()}.png`;

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('screenshots')
              .upload(fileName, blob, {
                contentType: 'image/png',
                upsert: false, // never silently overwrite — timestamp guarantees uniqueness
              });

            if (uploadError) {
              // Non-fatal: report is still created — only the thumbnail will be missing
              console.error(
                '[createIssue] ❌ Storage upload failed — issue will be saved WITHOUT screenshot.'
                + ` Reason: ${uploadError.message}`
              );
            } else {
              screenshot_path = uploadData.path;


              // Bucket is public → build a permanent, token-free public URL
              const { data: publicData } = supabase.storage
                .from('screenshots')
                .getPublicUrl(screenshot_path);

              screenshot_url = publicData.publicUrl;

            }
          } catch (uploadErr: any) {
            // dataUrlToBlob or network threw — never block the issue insert
            console.error('[createIssue] ❌ Unexpected error during screenshot upload:', uploadErr.message);
          }
        }

        // ── Step 2: Insert the issue row (always runs, even if upload failed) ──
        const insertPayload = {
          ...issueFields,
          ...(screenshot_path !== null && { screenshot_path }),
          ...(screenshot_url !== null && { screenshot_url }),
        };




        const response = await fetch(`${SUPABASE_URL}/rest/v1/issues`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${jwt}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation', // return the created row so we get the ID
          },
          body: JSON.stringify(insertPayload),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error('[createIssue] Supabase REST error:', errText);
          sendResponse({ success: false, error: errText });
        } else {
          const rows = await response.json();
          const createdIssue = Array.isArray(rows) ? rows[0] : rows;

          sendResponse({ success: true, issueId: createdIssue?.id });
        }
      } catch (err) {
        console.error('[createIssue] Unexpected error:', err);
        sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) });
      }
    })();
    return true;
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a cryptographically random nonce. */
function generateNonce(): string {
  const array = new Uint32Array(4);
  crypto.getRandomValues(array);
  return Array.from(array, n => n.toString(36)).join('');
}

/**
 * SHA-256 hash of a nonce string (hex-encoded).
 * Google embeds this hash in the id_token. Supabase re-hashes the raw nonce to compare.
 */
async function hashNonce(nonce: string): Promise<string> {
  const data = new TextEncoder().encode(nonce);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Converts a base64 data URL ("data:image/png;base64,iVBOR...")
 * to a binary Blob suitable for Supabase Storage upload.
 * Runs in Service Worker context: no DOM/canvas APIs needed.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  if (!dataUrl || !dataUrl.includes(',')) {
    throw new Error(`dataUrlToBlob: invalid data URL (no comma separator found). Length: ${dataUrl?.length ?? 0}`);
  }

  // Split on the FIRST comma only — base64 data itself never contains commas
  const commaIdx = dataUrl.indexOf(',');
  const header = dataUrl.substring(0, commaIdx);   // "data:image/png;base64"
  const base64Data = dataUrl.substring(commaIdx + 1); // the raw base64 string

  if (!base64Data) {
    throw new Error('dataUrlToBlob: base64 payload is empty.');
  }

  const mimeType = header.match(/:(.*?);/)?.[1] ?? 'image/png';

  // atob() is available in Service Workers (Chrome 91+)
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}
