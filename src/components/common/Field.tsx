import { Component } from 'inferno';

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children?: unknown;
  htmlFor?: string;
}

export class Field extends Component<FieldProps> {
  render() {
    const { label, hint, error, children, htmlFor } = this.props;
    return (
      <div class="flex flex-col gap-1.5">
        <label
          for={htmlFor}
          class="text-sm font-medium text-fg"
        >
          {label}
        </label>
        {children as never}
        {error ? (
          <p class="text-xs text-downvote">{error}</p>
        ) : hint ? (
          <p class="text-xs text-fg-muted">{hint}</p>
        ) : null}
      </div>
    );
  }
}

export interface InputProps {
  value: string;
  onInput?: (value: string) => void;
  type?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  mono?: boolean;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
}

export class Input extends Component<InputProps> {
  private currentValue = this.props.value;

  componentWillReceiveProps(nextProps: InputProps) {
    if (nextProps.value !== this.props.value) {
      this.currentValue = nextProps.value;
    }
  }

  /**
   * Inferno treats `value` as controlled: after an `input` event it writes the
   * vNode's `value` prop back onto the DOM node. If the parent does not
   * re-render, that prop is still the old string and the keystroke is undone.
   * Re-rendering here keeps the vNode in sync with what the user typed, so the
   * field stays editable even when the parent only stores the value in a field.
   */
  private handleInput = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    this.currentValue = target.value;
    this.props.onInput?.(this.currentValue);
    this.forceUpdate();
  };

  render() {
    const { type = 'text', placeholder, id, disabled, mono, min, max, step, maxLength } =
      this.props;

    return (
      <input
        id={id}
        type={type}
        value={this.currentValue}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        maxLength={maxLength}
        class={[
          'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm',
          'text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent/30',
          'placeholder:text-fg-muted disabled:opacity-50',
          mono ? 'font-mono text-xs' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onInput={this.handleInput}
      />
    );
  }
}

export interface TextAreaProps {
  value: string;
  onInput?: (value: string) => void;
  placeholder?: string;
  id?: string;
  rows?: number;
  disabled?: boolean;
}

export class TextArea extends Component<TextAreaProps> {
  private currentValue = this.props.value;

  componentWillReceiveProps(nextProps: TextAreaProps) {
    if (nextProps.value !== this.props.value) {
      this.currentValue = nextProps.value;
    }
  }

  /** Same controlled-input contract as {@link Input}. */
  private handleInput = (event: Event): void => {
    const target = event.target as HTMLTextAreaElement;
    this.currentValue = target.value;
    this.props.onInput?.(this.currentValue);
    this.forceUpdate();
  };

  render() {
    const { placeholder, id, rows = 4, disabled } = this.props;
    return (
      <textarea
        id={id}
        rows={rows}
        value={this.currentValue}
        placeholder={placeholder}
        disabled={disabled}
        class={[
          'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm',
          'text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent/30',
          'placeholder:text-fg-muted resize-y',
        ].join(' ')}
        onInput={this.handleInput}
      />
    );
  }
}

export interface SelectProps {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange?: (value: string) => void;
  id?: string;
  disabled?: boolean;
}

export class Select extends Component<SelectProps> {
  render() {
    const { value, options, onChange, id, disabled } = this.props;
    return (
      <select
        id={id}
        value={value}
        disabled={disabled}
        class={[
          'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm',
          'text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent/30',
        ].join(' ')}
        onChange={(event: Event) => {
          const target = event.target as HTMLSelectElement;
          onChange?.(target.value);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
}

export interface ToggleProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  id?: string;
}

export class Toggle extends Component<ToggleProps> {
  render() {
    const { checked, onChange, label, id } = this.props;
    return (
      <label class="inline-flex items-center gap-2.5 cursor-pointer select-none">
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked ? 'true' : 'false'}
          aria-label={label}
          class={[
            'relative h-6 w-11 rounded-full transition-colors shrink-0',
            checked ? 'bg-accent' : 'bg-border',
          ].join(' ')}
          onClick={() => onChange?.(!checked)}
        >
          <span
            class={[
              'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
              checked ? 'left-5.5' : 'left-0.5',
            ].join(' ')}
          />
        </button>
        {label ? <span class="text-sm text-fg">{label}</span> : null}
      </label>
    );
  }
}
