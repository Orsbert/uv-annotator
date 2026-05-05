import { Download, Sparkles, Keyboard, Paintbrush, Check, Menu, Upload, ImagePlus, Box } from 'lucide-react';
import { useModelStore } from '../store/combinedStores';
import { useCanvasStore } from '../store/combinedStores';
import { useAnnotationStore } from '../store/combinedStores';
import { usePaintStore, useOverlayStore, CANVAS_SCALE_OPTIONS } from '../store/combinedStores';
import { useSessionStore } from '../store/useSessionStore';
import { Button } from './ui/button';
import { generateUVLayout } from '../utils/uvGenerator';
import { renderAnnotationsToCanvas, renderOverlaysToCanvas } from '../services/annotationRenderer';
import { useState } from 'react';
import { GLTFExporter } from 'three-stdlib';
import * as THREE from 'three';

interface ToolbarProps {
  onToggleSidebar: () => void;
}

export function Toolbar({ onToggleSidebar }: ToolbarProps) {
  const selectedMesh = useModelStore((state) => state.selectedMesh);
  const uvCanvas = useCanvasStore((state) => state.uvCanvas);
  const setUVTexture = useCanvasStore((state) => state.setUVTexture);
  const setUVCanvas = useCanvasStore((state) => state.setUVCanvas);
  const canvasSize = useCanvasStore((state) => state.canvasSize);
  const setCanvasSize = useCanvasStore((state) => state.setCanvasSize);
  const annotations = useAnnotationStore((state) => state.annotations);
  const isPaintMode = usePaintStore((state) => state.isPaintMode);
  const setPaintMode = usePaintStore((state) => state.setPaintMode);
  const brushSize = usePaintStore((state) => state.brushSize);
  const setBrushSize = usePaintStore((state) => state.setBrushSize);
  const createAnnotationFromPaint = usePaintStore((state) => state.createAnnotationFromPaint);
  const paintedUVCoords = usePaintStore((state) => state.paintedUVCoords);
  const overlays = useOverlayStore((state) => state.overlays);
  const model = useModelStore((state) => state.model);
  const modelName = useModelStore((state) => state.modelName);
  const uvTexture = useCanvasStore((state) => state.uvTexture);

  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const [exportFormat, setExportFormat] = useState<'glb' | 'gltf'>('glb');
  const [bakeAnnotations, setBakeAnnotations] = useState(false);
  const [applyTransforms, setApplyTransforms] = useState(true);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const sessions = useSessionStore((state) => state.sessions);
  const currentSession = sessions.find(s => s.id === currentSessionId);
  
  const [showShortcuts, setShowShortcuts] = useState(false);



  const handleGenerateUV = () => {
    if (!selectedMesh) {
      alert('Please select a mesh first');
      return;
    }

    try {
      const { canvas, texture } = generateUVLayout(selectedMesh, canvasSize);
      setUVTexture(texture);
      setUVCanvas(canvas);
    } catch (error) {
      console.error('Error generating UV layout:', error);
      alert('Failed to generate UV layout');
    }
  };

  const handleTogglePaintMode = () => {
    setPaintMode(!isPaintMode);
  };

  const handleFinishPainting = () => {
    createAnnotationFromPaint();
  };

  const baseFileName = () => {
    const name = modelName ?? currentSession?.name ?? 'model';
    return name.replace(/\.(glb|gltf)$/i, '');
  };

  const handleExportModel = async (format: 'glb' | 'gltf') => {
    if (!model) {
      alert('Please upload a model first');
      return;
    }

    // Clone the scene so we don't mutate the live model
    const exportScene = model.clone(true);

    // If we don't want annotations baked in, replace the texture map.
    // If a background image was uploaded, use that as a clean texture; otherwise drop the map.
    if (!bakeAnnotations && uvTexture) {
      const bg = useCanvasStore.getState().backgroundImage;
      let cleanTexture: THREE.Texture | null = null;
      if (bg && bg.complete && bg.naturalWidth > 0 && uvCanvas) {
        const cleanCanvas = document.createElement('canvas');
        cleanCanvas.width = uvCanvas.width;
        cleanCanvas.height = uvCanvas.height;
        const cctx = cleanCanvas.getContext('2d');
        if (cctx) cctx.drawImage(bg, 0, 0, cleanCanvas.width, cleanCanvas.height);
        cleanTexture = new THREE.CanvasTexture(cleanCanvas);
        cleanTexture.colorSpace = THREE.SRGBColorSpace;
        cleanTexture.flipY = false;
      }

      exportScene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const mat = obj.material as THREE.MeshStandardMaterial | undefined;
          if (mat && mat.map === uvTexture) {
            const clonedMat = mat.clone();
            clonedMat.map = cleanTexture;
            clonedMat.needsUpdate = true;
            obj.material = clonedMat;
          }
        }
      });
    } else if (uvTexture) {
      uvTexture.needsUpdate = true;
    }

    // Apply transforms to geometry: bake each mesh's matrixWorld into its
    // vertex positions and reset the transform to identity.
    if (applyTransforms) {
      exportScene.updateMatrixWorld(true);
      exportScene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const geom = obj.geometry.clone();
          geom.applyMatrix4(obj.matrixWorld);
          obj.geometry = geom;
          obj.position.set(0, 0, 0);
          obj.rotation.set(0, 0, 0);
          obj.scale.set(1, 1, 1);
          obj.updateMatrix();
        }
      });
      exportScene.position.set(0, 0, 0);
      exportScene.rotation.set(0, 0, 0);
      exportScene.scale.set(1, 1, 1);
      exportScene.updateMatrix();
    }

    try {
      const exporter = new GLTFExporter();
      const result: ArrayBuffer | object = await new Promise((resolve, reject) => {
        exporter.parse(
          exportScene,
          (gltf) => resolve(gltf as ArrayBuffer | object),
          (err) => reject(err),
          { binary: format === 'glb', embedImages: true }
        );
      });

      const blob =
        format === 'glb'
          ? new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' })
          : new Blob([JSON.stringify(result)], { type: 'model/gltf+json' });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseFileName()}-export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export model');
    } finally {
      setExportMenuOpen(false);
    }
  };

  const handleExport = () => {
    if (!uvCanvas) {
      alert('Please generate UV layout first');
      return;
    }

    // Create a temporary canvas for export
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvasSize;
    exportCanvas.height = canvasSize;
    const ctx = exportCanvas.getContext('2d');
    
    if (!ctx) return;

    // Draw the UV layout
    ctx.drawImage(uvCanvas, 0, 0);

    // Draw overlays
    renderOverlaysToCanvas(ctx, overlays);

    // Draw annotations on top
    renderAnnotationsToCanvas(ctx, annotations);

    // Export as PNG
    exportCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `uv-annotation-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="h-16 border-b bg-card px-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar}>
          <Menu className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">UV Annotator</h1>
        {currentSession && (
          <span className="text-sm text-muted-foreground ml-2 border-l pl-2">
            {currentSession.name}
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <input
          type="file"
          id="model-upload"
          accept=".gltf,.glb"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            try {
              const buffer = await file.arrayBuffer();
              useModelStore.getState().setModelBuffer(buffer, file.name);
              await useModelStore.getState().loadModelFromBuffer();
              
              if (currentSessionId) {
                useSessionStore.getState().updateSession(currentSessionId, { name: file.name, modelName: file.name });
              }
            } catch (error) {
              console.error('Error reading file:', error);
              alert('Failed to read file.');
            }
          }}
        />
        <Button
          onClick={() => document.getElementById('model-upload')?.click()}
          variant="outline"
          title="Upload Model"
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload Model
        </Button>

        <Button
          onClick={() => document.getElementById('overlay-upload')?.click()}
          variant="outline"
          disabled={!uvCanvas}
          title="Upload Template Overlay"
        >
          <ImagePlus className="mr-2 h-4 w-4" />
          Overlay
        </Button>

        {isPaintMode && (
          <>
            <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded">
              <label className="text-sm">Brush Size:</label>
              <input
                type="range"
                min="5"
                max="50"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm w-8">{brushSize}</span>
            </div>
            <Button
              onClick={handleFinishPainting}
              variant="default"
              disabled={paintedUVCoords.length === 0}
            >
              <Check className="mr-2 h-4 w-4" />
              Finish & Create Box
            </Button>
          </>
        )}
        
        <Button
          onClick={handleTogglePaintMode}
          variant={isPaintMode ? "default" : "outline"}
          disabled={!uvCanvas}
          title="Paint Mode (P)"
        >
          <Paintbrush className="mr-2 h-4 w-4" />
          {isPaintMode ? 'Exit Paint Mode' : 'Paint Mode'}
        </Button>
        
        <Button
          onClick={() => setShowShortcuts(!showShortcuts)}
          variant="ghost"
          size="icon"
          title="Keyboard Shortcuts (K)"
        >
          <Keyboard className="h-5 w-5" />
        </Button>
        
        {/* Canvas scale selector */}
        <select
          value={canvasSize}
          onChange={(e) => setCanvasSize(Number(e.target.value) as typeof canvasSize)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
          title="Canvas resolution"
        >
          {CANVAS_SCALE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}x{size}
            </option>
          ))}
        </select>

        <Button
          onClick={handleGenerateUV}
          disabled={!selectedMesh}
          title="Generate UV Layout (G)"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Generate UV Layout
        </Button>

        {/* Export menu */}
        <div className="relative">
          <Button
            onClick={() => setExportMenuOpen((o) => !o)}
            variant="secondary"
            title="Export"
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          {exportMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setExportMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-72 rounded-md border bg-popover shadow-lg z-50 p-2 space-y-1">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  3D Model
                </div>

                <div className="px-2 py-1 flex items-center gap-2 text-xs">
                  <span>Format:</span>
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as 'glb' | 'gltf')}
                    className="h-7 rounded border bg-background px-2 text-xs flex-1"
                  >
                    <option value="glb">GLB (binary)</option>
                    <option value="gltf">glTF (JSON)</option>
                  </select>
                </div>

                <label className="px-2 py-1 flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyTransforms}
                    onChange={(e) => setApplyTransforms(e.target.checked)}
                    className="h-3 w-3"
                  />
                  Apply transforms to geometry
                </label>

                <label className="px-2 py-1 flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bakeAnnotations}
                    onChange={(e) => setBakeAnnotations(e.target.checked)}
                    className="h-3 w-3"
                  />
                  Bake annotations into texture
                </label>

                <Button
                  size="sm"
                  variant="default"
                  className="w-full justify-start"
                  disabled={!model}
                  onClick={() => handleExportModel(exportFormat)}
                >
                  <Box className="mr-2 h-3 w-3" />
                  Export {exportFormat.toUpperCase()}
                </Button>

                <div className="border-t my-1" />

                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  UV Texture
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full justify-start"
                  disabled={!uvCanvas}
                  onClick={() => { handleExport(); setExportMenuOpen(false); }}
                >
                  <Download className="mr-2 h-3 w-3" />
                  Export PNG ({canvasSize}x{canvasSize})
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {showShortcuts && (
        <div className="absolute top-16 right-4 bg-card border rounded-lg shadow-lg p-4 z-50 max-w-md">
          <h3 className="font-semibold mb-2">How to Use</h3>
          <div className="space-y-1 text-sm mb-3">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Draw Annotation</span>
              <kbd className="px-2 py-1 bg-muted rounded">Click & Drag</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Paint on 3D Model</span>
              <kbd className="px-2 py-1 bg-muted rounded">Click & Drag (Paint Mode)</kbd>
            </div>
          </div>
          <h3 className="font-semibold mb-2">Keyboard Shortcuts</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Toggle Paint Mode</span>
              <kbd className="px-2 py-1 bg-muted rounded">P</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Add Annotation</span>
              <kbd className="px-2 py-1 bg-muted rounded">A</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Delete Selected</span>
              <kbd className="px-2 py-1 bg-muted rounded">Delete</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Generate UV</span>
              <kbd className="px-2 py-1 bg-muted rounded">G</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Export</span>
              <kbd className="px-2 py-1 bg-muted rounded">Ctrl/Cmd + E</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Deselect / Exit Paint</span>
              <kbd className="px-2 py-1 bg-muted rounded">Esc</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Toggle Overlay</span>
              <kbd className="px-2 py-1 bg-muted rounded">T</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Toggle Help</span>
              <kbd className="px-2 py-1 bg-muted rounded">K</kbd>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
