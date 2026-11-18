import { Component } from 'inferno';
import { LeftNav } from './LeftNav';
import { RightSidebar } from './RightSidebar';
import { MobileDrawer } from './MobileDrawer';
import { TopBar } from './TopBar';
import { NavLink } from 'inferno-router';
import { Icon } from '../common/Icon';
import { ICONS } from '../common/icons';
import type { TrendingEntry } from '../../lib/types';

export interface ThreePaneProps {
  children?: unknown;
  accountName?: string;
  accountAvatar?: string;
  signedIn: boolean;
  trending: TrendingEntry[];
  feedCount: number;
  postCount: number;
  siteUrl: string;
  searchQuery: string;
  onSearch: (query: string) => void;
  onCreate: () => void;
  onToggleSidebar: () => void;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
  syncing?: boolean;
}

/**
 * Responsive three-pane layout.
 *
 * Desktop  : top bar + left nav + content + right sidebar.
 * Mobile   : single column; the left nav and the right sidebar content are
 *            moved into a hamburger drawer.
 */
export class ThreePane extends Component<ThreePaneProps> {
  render() {
    const {
      children,
      accountName,
      accountAvatar,
      signedIn,
      trending,
      feedCount,
      postCount,
      siteUrl,
      searchQuery,
      onSearch,
      onCreate,
      onToggleSidebar,
      drawerOpen,
      onCloseDrawer,
      syncing,
    } = this.props;

    const navProps = {
      accountName,
      accountAvatar,
      signedIn,
      onNavigate: onCloseDrawer,
    };

    return (
      <div class="min-h-screen bg-bg pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] text-fg lg:pb-0">
        <TopBar
          onToggleSidebar={onToggleSidebar}
          onSearch={onSearch}
          searchQuery={searchQuery}
          onCreate={onCreate}
          canCreate={signedIn}
          syncing={syncing}
        />

        <div class="mx-auto flex w-full max-w-[1600px]">
          {/* Desktop left pane */}
          <aside class="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] hidden h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px))] w-60 shrink-0 overflow-y-auto border-r border-border lg:block">
            <LeftNav {...navProps} variant="sidebar" />
          </aside>

          {/* Center pane */}
          <main class="min-w-0 flex-1 border-r border-border">
            <div class="mx-auto w-full" style="max-width: var(--content-width)">{children as never}</div>
          </main>

          {/* Desktop right pane */}
          <aside class="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] hidden h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px))] w-72 shrink-0 overflow-y-auto lg:block">
            <RightSidebar
              trending={trending}
              feedCount={feedCount}
              postCount={postCount}
              siteUrl={siteUrl}
            />
          </aside>
        </div>

        {/* Mobile drawer holds the left nav plus the right pane content */}
        <MobileDrawer open={drawerOpen} onClose={onCloseDrawer}>
          <LeftNav {...navProps} variant="drawer" />
          <div class="border-t border-border">
            <RightSidebar
              trending={trending}
              feedCount={feedCount}
              postCount={postCount}
              siteUrl={siteUrl}
            />
          </div>
        </MobileDrawer>

        <nav class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-surface/95 px-2 pt-2 pb-[env(safe-area-inset-bottom,0px)] shadow-lg backdrop-blur lg:hidden" aria-label="Quick navigation">
          {[
            { to: '/', label: 'Home', icon: 'house' as const, exact: true },
            { to: '/feeds', label: 'Feeds', icon: 'rss' as const },
            { to: '/bookmarks', label: 'Saved', icon: 'bookmark' as const },
            { to: '/settings', label: 'Settings', icon: 'settings' as const },
          ].map((entry) => <NavLink key={entry.to} to={entry.to} exact={entry.exact}
            className="flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[0.68rem] font-medium text-fg-muted"
            activeClassName="text-accent" onClick={entry.to === '/' ? () => window.scrollTo({ top: 0, behavior: 'smooth' }) : undefined}>
            <Icon node={ICONS[entry.icon]} size={19} /><span>{entry.label}</span>
          </NavLink>)}
        </nav>
      </div>
    );
  }
}
