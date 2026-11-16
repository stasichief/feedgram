import { fetchJson } from '../proxy';
import { BaseProvider, requireHttpsEndpoint } from './base';
import type { AuthSession } from '../types';

interface LemmyLoginResponse {
  jwt: string;
  registration_created?: boolean;
  verify_email_sent?: boolean;
}

interface LemmyUser {
  id: number;
  name: string;
  actor_id: string;
  local_user_view?: { person?: { name?: string } };
}

/**
 * Lemmy authentication.
 *
 * Lemmy uses a simple login endpoint that returns a JWT; there is no OAuth
 * dance, so we connect with username + password (or a TOTP code).
 */
export class LemmyProvider extends BaseProvider {
  readonly method = 'lemmy' as const;
  readonly label = 'Lemmy';
  readonly description =
    'Connect a Lemmy account to publish posts and vote on comments.';

  async connect(
    instance: string,
    username: string,
    password: string,
    totp?: string,
  ): Promise<AuthSession> {
    const base = requireHttpsEndpoint(instance, 'Instance');

    const response = await fetchJson<LemmyLoginResponse>(`${base}/api/v3/user/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username_or_email: username,
        password,
        totp_2fa_token: totp || null,
      }),
    });

    if (!response.jwt) {
      throw new Error('Lemmy did not return a token — check your credentials.');
    }

    const user = await fetchJson<LemmyUser>(`${base}/api/v3/user`, {
      headers: { Authorization: `Bearer ${response.jwt}` },
    });

    return {
      method: 'lemmy',
      account: user.name ?? username,
      endpoint: base,
      accessToken: response.jwt,
      tokenType: 'Bearer',
      username,
      connectedAt: Date.now(),
    };
  }

  async publish(
    session: AuthSession,
    title: string,
    body: string,
    community?: string,
  ): Promise<void> {
    if (!session.accessToken || !session.endpoint) {
      throw new Error('Not connected to Lemmy');
    }

    await fetchJson(`${session.endpoint}/api/v3/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({
        name: title,
        body,
        community_id: community ? Number(community) : undefined,
      }),
    });
  }
}
