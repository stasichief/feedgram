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
import { getSettings } from '../lib/settings';
import type { Feed, Post, SortMode } from '../lib/types';
import type { IconName } from '../components/common/icons';

export interface FeedPageProps {
  feeds: Feed[];
  sort: SortMode;
  onSort: (sort: SortMode) => void;
  posts: Post[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onRefresh?: () => void;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyIcon?: IconName;
  header?: unknown;
  showComments?: boolean;
  showAuthorAvatars?: boolean;
  onFeedsChanged?: () => void;
}

/** Shared feed listing page with native-style actions and pull-to-refresh. */
export class FeedPage extends Component<FeedPageProps> {
  private overrides = new Map<string, Partial<Pick<Post, 'vote' | 'saved' | 'read'>>>();
  private touchStartY = 0;
  private touchStartX = 0;
  private canPullToRefresh = false;
  private mouseStartX = 0;
  private mouseStartY = 0;
  private canMousePullToRefresh = false;
  private pullDistance = 0;

  componentDidMount(): void {
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
  }

  componentWillUnmount(): void {
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
  }

  private openPost(post: Post, event: MouseEvent): void {
    void markRead(post.id, true);
    this.overrides.set(post.id, { ...this.overrides.get(post.id), read: true });
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.defaultPrevented) {
      savePostReturnContext(window.location.hash, getActiveHomeTab() ?? 'subscribed', window.scrollY);
    }
  }

  private handleTouchStart = (event: TouchEvent): void => {
    const target = event.target as HTMLElement;
    this.canPullToRefresh = window.scrollY <= 2 && !target.closest('input, textarea, select, button, a, [data-no-refresh]');
    this.touchStartY = event.touches[0]?.clientY ?? 0;
    this.touchStartX = event.touches[0]?.clientX ?? 0;
  };

  private handleTouchEnd = (event: TouchEvent): void => {
    if (!this.canPullToRefresh) return;
    const touch = event.changedTouches[0];
    const dy = touch ? touch.clientY - this.touchStartY : 0;
    const dx = touch ? touch.clientX - this.touchStartX : 0;
    this.canPullToRefresh = false;
    if (dy > 76 && dy > Math.abs(dx) * 1.25) this.props.onRefresh?.();
  };

  private handleMouseDown = (event: MouseEvent): void => {
    const target = event.target as Element;
    this.canMousePullToRefresh = event.button === 0 && window.scrollY <= 2 && Boolean(this.props.onRefresh) &&
      !target.closest('input, textarea, select, button, a, [data-no-refresh]');
    if (!this.canMousePullToRefresh) return;
    this.mouseStartX = event.clientX;
    this.mouseStartY = event.clientY;
  };

  private handleMouseMove = (event: MouseEvent): void => {
    if (!this.canMousePullToRefresh || (event.buttons & 1) === 0) return;
    const distance = event.clientY - this.mouseStartY;
    if (distance <= 0) return;
    if (distance > 8) event.preventDefault();
    const next = Math.min(96, distance);
    if (Math.abs(next - this.pullDistance) > 3) {
      this.pullDistance = next;
      this.forceUpdate();
    }
  };

  private handleMouseUp = (event: MouseEvent): void => {
    if (!this.canMousePullToRefresh) return;
    const dy = event.clientY - this.mouseStartY;
    const dx = event.clientX - this.mouseStartX;
    this.canMousePullToRefresh = false;
    const shouldRefresh = dy > 76 && dy > Math.abs(dx) * 1.25;
    this.pullDistance = 0;
    this.forceUpdate();
    if (shouldRefresh) this.props.onRefresh?.();
  };

  private async handleVote(post: Post, direction: -1 | 1): Promise<void> {
    await vote(post.id, direction);
    const next: -1 | 0 | 1 = post.vote === direction ? 0 : direction;
    this.overrides.set(post.id, { ...this.overrides.get(post.id), vote: next });
    this.forceUpdate();
  }

  private async handleSave(post: Post): Promise<void> {
    const saved = await toggleSaved(post.id);
    this.overrides.set(post.id, { ...this.overrides.get(post.id), saved });
    this.forceUpdate();
  }

  render() {
    const { feeds, sort, onSort, posts, loading, error, onRetry, emptyTitle, emptyMessage,
      emptyIcon, header, showComments = true } = this.props;
    const showAuthorAvatars = getSettings().showAuthorAvatars;
    const feedTitles = new Map(feeds.map((feed) => [feed.id, feed.title]));
    const cards = posts.map((post) => {
      const feed = feeds.find((entry) => entry.id === post.feedId);
      const override = this.overrides.get(post.id);
      return {
        id: post.id, title: post.title, url: post.url, excerpt: post.excerpt,
        publishedAt: post.publishedAt, feedTitle: feedTitles.get(post.feedId) ?? 'Unknown feed',
        feedId: post.feedId, feedIcon: feed?.icon, author: post.author,
        authorAvatar: post.authorAvatar, showAuthorAvatar: showAuthorAvatars,
        images: post.images, inline: post.inline, thumbnail: post.thumbnail,
        score: post.score, commentCount: post.commentCount,
        vote: override?.vote ?? post.vote, saved: override?.saved ?? post.saved,
        read: override?.read ?? post.read, expanded: false,
        onOpenPost: (event: MouseEvent) => this.openPost(post, event),
        onVote: (direction: -1 | 1) => void this.handleVote(post, direction),
        onToggleSave: () => void this.handleSave(post),
        hasComments: showComments && Boolean(feed && (feed.kind === 'mastodon' || feed.kind === 'lemmy' || feed.commentEndpoint)),
        commentsOpen: false,
      };
    });

    return <div class={this.pullDistance > 8 ? 'select-none' : ''} onTouchStart={this.handleTouchStart} onTouchEnd={this.handleTouchEnd} onMouseDown={this.handleMouseDown}>
      {this.pullDistance > 20 ? <div role="status" class="pointer-events-none fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-fg shadow-lg">{this.pullDistance >= 76 ? 'Release to refresh' : 'Pull down to refresh'}</div> : null}
      {header as never}
      <SortBar sort={sort} onSort={onSort} />
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={onRetry} /> : cards.length === 0 ? (
        <EmptyState icon={emptyIcon ?? 'inbox'} title={emptyTitle ?? 'Nothing here yet'} message={emptyMessage} />
      ) : <div class="flex flex-col">{cards.map((card) => <div key={card.id} data-post-id={card.id}><PostCard {...card} /></div>)}</div>}
    </div>;
  }
}

export async function loadPostById(id: string): Promise<Post | undefined> { return getPost(id); }
export async function loadFeedById(id: string): Promise<Feed | undefined> { return getFeed(id); }

export function PageHeader(props: { title: string; subtitle?: string; action?: unknown }) {
  return <div class="flex flex-wrap items-center justify-between gap-3 px-4 pt-5">
    <div><h1 class="text-xl font-bold text-fg">{props.title}</h1>{props.subtitle ? <p class="mt-0.5 text-sm text-fg-muted">{props.subtitle}</p> : null}</div>
    {props.action as never}
  </div>;
}

/** Retained for retry/error actions; routine refresh is performed by pulling down at the top. */
export function RefreshButton(props: { onClick: () => void; busy?: boolean }) {
  return <Button icon={props.busy ? 'loader' : 'refreshCw'} size="sm" onClick={props.onClick} title="Refresh feeds">{props.busy ? 'Syncing' : 'Refresh'}</Button>;
}

export function OfflineNotice() {
  return <div class="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg-muted"><Icon node={ICONS.wifiOff} size={15} />You are offline — showing cached posts.</div>;
}
