import { Box, Layers } from 'lucide-react';
import { useModelStore } from '../store/combinedStores';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { cn } from '../lib/utils';

export function MeshSelector() {
  const meshes = useModelStore((state) => state.meshes);
  const selectedMesh = useModelStore((state) => state.selectedMesh);
  const setSelectedMesh = useModelStore((state) => state.setSelectedMesh);

  if (meshes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Meshes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No meshes available. Upload a model first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Meshes ({meshes.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {meshes.map((mesh, index) => {
          const isSelected = mesh === selectedMesh;
          const meshName = mesh.name || `Mesh ${index + 1}`;
          
          return (
            <div
              key={mesh.uuid}
              onClick={() => setSelectedMesh(mesh)}
              className={cn(
                "flex items-center gap-2 p-3 rounded-md border cursor-pointer transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card hover:bg-accent border-border"
              )}
            >
              <Box className="h-4 w-4" />
              <span className="text-sm font-medium">{meshName}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
