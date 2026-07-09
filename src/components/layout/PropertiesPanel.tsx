import { Box } from 'lucide-react';
import { useAnnotationStore, useModelStore, meshKeyOf, EMPTY_ANNOTATIONS } from '../../store/combinedStores';
import { OverlayControls } from './OverlayControls';
import { BackgroundTextureControls } from './BackgroundTextureControls';
import { MeshControls } from './MeshControls';
import { RegionProperties } from './RegionProperties';

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
  const annotations = useAnnotationStore((s) => s.annotationsByMesh[meshKey] ?? EMPTY_ANNOTATIONS);
  const setSelectedAnnotationId = useAnnotationStore((s) => s.setSelectedAnnotationId);

  const selectedAnnotation = annotations.find((a) => a.id === selectedAnnotationId);

  return (
    <div className="h-full overflow-auto border-l bg-muted/30">
      {selectedAnnotation ? (
        <RegionProperties
          annotation={selectedAnnotation}
          meshName={selectedMesh?.name || 'mesh'}
          onBackToMesh={() => setSelectedAnnotationId(null)}
        />
      ) : selectedMesh ? (
        <MeshView meshName={selectedMesh.name} />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-sm text-muted-foreground">Nothing selected</p>
          <p className="text-xs text-muted-foreground/70">
            Pick a mesh from the list, or draw a region on the UV map.
          </p>
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
    </div>
  );
}
