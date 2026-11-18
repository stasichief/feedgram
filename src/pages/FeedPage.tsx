import { Component } from 'inferno';
import { SortBar } from '../components/Feed/SortBar';
import { PostCard } from '../components/Feed/PostCard';
import { LoadingState, ErrorState } from '../components/Feed/PostList';
import { EmptyState } from '../components/common/Avatar';
import { Button } from '../components/common/Button';
import { Icon } from '../components/common/Icon';
import { ICONS } from '../components/common/icons';
import { getFeed, getPost } from '../lib/db';
import { markRead, toggleSaved, vote } from '../lib/feeds';
import { getActiveHomeTab, savePostReturnContext } from '../lib/navigation';
import type { Feed, Post, SortMode } from '../lib/types';
import type { IconName } from '../components/common/icons';

export interface FeedPageProps {
  /** Feeds to display. */
  feeds: Feed[];
  sort: SortMode;
  onSort: (sort: SortMode) => void;
  /** Posts already collected and sorted by the caller. */
  posts: Post[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyIcon?: IconName;
  /** Header content rendered above the sort bar. */
  header?: unknown;
  showComments?: boolean;
  /** Called after a comment author is subscribed to. */
  onFeedsChanged?: () => void;
}

/**
 * Shared feed listing page.
 *
 * Handles sorting, opening a post on its own page, voting and bookmarking.
 */
export class FeedPage extends Component<FeedPageProps> {
  /** Local overrides so votes and bookmarks update instantly. */
  private overrides = new Map<
    string,
    Partial<Pick<Post, 'vote' | 'saved' | 'read'>>
  >();

  private openPost(post: Post, event: MouseEvent): void {
    void markRead(post.id, true);
    this.overrides.set(post.id, { ...this.overrides.get(post.id), read: true });

    if (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey &&
      !event.defaultPrevented
    ) {
      savePostReturnContext(
        window.location.hash,
        getActiveHomeTab() ?? 'subscribed',
        window.scrollY,
      );
    }
  }

  private async handleVote(post: Post, direction: -1 | 1): Promise<void> {
    await vote(post.id, direction);
    const current = post.vote;
    const next: -1 | 0 | 1 = current === direction ? 0 : direction;
    this.overrides.set(post.id, { ...this.overrides.get(post.id), vote: next });
    this.forceUpdate();
  }

  private async handleSave(post: Post): Promise<void> {
    const saved = await toggleSaved(post.id);
    this.overrides.set(post.id, { ...this.overrides.get(post.id), saved });
    this.forceUpdate();
  }

  render() {
    const {
      feeds,
      sort,
      onSort,
      posts,
      loading,
      error,
      onRetry,
      emptyTitle,
      emptyMessage,
      emptyIcon,
      header,
      showComments = true,
    } = this.props;

    const feedTitles = new Map(feeds.map((feed) => [feed.id, feed.title]));

    const cards = posts.map((post) => {
      const feed = feeds.find((entry) => entry.id === post.feedId);
      const override = this.overrides.get(post.id);
      return {
        id: post.id,
        title: post.title,
        url: post.url,
        excerpt: post.excerpt,
        publishedAt: post.publishedAt,
        feedTitle: feedTitles.get(post.feedId) ?? 'Unknown feed',
        feedId: post.feedId,
        feedIcon: feed?.icon,
        thumbnail: post.thumbnail,
        score: post.score,
        commentCount: post.commentCount,
        vote: override?.vote ?? post.vote,
        saved: override?.saved ?? post.saved,
        read: override?.read ?? post.read,
        expanded: false,
        onOpenPost: (event: MouseEvent) => this.openPost(post, event),
        onVote: (direction: -1 | 1) => void this.handleVote(post, direction),
        onToggleSave: () => void this.handleSave(post),
        hasComments:
          showComments &&
          Boolean(
            feed &&
              (feed.kind === 'mastodon' ||
                feed.kind === 'lemmy' ||
                feed.commentEndpoint),
          ),
        commentsOpen: false,
      };
    });

    return (
      <div>
        {header as never}

        <SortBar sort={sort} onSort={onSort} />

        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} />
        ) : cards.length === 0 ? (
          <EmptyState
            icon={emptyIcon ?? 'inbox'}
            title={emptyTitle ?? 'Nothing here yet'}
            message={emptyMessage}
          />
        ) : (
          <div class="flex flex-col">
            {cards.map((card) => (
              <div key={card.id} data-post-id={card.id}>
                <PostCard {...card} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
}

/** Reads a post from the database; used by the standalone post route. */
export async function loadPostById(id: string): Promise<Post | undefined> {
  return getPost(id);
}

export async function loadFeedById(id: string): Promise<Feed | undefined> {
  return getFeed(id);
}

/** Small header used by the page titles. */
export function PageHeader(props: {
  title: string;
  subtitle?: string;
  action?: unknown;
}) {
  return (
    <div class="flex flex-wrap items-center justify-between gap-3 px-4 pt-5">
      <div>
        <h1 class="text-xl font-bold text-fg">{props.title}</h1>
        {props.subtitle ? (
          <p class="mt-0.5 text-sm text-fg-muted">{props.subtitle}</p>
        ) : null}
      </div>
      {props.action as never}
    </div>
  );
}

/** Icon-only refresh button used in page headers. */
export function RefreshButton(props: { onClick: () => void; busy?: boolean }) {
  return (
    <Button
      icon={props.busy ? 'loader' : 'refreshCw'}
      size="sm"
      onClick={props.onClick}
      title="Refresh feeds"
    >
      {props.busy ? 'Syncing' : 'Refresh'}
    </Button>
  );
}

/** Inline notice used when the app is offline. */
export function OfflineNotice() {
  return (
    <div class="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg-muted">
      <Icon node={ICONS.wifiOff} size={15} />
      You are offline — showing cached posts.
    </div>
  );
}
