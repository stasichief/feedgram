import { Component } from 'inferno';
import { HashRouter, Route, Switch } from 'inferno-router';
import { ThreePane } from './components/Layout/ThreePane';
import { Home } from './pages/Home';
import { All } from './pages/All';
import { Bookmarks } from './pages/Bookmarks';
import { Feeds } from './pages/Feeds';
import { Settings } from './pages/Settings';
import { Profile } from './pages/Profile';
import { Create } from './pages/Create';
import { PostPage } from './pages/PostPage';
import { AuthCallback } from './pages/AuthCallback';
import { isNativeApp } from './lib/platform';
import { getAllFeeds, getAuthSessions } from './lib/db';
import {
  collectPosts,
  computeTrending,
  ensureExploreFeeds,
  fetchFeed,
} from './lib/feeds';
import { getSettings, settingsStore, updateSettings } from './lib/settings';
import {
  requestBackgroundSync,
  runSync,
  startForegroundPolling,
  stopForegroundPolling,
} from './lib/sync';
import { applyTheme } from './styles/themes';
import type {
  AuthSession,
  Feed,
  Post,
  SortMode,
  TrendingEntry,
} from './lib/types';

interface AppState {
  feeds: Feed[];
  posts: Post[];
  trending: TrendingEntry[];
  sessions: AuthSession[];
  sort: SortMode;
  loading: boolean;
  error: string;
  drawerOpen: boolean;
  searchQuery: string;
  /** True while an OAuth provider is redirecting back to the app. */
  oauthCallback: boolean;
  oauthCallbackSearch: string;
}

/**
 * Root application component.
 *
 * Holds the shared state (feeds, posts, sessions, sort mode) and wires the
 * three-pane layout to the router.
 */
export class App extends Component<Record<string, never>, AppState> {
  private unsubscribeSettings: (() => void) | null = null;
  private unlistenDeepLinks: (() => void) | null = null;
  private handledOAuthDeepLinks = new Set<string>();

  constructor(props: Record<string, never>) {
    super(props);
    this.state = {
      feeds: [],
      posts: [],
      trending: [],
      sessions: [],
      sort: 'active',
      loading: false,
      error: '',
      drawerOpen: false,
      searchQuery: '',
      oauthCallback: false,
      oauthCallbackSearch: '',
    };
  }

  /** Inferno types `state` as nullable; the app always initialises it. */
  private get s(): AppState {
    return this.state as AppState;
  }

  /**
   * OAuth providers redirect back to the site root with `code` and `state`
   * query parameters, because a redirect URI may not contain a fragment.
   */
  private detectOAuthCallback(): boolean {
    const params = new URLSearchParams(window.location.search);
    return params.has('code') && params.has('state');
  }

  componentDidMount(): void {
    this.unsubscribeSettings = settingsStore.subscribe(() => {
      this.applyTheme();
      this.forceUpdate();
    });
    this.applyTheme();

    if (this.detectOAuthCallback()) {
      this.setState({ oauthCallback: true, oauthCallbackSearch: window.location.search });
    }
    void this.listenForNativeOAuthCallbacks();

    void this.reload();
    startForegroundPolling();

    if (getSettings().backgroundSync) {
      void requestBackgroundSync();
    }
  }

  componentWillUnmount(): void {
    this.unsubscribeSettings?.();
    this.unlistenDeepLinks?.();
    stopForegroundPolling();
  }

  private async receiveNativeDeepLink(rawUrl: string): Promise<void> {
    if (this.handledOAuthDeepLinks.has(rawUrl)) return;
    try {
      const url = new URL(rawUrl);
      if (url.protocol !== 'app.feedgram.client:' || url.hostname !== 'oauth' || url.pathname !== '/callback') return;
      if (!url.searchParams.has('code') && !url.searchParams.has('error')) return;
      this.handledOAuthDeepLinks.add(rawUrl);
      this.setState({ oauthCallback: true, oauthCallbackSearch: url.search });
    } catch {
      // Ignore unrelated or malformed deep links.
    }
  }
  private async listenForNativeOAuthCallbacks(): Promise<void> {
    try {
      if (!isNativeApp()) return;
      const deepLink = await import('@tauri-apps/plugin-deep-link');
      this.unlistenDeepLinks = await deepLink.onOpenUrl((urls) => {
        for (const url of urls) void this.receiveNativeDeepLink(url);
      });
      const current = await deepLink.getCurrent();
      for (const url of current ?? []) void this.receiveNativeDeepLink(url);
    } catch (error) {
      console.error('Could not initialize the native deep-link listener.', error);
    }
  }
  private applyTheme(): void {
    const settings = getSettings();
    applyTheme({
      theme: settings.theme,
      fontFamily: settings.fontFamily,
      fontSize: settings.fontSize,
      lineWidth: settings.lineWidth,
      themeOverrides: settings.themeOverrides,
      authorColor: settings.authorColor,
      sourceColor: settings.sourceColor,
    });
  }

