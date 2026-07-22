import { Box, Trash2 } from 'lucide-react';
import { useAnnotationStore, useModelStore, meshKeyOf, EMPTY_ANNOTATIONS } from '../../store/combinedStores';
import { OverlayControls } from './OverlayControls';
import { ReferenceControls } from './ReferenceControls';
import { BackgroundTextureControls } from './BackgroundTextureControls';
import { MeshControls } from './MeshControls';
import { RegionProperties } from './RegionProperties';
import { Button } from '../ui/button';

/**
 * Selection-driven properties panel. It renders exactly one context:
 *   - nothing selected  → an empty prompt
 *   - a mesh selected    → the mesh view (transform, opacity, background, overlays)
 *   - a region selected  → the region view (identity + transform, style, image)
 * A "region" is only meaningful within its mesh, so the derived
 * `selectedAnnotation` (scoped to the selected mesh) is what flips us into the
 * region view.
 */
export function PropertiesPanel() {
  const selectedMesh = useModelStore((s) => s.selectedMesh);
  const meshKey = meshKeyOf(selectedMesh);
  const selectedAnnotationId = useAnnotationStore((s) => s.selectedAnnotationId);
  const selectedAnnotationIds = useAnnotationStore((s) => s.selectedAnnotationIds);
  const annotations = useAnnotationStore((s) => s.annotationsByMesh[meshKey] ?? EMPTY_ANNOTATIONS);
  const setSelectedAnnotationId = useAnnotationStore((s) => s.setSelectedAnnotationId);
  const setSelectedAnnotationIds = useAnnotationStore((s) => s.setSelectedAnnotationIds);
  const deleteAnnotations = useAnnotationStore((s) => s.deleteAnnotations);

  const selectedAnnotation = annotations.find((a) => a.id === selectedAnnotationId);

  return (
    <div className="h-full overflow-auto border-l bg-muted/30">
      {selectedAnnotationIds.length > 1 ? (
        <MultiSelectionView
          count={selectedAnnotationIds.length}
          onClear={() => setSelectedAnnotationIds([])}
          onDelete={() => deleteAnnotations(selectedAnnotationIds)}
        />
      ) : selectedAnnotation ? (
        <RegionProperties
          annotation={selectedAnnotation}
          meshName={selectedMesh?.name || 'mesh'}
          onBackToMesh={() => setSelectedAnnotationId(null)}
        />
      ) : selectedMesh ? (
        <MeshView meshName={selectedMesh.name} />
      ) : (
        <div className="py-2">
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">Nothing selected</p>
            <p className="text-xs text-muted-foreground/70">
              Pick a mesh from the list, or draw a region on the UV map.
            </p>
          </div>
          {/* Reference images are scene-global, so keep them reachable here too. */}
          <ReferenceControls />
        </div>
      )}
    </div>
  );
}

/** Mesh-level context: everything about the selected mesh's canvas. */
function MeshView({ meshName }: { meshName: string }) {
  return (
    <div className="py-2">
      <div className="flex items-center gap-2 px-4 pb-2 pt-2">
        <Box className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-medium" title={meshName}>
          {meshName || 'Unnamed mesh'}
        </span>
      </div>
      <MeshControls />
      <BackgroundTextureControls />
      <OverlayControls />
      <ReferenceControls />
    </div>
  );
}

/** Shown when more than one region is selected: a summary + group actions. */
function MultiSelectionView({
  count,
  onClear,
  onDelete,
}: {
  count: number;
  onClear: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="py-2">
      <div className="flex items-center gap-2 px-4 pb-2 pt-2">
        <span className="truncate text-sm font-medium">{count} annotations selected</span>
      </div>
      <div className="space-y-3 px-4 py-2">
        <p className="text-xs text-muted-foreground">
          Drag any one on the UV map to move them together. Shift- or ⌘-click a box to add or remove it.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={onClear}>
            Clear
          </Button>
          <Button size="sm" variant="destructive" className="flex-1" onClick={onDelete}>
            <Trash2 className="mr-2 h-3 w-3" /> Delete all
          </Button>
        </div>
      </div>
    </div>
  );
}
