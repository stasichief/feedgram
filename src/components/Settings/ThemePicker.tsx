import { Component } from 'inferno';
import { THEMES } from '../../styles/themes';
import type { ThemeName, ThemePaletteOverride } from '../../lib/types';

const THEME_ORDER: ThemeName[] = ['light', 'sepia', 'parchment', 'oled', 'twitter', 'feedly', 'inoreader', 'miniflux', 'netnewswire'];
const COLOR_FIELDS: Array<{ key: keyof ThemePaletteOverride; label: string }> = [
  { key: 'background', label: 'Page background' },
  { key: 'surface', label: 'Cards and panels' },
  { key: 'text', label: 'Main text' },
  { key: 'accent', label: 'Accent' },
];

export interface ThemePickerProps {
  value: ThemeName;
  overrides: Partial<Record<ThemeName, ThemePaletteOverride>>;
  onChange: (theme: ThemeName) => void;
  onOverride: (theme: ThemeName, palette: ThemePaletteOverride) => void;
}

/** Theme presets with editable colors saved separately for every preset. */
export class ThemePicker extends Component<ThemePickerProps> {
  render() {
    const { value, overrides, onChange, onOverride } = this.props;
    const base = THEMES[value] ?? THEMES.light;
    const palette = { ...base, ...overrides[value] };

    return (
      <div class="flex flex-col gap-3">
        <span class="text-sm font-medium text-fg">Theme</span>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {THEME_ORDER.map((name) => {
            const tokens = { ...THEMES[name], ...overrides[name] };
            const active = value === name;
            return (
              <button key={name} type="button" class={[
                'rounded-xl border p-2.5 text-left transition-all',
                active ? 'border-accent ring-2 ring-accent/30' : 'border-border hover:border-fg-muted/50',
              ].join(' ')} onClick={() => onChange(name)} aria-pressed={active ? 'true' : 'false'}>
                <span class="mb-2 flex h-10 overflow-hidden rounded-lg border border-border" style={{ background: tokens.background }}>
                  <span class="w-1/3" style={{ background: tokens.surface }} />
                  <span class="flex flex-1 items-center justify-center"><span class="h-2 w-8 rounded-full" style={{ background: tokens.accent }} /></span>
                </span>
                <span class="block text-xs font-medium text-fg">{tokens.label}</span>
              </button>
            );
          })}
        </div>
        <p class="text-xs text-fg-muted">Adjust colors for the selected theme. Each preset keeps its own palette.</p>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {COLOR_FIELDS.map(({ key, label }) => (
            <label key={key} class="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-fg">
              <span>{label}</span>
              <input type="color" value={palette[key] ?? base[key as keyof typeof base] as string} aria-label={label}
                class="h-7 w-9 cursor-pointer border-0 bg-transparent p-0"
                onInput={(event: Event) => onOverride(value, { ...overrides[value], [key]: (event.target as HTMLInputElement).value })} />
            </label>
          ))}
        </div>
      </div>
    );
  }
}
