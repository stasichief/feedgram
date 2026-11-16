import { Component } from 'inferno';
import { SortBar } from '../components/Feed/SortBar';
import { PostCard } from '../components/Feed/PostCard';
import { LoadingState, ErrorState } from '../components/Feed/PostList';
import { PostDetail } from '../components/Feed/PostDetail';
import { CommentsPanel } from '../components/Feed/CommentsPanel';
import { EmptyState } from '../components/common/Avatar';
import { Button } from '../components/common/Button';
import { Icon } from '../components/common/Icon';
import { ICONS } from '../components/common/icons';
import { getFeed, getPost, getFeed as findFeed } from '../lib/db';
import { markRead, toggleSaved, vote } from '../lib/feeds';
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
 * Handles sorting, expansion of a post into the full article, voting,
 * bookmarking and the comments panel.
 */
export class FeedPage extends Component<FeedPageProps> {
  private expandedId: string | null = null;
  private expandedPost: Post | null = null;
  private expandedFeed: Feed | null = null;
  private commentsOpen = true;
  private touchStartX = 0;
  private touchStartY = 0;

  /** Local overrides so votes and bookmarks update instantly. */
  private overrides = new Map<
    string,
    Partial<Pick<Post, 'vote' | 'saved' | 'read'>>
  >();

  private async toggleExpand(post: Post): Promise<void> {
    if (this.expandedId === post.id) {
      this.expandedId = null;
      this.expandedPost = null;
      this.expandedFeed = null;
      this.commentsOpen = true;
      this.forceUpdate();
      return;
    }

    this.expandedId = post.id;
    this.expandedPost = post;
    this.commentsOpen = true;
    this.expandedFeed = (await findFeed(post.feedId)) ?? null;
    this.forceUpdate();

    void markRead(post.id, true);
    this.overrides.set(post.id, { ...this.overrides.get(post.id), read: true });

    // Keep the expanded card in view instead of jumping to the bottom of the list.
    requestAnimationFrame(() => {
      const nodes = document.querySelectorAll('[data-post-id]');
      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i] as HTMLElement;
        if (node.getAttribute('data-post-id') === post.id) {
          node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          break;
        }
      }
    });
  }

  private collapseExpanded(): void {
    this.expandedId = null;
    this.expandedPost = null;
    this.expandedFeed = null;
    this.commentsOpen = true;
    this.forceUpdate();
  }
  private async toggleComments(post: Post): Promise<void> {
    if (this.expandedId === post.id) {
      this.commentsOpen = !this.commentsOpen;
      this.forceUpdate();
      return;
    }
    this.expandedId = post.id;
    this.expandedPost = post;
    this.commentsOpen = true;
    this.expandedFeed = (await findFeed(post.feedId)) ?? null;
    this.forceUpdate();
    void markRead(post.id, true);
    this.overrides.set(post.id, { ...this.overrides.get(post.id), read: true });
  }
  private onArticleTouchStart = (event: TouchEvent): void => {
    const touch = event.touches[0];
    if (!touch) return;
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
  };
  private onArticleTouchEnd = (event: TouchEvent): void => {
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - this.touchStartX;
    const dy = touch.clientY - this.touchStartY;
    if (dx < -60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      event.stopPropagation();
      this.collapseExpanded();
    }
  };
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
        expanded: this.expandedId === post.id,
        onToggleExpand: () => void this.toggleExpand(post),
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
        commentsOpen: this.expandedId === post.id && this.commentsOpen,
        onToggleComments: () => void this.toggleComments(post),
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

                {/* The article opens directly underneath its own card. */}
                {card.expanded && this.expandedPost ? (
                  <div onTouchStart={this.onArticleTouchStart} onTouchEnd={this.onArticleTouchEnd}>
                    <PostDetail
                      postId={card.id}
                      url={card.url}
                      title={card.title}
                      contentHtml={this.expandedPost.contentHtml}
                      inline={this.expandedPost.inline}
                      onClose={() => this.collapseExpanded()}
                    />
                    {showComments && this.expandedFeed && this.commentsOpen ? (
                      <CommentsPanel
                        postId={card.id}
                        postUrl={card.url}
                        remoteId={this.expandedPost.remoteId}
                        feed={this.expandedFeed}
                        onFeedsChanged={this.props.onFeedsChanged}
                        onCollapse={() => { this.commentsOpen = false; this.forceUpdate(); }}
                      />
                    ) : null}
                  </div>
                ) : null}
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
