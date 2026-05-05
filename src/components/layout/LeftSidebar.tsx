import { MeshList } from './MeshList';
import { AnnotationOutliner } from './AnnotationOutliner';

export function LeftSidebar() {
  return (
    <div className="h-full flex flex-col bg-muted/30 border-r overflow-hidden">
      <MeshList />
      <div className="flex-1 min-h-0 flex flex-col">
        <AnnotationOutliner />
      </div>
    </div>
  );
}
