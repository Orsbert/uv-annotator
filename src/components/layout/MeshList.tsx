import { useState } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, Box } from 'lucide-react';
import { useModelStore, useAnnotationStore, meshKeyOf } from '../../store/combinedStores';

export function MeshList() {
  const meshes = useModelStore((state) => state.meshes);
  const selectedMesh = useModelStore((state) => state.selectedMesh);
  const setSelectedMesh = useModelStore((state) => state.setSelectedMesh);
  const visibilityByMesh = useModelStore((state) => state.visibilityByMesh);
  const setMeshVisibility = useModelStore((state) => state.setMeshVisibility);
  const annotationsByMesh = useAnnotationStore((state) => state.annotationsByMesh);

  const [open, setOpen] = useState(true);

  // Persisted visibility is the source of truth; absent means visible.
  const isVisible = (mesh: typeof meshes[number]) => visibilityByMesh[meshKeyOf(mesh)] ?? true;

  const toggleVisibility = (mesh: typeof meshes[number]) => {
    setMeshVisibility({ [meshKeyOf(mesh)]: !isVisible(mesh) });
  };

  // Shift-click the eye to "isolate": hide every other mesh and keep this one.
  // If this mesh is already the only one visible, restore all (toggle back).
  const isolateMesh = (mesh: typeof meshes[number]) => {
    const alreadyIsolated = meshes.every((m) => (m === mesh ? isVisible(m) : !isVisible(m)));
    const updates: Record<string, boolean> = {};
    meshes.forEach((m) => {
      updates[meshKeyOf(m)] = alreadyIsolated ? true : m === mesh;
    });
    setMeshVisibility(updates);
  };

  return (
    <div className="flex flex-col min-h-0 border-b">
      <button
        className="w-full flex items-center gap-2 p-3 hover:bg-accent/50 text-sm font-semibold border-b focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Meshes
        <span className="ml-auto text-xs text-muted-foreground">{meshes.length}</span>
      </button>

      {open && (
        <div className="flex-1 overflow-auto min-h-0 max-h-64">
          {meshes.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">No meshes loaded</p>
          )}
          {meshes.map((mesh, idx) => {
            const isSelected = selectedMesh === mesh;
            const name = mesh.name || `Mesh ${idx + 1}`;
            const count = annotationsByMesh[meshKeyOf(mesh)]?.length ?? 0;
            return (
              <div
                key={mesh.uuid}
                className={`flex items-center gap-1 pr-2 text-sm border-l-2 ${
                  isSelected ? 'bg-accent border-primary' : 'border-transparent hover:bg-accent/50'
                }`}
              >
                <button
                  className="p-1.5 rounded hover:bg-accent-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={(e) => {
                    if (e.shiftKey) isolateMesh(mesh);
                    else toggleVisibility(mesh);
                  }}
                  title={`${isVisible(mesh) ? 'Hide' : 'Show'} · ⇧ click to isolate`}
                  aria-label={isVisible(mesh) ? 'Hide mesh' : 'Show mesh'}
                >
                  {isVisible(mesh) ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>

                <button
                  className="flex-1 min-w-0 flex items-center gap-2 py-1.5 text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  onClick={() => setSelectedMesh(mesh)}
                  title={name}
                >
                  <Box className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{name}</span>
                  {count > 0 && (
                    <span className="shrink-0 text-[11px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
                      {count}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
