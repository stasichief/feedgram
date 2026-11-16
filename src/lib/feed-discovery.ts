import { proxyFetch } from './proxy';

const DISCOVERY_HOSTS = [
  'feed',
  'rss',
  'atom',
  'feed.xml',
  'rss.xml',
  'atom.xml',
  'index.xml',
  'feeds/posts/default',
];

function normaliseUrl(input: string): string {
  let url = input.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url;
}

/**
 * Parses a HTML document and returns the feed URLs declared through
 * `<link rel="alternate" type="application/rss+xml">` and friends.
 */
export function extractFeedLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const linkTag = /<link\b[^>]*>/gi;

  for (const match of html.matchAll(linkTag)) {
    const tag = match[0];
    const rel = /\brel=["']?([^"'\s>]+)/i.exec(tag)?.[1]?.toLowerCase();
    const type = /\btype=["']?([^"'\s>]+)/i.exec(tag)?.[1]?.toLowerCase();
    const href = /\bhref=["']?([^"'\s>]+)/i.exec(tag)?.[1];

    if (!href) continue;
    const isFeedRel = rel === 'alternate';
    const isFeedType =
      type &&
      (type.includes('rss') ||
        type.includes('atom') ||
        type.includes('rdf') ||
        type.includes('json'));

    if (isFeedRel && isFeedType) {
      try {
        links.push(new URL(href, baseUrl).toString());
      } catch {
        /* ignore malformed href */
      }
    }
  }

  return Array.from(new Set(links));
}

/** Guesses conventional feed locations for a site. */
export function guessFeedUrls(siteUrl: string): string[] {
  let parsed: URL;
  try {
    parsed = new URL(siteUrl);
  } catch {
    return [];
  }

  const origin = parsed.origin;
  const path = parsed.pathname.replace(/\/+$/, '');

  const candidates = [
    path && path !== '/' ? `${origin}${path}/feed` : '',
    path && path !== '/' ? `${origin}${path}/rss` : '',
    path && path !== '/' ? `${origin}${path}/feed.xml` : '',
    path && path !== '/' ? `${origin}${path}/rss.xml` : '',
    path && path !== '/' ? `${origin}${path}/atom.xml` : '',
    `${origin}/feed`,
    `${origin}/feed.xml`,
    `${origin}/rss`,
    `${origin}/rss.xml`,
    `${origin}/atom.xml`,
    `${origin}/index.xml`,
    `${origin}/feed/`,
    `${origin}/feeds/posts/default`,
  ];

  return Array.from(new Set(candidates.filter(Boolean)));
}

export interface DiscoveryResult {
  feedUrl: string;
  /** How the feed was found. */
  source: 'direct' | 'link' | 'guess';
  title?: string;
}

/**
 * Resolves a user supplied URL to a feed URL.
 *
 * Order: try the URL as a feed, then look for `<link rel="alternate">` in the
 * HTML, then probe conventional paths.
 */
export async function discoverFeed(
  input: string,
): Promise<DiscoveryResult | null> {
  const url = normaliseUrl(input);
  if (!url) return null;

  // 1. The URL might already be a feed.
  try {
    const result = await proxyFetch(url);
    const contentType = result.headers.get('content-type') ?? '';
    const body = result.text;
    const looksLikeFeed =
      contentType.includes('xml') ||
      contentType.includes('rss') ||
      contentType.includes('atom') ||
      contentType.includes('json') ||
      /<(rss|feed|rdf:RDF)[\s>]/i.test(body) ||
      /"version"\s*:\s*"https?:\/\/jsonfeed\.org/i.test(body);

    if (result.ok && looksLikeFeed) {
      return { feedUrl: url, source: 'direct' };
    }

    // 2. HTML page with a <link rel="alternate"> pointing at a feed.
    if (result.ok && /<html|<!doctype html/i.test(body)) {
      const links = extractFeedLinks(body, url);
      for (const link of links) {
        const check = await proxyFetch(link);
        if (check.ok) {
          return { feedUrl: link, source: 'link' };
        }
      }
    }
  } catch {
    /* fall through to guessing */
  }

  // 3. Conventional locations.
  for (const candidate of guessFeedUrls(url)) {
    try {
      const result = await proxyFetch(candidate, { retries: 0, timeoutMs: 8000 });
      if (!result.ok) continue;
      const contentType = result.headers.get('content-type') ?? '';
      const looksLikeFeed =
        contentType.includes('xml') ||
        contentType.includes('rss') ||
        contentType.includes('json') ||
        /<(rss|feed|rdf:RDF)[\s>]/i.test(result.text) ||
        /"version"\s*:\s*"https?:\/\/jsonfeed\.org/i.test(result.text);
      if (looksLikeFeed) {
        return { feedUrl: candidate, source: 'guess' };
      }
    } catch {
      /* try the next candidate */
    }
  }

  return null;
}

export { DISCOVERY_HOSTS, normaliseUrl };
