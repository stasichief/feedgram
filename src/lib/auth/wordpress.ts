import { proxyFetch } from '../proxy';
import { BaseProvider, requireHttpsEndpoint } from './base';
import type { AuthSession } from '../types';

interface WordPressUser {
  id: number;
  name: string;
  username: string;
  slug?: string;
}

/**
 * WordPress authentication.
 *
 * Uses an Application Password with HTTP Basic authentication against the
 * WordPress REST API.
 */
export class WordPressProvider extends BaseProvider {
  readonly method = 'wordpress' as const;
  readonly label = 'WordPress';
  readonly description =
    'Connect a WordPress site with an application password to publish posts.';

  async connect(
    siteUrl: string,
    username: string,
    applicationPassword: string,
  ): Promise<AuthSession> {
    const base = requireHttpsEndpoint(siteUrl, 'Site URL');
    const authorization = `Basic ${btoa(`${username}:${applicationPassword}`)}`;

    const result = await proxyFetch(`${base}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: authorization },
      retries: 0,
    });

    if (!result.ok) {
      throw new Error(
        `WordPress rejected the credentials (status ${result.status}).`,
      );
    }

    let user: WordPressUser;
    try {
      user = JSON.parse(result.text) as WordPressUser;
    } catch {
      throw new Error('Unexpected response from the WordPress REST API.');
    }

    return {
      method: 'wordpress',
      account: user.name ?? username,
      endpoint: base,
      accessToken: applicationPassword,
      tokenType: 'Basic',
      username,
      connectedAt: Date.now(),
    };
  }

  async publish(
    session: AuthSession,
    title: string,
    body: string,
    status: 'draft' | 'publish' = 'publish',
  ): Promise<void> {
    if (!session.endpoint || !session.username || !session.accessToken) {
      throw new Error('Not connected to WordPress');
    }

    const authorization = `Basic ${btoa(
      `${session.username}:${session.accessToken}`,
    )}`;

    await proxyFetch(`${session.endpoint}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      body: JSON.stringify({
        title,
        content: body,
        status,
      }),
    });
  }
}
