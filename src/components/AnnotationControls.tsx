import { Plus, Trash2, Tag } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import type { Annotation } from '../types';

export function AnnotationControls() {
  const annotations = useStore((state) => state.annotations);
  const selectedAnnotationId = useStore((state) => state.selectedAnnotationId);
  const addAnnotation = useStore((state) => state.addAnnotation);
  const updateAnnotation = useStore((state) => state.updateAnnotation);
  const deleteAnnotation = useStore((state) => state.deleteAnnotation);
  const clearAnnotations = useStore((state) => state.clearAnnotations);
  const setSelectedAnnotationId = useStore((state) => state.setSelectedAnnotationId);
  
  const [newLabel, setNewLabel] = useState('');

  const selectedAnnotation = annotations.find((a) => a.id === selectedAnnotationId);

  const handleAddAnnotation = () => {
    const label = newLabel.trim() || 'Annotation';
    const newAnnotation: Annotation = {
      id: `ann-${Date.now()}`,
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      rotation: 0,
      label,
    };
    addAnnotation(newAnnotation);
    setNewLabel('');
  };

  const handleDeleteSelected = () => {
    if (selectedAnnotationId) {
      deleteAnnotation(selectedAnnotationId);
    }
  };

  const handleLabelChange = (value: string) => {
    if (selectedAnnotationId) {
      updateAnnotation(selectedAnnotationId, { label: value });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Tag className="h-5 w-5" />
          Annotations ({annotations.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">New Annotation Label</label>
          <div className="flex gap-2">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Enter label..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddAnnotation();
                }
              }}
            />
            <Button onClick={handleAddAnnotation} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {selectedAnnotation && (
          <>
            <Separator />
            <div className="space-y-2">
              <label className="text-sm font-medium">Selected Annotation</label>
              <Input
                value={selectedAnnotation.label}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder="Label..."
              />
              <Button
                onClick={handleDeleteSelected}
                variant="destructive"
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Selected
              </Button>
            </div>
          </>
        )}

        {annotations.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">All Annotations</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {annotations.map((ann) => (
                  <div
                    key={ann.id}
                    onClick={() => setSelectedAnnotationId(ann.id)}
                    className={`p-2 text-sm rounded cursor-pointer transition-colors ${
                      ann.id === selectedAnnotationId
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-accent'
                    }`}
                  >
                    {ann.label}
                  </div>
                ))}
              </div>
              <Button
                onClick={clearAnnotations}
                variant="outline"
                className="w-full"
              >
                Clear All
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
