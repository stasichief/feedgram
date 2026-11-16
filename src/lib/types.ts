/** Shared domain types for feedgram. */

export type ThemeName = 'light' | 'sepia' | 'oled';
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

/** A user-created Home tab that filters a set of explore sources. */
export interface CustomTab {
  id: string;
  label: string;
  /** Feed ids (explore source URLs) shown in this tab. */
  feedIds: string[];
}

export interface Settings {
  theme: ThemeName;
  fontFamily: FontFamily;
  fontSize: number;
  lineWidth: LineWidth;
  pollIntervalMinutes: number;
  exploreFeedUrls: string[];
  /** Extra Home tabs built from explore sources. */
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
}

export interface Feed {
  /** Feed URL, used as the primary key. */
  id: string;
  title: string;
  /** Homepage of the site the feed belongs to. */
  siteUrl?: string;
  icon?: string;
  /** Subscription date (epoch ms). */
  addedAt: number;
  lastFetchedAt?: number;
  lastError?: string;
  etag?: string;
  lastModified?: string;
  /** Optional user-supplied JSON endpoint that returns comments for a post. */
  commentEndpoint?: string;
  /** Detected source kind, used for comment endpoints + posting. */
  kind?: FeedKind;
  /** Which remote API this feed is read through. */
  source?: FeedSource;
  /** True for the discovery feeds shown on the Explore page. */
  explore?: boolean;
}

export type FeedKind =
  | 'generic'
  | 'mastodon'
  | 'lemmy'
  | 'wordpress'
  | 'activitypub'
  | 'bluesky';

export interface Post {
  /** Stable id derived from the feed id + guid/link. */
  id: string;
  feedId: string;
  title: string;
  url: string;
  excerpt: string;
  author?: string;
  publishedAt: number;
  thumbnail?: string;
  /** Remote comments count when the feed provides one. */
  commentCount?: number;
  /** Remote score when the feed provides one. */
  score?: number;
  /** Identifier used against the remote comments endpoint. */
  remoteId?: string;
  /** Full content when the feed embeds it (Atom content / JSON Feed content). */
  contentHtml?: string;
  /** True when `contentHtml` is the complete post and must not be re-extracted. */
  inline?: boolean;
  read: boolean;
  saved: boolean;
  /** -1, 0 or 1. */
  vote: -1 | 0 | 1;
}

export interface Article {
  postId: string;
  title: string;
  /** Sanitized HTML extracted with Readability. */
  html: string;
  text: string;
  byline?: string;
  siteName?: string;
  length: number;
  excerpt?: string;
  fetchedAt: number;
}

export interface Comment {
  id: string;
  postId: string;
  author: string;
  body: string;
  createdAt?: number;
  score?: number;
  depth: number;
  /** Profile URL of the author, when the platform exposes it. */
  authorUrl?: string;
  /** Platform handle (e.g. `@user@host`), when available. */
  authorHandle?: string;
  replies?: Comment[];
}

export type AuthMethod =
  | 'micropub'
  | 'mastodon'
  | 'wordpress'
  | 'bluesky'
  | 'lemmy';

export interface AuthSession {
  method: AuthMethod;
  /** Human readable account label. */
  account: string;
  /** Instance / site base URL. */
  endpoint?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: number;
  scope?: string;
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
