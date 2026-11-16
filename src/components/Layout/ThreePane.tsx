import { Component } from 'inferno';
import { LeftNav } from './LeftNav';
import { RightSidebar } from './RightSidebar';
import { MobileDrawer } from './MobileDrawer';
import { TopBar } from './TopBar';
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
      <div class="min-h-screen bg-bg text-fg">
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
          <aside class="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-border lg:block">
            <LeftNav {...navProps} variant="sidebar" />
          </aside>

          {/* Center pane */}
          <main class="min-w-0 flex-1 border-r border-border">
            <div class="mx-auto w-full max-w-3xl">{children as never}</div>
          </main>

          {/* Desktop right pane */}
          <aside class="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-72 shrink-0 overflow-y-auto lg:block">
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
      </div>
    );
  }
}
