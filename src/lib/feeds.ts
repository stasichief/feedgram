import { proxyFetch } from './proxy';
import { parseFeed, toFeed } from './feed-parser';
import { discoverFeed, normaliseUrl } from './feed-discovery';
import { fetchSourceFeed, resolveSource } from './sources';
import {
  getAllFeeds,
  getFeed,
  getPostsForFeeds,
  putFeed,
  putPosts,
  updatePost,
} from './db';
import type { Feed, FeedSource, Post, SortMode } from './types';

export interface FetchFeedResult {
  feed: Feed;
  posts: Post[];
  notModified: boolean;
}

/**
 * Fetches a feed and stores its posts.
 * Uses conditional requests (ETag / Last-Modified) so unchanged feeds are cheap.
 * Non-default sources are re-read through their platform API instead.
 */
export async function fetchFeed(
  feedId: string,
  options: { force?: boolean } = {},
): Promise<FetchFeedResult | null> {
  const existing = await getFeed(feedId);

  if (existing?.source && existing.source !== 'default') {
    const parsed = await fetchSourceFeed(existing);
    const feed = toFeed(parsed, feedId, existing);
    feed.source = existing.source;
    feed.explore = existing.explore;

    const known = await getPostsForFeeds([feedId]);
    const knownById = new Map(known.map((post) => [post.id, post]));
    const posts = parsed.posts.map((post) => {
      const previous = knownById.get(post.id);
      if (!previous) return post;
      return {
        ...post,
        read: previous.read,
        saved: previous.saved,
        vote: previous.vote,
      };
    });

    await putFeed(feed);
    await putPosts(posts);
    return { feed, posts, notModified: false };
  }

  const headers: Record<string, string> = {};
  if (!options.force && existing) {
    if (existing.etag) headers['If-None-Match'] = existing.etag;
    if (existing.lastModified) headers['If-Modified-Since'] = existing.lastModified;
  }

  const result = await proxyFetch(feedId, { headers });

  if (result.status === 304 && existing) {
    const updated = { ...existing, lastFetchedAt: Date.now(), lastError: undefined };
    await putFeed(updated);
    return { feed: updated, posts: [], notModified: true };
  }

  if (!result.ok) {
    const message = `HTTP ${result.status}`;
    if (existing) {
      await putFeed({ ...existing, lastError: message, lastFetchedAt: Date.now() });
    }
    throw new Error(`Feed request failed: ${message}`);
  }

  const parsed = parseFeed(result.text, feedId);
  const feed = toFeed(parsed, feedId, existing);

  const etag = result.headers.get('etag') ?? undefined;
  const lastModified = result.headers.get('last-modified') ?? undefined;
  if (etag) feed.etag = etag;
  if (lastModified) feed.lastModified = lastModified;

  // Preserve local flags (read / saved / vote) for posts we already know.
  const known = await getPostsForFeeds([feedId]);
  const knownById = new Map(known.map((post) => [post.id, post]));

  const posts = parsed.posts.map((post) => {
    const previous = knownById.get(post.id);
    if (!previous) return post;
    return {
      ...post,
      read: previous.read,
      saved: previous.saved,
      vote: previous.vote,
    };
  });

  await putFeed(feed);
  await putPosts(posts);

  return { feed, posts, notModified: false };
}

/** Creates (or returns) a feed record without fetching it. */
export async function subscribeToFeed(
  feedUrl: string,
  title?: string,
  options: { explore?: boolean; source?: FeedSource; kind?: Feed['kind'] } = {},
): Promise<Feed> {
  const existing = await getFeed(feedUrl);
  if (existing) {
    if (options.explore && !existing.explore) {
      const updated = { ...existing, explore: true };
      await putFeed(updated);
      return updated;
    }
    return existing;
  }

  const feed: Feed = {
    id: feedUrl,
    title: title ?? feedUrl,
    addedAt: Date.now(),
    kind: options.kind ?? 'generic',
    source: options.source ?? 'default',
    explore: options.explore,
  };
  await putFeed(feed);
  return feed;
}

export interface AddFeedResult {
  feed: Feed;
  /** False when the feed was already known. */
  added: boolean;
}

/**
 * Adds a feed through the requested source.
 *
 * `default` runs feed discovery (RSS/Atom/JSON Feed); the other sources go
 * straight to the platform API and store the first page of posts immediately.
 */
