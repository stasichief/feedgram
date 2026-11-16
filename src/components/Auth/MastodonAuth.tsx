import { Component } from 'inferno';
import { AuthMethodCard } from './AuthMethodCard';
import { Field, Input } from '../common/Field';
import { Button } from '../common/Button';
import { MastodonProvider } from '../../lib/auth/mastodon';
import { saveOAuthValue } from '../../lib/auth/base';
import type { AuthSession } from '../../lib/types';

export interface MastodonAuthProps {
  session?: AuthSession;
  onConnected: (session: AuthSession) => void;
  onDisconnect: () => void;
}

export class MastodonAuth extends Component<MastodonAuthProps> {
  private instance = '';
  private busy = false;
  private error = '';
  private provider = new MastodonProvider();

  render() {
    const { session, onDisconnect } = this.props;

    return (
      <AuthMethodCard
        method="mastodon"
        label="Mastodon OAuth 2.0"
        description="Connect a Mastodon account to publish posts and read replies."
        icon="atSign"
        session={session}
        onDisconnect={onDisconnect}
        busy={this.busy}
        error={this.error}
      >
        <Field
          label="Instance"
          hint="e.g. mastodon.social"
          htmlFor="mastodon-instance"
        >
          <Input
            id="mastodon-instance"
            value={this.instance}
            mono
            placeholder="mastodon.social"
            onInput={(value) => {
              this.instance = value;
            }}
          />
        </Field>

        <Button
          variant="primary"
          icon="link"
          onClick={() => {
            this.busy = true;
            this.error = '';
            this.forceUpdate();

            // Remember the instance so the OAuth callback can complete.
            saveOAuthValue(
              'feedgram.oauth.mastodon.pending',
              JSON.stringify({ instance: this.instance.trim() }),
            );
            saveOAuthValue('feedgram.oauth.pending', 'mastodon');

            this.provider
              .connect(this.instance)
              .then(() => { this.busy = false; this.forceUpdate(); })
              .catch((error: unknown) => {
                this.error =
                  error instanceof Error ? error.message : 'Connection failed.';
                this.busy = false;
                this.forceUpdate();
              });
          }}
        >
          Connect
        </Button>

        <p class="text-xs text-fg-muted">
          feedgram opens your system browser for approval and returns to this app. The web build stays on this site.
        </p>
      </AuthMethodCard>
    );
  }
}
