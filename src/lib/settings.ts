import { Store } from './store';
import type { CustomTab, Settings } from './types';

const STORAGE_KEY = 'feedgram.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  fontFamily: 'sans',
  fontSize: 16,
  lineWidth: 'medium',
  pollIntervalMinutes: 15,
  exploreFeedUrls: ['https://bearblog.dev/discover/feed/'],
  customTabs: [],
  backgroundSync: true,
  proxyMode: 'direct',
  proxyUrl: '',
  proxyHeaders: {},
  proxyTimeoutMs: 15000,
  proxyRetries: 2,
  userAgentOverride: '',
  siteUrl: '',
  showComments: true,
  ignoreInvalidCerts: false,
};

function sanitizeCustomTabs(value: unknown): CustomTab[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is CustomTab =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        typeof (entry as CustomTab).id === 'string' &&
        typeof (entry as CustomTab).label === 'string' &&
        Array.isArray((entry as CustomTab).feedIds) &&
        (entry as CustomTab).feedIds.every((id) => typeof id === 'string'),
    )
    .map((tab) => ({
      id: tab.id,
      label: tab.label,
      feedIds: [...tab.feedIds],
    }));
}

function readStoredSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      exploreFeedUrls: Array.isArray(parsed.exploreFeedUrls)
        ? parsed.exploreFeedUrls
        : DEFAULT_SETTINGS.exploreFeedUrls,
      customTabs: sanitizeCustomTabs(parsed.customTabs),
      proxyHeaders:
        parsed.proxyHeaders && typeof parsed.proxyHeaders === 'object'
          ? parsed.proxyHeaders
          : {},
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export const settingsStore = new Store<Settings>(readStoredSettings());

export function updateSettings(patch: Partial<Settings>): void {
  settingsStore.set(patch);
  persistSettings();
}

export function persistSettings(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsStore.get()));
  } catch {
    /* storage may be unavailable (private mode) — settings stay in memory */
  }
}

export function resetSettings(): void {
  settingsStore.set({ ...DEFAULT_SETTINGS });
  persistSettings();
}

export function getSettings(): Settings {
  return settingsStore.get();
}
