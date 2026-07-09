import { useEffect, useRef, useState } from 'react';
import { Input } from './input';

interface NumberFieldProps {
  value: number;
  onCommit: (value: number) => void;
  /** Arrow-key step. Shift = ×10, Alt = ×0.1. Default 1. */
  step?: number;
  /** Decimals shown when the field isn't being edited. Default 2. */
  precision?: number;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
  title?: string;
}

function format(v: number, precision: number): string {
  if (!Number.isFinite(v)) return '';
  const p = Math.pow(10, precision);
  return String(Math.round(v * p) / p);
}

/**
 * A numeric text field that doesn't fight you while typing.
 *
 * The problem with a plain `<input value={n.toFixed(1)}>` is that every
 * keystroke re-renders the value formatted, which resets the caret and drops
 * digits on fast/pasted input. Here the input is driven by a local `draft`
 * string while focused, so it shows exactly what you type; the parsed value is
 * committed to the store on blur or Enter. Arrow keys nudge live (Shift = ×10,
 * Alt = ×0.1). External changes (drag-scrub, undo, another field) only flow into
 * the field while it isn't being edited.
 */
export function NumberField({
  value,
  onCommit,
  step = 1,
  precision = 2,
  ...rest
}: NumberFieldProps) {
  const [draft, setDraft] = useState(() => format(value, precision));
  const editing = useRef(false);

  // Reflect external value changes only when not actively editing this field.
  useEffect(() => {
    if (!editing.current) setDraft(format(value, precision));
  }, [value, precision]);

  const commit = (raw: string) => {
    const n = parseFloat(raw);
    if (Number.isFinite(n)) onCommit(n);
  };

  const nudge = (delta: number) => {
    const base = parseFloat(draft);
    const start = Number.isFinite(base) ? base : value;
    const next = Math.round((start + delta) * 1e6) / 1e6;
    setDraft(format(next, precision));
    onCommit(next);
  };

  return (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      value={draft}
      onFocus={() => {
        editing.current = true;
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        editing.current = false;
        commit(draft);
        setDraft(format(value, precision));
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const factor = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
          nudge((e.key === 'ArrowUp' ? 1 : -1) * step * factor);
        } else if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
      {...rest}
    />
  );
}
