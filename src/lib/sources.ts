import { fetchJson, proxyFetch } from './proxy';
import { hashString, stripHtml, truncate } from './feed-parser';
import { normaliseUrl } from './feed-discovery';
import type { Feed, FeedParseResult, FeedSource, Post } from './types';

/**
 * Remote source adapters.
 *
 * A "source" decides how a URL is read. The default source is RSS / Atom /
 * JSON Feed; the others use the platform's own API so we get metadata that
 * feeds do not expose (scores, comment counts, comment threads, avatars…).
 */

const AP_ACCEPT =
  'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams", application/json;q=0.9, */*;q=0.5';

export interface ResolvedSource {
  /** Canonical feed id — a URL that can be resolved again later. */
  feedUrl: string;
  result: FeedParseResult;
}

/* ------------------------------------------------------------------ utils */

function parseDate(value: unknown): number {
  if (typeof value !== 'string' || !value) return Date.now();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Inline Markdown (links, bold, italics) → HTML. Input is escaped first. */
function markdownInline(text: string): string {
  return escapeHtml(text)
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" rel="nofollow noopener" target="_blank">$1</a>',
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\s)\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br />');
}

/** Minimal Markdown → HTML for Lemmy post bodies (paragraphs, quotes, links). */
export function markdownToHtml(markdown: string): string {
  if (!markdown.trim()) return '';

  const blocks: string[] = [];
  let paragraph: string[] = [];
  let quote: string[] = [];

  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      blocks.push(`<p>${markdownInline(paragraph.join('\n'))}</p>`);
      paragraph = [];
    }
  };
  const flushQuote = (): void => {
    if (quote.length > 0) {
      blocks.push(`<blockquote>${markdownInline(quote.join('\n'))}</blockquote>`);
      quote = [];
    }
  };

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushQuote();
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushParagraph();
      quote.push(line.replace(/^>\s?/, ''));
      continue;
    }
    flushQuote();
    paragraph.push(line.replace(/^[-*+]\s+/, '• ').replace(/^#{1,6}\s+/, ''));
  }

  flushParagraph();
  flushQuote();
  return blocks.join('\n');
}

/** Plain-text version of Markdown, used for excerpts. */
export function markdownToText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|\s)\*([^*\n]+)\*/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

interface PostSeed {
  key: string;
  title: string;
  url?: string;
  excerpt?: string;
  author?: string;
  publishedAt?: number;
  thumbnail?: string;
  commentCount?: number;
  score?: number;
  remoteId?: string;
  contentHtml?: string;
  inline?: boolean;
}

function makePost(feedId: string, seed: PostSeed): Post {
  return {
    id: `${feedId}::${hashString(seed.key)}`,
    feedId,
    title: seed.title.trim() || '(untitled)',
    url: seed.url ?? '',
    excerpt: truncate(seed.excerpt ?? ''),
    author: seed.author,
    publishedAt: seed.publishedAt ?? Date.now(),
    thumbnail: seed.thumbnail,
    commentCount: seed.commentCount,
    score: seed.score,
    remoteId: seed.remoteId,
    contentHtml: seed.contentHtml,
    inline: seed.inline,
    read: false,
    saved: false,
    vote: 0,
  };
}

/* ------------------------------------------------------------------ Lemmy */

export interface LemmyTarget {
  origin: string;
  name?: string;
  kind: 'community' | 'user' | 'instance';
}

/**
 * Understands the shapes Lemmy URLs come in:
 *   https://lemmy.sdf.org/c/humanrights
 *   !humanrights@lemmy.sdf.org
 *   humanrights@lemmy.sdf.org
 *   https://lemmy.sdf.org/u/someone
 *   https://lemmy.sdf.org            (whole instance)
 */
export function parseLemmyTarget(input: string): LemmyTarget | null {
  const value = input.trim();
  if (!value) return null;

  const handle = /^!?([\w.-]+)@([\w.-]+\.[a-z]{2,})$/i.exec(value);
  if (handle) {
    return {
      origin: `https://${handle[2].toLowerCase()}`,
      name: `${handle[1]}@${handle[2].toLowerCase()}`,
      kind: 'community',
    };
  }

  let url: URL;
  try {
    url = new URL(normaliseUrl(value));
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol)) return null;

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0] === 'c' && segments[1]) {
    return { origin: url.origin, name: segments[1], kind: 'community' };
  }
  if (segments[0] === 'u' && segments[1]) {
    return { origin: url.origin, name: segments[1], kind: 'user' };
  }
  return { origin: url.origin, kind: 'instance' };
}