  /** Reloads everything from IndexedDB and re-sorts the posts. */
  private async reload(): Promise<void> {
    const [feeds, sessions] = await Promise.all([
      getAllFeeds(),
      getAuthSessions(),
    ]);

    const posts = await collectPosts(
      feeds.map((feed) => feed.id),
      this.s.sort,
    );

    this.setState({
      feeds,
      posts,
      sessions,
      trending: await computeTrending(5),
    });
  }

  /** Subscribed feeds only — explore feeds are kept separate. */
  private subscribedFeeds(): Feed[] {
    const exploreIds = new Set(getSettings().exploreFeedUrls);
    return this.s.feeds.filter(
      (feed) => !feed.explore && !exploreIds.has(feed.id),
    );
  }

  /**
   * Explore feeds are exactly the sources configured in Settings. Keying off
   * the configured URLs means removing a source hides it right away, even when
   * its cached posts were kept.
   */
  private exploreFeeds(): Feed[] {
    const exploreIds = new Set(getSettings().exploreFeedUrls);
    return this.s.feeds.filter((feed) => exploreIds.has(feed.id));
  }

  private postsFor(feedIds: string[]): Post[] {
    const allowed = new Set(feedIds);
    return this.s.posts.filter((post) => allowed.has(post.feedId));
  }

  private async reloadFor(scope: 'subscribed' | 'explore' | 'all'): Promise<void> {
    if (scope === 'subscribed') {
      await this.reload();
      return;
    }

    this.setState({ loading: true, error: '' });

    try {
      const settings = getSettings();

      if (scope === 'explore' || scope === 'all') {
        await ensureExploreFeeds(settings.exploreFeedUrls);
      }

      const feeds = await getAllFeeds();
      const posts = await collectPosts(
        feeds.map((feed) => feed.id),
        this.s.sort,
      );

      this.setState({
        feeds,
        posts,
        trending: await computeTrending(5),
        loading: false,
      });
    } catch (error) {
      this.setState({
        loading: false,
        error:
          error instanceof Error ? error.message : 'Could not load the feeds.',
      });
    }
  }

  /** Fetches the feeds in scope, then reloads the UI. */
  private async refresh(scope: 'subscribed' | 'explore' | 'all' = 'subscribed'): Promise<void> {
    this.setState({ loading: true, error: '' });

    try {
      const exploreIds = new Set(getSettings().exploreFeedUrls);
      const feeds = await getAllFeeds();
      const targets = feeds.filter((feed) => {
        if (scope === 'all') return true;
        if (scope === 'explore') return exploreIds.has(feed.id);
        return !feed.explore && !exploreIds.has(feed.id);
      });

      for (const feed of targets) {
        try {
          await fetchFeed(feed.id);
        } catch {
          /* individual feed failures do not break the whole refresh */
        }
      }

      await this.reloadFor(scope);
      this.setState({ loading: false });
    } catch (error) {
      this.setState({
        loading: false,
        error:
          error instanceof Error ? error.message : 'Could not refresh the feeds.',
      });
    }
  }

  private handleSort = (sort: SortMode): void => {
    this.setState({ sort });
    void this.reload();
  };

  private handleSearch = (searchQuery: string): void => {
    this.setState({ searchQuery });
  };

  private handleCreate = (): void => {
    if (this.s.sessions.length === 0) {
      window.location.hash = '#/profile';
      return;
    }
    window.location.hash = '#/create';
  };

  private handleToggleSidebar = (): void => {
    this.setState({ drawerOpen: !this.s.drawerOpen });
  };

  private handleCloseDrawer = (): void => {
    if (this.s.drawerOpen) this.setState({ drawerOpen: false });
  };

  private handleFeedsChanged = (): void => {
    void this.reload();
  };

  private handleSessionsChanged = (): void => {
    void this.reload();
  };

  /** Filters posts by the current search query. */
  private filterPosts(posts: Post[]): Post[] {
    const query = this.s.searchQuery.trim().toLowerCase();
    if (!query) return posts;

    return posts.filter(
      (post) =>
        post.title.toLowerCase().includes(query) ||
        post.excerpt.toLowerCase().includes(query) ||
        post.url.toLowerCase().includes(query),
    );
  }

