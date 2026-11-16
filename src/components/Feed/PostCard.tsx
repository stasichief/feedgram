import { Component } from 'inferno';
import { Icon } from '../common/Icon';
import { ICONS } from '../common/icons';
import { ImageLightbox } from '../common/ImageLightbox';

export function relativeTime(timestamp: number): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export interface PostCardProps {
  id: string;
  title: string;
  url: string;
  excerpt: string;
  publishedAt: number;
  feedTitle: string;
  feedId: string;
  /** Optional feed/site favicon (small square). Omitted when missing. */
  feedIcon?: string;
  thumbnail?: string;
  score?: number;
  commentCount?: number;
  vote: -1 | 0 | 1;
  saved: boolean;
  read: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onVote: (direction: -1 | 1) => void;
  onToggleSave: () => void;
  /** Toggles the comments panel for this post. */
  onToggleComments?: () => void;
  /** True while the comments panel is visible. */
  commentsOpen?: boolean;
  hasComments: boolean;
}

/**
 * Lemmy-style post card.
 * The card expands in place to show the full article.
 */
export class PostCard extends Component<PostCardProps> {
  /** Image shown in the lightbox, or null when it is closed. */
  private lightbox: string | null = null;

  render() {
    const {
      title,
      url,
      excerpt,
      publishedAt,
      feedTitle,
      feedIcon,
      thumbnail,
      score,
      commentCount,
      vote,
      saved,
      read,
      expanded,
      onToggleExpand,
      onVote,
      onToggleSave,
      onToggleComments,
      commentsOpen,
      hasComments,
    } = this.props;

    const domain = domainOf(url);

    return (
      <article
        class={[
          'border-b border-border transition-colors',
          expanded ? 'bg-surface' : 'bg-bg hover:bg-surface/60',
        ].join(' ')}
      >
        <div class="flex gap-2.5 px-2.5 py-2.5 sm:px-4">
          {/* Vote column */}
          <div class="flex w-8 shrink-0 flex-col items-center gap-0.5 pt-0.5">
            <button
              type="button"
              class={[
                'rounded p-0.5 transition-colors',
                vote === 1
                  ? 'text-upvote'
                  : 'text-fg-muted hover:text-upvote',
              ].join(' ')}
              onClick={() => onVote(1)}
              aria-label="Upvote"
              title="Upvote"
            >
              <Icon node={ICONS.chevronUp} size={20} strokeWidth={2.5} />
            </button>
            <span
              class={[
                'text-xs font-semibold tabular-nums',
                vote === 1
                  ? 'text-upvote'
                  : vote === -1
                    ? 'text-downvote'
                    : 'text-fg-muted',
              ].join(' ')}
            >
              {score ?? (vote === 0 ? '–' : vote === 1 ? '1' : '-1')}
            </span>
            <button
              type="button"
              class={[
                'rounded p-0.5 transition-colors',
                vote === -1
                  ? 'text-downvote'
                  : 'text-fg-muted hover:text-downvote',
              ].join(' ')}
              onClick={() => onVote(-1)}
              aria-label="Downvote"
              title="Downvote"
            >
              <Icon node={ICONS.chevronDown} size={20} strokeWidth={2.5} />
            </button>
          </div>

          {/* Body */}
          <div class="min-w-0 flex-1">
            <div class="flex items-start gap-3">
              <div class="min-w-0 flex-1">
                <button
                  type="button"
                  class={[
                    'block text-left text-[0.95rem] font-semibold leading-snug',
                    read ? 'text-fg-muted' : 'text-fg',
                    'hover:text-accent',
                  ].join(' ')}
                  onClick={onToggleExpand}
                  title={title}
                >
                  {title}
                </button>

                <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">
                  {feedIcon ? (
                    <img
                      src={feedIcon}
                      alt=""
                      width={14}
                      height={14}
                      class="h-3.5 w-3.5 shrink-0 rounded-sm object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <span class="font-medium text-fg-muted">{feedTitle}</span>
                  {domain ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span class="truncate max-w-[16rem]">{domain}</span>
                    </>
                  ) : null}
                  <span aria-hidden="true">·</span>
                  <span>{relativeTime(publishedAt)}</span>
                  {commentCount ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span class="inline-flex items-center gap-1">
                        <Icon node={ICONS.messageCircle} size={12} />
                        {commentCount}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>

              {thumbnail ? (
                <button
                  type="button"
                  class="shrink-0 overflow-hidden rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  onClick={() => {
                    this.lightbox = thumbnail;
                    this.forceUpdate();
                  }}
                  title="View image"
                  aria-label="View image"
                >
                  <img
                    src={thumbnail}
                    alt=""
                    loading="lazy"
                    class="h-16 w-16 object-cover transition-transform hover:scale-105 sm:h-20 sm:w-20"
                  />
                </button>
              ) : null}
            </div>

            {!expanded && excerpt ? (
              <p class="mt-1.5 line-clamp-2 text-sm leading-relaxed text-fg-muted">
                {excerpt}
              </p>
            ) : null}

            {/* Action row */}
            <div class="mt-1.5 flex items-center gap-1 text-xs text-fg-muted">
              <button
                type="button"
                class={[
                  'inline-flex items-center gap-1 rounded-md px-1.5 py-1',
                  'hover:bg-surface-alt hover:text-fg',
                  expanded ? 'text-accent font-medium' : '',
                ].join(' ')}
                onClick={onToggleExpand}
              >
                <Icon node={ICONS.bookOpen} size={13} />
                {expanded ? 'Hide article' : 'Read article'}
              </button>

              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-surface-alt hover:text-fg"
                >
                  <Icon node={ICONS.externalLink} size={13} />
                  Original
                </a>
              ) : null}

              <button
                type="button"
                class={[
                  'inline-flex items-center gap-1 rounded-md px-1.5 py-1',
                  'hover:bg-surface-alt hover:text-fg',
                  saved ? 'text-accent' : '',
                ].join(' ')}
                onClick={onToggleSave}
                title={saved ? 'Remove bookmark' : 'Bookmark'}
              >
                <Icon node={saved ? ICONS.bookmarkCheck : ICONS.bookmark} size={13} />
                {saved ? 'Saved' : 'Save'}
              </button>

              {hasComments ? (
                <button
                  type="button"
                  class={[
                    'inline-flex items-center gap-1 rounded-md px-1.5 py-1',
                    'hover:bg-surface-alt hover:text-fg',
                    expanded && commentsOpen ? 'text-accent' : '',
                  ].join(' ')}
                  onClick={onToggleComments}
                  aria-expanded={expanded && commentsOpen ? 'true' : 'false'}
                  title={
                    expanded && commentsOpen ? 'Collapse comments' : 'Show comments'
                  }
                >
                  <Icon node={ICONS.messageCircle} size={13} />
                  Comments
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {this.lightbox ? (
          <ImageLightbox
            src={this.lightbox}
            onClose={() => {
              this.lightbox = null;
              this.forceUpdate();
            }}
          />
        ) : null}
      </article>
    );
  }
}
