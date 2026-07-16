import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Trash2 } from 'lucide-react';
import { useAnnotationStore } from '../store/combinedStores';
import type { Annotation } from '../types';
import { getColorTheme } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface AnnotationContextMenuProps {
  annotation: Annotation;
  /** Viewport (client) coordinates of the right-click. */
  x: number;
  y: number;
  onClose: () => void;
}

const MENU_W = 216;
const MENU_H = 232;

/**
 * Right-click menu for an annotation box. The headline action is "scale in
 * place" — grow or shrink the box about its own center so its position is
 * unchanged — plus duplicate and delete. Every action writes through the
 * annotation store, which persists, so there's no separate save step.
 */
export function AnnotationContextMenu({ annotation, x, y, onClose }: AnnotationContextMenuProps) {
  const updateAnnotation = useAnnotationStore((s) => s.updateAnnotation);
  const addAnnotation = useAnnotationStore((s) => s.addAnnotation);
  const deleteAnnotation = useAnnotationStore((s) => s.deleteAnnotation);
  const deleteAnnotations = useAnnotationStore((s) => s.deleteAnnotations);
  const setSelectedAnnotationIds = useAnnotationStore((s) => s.setSelectedAnnotationIds);
  const selectedAnnotationIds = useAnnotationStore((s) => s.selectedAnnotationIds);

  const [percent, setPercent] = useState(110);

  // When the right-clicked box is part of a multi-selection, actions hit the set.
  const targets =
    selectedAnnotationIds.includes(annotation.id) && selectedAnnotationIds.length > 1
      ? selectedAnnotationIds
      : [annotation.id];
  const multi = targets.length > 1;

  const findAnnotation = (id: string): Annotation | null => {
    const byMesh = useAnnotationStore.getState().annotationsByMesh;
    for (const key of Object.keys(byMesh)) {
      const found = byMesh[key].find((a) => a.id === id);
      if (found) return found;
    }
    return null;
  };

  // Scale by `factor` about the box's center so x/y shift to keep it in place.
  const scaleInPlace = (factor: number) => {
    const cx = annotation.x + annotation.width / 2;
    const cy = annotation.y + annotation.height / 2;
    const w = Math.max(5, annotation.width * factor);
    const h = Math.max(5, annotation.height * factor);
    updateAnnotation(annotation.id, { width: w, height: h, x: cx - w / 2, y: cy - h / 2 });
  };

  const applyPercent = () => {
    const f = percent / 100;
    if (Number.isFinite(f) && f > 0 && f !== 1) scaleInPlace(f);
  };

  const duplicate = () => {
    const newIds: string[] = [];
    targets.forEach((id, i) => {
      const src = id === annotation.id ? annotation : findAnnotation(id);
      if (!src) return;
      const copy: Annotation = {
        ...src,
        id: `ann-${Date.now()}-${i}`,
        x: src.x + 16,
        y: src.y + 16,
        label: `${src.label} copy`,
      };
      addAnnotation(copy);
      newIds.push(copy.id);
    });
    if (newIds.length) setSelectedAnnotationIds(newIds);
    onClose();
  };

  const remove = () => {
    if (multi) deleteAnnotations(targets);
    else deleteAnnotation(annotation.id);
    onClose();
  };

  // Escape closes the menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Keep the menu on-screen.
  const left = Math.max(8, Math.min(x, window.innerWidth - MENU_W - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - MENU_H - 8));

  return createPortal(
    <>
      {/* Click-catcher: any mousedown outside closes; right-click closes too. */}
      <div
        className="fixed inset-0 z-[100]"
        onMouseDown={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        className="fixed z-[101] rounded-md border bg-popover text-popover-foreground shadow-lg p-1 text-sm"
        style={{ left, top, width: MENU_W }}
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flex items-center gap-2 border-b px-2 py-1.5 mb-1">
          {multi ? (
            <span className="truncate font-medium">{targets.length} selected</span>
          ) : (
            <>
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: getColorTheme(annotation.color).main }}
              />
              <span className="truncate font-medium">{annotation.label}</span>
            </>
          )}
        </div>

        {!multi && (
          <>
            {/* Scale in place */}
            <div className="px-2 py-1">
              <div className="mb-1 text-[11px] text-muted-foreground">Scale in place</div>
              <div className="mb-1.5 flex items-center gap-1">
                <Button size="sm" variant="outline" className="h-7 flex-1 px-0" onClick={() => scaleInPlace(0.9)}>
                  −10%
                </Button>
                <Button size="sm" variant="outline" className="h-7 flex-1 px-0" onClick={() => scaleInPlace(1.1)}>
                  +10%
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  value={percent}
                  onChange={(e) => setPercent(Number(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyPercent();
                  }}
                  className="h-7 w-16 text-xs"
                />
                <span className="text-xs text-muted-foreground">%</span>
                <Button size="sm" className="h-7 flex-1" onClick={applyPercent}>
                  Apply
                </Button>
              </div>
            </div>

            <div className="my-1 border-t" />
          </>
        )}

        <button
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={duplicate}
        >
          <Copy className="h-4 w-4" /> {multi ? 'Duplicate all' : 'Duplicate'}
        </button>
        <button
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-destructive hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={remove}
        >
          <Trash2 className="h-4 w-4" /> {multi ? 'Delete all' : 'Delete'}
        </button>
      </div>
    </>,
    document.body,
  );
}
