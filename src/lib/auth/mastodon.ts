import { fetchJson, proxyFetch } from '../proxy';
import { openAuthorizationUrl } from '../platform';
import {
  BaseProvider,
  createOAuthState,
  createPkcePair,
  getRedirectUri,
  readOAuthValue,
  removeOAuthValue,
  requireHttpsEndpoint,
  saveOAuthValue,
  verifyOAuthState,
} from './base';
import type { AuthSession } from '../types';
interface MastodonApp { client_id: string; client_secret: string }
interface MastodonToken { access_token: string; token_type: string; scope: string; created_at: number }
interface PendingMastodon {
  instance: string;
  clientId: string;
  clientSecret: string;
  codeVerifier: string;
  redirectUri: string;
}
const PENDING_KEY = 'feedgram.oauth.mastodon.pending';

/** Mastodon OAuth 2 authorization-code flow, launched in the system browser. */
export class MastodonProvider extends BaseProvider {
  readonly method = 'mastodon' as const;
  readonly label = 'Mastodon';
  readonly description = 'Connect a Mastodon account to publish posts and read replies.';

  async registerApp(instance: string, redirectUri = getRedirectUri('mastodon')): Promise<MastodonApp> {
    const base = requireHttpsEndpoint(instance, 'Instance');
    return fetchJson<MastodonApp>(`${base}/api/v1/apps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'feedgram',
        redirect_uris: redirectUri,
        scopes: 'read write',
        website: 'https://github.com/feedgram',
      }),
    });
  }

  async connect(instance: string): Promise<void> {
    const base = requireHttpsEndpoint(instance, 'Instance');
    const redirectUri = getRedirectUri('mastodon');
    const [app, pkce] = await Promise.all([
      this.registerApp(base, redirectUri),
      createPkcePair(),
    ]);
    const state = createOAuthState('mastodon');
    const pending: PendingMastodon = {
      instance: base,
      clientId: app.client_id,
      clientSecret: app.client_secret,
      codeVerifier: pkce.verifier,
      redirectUri,
    };
    saveOAuthValue(PENDING_KEY, JSON.stringify(pending));
    saveOAuthValue('feedgram.oauth.pending', 'mastodon');
    const params = new URLSearchParams({
      client_id: app.client_id,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'read write',
      state,
      code_challenge: pkce.challenge,
      code_challenge_method: 'S256',
    });
    try {
      await openAuthorizationUrl(`${base}/oauth/authorize?${params.toString()}`);
    } catch (error) {
      removeOAuthValue(PENDING_KEY);
      throw error;
    }
  }

  /** Complete from the web callback URL or the Tauri custom-URI callback. */
  async complete(code: string, state: string | null): Promise<AuthSession> {
    if (!verifyOAuthState('mastodon', state)) {
      throw new Error('OAuth state mismatch — please try connecting again.');
    }
    const raw = readOAuthValue(PENDING_KEY);
    if (!raw) throw new Error('The pending Mastodon login has expired. Please connect again.');
    const pending = JSON.parse(raw) as PendingMastodon;
    const base = requireHttpsEndpoint(pending.instance, 'Instance');
    const response = await proxyFetch(`${base}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: pending.clientId,
        client_secret: pending.clientSecret,
        redirect_uri: pending.redirectUri,
        code_verifier: pending.codeVerifier,
        scope: 'read write',
      }).toString(),
      retries: 0,
    });
    if (!response.ok) throw new Error(`Mastodon token exchange failed (status ${response.status}).`);
    let token: MastodonToken;
    try { token = JSON.parse(response.text) as MastodonToken; }
    catch { throw new Error('Mastodon returned an unexpected token response.'); }
    if (!token.access_token) throw new Error('Mastodon did not return an access token.');
    const account = await fetchJson<{ acct: string; url: string }>(
      `${base}/api/v1/accounts/verify_credentials`,
      { headers: { Authorization: `Bearer ${token.access_token}` } },
    );
    removeOAuthValue(PENDING_KEY);
    removeOAuthValue('feedgram.oauth.pending');
    return {
      method: 'mastodon',
      account: account.acct ?? account.url ?? 'mastodon',
      endpoint: base,
      accessToken: token.access_token,
      tokenType: token.token_type,
      scope: token.scope,
      connectedAt: Date.now(),
    };
  }

  async publish(session: AuthSession, status: string, inReplyToId?: string): Promise<void> {
    if (!session.accessToken || !session.endpoint) throw new Error('Not connected to Mastodon');
    await fetchJson(`${session.endpoint}/api/v1/statuses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
      body: JSON.stringify({ status, in_reply_to_id: inReplyToId, visibility: 'public' }),
    });
  }
}
