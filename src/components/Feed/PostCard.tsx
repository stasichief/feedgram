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
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

export interface PostCardProps {
  id: string;
  title: string;
  url: string;
  excerpt: string;
  publishedAt: number;
  feedTitle: string;
  feedId: string;
  feedIcon?: string;
  author?: string;
  authorAvatar?: string;
  showAuthorAvatar?: boolean;
  images?: string[];
  inline?: boolean;
  thumbnail?: string;
  score?: number;
  commentCount?: number;
  vote: -1 | 0 | 1;
  saved: boolean;
  read: boolean;
  expanded: boolean;
  onOpenPost: (event: MouseEvent) => void;
  onVote: (direction: -1 | 1) => void;
  onToggleSave: () => void;
  commentsOpen?: boolean;
  hasComments: boolean;
}

/** Compact card with full short-form posts and native-style media actions. */
export class PostCard extends Component<PostCardProps> {
  private lightbox: string | null = null;
  private imageIndex = 0;

  private async shareOriginal(): Promise<void> {
    const url = this.props.url;
    if (!url) return;
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    try {
      if (nav.share) await nav.share({ title: this.props.title, url });
      else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
    } catch {
      // A dismissed share sheet is not an application error.
    }
  }

  render() {
    const {
      title, url, excerpt, publishedAt, feedTitle, feedIcon, author, authorAvatar,
      showAuthorAvatar = true, images = [], inline = false, thumbnail, score,
      commentCount, vote, saved, read, expanded, onOpenPost, onVote,
      onToggleSave, commentsOpen, hasComments,
    } = this.props;
    const domain = domainOf(url);
    const isShort = excerpt.trim().split(/\s+/).filter(Boolean).length <= 200;
    const media = images.length ? images : (thumbnail ? [thumbnail] : []);
    const currentImage = media.length ? media[this.imageIndex % media.length] : undefined;

    return (
      <article class={[
        'border-b border-border bg-surface transition-colors',
        expanded ? 'bg-surface' : 'hover:bg-surface/70',
      ].join(' ')}>
        <div class="flex gap-2.5 px-3 py-3 sm:px-4">
          <div class="flex w-8 shrink-0 flex-col items-center gap-0.5 pt-0.5">
            <button type="button" class={['rounded p-0.5 transition-colors', vote === 1 ? 'text-upvote' : 'text-fg-muted hover:text-upvote'].join(' ')} onClick={() => onVote(1)} aria-label="Upvote" title="Upvote">
              <Icon node={ICONS.chevronUp} size={20} strokeWidth={2.5} />
            </button>
            <span class={['text-xs font-semibold tabular-nums', vote === 1 ? 'text-upvote' : vote === -1 ? 'text-downvote' : 'text-fg-muted'].join(' ')}>
              {score ?? (vote === 0 ? '–' : vote === 1 ? '1' : '-1')}
            </span>
            <button type="button" class={['rounded p-0.5 transition-colors', vote === -1 ? 'text-downvote' : 'text-fg-muted hover:text-downvote'].join(' ')} onClick={() => onVote(-1)} aria-label="Downvote" title="Downvote">
              <Icon node={ICONS.chevronDown} size={20} strokeWidth={2.5} />
            </button>
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-start gap-3">
              <div class="min-w-0 flex-1">
                {!inline ? <a href={`#/post/${encodeURIComponent(this.props.id)}`} onClick={onOpenPost}
                  class={['block text-left text-[0.95rem] font-semibold leading-snug hover:text-accent', read ? 'text-fg-muted' : 'text-fg'].join(' ')} title={title}>{title}</a> : null}
                <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">
                  {showAuthorAvatar && author && authorAvatar ? <img src={authorAvatar} alt="" width={20} height={20} class="h-5 w-5 shrink-0 rounded-sm object-cover" loading="lazy" /> : null}
                  {author ? <span class="font-semibold" style={{ color: 'var(--author-color)' }}>{author}</span> : null}
                  {author ? <span aria-hidden="true">·</span> : null}
                  {feedIcon ? <img src={feedIcon} alt="" width={14} height={14} class="h-3.5 w-3.5 shrink-0 rounded-sm object-cover" loading="lazy" /> : null}
                  <span class="font-medium" style={{ color: 'var(--source-color)' }}>{feedTitle}</span>
                  {domain ? <><span aria-hidden="true">·</span><span class="max-w-[16rem] truncate" style={{ color: 'var(--source-color)' }}>{domain}</span></> : null}
                  <span aria-hidden="true">·</span><span>{relativeTime(publishedAt)}</span>
                  {commentCount ? <><span aria-hidden="true">·</span><span class="inline-flex items-center gap-1"><Icon node={ICONS.messageCircle} size={12} />{commentCount}</span></> : null}
                </div>
              </div>
              {!inline && currentImage ? <button type="button" class="shrink-0 overflow-hidden rounded-md" onClick={() => { this.lightbox = currentImage; this.forceUpdate(); }} title="View image" aria-label="View image"><img src={currentImage} alt="" loading="lazy" class="h-16 w-16 object-cover sm:h-20 sm:w-20" /></button> : null}
            </div>

            {!expanded && excerpt ? <p class={[
              'mt-2 whitespace-pre-wrap text-sm leading-relaxed',
              inline || isShort ? 'text-fg' : 'line-clamp-2 text-fg-muted',
            ].join(' ')}>{excerpt}</p> : null}

            {inline && currentImage ? <div class="relative mt-2 overflow-hidden rounded-xl border border-border bg-bg">
              <button type="button" class="block w-full" onClick={() => { this.lightbox = currentImage; this.forceUpdate(); }} aria-label="View post image">
                <img src={currentImage} alt="" loading="lazy" class="max-h-[34rem] w-full object-cover" />
              </button>
              {media.length > 1 ? <div class="absolute inset-x-0 bottom-2 flex items-center justify-between px-3">
                <button type="button" class="rounded-full bg-black/70 px-3 py-1 text-sm text-white" aria-label="Previous image" onClick={() => { this.imageIndex = (this.imageIndex - 1 + media.length) % media.length; this.forceUpdate(); }}>‹</button>
                <span class="rounded-full bg-black/70 px-2 py-1 text-xs text-white">{(this.imageIndex % media.length) + 1} / {media.length}</span>
                <button type="button" class="rounded-full bg-black/70 px-3 py-1 text-sm text-white" aria-label="Next image" onClick={() => { this.imageIndex = (this.imageIndex + 1) % media.length; this.forceUpdate(); }}>›</button>
              </div> : null}
            </div> : null}

            <div class="mt-2 flex flex-wrap items-center gap-1 text-xs text-fg-muted">
              <a href={`#/post/${encodeURIComponent(this.props.id)}`} onClick={onOpenPost} class={['inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-surface-alt hover:text-fg', expanded ? 'font-medium text-accent' : ''].join(' ')}>
                <Icon node={ICONS.bookOpen} size={13} />{inline || isShort ? 'Open post' : 'Read article'}
              </a>
              {url ? <a href={url} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-surface-alt hover:text-fg"><Icon node={ICONS.externalLink} size={13} />Original</a> : null}
              {url ? <button type="button" class="inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-surface-alt hover:text-fg" onClick={() => void this.shareOriginal()} title="Share original link"><Icon node={ICONS.share} size={13} />Share</button> : null}
              <button type="button" class={['inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-surface-alt hover:text-fg', saved ? 'text-accent' : ''].join(' ')} onClick={onToggleSave} title={saved ? 'Remove bookmark' : 'Bookmark'}>
                <Icon node={saved ? ICONS.bookmarkCheck : ICONS.bookmark} size={13} />{saved ? 'Saved' : 'Save'}
              </button>
              {hasComments ? <a href={`#/post/${encodeURIComponent(this.props.id)}`} onClick={onOpenPost} class={['inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-surface-alt hover:text-fg', expanded && commentsOpen ? 'text-accent' : ''].join(' ')} title={expanded && commentsOpen ? 'Collapse comments' : 'Show comments'}><Icon node={ICONS.messageCircle} size={13} />Comments</a> : null}
            </div>
          </div>
        </div>
        {this.lightbox ? <ImageLightbox src={this.lightbox} onClose={() => { this.lightbox = null; this.forceUpdate(); }} /> : null}
      </article>
    );
  }
}
