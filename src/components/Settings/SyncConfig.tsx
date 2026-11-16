import { Component } from 'inferno';
import { Button } from '../common/Button';
import { Field, Input, Toggle } from '../common/Field';
import { POLL_INTERVALS } from '../../styles/themes';

export interface SyncConfigProps {
  pollIntervalMinutes: number;
  backgroundSync: boolean;
  exploreFeedUrls: string[];
  onPollInterval: (minutes: number) => void;
  onBackgroundSync: (enabled: boolean) => void;
  onExploreUrls: (urls: string[]) => void;
  /**
   * Removes an explore source from the configured URLs. When
   * `deleteCachedPosts` is true the feed record and its cached posts,
   * articles and comments are deleted as well.
   */
  onRemoveExploreUrl: (url: string, deleteCachedPosts: boolean) => void;
}

const LABELS: Record<number, string> = {
  5: '5m',
  15: '15m',
  30: '30m',
  60: '1h',
};

/** Sync and fetching configuration. */
export class SyncConfig extends Component<SyncConfigProps> {
  private newUrl = '';
  /** URL awaiting the removal confirmation, if any. */
  private pendingRemove: string | null = null;
  /** Whether the pending removal should also drop cached posts. */
  private deleteCachedPosts = true;

  render() {
    const {
      pollIntervalMinutes,
      backgroundSync,
      exploreFeedUrls,
      onPollInterval,
      onBackgroundSync,
      onExploreUrls,
      onRemoveExploreUrl,
    } = this.props;

    const addUrl = () => {
      const value = this.newUrl.trim();
      if (!value) return;
      if (!/^https?:\/\//i.test(value)) return;
      if (exploreFeedUrls.includes(value)) {
        this.newUrl = '';
        this.forceUpdate();
        return;
      }
      onExploreUrls([...exploreFeedUrls, value]);
      this.newUrl = '';
    };

    const requestRemove = (url: string) => {
      this.pendingRemove = url;
      this.deleteCachedPosts = true;
      this.forceUpdate();
    };

    const cancelRemove = () => {
      this.pendingRemove = null;
      this.forceUpdate();
    };

    const confirmRemove = () => {
      const url = this.pendingRemove;
      if (!url) return;
      const deleteCachedPosts = this.deleteCachedPosts;
      this.pendingRemove = null;
      this.forceUpdate();
      onRemoveExploreUrl(url, deleteCachedPosts);
    };

    return (
      <div class="flex flex-col gap-5">
        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium text-fg">Poll interval</span>
          <div class="flex gap-2">
            {POLL_INTERVALS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                class={[
                  'flex-1 rounded-lg border px-3 py-2 text-sm transition-colors',
                  pollIntervalMinutes === minutes
                    ? 'border-accent bg-accent/10 font-medium text-accent'
                    : 'border-border bg-surface text-fg hover:bg-surface-alt',
                ].join(' ')}
                onClick={() => onPollInterval(minutes)}
                aria-pressed={pollIntervalMinutes === minutes ? 'true' : 'false'}
              >
                {LABELS[minutes]}
              </button>
            ))}
          </div>
          <p class="text-xs text-fg-muted">
            Foreground polling only runs while the app is open and visible.
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium text-fg">Background sync</span>
          <Toggle
            checked={backgroundSync}
            onChange={onBackgroundSync}
            label="Allow the service worker to schedule background refreshes"
          />
          <p class="text-xs text-fg-muted">
            Conservative by design: at most one pending sync, never more often
            than twice the poll interval, three attempts maximum, and it pauses
            automatically on data-saver or 2G connections.
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium text-fg">Explore feed URLs</span>
          <div class="flex flex-col gap-1.5">
            {exploreFeedUrls.length === 0 ? (
              <p class="text-xs text-fg-muted">No explore feeds configured.</p>
            ) : (
              exploreFeedUrls.map((url) => (
                <div
                  key={url}
                  class="rounded-lg border border-border bg-surface px-2.5 py-1.5"
                >
                  <div class="flex items-center gap-2">
                    <span class="min-w-0 flex-1 truncate font-mono text-xs text-fg">
                      {url}
                    </span>
                    {this.pendingRemove === url ? null : (
                      <button
                        type="button"
                        class="shrink-0 rounded px-1.5 py-0.5 text-xs text-fg-muted hover:bg-surface-alt hover:text-downvote"
                        onClick={() => requestRemove(url)}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {this.pendingRemove === url ? (
                    <div class="mt-2 border-t border-border pt-2">
                      <p class="text-xs text-fg">Remove this explore source?</p>
                      <label class="mt-1.5 flex cursor-pointer items-start gap-2 text-xs text-fg-muted">
                        <input
                          type="checkbox"
                          class="mt-0.5 h-3.5 w-3.5 shrink-0 accent-accent"
                          checked={this.deleteCachedPosts}
                          onChange={(event: Event) => {
                            this.deleteCachedPosts = (
                              event.target as HTMLInputElement
                            ).checked;
                            this.forceUpdate();
                          }}
                        />
                        <span>
                          Also delete its cached posts, articles and comments.
                        </span>
                      </label>
                      <div class="mt-2 flex flex-wrap gap-2">
                        <Button size="sm" variant="danger" onClick={confirmRemove}>
                          {this.deleteCachedPosts
                            ? 'Remove and delete posts'
                            : 'Remove only'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelRemove}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <div class="flex items-end gap-2">
            <div class="flex-1">
              <Field label="Add a feed URL" htmlFor="explore-url">
                <Input
                  id="explore-url"
                  value={this.newUrl}
                  mono
                  placeholder="https://bearblog.dev/discover/feed/"
                  onInput={(value) => {
                    this.newUrl = value;
                  }}
                />
              </Field>
            </div>
            <Button icon="plus" onClick={addUrl}>
              Add
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
