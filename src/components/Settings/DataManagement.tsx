import { Component } from 'inferno';
import { Button } from '../common/Button';
import { Input, Select } from '../common/Field';
import {
  clearCache, clearIndexedStore, deleteOldPosts, estimateStorage,
  getIndexedStoreSizes, getSavedPosts, resetEverything,
} from '../../lib/db';
import { downloadTextFile, exportBookmarksOPML, exportOPML } from '../../lib/opml';
import { importOPML } from '../../lib/opml';
import { discoverFeed } from '../../lib/feed-discovery';
import { putFeed } from '../../lib/db';
import type { Feed } from '../../lib/types';

export interface DataManagementProps {
  feeds: Feed[];
  onReset: () => void;
  onRefreshAll: () => Promise<void>;
  retentionAmount: number;
  retentionUnit: 'days' | 'months' | 'years';
  onRetentionAmount: (value: number) => void;
  onRetentionUnit: (value: 'days' | 'months' | 'years') => void;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

async function imageCacheSize(): Promise<number> {
  if (typeof caches === 'undefined') return 0;
  try {
    const cache = await caches.open('feedgram-images');
    const keys = await cache.keys();
    let bytes = 0;
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) bytes += (await response.clone().blob()).size;
    }
    return bytes;
  } catch { return 0; }
}

/** Import/export, storage breakdown, selective cleanup, and retention controls. */
export class DataManagement extends Component<DataManagementProps> {
  private usage = 0;
  private quota = 0;
  private sizes: Record<string, number> = {};
  private fileInput: HTMLInputElement | null = null;
  private message = '';

  componentDidMount(): void { void this.refreshUsage(); }

  private async refreshUsage(): Promise<void> {
    const [estimate, sizes, images] = await Promise.all([estimateStorage(), getIndexedStoreSizes(), imageCacheSize()]);
    this.usage = estimate.usage;
    this.quota = estimate.quota;
    this.sizes = { ...sizes, images };
    this.forceUpdate();
  }

