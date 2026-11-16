import { XMLParser } from 'fast-xml-parser';
import type { Feed, FeedKind, FeedParseResult, Post } from './types';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: true,
  htmlEntities: true,
  isArray: (name) =>
    ['item', 'entry', 'link', 'category', 'author'].includes(name),
});

/* ------------------------------------------------------------------ utils */

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record['#text'] === 'string') return record['#text'];
    if (typeof record['@_href'] === 'string') return record['@_href'];
  }
  return '';
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(value: string, max = 320): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

export function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

function parseDate(value: string | undefined): number {
  if (!value) return Date.now();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Finds the first usable link among the many shapes feeds use. */
function extractLink(node: Record<string, unknown>): string {
  const rawLink = node.link;
  const links = asArray(rawLink);

  for (const link of links) {
    if (typeof link === 'string') return link;
    if (link && typeof link === 'object') {
      const record = link as Record<string, unknown>;
      const rel = record['@_rel'];
      const href = record['@_href'];
      const type = record['@_type'];
      if (typeof href === 'string' && href) {
        if (!rel || rel === 'alternate') {
          if (!type || String(type).includes('html') || String(type).includes('xhtml')) {
            return href;
          }
        }
      }
    }
  }

  // Atom: <link href="..."/> without rel
  for (const link of links) {
    if (link && typeof link === 'object') {
      const href = (link as Record<string, unknown>)['@_href'];
      if (typeof href === 'string' && href) return href;
    }
  }

  const guid = text(node.guid);
  if (guid.startsWith('http')) return guid;
  const id = text(node.id);
  if (id.startsWith('http')) return id;
  return '';
}

function extractThumbnail(node: Record<string, unknown>): string | undefined {
  const mediaThumbnail = text(node['media:thumbnail']);
  if (mediaThumbnail) return mediaThumbnail;

  const enclosures = asArray(node.enclosure);
  for (const enclosure of enclosures) {
    if (enclosure && typeof enclosure === 'object') {
      const record = enclosure as Record<string, unknown>;
      const type = String(record['@_type'] ?? '');
      const url = record['@_url'];
      if (typeof url === 'string' && url && type.startsWith('image')) return url;
    }
  }

  const content = asArray(node['media:content']);
  for (const item of content) {
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      const type = String(record['@_type'] ?? '');
      const url = record['@_url'];
      const medium = String(record['@_medium'] ?? '');
      if (typeof url === 'string' && url && (type.startsWith('image') || medium === 'image')) {
        return url;
      }
    }
  }

  const html = text(node['content:encoded']) || text(node.content);
  const match = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  if (match) return match[1];

  return undefined;
}

function extractAuthor(node: Record<string, unknown>): string | undefined {
  const authors = asArray(node.author ?? node['dc:creator']);
  for (const author of authors) {
    if (typeof author === 'string' && author.trim()) return author.trim();
    if (author && typeof author === 'object') {
      const record = author as Record<string, unknown>;
      const name = text(record.name);
      if (name) return name;
      const username = text(record.username);
      if (username) return username;
    }
  }
  return undefined;
}

function extractContent(node: Record<string, unknown>): string | undefined {
  const candidates = [
    node['content:encoded'],
    node.content,
    node.summary,
    node.description,
    node['content'],
  ];
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue;
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
    if (typeof candidate === 'object') {
      const html = text(candidate);
      if (html.trim()) return html;
    }
  }
  return undefined;
}

/* ------------------------------------------------------------ kind detect */

/**
 * Guesses the platform behind a feed so that comment endpoints and posting
 * can be wired up automatically.
 */
export function detectFeedKind(feedUrl: string, siteUrl?: string): FeedKind {
  const haystack = `${feedUrl} ${siteUrl ?? ''}`.toLowerCase();
  if (/\/api\/v1\/timelines\/|\/api\/v1\/accounts\/.+\/statuses\.rss|@[^/]+\.rss/.test(haystack)) {
    return 'mastodon';
  }
  if (/\/feeds?\/|\/c\/[^/]+\.rss|lemmy/.test(haystack)) return 'lemmy';
  if (/\/feed\/?$|\/rss\/?$|\?feed=rss2|\/wp-json/.test(haystack)) {
    if (haystack.includes('wordpress') || haystack.includes('wp-json')) return 'wordpress';
  }
  if (haystack.includes('lemmy')) return 'lemmy';
  if (haystack.includes('mastodon')) return 'mastodon';
  return 'generic';
}

/* ------------------------------------------------------------------ JSON */

