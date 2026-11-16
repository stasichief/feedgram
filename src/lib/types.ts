/** Shared domain types for feedgram. */

export type ThemeName = 'light' | 'sepia' | 'parchment' | 'oled';
export type FontFamily = 'sans' | 'serif';
export type LineWidth = 'narrow' | 'medium' | 'wide';
export type SortMode = 'active' | 'new' | 'hot' | 'top';
export type FeedScope = 'subscribed' | 'explore' | 'all';

/**
 * How a remote source is fetched.
 *
 * - `default`     : RSS 2.0 / Atom / JSON Feed (with feed discovery).
 * - `lemmy`       : Lemmy REST API (`/api/v3/...`) — communities, users, instances.
 * - `activitypub` : ActivityPub actor + outbox, with a Mastodon REST fallback.
 * - `bluesky`     : ATProto public API (`public.api.bsky.app`).
 */
export type FeedSource = 'default' | 'lemmy' | 'activitypub' | 'bluesky';

export type ProxyMode = 'direct' | 'custom';

export interface CustomTab {
  id: string;
  label: string;
  feedIds: string[];
}

export interface Settings {
  theme: ThemeName;
  fontFamily: FontFamily;
  fontSize: number;
  lineWidth: LineWidth;
  pollIntervalMinutes: number;
  exploreFeedUrls: string[];
  customTabs: CustomTab[];
  backgroundSync: boolean;
  proxyMode: ProxyMode;
  proxyUrl: string;
  proxyHeaders: Record<string, string>;
  proxyTimeoutMs: number;
  proxyRetries: number;
  userAgentOverride: string;
  siteUrl: string;
  showComments: boolean;
  /** Native (Tauri) only: accept self-signed / invalid TLS certificates. */
  ignoreInvalidCerts: boolean;
}

export type FeedKind = 'rss' | 'atom' | 'json' | 'activitypub' | 'bluesky' | 'lemmy';

export interface Feed {
  id: string;
  url: string;
  title: string;
  siteUrl?: string;
  icon?: string;
  kind?: FeedKind;
  source?: FeedSource;
  subscribed: boolean;
  lastFetchedAt?: number;
  error?: string;
  /** Optional community / actor handle for non-RSS sources. */
  handle?: string;
}

export interface Post {
  id: string;
  feedId: string;
  title: string;
  url: string;
  author?: string;
  publishedAt?: number;
  summary?: string;
  contentHtml?: string;
  /** True when contentHtml is the complete body (no Readability extraction). */
  inline?: boolean;
  image?: string;
  read: boolean;
  saved: boolean;
  remoteId?: string;
  score?: number;
  commentCount?: number;
}

export interface Article {
  postId: string;
  url: string;
  title: string;
  html: string;
  text: string;
  byline?: string;
  siteName?: string;
  length: number;
  excerpt?: string;
  fetchedAt: number;
}

export type AuthMethod =
  | 'none'
  | 'mastodon'
  | 'wordpress'
  | 'lemmy'
  | 'bluesky'
  | 'generic';

export interface AuthSession {
  method: AuthMethod;
  account: string;
  endpoint?: string;
  accessToken?: string;
  tokenType?: string;
  scope?: string;
  refreshToken?: string;
  /** Raw username/password style credentials (WordPress app password). */
  username?: string;
  extra?: Record<string, unknown>;
  connectedAt: number;
}

export interface FeedParseResult {
  title: string;
  siteUrl?: string;
  icon?: string;
  kind?: FeedKind;
  source?: FeedSource;
  posts: Post[];
}

export interface TrendingEntry {
  feedId: string;
  title: string;
  score: number;
}
