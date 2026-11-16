import { BlueskyProvider } from './bluesky';
import { LemmyProvider } from './lemmy';
import { MastodonProvider } from './mastodon';
import { MicropubProvider } from './micropub';
import { WordPressProvider } from './wordpress';
import type { AuthProvider } from './base';
import type { AuthMethod, AuthSession } from '../types';
import {
  deleteAuthSession,
  getAuthSessions,
  putAuthSession,
} from '../db';

export const mastodonProvider = new MastodonProvider();
export const lemmyProvider = new LemmyProvider();
export const blueskyProvider = new BlueskyProvider();
export const wordpressProvider = new WordPressProvider();
export const micropubProvider = new MicropubProvider();

export const AUTH_PROVIDERS: AuthProvider[] = [
  micropubProvider,
  mastodonProvider,
  wordpressProvider,
  blueskyProvider,
  lemmyProvider,
];

export function getProvider(method: AuthMethod): AuthProvider {
  const provider = AUTH_PROVIDERS.find((entry) => entry.method === method);
  if (!provider) throw new Error(`Unknown auth method: ${method}`);
  return provider;
}

export async function loadSessions(): Promise<AuthSession[]> {
  return getAuthSessions();
}

export async function saveSession(session: AuthSession): Promise<void> {
  await putAuthSession(session);
}

export async function removeSession(method: AuthMethod): Promise<void> {
  await deleteAuthSession(method);
}

export * from './base';
