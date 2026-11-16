import { Component } from 'inferno';
import { Icon } from '../common/Icon';
import { ICONS } from '../common/icons';
import { Button } from '../common/Button';
import { PostCard, type PostCardProps } from './PostCard';
import { EmptyState } from '../common/Avatar';
import type { IconName } from '../common/icons';

export interface PostListProps {
  posts: PostCardProps[];
  emptyTitle?: string;
  emptyMessage?: string;
  emptyIcon?: IconName;
}

/** Renders a list of post cards. */
export class PostList extends Component<PostListProps> {
  render() {
    const { posts, emptyTitle, emptyMessage, emptyIcon } = this.props;

    if (posts.length === 0) {
      return (
        <EmptyState
          icon={emptyIcon ?? 'inbox'}
          title={emptyTitle ?? 'Nothing here yet'}
          message={emptyMessage}
        />
      );
    }

    return (
      <div class="flex flex-col">
        {posts.map((post) => (
          <PostCard key={post.id ?? post.url} {...post} />
        ))}
      </div>
    );
  }
}

/** Inline loading indicator used while a feed is fetched. */
export class LoadingState extends Component<{ label?: string }> {
  render() {
    const { label = 'Loading…' } = this.props;
    return (
      <div class="flex items-center justify-center gap-2 py-16 text-fg-muted">
        <Icon node={ICONS.loader} size={18} className="spin" />
        <span class="text-sm">{label}</span>
      </div>
    );
  }
}

/** Error banner with a retry affordance. */
export class ErrorState extends Component<{
  message: string;
  onRetry?: () => void;
}> {
  render() {
    const { message, onRetry } = this.props;
    return (
      <div class="m-4 rounded-xl border border-downvote/40 bg-downvote/5 p-4">
        <p class="flex items-center gap-2 text-sm font-medium text-fg">
          <span class="text-downvote">
            <Icon node={ICONS.wifiOff} size={16} />
          </span>
          {message}
        </p>
        {onRetry ? (
          <div class="mt-3">
            <Button icon="refreshCw" onClick={onRetry} size="sm">
              Try again
            </Button>
          </div>
        ) : null}
      </div>
    );
  }
}
