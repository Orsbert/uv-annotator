import { useState } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, Box } from 'lucide-react';
import { useModelStore } from '../../store/combinedStores';

export function MeshList() {
  const meshes = useModelStore((state) => state.meshes);
  const selectedMesh = useModelStore((state) => state.selectedMesh);
  const setSelectedMesh = useModelStore((state) => state.setSelectedMesh);

  const [open, setOpen] = useState(true);
  const [, setTick] = useState(0);

  const toggleVisibility = (mesh: typeof meshes[number]) => {
    mesh.visible = !mesh.visible;
    setTick((t) => t + 1);
  };

  return (
    <div className="flex flex-col min-h-0 border-b">
      <button
        className="w-full flex items-center gap-2 p-3 hover:bg-accent/50 text-sm font-semibold border-b"
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
            return (
              <div
                key={mesh.uuid}
                className={`flex items-center gap-1 px-2 py-1 hover:bg-accent/50 cursor-pointer text-sm ${
                  isSelected ? 'bg-accent' : ''
                }`}
                onClick={() => setSelectedMesh(mesh)}
              >
                <button
                  className="p-0.5 hover:bg-accent-foreground/10 rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleVisibility(mesh);
                  }}
                  title={mesh.visible ? 'Hide' : 'Show'}
                >
                  {mesh.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}
                </button>

                <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-primary' : 'bg-muted-foreground/30'}`} />

                <Box className="h-3 w-3 text-muted-foreground" />

                <span className="flex-1 truncate" title={name}>{name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
