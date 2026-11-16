import { Component } from 'inferno';
import { Icon } from '../common/Icon';
import { ICONS } from '../common/icons';
import { loadComments, resolveCommentSource } from '../../lib/comments';
import { addFeed } from '../../lib/feeds';
import type { Comment, Feed, FeedSource } from '../../lib/types';
import { relativeTime } from './PostCard';

export interface CommentsPanelProps {
  postId: string;
  postUrl: string;
  remoteId?: string;
  feed: Feed;
  /** Called after subscribing to a comment author's feed. */
  onFeedsChanged?: () => void;
  /** Hides the panel; used by the post card's comments toggle. */
  onCollapse?: () => void;
}

interface CommentNode {
  comment: Comment;
  children: CommentNode[];
}

/** Builds a tree from the flat, depth-annotated comment list. */
function buildTree(comments: Comment[]): CommentNode[] {
  const roots: CommentNode[] = [];
  const stack: CommentNode[] = [];

  for (const comment of comments) {
    const node: CommentNode = { comment, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].comment.depth >= comment.depth) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  return roots;
}

/** Maps a feed kind to the source adapter used for author subscriptions. */
function sourceForFeed(feed: Feed): FeedSource {
  switch (feed.kind) {
    case 'lemmy':
      return 'lemmy';
    case 'bluesky':
      return 'bluesky';
    case 'mastodon':
    case 'activitypub':
      return 'activitypub';
    default:
      return 'default';
  }
}

/**
 * Comments panel.
 *
 * The endpoint is resolved automatically for Mastodon and Lemmy feeds, and can
 * be configured per feed for other platforms. When no endpoint is available
 * the panel is not rendered at all.
 */
export class CommentsPanel extends Component<CommentsPanelProps> {
  private comments: Comment[] = [];
  private loading = false;
  private loaded = false;
  private mounted = false;
  private subscribing: string | null = null;
  private notice = '';

  componentDidMount(): void {
    this.mounted = true;
    void this.load();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  componentDidUpdate(previousProps: CommentsPanelProps): void {
    if (previousProps.postId !== this.props.postId) {
      this.comments = [];
      this.loaded = false;
      void this.load();
    }
  }

  private async load(): Promise<void> {
    if (this.loading || this.loaded) return;

    const { postId, postUrl, remoteId, feed } = this.props;
    const availability = resolveCommentSource(feed, { url: postUrl, remoteId });
    if (availability.source === 'none') return;

    this.loading = true;
    this.forceUpdate();

    try {
      const comments = await loadComments(postId, feed, { url: postUrl, remoteId });
      if (!this.mounted) return;
      this.comments = comments;
    } finally {
      if (this.mounted) {
        this.loading = false;
        this.loaded = true;
        this.forceUpdate();
      }
    }
  }

  private async subscribe(comment: Comment): Promise<void> {
    const url = comment.authorUrl;
    if (!url || this.subscribing) return;

    this.subscribing = comment.id;
    this.notice = '';
    this.forceUpdate();

    try {
      const { feed, added } = await addFeed(url, sourceForFeed(this.props.feed));
      this.notice = added
        ? `Subscribed to ${feed.title}.`
        : `Already subscribed to ${feed.title}.`;
      this.props.onFeedsChanged?.();
    } catch (error) {
      this.notice =
        error instanceof Error ? error.message : 'Could not subscribe to that author.';
    } finally {
      this.subscribing = null;
      this.forceUpdate();
    }
  }

  private renderNode(node: CommentNode): unknown {
    const { comment } = node;

    return (
      <div
        key={comment.id}
        class={comment.depth > 0 ? 'ml-4 border-l border-border pl-3' : ''}
      >
        <div class="py-2">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span class="font-semibold text-fg">{comment.author}</span>
            {comment.authorUrl ? (
              <button
                type="button"
                class="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] text-accent hover:bg-accent/10 disabled:opacity-50"
                onClick={() => void this.subscribe(comment)}
                disabled={this.subscribing === comment.id}
                title={`Subscribe to ${comment.author}'s feed`}
              >
                <Icon node={ICONS.plus} size={10} />
                {this.subscribing === comment.id ? 'Subscribing…' : 'Subscribe'}
              </button>
            ) : null}
            {comment.createdAt ? (
              <span class="text-fg-muted">{relativeTime(comment.createdAt)}</span>
            ) : null}
            {typeof comment.score === 'number' ? (
              <span class="text-fg-muted">· {comment.score} points</span>
            ) : null}
          </div>
          {comment.body ? (
            <p class="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-fg">
              {comment.body}
            </p>
          ) : null}
        </div>
        {node.children.map((child) => this.renderNode(child))}
      </div>
    );
  }

  render() {
    const { postUrl, remoteId, feed, onCollapse } = this.props;
    const availability = resolveCommentSource(feed, { url: postUrl, remoteId });

    if (availability.source === 'none') return null;

    const tree = buildTree(this.comments);

    return (
      <section class="border-t border-border bg-surface px-3 py-4 sm:px-5">
        <div class="mx-auto max-w-[var(--content-width)]">
          <div class="mb-2 flex items-center justify-between gap-2">
            <h3 class="flex items-center gap-2 text-sm font-semibold text-fg">
              <Icon node={ICONS.messageCircle} size={15} />
              Comments
              <span class="text-xs font-normal text-fg-muted">
                via {availability.label}
              </span>
            </h3>
            {onCollapse ? (
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-fg-muted hover:bg-surface-alt hover:text-fg"
                onClick={onCollapse}
                title="Collapse comments"
              >
                <Icon node={ICONS.chevronUp} size={13} />
                Hide
              </button>
            ) : null}
          </div>

          {this.notice ? (
            <p class="mb-2 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-fg">
              {this.notice}
            </p>
          ) : null}

          {this.loading ? (
            <div class="flex items-center gap-2 py-4 text-sm text-fg-muted">
              <Icon node={ICONS.loader} size={15} className="spin" />
              Loading comments…
            </div>
          ) : tree.length === 0 ? (
            <p class="text-sm text-fg-muted">No comments yet.</p>
          ) : (
            <div class="divide-y divide-border/60">{tree.map((node) => this.renderNode(node))}</div>
          )}
        </div>
      </section>
    );
  }
}