export async function addFeed(
  input: string,
  source: FeedSource = 'default',
  options: { explore?: boolean } = {},
): Promise<AddFeedResult> {
  if (source === 'default') {
    const discovered = await discoverFeed(input);
    const feedUrl = discovered?.feedUrl ?? normaliseUrl(input);
    if (!feedUrl) throw new Error('Enter a feed or site URL.');

    const existing = await getFeed(feedUrl);
    if (existing) {
      const feed = options.explore
        ? await subscribeToFeed(feedUrl, existing.title, { explore: true })
        : existing;
      return { feed, added: false };
    }

    const response = await fetchFeed(feedUrl, { force: true });
    if (!response) throw new Error('Could not read that feed.');

    const feed: Feed = {
      ...response.feed,
      source: 'default',
      explore: options.explore || undefined,
    };
    await putFeed(feed);
    return { feed, added: true };
  }

  const resolved = await resolveSource(input, source);
  const existing = await getFeed(resolved.feedUrl);

  if (existing) {
    const feed = options.explore
      ? await subscribeToFeed(resolved.feedUrl, existing.title, {
          explore: true,
          source,
        })
      : existing;
    return { feed, added: false };
  }

  const feed: Feed = {
    id: resolved.feedUrl,
    title: resolved.result.title || resolved.feedUrl,
    siteUrl: resolved.result.siteUrl,
    icon: resolved.result.icon,
    addedAt: Date.now(),
    lastFetchedAt: Date.now(),
    kind: resolved.result.kind ?? 'generic',
    source,
    explore: options.explore || undefined,
  };

  await putFeed(feed);
  await putPosts(resolved.result.posts);
  return { feed, added: true };
}

/**
 * Makes sure the explore feeds are present and up to date.
 * Explore feeds are stored like subscriptions but flagged, so they never show
 * up in the subscribed list.
 */
export async function ensureExploreFeeds(urls: string[]): Promise<Feed[]> {
  const feeds: Feed[] = [];

  for (const url of urls) {
    try {
      const feed = await subscribeToFeed(url, undefined, { explore: true });
      await fetchFeed(feed.id);
      const refreshed = (await getFeed(feed.id)) ?? feed;
      feeds.push(refreshed);
    } catch {
      /* a broken explore feed must not break the page */
    }
  }

  return feeds;
}

/* ---------------------------------------------------------------- sorting */

export function sortPosts(posts: Post[], mode: SortMode): Post[] {
  const copy = [...posts];

  switch (mode) {
    case 'new':
      copy.sort((a, b) => b.publishedAt - a.publishedAt);
      break;
    case 'hot':
      copy.sort((a, b) => hotScore(b) - hotScore(a));
      break;
    case 'top':
      copy.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      break;
    case 'active':
    default:
      copy.sort((a, b) => {
        const scoreDiff = activeScore(b) - activeScore(a);
        if (scoreDiff !== 0) return scoreDiff;
        return b.publishedAt - a.publishedAt;
      });
      break;
  }

  return copy;
}

/** Lemmy-ish "hot": score weighted by recency. */
function hotScore(post: Post): number {
  const hours = (Date.now() - post.publishedAt) / 3_600_000;
  return (post.score ?? 0) / Math.pow(hours + 2, 1.5);
}

/** Lemmy-ish "active": a gentle nudge for recent activity. */
function activeScore(post: Post): number {
  const hours = (Date.now() - post.publishedAt) / 3_600_000;
  return 1 / Math.pow(hours + 4, 0.6);
}

/* --------------------------------------------------------------- helpers */

/** Returns all posts for a set of feeds, sorted. */
export async function collectPosts(
  feedIds: string[],
  sort: SortMode,
): Promise<Post[]> {
  const posts = await getPostsForFeeds(feedIds);
  return sortPosts(posts, sort);
}

/** Marks a post as read. */
export async function markRead(postId: string, read = true): Promise<void> {
  await updatePost(postId, { read });
}

/** Toggles the saved (bookmark) flag. */
export async function toggleSaved(postId: string): Promise<boolean> {
  const { getPost } = await import('./db');
  const post = await getPost(postId);
  if (!post) return false;
  const saved = !post.saved;
  await updatePost(postId, { saved });
  return saved;
}

/**
 * Records a vote.
 * The vote is stored locally; it is mirrored to the remote instance when the
 * matching auth session exists.
 */
export async function vote(
  postId: string,
  direction: -1 | 0 | 1,
): Promise<void> {
  const { getPost } = await import('./db');
  const post = await getPost(postId);
  if (!post) return;
  const vote = post.vote === direction ? 0 : direction;
  await updatePost(postId, { vote });
}

/** Computes trending feeds from the stored posts. */
export async function computeTrending(
  limit = 5,
): Promise<Array<{ feedId: string; title: string; score: number }>> {
  const feeds = await getAllFeeds();
  const posts = await getPostsForFeeds(feeds.map((feed) => feed.id));

  const scores = new Map<string, number>();
  for (const post of posts) {
    const hours = (Date.now() - post.publishedAt) / 3_600_000;
    const weight = 1 / Math.pow(hours + 2, 1.4);
    scores.set(post.feedId, (scores.get(post.feedId) ?? 0) + weight);
  }

  return Array.from(scores.entries())
    .map(([feedId, score]) => ({
      feedId,
      title: feeds.find((feed) => feed.id === feedId)?.title ?? feedId,
      score: Math.round(score * 100) / 100,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
