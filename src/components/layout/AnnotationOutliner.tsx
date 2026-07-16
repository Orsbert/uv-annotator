import { useState, type MouseEvent as ReactMouseEvent } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, Plus, Copy, Trash2, Wand2 } from 'lucide-react';
import { useAnnotationStore, useModelStore, useCanvasStore, meshKeyOf, EMPTY_ANNOTATIONS } from '../../store/combinedStores';
import { ANNOTATION_COLORS, getColorTheme } from '../../types';
import { Button } from '../ui/button';
import { computeUVBoundingBox } from '../../utils/uvGenerator';

export function AnnotationOutliner() {
  const selectedMesh = useModelStore((s) => s.selectedMesh);
  const meshKey = meshKeyOf(selectedMesh);
  const canvasSize = useCanvasStore((s) => s.canvasSize);
  const annotations = useAnnotationStore((state) => state.annotationsByMesh[meshKey] ?? EMPTY_ANNOTATIONS);
  const selectedAnnotationId = useAnnotationStore((state) => state.selectedAnnotationId);
  const selectedAnnotationIds = useAnnotationStore((state) => state.selectedAnnotationIds);
  const setSelectedAnnotationId = useAnnotationStore((state) => state.setSelectedAnnotationId);
  const setSelectedAnnotationIds = useAnnotationStore((state) => state.setSelectedAnnotationIds);
  const toggleAnnotationSelection = useAnnotationStore((state) => state.toggleAnnotationSelection);
  const deleteAnnotations = useAnnotationStore((state) => state.deleteAnnotations);
  const updateAnnotation = useAnnotationStore((state) => state.updateAnnotation);
  const addAnnotation = useAnnotationStore((state) => state.addAnnotation);
  const setPendingLabelEdit = useAnnotationStore((state) => state.setPendingLabelEdit);

  const [open, setOpen] = useState(true);

  // Row click with Figma-style modifiers: shift = range from the active row,
  // cmd/ctrl = toggle one, plain = select only.
  const handleRowClick = (e: ReactMouseEvent, id: string) => {
    if (e.shiftKey && selectedAnnotationId) {
      const ids = annotations.map((a) => a.id);
      const from = ids.indexOf(selectedAnnotationId);
      const to = ids.indexOf(id);
      if (from !== -1 && to !== -1) {
        const [lo, hi] = from < to ? [from, to] : [to, from];
        setSelectedAnnotationIds(Array.from(new Set([...selectedAnnotationIds, ...ids.slice(lo, hi + 1)])));
        return;
      }
    }
    if (e.metaKey || e.ctrlKey) {
      toggleAnnotationSelection(id);
      return;
    }
    setSelectedAnnotationId(id);
  };

  const handleDuplicate = (id: string) => {
    const original = annotations.find((a) => a.id === id);
    if (!original) return;

    const colorIndex = annotations.length % ANNOTATION_COLORS.length;
    const duplicate = {
      ...original,
      id: `ann-${Date.now()}`,
      x: original.x + 20,
      y: original.y + 20,
      label: original.label + ' (copy)',
      color: ANNOTATION_COLORS[colorIndex].name,
      visible: true,
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
      color: ANNOTATION_COLORS[annotations.length % ANNOTATION_COLORS.length].name,
      visible: true,
    };
    addAnnotation(newAnnotation);
    setPendingLabelEdit(newAnnotation.id);
  };

  const handleAutoFit = () => {
    if (!selectedMesh) return;
    const box = computeUVBoundingBox(selectedMesh, canvasSize);
    if (!box) {
      alert('No UV data on this mesh');
      return;
    }
    const existingBoxCount = annotations.filter((a) => a.label.match(/^b\d+$/)).length;
    const newAnnotation = {
      id: `ann-${Date.now()}`,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      rotation: 0,
      label: `b${existingBoxCount + 1}`,
      color: ANNOTATION_COLORS[annotations.length % ANNOTATION_COLORS.length].name,
      visible: true,
    };
    addAnnotation(newAnnotation);
    setPendingLabelEdit(newAnnotation.id);
  };

  return (
    <div className="flex flex-col min-h-0">
      {/* Section header */}
      <button
        className="w-full flex items-center gap-2 p-3 hover:bg-accent/50 text-sm font-semibold border-b focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="shrink-0">Annotations</span>
        {selectedMesh?.name && (
          <span className="min-w-0 truncate text-xs font-normal text-muted-foreground">· {selectedMesh.name}</span>
        )}
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {selectedAnnotationIds.length > 1 ? `${selectedAnnotationIds.length} / ${annotations.length}` : annotations.length}
        </span>
      </button>

      {open && (
        <>
          {/* List */}
          <div className="flex-1 overflow-auto min-h-0">
            {annotations.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">No annotations</p>
            )}
            {annotations.map((ann) => {
              const isSel = selectedAnnotationIds.includes(ann.id);
              return (
                <div
                  key={ann.id}
                  className={`flex items-center gap-1 pr-2 text-sm border-l-2 ${
                    isSel ? 'bg-accent border-primary' : 'border-transparent hover:bg-accent/50'
                  }`}
                >
                  <button
                    className="p-1.5 rounded hover:bg-accent-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => updateAnnotation(ann.id, { visible: ann.visible === false })}
                    aria-label={ann.visible !== false ? 'Hide annotation' : 'Show annotation'}
                  >
                    {ann.visible !== false ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                  </button>

                  <button
                    className="flex-1 min-w-0 flex items-center gap-2 py-1.5 text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    onClick={(e) => handleRowClick(e, ann.id)}
                    title={ann.label}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: getColorTheme(ann.color).main }}
                    />
                    <span className="flex-1 truncate">{ann.label}</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="p-2 border-t flex gap-1">
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleAdd} title="Add annotation">
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              disabled={!selectedMesh}
              onClick={handleAutoFit}
              title="Auto-fit box to UV island"
            >
              <Wand2 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              disabled={!selectedAnnotationId}
              onClick={() => selectedAnnotationId && handleDuplicate(selectedAnnotationId)}
              title="Duplicate"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              disabled={selectedAnnotationIds.length === 0}
              onClick={() => selectedAnnotationIds.length > 0 && deleteAnnotations(selectedAnnotationIds)}
              title={selectedAnnotationIds.length > 1 ? `Delete ${selectedAnnotationIds.length}` : 'Delete'}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