/** Turns a Lemmy post view into our Post shape. */
function lemmyPost(feedId: string, view: any): Post | null {
  const post = view?.post;
  if (!post) return null;

  const body = typeof post.body === 'string' ? post.body : '';
  const external = typeof post.url === 'string' && post.url ? post.url : undefined;
  const discussion =
    typeof post.ap_id === 'string' && post.ap_id ? post.ap_id : external;

  return makePost(feedId, {
    key: String(post.id ?? discussion ?? post.name),
    title: String(post.name ?? ''),
    // Prefer the article; fall back to the Lemmy discussion page.
    url: external ?? discussion,
    excerpt: markdownToText(body),
    author:
      view?.creator?.display_name || view?.creator?.name
        ? String(view.creator.display_name || view.creator.name)
        : undefined,
    publishedAt: parseDate(post.published ?? post.updated),
    thumbnail:
      typeof post.thumbnail_url === 'string' && post.thumbnail_url
        ? post.thumbnail_url
        : undefined,
    commentCount:
      typeof view?.counts?.comments === 'number' ? view.counts.comments : undefined,
    score: typeof view?.counts?.score === 'number' ? view.counts.score : undefined,
    remoteId: post.id !== undefined ? String(post.id) : undefined,
    contentHtml: body ? markdownToHtml(body) : undefined,
    inline: Boolean(body),
  });
}

async function resolveLemmy(input: string): Promise<ResolvedSource> {
  const target = parseLemmyTarget(input);
  if (!target) throw new Error('That does not look like a Lemmy URL.');

  const { origin, name } = target;

  if (target.kind === 'community' && name) {
    const communityResponse = await fetchJson<any>(
      `${origin}/api/v3/community?name=${encodeURIComponent(name)}`,
    );
    const community = communityResponse?.community_view?.community;
    if (!community?.id) throw new Error('Lemmy community not found.');

    const feedUrl = String(community.actor_id ?? `${origin}/c/${community.name}`);
    const list = await fetchJson<any>(
      `${origin}/api/v3/post/list?community_id=${community.id}&sort=Active&limit=50`,
    );

    const posts = ((Array.isArray(list?.posts) ? list.posts : []) as any[]).map((view: any) => lemmyPost(feedUrl, view))
      .filter((post): post is Post => post !== null);

    return {
      feedUrl,
      result: {
        title: String(community.title ?? community.name ?? feedUrl),
        siteUrl: String(community.actor_id ?? feedUrl),
        icon: community.icon ?? undefined,
        kind: 'lemmy',
        source: 'lemmy',
        posts,
      },
    };
  }

  if (target.kind === 'user' && name) {
    const account = name.includes('@') ? name : `${name}@${new URL(origin).hostname}`;
    const response = await fetchJson<any>(
      `${origin}/api/v3/user?username=${encodeURIComponent(account)}&sort=New&limit=50`,
    );
    const person = response?.person_view?.person;
    if (!person?.id) throw new Error('Lemmy user not found.');

    const feedUrl = String(person.actor_id ?? `${origin}/u/${person.name}`);
    const posts = ((Array.isArray(response?.posts) ? response.posts : []) as any[]).map((view: any) => lemmyPost(feedUrl, view))
      .filter((post): post is Post => post !== null);

    return {
      feedUrl,
      result: {
        title: String(person.display_name || person.name || feedUrl),
        siteUrl: feedUrl,
        icon: person.avatar ?? undefined,
        kind: 'lemmy',
        source: 'lemmy',
        posts,
      },
    };
  }

  // Whole instance — the active posts across every community.
  const [site, list] = await Promise.all([
    fetchJson<any>(`${origin}/api/v3/site`).catch(() => null),
    fetchJson<any>(`${origin}/api/v3/post/list?sort=Active&limit=50`),
  ]);

  const feedUrl = `${origin}/`;
  const siteInfo = site?.site_view?.site;
  const posts = ((Array.isArray(list?.posts) ? list.posts : []) as any[]).map((view: any) => lemmyPost(feedUrl, view))
    .filter((post): post is Post => post !== null);

  return {
    feedUrl,
    result: {
      title: String(siteInfo?.name ?? new URL(origin).hostname),
      siteUrl: origin,
      icon: siteInfo?.icon ?? undefined,
      kind: 'lemmy',
      source: 'lemmy',
      posts,
    },
  };
}

/* --------------------------------------------------------------- Mastodon */

interface MastodonTarget {
  origin: string;
  account?: string;
  kind: 'account' | 'instance';
}

/**
 * Mastodon-style URLs:
 *   https://defcon.social/@someone
 *   https://mastodon.social/users/someone
 *   https://defcon.social/explore      (trending posts)
 *   https://defcon.social             (trending posts)
 */
