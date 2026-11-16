import { fetchJson } from './proxy';
import type { AuthSession } from './types';

export interface MyPost {
  id: string;
  title: string;
  url: string;
  publishedAt?: number;
  body?: string;
}

/**
 * Loads the posts published by the connected account.
 *
 * Supported providers expose a public API for this; providers without a read
 * API (Micropub) simply return an empty list.
 */
export async function loadMyPosts(
  session: AuthSession | undefined,
): Promise<MyPost[]> {
  if (!session) return [];

  try {
    switch (session.method) {
      case 'mastodon': {
        if (!session.endpoint || !session.accessToken) return [];
        const account = await fetchJson<{ id: string }>(
          `${session.endpoint}/api/v1/accounts/verify_credentials`,
          { headers: { Authorization: `Bearer ${session.accessToken}` } },
        );
        const statuses = await fetchJson<any[]>(
          `${session.endpoint}/api/v1/accounts/${account.id}/statuses?limit=20`,
          { headers: { Authorization: `Bearer ${session.accessToken}` } },
        );
        return statuses.map((status: any) => ({
          id: String(status.id),
          title:
            String(status.content ?? '')
              .replace(/<[^>]+>/g, ' ')
              .trim()
              .slice(0, 80) || '(untitled)',
          url: String(status.url ?? ''),
          publishedAt: status.created_at
            ? Date.parse(status.created_at)
            : undefined,
          body: String(status.content ?? ''),
        }));
      }

      case 'lemmy': {
        if (!session.endpoint || !session.accessToken) return [];
        const posts = await fetchJson<any>(
          `${session.endpoint}/api/v3/user/posts?limit=20`,
          { headers: { Authorization: `Bearer ${session.accessToken}` } },
        );
        const views = Array.isArray(posts?.posts) ? posts.posts : [];
        return views.map((post: any) => ({
          id: String(post.post?.id ?? post.id),
          title: String(post.post?.name ?? '(untitled)'),
          url: String(post.post?.ap_id ?? ''),
          publishedAt: post.post?.published
            ? Date.parse(post.post.published)
            : undefined,
          body: String(post.post?.body ?? ''),
        }));
      }

      case 'wordpress': {
        if (!session.endpoint || !session.username || !session.accessToken) {
          return [];
        }
        const authorization = `Basic ${btoa(
          `${session.username}:${session.accessToken}`,
        )}`;
        const posts = await fetchJson<any[]>(
          `${session.endpoint}/wp-json/wp/v2/users/me/posts?per_page=20`,
          { headers: { Authorization: authorization } },
        );
        return posts.map((post: any) => ({
          id: String(post.id),
          title: String(post.title?.rendered ?? '(untitled)'),
          url: String(post.link ?? ''),
          publishedAt: post.date_gmt ? Date.parse(post.date_gmt) : undefined,
          body: String(post.content?.rendered ?? ''),
        }));
      }

      default:
        return [];
    }
  } catch {
    return [];
  }
}
