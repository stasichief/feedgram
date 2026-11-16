import { Component } from 'inferno';

export type IconNode = [string, Record<string, string | number>][];

export interface IconProps {
  node: IconNode;
  size?: number;
  strokeWidth?: number;
  className?: string;
  title?: string;
}

const DEFAULT_SIZE = 24;
const DEFAULT_STROKE = 2;

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders a Lucide icon.
 *
 * `lucide-react` cannot be used here: it depends on React context and hooks,
 * which Inferno does not implement. The `lucide` package exposes the raw SVG
 * node data instead, so the markup is assembled directly.
 */
export class Icon extends Component<IconProps> {
  private buildMarkup(): string {
    const {
      node,
      size = DEFAULT_SIZE,
      strokeWidth = DEFAULT_STROKE,
      title,
    } = this.props;

    const children = node
      .map(([tag, attrs]) => {
        const attributes = Object.entries(attrs)
          .map(([key, value]) => `${key}="${escapeAttribute(String(value))}"`)
          .join(' ');
        return `<${tag} ${attributes}></${tag}>`;
      })
      .join('');

    const accessibility = title
      ? `role="img" aria-label="${escapeAttribute(title)}"`
      : 'aria-hidden="true" focusable="false"';

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
      `viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
      `stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" ` +
      `${accessibility}>${children}</svg>`
    );
  }

  render() {
    const { className } = this.props;
    return (
      <span
        class={className ? `inline-flex ${className}` : 'inline-flex'}
        dangerouslySetInnerHTML={{ __html: this.buildMarkup() }}
      />
    );
  }
}