/** Detects and parses a JSON Feed document. */
export function tryParseJsonFeed(
  body: string,
  feedUrl: string,
): FeedParseResult | null {
  const trimmed = body.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;

  let data: any;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return null;
  }

  // JSON Feed
  if (data && typeof data === 'object' && data.version) {
    const items = Array.isArray(data.items) ? data.items : [];
    const posts: Post[] = items.map((item: any) => {
      const link = String(item.url ?? item.external_url ?? item.id ?? '');
      const guid = String(item.id ?? link);
      const contentHtml =
        item.content_html ?? item.content_text ?? item.summary ?? '';
      return {
        id: `${feedUrl}::${hashString(guid)}`,
        feedId: feedUrl,
        title: String(item.title ?? '(untitled)'),
        url: link,
        excerpt: truncate(stripHtml(String(contentHtml))),
        author: item.author?.name ? String(item.author.name) : undefined,
        publishedAt: parseDate(
          item.date_published ?? item.date_modified ?? undefined,
        ),
        thumbnail: item.image ?? item.banner ?? undefined,
        read: false,
        saved: false,
        vote: 0,
      } as Post;
    });

    return {
      title: String(data.title ?? domainOf(feedUrl)),
      siteUrl: data.home_page_url ?? undefined,
      icon: data.favicon ?? data.icon ?? undefined,
      kind: 'generic',
      posts,
    };
  }

  // Mastodon / Lemmy style status arrays
  if (Array.isArray(data) && data.length > 0 && data[0]?.content) {
    const posts: Post[] = data.map((status: any) => {
      const url = String(status.url ?? status.uri ?? '');
      const html = String(status.content ?? '');
      const published = status.created_at ?? status.published ?? undefined;
      return {
        id: `${feedUrl}::${hashString(String(status.id ?? url))}`,
        feedId: feedUrl,
        title: stripHtml(html).slice(0, 120) || '(untitled)',
        url,
        excerpt: truncate(stripHtml(html)),
        author: status.account?.acct ?? status.account?.name ?? undefined,
        publishedAt: parseDate(published),
        thumbnail: status.media_attachments?.[0]?.url ?? undefined,
        commentCount: status.replies_count ?? undefined,
        score: status.favourites_count ?? undefined,
        remoteId: status.id !== undefined ? String(status.id) : undefined,
        contentHtml: html,
        read: false,
        saved: false,
        vote: 0,
      } as Post;
    });
    return {
      title: domainOf(feedUrl),
      kind: 'generic',
      posts,
    };
  }

  return null;
}

/* ------------------------------------------------------------------- XML */

/** Parses an RSS 2.0 / Atom document. */
export function parseXmlFeed(body: string, feedUrl: string): FeedParseResult {
  const doc = parser.parse(body) as Record<string, any>;

  let channel: Record<string, any> | undefined;

  if (doc.rss?.channel) {
    channel = Array.isArray(doc.rss.channel)
      ? doc.rss.channel[0]
      : doc.rss.channel;
  } else if (doc['rdf:RDF']) {
    channel = doc['rdf:RDF'].channel;
  } else if (doc.feed) {
    channel = doc.feed;
  }

  if (!channel) {
    throw new Error('Unsupported feed format: no rss/atom channel found');
  }

  const isAtom = Boolean(doc.feed) && !doc.rss;

  const title =
    text(channel.title) || text(doc.feed?.title) || domainOf(feedUrl);

  let siteUrl: string | undefined;
  const linkNode = channel.link;
  const links = asArray(linkNode);
  for (const link of links) {
    if (typeof link === 'string') {
      siteUrl = link;
      break;
    }
    if (link && typeof link === 'object') {
      const record = link as Record<string, unknown>;
      const rel = record['@_rel'];
      if (!rel || rel === 'alternate') {
        siteUrl = String(record['@_href'] ?? '') || undefined;
        if (siteUrl) break;
      }
    }
  }

  const icon =
    text(channel.image?.url) ||
    text(channel['itunes:image']?.['@_href']) ||
    text(channel.logo) ||
    undefined;

  const items = isAtom
    ? asArray(channel.entry)
    : asArray(channel.item);

  const posts: Post[] = items.map((rawItem: any) => {
    const node: Record<string, unknown> = rawItem ?? {};
    const link = extractLink(node);
    const guid = text(node.guid) || text(node.id) || link;
    const contentHtml = extractContent(node);
    const excerptSource = stripHtml(
      text(node.description) ||
        text(node.summary) ||
        (contentHtml ? contentHtml : ''),
    );
    const publishedRaw =
      text(node.pubDate) ||
      text(node.published) ||
      text(node.updated) ||
      text(node['dc:date']) ||
      undefined;

    const categories = asArray(node.category)
      .map((category) => {
        if (typeof category === 'string') return category;
        if (category && typeof category === 'object') {
          return String(
            (category as Record<string, unknown>)['@_term'] ??
              (category as Record<string, unknown>)['@_label'] ??
              '',
          );
        }
        return '';
      })
      .filter(Boolean);

    return {
      id: `${feedUrl}::${hashString(guid)}`,
      feedId: feedUrl,
      title: text(node.title) || '(untitled)',
      url: link || text(node.guid),
      excerpt: truncate(excerptSource),
      author: extractAuthor(node),
      publishedAt: parseDate(publishedRaw),
      thumbnail: extractThumbnail(node),
      commentCount: Number(text(node.comments)) || undefined,
      score: Number(text(node['slash:comments'])) || undefined,
      remoteId:
        categories.find((tag) => /^(post|status|comment)[-_]/i.test(tag)) ??
        (link ? link.split('/').filter(Boolean).pop() : undefined),
      contentHtml: contentHtml?.includes('<') ? contentHtml : undefined,
      read: false,
      saved: false,
      vote: 0,
    } as Post;
  });

  return {
    title,
    siteUrl,
    icon,
    kind: detectFeedKind(feedUrl, siteUrl),
    posts,
  };
}

/** Parses any supported feed format. */
export function parseFeed(body: string, feedUrl: string): FeedParseResult {
  const jsonResult = tryParseJsonFeed(body, feedUrl);
  if (jsonResult) return jsonResult;
  return parseXmlFeed(body, feedUrl);
}

/** Builds a Feed record from a parse result. */
export function toFeed(
  result: FeedParseResult,
  feedUrl: string,
  existing?: Feed,
): Feed {
  return {
    id: feedUrl,
    title: result.title || existing?.title || domainOf(feedUrl),
    siteUrl: result.siteUrl ?? existing?.siteUrl,
    icon: result.icon ?? existing?.icon,
    addedAt: existing?.addedAt ?? Date.now(),
    lastFetchedAt: Date.now(),
    kind: result.kind ?? existing?.kind ?? 'generic',
    source: result.source ?? existing?.source ?? 'default',
    commentEndpoint: existing?.commentEndpoint,
    explore: existing?.explore,
    etag: existing?.etag,
    lastModified: existing?.lastModified,
  };
}