  private handleImport = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    input.value = '';
    const result = importOPML(text);
    for (const entry of result.feeds) {
      let feedUrl = entry.url;
      try { const discovered = await discoverFeed(entry.url); if (discovered) feedUrl = discovered.feedUrl; } catch { /* preserve the original URL */ }
      await putFeed({ id: feedUrl, title: entry.title, siteUrl: entry.siteUrl, addedAt: Date.now(), kind: 'generic' });
    }
    window.location.reload();
  };

  private async clearCategory(category: 'posts' | 'articles' | 'comments' | 'images'): Promise<void> {
    const labels = { posts: 'posts and linked article/comment caches', articles: 'extracted article text', comments: 'cached comments', images: 'cached images' };
    if (!window.confirm(`Delete ${labels[category]} from this device?`)) return;
    if (category === 'images') {
      if (typeof caches !== 'undefined') await caches.delete('feedgram-images');
    } else {
      await clearIndexedStore(category);
    }
    this.message = `${labels[category]} cleared.`;
    await this.refreshUsage();
    if (category === 'posts') await this.props.onRefreshAll();
    else this.props.onReset();
  }

  private async clearAllCachedPosts(): Promise<void> {
    await clearCache();
    this.message = 'Cache cleared; refreshing feeds…';
    await this.refreshUsage();
    await this.props.onRefreshAll();
    this.message = 'Cached posts cleared; feed refresh finished.';
    this.forceUpdate();
  }

  private async runRetentionCleanup(): Promise<void> {
    const { retentionAmount, retentionUnit } = this.props;
    const multiplier = retentionUnit === 'days' ? 1 : retentionUnit === 'months' ? 30 : 365;
    const cutoff = Date.now() - Math.max(1, retentionAmount) * multiplier * 24 * 60 * 60 * 1000;
    if (!window.confirm(`Delete unsaved posts older than ${retentionAmount} ${retentionUnit}? Bookmarks will be kept.`)) return;
    const count = await deleteOldPosts(cutoff);
    this.message = `Removed ${count} old unsaved post${count === 1 ? '' : 's'}; bookmarks were kept.`;
    await this.refreshUsage();
    this.props.onReset();
  }

  render() {
    const { feeds, onReset, retentionAmount, retentionUnit, onRetentionAmount, onRetentionUnit } = this.props;
    const categories = [
      { id: 'posts' as const, label: 'Posts and linked caches', description: 'Post records plus attached article and comment data.' },
      { id: 'articles' as const, label: 'Extracted articles', description: 'Full article text extracted for reader mode.' },
      { id: 'comments' as const, label: 'Comments', description: 'Cached discussion threads for individual posts.' },
      { id: 'images' as const, label: 'Images', description: 'Cached remote images; original files remain on their source servers.' },
    ];

    return <div class="flex flex-col gap-4">
      <div class="flex flex-wrap gap-2">
        <Button icon="upload" onClick={() => this.fileInput?.click()}>Import OPML</Button>
        <Button icon="download" onClick={() => downloadTextFile('feedgram-subscriptions.opml', exportOPML(feeds), 'text/x-opml')}>Export OPML</Button>
        <Button icon="bookmark" onClick={async () => {
          const posts = await getSavedPosts();
          downloadTextFile('feedgram-bookmarks.opml', exportBookmarksOPML(posts), 'text/x-opml');
        }}>Export bookmarks OPML</Button>
        <Button icon="trash" variant="danger" onClick={() => void this.clearAllCachedPosts()}>Clear all cached posts</Button>
        <Button icon="refreshCw" variant="danger" onClick={() => {
          if (window.confirm('Reset Feedgram data and remove all authentication tokens?')) {
            void (async () => {
              await resetEverything();
              if (typeof caches !== 'undefined') await caches.delete('feedgram-images');
              onReset();
              await this.refreshUsage();
            })();
          }
        }}>Reset all</Button>
      </div>

      <input ref={(element: HTMLInputElement | null) => { this.fileInput = element; }} type="file" accept=".opml,.xml,application/xml,text/xml" class="hidden" onChange={this.handleImport} />

      <div class="rounded-xl border border-border bg-surface p-3">
        <div class="flex items-center justify-between text-sm">
          <span class="text-fg-muted">Storage used</span>
          <span class="font-semibold text-fg">{formatBytes(this.usage)}{this.quota > 0 ? ` / ${formatBytes(this.quota)}` : ''}</span>
        </div>
        <p class="mt-1 text-xs text-fg-muted">Total is the browser's origin estimate. Category figures are approximate serialized data sizes.</p>
        <div class="mt-3 divide-y divide-border">
          {categories.map((item) => <div key={item.id} class="flex items-center justify-between gap-3 py-2.5">
            <div class="min-w-0"><p class="text-sm font-medium text-fg">{item.label} <span class="text-fg-muted">· {formatBytes(this.sizes[item.id] ?? 0)}</span></p><p class="text-xs text-fg-muted">{item.description}</p></div>
            <button type="button" class="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs text-fg-muted hover:bg-surface-alt" onClick={() => void this.clearCategory(item.id)}>Delete</button>
          </div>)}
          <div class="py-2.5 text-sm text-fg-muted">Subscriptions <span class="float-right font-medium text-fg">{feeds.length}</span></div>
        </div>
      </div>

      <div class="rounded-xl border border-border bg-surface p-3">
        <h3 class="text-sm font-semibold text-fg">Delete older articles</h3>
        <p class="mt-1 text-xs text-fg-muted">Remove unsaved posts and their cached article/comments after an age threshold. Bookmarks are preserved.</p>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <Input type="number" min={1} max={999} value={String(retentionAmount)} onInput={(value) => onRetentionAmount(Math.max(1, Number(value) || 1))} />
          <Select value={retentionUnit} options={[{ value: 'days', label: 'Days' }, { value: 'months', label: 'Months' }, { value: 'years', label: 'Years' }]} onChange={(value) => onRetentionUnit(value as 'days' | 'months' | 'years')} />
          <Button variant="danger" icon="trash" onClick={() => void this.runRetentionCleanup()}>Delete now</Button>
        </div>
      </div>

      {this.message ? <p class="rounded-lg border border-upvote/40 bg-upvote/5 px-3 py-2 text-xs text-fg">{this.message}</p> : null}
      <p class="text-xs text-fg-muted">Posts, extracted article text and comments are stored in IndexedDB. Image cache is separate. Clearing cache keeps subscriptions; Reset all also removes account sessions.</p>
    </div>;
  }
}
