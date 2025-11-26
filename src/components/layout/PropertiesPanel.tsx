import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useAnnotationStore } from '../../store/combinedStores';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export function PropertiesPanel() {
  const selectedAnnotationId = useAnnotationStore((state) => state.selectedAnnotationId);
  const annotations = useAnnotationStore((state) => state.annotations);
  const updateAnnotation = useAnnotationStore((state) => state.updateAnnotation);

  const selectedAnnotation = annotations.find((a) => a.id === selectedAnnotationId);

  const [transformOpen, setTransformOpen] = useState(true);
  const [annotationOpen, setAnnotationOpen] = useState(true);

  const handleNumberChange = (field: string, value: string) => {
    if (!selectedAnnotationId) return;
    const num = parseFloat(value);
    if (!isNaN(num)) {
      updateAnnotation(selectedAnnotationId, { [field]: num });
    }
  };

  const handleLabelChange = (value: string) => {
    if (!selectedAnnotationId) return;
    updateAnnotation(selectedAnnotationId, { label: value });
  };

  if (!selectedAnnotation) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/30 border-l">
        <p className="text-sm text-muted-foreground">No selection</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-muted/30 border-l overflow-auto">
      {/* Transform Section */}
      <div className="border-b">
        <button
          className="w-full flex items-center gap-2 p-3 hover:bg-accent/50 text-sm font-semibold"
          onClick={() => setTransformOpen(!transformOpen)}
        >
          {transformOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Transform
        </button>

        {transformOpen && (
          <div className="p-3 space-y-3">
            {/* Location */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Location</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs w-4">X</span>
                  <Input
                    type="number"
                    value={selectedAnnotation.x.toFixed(1)}
                    onChange={(e) => handleNumberChange('x', e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs w-4">Y</span>
                  <Input
                    type="number"
                    value={selectedAnnotation.y.toFixed(1)}
                    onChange={(e) => handleNumberChange('y', e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Size */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Size</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs w-4">W</span>
                  <Input
                    type="number"
                    value={selectedAnnotation.width.toFixed(1)}
                    onChange={(e) => handleNumberChange('width', e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs w-4">H</span>
                  <Input
                    type="number"
                    value={selectedAnnotation.height.toFixed(1)}
                    onChange={(e) => handleNumberChange('height', e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Rotation */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Rotation</Label>
              <div className="flex items-center gap-1">
                <span className="text-xs w-4">R</span>
                <Input
                  type="number"
                  value={selectedAnnotation.rotation.toFixed(1)}
                  onChange={(e) => handleNumberChange('rotation', e.target.value)}
                  className="h-7 text-xs"
                />
                <span className="text-xs">°</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Annotation Section */}
      <div className="border-b">
        <button
          className="w-full flex items-center gap-2 p-3 hover:bg-accent/50 text-sm font-semibold"
          onClick={() => setAnnotationOpen(!annotationOpen)}
        >
          {annotationOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Annotation
        </button>

        {annotationOpen && (
          <div className="p-3 space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Label</Label>
              <Input
                value={selectedAnnotation.label}
                onChange={(e) => handleLabelChange(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Color</Label>
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded border"
                  style={{ backgroundColor: selectedAnnotation.color }}
                />
                <span className="text-xs">{selectedAnnotation.color}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
