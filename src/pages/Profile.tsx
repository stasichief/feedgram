import { Component } from 'inferno';
import { PageHeader } from './FeedPage';
import { Avatar } from '../components/common/Avatar';
import { Icon } from '../components/common/Icon';
import { ICONS } from '../components/common/icons';
import { Button } from '../components/common/Button';
import { MicropubAuth } from '../components/Auth/MicropubAuth';
import { MastodonAuth } from '../components/Auth/MastodonAuth';
import { WordPressAuth } from '../components/Auth/WordPressAuth';
import { BlueskyAuth } from '../components/Auth/BlueskyAuth';
import { LemmyAuth } from '../components/Auth/LemmyAuth';
import { removeSession, saveSession } from '../lib/auth';
import { loadMyPosts, type MyPost } from '../lib/my-posts';
import { relativeTime } from '../components/Feed/PostCard';
import type { AuthMethod, AuthSession, Feed } from '../lib/types';

export interface ProfileProps {
  sessions: AuthSession[];
  feeds: Feed[];
  onSessionsChanged: () => void;
  onFeedsChanged: () => void;
}

/** User profile: login status, auth methods, subscriptions and posts. */
export class Profile extends Component<ProfileProps> {
  private myPosts: MyPost[] = [];
  private loadingPosts = false;

  componentDidMount(): void {
    void this.loadPosts();
  }

  componentDidUpdate(previousProps: ProfileProps): void {
    if (previousProps.sessions.length !== this.props.sessions.length) {
      void this.loadPosts();
    }
  }

  private async loadPosts(): Promise<void> {
    if (this.props.sessions.length === 0) {
      this.myPosts = [];
      this.forceUpdate();
      return;
    }

    this.loadingPosts = true;
    this.forceUpdate();

    this.myPosts = await loadMyPosts(this.props.sessions[0]);

    this.loadingPosts = false;
    this.forceUpdate();
  }

  private async disconnect(method: AuthMethod): Promise<void> {
    await removeSession(method);
    this.forceUpdate();
    this.props.onSessionsChanged();
  }

  private handleConnected(session: AuthSession): void {
    void saveSession(session).then(() => this.props.onSessionsChanged());
  }

  render() {
    const { sessions, feeds } = this.props;

    const sessionFor = (method: AuthMethod) =>
      sessions.find((session) => session.method === method);

    const primary = sessions[0];

    return (
      <div class="mx-auto max-w-3xl">
        <PageHeader title="Profile" />

        <div class="flex flex-col gap-5 px-4 py-5">
          {/* Identity */}
          <section class="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
            <Avatar
              name={primary?.account}
              size={56}
            />
            <div class="min-w-0 flex-1">
              <p class="truncate text-lg font-bold text-fg">
                {primary?.account ?? 'Not signed in'}
              </p>
              <p class="truncate text-sm text-fg-muted">
                {primary
                  ? `@${primary.account}${
                      primary.endpoint ? ` · ${primary.endpoint}` : ''
                    }`
                  : 'Connect an account to publish posts and vote on comments.'}
              </p>
            </div>
            {primary ? (
              <Button
                size="sm"
                variant="ghost"
                icon="pencil"
                title="Edit profile"
              >
                Edit
              </Button>
            ) : null}
          </section>

          {/* Authentication methods */}
          <section>
            <h2 class="mb-3 text-sm font-semibold text-fg">
              Authentication methods
            </h2>
            <div class="flex flex-col gap-3">
              <MicropubAuth
                session={sessionFor('micropub')}
                onConnected={(session) => this.handleConnected(session)}
                onDisconnect={() => void this.disconnect('micropub')}
              />
              <MastodonAuth
                session={sessionFor('mastodon')}
                onConnected={(session) => this.handleConnected(session)}
                onDisconnect={() => void this.disconnect('mastodon')}
              />
              <WordPressAuth
                session={sessionFor('wordpress')}
                onConnected={(session) => this.handleConnected(session)}
                onDisconnect={() => void this.disconnect('wordpress')}
              />
              <BlueskyAuth
                session={sessionFor('bluesky')}
                onConnected={(session) => this.handleConnected(session)}
                onDisconnect={() => void this.disconnect('bluesky')}
              />
              <LemmyAuth
                session={sessionFor('lemmy')}
                onConnected={(session) => this.handleConnected(session)}
                onDisconnect={() => void this.disconnect('lemmy')}
              />
            </div>
          </section>

          {/* Subscriptions */}
          <section>
            <h2 class="mb-3 text-sm font-semibold text-fg">My subscriptions</h2>
            {feeds.length === 0 ? (
              <p class="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-fg-muted">
                No subscriptions yet.
              </p>
            ) : (
              <ul class="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                {feeds.map((feed) => (
                  <li
                    key={feed.id}
                    class="flex items-center gap-3 px-4 py-2.5"
                  >
                    <span class="text-fg-muted">
                      <Icon node={ICONS.rss} size={15} />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-medium text-fg">
                        {feed.title}
                      </span>
                      <span class="block truncate font-mono text-xs text-fg-muted">
                        {feed.id}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Posts */}
          <section>
            <h2 class="mb-3 text-sm font-semibold text-fg">My posts</h2>
            {sessions.length === 0 ? (
              <p class="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-fg-muted">
                Connect an account to see the posts you have published.
              </p>
            ) : this.loadingPosts ? (
              <p class="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-fg-muted">
                <Icon node={ICONS.loader} size={14} className="spin" />
                Loading your posts…
              </p>
            ) : this.myPosts.length === 0 ? (
              <p class="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-fg-muted">
                Posts you publish from feedgram appear here.
              </p>
            ) : (
              <ul class="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                {this.myPosts.map((post) => (
                  <li key={post.id} class="px-4 py-2.5">
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="block text-sm font-medium text-fg hover:text-accent"
                    >
                      {post.title}
                    </a>
                    {post.publishedAt ? (
                      <span class="text-xs text-fg-muted">
                        {relativeTime(post.publishedAt)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    );
  }
}
