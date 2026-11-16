import type { AuthMethod, AuthSession } from '../types';
import { isNativeApp, NATIVE_OAUTH_REDIRECT_URI } from '../platform';

export interface AuthResult { session: AuthSession }

function getStorage(): Storage {
  return isNativeApp() ? localStorage : sessionStorage;
}

/** Web redirects to the configured static site; Tauri returns through its registered scheme. */
export function getRedirectUri(_method: AuthMethod): string {
  if (isNativeApp()) return NATIVE_OAUTH_REDIRECT_URI;
  const settings = JSON.parse(localStorage.getItem('feedgram.settings.v1') ?? '{}') as { siteUrl?: string };
  const base = (settings.siteUrl ?? '').replace(/\/+$/, '');
  return base ? `${base}/` : `${window.location.origin}${window.location.pathname}`;
}

export function saveOAuthValue(key: string, value: string): void {
  getStorage().setItem(key, value);
}
export function readOAuthValue(key: string): string | null {
  return getStorage().getItem(key);
}
export function removeOAuthValue(key: string): void {
  getStorage().removeItem(key);
  if (isNativeApp()) sessionStorage.removeItem(key);
}

/** Create unpredictable CSRF state that survives the external-browser return. */
export function createOAuthState(method: AuthMethod): string {
  const random = crypto.getRandomValues(new Uint8Array(32));
  const value = Array.from(random, (n) => n.toString(16).padStart(2, '0')).join('');
  const state = `${method}.${value}`;
  saveOAuthValue(`feedgram.oauth.${method}`, state);
  return state;
}

export function verifyOAuthState(method: AuthMethod, received: string | null): boolean {
  if (!received) return false;
  const key = `feedgram.oauth.${method}`;
  const stored = readOAuthValue(key);
  removeOAuthValue(key);
  return Boolean(stored) && stored === received;
}

/** PKCE S256 pair for authorization-code flows. */
export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const random = crypto.getRandomValues(new Uint8Array(32));
  const verifier = toBase64Url(random);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: toBase64Url(new Uint8Array(digest)) };
}
function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}
export function requireEndpoint(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  const parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`${label} must use HTTP or HTTPS`);
  return stripTrailingSlash(parsed.toString());
}
export function requireHttpsEndpoint(value: string, label: string): string {
  const endpoint = requireEndpoint(value, label);
  if (new URL(endpoint).protocol !== 'https:') throw new Error(`${label} must use HTTPS to protect credentials and tokens.`);
  return endpoint;
}

export interface AuthProvider {
  method: AuthMethod;
  label: string;
  description: string;
  requiresSiteUrl: boolean;
  isConnected(session?: AuthSession): boolean;
}
export abstract class BaseProvider implements AuthProvider {
  abstract readonly method: AuthMethod;
  abstract readonly label: string;
  abstract readonly description: string;
  requiresSiteUrl = false;
  isConnected(session?: AuthSession): boolean { return Boolean(session?.accessToken); }
}
