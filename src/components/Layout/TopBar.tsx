import { Component } from 'inferno';
import { Link } from 'inferno-router';
import { Icon } from '../common/Icon';
import { ICONS } from '../common/icons';

/**
 * Top bar — spans the full width like Lemmy.
 * Contains the brand, the global search field and the create-post action.
 */
export interface TopBarProps {
  onToggleSidebar: () => void;
  onSearch: (query: string) => void;
  searchQuery: string;
  onCreate: () => void;
  canCreate: boolean;
  syncing?: boolean;
}

export class TopBar extends Component<TopBarProps> {
  render() {
    const {
      onToggleSidebar,
      onSearch,
      searchQuery,
      onCreate,
      canCreate,
      syncing,
    } = this.props;

    return (
      <header class="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
        <div class="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-3 sm:px-4">
          <button
            type="button"
            class="lg:hidden -ml-1 inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg hover:bg-surface-alt"
            onClick={onToggleSidebar}
            aria-label="Open navigation"
          >
            <Icon node={ICONS.menu} size={20} />
          </button>

          <Link
            to="/"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            class="flex items-center gap-2 shrink-0 font-bold tracking-tight text-fg"
          >
            <span class="text-accent">
              <Icon node={ICONS.rss} size={20} />
            </span>
            <span class="hidden sm:inline">feedgram</span>
          </Link>

          <div class="relative flex-1 max-w-xl">
            <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted">
              <Icon node={ICONS.search} size={16} />
            </span>
            <input
              type="search"
              value={searchQuery}
              placeholder="Search posts, or paste a feed URL…"
              class={[
                'w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3',
                'text-sm text-fg outline-none placeholder:text-fg-muted',
                'focus:border-accent focus:ring-2 focus:ring-accent/30',
              ].join(' ')}
              onInput={(event: Event) =>
                onSearch((event.target as HTMLInputElement).value)
              }
              onKeyDown={(event: KeyboardEvent) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                }
              }}
            />
          </div>

          {syncing ? (
            <span class="hidden sm:inline-flex items-center text-fg-muted">
              <Icon node={ICONS.loader} size={16} className="spin" />
            </span>
          ) : null}

          <button
            type="button"
            class={[
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium',
              canCreate
                ? 'bg-accent text-accent-contrast hover:opacity-90'
                : 'bg-surface text-fg-muted border border-border',
            ].join(' ')}
            onClick={onCreate}
            title={canCreate ? 'Create a post' : 'Sign in to create a post'}
          >
            <Icon node={ICONS.plus} size={16} />
            <span class="hidden sm:inline">Create</span>
          </button>
        </div>
      </header>
    );
  }
}
