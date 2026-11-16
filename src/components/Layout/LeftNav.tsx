import { Component } from 'inferno';
import { NavLink } from 'inferno-router';
import { Icon } from '../common/Icon';
import { ICONS, type IconName } from '../common/icons';
import { Avatar } from '../common/Avatar';

export interface NavEntry {
  to: string;
  label: string;
  icon: IconName;
  exact?: boolean;
}

export const PRIMARY_NAV: NavEntry[] = [
  { to: '/', label: 'Home', icon: 'house', exact: true },
  { to: '/feeds', label: 'Subscribed Feeds', icon: 'rss' },
  { to: '/all', label: 'All', icon: 'globe' },
];

export interface LeftNavProps {
  accountName?: string;
  accountAvatar?: string;
  signedIn: boolean;
  onNavigate?: () => void;
  /**
   * `sidebar` pins the user block to the bottom of the pane.
   * `drawer` stacks it directly under the navigation items.
   */
  variant?: 'sidebar' | 'drawer';
}

/**
 * Left navigation pane.
 * The user circle lives here (not in the top bar), as specified.
 */
export class LeftNav extends Component<LeftNavProps> {
  render() {
    const { accountName, accountAvatar, signedIn, onNavigate, variant = 'sidebar' } =
      this.props;

    return (
      <nav
        class={[
          'flex flex-col gap-1 p-3',
          variant === 'sidebar' ? 'h-full' : '',
        ].join(' ')}
        aria-label="Main navigation"
      >
        <div class="flex flex-col gap-0.5">
          {PRIMARY_NAV.map((entry) => (
            <NavLink
              key={entry.to}
              to={entry.to}
              exact={entry.exact}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-fg hover:bg-surface-alt"
              activeClassName="bg-surface-alt font-semibold text-accent"
              onClick={onNavigate}
            >
              <Icon node={ICONS[entry.icon]} size={17} />
              <span class="truncate">{entry.label}</span>
            </NavLink>
          ))}
        </div>

        <div class="flex flex-col gap-0.5">
          <NavLink
            to="/settings"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-fg hover:bg-surface-alt"
            activeClassName="bg-surface-alt font-semibold text-accent"
            onClick={onNavigate}
          >
            <Icon node={ICONS.settings} size={17} />
            <span>Settings</span>
          </NavLink>
        </div>

        <div class={variant === 'sidebar' ? 'mt-auto pt-3' : 'mt-1'}>
          <NavLink
            to="/profile"
            className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-surface-alt"
            activeClassName="bg-surface-alt"
            onClick={onNavigate}
            title={signedIn ? accountName : 'Sign in'}
          >
            <Avatar
              name={signedIn ? accountName : undefined}
              src={accountAvatar}
              size={30}
              fallbackIcon
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium text-fg">
                {signedIn ? accountName : 'Sign in'}
              </span>
              <span class="block truncate text-xs text-fg-muted">
                {signedIn ? 'Your profile' : 'Not connected'}
              </span>
            </span>
          </NavLink>
        </div>
      </nav>
    );
  }
}
