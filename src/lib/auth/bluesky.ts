import { fetchJson } from '../proxy';
import { BaseProvider, requireHttpsEndpoint } from './base';
import type { AuthSession } from '../types';

interface BlueskySession {
  accessJwt: string;
  refreshJwt: string;
  handle: string;
  did?: string;
}

interface BlueskyProfile {
  handle: string;
  displayName?: string;
}

/**
 * Bluesky (AT Protocol) authentication.
 *
 * Uses `com.atproto.server.createSession` with an app password.
 */
export class BlueskyProvider extends BaseProvider {
  readonly method = 'bluesky' as const;
  readonly label = 'Bluesky';
  readonly description =
    'Connect a Bluesky account with an app password to publish posts.';

  async connect(
    handle: string,
    appPassword: string,
    pdsUrl = 'https://bsky.social',
  ): Promise<AuthSession> {
    const base = requireHttpsEndpoint(pdsUrl, 'PDS URL');

    const session = await fetchJson<BlueskySession>(
      `${base}/xrpc/com.atproto.server.createSession`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: handle,
          password: appPassword,
        }),
      },
    );

    return {
      method: 'bluesky',
      account: session.handle ?? handle,
      endpoint: base,
      accessToken: session.accessJwt,
      refreshToken: session.refreshJwt,
      tokenType: 'Bearer',
      username: handle,
      connectedAt: Date.now(),
    };
  }

  async publish(session: AuthSession, text: string): Promise<void> {
    if (!session.accessToken || !session.endpoint) {
      throw new Error('Not connected to Bluesky');
    }

    const profile = await fetchJson<BlueskyProfile>(
      `${session.endpoint}/xrpc/com.atproto.identity.resolveHandle`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.accessToken}` },
      },
    ).catch(() => ({ handle: session.account }) as BlueskyProfile);

    const did = await fetchJson<{ did: string }>(
      `${session.endpoint}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(
        profile.handle,
      )}&collection=com.atproto.actor.profile&rkey=`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } },
    ).catch(() => undefined);

    if (!did?.did) {
      throw new Error('Could not resolve the Bluesky DID for this account.');
    }

    await fetchJson(`${session.endpoint}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({
        repo: did.did,
        collection: 'app.bsky.feed.post',
        record: {
          $type: 'app.bsky.feed.post',
          text,
          createdAt: new Date().toISOString(),
        },
      }),
    });
  }
}
