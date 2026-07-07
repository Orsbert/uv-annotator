import { useState } from 'react';
import { ChevronDown, ChevronRight, ImagePlus, Trash2 } from 'lucide-react';
import { useAnnotationStore, useModelStore, useCanvasStore, meshKeyOf, EMPTY_ANNOTATIONS } from '../../store/combinedStores';
import type { ImageAlign, ImageFit } from '../../types';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { OverlayControls } from './OverlayControls';
import { BackgroundTextureControls } from './BackgroundTextureControls';
import { MeshControls } from './MeshControls';
import { computeUVFrame } from '../../utils/uvGenerator';

const ALIGN_GRID: ImageAlign[][] = [
  ['top-left', 'top-center', 'top-right'],
  ['middle-left', 'center', 'middle-right'],
  ['bottom-left', 'bottom-center', 'bottom-right'],
];

export function PropertiesPanel() {
  const selectedMesh = useModelStore((s) => s.selectedMesh);
  const meshKey = meshKeyOf(selectedMesh);
  const canvasSize = useCanvasStore((s) => s.canvasSize);
  const selectedAnnotationId = useAnnotationStore((state) => state.selectedAnnotationId);
  const annotations = useAnnotationStore((state) => state.annotationsByMesh[meshKey] ?? EMPTY_ANNOTATIONS);
  const updateAnnotation = useAnnotationStore((state) => state.updateAnnotation);

  const selectedAnnotation = annotations.find((a) => a.id === selectedAnnotationId);

  // The external customizer consumes each box in the mesh's *native* UV space
  // (it maps `typed value / canvasSize` onto the model's raw UVs). For a
  // normalized mesh (identity frame) that's identical to the editor X/Y/W/H; for
  // an out-of-range mesh (e.g. the mug, UVs spanning hundreds) the editor values
  // are frame-relative and must be mapped back to native UV before pasting.
  const frame = selectedMesh ? computeUVFrame(selectedMesh) : null;
  const frameIsIdentity =
    !frame || (frame.minU === 0 && frame.minV === 0 && frame.spanU === 1 && frame.spanV === 1);
  const customizerCoords =
    selectedAnnotation && frame && !frameIsIdentity
      ? {
          x: frame.minU * canvasSize + selectedAnnotation.x * frame.spanU,
          y: frame.minV * canvasSize + selectedAnnotation.y * frame.spanV,
          width: selectedAnnotation.width * frame.spanU,
          height: selectedAnnotation.height * frame.spanV,
          spanU: frame.spanU,
          spanV: frame.spanV,
        }
      : null;

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

  const copyCustomizerCoords = () => {
    if (!customizerCoords) return;
    const { x, y, width, height } = customizerCoords;
    const text = `${x.toFixed(1)}, ${y.toFixed(1)}, ${width.toFixed(1)}, ${height.toFixed(1)}`;
    navigator.clipboard?.writeText(text);
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

          {/* Customizer coordinates — shown only for out-of-range-UV meshes,
              where the editor X/Y/W/H are frame-relative and differ from what the
              customizer expects. */}
          {customizerCoords && (
            <div className="border-b bg-amber-500/[0.06]">
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Customizer coords</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px]"
                    onClick={copyCustomizerCoords}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  This mesh's UVs run outside 0–1 (range ≈ {customizerCoords.spanU.toFixed(0)}×
                  {customizerCoords.spanV.toFixed(0)}), so the X/Y/W/H above are frame-relative.
                  Paste <span className="font-medium text-foreground">these</span> into the
                  customizer instead. If it rejects them as out of range, the model's UVs need
                  normalizing — tell me and I'll set that up.
                </p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px]">
                  <div><span className="text-muted-foreground">X </span>{customizerCoords.x.toFixed(1)}</div>
                  <div><span className="text-muted-foreground">Y </span>{customizerCoords.y.toFixed(1)}</div>
                  <div><span className="text-muted-foreground">W </span>{customizerCoords.width.toFixed(1)}</div>
                  <div><span className="text-muted-foreground">H </span>{customizerCoords.height.toFixed(1)}</div>
                </div>
              </div>
            </div>
          )}

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
