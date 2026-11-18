import { Component } from 'inferno';
import { PageHeader } from './FeedPage';
import { Button } from '../components/common/Button';
import { Icon } from '../components/common/Icon';
import { ICONS } from '../components/common/icons';
import { EmptyState } from '../components/common/Avatar';
import { Field, Input } from '../components/common/Field';
import { deleteFeedCascade, putFeed } from '../lib/db';
import { relativeTime } from '../components/Feed/PostCard';
import type { Feed } from '../lib/types';

export interface FeedsProps {
  feeds: Feed[];
  onRefresh: () => void;
  onFeedsChanged: () => void;
  loading: boolean;
}

/** Subscribed feeds list with management actions. */
export class Feeds extends Component<FeedsProps> {
  private editing: string | null = null;
  private editEndpoint = '';
  private busy = false;
  private touchStartY = 0;
  private touchStartX = 0;
  private canRefresh = false;

  private handleTouchStart = (event: TouchEvent): void => {
    const target = event.target as HTMLElement;
    this.canRefresh = window.scrollY <= 2 && !target.closest('input, textarea, select, button, a');
    this.touchStartY = event.touches[0]?.clientY ?? 0;
    this.touchStartX = event.touches[0]?.clientX ?? 0;
  };

  private handleTouchEnd = (event: TouchEvent): void => {
    const touch = event.changedTouches[0];
    const dy = touch ? touch.clientY - this.touchStartY : 0;
    const dx = touch ? touch.clientX - this.touchStartX : 0;
    if (this.canRefresh && dy > 76 && dy > Math.abs(dx) * 1.25) this.props.onRefresh();
    this.canRefresh = false;
  };

  private async removeFeed(feed: Feed): Promise<void> {
    this.busy = true;
    this.forceUpdate();
    await deleteFeedCascade(feed.id);
    this.busy = false;
    this.forceUpdate();
    this.props.onFeedsChanged();
  }

  private async saveEndpoint(feed: Feed): Promise<void> {
    await putFeed({ ...feed, commentEndpoint: this.editEndpoint.trim() || undefined });
    this.editing = null;
    this.editEndpoint = '';
    this.forceUpdate();
    this.props.onFeedsChanged();
  }

  render() {
    const { feeds } = this.props;

    return (
      <div onTouchStart={this.handleTouchStart} onTouchEnd={this.handleTouchEnd}>
        <PageHeader
          title="Subscribed feeds"
          subtitle={`${feeds.length} feed${feeds.length === 1 ? '' : 's'}`}
        />

        {feeds.length === 0 ? (
          <EmptyState
            icon="rss"
            title="No subscriptions yet"
            message="Add a feed from the Subscribed page to see it listed here."
          />
        ) : (
          <ul class="mt-4 flex flex-col divide-y divide-border border-t border-border">
            {feeds.map((feed) => (
              <li key={feed.id} class="px-4 py-3">
                <div class="flex items-start gap-3">
                  {feed.icon ? (
                    <img
                      src={feed.icon}
                      alt=""
                      class="h-9 w-9 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <span class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-alt text-fg-muted">
                      <Icon node={ICONS.rss} size={17} />
                    </span>
                  )}

                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-semibold text-fg">
                      {feed.title}
                    </p>
                    <p class="truncate font-mono text-xs text-fg-muted">
                      {feed.id}
                    </p>
                    <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">
                      {feed.kind ? (
                        <span class="rounded bg-surface-alt px-1.5 py-0.5 uppercase">
                          {feed.kind}
                        </span>
                      ) : null}
                      {feed.lastFetchedAt ? (
                        <span>Synced {relativeTime(feed.lastFetchedAt)}</span>
                      ) : (
                        <span>Never synced</span>
                      )}
                      {feed.lastError ? (
                        <span class="text-downvote">{feed.lastError}</span>
                      ) : null}
                    </div>
                  </div>

                  <div class="flex shrink-0 items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="pencil"
                      title="Configure comment endpoint"
                      onClick={() => {
                        this.editing = this.editing === feed.id ? null : feed.id;
                        this.editEndpoint = feed.commentEndpoint ?? '';
                        this.forceUpdate();
                      }}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="trash"
                      title="Unsubscribe"
                      disabled={this.busy}
                      onClick={() => void this.removeFeed(feed)}
                    />
                  </div>
                </div>

                {this.editing === feed.id ? (
                  <div class="mt-3 rounded-lg border border-border bg-surface p-3">
                    <Field
                      label="Comment endpoint"
                      hint="Optional JSON endpoint that returns comments for a post. Use {id} as a placeholder for the post id."
                      htmlFor={`endpoint-${feed.id}`}
                    >
                      <Input
                        id={`endpoint-${feed.id}`}
                        value={this.editEndpoint}
                        mono
                        placeholder="https://example.com/api/comments/{id}"
                        onInput={(value) => {
                          this.editEndpoint = value;
                        }}
                      />
                    </Field>
                    <div class="mt-2.5 flex gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => void this.saveEndpoint(feed)}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          this.editing = null;
                          this.forceUpdate();
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
}
