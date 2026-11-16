import { Component } from 'inferno';
import { Subscribed } from './Subscribed';
import { Explore } from './Explore';
import { FeedPage, PageHeader } from './FeedPage';
import { Button } from '../components/common/Button';
import { getSettings, updateSettings } from '../lib/settings';
import type { CustomTab, Feed, Post, SortMode } from '../lib/types';

type HomeTab = 'subscribed' | 'explore' | string;
export interface HomeProps {
  defaultTab?: 'subscribed' | 'explore';
  sort: SortMode;
  onSort: (sort: SortMode) => void;
  subscribedPosts: Post[];
  subscribedFeeds: Feed[];
  explorePosts: Post[];
  exploreFeeds: Feed[];
  loading: boolean;
  error: string;
  onRefreshSubscribed: () => void;
  onRefreshExplore: () => void;
  onFeedsChanged: () => void;
  showComments: boolean;
}
/** Home feed tabs, including persistent, user-defined subsets of Explore feeds. */
export class Home extends Component<HomeProps> {
  private activeTab: HomeTab;
  private addingTab = false;
  private tabLabel = '';
  private selectedFeedIds = new Set<string>();
  private touchStartX = 0;

  constructor(props: HomeProps) {
    super(props);
    this.activeTab = props.defaultTab ?? 'subscribed';
  }

  componentWillReceiveProps(nextProps: HomeProps): void {
    if (nextProps.defaultTab !== this.props.defaultTab) {
      this.activeTab = nextProps.defaultTab ?? 'subscribed';
    }
  }

  private selectTab(tab: HomeTab): void {
    this.activeTab = tab;
    this.addingTab = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.forceUpdate();
  }

  private onTabsTouchStart = (event: TouchEvent): void => {
    this.touchStartX = event.touches[0]?.clientX ?? 0;
  };

  private onTabsTouchEnd = (event: TouchEvent): void => {
    const end = event.changedTouches[0]?.clientX;
    if (end === undefined || !this.touchStartX) return;
    const delta = end - this.touchStartX;
    if (Math.abs(delta) < 65) return;
    const tabs = ['subscribed', 'explore', ...getSettings().customTabs.map((tab) => tab.id)];
    const current = tabs.indexOf(this.activeTab);
    const next = Math.max(0, Math.min(tabs.length - 1, current + (delta < 0 ? 1 : -1)));
    if (next !== current) this.selectTab(tabs[next]);
  };

  private saveCustomTab(): void {
    const label = this.tabLabel.trim().slice(0, 28);
    const feedIds = [...this.selectedFeedIds];
    if (!label || feedIds.length === 0) return;
    const tab: CustomTab = { id: `custom-${Date.now().toString(36)}`, label, feedIds };
    updateSettings({ customTabs: [...getSettings().customTabs, tab] });
    this.tabLabel = '';
    this.selectedFeedIds.clear();
    this.addingTab = false;
    this.selectTab(tab.id);
  }

  private renderTab(tab: { id: string; label: string }): unknown {
    const active = this.activeTab === tab.id;
    return (
      <button
        key={tab.id}
        id={`home-tab-${tab.id}`}
        type="button"
        role="tab"
        aria-selected={active ? 'true' : 'false'}
        aria-controls="home-feed-panel"
        class={[
          'whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
          active ? 'border-accent text-accent' : 'border-transparent text-fg-muted hover:text-fg',
        ].join(' ')}
        onClick={() => this.selectTab(tab.id)}
      >{tab.label}</button>
    );
  }

