import { useEffect, useMemo, useState } from 'react';
import { useModelStore, useAnnotationStore, useCanvasStore, meshKeyOf } from '../store/combinedStores';
import { findStaleAnnotations, migrateAnnotation, type StaleGroup } from '../services/annotationMigration';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';

/**
 * On load, detects annotations authored before the UV-frame fix on meshes with
 * out-of-range UVs. Minor reframes are auto-repositioned silently; major ones —
 * where the box can't be placed automatically — are surfaced for manual review.
 * Renders nothing for models that already worked.
 */
export function MigrationPrompt() {
  const meshes = useModelStore((s) => s.meshes);
  const setSelectedMesh = useModelStore((s) => s.setSelectedMesh);
  const annotationsByMesh = useAnnotationStore((s) => s.annotationsByMesh);
  const patchAnnotations = useAnnotationStore((s) => s.patchAnnotations);
  const setSelectedAnnotationId = useAnnotationStore((s) => s.setSelectedAnnotationId);
  const canvasSize = useCanvasStore((s) => s.canvasSize);

  const [dismissed, setDismissed] = useState(false);
  const [autoFixed, setAutoFixed] = useState<{ count: number; meshes: string[] } | null>(null);

  const groups = useMemo(
    () => findStaleAnnotations(meshes, annotationsByMesh),
    [meshes, annotationsByMesh],
  );

  // Reset prompt state whenever the loaded model changes.
  const meshSig = meshes.map(meshKeyOf).join('|');
  useEffect(() => {
    setDismissed(false);
    setAutoFixed(null);
  }, [meshSig]);

  // Auto-reposition the minor (safe) groups as soon as they're detected.
  useEffect(() => {
    const minor = groups.filter((g) => !g.severe);
    if (minor.length === 0) return;
    const patches = minor.flatMap((g) =>
      g.annotations.map((a) => ({ id: a.id, updates: migrateAnnotation(a, g.frame, canvasSize) })),
    );
    patchAnnotations(patches);
    setAutoFixed((prev) => ({
      count: (prev?.count ?? 0) + patches.length,
      meshes: Array.from(new Set([...(prev?.meshes ?? []), ...minor.map((g) => g.meshName)])),
    }));
  }, [groups, canvasSize, patchAnnotations]);

  const severeGroups = groups.filter((g) => g.severe);

  if (dismissed) return null;
  if (severeGroups.length === 0 && !autoFixed) return null;

  const goTo = (g: StaleGroup) => {
    const mesh = meshes.find((m) => meshKeyOf(m) === g.meshKey);
    if (mesh) setSelectedMesh(mesh);
    setSelectedAnnotationId(g.annotations[0]?.id ?? null);
    setDismissed(true);
  };

  // "Keep as-is": accept current positions by stamping the severe ones so they
  // stop being flagged (does not move them).
  const keepAsIs = () => {
    patchAnnotations(
      severeGroups.flatMap((g) => g.annotations.map((a) => ({ id: a.id, updates: { authoredFrame: g.frame } }))),
    );
    setDismissed(true);
  };

  const severeCount = severeGroups.reduce((n, g) => n + g.annotations.length, 0);

  return (
    <Dialog open onOpenChange={(o) => !o && setDismissed(true)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {severeGroups.length > 0 ? 'Some annotations need repositioning' : 'Annotations updated'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {autoFixed && (
            <p className="text-muted-foreground">
              ✓ Auto-repositioned {autoFixed.count} annotation{autoFixed.count > 1 ? 's' : ''} on{' '}
              {autoFixed.meshes.join(', ')} — no action needed.
            </p>
          )}

          {severeGroups.length > 0 && (
            <>
              <p>
                {severeCount} annotation{severeCount > 1 ? 's' : ''} sit on meshes with unusual UV
                layouts and were created before a fix, so they can't be placed automatically. Open
                each mesh and drag the box into place:
              </p>
              <ul className="space-y-1">
                {severeGroups.map((g) => (
                  <li
                    key={g.meshKey}
                    className="flex items-center justify-between gap-2 rounded border px-2 py-1.5"
                  >
                    <span className="truncate">
                      <span className="font-medium">{g.meshName}</span>
                      <span className="text-muted-foreground">
                        {' · '}
                        {g.annotations.length} annotation{g.annotations.length > 1 ? 's' : ''}
                      </span>
                    </span>
                    <Button size="sm" variant="outline" className="h-7 shrink-0" onClick={() => goTo(g)}>
                      Go to
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          {severeGroups.length > 0 ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={keepAsIs}
                title="Accept current positions and stop flagging them"
              >
                Keep as-is
              </Button>
              <Button size="sm" onClick={() => setDismissed(true)}>
                I'll fix these later
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => setDismissed(true)}>
              Got it
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
