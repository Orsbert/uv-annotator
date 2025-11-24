import { Plus, Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import type { Annotation } from '../types';
import { useState, useEffect } from 'react';

export function AnnotationControls() {
  const annotations = useStore((state) => state.annotations);
  const selectedAnnotationId = useStore((state) => state.selectedAnnotationId);
  const pendingLabelEdit = useStore((state) => state.pendingLabelEdit);
  const addAnnotation = useStore((state) => state.addAnnotation);
  const updateAnnotation = useStore((state) => state.updateAnnotation);
  const deleteAnnotation = useStore((state) => state.deleteAnnotation);
  const setSelectedAnnotationId = useStore((state) => state.setSelectedAnnotationId);
  const setPendingLabelEdit = useStore((state) => state.setPendingLabelEdit);

  const selectedAnnotation = annotations.find((ann) => ann.id === selectedAnnotationId);
  const [labelDialogValue, setLabelDialogValue] = useState('');

  // Show dialog when pendingLabelEdit is set
  useEffect(() => {
    if (pendingLabelEdit) {
      const ann = annotations.find(a => a.id === pendingLabelEdit);
      if (ann) {
        setLabelDialogValue(ann.label);
      }
    }
  }, [pendingLabelEdit, annotations]);

  const handleAddAnnotation = () => {
    const existingBoxCount = annotations.filter(a => a.label.match(/^b\d+$/)).length;
    const newAnnotation: Annotation = {
      id: `ann-${Date.now()}`,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      width: 200,
      height: 150,
      rotation: 0,
      label: `b${existingBoxCount + 1}`,
    };
    addAnnotation(newAnnotation);
    setPendingLabelEdit(newAnnotation.id);
  };

  const handleDeleteAnnotation = () => {
    if (selectedAnnotationId) {
      deleteAnnotation(selectedAnnotationId);
    }
  };

  const handleLabelChange = (label: string) => {
    if (selectedAnnotationId) {
      updateAnnotation(selectedAnnotationId, { label });
    }
  };

  const handleLabelDialogSubmit = () => {
    if (pendingLabelEdit && labelDialogValue.trim()) {
      updateAnnotation(pendingLabelEdit, { label: labelDialogValue.trim() });
    }
    setPendingLabelEdit(null);
  };

  const handleNumberFieldChange = (field: keyof Annotation, value: string) => {
    if (!selectedAnnotationId) return;
    const num = parseFloat(value);
    if (!isNaN(num)) {
      updateAnnotation(selectedAnnotationId, { [field]: num });
    }
  };

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle>Annotations</CardTitle>
          <CardDescription>
            Manage annotation boxes
          </CardDescription>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-auto">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={handleAddAnnotation}
                className="flex-1"
                size="sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Annotation
              </Button>
              
              <Button
                onClick={handleDeleteAnnotation}
                disabled={!selectedAnnotationId}
                variant="destructive"
                size="sm"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <Separator />

            {selectedAnnotation && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Label</label>
                  <Input
                    value={selectedAnnotation.label}
                    onChange={(e) => handleLabelChange(e.target.value)}
                    placeholder="Annotation label"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">X</label>
                    <Input
                      type="number"
                      value={selectedAnnotation.x.toFixed(1)}
                      onChange={(e) => handleNumberFieldChange('x', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Y</label>
                    <Input
                      type="number"
                      value={selectedAnnotation.y.toFixed(1)}
                      onChange={(e) => handleNumberFieldChange('y', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Width</label>
                    <Input
                      type="number"
                      value={selectedAnnotation.width.toFixed(1)}
                      onChange={(e) => handleNumberFieldChange('width', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Height</label>
                    <Input
                      type="number"
                      value={selectedAnnotation.height.toFixed(1)}
                      onChange={(e) => handleNumberFieldChange('height', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">Rotation</label>
                    <Input
                      type="number"
                      value={selectedAnnotation.rotation.toFixed(1)}
                      onChange={(e) => handleNumberFieldChange('rotation', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {annotations.length > 0 && (
              <>
                <Separator />
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">All Annotations</label>
                  <div className="space-y-1">
                    {annotations.map((ann) => (
                      <button
                        key={ann.id}
                        onClick={() => setSelectedAnnotationId(ann.id)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                          ann.id === selectedAnnotationId
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
                        }`}
                      >
                        {ann.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {annotations.length === 0 && !selectedAnnotation && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No annotations yet. Draw on the UV canvas to create one.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!pendingLabelEdit} onOpenChange={(open) => !open && setPendingLabelEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Label</DialogTitle>
          </DialogHeader>
          <Input
            value={labelDialogValue}
            onChange={(e) => setLabelDialogValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleLabelDialogSubmit();
              }
            }}
            placeholder="Enter annotation label"
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setPendingLabelEdit(null)}>
              Cancel
            </Button>
            <Button onClick={handleLabelDialogSubmit}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