export function parseMastodonTarget(input: string): MastodonTarget | null {
  let url: URL;
  try {
    url = new URL(normaliseUrl(input));
  } catch {
    return null;
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0] === '@' && segments[1]) {
    return { origin: url.origin, account: segments[1], kind: 'account' };
  }
  if (segments[0] === 'users' && segments[1]) {
    return { origin: url.origin, account: segments[1], kind: 'account' };
  }
  if (segments[0] === 'explore' || segments.length === 0) {
    return { origin: url.origin, kind: 'instance' };
  }
  return null;
}

function mastodonStatus(feedId: string, status: any): Post | null {
  if (!status) return null;
  // Boosts carry the original post in `reblog`; surface that instead.
  const entry = status.reblog ?? status;
  const html = String(entry.content ?? '');
  const url = String(entry.url ?? entry.uri ?? '');
  const account = entry.account ?? {};

  const media = Array.isArray(entry.media_attachments)
    ? entry.media_attachments.find((item: any) => item?.type === 'image')
    : undefined;

  const plain = stripHtml(html);

  return makePost(feedId, {
    key: String(entry.id ?? url),
    title: plain.slice(0, 120) || '(untitled)',
    url,
    excerpt: plain,
    author: String(account.display_name || account.acct || account.username || ''),
    publishedAt: parseDate(entry.created_at ?? entry.edited_at),
    thumbnail: media?.preview_url ?? media?.url ?? undefined,
    commentCount:
      typeof entry.replies_count === 'number' ? entry.replies_count : undefined,
    score:
      typeof entry.favourites_count === 'number'
        ? entry.favourites_count
        : undefined,
    remoteId: entry.id !== undefined ? String(entry.id) : undefined,
    contentHtml: html || undefined,
    inline: Boolean(html),
  });
}

async function resolveMastodon(input: string): Promise<ResolvedSource> {
  const target = parseMastodonTarget(input);
  if (!target) throw new Error('That does not look like a Mastodon URL.');

  const { origin } = target;

  if (target.kind === 'account' && target.account) {
    const host = new URL(origin).hostname;
    const acct = target.account.includes('@')
      ? target.account
      : `${target.account}@${host}`;

    const account = await fetchJson<any>(
      `${origin}/api/v1/accounts/lookup?acct=${encodeURIComponent(acct)}`,
    );
    if (!account?.id) throw new Error('Mastodon account not found.');

    const feedUrl = String(account.url ?? `${origin}/@${account.username}`);
    const statuses = await fetchJson<any>(
      `${origin}/api/v1/accounts/${encodeURIComponent(account.id)}/statuses?limit=40&exclude_replies=true`,
    );

    const posts = ((Array.isArray(statuses) ? statuses : []) as any[]).map((status: any) => mastodonStatus(feedUrl, status))
      .filter((post): post is Post => post !== null);

    return {
      feedUrl,
      result: {
        title: String(account.display_name || `@${account.acct}`),
        siteUrl: feedUrl,
        icon: account.avatar_static ?? account.avatar ?? undefined,
        kind: 'mastodon',
        source: 'activitypub',
        posts,
      },
    };
  }

  // Instance-level discovery: trending posts, like the /explore page.
  const [instance, statuses] = await Promise.all([
    fetchJson<any>(`${origin}/api/v2/instance`).catch(() =>
      fetchJson<any>(`${origin}/api/v1/instance`).catch(() => null),
    ),
    fetchJson<any>(`${origin}/api/v1/trends/statuses?limit=40`),
  ]);

  const feedUrl = `${origin}/explore`;
  const posts = ((Array.isArray(statuses) ? statuses : []) as any[]).map((status: any) => mastodonStatus(feedUrl, status))
    .filter((post): post is Post => post !== null);

  const icon = instance?.thumbnail?.url ?? instance?.icon ?? undefined;

  return {
    feedUrl,
    result: {
      title: `${instance?.title ?? new URL(origin).hostname} · Trending`,
      siteUrl: origin,
      icon: typeof icon === 'string' ? icon : undefined,
      kind: 'mastodon',
      source: 'activitypub',
      posts,
    },
  };
}

/* ------------------------------------------------------------ ActivityPub */

/** Unwraps Announce(Create(Note|Page|Article)) into the object itself. */
function unwrapActivity(node: any): any {
  let current = node;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    const type = String(current.type ?? '');
    if (['Note', 'Page', 'Article', 'Video', 'Question'].includes(type)) {
      return current;
    }
    if (current.object && typeof current.object === 'object') {
      current = current.object;
      continue;
    }
    break;
  }
  return current && ['Note', 'Page', 'Article', 'Video', 'Question'].includes(String(current.type))
    ? current
    : null;
}

