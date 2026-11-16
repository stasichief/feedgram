import { Component } from 'inferno';
import { Button } from '../components/common/Button';
import { Icon } from '../components/common/Icon';
import { ICONS } from '../components/common/icons';
import { MastodonProvider } from '../lib/auth/mastodon';
import { MicropubProvider } from '../lib/auth/micropub';
import { saveSession } from '../lib/auth';
import { readOAuthValue, removeOAuthValue } from '../lib/auth/base';
import type { AuthMethod } from '../lib/types';

export interface AuthCallbackProps {
  location: { search: string; hash: string };
  /** Called once the callback has been handled (successfully or not). */
  onDone?: () => void;
}

/**
 * OAuth callback screen.
 *
 * Web builds receive OAuth query parameters at the configured static-site URL.
 * Tauri builds receive them from the registered custom URI scheme. Pending
 * state and per-instance registration data are held until validation completes.
 */
export class AuthCallback extends Component<AuthCallbackProps> {
  private status: 'working' | 'done' | 'failed' = 'working';
  private message = 'Completing sign-in…';

  componentDidMount(): void {
    void this.handle();
  }

  private readParams(): Record<string, string> {
    const params = new URLSearchParams(this.props.location.search || '');
    const result: Record<string, string> = {};
    params.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  private async handle(): Promise<void> {
    const params = this.readParams();
    const code = params.code;
    const state = params.state;

    if (!code) {
      this.status = 'failed';
      this.message = params.error
        ? `Authorization failed: ${params.error}`
        : 'No authorization code was returned.';
      this.forceUpdate();
      return;
    }

    const method = (params.provider ??
      readOAuthValue('feedgram.oauth.pending') ??
      'mastodon') as AuthMethod;

    try {
      if (method === 'mastodon') {
        const session = await new MastodonProvider().complete(code, state);
        await saveSession(session);
      } else if (method === 'micropub') {
        const pending = JSON.parse(
          readOAuthValue('feedgram.oauth.micropub.pending') ?? '{}',
        ) as {
          endpoint?: string;
          clientId?: string;
          clientSecret?: string;
          tokenEndpoint?: string;
        };

        const session = await new MicropubProvider().complete(
          code,
          state,
          pending.endpoint ?? '',
          pending.clientId ?? '',
          pending.clientSecret ?? '',
          pending.tokenEndpoint,
        );
        await saveSession(session);
      } else {
        throw new Error(`Unsupported callback method: ${method}`);
      }

      removeOAuthValue('feedgram.oauth.pending');
      this.status = 'done';
      this.message = 'You are connected. Redirecting to your profile…';
      this.forceUpdate();

      setTimeout(() => {
        window.location.hash = '#/profile';
        this.props.onDone?.();
      }, 900);
    } catch (error) {
      this.status = 'failed';
      this.message =
        error instanceof Error ? error.message : 'Could not complete sign-in.';
      this.forceUpdate();
    }
  }

  render() {
    if (this.status === 'working') {
      return (
        <div class="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg text-fg-muted">
          <Icon node={ICONS.loader} size={22} className="spin" />
          <p class="text-sm">{this.message}</p>
        </div>
      );
    }

    return (
      <div class="mx-auto max-w-md px-4 py-20 text-center">
        <div class="rounded-xl border border-border bg-surface p-5">
          <span
            class={[
              'mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full',
              this.status === 'done'
                ? 'bg-upvote/15 text-upvote'
                : 'bg-downvote/15 text-downvote',
            ].join(' ')}
          >
            <Icon
              node={this.status === 'done' ? ICONS.circleCheck : ICONS.alert}
              size={22}
            />
          </span>

          <h1 class="mb-1 text-lg font-bold text-fg">Sign-in</h1>
          <p class="text-sm text-fg-muted">{this.message}</p>

          <div class="mt-4 flex justify-center gap-2">
            <Button
              variant="primary"
              icon="user"
              onClick={() => {
                window.location.hash = '#/profile';
                this.props.onDone?.();
              }}
            >
              Go to profile
            </Button>
            <Button
              icon="house"
              onClick={() => {
                window.location.hash = '#/';
                this.props.onDone?.();
              }}
            >
              Home
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
