import { proxyFetch } from '../proxy';
import {
  BaseProvider,
  createOAuthState,
  createPkcePair,
  readOAuthValue,
  removeOAuthValue,
  saveOAuthValue,
  getRedirectUri,
  requireHttpsEndpoint,
  verifyOAuthState,
} from './base';
import { openAuthorizationUrl } from '../platform';
import type { AuthSession } from '../types';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
}

/**
 * Micropub OAuth 2.0.
 *
 * The user supplies the Micropub endpoint; the token endpoint is derived from
 * it (`{endpoint}/token`) unless it is given explicitly.
 */
export class MicropubProvider extends BaseProvider {
  readonly method = 'micropub' as const;
  readonly label = 'Micropub';
  readonly description =
    'Connect any Micropub-enabled site to publish posts through the standard.';

  async connect(
    endpoint: string,
    clientId: string,
    _clientSecret: string,
    _tokenEndpoint?: string,
    authorizationEndpoint?: string,
  ): Promise<void> {
    const micropub = requireHttpsEndpoint(endpoint, 'Micropub endpoint');
    const authorization = requireHttpsEndpoint(authorizationEndpoint ?? '', 'Authorization endpoint');
    const state = createOAuthState('micropub');
    const redirectUri = getRedirectUri('micropub');
    const pkce = await createPkcePair();
    saveOAuthValue('feedgram.oauth.micropub.verifier', pkce.verifier);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: 'create update',
      me: micropub,
      code_challenge: pkce.challenge,
      code_challenge_method: 'S256',
    });

    const url = new URL(authorization);
    url.search = params.toString();
    saveOAuthValue('feedgram.oauth.pending', 'micropub');
    await openAuthorizationUrl(url.toString());
  }

  async complete(
    code: string,
    state: string | null,
    endpoint: string,
    clientId: string,
    clientSecret: string,
    tokenEndpoint?: string,
  ): Promise<AuthSession> {
    if (!verifyOAuthState('micropub', state)) {
      throw new Error('OAuth state mismatch — please try connecting again.');
    }

    const micropub = requireHttpsEndpoint(endpoint, 'Micropub endpoint');
    const token = requireHttpsEndpoint(
      tokenEndpoint || `${micropub}/token`,
      'Token endpoint',
    );
    const redirectUri = getRedirectUri('micropub');

    const codeVerifier = readOAuthValue('feedgram.oauth.micropub.verifier');
    const response = await proxyFetch(token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
        ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed (status ${response.status}).`);
    }

    let parsed: TokenResponse;
    try {
      parsed = JSON.parse(response.text) as TokenResponse;
    } catch {
      throw new Error('The token endpoint returned an unexpected response.');
    }

    removeOAuthValue('feedgram.oauth.micropub.verifier');
    removeOAuthValue('feedgram.oauth.pending');
    return {
      method: 'micropub',
      account: micropub,
      endpoint: micropub,
      accessToken: parsed.access_token,
      refreshToken: parsed.refresh_token,
      tokenType: parsed.token_type ?? 'Bearer',
      scope: parsed.scope,
      expiresAt: parsed.expires_in
        ? Date.now() + parsed.expires_in * 1000
        : undefined,
      extra: { clientId, clientSecret, tokenEndpoint: token },
      connectedAt: Date.now(),
    };
  }

  async publish(
    session: AuthSession,
    title: string,
    body: string,
    tags?: string[],
  ): Promise<void> {
    if (!session.endpoint || !session.accessToken) {
      throw new Error('Not connected to a Micropub endpoint');
    }

    await proxyFetch(session.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({
        type: ['h-entry'],
        properties: {
          title,
          content: [`<p>${body}</p>`],
          ...(tags?.length ? { category: tags } : {}),
        },
      }),
    });
  }
}
