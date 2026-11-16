import { Component } from 'inferno';
import type { SortMode } from '../../lib/types';

export interface SortBarProps {
  sort: SortMode;
  onSort: (sort: SortMode) => void;
  counts?: Partial<Record<SortMode, number>>;
}

const SORTS: Array<{ value: SortMode; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'new', label: 'New' },
  { value: 'hot', label: 'Hot' },
  { value: 'top', label: 'Top' },
];

/** Sort tabs, mirroring Lemmy's listing controls. */
export class SortBar extends Component<SortBarProps> {
  render() {
    const { sort, onSort, counts } = this.props;

    return (
      <div
        class="sticky top-14 z-20 flex items-center gap-1 border-b border-border bg-bg/95 px-2.5 py-2 backdrop-blur sm:px-4"
        role="tablist"
        aria-label="Sort posts"
      >
        {SORTS.map((option) => {
          const active = sort === option.value;
          const count = counts?.[option.value];
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active ? 'true' : 'false'}
              class={[
                'rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-accent text-accent-contrast'
                  : 'text-fg-muted hover:bg-surface-alt hover:text-fg',
              ].join(' ')}
              onClick={() => onSort(option.value)}
            >
              {option.label}
              {typeof count === 'number' ? (
                <span class="ml-1.5 text-xs opacity-70">{count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }
}
