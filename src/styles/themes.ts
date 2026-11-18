import type { FontFamily, LineWidth, ThemeName, ThemePaletteOverride } from '../lib/types';

export interface ThemeTokens {
  name: ThemeName;
  label: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentContrast: string;
  upvote: string;
  downvote: string;
  shadow: string;
}

export const THEMES: Record<ThemeName, ThemeTokens> = {
  light: { name: 'light', label: 'Light', background: '#ffffff', surface: '#f8fafc', surfaceAlt: '#f1f5f9', border: '#e2e8f0', text: '#1a1a1a', textMuted: '#64748b', accent: '#2563eb', accentContrast: '#ffffff', upvote: '#16a34a', downvote: '#dc2626', shadow: '0 1px 2px rgba(15, 23, 42, 0.06)' },
  sepia: { name: 'sepia', label: 'Sepia', background: '#f4ecd8', surface: '#efe4cc', surfaceAlt: '#e7d9bd', border: '#d9c8a4', text: '#5b4636', textMuted: '#8a7359', accent: '#8b6914', accentContrast: '#fdfaf3', upvote: '#6b8e23', downvote: '#a63d40', shadow: '0 1px 2px rgba(91, 70, 54, 0.12)' },
  oled: { name: 'oled', label: 'True Black', background: '#000000', surface: '#0a0a0a', surfaceAlt: '#141414', border: '#262626', text: '#e0e0e0', textMuted: '#9a9a9a', accent: '#60a5fa', accentContrast: '#000000', upvote: '#4ade80', downvote: '#f87171', shadow: 'none' },
  parchment: { name: 'parchment', label: 'Parchment', background: '#efe6d8', surface: '#e6d9c4', surfaceAlt: '#dccdb4', border: '#c9b490', text: '#3d2f24', textMuted: '#7a6554', accent: '#9a5b2f', accentContrast: '#fff8f0', upvote: '#5d7a3a', downvote: '#b54a3c', shadow: '0 1px 2px rgba(61, 47, 36, 0.12)' },
  twitter: { name: 'twitter', label: 'Twitter Style', background: '#f7f9fc', surface: '#ffffff', surfaceAlt: '#edf4fb', border: '#dbe6f0', text: '#17202a', textMuted: '#687987', accent: '#1d9bf0', accentContrast: '#ffffff', upvote: '#00a878', downvote: '#e0245e', shadow: '0 1px 2px rgba(23, 32, 42, 0.08)' },
  feedly: { name: 'feedly', label: 'Reader Green', background: '#f7f9f8', surface: '#ffffff', surfaceAlt: '#edf4f0', border: '#dce6e0', text: '#26332c', textMuted: '#718078', accent: '#2bb24c', accentContrast: '#ffffff', upvote: '#2bb24c', downvote: '#d24d57', shadow: '0 1px 2px rgba(38, 51, 44, 0.07)' },
  inoreader: { name: 'inoreader', label: 'Reader Red', background: '#fbf8f7', surface: '#ffffff', surfaceAlt: '#f5eeec', border: '#eadbd7', text: '#312522', textMuted: '#82716d', accent: '#d34b3f', accentContrast: '#ffffff', upvote: '#43845a', downvote: '#d34b3f', shadow: '0 1px 2px rgba(49, 37, 34, 0.07)' },
  miniflux: { name: 'miniflux', label: 'Minimal Gray', background: '#f5f6f7', surface: '#ffffff', surfaceAlt: '#eceff1', border: '#d7dde1', text: '#263238', textMuted: '#607078', accent: '#546e7a', accentContrast: '#ffffff', upvote: '#388e3c', downvote: '#c62828', shadow: 'none' },
  netnewswire: { name: 'netnewswire', label: 'Reader Blue', background: '#f4f8fc', surface: '#ffffff', surfaceAlt: '#e8f1fa', border: '#d2e0ef', text: '#1e2936', textMuted: '#66798d', accent: '#147efb', accentContrast: '#ffffff', upvote: '#2e9b57', downvote: '#dc3545', shadow: '0 1px 2px rgba(30, 41, 54, 0.08)' },
};

export const FONT_STACKS: Record<FontFamily, string> = {
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  serif: "Georgia, Cambria, 'Times New Roman', Times, serif",
};

export const LINE_WIDTHS: Record<LineWidth, string> = {
  narrow: '40rem',
  medium: '48rem',
  wide: '60rem',
};

export const FONT_SIZES = [14, 16, 18, 20, 22] as const;
export const POLL_INTERVALS = [5, 15, 30, 60] as const;

export function toChannels(hex: string): string {
  const normalised = hex.replace('#', '');
  const full = normalised.length === 3 ? normalised.split('').map((char) => char + char).join('') : normalised;
  const value = Number.parseInt(full, 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}

export function applyTheme(options: {
  theme: ThemeName;
  fontFamily: FontFamily;
  fontSize: number;
  lineWidth: LineWidth;
  themeOverrides?: Partial<Record<ThemeName, ThemePaletteOverride>>;
  authorColor?: string;
  sourceColor?: string;
}): void {
  const root = document.documentElement;
  const base = THEMES[options.theme] ?? THEMES.light;
  const override = options.themeOverrides?.[options.theme] ?? {};
  const tokens = { ...base, ...override };

  root.dataset.theme = options.theme;
  root.style.setProperty('--bg', toChannels(tokens.background));
  root.style.setProperty('--surface', toChannels(tokens.surface));
  root.style.setProperty('--surface-alt', toChannels(tokens.surfaceAlt));
  root.style.setProperty('--border', toChannels(tokens.border));
  root.style.setProperty('--text', toChannels(tokens.text));
  root.style.setProperty('--text-muted', toChannels(base.textMuted));
  root.style.setProperty('--accent', toChannels(tokens.accent));
  root.style.setProperty('--accent-contrast', toChannels(base.accentContrast));
  root.style.setProperty('--upvote', toChannels(base.upvote));
  root.style.setProperty('--downvote', toChannels(base.downvote));
  root.style.setProperty('--shadow', base.shadow);
  root.style.setProperty('--author-color', options.authorColor || tokens.accent);
  root.style.setProperty('--source-color', options.sourceColor || base.textMuted);
  root.style.setProperty('--font-family', FONT_STACKS[options.fontFamily]);
  root.style.setProperty('--font-size', `${options.fontSize}px`);
  root.style.setProperty('--content-width', LINE_WIDTHS[options.lineWidth]);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', tokens.background);
}
