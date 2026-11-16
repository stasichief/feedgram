import { Component } from 'inferno';
import { Icon } from '../common/Icon';
import { ICONS, type IconName } from '../common/icons';
import { Button } from '../common/Button';
import type { AuthMethod, AuthSession } from '../../lib/types';

export interface AuthMethodCardProps {
  method: AuthMethod;
  label: string;
  description: string;
  icon: IconName;
  session?: AuthSession;
  children?: unknown;
  onDisconnect: () => void;
  busy?: boolean;
  error?: string;
}

/**
 * Generic card for a single authentication method.
 * Shows either the connection form or the connected state.
 */
export class AuthMethodCard extends Component<AuthMethodCardProps> {
  render() {
    const {
      label,
      description,
      icon,
      session,
      children,
      onDisconnect,
      busy,
      error,
    } = this.props;

    const connected = Boolean(session);

    return (
      <section class="rounded-xl border border-border bg-surface p-4">
        <div class="flex items-start gap-3">
          <span
            class={[
              'mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              connected ? 'bg-upvote/15 text-upvote' : 'bg-surface-alt text-fg-muted',
            ].join(' ')}
          >
            <Icon node={ICONS[icon]} size={18} />
          </span>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-sm font-semibold text-fg">{label}</h3>
              {connected ? (
                <span class="inline-flex items-center gap-1 rounded-full bg-upvote/15 px-2 py-0.5 text-xs font-medium text-upvote">
                  <Icon node={ICONS.circleCheck} size={12} />
                  Connected
                </span>
              ) : null}
            </div>
            <p class="mt-0.5 text-xs text-fg-muted">{description}</p>
          </div>

          {connected ? (
            <Button
              icon="logOut"
              size="sm"
              variant="ghost"
              onClick={onDisconnect}
              title="Disconnect"
            >
              Disconnect
            </Button>
          ) : null}
        </div>

        {connected ? (
          <dl class="mt-3 flex flex-col gap-1 rounded-lg bg-bg px-3 py-2 text-xs">
            <div class="flex items-center justify-between gap-2">
              <dt class="text-fg-muted">Account</dt>
              <dd class="truncate font-medium text-fg">{session?.account}</dd>
            </div>
            {session?.endpoint ? (
              <div class="flex items-center justify-between gap-2">
                <dt class="text-fg-muted">Endpoint</dt>
                <dd class="max-w-[14rem] truncate font-mono text-fg">
                  {session.endpoint}
                </dd>
              </div>
            ) : null}
            {session?.connectedAt ? (
              <div class="flex items-center justify-between gap-2">
                <dt class="text-fg-muted">Connected</dt>
                <dd class="text-fg">
                  {new Date(session.connectedAt).toLocaleDateString()}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <div class="mt-3.5 flex flex-col gap-3">
            {children as never}
          </div>
        )}

        {error ? (
          <p class="mt-2.5 rounded-lg border border-downvote/40 bg-downvote/5 px-3 py-2 text-xs text-fg">
            {error}
          </p>
        ) : null}

        {busy ? (
          <p class="mt-2.5 flex items-center gap-1.5 text-xs text-fg-muted">
            <Icon node={ICONS.loader} size={13} className="spin" />
            Working…
          </p>
        ) : null}
      </section>
    );
  }
}
