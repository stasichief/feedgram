import { Component } from 'inferno';
import { Icon } from './Icon';
import { ICONS, type IconName } from './icons';

export interface ButtonProps {
  onClick?: (event: MouseEvent) => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: IconName;
  disabled?: boolean;
  type?: 'button' | 'submit';
  title?: string;
  active?: boolean;
  children?: unknown;
  className?: string;
  full?: boolean;
}

const VARIANTS: Record<string, string> = {
  primary:
    'bg-accent text-accent-contrast hover:opacity-90 border border-transparent',
  secondary:
    'bg-surface text-fg border border-border hover:bg-surface-alt',
  ghost: 'bg-transparent text-fg border border-transparent hover:bg-surface-alt',
  danger: 'bg-transparent text-downvote border border-downvote/40 hover:bg-downvote/10',
};

export class Button extends Component<ButtonProps> {
  render() {
    const {
      onClick,
      variant = 'secondary',
      size = 'md',
      icon,
      disabled,
      type = 'button',
      title,
      active,
      children,
      className,
      full,
    } = this.props;

    const classes = [
      'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
      'transition-colors select-none whitespace-nowrap',
      size === 'sm' ? 'px-2.5 py-1.5 text-sm' : 'px-3.5 py-2 text-sm',
      VARIANTS[variant] ?? VARIANTS.secondary,
      active ? 'ring-2 ring-accent/50' : '',
      full ? 'w-full' : '',
      disabled ? 'opacity-50 pointer-events-none' : '',
      className ?? '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        type={type}
        class={classes}
        onClick={onClick}
        disabled={disabled}
        title={title}
        aria-pressed={active ? 'true' : undefined}
      >
        {icon ? <Icon node={ICONS[icon]} size={size === 'sm' ? 14 : 16} /> : null}
        {children as never}
      </button>
    );
  }
}
