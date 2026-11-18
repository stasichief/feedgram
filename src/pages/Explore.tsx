import { Component } from 'inferno';
import { FeedPage, PageHeader, RefreshButton } from './FeedPage';
import { Button } from '../components/common/Button';
import { Icon } from '../components/common/Icon';
import { ICONS } from '../components/common/icons';
import { Field, Input, Select } from '../components/common/Field';
import { addFeed } from '../lib/feeds';
import { SOURCE_HINTS, SOURCE_LABELS } from '../lib/sources';
import { getSettings, updateSettings } from '../lib/settings';
import type { Feed, FeedSource, Post, SortMode } from '../lib/types';

export interface ExploreProps {
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

/**
 * Explore — discovery sources added by the user.
 * These feeds are not persisted as subscriptions; they are fetched on demand.
 */
export class Explore extends Component<ExploreProps> {
  private url = '';
  private source: FeedSource = 'default';
  private busy = false;
  private message = '';
  private error = '';

  componentDidMount(): void {
    // Load the explore feeds the first time the page is opened.
    if (this.props.feeds.length === 0 && this.props.posts.length === 0) {
      this.props.onRefresh();
    }
  }

  private async addExploreFeed(): Promise<void> {
    const input = this.url.trim();
    if (!input) return;

    this.busy = true;
    this.error = '';
    this.message = '';
    this.forceUpdate();

    try {
      const { feed, added } = await addFeed(input, this.source, { explore: true });

      const exploreFeedUrls = getSettings().exploreFeedUrls;
      if (!exploreFeedUrls.includes(feed.id)) {
        updateSettings({ exploreFeedUrls: [...exploreFeedUrls, feed.id] });
      }

      this.message = added
        ? `Added ${feed.title} to the explore list.`
        : `${feed.title} is already in the explore list.`;
      this.url = '';
      this.props.onFeedsChanged();
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Could not add that feed.';
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
        emptyTitle="Nothing to explore yet"
        emptyMessage="Add a discovery source to see recommended posts from across the web."
        emptyIcon="compass"
        showComments={showComments}
        header={
          <div>
            <PageHeader
              title="Explore"
              subtitle="Discovery sources from around the web"
              action={<RefreshButton onClick={onRefresh} busy={loading} />}
            />

            <div class="mx-4 mt-4 rounded-xl border border-border bg-surface p-4">
              <div class="flex flex-wrap items-end gap-2">
                <div class="min-w-[16rem] flex-1">
                  <Field
                    label="Add an explore source"
                    hint={SOURCE_HINTS[this.source]}
                    htmlFor="explore-add-url"
                  >
                    <Input
                      id="explore-add-url"
                      value={this.url}
                      mono
                      placeholder={
                        this.source === 'default'
                          ? 'https://example.com/discover/feed'
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
                  <Field label="Source" htmlFor="explore-add-source">
                    <Select
                      id="explore-add-source"
                      value={this.source}
                      options={SOURCE_OPTIONS}
                      onChange={(value) => {
                        this.source = value as FeedSource;
                        this.forceUpdate();
                      }}
                    />
                  </Field>
                </div>
                <Button
                  variant="primary"
                  icon="plus"
                  disabled={this.busy}
                  onClick={() => void this.addExploreFeed()}
                >
                  {this.busy ? 'Adding…' : 'Add'}
                </Button>
              </div>

              {this.error ? (
                <p class="mt-2 rounded-lg border border-downvote/40 bg-downvote/5 px-3 py-2 text-xs text-fg">
                  {this.error}
                </p>
              ) : null}
              {this.message ? (
                <p class="mt-2 flex items-center gap-1.5 rounded-lg border border-upvote/40 bg-upvote/5 px-3 py-2 text-xs text-fg">
                  <Icon node={ICONS.circleCheck} size={13} />
                  {this.message}
                </p>
              ) : null}
            </div>
          </div>
        }
      />
    );
  }
}
