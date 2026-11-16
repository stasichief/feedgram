import { Component } from 'inferno';
import { AuthMethodCard } from './AuthMethodCard';
import { Field, Input } from '../common/Field';
import { Button } from '../common/Button';
import { LemmyProvider } from '../../lib/auth/lemmy';
import type { AuthSession } from '../../lib/types';

export interface LemmyAuthProps {
  session?: AuthSession;
  onConnected: (session: AuthSession) => void;
  onDisconnect: () => void;
}

export class LemmyAuth extends Component<LemmyAuthProps> {
  private instance = '';
  private username = '';
  private password = '';
  private totp = '';
  private busy = false;
  private error = '';
  private provider = new LemmyProvider();

  render() {
    const { session, onConnected, onDisconnect } = this.props;

    return (
      <AuthMethodCard
        method="lemmy"
        label="Lemmy Auth"
        description="Connect directly to the selected Lemmy instance. Lemmy exposes an API login rather than a standard third-party OAuth browser flow."
        icon="hash"
        session={session}
        onDisconnect={onDisconnect}
        busy={this.busy}
        error={this.error}
      >
        <Field label="Instance" hint="e.g. lemmy.ml" htmlFor="lemmy-instance">
          <Input
            id="lemmy-instance"
            value={this.instance}
            mono
            placeholder="lemmy.ml"
            onInput={(value) => {
              this.instance = value;
            }}
          />
        </Field>

        <Field label="Username" htmlFor="lemmy-username">
          <Input
            id="lemmy-username"
            value={this.username}
            onInput={(value) => {
              this.username = value;
            }}
          />
        </Field>

        <Field label="Password" htmlFor="lemmy-password">
          <Input
            id="lemmy-password"
            type="password"
            value={this.password}
            onInput={(value) => {
              this.password = value;
            }}
          />
        </Field>

        <Field
          label="TOTP code"
          hint="Only needed when 2FA is enabled"
          htmlFor="lemmy-totp"
        >
          <Input
            id="lemmy-totp"
            value={this.totp}
            mono
            placeholder="000000"
            onInput={(value) => {
              this.totp = value;
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

            this.provider
              .connect(
                this.instance,
                this.username,
                this.password,
                this.totp || undefined,
              )
              .then((newSession) => {
                this.busy = false;
                this.password = '';
                this.totp = '';
                this.forceUpdate();
                onConnected(newSession);
              })
              .catch((error: unknown) => {
                this.busy = false;
                this.error =
                  error instanceof Error ? error.message : 'Connection failed.';
                this.forceUpdate();
              });
          }}
        >
          Connect
        </Button>
        <p class="text-xs text-fg-muted">Your password is sent directly to that instance over HTTPS and is not saved; only the returned session token is retained.</p>
      </AuthMethodCard>
    );
  }
}
