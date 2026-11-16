import { Component } from 'inferno';
import { PageHeader } from './FeedPage';
import { ThemePicker } from '../components/Settings/ThemePicker';
import { TypographyControls } from '../components/Settings/TypographyControls';
import { SyncConfig } from '../components/Settings/SyncConfig';
import { ProxyConfig } from '../components/Settings/ProxyConfig';
import { DataManagement } from '../components/Settings/DataManagement';
import { getSettings, resetSettings, updateSettings } from '../lib/settings';
import { deleteFeedCascade } from '../lib/db';
import type {
  Feed,
  FontFamily,
  LineWidth,
  ProxyMode,
  Settings as AppSettings,
  ThemeName,
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
                onChange={(theme: ThemeName) => this.update({ theme })}
              />
              <TypographyControls
                fontFamily={settings.fontFamily}
                fontSize={settings.fontSize}
                lineWidth={settings.lineWidth}
                onFontFamily={(fontFamily: FontFamily) => this.update({ fontFamily })}
                onFontSize={(fontSize: number) => this.update({ fontSize })}
                onLineWidth={(lineWidth: LineWidth) => this.update({ lineWidth })}
              />
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
              onProxyMode={(proxyMode: ProxyMode) => this.update({ proxyMode })}
              onProxyUrl={(proxyUrl) => this.update({ proxyUrl })}
              onProxyHeaders={(proxyHeaders) => this.update({ proxyHeaders })}
              onTimeout={(proxyTimeoutMs) => this.update({ proxyTimeoutMs })}
              onRetries={(proxyRetries) => this.update({ proxyRetries })}
              onUserAgent={(userAgentOverride) => this.update({ userAgentOverride })}
              onSiteUrl={(siteUrl) => this.update({ siteUrl })}
            />
          </Section>

          <Section title="Data management" icon="database">
            <DataManagement feeds={feeds} onReset={onFeedsChanged} />
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
