import { Component } from 'inferno';
import { PageHeader } from './FeedPage';
import { ThemePicker } from '../components/Settings/ThemePicker';
import { TypographyControls } from '../components/Settings/TypographyControls';
import { SyncConfig } from '../components/Settings/SyncConfig';
import { ProxyConfig } from '../components/Settings/ProxyConfig';
import { DataManagement } from '../components/Settings/DataManagement';
import { getSettings, resetSettings, updateSettings } from '../lib/settings';
import { deleteFeedCascade } from '../lib/db';
import { Toggle } from '../components/common/Field';
import type {
  Feed,
  FontFamily,
  LineWidth,
  ProxyMode,
  Settings as AppSettings,
  ThemeName,
  ThemePaletteOverride,
} from '../lib/types';

export interface SettingsPageProps {
  feeds: Feed[];
  onFeedsChanged: () => void;
}

/** A titled settings section. */
function Section(props: {
  title: string;
  icon: 'eye' | 'sliders' | 'database' | 'shield';
  children?: unknown;
}) {
  return (
    <section class="rounded-xl border border-border bg-surface p-4">
      <h2 class="mb-4 text-sm font-semibold text-fg">{props.title}</h2>
      {props.children as never}
    </section>
  );
}

/** Settings page. */
export class Settings extends Component<SettingsPageProps> {
  private settings: AppSettings = getSettings();

  private update(patch: Partial<AppSettings>): void {
    updateSettings(patch);
    this.settings = getSettings();
    this.forceUpdate();
  }

  /**
   * Drops an explore URL from the settings and, when requested, deletes the
   * feed record together with its cached posts, articles and comments.
   */
  private async removeExploreUrl(
    url: string,
    deleteCachedPosts: boolean,
  ): Promise<void> {
    this.update({
      exploreFeedUrls: getSettings().exploreFeedUrls.filter(
        (entry) => entry !== url,
      ),
    });

    if (deleteCachedPosts) {
      await deleteFeedCascade(url);
    }

    this.props.onFeedsChanged();
  }

  render() {
    const { feeds, onFeedsChanged } = this.props;
    const settings = this.settings;

    return (
      <div class="mx-auto max-w-3xl">
        <PageHeader title="Settings" />

        <div class="flex flex-col gap-4 px-4 py-5">
          <Section title="Appearance" icon="eye">
            <div class="flex flex-col gap-6">
              <ThemePicker
                value={settings.theme}
                overrides={settings.themeOverrides}
                onChange={(theme: ThemeName) => this.update({ theme })}
                onOverride={(theme: ThemeName, palette: ThemePaletteOverride) => this.update({
                  themeOverrides: { ...getSettings().themeOverrides, [theme]: palette },
                })}
              />
              <TypographyControls
                fontFamily={settings.fontFamily}
                fontSize={settings.fontSize}
                lineWidth={settings.lineWidth}
                onFontFamily={(fontFamily: FontFamily) => this.update({ fontFamily })}
                onFontSize={(fontSize: number) => this.update({ fontSize })}
                onLineWidth={(lineWidth: LineWidth) => this.update({ lineWidth })}
              />
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg">
                  Author name color
                  <input type="color" value={settings.authorColor} class="h-8 w-10 cursor-pointer border-0 bg-transparent p-0"
                    onInput={(event: Event) => this.update({ authorColor: (event.target as HTMLInputElement).value })} />
                </label>
                <label class="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg">
                  Source and URL color
                  <input type="color" value={settings.sourceColor} class="h-8 w-10 cursor-pointer border-0 bg-transparent p-0"
                    onInput={(event: Event) => this.update({ sourceColor: (event.target as HTMLInputElement).value })} />
                </label>
                <Toggle checked={settings.showAuthorAvatars} label="Show square author avatars when available"
                  onChange={(showAuthorAvatars) => this.update({ showAuthorAvatars })} />
              </div>
            </div>
          </Section>

          <Section title="Sync & fetching" icon="sliders">
            <SyncConfig
              pollIntervalMinutes={settings.pollIntervalMinutes}
              backgroundSync={settings.backgroundSync}
              exploreFeedUrls={settings.exploreFeedUrls}
              onPollInterval={(pollIntervalMinutes) =>
                this.update({ pollIntervalMinutes })
              }
              onBackgroundSync={(backgroundSync) => this.update({ backgroundSync })}
              onExploreUrls={(exploreFeedUrls) => this.update({ exploreFeedUrls })}
              onRemoveExploreUrl={(url, deleteCachedPosts) =>
                void this.removeExploreUrl(url, deleteCachedPosts)
              }
            />
          </Section>

          <Section title="Proxy configuration" icon="shield">
            <ProxyConfig
              proxyMode={settings.proxyMode}
              proxyUrl={settings.proxyUrl}
              proxyHeaders={settings.proxyHeaders}
              proxyTimeoutMs={settings.proxyTimeoutMs}
              proxyRetries={settings.proxyRetries}
              userAgentOverride={settings.userAgentOverride}
              siteUrl={settings.siteUrl}
              ignoreInvalidCerts={settings.ignoreInvalidCerts}
              onProxyMode={(proxyMode: ProxyMode) => this.update({ proxyMode })}
              onProxyUrl={(proxyUrl) => this.update({ proxyUrl })}
              onProxyHeaders={(proxyHeaders) => this.update({ proxyHeaders })}
              onTimeout={(proxyTimeoutMs) => this.update({ proxyTimeoutMs })}
              onRetries={(proxyRetries) => this.update({ proxyRetries })}
              onUserAgent={(userAgentOverride) => this.update({ userAgentOverride })}
              onSiteUrl={(siteUrl) => this.update({ siteUrl })}
              onIgnoreInvalidCerts={(ignoreInvalidCerts) =>
                this.update({ ignoreInvalidCerts })
              }
            />
          </Section>

          <Section title="Data management" icon="database">
            <DataManagement
              feeds={feeds}
              onReset={onFeedsChanged}
              retentionAmount={settings.retentionAmount}
              retentionUnit={settings.retentionUnit}
              onRetentionAmount={(retentionAmount) => this.update({ retentionAmount })}
              onRetentionUnit={(retentionUnit) => this.update({ retentionUnit })}
            />
          </Section>

          <button
            type="button"
            class="self-start rounded-lg border border-border px-3 py-2 text-sm text-fg-muted hover:bg-surface-alt hover:text-fg"
            onClick={() => {
              resetSettings();
              this.settings = getSettings();
              this.forceUpdate();
            }}
          >
            Reset settings to defaults
          </button>
        </div>
      </div>
    );
  }
}
