import { useState, type ReactNode } from 'react';
import {
  Trash2,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
} from 'lucide-react';
import { useAnnotationStore } from '../../store/combinedStores';
import type { Annotation, ImageFit } from '../../types';
import { ANNOTATION_COLORS } from '../../types';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { NumberField } from '../ui/number-field';
import { PropertySection } from '../ui/property-section';

/** Shared value across the selection, or `undefined` when they differ ("Mixed"). */
function common<T>(arr: Annotation[], fn: (a: Annotation) => T): T | undefined {
  if (arr.length === 0) return undefined;
  const first = fn(arr[0]);
  return arr.every((a) => fn(a) === first) ? first : undefined;
}

/** Axis-aligned union of the selection (from stored, unrotated box rects). */
function selectionBBox(arr: Annotation[]) {
  const minX = Math.min(...arr.map((a) => a.x));
  const minY = Math.min(...arr.map((a) => a.y));
  const maxX = Math.max(...arr.map((a) => a.x + a.width));
  const maxY = Math.max(...arr.map((a) => a.y + a.height));
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

const MIXED = 'Mixed';

interface MultiRegionPropertiesProps {
  /** The selected regions, scoped to the active mesh, in list order. */
  annotations: Annotation[];
  onClear: () => void;
  onDelete: () => void;
}

/**
 * Figma-style multi-selection editor: treat the selection as one object. Group
 * transform (move/scale from the selection's bounding box), align & distribute,
 * and shared style fields that show "Mixed" when members differ and write to all
 * at once. Every batch write goes through `patchAnnotations`, so it's one undo
 * entry. On-canvas move/scale/rotate handles live in the UV editor (Konva).
 */
export function MultiRegionProperties({ annotations, onClear, onDelete }: MultiRegionPropertiesProps) {
  const patchAnnotations = useAnnotationStore((s) => s.patchAnnotations);
  const moveAnnotations = useAnnotationStore((s) => s.moveAnnotations);
  const [pattern, setPattern] = useState('');

  const count = annotations.length;
  const b = selectionBBox(annotations);
  const patchAll = (updatesFor: (a: Annotation, i: number) => Partial<Annotation>) =>
    patchAnnotations(annotations.map((a, i) => ({ id: a.id, updates: updatesFor(a, i) })));

  // ---- Group transform (bounding-box driven) ------------------------------
  const setGroupX = (nx: number) => moveAnnotations(annotations.map((a) => a.id), nx - b.minX, 0);
  const setGroupY = (ny: number) => moveAnnotations(annotations.map((a) => a.id), 0, ny - b.minY);
  const setGroupW = (nw: number) => {
    if (b.width <= 0) return;
    const sx = nw / b.width;
    patchAll((a) => ({ x: b.minX + (a.x - b.minX) * sx, width: Math.max(1, a.width * sx) }));
  };
  const setGroupH = (nh: number) => {
    if (b.height <= 0) return;
    const sy = nh / b.height;
    patchAll((a) => ({ y: b.minY + (a.y - b.minY) * sy, height: Math.max(1, a.height * sy) }));
  };
  const commonRot = common(annotations, (a) => a.rotation);

  // ---- Align & distribute (relative to the selection bounds) ---------------
  const align = (kind: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') =>
    patchAll((a) => {
      switch (kind) {
        case 'left': return { x: b.minX };
        case 'hcenter': return { x: b.cx - a.width / 2 };
        case 'right': return { x: b.maxX - a.width };
        case 'top': return { y: b.minY };
        case 'vcenter': return { y: b.cy - a.height / 2 };
        case 'bottom': return { y: b.maxY - a.height };
        default: return {};
      }
    });

  // Equal-gap distribution: outer boxes hold, inner boxes get even spacing.
  const distribute = (axis: 'h' | 'v') => {
    if (count < 3) return;
    const size = (a: Annotation) => (axis === 'h' ? a.width : a.height);
    const start = (a: Annotation) => (axis === 'h' ? a.x : a.y);
    const sorted = [...annotations].sort((p, q) => start(p) - start(q));
    const min = Math.min(...sorted.map(start));
    const max = Math.max(...sorted.map((a) => start(a) + size(a)));
    const totalSize = sorted.reduce((s, a) => s + size(a), 0);
    const gap = (max - min - totalSize) / (count - 1);
    let cursor = min;
    const patches = sorted.map((a) => {
      const updates = axis === 'h' ? { x: cursor } : { y: cursor };
      cursor += size(a) + gap;
      return { id: a.id, updates };
    });
    patchAnnotations(patches);
  };

  // ---- Shared style --------------------------------------------------------
  const commonColor = common(annotations, (a) => a.color);
  const commonFit = common(annotations, (a) => a.imageFit ?? 'contain');
  const commonOpacity = common(annotations, (a) => a.imageOpacity ?? 1);
  const anyImage = annotations.some((a) => a.imageData);

  const applyRename = () => {
    const p = pattern.trim();
    if (!p) return;
    patchAll((_, i) => ({ label: p.includes('{n}') ? p.replace(/\{n\}/g, String(i + 1)) : `${p}${i + 1}` }));
  };

  return (
    <div className="py-2">
      {/* Identity header */}
      <div className="px-4 pb-1 pt-2">
        <span className="text-sm font-medium">{count} selected</span>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Edits apply to all. Fields that differ show <span className="italic">Mixed</span>.
        </p>
      </div>

      {/* Arrange */}
      <div className="px-4 py-2">
        <Label className="mb-2 block text-xs text-muted-foreground">Align &amp; distribute</Label>
        <div className="flex flex-wrap items-center gap-1">
          <IconBtn title="Align left" onClick={() => align('left')}><AlignStartVertical className="h-4 w-4" /></IconBtn>
          <IconBtn title="Align horizontal centers" onClick={() => align('hcenter')}><AlignCenterVertical className="h-4 w-4" /></IconBtn>
          <IconBtn title="Align right" onClick={() => align('right')}><AlignEndVertical className="h-4 w-4" /></IconBtn>
          <span className="mx-1 h-5 w-px bg-border" />
          <IconBtn title="Align top" onClick={() => align('top')}><AlignStartHorizontal className="h-4 w-4" /></IconBtn>
          <IconBtn title="Align vertical centers" onClick={() => align('vcenter')}><AlignCenterHorizontal className="h-4 w-4" /></IconBtn>
          <IconBtn title="Align bottom" onClick={() => align('bottom')}><AlignEndHorizontal className="h-4 w-4" /></IconBtn>
          <span className="mx-1 h-5 w-px bg-border" />
          <IconBtn title="Distribute horizontally" disabled={count < 3} onClick={() => distribute('h')}><AlignHorizontalDistributeCenter className="h-4 w-4" /></IconBtn>
          <IconBtn title="Distribute vertically" disabled={count < 3} onClick={() => distribute('v')}><AlignVerticalDistributeCenter className="h-4 w-4" /></IconBtn>
        </div>
      </div>

      {/* Transform — group bounding box */}
      <PropertySection title="Transform">
        <div>
          <Label className="mb-2 block text-xs text-muted-foreground">Location · group</Label>
          <div className="grid grid-cols-2 gap-2">
            <Field label="X" value={b.minX} onCommit={setGroupX} />
            <Field label="Y" value={b.minY} onCommit={setGroupY} />
          </div>
        </div>
        <div>
          <Label className="mb-2 block text-xs text-muted-foreground">Size · group</Label>
          <div className="grid grid-cols-2 gap-2">
            <Field label="W" value={b.width} onCommit={setGroupW} />
            <Field label="H" value={b.height} onCommit={setGroupH} />
          </div>
        </div>
        <div>
          <Label className="mb-2 block text-xs text-muted-foreground">Rotation</Label>
          <div className="flex items-center gap-1">
            <span className="w-4 text-xs">R</span>
            <NumberField
              value={commonRot ?? 0}
              onCommit={(n) => patchAll(() => ({ rotation: n }))}
              className="h-7 text-xs"
              aria-label="Rotation"
            />
            <span className="text-xs">°</span>
            {commonRot === undefined && <span className="ml-1 text-[11px] italic text-muted-foreground">{MIXED}</span>}
          </div>
        </div>
      </PropertySection>

      {/* Style */}
      <PropertySection title="Style">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Color</Label>
            {commonColor === undefined && <span className="text-[11px] italic text-muted-foreground">{MIXED}</span>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ANNOTATION_COLORS.map((c) => {
              const active = commonColor === c.name;
              return (
                <button
                  key={c.name}
                  title={c.name}
                  onClick={() => patchAll(() => ({ color: c.name }))}
                  className={`h-6 w-6 rounded border ${active ? 'ring-2 ring-ring ring-offset-1' : 'border-border'}`}
                  style={{ backgroundColor: c.main }}
                />
              );
            })}
          </div>
        </div>

        <div>
          <Label className="mb-2 block text-xs text-muted-foreground">Rename all</Label>
          <div className="flex items-center gap-2">
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyRename()}
              placeholder="Panel {n}"
              className="h-7 text-xs"
            />
            <Button size="sm" variant="outline" onClick={applyRename} disabled={!pattern.trim()}>
              Apply
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            <span className="font-mono">{'{n}'}</span> becomes 1, 2, 3… in selection order.
          </p>
        </div>
      </PropertySection>

      {/* Image — applies to members that have an image */}
      <PropertySection title="Image" defaultOpen={false} dot={anyImage}>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Opacity</Label>
            {commonOpacity === undefined && <span className="text-[11px] italic text-muted-foreground">{MIXED}</span>}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={Math.round((commonOpacity ?? 1) * 100)}
              onChange={(e) => patchAll(() => ({ imageOpacity: Number(e.target.value) / 100 }))}
              className="flex-1"
            />
            <span className="w-8 text-right text-xs">
              {commonOpacity === undefined ? '—' : `${Math.round(commonOpacity * 100)}%`}
            </span>
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Fit</Label>
            {commonFit === undefined && <span className="text-[11px] italic text-muted-foreground">{MIXED}</span>}
          </div>
          <select
            value={commonFit ?? ''}
            onChange={(e) => patchAll(() => ({ imageFit: e.target.value as ImageFit }))}
            className="h-7 w-full rounded border bg-background px-2 text-xs"
          >
            {commonFit === undefined && <option value="" disabled>Mixed</option>}
            <option value="fill">Fill (stretch)</option>
            <option value="contain">Contain (fit inside)</option>
            <option value="cover">Cover (fill &amp; crop)</option>
          </select>
        </div>
        {!anyImage && (
          <p className="text-[11px] text-muted-foreground">No images in this selection yet — these apply once a member has one.</p>
        )}
      </PropertySection>

      {/* Actions */}
      <div className="flex gap-2 px-4 py-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={onClear}>
          Clear
        </Button>
        <Button size="sm" variant="destructive" className="flex-1" onClick={onDelete}>
          <Trash2 className="mr-2 h-3 w-3" /> Delete all
        </Button>
      </div>
    </div>
  );
}

function IconBtn({ title, onClick, disabled, children }: { title: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <Button size="icon" variant="outline" className="h-7 w-7" title={title} onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  );
}

function Field({ label, value, onCommit }: { label: string; value: number; onCommit: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-4 text-xs">{label}</span>
      <NumberField value={Math.round(value)} onCommit={onCommit} className="h-7 text-xs" aria-label={label} />
    </div>
  );
}
