import { Component } from 'inferno';
import { Button } from '../common/Button';
import { clearCache, estimateStorage, resetEverything } from '../../lib/db';
import { downloadTextFile, exportOPML } from '../../lib/opml';
import type { Feed } from '../../lib/types';

export interface DataManagementProps {
  feeds: Feed[];
  onReset: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

/** Import / export OPML, cache clearing and storage usage. */
export class DataManagement extends Component<DataManagementProps> {
  private usage = 0;
  private quota = 0;
  private fileInput: HTMLInputElement | null = null;

  componentDidMount(): void {
    void this.refreshUsage();
  }

  private async refreshUsage(): Promise<void> {
    const estimate = await estimateStorage();
    this.usage = estimate.usage;
    this.quota = estimate.quota;
    this.forceUpdate();
  }

  private handleImport = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const text = await file.text();
    input.value = '';

    const { importOPML } = await import('../../lib/opml');
    const { discoverFeed } = await import('../../lib/feed-discovery');
    const { getDB, putFeed } = await import('../../lib/db');

    const result = importOPML(text);
    const db = await getDB();

    for (const entry of result.feeds) {
      let feedUrl = entry.url;
      try {
        const discovered = await discoverFeed(entry.url);
        if (discovered) feedUrl = discovered.feedUrl;
      } catch {
        /* keep the original URL */
      }

      await putFeed({
        id: feedUrl,
        title: entry.title,
        siteUrl: entry.siteUrl,
        addedAt: Date.now(),
        kind: 'generic',
      });
    }

    void db;
    window.location.reload();
  };

  render() {
    const { feeds, onReset } = this.props;

    return (
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap gap-2">
          <Button
            icon="upload"
            onClick={() => this.fileInput?.click()}
          >
            Import OPML
          </Button>
          <Button
            icon="download"
            onClick={() => {
              downloadTextFile(
                'feedgram-subscriptions.opml',
                exportOPML(feeds),
                'text/x-opml',
              );
            }}
          >
            Export OPML
          </Button>
          <Button
            icon="trash"
            variant="danger"
            onClick={() => {
              void clearCache().then(() => this.refreshUsage());
            }}
          >
            Clear cache
          </Button>
          <Button
            icon="refreshCw"
            variant="danger"
            onClick={() => {
              void resetEverything().then(onReset);
            }}
          >
            Reset all
          </Button>
        </div>

        <input
          ref={(element: HTMLInputElement | null) => {
            this.fileInput = element;
          }}
          type="file"
          accept=".opml,.xml,application/xml,text/xml"
          class="hidden"
          onChange={this.handleImport}
        />

        <div class="rounded-lg border border-border bg-surface px-3 py-2.5">
          <div class="flex items-center justify-between text-sm">
            <span class="text-fg-muted">Storage used</span>
            <span class="font-medium text-fg">
              {formatBytes(this.usage)}
              {this.quota > 0 ? ` / ${formatBytes(this.quota)}` : ''}
            </span>
          </div>
          <div class="mt-2 flex items-center justify-between text-sm">
            <span class="text-fg-muted">Subscriptions</span>
            <span class="font-medium text-fg">{feeds.length}</span>
          </div>
        </div>

        <p class="text-xs text-fg-muted">
          Clearing the cache removes cached posts and extracted articles but
          keeps your subscriptions. Reset all removes everything, including
          authentication tokens.
        </p>
      </div>
    );
  }
}
