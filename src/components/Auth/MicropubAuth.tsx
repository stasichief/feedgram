import { Component } from 'inferno';
import { AuthMethodCard } from './AuthMethodCard';
import { Field, Input } from '../common/Field';
import { Button } from '../common/Button';
import { MicropubProvider } from '../../lib/auth/micropub';
import { saveOAuthValue } from '../../lib/auth/base';
import type { AuthSession } from '../../lib/types';

export interface MicropubAuthProps {
  session?: AuthSession;
  onConnected: (session: AuthSession) => void;
  onDisconnect: () => void;
}

export class MicropubAuth extends Component<MicropubAuthProps> {
  private endpoint = '';
  private clientId = '';
  private clientSecret = '';
  private tokenEndpoint = '';
  private authorizationEndpoint = '';
  private busy = false;
  private error = '';
  private provider = new MicropubProvider();

  render() {
    const { session, onDisconnect } = this.props;

    return (
      <AuthMethodCard
        method="micropub"
        label="Micropub OAuth"
        description="Connect any Micropub-enabled site to publish through the standard."
        icon="link"
        session={session}
        onDisconnect={onDisconnect}
        busy={this.busy}
        error={this.error}
      >
        <Field
          label="Micropub endpoint"
          hint="e.g. https://example.com/micropub"
          htmlFor="micropub-endpoint"
        >
          <Input
            id="micropub-endpoint"
            value={this.endpoint}
            mono
            placeholder="https://example.com/micropub"
            onInput={(value) => {
              this.endpoint = value;
            }}
          />
        </Field>

        <Field label="Client ID" htmlFor="micropub-client-id">
          <Input
            id="micropub-client-id"
            value={this.clientId}
            mono
            onInput={(value) => {
              this.clientId = value;
            }}
          />
        </Field>

        <Field label="Client secret" htmlFor="micropub-client-secret">
          <Input
            id="micropub-client-secret"
            type="password"
            value={this.clientSecret}
            onInput={(value) => {
              this.clientSecret = value;
            }}
          />
        </Field>

        <Field
          label="Token endpoint"
          hint="Optional — defaults to {endpoint}/token"
          htmlFor="micropub-token"
        >
          <Input
            id="micropub-token"
            value={this.tokenEndpoint}
            mono
            placeholder="https://example.com/micropub/token"
            onInput={(value) => {
              this.tokenEndpoint = value;
            }}
          />
        </Field>

        <Field
          label="Authorization endpoint"
          hint="Copy the authorization_endpoint advertised by your IndieAuth server"
          htmlFor="micropub-authorization"
        >
          <Input
            id="micropub-authorization"
            value={this.authorizationEndpoint}
            mono
            placeholder="https://example.com/indieauth/authorize"
            onInput={(value) => { this.authorizationEndpoint = value; }}
          />
        </Field>
        <Button
          variant="primary"
          icon="link"
          onClick={() => {
            this.busy = true;
            this.error = '';
            this.forceUpdate();

            // Remember the credentials so the OAuth callback can complete.
            saveOAuthValue(
              'feedgram.oauth.micropub.pending',
              JSON.stringify({
                endpoint: this.endpoint.trim(),
                clientId: this.clientId.trim(),
                clientSecret: this.clientSecret,
                tokenEndpoint: this.tokenEndpoint.trim(),
                authorizationEndpoint: this.authorizationEndpoint.trim(),
              }),
            );
            saveOAuthValue('feedgram.oauth.pending', 'micropub');

            this.provider
              .connect(
                this.endpoint,
                this.clientId,
                this.clientSecret,
                this.tokenEndpoint || undefined,
                this.authorizationEndpoint,
              )
              .then(() => { this.busy = false; this.forceUpdate(); })
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
