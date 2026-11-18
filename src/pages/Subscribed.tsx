import { Component } from 'inferno';
import { FeedPage, PageHeader, RefreshButton } from './FeedPage';
import { Button } from '../components/common/Button';
import { Icon } from '../components/common/Icon';
import { ICONS } from '../components/common/icons';
import { Field, Input, Select } from '../components/common/Field';
import { addFeed } from '../lib/feeds';
import { SOURCE_HINTS, SOURCE_LABELS } from '../lib/sources';
import type { Feed, FeedSource, Post, SortMode } from '../lib/types';

export interface SubscribedProps {
  sort: SortMode;
  onSort: (sort: SortMode) => void;
  posts: Post[];
  feeds: Feed[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onFeedsChanged: () => void;
  showComments: boolean;
}

const SOURCE_OPTIONS: Array<{ value: FeedSource; label: string }> = (
  ['default', 'lemmy', 'activitypub', 'bluesky'] as FeedSource[]
).map((value) => ({ value, label: SOURCE_LABELS[value] }));

/** Subscribed feed listing — the default landing page. */
export class Subscribed extends Component<SubscribedProps> {
  private adding = false;
  private url = '';
  private source: FeedSource = 'default';
  private busy = false;
  private message = '';
  private error = '';

  private async addFeed(): Promise<void> {
    const input = this.url.trim();
    if (!input) return;

    this.busy = true;
    this.error = '';
    this.message = '';
    this.forceUpdate();

    try {
      const { feed, added } = await addFeed(input, this.source);

      this.url = '';
      this.adding = false;
      this.message = added
        ? `Subscribed to ${feed.title}.`
        : `You are already subscribed to ${feed.title}.`;
      this.props.onFeedsChanged();
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Could not subscribe to that feed.';
    } finally {
      this.busy = false;
      this.forceUpdate();
    }
  }

  render() {
    const {
      sort,
      onSort,
      posts,
      feeds,
      loading,
      error,
      onRefresh,
      showComments,
    } = this.props;

    return (
      <FeedPage
        feeds={feeds}
        sort={sort}
        onSort={onSort}
        posts={posts}
        loading={loading}
        error={error}
        onRetry={onRefresh}
        onRefresh={onRefresh}
        emptyTitle="No posts yet"
        emptyMessage="Subscribe to a feed to see posts here. Paste any site or feed URL to get started."
        emptyIcon="rss"
        showComments={showComments}
        header={
          <div>
            <PageHeader
              title="Subscribed"
              subtitle={`${feeds.length} feed${feeds.length === 1 ? '' : 's'} · ${
                posts.length
              } posts`}
              action={
                <div class="flex gap-2">
                  <RefreshButton onClick={onRefresh} busy={loading} />
                  <Button
                    variant="primary"
                    icon="plus"
                    onClick={() => {
                      this.adding = !this.adding;
                      this.forceUpdate();
                    }}
                  >
                    Add feed
                  </Button>
                </div>
              }
            />

            {this.adding ? (
              <div class="mx-4 mt-4 rounded-xl border border-border bg-surface p-4">
                <div class="flex flex-wrap items-end gap-2">
                  <div class="min-w-[16rem] flex-1">
                    <Field
                      label="Feed, community or profile URL"
                      hint={SOURCE_HINTS[this.source]}
                      htmlFor="add-feed-url"
                    >
                      <Input
                        id="add-feed-url"
                        value={this.url}
                        mono
                        placeholder={
                          this.source === 'default'
                            ? 'https://bearblog.dev/discover/feed/'
                            : this.source === 'lemmy'
                              ? 'https://lemmy.sdf.org/c/humanrights'
                              : this.source === 'activitypub'
                                ? 'https://mastodon.social/@randahl'
                                : 'https://bsky.app/profile/user.bsky.social'
                        }
                        onInput={(value) => {
                          this.url = value;
                        }}
                      />
                    </Field>
                  </div>
                  <div class="w-full sm:w-56">
                    <Field label="Source" htmlFor="add-feed-source">
                      <Select
                        id="add-feed-source"
                        value={this.source}
                        options={SOURCE_OPTIONS}
                        onChange={(value) => {
                          this.source = value as FeedSource;
                          this.forceUpdate();
                        }}
                      />
                    </Field>
                  </div>
                </div>

                <div class="mt-3 flex gap-2">
                  <Button
                    variant="primary"
                    icon="link"
                    disabled={this.busy}
                    onClick={() => void this.addFeed()}
                  >
                    {this.busy ? 'Looking up…' : 'Subscribe'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      this.adding = false;
                      this.error = '';
                      this.message = '';
                      this.forceUpdate();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Feedback stays visible whether or not the form is open. */}
            {this.error ? (
              <p class="mx-4 mt-3 rounded-lg border border-downvote/40 bg-downvote/5 px-3 py-2 text-xs text-fg">
                {this.error}
              </p>
            ) : null}
            {this.message ? (
              <p class="mx-4 mt-3 flex items-center gap-1.5 rounded-lg border border-upvote/40 bg-upvote/5 px-3 py-2 text-xs text-fg">
                <Icon node={ICONS.circleCheck} size={13} />
                {this.message}
              </p>
            ) : null}

            {feeds.length === 0 && !this.adding ? (
              <div class="mx-4 mt-4 flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-fg-muted">
                <Icon node={ICONS.info} size={15} />
                You have no subscriptions yet — add a feed to get started.
              </div>
            ) : null}
          </div>
        }
      />
    );
  }
}