  render() {
    const {
      sort, onSort, subscribedPosts, subscribedFeeds, explorePosts, exploreFeeds,
      loading, error, onRefreshSubscribed, onRefreshExplore, onFeedsChanged, showComments,
    } = this.props;
    const customTabs = getSettings().customTabs;
    const activeCustomTab = customTabs.find((tab) => tab.id === this.activeTab);
    const customFeedIds = new Set(activeCustomTab?.feedIds ?? []);
    const filteredFeeds = exploreFeeds.filter((feed) => customFeedIds.has(feed.id));
    const filteredPosts = explorePosts.filter((post) => customFeedIds.has(post.feedId));
    return (
      <div onTouchStart={this.onTabsTouchStart} onTouchEnd={this.onTabsTouchEnd}>
        <div class="sticky top-14 z-10 border-b border-border bg-bg px-4 pt-3">
          <div class="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="Home feed">
            {this.renderTab({ id: 'subscribed', label: 'Subscribed' })}
            {this.renderTab({ id: 'explore', label: 'Explore' })}
            {customTabs.map((tab) => this.renderTab(tab))}
            <button
              type="button"
              class="mb-0.5 inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-fg-muted hover:bg-surface-alt hover:text-fg"
              onClick={() => { this.addingTab = !this.addingTab; this.forceUpdate(); }}
              aria-label="Add a custom filtered tab"
            >+ Add</button>
          </div>
        </div>
        {this.addingTab ? (
          <section class="mx-4 my-3 rounded-xl border border-border bg-surface p-4" aria-label="Create filtered tab">
            <h2 class="text-sm font-semibold text-fg">Create a filtered tab</h2>
            <p class="mt-1 text-xs text-fg-muted">Choose one or more sources already added in Explore.</p>
            <input
              class="mt-3 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg"
              value={this.tabLabel}
              maxLength={28}
              placeholder="Tab name, e.g. Design"
              aria-label="Tab name"
              onInput={(event: Event) => { this.tabLabel = (event.target as HTMLInputElement).value; }}
            />
            <div class="mt-3 grid gap-2 sm:grid-cols-2">
              {exploreFeeds.map((feed) => (
                <label key={feed.id} class="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-fg">
                  <input
                    type="checkbox"
                    checked={this.selectedFeedIds.has(feed.id)}
                    onChange={(event: Event) => {
                      if ((event.target as HTMLInputElement).checked) this.selectedFeedIds.add(feed.id);
                      else this.selectedFeedIds.delete(feed.id);
                      this.forceUpdate();
                    }}
                  />
                  <span class="truncate">{feed.title}</span>
                </label>
              ))}
            </div>
            {exploreFeeds.length === 0 ? <p class="mt-3 text-sm text-fg-muted">Add sources in the Explore tab first.</p> : null}
            <div class="mt-3 flex gap-2">
              <Button variant="primary" disabled={!this.tabLabel.trim() || this.selectedFeedIds.size === 0} onClick={() => this.saveCustomTab()}>Create tab</Button>
              <Button variant="ghost" onClick={() => { this.addingTab = false; this.forceUpdate(); }}>Cancel</Button>
            </div>
          </section>
        ) : null}
        <div id="home-feed-panel" role="tabpanel" aria-labelledby={`home-tab-${this.activeTab}`}>
          {this.activeTab === 'subscribed' ? (
            <Subscribed sort={sort} onSort={onSort} posts={subscribedPosts} feeds={subscribedFeeds}
              loading={loading} error={error} onRefresh={onRefreshSubscribed} onFeedsChanged={onFeedsChanged} showComments={showComments} />
          ) : this.activeTab === 'explore' ? (
            <Explore sort={sort} onSort={onSort} posts={explorePosts} feeds={exploreFeeds}
              loading={loading} error={error} onRefresh={onRefreshExplore} onFeedsChanged={onFeedsChanged} showComments={showComments} />
          ) : activeCustomTab ? (
            <FeedPage feeds={filteredFeeds} sort={sort} onSort={onSort} posts={filteredPosts}
              loading={loading} error={error} onRetry={onRefreshExplore} onFeedsChanged={onFeedsChanged} showComments={showComments}
              header={<PageHeader title={activeCustomTab.label} subtitle={`${filteredFeeds.length} Explore source${filteredFeeds.length === 1 ? '' : 's'}`} />} />
          ) : (
            <Subscribed sort={sort} onSort={onSort} posts={subscribedPosts} feeds={subscribedFeeds}
              loading={loading} error={error} onRefresh={onRefreshSubscribed} onFeedsChanged={onFeedsChanged} showComments={showComments} />
          )}
        </div>
      </div>
    );
  }
}
