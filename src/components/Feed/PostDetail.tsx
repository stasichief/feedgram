import { Component } from 'inferno';
import { Icon } from '../common/Icon';
import { ICONS } from '../common/icons';
import { Button } from '../common/Button';
import { ImageLightbox } from '../common/ImageLightbox';
import { loadArticle } from '../../lib/readability';
import type { Article } from '../../lib/types';

export interface PostDetailProps {
  postId: string;
  url: string;
  title: string;
  /** Optional pre-rendered content from the feed itself. */
  contentHtml?: string;
  /** When true, `contentHtml` is complete and no extraction is attempted. */
  inline?: boolean;
  /** Card thumbnail / media attachment, shown when the body HTML omits it. */
  thumbnail?: string;
  onClose: () => void;
}

/**
 * Renders the full article inline, underneath the post card.
 * The extracted article is cached in IndexedDB for offline reading.
 */
export class PostDetail extends Component<PostDetailProps> {
  private article: Article | null = null;
  private loading = false;
  private error: string | null = null;
  private mounted = false;
  /** Article image opened in the lightbox. */
  private lightbox: string | null = null;
  /** Touch origin for the “swipe left to collapse” gesture. */
  private touchStartX = 0;
  private touchStartY = 0;
  private trackingTouch = false;

  componentDidMount(): void {
    this.mounted = true;
    void this.load();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private onTouchStart = (event: TouchEvent): void => {
    if (event.touches.length !== 1) {
      this.trackingTouch = false;
      return;
    }
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
    this.trackingTouch = true;
  };

  private onTouchEnd = (event: TouchEvent): void => {
    if (!this.trackingTouch || event.changedTouches.length !== 1) {
      this.trackingTouch = false;
      return;
    }
    const touch = event.changedTouches[0];
    const dx = touch.clientX - this.touchStartX;
    const dy = touch.clientY - this.touchStartY;
    this.trackingTouch = false;

    // Left swipe: mostly horizontal, far enough to not fight vertical scroll.
    if (dx < -72 && Math.abs(dx) > Math.abs(dy) * 1.6) {
      this.props.onClose();
    }
  };

  componentDidUpdate(previousProps: PostDetailProps): void {
    if (previousProps.postId !== this.props.postId) {
      this.article = null;
      this.error = null;
      void this.load();
    }
  }

  private async load(): Promise<void> {
    if (this.loading) return;

    // Social sources ship the complete post body; there is nothing to extract.
    if (this.props.inline && this.props.contentHtml) {
      this.loading = false;
      this.error = null;
      this.forceUpdate();
      return;
    }

    this.loading = true;
    this.error = null;

    try {
      const article = await loadArticle(
        this.props.postId,
        this.props.url,
        this.props.title,
      );
      if (!this.mounted) return;
      this.article = article;
    } catch (error) {
      if (!this.mounted) return;
      this.error =
        error instanceof Error ? error.message : 'Could not load the article.';
    } finally {
      if (this.mounted) {
        this.loading = false;
        this.forceUpdate();
      }
    }
  }

  render() {
    const { url, title, contentHtml, onClose, thumbnail } = this.props;
    const { article, loading, error } = this;

    const body = article?.html ?? contentHtml;
    const showThumb =
      Boolean(thumbnail) &&
      /^https?:/i.test(thumbnail ?? '') &&
      !(body && thumbnail && body.includes(thumbnail));

    return (
      <section
        class="fade-in border-t border-border bg-bg px-3 py-4 sm:px-5"
        onTouchStart={this.onTouchStart}
        onTouchEnd={this.onTouchEnd}
        onTouchCancel={() => {
          this.trackingTouch = false;
        }}
      >
        <div class="mx-auto max-w-[var(--content-width)]">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h2 class="truncate text-sm font-semibold text-fg">{title}</h2>
            <div class="flex shrink-0 items-center gap-1.5">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-fg hover:bg-surface-alt"
              >
                <Icon node={ICONS.externalLink} size={13} />
                Open original
              </a>
              <Button
                icon="x"
                size="sm"
                variant="ghost"
                onClick={onClose}
                title="Collapse article"
              >
                Close
              </Button>
            </div>
          </div>

          {showThumb ? (
            <button
              type="button"
              class="mb-4 block w-full overflow-hidden rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              onClick={() => {
                this.lightbox = thumbnail ?? null;
                this.forceUpdate();
              }}
              title="View image"
              aria-label="View image"
            >
              <img
                src={thumbnail}
                alt=""
                class="max-h-[32rem] w-full object-contain"
                loading="lazy"
              />
            </button>
          ) : null}

          {loading ? (
            <div class="flex items-center gap-2 py-8 text-sm text-fg-muted">
              <Icon node={ICONS.loader} size={16} className="spin" />
              Extracting article…
            </div>
          ) : error ? (
            <div class="rounded-lg border border-downvote/40 bg-downvote/5 p-3">
              <p class="text-sm text-fg">{error}</p>
              <div class="mt-2">
                <Button size="sm" icon="refreshCw" onClick={() => void this.load()}>
                  Retry
                </Button>
              </div>
            </div>
          ) : body ? (
            <div
              class="article-body text-fg"
              onClick={(event: Event) => {
                const target = event.target as HTMLElement | null;
                if (!target || target.tagName !== 'IMG') return;
                const image = target as HTMLImageElement;
                const src = image.currentSrc || image.src;
                if (!src) return;
                this.lightbox = src;
                this.forceUpdate();
              }}
              dangerouslySetInnerHTML={{ __html: body }}
            />
          ) : (
            <p class="py-6 text-sm text-fg-muted">
              The full article could not be extracted from this page.
            </p>
          )}

          {article ? (
            <p class="mt-5 text-xs text-fg-muted">
              {article.byline ? `${article.byline} · ` : ''}
              {Math.max(1, Math.round(article.length / 1000))}k characters
              {article.siteName ? ` · ${article.siteName}` : ''}
            </p>
          ) : null}
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
      </section>
    );
  }
}
