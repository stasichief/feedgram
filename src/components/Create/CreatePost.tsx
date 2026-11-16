import { Component } from 'inferno';
import { Button } from '../common/Button';
import { Field, Input, Select, TextArea } from '../common/Field';
import { Icon } from '../common/Icon';
import { ICONS } from '../common/icons';
import {
  blueskyProvider,
  lemmyProvider,
  mastodonProvider,
  micropubProvider,
  wordpressProvider,
} from '../../lib/auth';
import type { AuthSession } from '../../lib/types';

export interface CreatePostProps {
  sessions: AuthSession[];
}

/** Which connected account a post should be published to. */
interface Target {
  method: string;
  label: string;
  supportsTitle: boolean;
  supportsTags: boolean;
}

const TARGETS: Target[] = [
  { method: 'mastodon', label: 'Mastodon', supportsTitle: false, supportsTags: true },
  { method: 'lemmy', label: 'Lemmy', supportsTitle: true, supportsTags: false },
  { method: 'bluesky', label: 'Bluesky', supportsTitle: false, supportsTags: true },
  { method: 'wordpress', label: 'WordPress', supportsTitle: true, supportsTags: true },
  { method: 'micropub', label: 'Micropub', supportsTitle: true, supportsTags: true },
];

/** Compose and publish a post to a connected account. */
export class CreatePost extends Component<CreatePostProps> {
  private target = '';
  private title = '';
  private body = '';
  private tags = '';
  private community = '';
  private status: 'draft' | 'publish' = 'publish';
  private busy = false;
  private message = '';
  private error = '';

  componentDidMount(): void {
    if (!this.target && this.props.sessions.length > 0) {
      this.target = this.props.sessions[0].method;
    }
  }

  private currentTarget(): Target | undefined {
    return TARGETS.find((target) => target.method === this.target);
  }

  private async publish(): Promise<void> {
    const session = this.props.sessions.find(
      (entry) => entry.method === this.target,
    );
    if (!session) {
      this.error = 'Select a connected account first.';
      this.forceUpdate();
      return;
    }

    const target = this.currentTarget();
    const title = this.title.trim();
    const body = this.body.trim();
    const tags = this.tags
      .split(/[\s,]+/)
      .map((tag) => tag.replace(/^#/, ''))
      .filter(Boolean);

    if (!body && !title) {
      this.error = 'Write something before publishing.';
      this.forceUpdate();
      return;
    }

    this.busy = true;
    this.error = '';
    this.message = '';
    this.forceUpdate();

    try {
      switch (session.method) {
        case 'mastodon': {
          const statusText = target?.supportsTitle
            ? `${title}\n\n${body}`
            : body;
          const text = tags.length
            ? `${statusText}\n\n${tags.map((tag) => `#${tag}`).join(' ')}`
            : statusText;
          await mastodonProvider.publish(session, text);
          break;
        }
        case 'lemmy': {
          await lemmyProvider.publish(
            session,
            title || body.slice(0, 60),
            body,
            this.community || undefined,
          );
          break;
        }
        case 'bluesky': {
          const text = tags.length
            ? `${body}\n\n${tags.map((tag) => `#${tag}`).join(' ')}`
            : body;
          await blueskyProvider.publish(session, text);
          break;
        }
        case 'wordpress': {
          await wordpressProvider.publish(session, title, body, this.status);
          break;
        }
        case 'micropub': {
          await micropubProvider.publish(session, title, body, tags);
          break;
        }
        default:
          throw new Error('Unsupported account type.');
      }

      this.message =
        this.status === 'draft' ? 'Draft saved.' : 'Published successfully.';
      this.title = '';
      this.body = '';
      this.tags = '';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Publishing failed.';
    } finally {
      this.busy = false;
      this.forceUpdate();
    }
  }

  render() {
    const { sessions } = this.props;
    const target = this.currentTarget();

    if (sessions.length === 0) {
      return (
        <div class="mx-auto max-w-[var(--content-width)] px-4 py-10">
          <div class="rounded-xl border border-border bg-surface p-6 text-center">
            <span class="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface-alt text-fg-muted">
              <Icon node={ICONS.user} size={22} />
            </span>
            <h2 class="text-base font-semibold text-fg">Connect an account first</h2>
            <p class="mx-auto mt-1.5 max-w-md text-sm text-fg-muted">
              Publishing needs a connected account. Open your profile and
              connect Mastodon, Lemmy, Bluesky, WordPress or a Micropub
              endpoint.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div class="mx-auto max-w-[var(--content-width)] px-4 py-6">
        <h1 class="mb-5 text-xl font-bold text-fg">Create post</h1>

        <div class="flex flex-col gap-5 rounded-xl border border-border bg-surface p-4">
          <Field label="Post to" htmlFor="create-target">
            <Select
              id="create-target"
              value={this.target}
              options={sessions.map((session) => ({
                value: session.method,
                label: `${session.account} (${session.method})`,
              }))}
              onChange={(value) => {
                this.target = value;
                this.forceUpdate();
              }}
            />
          </Field>

          {target?.supportsTitle ? (
            <Field label="Title" htmlFor="create-title">
              <Input
                id="create-title"
                value={this.title}
                placeholder="Post title"
                onInput={(value) => {
                  this.title = value;
                }}
              />
            </Field>
          ) : null}

          <Field label="Content" htmlFor="create-body">
            <TextArea
              id="create-body"
              rows={8}
              value={this.body}
              placeholder="Write your post…"
              onInput={(value) => {
                this.body = value;
              }}
            />
          </Field>

          {this.target === 'lemmy' ? (
            <Field
              label="Community ID"
              hint="Optional — the numeric community id on your instance"
              htmlFor="create-community"
            >
              <Input
                id="create-community"
                value={this.community}
                mono
                onInput={(value) => {
                  this.community = value;
                }}
              />
            </Field>
          ) : null}

          {target?.supportsTags ? (
            <Field
              label="Tags"
              hint="Space separated"
              htmlFor="create-tags"
            >
              <Input
                id="create-tags"
                value={this.tags}
                placeholder="fediverse reading"
                onInput={(value) => {
                  this.tags = value;
                }}
              />
            </Field>
          ) : null}

          {this.target === 'wordpress' ? (
            <Field label="Publish as" htmlFor="create-status">
              <Select
                id="create-status"
                value={this.status}
                options={[
                  { value: 'publish', label: 'Publish' },
                  { value: 'draft', label: 'Draft' },
                ]}
                onChange={(value) => {
                  this.status = value as 'draft' | 'publish';
                }}
              />
            </Field>
          ) : null}

          {this.error ? (
            <p class="rounded-lg border border-downvote/40 bg-downvote/5 px-3 py-2 text-sm text-fg">
              {this.error}
            </p>
          ) : null}

          {this.message ? (
            <p class="rounded-lg border border-upvote/40 bg-upvote/5 px-3 py-2 text-sm text-fg">
              {this.message}
            </p>
          ) : null}

          <div class="flex flex-wrap gap-2">
            <Button
              variant="primary"
              icon="send"
              disabled={this.busy}
              onClick={() => void this.publish()}
            >
              {this.busy ? 'Publishing…' : 'Publish'}
            </Button>
            <Button
              icon="save"
              disabled={this.busy}
              onClick={() => {
                this.message = 'Draft saved locally.';
                this.forceUpdate();
              }}
            >
              Save draft
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
