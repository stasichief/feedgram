import { fetchJson, proxyFetch } from './proxy';
import { getCommentsForPost, putComments } from './db';
import type { Comment, Feed, FeedKind } from './types';

export type CommentSource = 'none' | 'mastodon' | 'lemmy' | 'bluesky' | 'custom';

export interface CommentAvailability {
  source: CommentSource;
  /** Human readable description shown in the UI. */
  label: string;
  /** Endpoint template; `{id}` is replaced with the remote id. */
  endpoint?: string;
}

/** Extracts the numeric status/post id from a social URL. */
export function extractRemoteId(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);

    // Mastodon: /@user/123456789  or  /users/user/123456789
    // Lemmy:   /post/12345  or  /comment/12345
    for (let i = segments.length - 1; i >= 0; i -= 1) {
      const segment = segments[i];
      if (/^\d+$/.test(segment)) return segment;
    }
  } catch {
    /* not a URL */
  }
  return undefined;
}

/**
 * Works out where the comments for a post can be fetched from.
 *
 * - Mastodon feeds expose `https://<instance>/api/v1/statuses/<id>/context`.
 * - Lemmy feeds expose `https://<instance>/api/v3/comment/list?post_id=<id>`.
 * - Bluesky posts expose `app.bsky.feed.getPostThread?uri=<at-uri>`.
 * - Otherwise the user can configure a custom endpoint per feed.
 */
