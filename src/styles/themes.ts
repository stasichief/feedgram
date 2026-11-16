import type { FontFamily, LineWidth, ThemeName } from '../lib/types';

export interface ThemeTokens {
  name: ThemeName;
  label: string;
  /** Hex value, used for inline styles and swatches. */
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
  light: {
    name: 'light',
    label: 'Light',
    background: '#ffffff',
    surface: '#f8fafc',
    surfaceAlt: '#f1f5f9',
    border: '#e2e8f0',
    text: '#1a1a1a',
    textMuted: '#64748b',
    accent: '#2563eb',
    accentContrast: '#ffffff',
    upvote: '#16a34a',
    downvote: '#dc2626',
    shadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
  },
  sepia: {
    name: 'sepia',
    label: 'Sepia',
    background: '#f4ecd8',
    surface: '#efe4cc',
    surfaceAlt: '#e7d9bd',
    border: '#d9c8a4',
    text: '#5b4636',
    textMuted: '#8a7359',
    accent: '#8b6914',
    accentContrast: '#fdfaf3',
    upvote: '#6b8e23',
    downvote: '#a63d40',
    shadow: '0 1px 2px rgba(91, 70, 54, 0.12)',
  },
  oled: {
    name: 'oled',
    label: 'True Black',
    background: '#000000',
    surface: '#0a0a0a',
    surfaceAlt: '#141414',
    border: '#262626',
    text: '#e0e0e0',
    textMuted: '#9a9a9a',
    accent: '#60a5fa',
    accentContrast: '#000000',
    upvote: '#4ade80',
    downvote: '#f87171',
    shadow: 'none',
  },
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

/** Converts a hex colour into the "r g b" channel format Tailwind expects. */
export function toChannels(hex: string): string {
  const normalised = hex.replace('#', '');
  const full =
    normalised.length === 3
      ? normalised
          .split('')
          .map((char) => char + char)
          .join('')
      : normalised;

  const value = Number.parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `${r} ${g} ${b}`;
}

/** Applies the theme and typography tokens to the document root. */
export function applyTheme(options: {
  theme: ThemeName;
  fontFamily: FontFamily;
  fontSize: number;
  lineWidth: LineWidth;
}): void {
  const root = document.documentElement;
  const tokens = THEMES[options.theme] ?? THEMES.light;

  root.dataset.theme = options.theme;
  root.style.setProperty('--bg', toChannels(tokens.background));
  root.style.setProperty('--surface', toChannels(tokens.surface));
  root.style.setProperty('--surface-alt', toChannels(tokens.surfaceAlt));
  root.style.setProperty('--border', toChannels(tokens.border));
  root.style.setProperty('--text', toChannels(tokens.text));
  root.style.setProperty('--text-muted', toChannels(tokens.textMuted));
  root.style.setProperty('--accent', toChannels(tokens.accent));
  root.style.setProperty('--accent-contrast', toChannels(tokens.accentContrast));
  root.style.setProperty('--upvote', toChannels(tokens.upvote));
  root.style.setProperty('--downvote', toChannels(tokens.downvote));
  root.style.setProperty('--shadow', tokens.shadow);

  root.style.setProperty('--font-family', FONT_STACKS[options.fontFamily]);
  root.style.setProperty('--font-size', `${options.fontSize}px`);
  root.style.setProperty('--content-width', LINE_WIDTHS[options.lineWidth]);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', tokens.background);
}
