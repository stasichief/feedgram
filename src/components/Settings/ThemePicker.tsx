import { Component } from 'inferno';
import { THEMES } from '../../styles/themes';
import type { ThemeName } from '../../lib/types';

const THEME_ORDER: ThemeName[] = ['light', 'sepia', 'oled'];

export interface ThemePickerProps {
  value: ThemeName;
  onChange: (theme: ThemeName) => void;
}

/** Theme picker with live swatches. */
export class ThemePicker extends Component<ThemePickerProps> {
  render() {
    const { value, onChange } = this.props;

    return (
      <div class="flex flex-col gap-2">
        <span class="text-sm font-medium text-fg">Theme</span>
        <div class="grid grid-cols-3 gap-2">
          {THEME_ORDER.map((name) => {
            const tokens = THEMES[name];
            const active = value === name;

            return (
              <button
                key={name}
                type="button"
                class={[
                  'rounded-xl border p-2.5 text-left transition-all',
                  active
                    ? 'border-accent ring-2 ring-accent/30'
                    : 'border-border hover:border-fg-muted/50',
                ].join(' ')}
                onClick={() => onChange(name)}
                aria-pressed={active ? 'true' : 'false'}
              >
                <span
                  class="mb-2 flex h-12 overflow-hidden rounded-lg border border-border"
                  style={{ background: tokens.background }}
                >
                  <span class="w-1/3" style={{ background: tokens.surface }} />
                  <span
                    class="flex flex-1 items-center justify-center"
                    style={{ background: tokens.background }}
                  >
                    <span
                      class="h-2 w-8 rounded-full"
                      style={{ background: tokens.accent }}
                    />
                  </span>
                </span>
                <span class="block text-xs font-medium text-fg">{tokens.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
}
