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
  /** Native media upload (currently Mastodon only). */
  supportsMediaUpload: boolean;
}

const TARGETS: Target[] = [
  {
    method: 'mastodon',
    label: 'Mastodon',
    supportsTitle: false,
    supportsTags: true,
    supportsMediaUpload: true,
  },
  {
    method: 'lemmy',
    label: 'Lemmy',
    supportsTitle: true,
    supportsTags: false,
    supportsMediaUpload: false,
  },
  {
    method: 'bluesky',
    label: 'Bluesky',
    supportsTitle: false,
    supportsTags: true,
    supportsMediaUpload: false,
  },
  {
    method: 'wordpress',
    label: 'WordPress',
    supportsTitle: true,
    supportsTags: true,
    supportsMediaUpload: false,
  },
  {
    method: 'micropub',
    label: 'Micropub',
    supportsTitle: true,
    supportsTags: true,
    supportsMediaUpload: false,
  },
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
  /** Local files staged for Mastodon media upload. */
  private pendingFiles: File[] = [];

  componentDidMount(): void {
    if (!this.target && this.props.sessions.length > 0) {
      this.target = this.props.sessions[0].method;
    }
  }

  private currentTarget(): Target | undefined {
    return TARGETS.find((target) => target.method === this.target);
  }

  /** Insert Markdown around the current selection (or at the cursor). */
  private insertMarkdown(prefix: string, suffix = '', placeholder = ''): void {
    const el = document.getElementById('create-body') as HTMLTextAreaElement | null;
    if (!el) {
      this.body = `${this.body}${prefix}${placeholder}${suffix}`;
      this.forceUpdate();
      return;
    }
    const start = el.selectionStart ?? this.body.length;
    const end = el.selectionEnd ?? this.body.length;
    const hadSelection = end > start;
    const selected = this.body.slice(start, end) || placeholder;
    const next =
      this.body.slice(0, start) + prefix + selected + suffix + this.body.slice(end);
    this.body = next;
    this.forceUpdate();
    requestAnimationFrame(() => {
      el.focus();
      if (hadSelection) {
        el.setSelectionRange(
          start + prefix.length,
          start + prefix.length + selected.length,
        );
      } else {
        const cursor = start + prefix.length + selected.length + suffix.length;
        el.setSelectionRange(cursor, cursor);
      }
    });
  }

  private insertImageByUrl(): void {
    const url = window.prompt('Image URL');
    if (!url || !url.trim()) return;
    this.insertMarkdown(`\n![image](${url.trim()})\n`);
  }

  private onPickFiles = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (files.length === 0) return;
    this.pendingFiles = [...this.pendingFiles, ...files].slice(0, 4);
    this.forceUpdate();
    input.value = '';
  };

  private removePendingFile(index: number): void {
    this.pendingFiles = this.pendingFiles.filter((_, i) => i !== index);
    this.forceUpdate();
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

    if (!body && !title && this.pendingFiles.length === 0) {
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
          let mediaIds: string[] | undefined;
          if (this.pendingFiles.length > 0) {
            mediaIds = [];
            for (const file of this.pendingFiles) {
              const id = await mastodonProvider.uploadMedia(session, file);
              mediaIds.push(id);
            }
          }
          const statusText = target?.supportsTitle
            ? `${title}\n\n${body}`
            : body;
          const text = tags.length
            ? `${statusText}\n\n${tags.map((tag) => `#${tag}`).join(' ')}`
            : statusText;
          await mastodonProvider.publish(session, text, undefined, mediaIds);
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
      this.pendingFiles = [];
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

          <div class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-fg">Body</span>
            {/* Markdown toolbar */}
            <div class="flex flex-wrap items-center gap-1 rounded-t-lg border border-b-0 border-border bg-surface-alt px-1.5 py-1">
              <ToolbarBtn
                label="Bold"
                title="Bold (**text**)"
                onClick={() => this.insertMarkdown('**', '**', 'bold')}
              >
                <span class="font-bold">B</span>
              </ToolbarBtn>
              <ToolbarBtn
                label="Italic"
                title="Italic (*text*)"
                onClick={() => this.insertMarkdown('*', '*', 'italic')}
              >
                <span class="italic">I</span>
              </ToolbarBtn>
              <ToolbarBtn
                label="Link"
                title="Link"
                onClick={() => this.insertMarkdown('[', '](https://)', 'text')}
              >
                <Icon node={ICONS.link} size={14} />
              </ToolbarBtn>
              <ToolbarBtn
                label="Image URL"
                title="Insert image by URL"
                onClick={() => this.insertImageByUrl()}
              >
                <Icon node={ICONS.externalLink} size={14} />
              </ToolbarBtn>
              {target?.supportsMediaUpload ? (
                <label
                  class="inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 text-xs text-fg-muted hover:bg-surface hover:text-fg"
                  title="Upload image (Mastodon)"
                >
                  <Icon node={ICONS.upload} size={14} />
                  <span>Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    class="hidden"
                    onChange={this.onPickFiles}
                  />
                </label>
              ) : null}
              <span class="ml-auto px-1 text-[10px] uppercase tracking-wide text-fg-muted">
                Markdown
              </span>
            </div>
            <TextArea
              id="create-body"
              value={this.body}
              rows={8}
              placeholder="Write in Markdown…"
              onInput={(value) => {
                this.body = value;
              }}
            />
            {this.pendingFiles.length > 0 ? (
              <ul class="mt-1 flex flex-col gap-1">
                {this.pendingFiles.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    class="flex items-center gap-2 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-fg"
                  >
                    <Icon node={ICONS.upload} size={12} />
                    <span class="min-w-0 flex-1 truncate">{file.name}</span>
                    <button
                      type="button"
                      class="text-fg-muted hover:text-downvote"
                      onClick={() => this.removePendingFile(index)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {!target?.supportsMediaUpload ? (
              <p class="text-xs text-fg-muted">
                Images: use the toolbar to insert a Markdown image by URL. File
                upload is available when posting to Mastodon.
              </p>
            ) : (
              <p class="text-xs text-fg-muted">
                Up to 4 images can be uploaded with the post on Mastodon.
              </p>
            )}
          </div>

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

function ToolbarBtn(props: {
  label: string;
  title: string;
  onClick: () => void;
  children?: unknown;
}) {
  return (
    <button
      type="button"
      class="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded px-1.5 text-xs text-fg-muted hover:bg-surface hover:text-fg"
      title={props.title}
      aria-label={props.label}
      onClick={props.onClick}
    >
      {props.children as never}
    </button>
  );
}