function activityPubPost(feedId: string, object: any): Post | null {
  if (!object) return null;

  const contentHtml = String(object.content ?? object.summary ?? '');
  const name = String(object.name ?? '').trim();
  const plain = stripHtml(contentHtml);
  const published = object.published ?? object.updated;

  let url = typeof object.url === 'string' ? object.url : '';
  if (!url) {
    const id = String(object.id ?? '');
    // Activity ids are not readable pages; keep only real permalinks.
    if (/^https?:/i.test(id) && !/\/activities?\//.test(id)) url = id;
  }

  const attachments = Array.isArray(object.attachment) ? object.attachment : [];
  // Some implementations put the article link in `attachment` instead of `url`.
  if (!url) {
    const link = attachments.find(
      (item: any) =>
        typeof item?.href === 'string' &&
        /^https?:/i.test(item.href) &&
        !/\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(item.href) &&
        !/\/pictrs\/image\//i.test(item.href),
    );
    if (link) url = link.href;
  }

  const attachment = attachments.find(
    (item: any) => item?.type === 'Document' || item?.mediaType?.startsWith?.('image'),
  );
  const image = attachment?.url ?? attachment?.href ?? object.image?.url ?? undefined;

  const attributed =
    typeof object.attributedTo === 'string'
      ? object.attributedTo
      : object.attributedTo?.id;

  return makePost(feedId, {
    key: String(object.id ?? url ?? name),
    title: name || plain.slice(0, 120) || '(untitled)',
    url,
    excerpt: plain,
    author: typeof attributed === 'string' ? attributed.split('/').pop() : undefined,
    publishedAt: parseDate(published),
    thumbnail: typeof image === 'string' ? image : undefined,
    remoteId: String(object.id ?? ''),
    contentHtml: contentHtml || undefined,
    inline: Boolean(contentHtml),
  });
}

async function fetchActivityPubDocument(url: string): Promise<any> {
  const response = await proxyFetch(url, {
    headers: { Accept: AP_ACCEPT },
  });
  if (!response.ok) {
    throw new Error(`ActivityPub request failed (${response.status})`);
  }
  try {
    return JSON.parse(response.text);
  } catch {
    throw new Error('ActivityPub response was not JSON');
  }
}

async function resolveActivityPub(input: string): Promise<ResolvedSource> {
  const url = normaliseUrl(input);

  try {
    const document = await fetchActivityPubDocument(url);

    let collection = document;
    // An actor document points at its outbox.
    if (document?.outbox) {
      collection = await fetchActivityPubDocument(
        typeof document.outbox === 'string' ? document.outbox : document.outbox.id,
      );
    }
    // Paged collections expose the items through `first`.
    if (!Array.isArray(collection?.orderedItems) && collection?.first) {
      const first =
        typeof collection.first === 'string' ? collection.first : collection.first?.id;
      if (first) collection = await fetchActivityPubDocument(first);
    }

    const items: any[] = Array.isArray(collection?.orderedItems)
      ? collection.orderedItems
      : [];

    const feedUrl = String(document?.id ?? url);
    const posts = items
      .map((item) => activityPubPost(feedUrl, unwrapActivity(item)))
      .filter((post): post is Post => post !== null);

    if (posts.length > 0 || items.length > 0) {
      return {
        feedUrl,
        result: {
          title: String(
            document?.name ||
              document?.preferredUsername ||
              new URL(feedUrl).hostname,
          ),
          siteUrl: String(document?.url ?? feedUrl),
          icon:
            typeof document?.icon?.url === 'string'
              ? document.icon.url
              : typeof document?.icon === 'string'
                ? document.icon
                : undefined,
          kind: 'activitypub',
          source: 'activitypub',
          posts,
        },
      };
    }
  } catch {
    /* Fall through to the Mastodon API — many servers sign AP requests. */
  }

  return resolveMastodon(input);
}

/* ---------------------------------------------------------------- Bluesky */

/** Extracts a handle from a bsky.app profile URL or a bare handle. */
export function parseBlueskyTarget(input: string): string | null {
  const value = input.trim().replace(/^@/, '');
  if (!value) return null;

  if (!/^https?:\/\//i.test(value)) {
    return /^[\w.-]+\.[a-z]{2,}$/i.test(value) || value.startsWith('did:')
      ? value
      : null;
  }

  try {
    const url = new URL(value);
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments[0] === 'profile' && segments[1]) return decodeURIComponent(segments[1]);
    if (segments[0] === 'feed' && segments[1]) return decodeURIComponent(segments[1]);
  } catch {
    return null;
  }
  return null;
}

