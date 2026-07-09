import { useState } from 'react';
import { Link, Unlink } from 'lucide-react';
import { NumberField } from '../ui/number-field';
import { Label } from '../ui/label';

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
const clampFrac = (f: number) => Math.max(0, Math.min(0.45, f));
const isZero = (p: Padding) => !p.top && !p.right && !p.bottom && !p.left;
const pct = (frac: number) => Math.round(frac * 1000) / 10;

interface ImagePaddingControlProps {
  value?: Padding;
  onChange: (next: Padding | undefined) => void;
}

/**
 * Padding control for a placed decal: one uniform % by default, with a
 * link/unlink toggle that expands to independent top/right/bottom/left. Values
 * are stored as fractions of the box's shorter side; emits `undefined` when all
 * sides are zero so a padding-free annotation stays clean.
 *
 * Mount this with `key={annotation.id}` so the linked/unlinked state resets when
 * a different annotation is selected.
 */
export function ImagePaddingControl({ value, onChange }: ImagePaddingControlProps) {
  const v: Padding = value ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const [linked, setLinked] = useState(
    v.top === v.right && v.right === v.bottom && v.bottom === v.left,
  );

  const emit = (p: Padding) => onChange(isZero(p) ? undefined : p);

  const setUniform = (percent: number) => {
    const f = clampFrac(percent / 100);
    emit({ top: f, right: f, bottom: f, left: f });
  };

  const setSide = (side: (typeof SIDES)[number], percent: number) => {
    emit({ ...v, [side]: clampFrac(percent / 100) });
  };

  const toggleLink = () => {
    // Collapsing back to linked: level every side to the top value.
    if (!linked) emit({ top: v.top, right: v.top, bottom: v.top, left: v.top });
    setLinked((l) => !l);
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Padding</Label>
        <button
          onClick={toggleLink}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={linked ? 'Set each side individually' : 'Link all sides'}
          aria-label={linked ? 'Unlink padding sides' : 'Link padding sides'}
        >
          {linked ? <Link className="h-3.5 w-3.5" /> : <Unlink className="h-3.5 w-3.5" />}
        </button>
      </div>

      {linked ? (
        <div className="flex items-center gap-1">
          <NumberField
            value={pct(v.top)}
            onCommit={setUniform}
            step={1}
            precision={1}
            className="h-7 w-16 text-xs"
            aria-label="Padding"
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1">
          {SIDES.map((side) => (
            <div key={side} className="flex items-center gap-1">
              <span className="w-10 text-[10px] capitalize text-muted-foreground">{side}</span>
              <NumberField
                value={pct(v[side])}
                onCommit={(n) => setSide(side, n)}
                step={1}
                precision={1}
                className="h-7 text-xs"
                aria-label={`Padding ${side}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
