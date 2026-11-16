import { Component } from 'inferno';
import { Icon } from '../common/Icon';
import { ICONS } from '../common/icons';

export interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  children?: unknown;
}

/** Slide-over navigation used on small screens. */
export class MobileDrawer extends Component<MobileDrawerProps> {
  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') this.props.onClose();
  };

  componentDidMount(): void {
    document.addEventListener('keydown', this.onKeyDown);
  }

  componentWillUnmount(): void {
    document.removeEventListener('keydown', this.onKeyDown);
  }

  componentDidUpdate(): void {
    document.body.style.overflow = this.props.open ? 'hidden' : '';
  }

  componentWillUnmountCleanup(): void {
    document.body.style.overflow = '';
  }

  render() {
    const { open, onClose, children } = this.props;

    return (
      <div
        class={[
          'fixed inset-0 z-50 lg:hidden',
          open ? 'pointer-events-auto' : 'pointer-events-none',
        ].join(' ')}
        aria-hidden={open ? undefined : 'true'}
      >
        <div
          class={[
            'absolute inset-0 bg-black/40 transition-opacity duration-200',
            open ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          onClick={onClose}
        />

        <div
          class={[
            'absolute inset-y-0 left-0 flex w-[17rem] max-w-[85vw] flex-col',
            'border-r border-border bg-bg shadow-xl transition-transform duration-200',
            open ? 'translate-x-0' : '-translate-x-full',
          ].join(' ')}
          role="dialog"
          aria-modal={open ? 'true' : undefined}
          aria-label="Navigation"
        >
          <div class="flex items-center justify-between border-b border-border px-3 py-2.5">
            <span class="flex items-center gap-2 font-bold text-fg">
              <span class="text-accent">
                <Icon node={ICONS.rss} size={18} />
              </span>
              feedgram
            </span>
            <button
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg hover:bg-surface-alt"
              onClick={onClose}
              aria-label="Close navigation"
            >
              <Icon node={ICONS.x} size={18} />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto">{children as never}</div>
        </div>
      </div>
    );
  }
}
