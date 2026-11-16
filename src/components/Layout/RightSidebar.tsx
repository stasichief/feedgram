import { Component } from 'inferno';
import { Link } from 'inferno-router';
import { Icon } from '../common/Icon';
import { ICONS } from '../common/icons';
import type { TrendingEntry } from '../../lib/types';

export interface RightSidebarProps {
  trending: TrendingEntry[];
  feedCount: number;
  postCount: number;
  siteUrl: string;
}

/**
 * Right sidebar — trending feeds and site information.
 * On mobile this content is moved into the navigation drawer.
 */
export class RightSidebar extends Component<RightSidebarProps> {
  render() {
    const { trending, feedCount, postCount, siteUrl } = this.props;

    return (
      <aside class="flex flex-col gap-4 p-3" aria-label="Sidebar">
        <section class="rounded-xl border border-border bg-surface p-3.5">
          <h2 class="mb-2.5 flex items-center gap-2 text-sm font-semibold text-fg">
            <span class="text-accent">
              <Icon node={ICONS.trendingUp} size={16} />
            </span>
            Trending feeds
          </h2>

          {trending.length === 0 ? (
            <p class="text-sm text-fg-muted">
              Nothing trending yet — subscribe to a few feeds to see activity.
            </p>
          ) : (
            <ol class="flex flex-col gap-1.5">
              {trending.map((entry, index) => (
                <li key={entry.feedId}>
                  <Link
                    to={`/explore?feed=${encodeURIComponent(entry.feedId)}`}
                    class="flex items-start gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-surface-alt"
                  >
                    <span class="mt-0.5 w-4 shrink-0 text-right text-xs text-fg-muted">
                      {index + 1}.
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-fg">{entry.title}</span>
                    </span>
                    <span class="shrink-0 text-xs text-fg-muted">
                      {entry.score}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section class="rounded-xl border border-border bg-surface p-3.5">
          <h2 class="mb-2 flex items-center gap-2 text-sm font-semibold text-fg">
            <span class="text-accent">
              <Icon node={ICONS.info} size={16} />
            </span>
            Site info
          </h2>
          <p class="text-sm leading-relaxed text-fg-muted">
            feedgram is a longform RSS reader for the fediverse. Subscribe to
            feeds, read full articles inline, and publish from one place.
          </p>
          <dl class="mt-3 flex flex-col gap-1.5 text-sm">
            <div class="flex items-center justify-between gap-2">
              <dt class="text-fg-muted">Feeds</dt>
              <dd class="font-medium text-fg">{feedCount}</dd>
            </div>
            <div class="flex items-center justify-between gap-2">
              <dt class="text-fg-muted">Posts cached</dt>
              <dd class="font-medium text-fg">{postCount}</dd>
            </div>
            {siteUrl ? (
              <div class="flex items-center justify-between gap-2">
                <dt class="text-fg-muted">Hosted at</dt>
                <dd class="max-w-[9rem] truncate font-medium text-fg">
                  {siteUrl}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      </aside>
    );
  }
}