  render() {
    const {
      feeds,
      posts,
      trending,
      sessions,
      sort,
      loading,
      error,
      drawerOpen,
      searchQuery,
      oauthCallback,
    } = this.s;

    const settings = getSettings();
    const accountName = sessions[0]?.account;

    const subscribedFeeds = this.subscribedFeeds();
    const exploreFeeds = this.exploreFeeds();

    const subscribedPosts = this.filterPosts(
      this.postsFor(subscribedFeeds.map((feed) => feed.id)),
    );
    const explorePosts = this.filterPosts(
      this.postsFor(exploreFeeds.map((feed) => feed.id)),
    );
    const allPosts = this.filterPosts(posts);

    // The OAuth provider redirected back to the site root with query
    // parameters — show the callback screen instead of the app shell.
    if (oauthCallback) {
      return (
        <AuthCallback
          location={{
            search: this.s.oauthCallbackSearch || window.location.search,
            hash: window.location.hash,
          }}
          onDone={() => {
            window.history.replaceState(
              {},
              '',
              `${window.location.pathname}${window.location.hash}`,
            );
            this.setState({ oauthCallback: false, oauthCallbackSearch: '' });
          }}
        />
      );
    }

    return (
      <HashRouter>
        <ThreePane
          accountName={accountName}
          signedIn={sessions.length > 0}
          trending={trending}
          feedCount={subscribedFeeds.length}
          postCount={allPosts.length}
          siteUrl={settings.siteUrl}
          searchQuery={searchQuery}
          onSearch={this.handleSearch}
          onCreate={this.handleCreate}
          onToggleSidebar={this.handleToggleSidebar}
          drawerOpen={drawerOpen}
          onCloseDrawer={this.handleCloseDrawer}
          syncing={loading}
        >
          <Switch>
            <Route
              exact
              path="/"
              render={() => (
                <Home
                  sort={sort}
                  onSort={this.handleSort}
                  subscribedPosts={subscribedPosts}
                  subscribedFeeds={subscribedFeeds}
                  explorePosts={explorePosts}
                  exploreFeeds={exploreFeeds}
                  loading={loading}
                  error={error}
                  onRefreshSubscribed={() => void this.refresh('subscribed')}
                  onRefreshExplore={() => void this.refresh('explore')}
                  onFeedsChanged={this.handleFeedsChanged}
                  showComments={settings.showComments}
                />
              )}
            />
            <Route
              exact
              path="/explore"
              render={() => (
                <Home
                  defaultTab="explore"
                  sort={sort}
                  onSort={this.handleSort}
                  subscribedPosts={subscribedPosts}
                  subscribedFeeds={subscribedFeeds}
                  explorePosts={explorePosts}
                  exploreFeeds={exploreFeeds}
                  loading={loading}
                  error={error}
                  onRefreshSubscribed={() => void this.refresh('subscribed')}
                  onRefreshExplore={() => void this.refresh('explore')}
                  onFeedsChanged={this.handleFeedsChanged}
                  showComments={settings.showComments}
                />
              )}
            />
            <Route
              exact
              path="/all"
              render={() => (
                <All
                  sort={sort}
                  onSort={this.handleSort}
                  posts={allPosts}
                  feeds={feeds}
                  loading={loading}
                  error={error}
                  onRefresh={() => void this.refresh('all')}
                  showComments={settings.showComments}
                />
              )}
            />
            <Route
              exact
              path="/feeds"
              render={() => (
                <Feeds
                  feeds={subscribedFeeds}
                  loading={loading}
                  onRefresh={() => void this.refresh('subscribed')}
                  onFeedsChanged={this.handleFeedsChanged}
                />
              )}
            />
            <Route
              exact
              path="/bookmarks"
              render={() => (
                <Bookmarks
                  sort={sort}
                  onSort={this.handleSort}
                  posts={this.filterPosts(posts.filter((post) => post.saved))}
                  feeds={feeds}
                  loading={loading}
                  error={error}
                  showComments={settings.showComments}
                  onFeedsChanged={this.handleFeedsChanged}
                />
              )}
            />
            <Route
              exact
              path="/settings"
              render={() => (
                <Settings
                  feeds={subscribedFeeds}
                  onFeedsChanged={this.handleFeedsChanged}
                  onRefreshAll={() => this.refresh('all')}
                />
              )}
            />
            <Route
              exact
              path="/profile"
              render={() => (
                <Profile
                  sessions={sessions}
                  feeds={subscribedFeeds}
                  onSessionsChanged={this.handleSessionsChanged}
                  onFeedsChanged={this.handleFeedsChanged}
                />
              )}
            />
            <Route
              exact
              path="/create"
              render={() => <Create sessions={sessions} />}
            />
            <Route
              path="/post/:id"
              render={(props: { match: { params: { id?: string } } }) => (
                <PostPage
                  match={props.match}
                  showComments={settings.showComments}
                />
              )}
            />
            <Route
              exact
              path="/auth/callback"
              render={(props: { location: { search: string; hash: string } }) => (
                <AuthCallback location={props.location} />
              )}
            />
          </Switch>
        </ThreePane>
      </HashRouter>
    );
  }
}

export { runSync, updateSettings };
