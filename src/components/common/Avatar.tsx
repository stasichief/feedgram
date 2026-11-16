import { Component } from 'inferno';
import { Icon } from './Icon';
import { ICONS } from './icons';

export interface AvatarProps {
  name?: string;
  src?: string;
  size?: number;
  onClick?: (event: MouseEvent) => void;
  title?: string;
  /** Renders a person icon instead of initials when no name is known. */
  fallbackIcon?: boolean;
}

/** Renders an avatar circle with the user's initials as a fallback. */
export class Avatar extends Component<AvatarProps> {
  private initials(): string {
    const name = (this.props.name ?? '').trim();
    if (!name) return '';

    const parts = name.split(/[\s@._-]+/).filter(Boolean);
    if (parts.length === 0) return '';

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  render() {
    const { name, src, size = 32, onClick, title, fallbackIcon } = this.props;
    const dimension = `${size}px`;
    const initials = this.initials();

    const style = {
      width: dimension,
      height: dimension,
      fontSize: `${Math.round(size * 0.4)}px`,
    };

    if (src) {
      return (
        <img
          src={src}
          alt={name ?? 'Avatar'}
          title={title ?? name}
          class="rounded-full object-cover bg-surface-alt shrink-0"
          style={style}
          onClick={onClick}
        />
      );
    }

    if (!initials && fallbackIcon) {
      return (
        <span
          class="rounded-full bg-surface-alt text-fg-muted inline-flex items-center justify-center shrink-0"
          style={style}
          onClick={onClick}
          title={title ?? name ?? 'Account'}
          role={onClick ? 'button' : undefined}
        >
          <Icon node={ICONS.user} size={Math.round(size * 0.55)} />
        </span>
      );
    }

    return (
      <span
        class="rounded-full bg-accent text-accent-contrast inline-flex items-center justify-center font-semibold shrink-0 select-none"
        style={style}
        onClick={onClick}
        title={title ?? name}
        role={onClick ? 'button' : undefined}
      >
        {initials || '?'}
      </span>
    );
  }
}

export interface EmptyStateProps {
  icon?: keyof typeof ICONS;
  title: string;
  message?: string;
  action?: unknown;
}

export class EmptyState extends Component<EmptyStateProps> {
  render() {
    const { icon, title, message, action } = this.props;
    return (
      <div class="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
        {icon ? (
          <span class="text-fg-muted opacity-60">
            <Icon node={ICONS[icon]} size={36} />
          </span>
        ) : null}
        <div>
          <p class="font-semibold text-fg">{title}</p>
          {message ? (
            <p class="text-sm text-fg-muted mt-1 max-w-sm">{message}</p>
          ) : null}
        </div>
        {action as never}
      </div>
    );
  }
}
