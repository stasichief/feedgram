import { Component } from 'inferno';
import { Field, Input } from '../common/Field';
import type { ProxyMode } from '../../lib/types';

export interface ProxyConfigProps {
  proxyMode: ProxyMode;
  proxyUrl: string;
  proxyHeaders: Record<string, string>;
  proxyTimeoutMs: number;
  proxyRetries: number;
  userAgentOverride: string;
  siteUrl: string;
  ignoreInvalidCerts: boolean;
  onProxyMode: (mode: ProxyMode) => void;
  onProxyUrl: (url: string) => void;
  onProxyHeaders: (headers: Record<string, string>) => void;
  onTimeout: (ms: number) => void;
  onRetries: (count: number) => void;
  onUserAgent: (value: string) => void;
  onSiteUrl: (value: string) => void;
  onIgnoreInvalidCerts: (value: boolean) => void;
}

interface HeaderRow {
  key: string;
  value: string;
}

/**
 * CORS proxy configuration.
 *
 * Any proxy can be used: the URL may contain a `{url}` placeholder, otherwise
 * the target is appended as a `url` query parameter.
 */
export class ProxyConfig extends Component<ProxyConfigProps> {
  private advanced = false;
  private headerDraft: HeaderRow = { key: '', value: '' };

  render() {
    const {
      proxyMode,
      proxyUrl,
      proxyHeaders,
      proxyTimeoutMs,
      proxyRetries,
      userAgentOverride,
      siteUrl,
      ignoreInvalidCerts,
      onProxyMode,
      onProxyUrl,
      onProxyHeaders,
      onTimeout,
      onRetries,
      onUserAgent,
      onSiteUrl,
      onIgnoreInvalidCerts,
    } = this.props;

    const modes: Array<{ value: ProxyMode; label: string }> = [
      { value: 'direct', label: 'Direct' },
      { value: 'custom', label: 'Custom proxy' },
    ];

    const addHeader = () => {
      const key = this.headerDraft.key.trim();
      if (!key) return;
      onProxyHeaders({ ...proxyHeaders, [key]: this.headerDraft.value });
      this.headerDraft = { key: '', value: '' };
      this.forceUpdate();
    };

    const removeHeader = (key: string) => {
      const next = { ...proxyHeaders };
      delete next[key];
      onProxyHeaders(next);
    };

    return (
      <div class="flex flex-col gap-5">
        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium text-fg">Proxy mode</span>
          <div class="flex gap-2">
            {modes.map((mode) => (
              <button
                key={mode.value}
                type="button"
                class={[
                  'flex-1 rounded-lg border px-3 py-2 text-sm transition-colors',
                  proxyMode === mode.value
                    ? 'border-accent bg-accent/10 font-medium text-accent'
                    : 'border-border bg-surface text-fg hover:bg-surface-alt',
                ].join(' ')}
                onClick={() => onProxyMode(mode.value)}
                aria-pressed={proxyMode === mode.value ? 'true' : 'false'}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <p class="text-xs text-fg-muted">
            When a custom proxy is configured every feed and article request goes
            through it. Otherwise requests are made directly.
          </p>
        </div>

        {proxyMode === 'custom' ? (
          <Field
            label="Proxy URL"
            hint="Use {url} as a placeholder, e.g. https://proxy.example/?url={url}"
            htmlFor="proxy-url"
          >
            <Input
              id="proxy-url"
              value={proxyUrl}
              mono
              placeholder="https://proxy.example/?url={url}"
              onInput={onProxyUrl}
            />
          </Field>
        ) : null}

        <Field
          label="Site URL"
          hint="Where this app is hosted. Used to build OAuth redirect URIs."
          htmlFor="site-url"
        >
          <Input
            id="site-url"
            value={siteUrl}
            mono
            placeholder="https://feedgram.example.com"
            onInput={onSiteUrl}
          />
        </Field>

        <div>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 text-sm font-medium text-accent"
            onClick={() => {
              this.advanced = !this.advanced;
              this.forceUpdate();
            }}
            aria-expanded={this.advanced ? 'true' : 'false'}
          >
            Advanced
          </button>

          {this.advanced ? (
            <div class="mt-3 flex flex-col gap-4 rounded-xl border border-border bg-surface p-3.5">
              <div class="grid grid-cols-2 gap-3">
                <Field label="Timeout (ms)" htmlFor="proxy-timeout">
                  <Input
                    id="proxy-timeout"
                    type="number"
                    min={1000}
                    step={500}
                    value={String(proxyTimeoutMs)}
                    onInput={(value) => onTimeout(Number(value) || 0)}
                  />
                </Field>
                <Field label="Retry count" htmlFor="proxy-retries">
                  <Input
                    id="proxy-retries"
                    type="number"
                    min={0}
                    max={5}
                    value={String(proxyRetries)}
                    onInput={(value) => onRetries(Number(value) || 0)}
                  />
                </Field>
              </div>

              <Field
                label="User-Agent override"
                htmlFor="proxy-ua"
              >
                <Input
                  id="proxy-ua"
                  value={userAgentOverride}
                  mono
                  placeholder="feedgram/1.0"
                  onInput={onUserAgent}
                />
              </Field>

              <div class="flex flex-col gap-1.5">
                <label class="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    class="mt-0.5 h-4 w-4 rounded border-border text-accent"
                    checked={ignoreInvalidCerts}
                    onChange={(e: Event) =>
                      onIgnoreInvalidCerts((e.target as HTMLInputElement).checked)
                    }
                  />
                  <span>
                    <span class="block text-sm font-medium text-fg">
                      Ignore invalid TLS certificates
                    </span>
                    <span class="block text-xs text-fg-muted">
                      Accept self-signed or untrusted certificates on the CORS
                      proxy. Only applies in the native (Tauri) app — browsers
                      always enforce certificate validation.
                    </span>
                  </span>
                </label>
              </div>

              <div class="flex flex-col gap-2">
                <span class="text-sm font-medium text-fg">Custom headers</span>
                {Object.entries(proxyHeaders).length === 0 ? (
                  <p class="text-xs text-fg-muted">No custom headers.</p>
                ) : (
                  Object.entries(proxyHeaders).map(([key, value]) => (
                    <div
                      key={key}
                      class="flex items-center gap-2 rounded-lg border border-border bg-bg px-2.5 py-1.5"
                    >
                      <span class="min-w-0 flex-1 truncate font-mono text-xs text-fg">
                        {key}: {value}
                      </span>
                      <button
                        type="button"
                        class="shrink-0 rounded px-1.5 py-0.5 text-xs text-fg-muted hover:bg-surface-alt hover:text-downvote"
                        onClick={() => removeHeader(key)}
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
                <div class="flex items-end gap-2">
                  <div class="flex-1">
                    <Field label="Header name" htmlFor="header-key">
                      <Input
                        id="header-key"
                        value={this.headerDraft.key}
                        mono
                        placeholder="X-Custom"
                        onInput={(value) => {
                          this.headerDraft = { ...this.headerDraft, key: value };
                        }}
                      />
                    </Field>
                  </div>
                  <div class="flex-1">
                    <Field label="Value" htmlFor="header-value">
                      <Input
                        id="header-value"
                        value={this.headerDraft.value}
                        mono
                        onInput={(value) => {
                          this.headerDraft = { ...this.headerDraft, value };
                        }}
                      />
                    </Field>
                  </div>
                  <button
                    type="button"
                    class="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg hover:bg-surface-alt"
                    onClick={addHeader}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }
}