function blueskyPost(feedId: string, item: any): Post | null {
  const post = item?.post;
  if (!post?.record) return null;

  const record = post.record;
  const text = String(record.text ?? '');
  const author = post.author ?? {};

  const embed = post.embed ?? {};
  const images = embed.images ?? embed.media?.images;
  const thumb =
    Array.isArray(images) && images[0]
      ? images[0].thumb ?? images[0].fullsize
      : embed.external?.thumb ?? undefined;

  const rkey = String(post.uri ?? '').split('/').pop();
  const handle = String(author.handle ?? author.did ?? '');
  const url = handle && rkey ? `https://bsky.app/profile/${handle}/post/${rkey}` : '';

  return makePost(feedId, {
    key: String(post.uri ?? url),
    title: text.split('\n')[0].slice(0, 140) || '(untitled)',
    url,
    excerpt: text,
    author: String(author.displayName || `@${handle}`),
    publishedAt: parseDate(record.createdAt ?? post.indexedAt),
    thumbnail: typeof thumb === 'string' ? thumb : undefined,
    commentCount:
      typeof post.replyCount === 'number' ? post.replyCount : undefined,
    score: typeof post.likeCount === 'number' ? post.likeCount : undefined,
    remoteId: String(post.uri ?? ''),
    contentHtml: text ? `<p>${escapeHtml(text).replace(/\n/g, '<br />')}</p>` : undefined,
    inline: Boolean(text),
  });
}

async function resolveBluesky(input: string): Promise<ResolvedSource> {
  const handle = parseBlueskyTarget(input);
  if (!handle) throw new Error('That does not look like a Bluesky handle or URL.');

  const api = 'https://public.api.bsky.app/xrpc';
  const profile = await fetchJson<any>(
    `${api}/app.bsky.actor.getProfile?actor=${encodeURIComponent(handle)}`,
  );
  if (!profile?.did) throw new Error('Bluesky account not found.');

  const feed = await fetchJson<any>(
    `${api}/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(profile.did)}&limit=50&filter=posts_no_replies`,
  );

  const feedUrl = `https://bsky.app/profile/${profile.handle ?? handle}`;
  const posts = ((Array.isArray(feed?.feed) ? feed.feed : []) as any[])
    .filter((item: any) => !item?.reason) // skip reposts so the timeline stays readable
    .map((item: any) => blueskyPost(feedUrl, item))
    .filter((post): post is Post => post !== null);

  return {
    feedUrl,
    result: {
      title: String(profile.displayName || `@${profile.handle ?? handle}`),
      siteUrl: feedUrl,
      icon: profile.avatar ?? undefined,
      kind: 'bluesky',
      source: 'bluesky',
      posts,
    },
  };
}

/* ------------------------------------------------------------- dispatchers */

/** Resolves any supported URL through the requested source. */
export async function resolveSource(
  input: string,
  source: FeedSource,
): Promise<ResolvedSource> {
  switch (source) {
    case 'lemmy':
      return resolveLemmy(input);
    case 'activitypub':
      return resolveActivityPub(input);
    case 'bluesky':
      return resolveBluesky(input);
    case 'default':
    default:
      throw new Error('The default source is resolved by feed discovery.');
  }
}

/** Re-fetches an existing feed through its stored source. */
export async function fetchSourceFeed(
  feed: Pick<Feed, 'id' | 'source'>,
): Promise<FeedParseResult> {
  const source: FeedSource = feed.source ?? 'default';
  if (source === 'default') {
    throw new Error('Default feeds are fetched through the feed parser.');
  }
  const resolved = await resolveSource(feed.id, source);
  return resolved.result;
}

/** Human readable label for the source picker. */
export const SOURCE_LABELS: Record<FeedSource, string> = {
  default: 'RSS / Atom / JSON Feed',
  lemmy: 'Lemmy (REST API)',
  activitypub: 'ActivityPub / Mastodon',
  bluesky: 'Bluesky (ATProto)',
};

export const SOURCE_HINTS: Record<FeedSource, string> = {
  default: 'Paste a site or feed URL — the feed is discovered automatically.',
  lemmy:
    'Paste a community URL (lemmy.sdf.org/c/humanrights), a user, or a whole instance.',
  activitypub:
    'Paste a profile or instance URL (defcon.social/explore, mastodon.social/@user).',
  bluesky: 'Paste a bsky.app profile URL or a handle like user.bsky.social.',
};

