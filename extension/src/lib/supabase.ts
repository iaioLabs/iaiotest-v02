/**
 * supabase.ts — iaio Test v2
 *
 * Creates a SINGLE Supabase client with a custom StorageAdapter backed by
 * chrome.storage.local. This makes the session (JWT) available and shared
 * across ALL extension contexts: background service worker, content scripts,
 * and the standalone viewer/dashboard page.
 *
 * The key insight: Supabase's JS client accepts any object that implements
 * the SupportedStorage interface. We bridge it to chrome.storage.local.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.VITE_SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('❌ Error crítico: Configuración de Supabase no detectada. Verifique VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env');
}

/**
 * A synchronous-looking storage adapter that bridges Supabase Auth internals
 * with the async chrome.storage.local API.
 *
 * Supabase calls getItem/setItem/removeItem. We use an in-memory cache so
 * reads are synchronous (required by the interface), and writes flush to
 * chrome.storage.local asynchronously.
 */
class ChromeStorageAdapter {
  private cache: Record<string, string> = {};
  private ready = false;
  private readyCallbacks: Array<() => void> = [];

  constructor() {
    // Eagerly populate the in-memory cache from chrome.storage.local
    chrome.storage.local.get(null, (items) => {
      this.cache = items as Record<string, string>;
      this.ready = true;
      this.readyCallbacks.forEach(cb => cb());
    });
  }

  /** Wait for the initial cache population to complete. */
  waitUntilReady(): Promise<void> {
    if (this.ready) return Promise.resolve();
    return new Promise(resolve => this.readyCallbacks.push(resolve));
  }

  getItem(key: string): string | null {
    return this.cache[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.cache[key] = value;
    chrome.storage.local.set({ [key]: value });
  }

  removeItem(key: string): void {
    delete this.cache[key];
    chrome.storage.local.remove(key);
  }
}

const storage = new ChromeStorageAdapter();

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** Utility: wait for the storage adapter cache to be loaded before any auth read. */
export const waitForStorage = () => storage.waitUntilReady();
