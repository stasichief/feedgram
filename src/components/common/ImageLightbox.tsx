import { Component } from 'inferno';
import { Icon } from './Icon';
import { ICONS } from './icons';

export interface ImageLightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

/**
 * Full-screen image viewer used for thumbnails and article images.
 * Closes on backdrop click, the close button or Escape.
 */
export class ImageLightbox extends Component<ImageLightboxProps> {
  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') this.props.onClose();
  };

  componentDidMount(): void {
    document.addEventListener('keydown', this.onKeyDown);
    document.body.style.overflow = 'hidden';
  }

  componentWillUnmount(): void {
    document.removeEventListener('keydown', this.onKeyDown);
    document.body.style.overflow = '';
  }

  render() {
    const { src, alt, onClose } = this.props;

    return (
      <div
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
        role="dialog"
        aria-modal="true"
        aria-label={alt ? `Image preview: ${alt}` : 'Image preview'}
        onClick={onClose}
      >
        <button
          type="button"
          class="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
          onClick={(event: Event) => {
            event.stopPropagation();
            onClose();
          }}
          aria-label="Close image preview"
          title="Close"
        >
          <Icon node={ICONS.x} size={20} />
        </button>

        <img
          src={src}
          alt={alt ?? ''}
          class="max-h-[92vh] max-w-[94vw] rounded-lg object-contain shadow-2xl"
          onClick={(event: Event) => event.stopPropagation()}
        />
      </div>
    );
  }
}
