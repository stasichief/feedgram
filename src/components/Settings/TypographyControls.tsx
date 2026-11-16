import { Component } from 'inferno';
import { FONT_SIZES, LINE_WIDTHS } from '../../styles/themes';
import type { FontFamily, LineWidth } from '../../lib/types';

export interface TypographyControlsProps {
  fontFamily: FontFamily;
  fontSize: number;
  lineWidth: LineWidth;
  onFontFamily: (value: FontFamily) => void;
  onFontSize: (value: number) => void;
  onLineWidth: (value: LineWidth) => void;
}

const LINE_WIDTH_LABELS: Record<LineWidth, string> = {
  narrow: 'Narrow',
  medium: 'Medium',
  wide: 'Wide',
};

/** Typography controls: typeface, size and measure. */
export class TypographyControls extends Component<TypographyControlsProps> {
  render() {
    const {
      fontFamily,
      fontSize,
      lineWidth,
      onFontFamily,
      onFontSize,
      onLineWidth,
    } = this.props;

    const families: Array<{ value: FontFamily; label: string }> = [
      { value: 'sans', label: 'Sans-serif' },
      { value: 'serif', label: 'Serif' },
    ];

    const widths: LineWidth[] = ['narrow', 'medium', 'wide'];

    return (
      <div class="flex flex-col gap-5">
        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium text-fg">Font</span>
          <div class="flex gap-2">
            {families.map((family) => (
              <button
                key={family.value}
                type="button"
                class={[
                  'flex-1 rounded-lg border px-3 py-2 text-sm transition-colors',
                  fontFamily === family.value
                    ? 'border-accent bg-accent/10 font-medium text-accent'
                    : 'border-border bg-surface text-fg hover:bg-surface-alt',
                ].join(' ')}
                onClick={() => onFontFamily(family.value)}
                aria-pressed={fontFamily === family.value ? 'true' : 'false'}
              >
                {family.label}
              </button>
            ))}
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium text-fg">Font size</span>
          <div class="flex flex-wrap gap-2">
            {FONT_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                class={[
                  'rounded-lg border px-3 py-1.5 text-sm tabular-nums transition-colors',
                  fontSize === size
                    ? 'border-accent bg-accent/10 font-medium text-accent'
                    : 'border-border bg-surface text-fg hover:bg-surface-alt',
                ].join(' ')}
                onClick={() => onFontSize(size)}
                aria-pressed={fontSize === size ? 'true' : 'false'}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium text-fg">Line width</span>
          <div class="flex gap-2">
            {widths.map((width) => (
              <button
                key={width}
                type="button"
                class={[
                  'flex-1 rounded-lg border px-3 py-2 text-sm transition-colors',
                  lineWidth === width
                    ? 'border-accent bg-accent/10 font-medium text-accent'
                    : 'border-border bg-surface text-fg hover:bg-surface-alt',
                ].join(' ')}
                onClick={() => onLineWidth(width)}
                aria-pressed={lineWidth === width ? 'true' : 'false'}
              >
                {LINE_WIDTH_LABELS[width]}
              </button>
            ))}
          </div>
          <div
            class="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg-muted"
            style={{ 'max-width': LINE_WIDTHS[lineWidth] }}
          >
            Preview: the quick brown fox jumps over the lazy dog.
          </div>
        </div>
      </div>
    );
  }
}
