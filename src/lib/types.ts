/** Shared TypeScript types for feedgram. */

export type ThemeName = 'light' | 'sepia' | 'parchment' | 'oled';
export type FontFamily = 'sans' | 'serif';
export type LineWidth = 'narrow' | 'medium' | 'wide';
export type ProxyMode = 'direct' | 'custom';

/**
 * How a feed is sourced:
 * - `default`     : RSS / Atom / JSON Feed
 * - `lemmy`       : Lemmy REST API (`/api/v3/...`) — communities, users, instances.
 * - `activitypub` : ActivityPub actors / outboxes (Mastodon, Pixelfed, ...)
 * - `bluesky`     : Bluesky AT Protocol feeds
 */
export type FeedSource = 'default' | 'lemmy' | 'activitypub' | 'bluesky';

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
  ignoreInvalidCerts: boolean;
}
