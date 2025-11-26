import { Eye, Plus, Copy, Trash2, Unlock } from 'lucide-react';
import { useAnnotationStore } from '../../store/combinedStores';
import { Button } from '../ui/button';

export function AnnotationOutliner() {
  const annotations = useAnnotationStore((state) => state.annotations);
  const selectedAnnotationId = useAnnotationStore((state) => state.selectedAnnotationId);
  const setSelectedAnnotationId = useAnnotationStore((state) => state.setSelectedAnnotationId);
  const deleteAnnotation = useAnnotationStore((state) => state.deleteAnnotation);
  const addAnnotation = useAnnotationStore((state) => state.addAnnotation);
  const setPendingLabelEdit = useAnnotationStore((state) => state.setPendingLabelEdit);

  const handleDuplicate = (id: string) => {
    const original = annotations.find((a) => a.id === id);
    if (!original) return;

    const duplicate = {
      ...original,
      id: `ann-${Date.now()}`,
      x: original.x + 20,
      y: original.y + 20,
      label: original.label + ' (copy)',
    };
    addAnnotation(duplicate);
    setSelectedAnnotationId(duplicate.id);
  };

  const handleAdd = () => {
    const existingBoxCount = annotations.filter((a) => a.label.match(/^b\d+$/)).length;
    const newAnnotation = {
      id: `ann-${Date.now()}`,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      width: 200,
      height: 150,
      rotation: 0,
      label: `b${existingBoxCount + 1}`,
      color: 'red',
    };
    addAnnotation(newAnnotation);
    setPendingLabelEdit(newAnnotation.id);
  };

  return (
    <div className="h-full flex flex-col bg-muted/30 border-r">
      {/* Header */}
      <div className="p-3 border-b">
        <h2 className="text-sm font-semibold">Outliner</h2>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto">
        {annotations.map((ann) => (
          <div
            key={ann.id}
            className={`flex items-center gap-1 px-2 py-1 hover:bg-accent/50 cursor-pointer text-sm ${
              ann.id === selectedAnnotationId ? 'bg-accent' : ''
            }`}
            onClick={() => setSelectedAnnotationId(ann.id)}
          >
            {/* Icon column */}
            <button
              className="p-0.5 hover:bg-accent-foreground/10 rounded"
              onClick={(e) => {
                e.stopPropagation();
                // Toggle visibility (future feature)
              }}
            >
              <Eye className="h-3 w-3" />
            </button>

            {/* Indicator */}
            <div className={`w-1.5 h-1.5 rounded-full ${ann.id === selectedAnnotationId ? 'bg-primary' : 'bg-muted-foreground/30'}`} />

            {/* Label */}
            <span className="flex-1 truncate">{ann.label}</span>

            {/* Lock icon */}
            <button
              className="p-0.5 hover:bg-accent-foreground/10 rounded opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                // Toggle lock (future feature)
              }}
            >
              <Unlock className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="p-2 border-t flex gap-1">
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleAdd}>
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          disabled={!selectedAnnotationId}
          onClick={() => selectedAnnotationId && handleDuplicate(selectedAnnotationId)}
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          disabled={!selectedAnnotationId}
          onClick={() => selectedAnnotationId && deleteAnnotation(selectedAnnotationId)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
