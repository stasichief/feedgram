import { Component } from 'inferno';
import { AuthMethodCard } from './AuthMethodCard';
import { Field, Input } from '../common/Field';
import { Button } from '../common/Button';
import { WordPressProvider } from '../../lib/auth/wordpress';
import type { AuthSession } from '../../lib/types';

export interface WordPressAuthProps {
  session?: AuthSession;
  onConnected: (session: AuthSession) => void;
  onDisconnect: () => void;
}

export class WordPressAuth extends Component<WordPressAuthProps> {
  private siteUrl = '';
  private username = '';
  private appPassword = '';
  private busy = false;
  private error = '';
  private provider = new WordPressProvider();

  render() {
    const { session, onConnected, onDisconnect } = this.props;

    return (
      <AuthMethodCard
        method="wordpress"
        label="WordPress Auth"
        description="Connect a WordPress site with an application password to publish posts."
        icon="fileText"
        session={session}
        onDisconnect={onDisconnect}
        busy={this.busy}
        error={this.error}
      >
        <Field label="Site URL" hint="e.g. https://example.com" htmlFor="wp-site">
          <Input
            id="wp-site"
            value={this.siteUrl}
            mono
            placeholder="https://example.com"
            onInput={(value) => {
              this.siteUrl = value;
            }}
          />
        </Field>

        <Field label="Username" htmlFor="wp-username">
          <Input
            id="wp-username"
            value={this.username}
            onInput={(value) => {
              this.username = value;
            }}
          />
        </Field>

        <Field
          label="Application password"
          hint="WordPress → Users → Profile → Application Passwords"
          htmlFor="wp-password"
        >
          <Input
            id="wp-password"
            type="password"
            value={this.appPassword}
            onInput={(value) => {
              this.appPassword = value;
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
              .connect(this.siteUrl, this.username, this.appPassword)
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
