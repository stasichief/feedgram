import { Component } from 'inferno';
import { AuthMethodCard } from './AuthMethodCard';
import { Field, Input } from '../common/Field';
import { Button } from '../common/Button';
import { BlueskyProvider } from '../../lib/auth/bluesky';
import type { AuthSession } from '../../lib/types';

export interface BlueskyAuthProps {
  session?: AuthSession;
  onConnected: (session: AuthSession) => void;
  onDisconnect: () => void;
}

export class BlueskyAuth extends Component<BlueskyAuthProps> {
  private handle = '';
  private appPassword = '';
  private pdsUrl = 'https://bsky.social';
  private busy = false;
  private error = '';
  private provider = new BlueskyProvider();

  render() {
    const { session, onConnected, onDisconnect } = this.props;

    return (
      <AuthMethodCard
        method="bluesky"
        label="Bluesky Auth"
        description="Connect a Bluesky account with an app password to publish posts."
        icon="shield"
        session={session}
        onDisconnect={onDisconnect}
        busy={this.busy}
        error={this.error}
      >
        <Field label="Handle" hint="e.g. user.bsky.social" htmlFor="bsky-handle">
          <Input
            id="bsky-handle"
            value={this.handle}
            mono
            placeholder="user.bsky.social"
            onInput={(value) => {
              this.handle = value;
            }}
          />
        </Field>

        <Field
          label="App password"
          hint="Create one in Settings → Privacy & Security → App Passwords"
          htmlFor="bsky-password"
        >
          <Input
            id="bsky-password"
            type="password"
            value={this.appPassword}
            onInput={(value) => {
              this.appPassword = value;
            }}
          />
        </Field>

        <Field label="PDS URL" htmlFor="bsky-pds">
          <Input
            id="bsky-pds"
            value={this.pdsUrl}
            mono
            onInput={(value) => {
              this.pdsUrl = value;
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
              .connect(this.handle, this.appPassword, this.pdsUrl)
              .then((newSession) => {
                this.busy = false;
                this.appPassword = '';
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
      </AuthMethodCard>
    );
  }
}
