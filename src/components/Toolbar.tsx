import { Download, Sparkles, Keyboard, Paintbrush, Check, Menu, Upload, ImagePlus, Box, Undo2, Redo2 } from 'lucide-react';
import { useModelStore, meshKeyOf, EMPTY_ANNOTATIONS, useHistoryStore } from '../store/combinedStores';
import { useCanvasStore } from '../store/combinedStores';
import { useAnnotationStore } from '../store/combinedStores';
import { usePaintStore, useOverlayStore, CANVAS_SCALE_OPTIONS } from '../store/combinedStores';
import { useSessionStore } from '../store/useSessionStore';
import { Button } from './ui/button';
import { generateUVLayout } from '../utils/uvGenerator';
import { renderAnnotationsToCanvas, renderOverlaysToCanvas } from '../services/annotationRenderer';
import { useEffect, useState } from 'react';
import { GLTFExporter } from 'three-stdlib';
import * as THREE from 'three';

interface ToolbarProps {
  onToggleSidebar: () => void;
}

export function Toolbar({ onToggleSidebar }: ToolbarProps) {
  const selectedMesh = useModelStore((state) => state.selectedMesh);
  const meshKey = meshKeyOf(selectedMesh);
  const uvCanvas = useCanvasStore((state) => state.canvasByMesh[meshKey] ?? null);
  const setMeshCanvas = useCanvasStore((state) => state.setMeshCanvas);
  const canvasSize = useCanvasStore((state) => state.canvasSize);
  const setCanvasSize = useCanvasStore((state) => state.setCanvasSize);
  const annotations = useAnnotationStore((state) => state.annotationsByMesh[meshKey] ?? EMPTY_ANNOTATIONS);
  const isPaintMode = usePaintStore((state) => state.isPaintMode);
  const setPaintMode = usePaintStore((state) => state.setPaintMode);
  const brushSize = usePaintStore((state) => state.brushSize);
  const setBrushSize = usePaintStore((state) => state.setBrushSize);
  const createAnnotationFromPaint = usePaintStore((state) => state.createAnnotationFromPaint);
  const paintedUVCoords = usePaintStore((state) => state.paintedUVCoords);
  const overlays = useOverlayStore((state) => state.overlays);
  const model = useModelStore((state) => state.model);
  const modelName = useModelStore((state) => state.modelName);

  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const [exportFormat, setExportFormat] = useState<'glb' | 'gltf'>('glb');
  const [bakeAnnotations, setBakeAnnotations] = useState(false);
  const [applyTransforms, setApplyTransforms] = useState(true);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const meshes = useModelStore((state) => state.meshes);
  const [selectedMeshKeys, setSelectedMeshKeys] = useState<Set<string>>(new Set());
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);

  // Default to all meshes selected when the mesh list changes
  useEffect(() => {
    setSelectedMeshKeys(new Set(meshes.map(meshKeyOf)));
  }, [meshes]);

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
      setMeshCanvas(meshKey, canvas, texture);
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

  // Swap any per-mesh live textures on a cloned scene for clean (bg-only) versions
  // when annotations should not be baked.
  const swapTexturesForExport = (root: THREE.Object3D) => {
    const { textureByMesh, backgroundImagesByMesh } = useCanvasStore.getState();
    const liveTextures = new Set<THREE.Texture>(Object.values(textureByMesh));
    const textureToMeshKey = new Map<THREE.Texture, string>();
    Object.entries(textureByMesh).forEach(([k, t]) => textureToMeshKey.set(t, k));

    if (!bakeAnnotations) {
      root.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        const mat = obj.material as THREE.MeshStandardMaterial | undefined;
        if (!mat || !mat.map || !liveTextures.has(mat.map)) return;
        const mkey = textureToMeshKey.get(mat.map) ?? '';
        const bg = backgroundImagesByMesh[mkey];
        let cleanTexture: THREE.Texture | null = null;
        if (bg && bg.complete && bg.naturalWidth > 0) {
          const c = document.createElement('canvas');
          c.width = canvasSize;
          c.height = canvasSize;
          const cctx = c.getContext('2d');
          if (cctx) cctx.drawImage(bg, 0, 0, c.width, c.height);
          cleanTexture = new THREE.CanvasTexture(c);
          cleanTexture.colorSpace = THREE.SRGBColorSpace;
          cleanTexture.flipY = false;
        }
        const clonedMat = mat.clone();
        clonedMat.map = cleanTexture;
        clonedMat.needsUpdate = true;
        obj.material = clonedMat;
      });
    } else {
      liveTextures.forEach((t) => { t.needsUpdate = true; });
    }
  };

  // Bake each mesh's matrixWorld into its geometry and reset transforms.
  const bakeTransforms = (root: THREE.Object3D) => {
    root.updateMatrixWorld(true);
    root.traverse((obj) => {
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
    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    root.scale.set(1, 1, 1);
    root.updateMatrix();
  };

  const exportSceneToFile = async (
    root: THREE.Object3D,
    format: 'glb' | 'gltf',
    fileName: string
  ) => {
    const exporter = new GLTFExporter();
    const result: ArrayBuffer | object = await new Promise((resolve, reject) => {
      exporter.parse(
        root,
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
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const safeFileSegment = (s: string) => s.replace(/[^a-z0-9_-]/gi, '_') || 'mesh';

  const handleExportModel = async (
    format: 'glb' | 'gltf',
    mode: 'combined' | 'separate'
  ) => {
    if (!model) {
      alert('Please upload a model first');
      return;
    }
    if (selectedMeshKeys.size === 0) {
      alert('Select at least one mesh to export');
      return;
    }

    try {
      if (mode === 'combined') {
        // Clone the scene; remove meshes that aren't checked.
        const exportScene = model.clone(true);
        const toRemove: THREE.Object3D[] = [];
        exportScene.traverse((obj) => {
          if (obj instanceof THREE.Mesh && !selectedMeshKeys.has(meshKeyOf(obj))) {
            toRemove.push(obj);
          }
        });
        toRemove.forEach((obj) => obj.parent?.remove(obj));

        swapTexturesForExport(exportScene);
        if (applyTransforms) bakeTransforms(exportScene);

        await exportSceneToFile(exportScene, format, `${baseFileName()}-export.${format}`);
      } else {
        // Separate: one file per checked mesh, preserving each mesh's world transform.
        for (const mesh of meshes) {
          const key = meshKeyOf(mesh);
          if (!selectedMeshKeys.has(key)) continue;

          mesh.updateMatrixWorld(true);
          const cloneMesh = mesh.clone();
          // Bake the mesh's world transform into the clone's local matrix so that,
          // when wrapped in a fresh Group at origin, it ends up where it was.
          cloneMesh.matrix.copy(mesh.matrixWorld);
          cloneMesh.matrix.decompose(cloneMesh.position, cloneMesh.quaternion, cloneMesh.scale);

          const wrap = new THREE.Group();
          wrap.add(cloneMesh);

          swapTexturesForExport(wrap);
          if (applyTransforms) bakeTransforms(wrap);

          const name = safeFileSegment(mesh.name || `mesh_${key}`);
          await exportSceneToFile(wrap, format, `${baseFileName()}-${name}.${format}`);
        }
      }
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
        <div className="ml-2 flex items-center gap-0.5 border-l pl-2">
          <Button
            variant="ghost"
            size="icon"
            disabled={!canUndo}
            onClick={() => undo()}
            title="Undo (Cmd/Ctrl+Z)"
            className="h-8 w-8"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={!canRedo}
            onClick={() => redo()}
            title="Redo (Cmd/Ctrl+Shift+Z)"
            className="h-8 w-8"
          >
            <Redo2 className="w-4 h-4" />
          </Button>
        </div>
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
          title="Generate UV Layout (U)"
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

                {/* Mesh checklist */}
                {meshes.length > 0 && (
                  <div className="px-2 py-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Meshes ({selectedMeshKeys.size}/{meshes.length})
                      </span>
                      <button
                        className="text-[10px] underline text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          if (selectedMeshKeys.size === meshes.length) {
                            setSelectedMeshKeys(new Set());
                          } else {
                            setSelectedMeshKeys(new Set(meshes.map(meshKeyOf)));
                          }
                        }}
                      >
                        {selectedMeshKeys.size === meshes.length ? 'none' : 'all'}
                      </button>
                    </div>
                    <div className="max-h-40 overflow-auto space-y-0.5 border rounded p-1">
                      {meshes.map((mesh, i) => {
                        const k = meshKeyOf(mesh);
                        const checked = selectedMeshKeys.has(k);
                        return (
                          <label key={k || i} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/50 px-1 rounded">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = new Set(selectedMeshKeys);
                                if (e.target.checked) next.add(k);
                                else next.delete(k);
                                setSelectedMeshKeys(next);
                              }}
                              className="h-3 w-3"
                            />
                            <span className="truncate" title={mesh.name}>{mesh.name || `mesh ${i + 1}`}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Button
                  size="sm"
                  variant="default"
                  className="w-full justify-start"
                  disabled={!model || selectedMeshKeys.size === 0}
                  onClick={() => handleExportModel(exportFormat, 'combined')}
                >
                  <Box className="mr-2 h-3 w-3" />
                  Export combined .{exportFormat}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full justify-start"
                  disabled={!model || selectedMeshKeys.size === 0}
                  onClick={() => handleExportModel(exportFormat, 'separate')}
                  title={`Triggers ${selectedMeshKeys.size} downloads — your browser may ask to allow multiple files.`}
                >
                  <Box className="mr-2 h-3 w-3" />
                  Export each separately ({selectedMeshKeys.size})
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
              <kbd className="px-2 py-1 bg-muted rounded">U</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Gizmo: translate / rotate / scale</span>
              <kbd className="px-2 py-1 bg-muted rounded">G / R / S</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Lock to axis (toggle)</span>
              <kbd className="px-2 py-1 bg-muted rounded">X / Y / Z</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Lock plane (exclude axis)</span>
              <kbd className="px-2 py-1 bg-muted rounded">Shift + X / Y / Z</kbd>
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
