import { useState } from 'react';
import { ChevronDown, ChevronRight, ImagePlus, Trash2 } from 'lucide-react';
import { useAnnotationStore, useModelStore, meshKeyOf, EMPTY_ANNOTATIONS } from '../../store/combinedStores';
import type { ImageAlign, ImageFit } from '../../types';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { OverlayControls } from './OverlayControls';
import { BackgroundTextureControls } from './BackgroundTextureControls';
import { MeshControls } from './MeshControls';

const ALIGN_GRID: ImageAlign[][] = [
  ['top-left', 'top-center', 'top-right'],
  ['middle-left', 'center', 'middle-right'],
  ['bottom-left', 'bottom-center', 'bottom-right'],
];

export function PropertiesPanel() {
  const meshKey = meshKeyOf(useModelStore((s) => s.selectedMesh));
  const selectedAnnotationId = useAnnotationStore((state) => state.selectedAnnotationId);
  const annotations = useAnnotationStore((state) => state.annotationsByMesh[meshKey] ?? EMPTY_ANNOTATIONS);
  const updateAnnotation = useAnnotationStore((state) => state.updateAnnotation);

  const selectedAnnotation = annotations.find((a) => a.id === selectedAnnotationId);

  const [transformOpen, setTransformOpen] = useState(true);
  const [annotationOpen, setAnnotationOpen] = useState(true);
  const [imageOpen, setImageOpen] = useState(true);

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedAnnotationId) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateAnnotation(selectedAnnotationId, {
        imageData: reader.result as string,
        imageName: file.name,
        imageFit: selectedAnnotation?.imageFit ?? 'contain',
        imageAlign: selectedAnnotation?.imageAlign ?? 'center',
        imageOpacity: selectedAnnotation?.imageOpacity ?? 1,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const clearImage = () => {
    if (!selectedAnnotationId) return;
    updateAnnotation(selectedAnnotationId, {
      imageData: undefined,
      imageName: undefined,
    });
  };

  return (
    <div className="h-full bg-muted/30 border-l overflow-auto">
      <MeshControls />
      {selectedAnnotation ? (
        <>
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

          {/* Image Section */}
          <div className="border-b">
            <button
              className="w-full flex items-center gap-2 p-3 hover:bg-accent/50 text-sm font-semibold"
              onClick={() => setImageOpen(!imageOpen)}
            >
              {imageOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Image
            </button>

            {imageOpen && (
              <div className="p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    id={`ann-image-upload-${selectedAnnotation.id}`}
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() =>
                      document.getElementById(`ann-image-upload-${selectedAnnotation.id}`)?.click()
                    }
                  >
                    <ImagePlus className="mr-2 h-3 w-3" />
                    {selectedAnnotation.imageData ? 'Change' : 'Upload'}
                  </Button>
                  {selectedAnnotation.imageData && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={clearImage}
                      title="Remove image"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {selectedAnnotation.imageData && (
                  <>
                    <div className="border rounded p-2 flex items-center gap-2">
                      <img
                        src={selectedAnnotation.imageData}
                        alt={selectedAnnotation.imageName ?? ''}
                        className="h-10 w-10 object-cover rounded border"
                      />
                      <span className="flex-1 text-xs truncate" title={selectedAnnotation.imageName ?? ''}>
                        {selectedAnnotation.imageName}
                      </span>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Fit</Label>
                      <select
                        value={selectedAnnotation.imageFit ?? 'contain'}
                        onChange={(e) =>
                          updateAnnotation(selectedAnnotation.id, {
                            imageFit: e.target.value as ImageFit,
                          })
                        }
                        className="w-full h-7 text-xs rounded border bg-background px-2"
                      >
                        <option value="fill">Fill (stretch)</option>
                        <option value="contain">Contain (fit inside)</option>
                        <option value="cover">Cover (fill &amp; crop)</option>
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Alignment</Label>
                      <div className="grid grid-cols-3 gap-1 w-fit">
                        {ALIGN_GRID.flat().map((align) => {
                          const active = (selectedAnnotation.imageAlign ?? 'center') === align;
                          return (
                            <button
                              key={align}
                              title={align}
                              onClick={() =>
                                updateAnnotation(selectedAnnotation.id, { imageAlign: align })
                              }
                              className={`h-6 w-6 border rounded flex items-center justify-center text-xs ${
                                active
                                  ? 'bg-primary border-primary'
                                  : 'bg-background hover:bg-accent border-border'
                              }`}
                            >
                              <span
                                className={`block h-1.5 w-1.5 rounded-full ${
                                  active ? 'bg-primary-foreground' : 'bg-muted-foreground/60'
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Opacity</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={Math.round((selectedAnnotation.imageOpacity ?? 1) * 100)}
                          onChange={(e) =>
                            updateAnnotation(selectedAnnotation.id, {
                              imageOpacity: Number(e.target.value) / 100,
                            })
                          }
                          className="flex-1"
                        />
                        <span className="text-xs w-8 text-right">
                          {Math.round((selectedAnnotation.imageOpacity ?? 1) * 100)}%
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="p-3 text-sm text-muted-foreground">No selection</div>
      )}

      <BackgroundTextureControls />

      {/* Overlay Section -- always visible */}
      <OverlayControls />
    </div>
  );
}