export function resolveCommentSource(
  feed: Pick<Feed, 'kind' | 'commentEndpoint' | 'id'>,
  post?: { url: string; remoteId?: string },
): CommentAvailability {
  const remoteId = post?.remoteId ?? extractRemoteId(post?.url ?? '');

  if (feed.commentEndpoint) {
    return {
      source: 'custom',
      label: 'Custom endpoint',
      endpoint: feed.commentEndpoint.replace('{id}', remoteId ?? ''),
    };
  }

  const kind: FeedKind | undefined = feed.kind;

  if (kind === 'lemmy' && remoteId) {
    const origin = originOf(feed.id) ?? originOf(post?.url ?? '');
    if (origin) {
      return {
        source: 'lemmy',
        label: 'Lemmy',
        endpoint: `${origin}/api/v3/comment/list?post_id=${remoteId}&sort=Top&limit=100&max_depth=8`,
      };
    }
  }

  if (kind === 'bluesky' && remoteId?.startsWith('at://')) {
    return {
      source: 'bluesky',
      label: 'Bluesky',
      endpoint: `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(
        remoteId,
      )}&depth=6`,
    };
  }

  if (kind === 'mastodon' && remoteId) {
    const origin = originOf(post?.url ?? '') ?? originOf(feed.id);
    if (origin) {
      return {
        source: 'mastodon',
        label: 'Mastodon',
        endpoint: `${origin}/api/v1/statuses/${remoteId}/context`,
      };
    }
  }

  return { source: 'none', label: 'Not available' };
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Hostname of a URL, or an empty string when it is not a URL. */
function hostOf(url: unknown): string {
  try {
    return new URL(String(url)).hostname;
  } catch {
    return '';
  }
}

/* ------------------------------------------------------------ normalizers */

/** A comment before it is flattened into the stored shape. */
interface TreeNode {
  id: string;
  author: string;
  body: string;
  createdAt?: number;
  score?: number;
  authorUrl?: string;
  authorHandle?: string;
  replies: TreeNode[];
}

function normalizeBody(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function normalizeTimestamp(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** Flattens a nested comment tree into a list with depth information. */
function flatten(
  nodes: TreeNode[],
  postId: string,
  depth = 0,
  output: Comment[] = [],
): Comment[] {
  for (const node of nodes) {
    output.push({
      id: node.id,
      postId,
      author: node.author,
      body: node.body,
      createdAt: node.createdAt,
      score: node.score,
      authorUrl: node.authorUrl,
      authorHandle: node.authorHandle,
      depth,
    });

    if (node.replies.length > 0) {
      flatten(node.replies, postId, depth + 1, output);
    }
  }
  return output;
}

function parseMastodonContext(data: any): TreeNode[] {
  const entries: any[] = [
    ...(Array.isArray(data?.ancestors) ? data.ancestors : []),
    ...(Array.isArray(data?.descendants) ? data.descendants : []),
  ];

  return entries.map((entry) => ({
    id: String(entry.id),
    author: entry.account?.acct ?? entry.account?.username ?? 'unknown',
    body: normalizeBody(entry.content ?? ''),
    createdAt: normalizeTimestamp(entry.created_at),
    score: entry.favourites_count ?? undefined,
    authorUrl:
      typeof entry.account?.url === 'string' ? entry.account.url : undefined,
    authorHandle:
      typeof entry.account?.acct === 'string' ? entry.account.acct : undefined,
    replies: Array.isArray(entry.replies)
      ? entry.replies.map((reply: any) => ({
          id: String(reply.id),
          author: reply.account?.acct ?? reply.account?.username ?? 'unknown',
          body: normalizeBody(reply.content ?? ''),
          createdAt: normalizeTimestamp(reply.created_at),
          score: reply.favourites_count ?? undefined,
          authorUrl:
            typeof reply.account?.url === 'string' ? reply.account.url : undefined,
          authorHandle:
            typeof reply.account?.acct === 'string' ? reply.account.acct : undefined,
          replies: [],
        }))
      : [],
  }));
}

/**
 * Lemmy's `comment/list` returns a flat list. Nesting is encoded in
 * `comment.path` (e.g. `0.25741740.25742020`), so depth = segments - 2.
 * Sorting by path restores a stable parent-before-child order.
 */
function parseLemmyPost(data: any): TreeNode[] {
  const views: any[] = Array.isArray(data?.comments)
    ? data.comments
    : Array.isArray(data?.comment_view)
      ? data.comment_view
      : Array.isArray(data)
        ? data
        : [];

  const nodes = views
    .map((view) => {
      const path = String(view?.comment?.path ?? '');
      const depth = Math.max(0, path.split('.').filter(Boolean).length - 2);
      const node: TreeNode & { depth: number; path: string } = {
        id: String(view.comment?.id ?? view.id),
        author:
          view.creator?.display_name || view.creator?.name
            ? String(view.creator.display_name || view.creator.name)
            : 'unknown',
        body: normalizeBody(view.comment?.content ?? ''),
        createdAt: normalizeTimestamp(
          view.comment?.published ?? view.published,
        ),
        score: view.counts?.score ?? view.score ?? undefined,
        authorUrl:
          typeof view.creator?.actor_id === 'string'
            ? view.creator.actor_id
            : undefined,
        authorHandle:
          typeof view.creator?.name === 'string'
            ? `${view.creator.name}@${hostOf(view.creator.actor_id)}`
            : undefined,
        replies: [],
        depth,
        path,
      };
      return node;
    })
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));

  // Attach children to the nearest ancestor that is one level shallower.
  const byDepth: Array<typeof nodes[number] | undefined> = [];
  const roots: TreeNode[] = [];
  for (const node of nodes) {
    if (node.depth === 0 || !byDepth[node.depth - 1]) {
      roots.push(node);
    } else {
      byDepth[node.depth - 1]!.replies.push(node);
    }
    byDepth[node.depth] = node;
    byDepth.length = node.depth + 1;
  }

  return roots;
}

/** Bluesky thread replies, recursively. */
function parseBlueskyThread(data: any): TreeNode[] {
  const toNodes = (replies: any[]): TreeNode[] =>
    replies
      .filter((reply) => reply?.post)
      .map((reply) => {
        const post = reply.post;
        const record = post.record ?? {};
        const handle = String(post.author?.handle ?? '');
        return {
          id: String(post.uri ?? ''),
          author: String(
            post.author?.displayName || `@${post.author?.handle ?? 'unknown'}`,
          ),
          body: String(record.text ?? ''),
          createdAt: normalizeTimestamp(record.createdAt),
          score:
            typeof post.likeCount === 'number' ? post.likeCount : undefined,
          authorUrl: handle ? `https://bsky.app/profile/${handle}` : undefined,
          authorHandle: handle || undefined,
          replies: Array.isArray(reply.replies) ? toNodes(reply.replies) : [],
        };
      });

  const thread = data?.thread;
  if (!thread) return [];
  // A blocked/not-found thread has no replies array.
  return Array.isArray(thread.replies) ? toNodes(thread.replies) : [];
}

function parseGenericComments(data: any): TreeNode[] {
  const list: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.comments)
      ? data.comments
      : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
          ? data.data
          : [];

  const toNode = (entry: any): TreeNode => ({
    id: String(entry.id ?? entry.comment_id ?? Math.random().toString(36)),
    author:
      entry.author?.name ??
      entry.author?.acct ??
      entry.author ??
      entry.creator?.name ??
      entry.username ??
      'unknown',
    body: normalizeBody(
      String(entry.body ?? entry.content ?? entry.text ?? entry.message ?? ''),
    ),
    createdAt: normalizeTimestamp(
      entry.created_at ?? entry.created ?? entry.published,
    ),
    score: entry.score ?? entry.likes ?? entry.upvotes ?? undefined,
    authorUrl:
      typeof entry.author?.url === 'string'
        ? entry.author.url
        : typeof entry.author_url === 'string'
          ? entry.author_url
          : undefined,
    authorHandle:
      typeof entry.author?.acct === 'string'
        ? entry.author.acct
        : typeof entry.author?.handle === 'string'
          ? entry.author.handle
          : undefined,
    replies: Array.isArray(entry.replies)
      ? entry.replies.map(toNode)
      : Array.isArray(entry.children)
        ? entry.children.map(toNode)
        : [],
  });

  return list.map(toNode);
}

/**
 * Loads comments for a post.
 * Returns an empty array when the feed has no comment endpoint.
 */
export async function loadComments(
  postId: string,
  feed: Pick<Feed, 'kind' | 'commentEndpoint' | 'id'>,
  post?: { url: string; remoteId?: string },
): Promise<Comment[]> {
  const cached = await getCommentsForPost(postId);
  if (cached.length > 0) return cached;

  const availability = resolveCommentSource(feed, post);
  if (availability.source === 'none' || !availability.endpoint) return [];

  try {
    let nodes: TreeNode[] = [];

    if (availability.source === 'mastodon') {
      const data = await fetchJson<any>(availability.endpoint);
      nodes = parseMastodonContext(data);
    } else if (availability.source === 'lemmy') {
      const data = await fetchJson<any>(availability.endpoint);
      nodes = parseLemmyPost(data);
    } else if (availability.source === 'bluesky') {
      const data = await fetchJson<any>(availability.endpoint);
      nodes = parseBlueskyThread(data);
    } else {
      const result = await proxyFetch(availability.endpoint);
      if (!result.ok) return [];
      nodes = parseGenericComments(JSON.parse(result.text));
    }

    const comments = flatten(nodes, postId);
    await putComments(comments);
    return comments;
  } catch {
    return [];
  }
}
