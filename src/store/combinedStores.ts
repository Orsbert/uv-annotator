// src/store/combinedStores.ts

import { create } from 'zustand';
import { persist, StorageValue } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import type { Annotation } from '../types';
import { ANNOTATION_COLORS } from '../types';

type PersistedModelState = Pick<ModelState, 'modelBuffer' | 'modelName' | 'selectedMeshName'>;

// Custom storage object for IndexedDB that supports ArrayBuffer via Structured Clone
const idbStorage = {
  getItem: async (name: string): Promise<StorageValue<PersistedModelState> | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: StorageValue<PersistedModelState>): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

/** Model Store */
/** Model Store */
export interface ModelState {
  model: THREE.Group | null;
  selectedMesh: THREE.Mesh | null;
  meshes: THREE.Mesh[];
  modelBuffer: ArrayBuffer | null;
  modelName: string | null;
  selectedMeshName: string | null;
  setModel: (model: THREE.Group | null) => void;
  setMeshes: (meshes: THREE.Mesh[]) => void;
  setSelectedMesh: (mesh: THREE.Mesh | null) => void;
  setModelBuffer: (buffer: ArrayBuffer | null, name: string | null) => void;
  loadModelFromBuffer: () => Promise<void>;
}

export const useModelStore = create<ModelState>()(
  persist(
    (set, get) => ({
      model: null,
      selectedMesh: null,
      meshes: [],
      modelBuffer: null,
      modelName: null,
      selectedMeshName: null,
      setModel: (model) => set({ model }),
      setMeshes: (meshes) => set({ meshes }),
      setSelectedMesh: (mesh) => set({ selectedMesh: mesh, selectedMeshName: mesh?.name || null }),
      setModelBuffer: (buffer, name) => {
        console.log('setModelBuffer called. Name:', name, 'Size:', buffer?.byteLength);
        set({ modelBuffer: buffer, modelName: name });
      },
      loadModelFromBuffer: async () => {
        const { modelBuffer } = get();
        console.log('loadModelFromBuffer called. Buffer exists:', !!modelBuffer, 'Size:', modelBuffer instanceof ArrayBuffer ? modelBuffer.byteLength : 'N/A');
        
        if (!modelBuffer || !(modelBuffer instanceof ArrayBuffer)) {
            if (modelBuffer) console.warn('Invalid model buffer found in store');
            return;
        }

        try {
          const loader = new GLTFLoader();
          const result = await loader.parseAsync(modelBuffer, '');
          
          const meshes: THREE.Mesh[] = [];
          result.scene.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh) {
              meshes.push(child);
            }
          });

          const { selectedMeshName } = get();
          let selectedMesh = null;
          if (selectedMeshName) {
            selectedMesh = meshes.find(m => m.name === selectedMeshName) || null;
          }

          set({ model: result.scene, meshes, selectedMesh });
        } catch (error) {
          console.error('Error loading model from buffer:', error);
        }
      },
    }),
    {
      name: 'model-storage',
      storage: idbStorage as any, // Cast to any to avoid complex generic matching with persist
      partialize: (state) => ({
        modelBuffer: state.modelBuffer,
        modelName: state.modelName,
        selectedMeshName: state.selectedMeshName,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.loadModelFromBuffer();
        }
      },
    }
  )
);

/** Annotation Store */
export interface AnnotationState {
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  pendingLabelEdit: string | null;
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  setSelectedAnnotationId: (id: string | null) => void;
  setPendingLabelEdit: (id: string | null) => void;
  clearAnnotations: () => void;
}
export const useAnnotationStore = create<AnnotationState>()(
  persist(
    (set) => ({
      annotations: [],
      selectedAnnotationId: null,
      pendingLabelEdit: null,
      addAnnotation: (annotation) =>
        set((state) => ({
          annotations: [...state.annotations, annotation],
          selectedAnnotationId: annotation.id,
        })),
      updateAnnotation: (id, updates) =>
        set((state) => ({
          annotations: state.annotations.map((ann) => (ann.id === id ? { ...ann, ...updates } : ann)),
        })),
      deleteAnnotation: (id) =>
        set((state) => ({
          annotations: state.annotations.filter((ann) => ann.id !== id),
          selectedAnnotationId: state.selectedAnnotationId === id ? null : state.selectedAnnotationId,
        })),
      setSelectedAnnotationId: (id) => set({ selectedAnnotationId: id }),
      setPendingLabelEdit: (id) => set({ pendingLabelEdit: id }),
      clearAnnotations: () => set({ annotations: [], selectedAnnotationId: null }),
    }),
    {
      name: 'annotation-storage',
      partialize: (state) => ({ annotations: state.annotations }),
    }
  )
);

/** Canvas Store */
export const CANVAS_SCALE_OPTIONS = [1024, 2048, 3072, 4096] as const;
export type CanvasSize = (typeof CANVAS_SCALE_OPTIONS)[number];

export interface CanvasState {
  uvCanvas: HTMLCanvasElement | null;
  uvTexture: THREE.CanvasTexture | null;
  uvImageData: string | null;
  canvasSize: CanvasSize;
  backgroundImageData: string | null;
  backgroundImageName: string | null;
  backgroundImage: HTMLImageElement | null;
  showWireframe: boolean;
  setUVCanvas: (canvas: HTMLCanvasElement | null) => void;
  setUVTexture: (texture: THREE.CanvasTexture | null) => void;
  setCanvasSize: (size: CanvasSize) => void;
  setBackgroundImage: (dataUrl: string, name: string) => void;
  clearBackgroundImage: () => void;
  setShowWireframe: (show: boolean) => void;
  restoreCanvas: () => Promise<void>;
}

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      uvCanvas: null,
      uvTexture: null,
      uvImageData: null,
      canvasSize: 1024 as CanvasSize,
      backgroundImageData: null,
      backgroundImageName: null,
      backgroundImage: null,
      showWireframe: true,
      setBackgroundImage: (dataUrl, name) => {
        const img = new window.Image();
        img.src = dataUrl;
        img.onload = () => {
          set({ backgroundImageData: dataUrl, backgroundImageName: name, backgroundImage: img });
        };
      },
      clearBackgroundImage: () => {
        set({ backgroundImageData: null, backgroundImageName: null, backgroundImage: null });
      },
      setShowWireframe: (show) => set({ showWireframe: show }),
      setUVCanvas: (canvas) => {
        const dataUrl = canvas ? canvas.toDataURL() : null;
        set({ uvCanvas: canvas, uvImageData: dataUrl });
      },
      setUVTexture: (texture) => set({ uvTexture: texture }),
      setCanvasSize: (size) => {
        const oldSize = get().canvasSize;
        if (size === oldSize) return;
        const ratio = size / oldSize;

        const { selectedMesh } = useModelStore.getState();
        if (selectedMesh) {
          // Regenerate UV layout at new size FIRST, then apply all changes together
          import('../utils/uvGenerator').then(({ generateUVLayout }) => {
            const { canvas, texture } = generateUVLayout(selectedMesh, size);

            // Scale all annotations proportionally
            const { annotations, updateAnnotation } = useAnnotationStore.getState();
            annotations.forEach((ann) => {
              updateAnnotation(ann.id, {
                x: ann.x * ratio,
                y: ann.y * ratio,
                width: ann.width * ratio,
                height: ann.height * ratio,
              });
            });

            // Scale all overlays proportionally
            const { overlays, updateOverlay } = useOverlayStore.getState();
            overlays.forEach((o) => {
              updateOverlay(o.id, {
                x: o.x * ratio, y: o.y * ratio,
                scaleX: o.scaleX * ratio, scaleY: o.scaleY * ratio,
              });
            });

            // Draw scaled annotations onto the new canvas
            const ctx = canvas.getContext('2d');
            if (ctx) {
              import('../services/annotationRenderer').then(({ renderAnnotationsToCanvas, renderOverlaysToCanvas }) => {
                const currentOverlays = useOverlayStore.getState().overlays;
                renderOverlaysToCanvas(ctx, currentOverlays);
                const currentAnnotations = useAnnotationStore.getState().annotations;
                renderAnnotationsToCanvas(ctx, currentAnnotations);
                texture.needsUpdate = true;
                // Set everything at once so nothing flashes
                const dataUrl = canvas.toDataURL();
                set({ canvasSize: size, uvCanvas: canvas, uvTexture: texture, uvImageData: dataUrl });
              });
            } else {
              const dataUrl = canvas.toDataURL();
              set({ canvasSize: size, uvCanvas: canvas, uvTexture: texture, uvImageData: dataUrl });
            }
          });
        } else {
          // No mesh — just scale annotations/overlay and update size
          const { annotations, updateAnnotation } = useAnnotationStore.getState();
          annotations.forEach((ann) => {
            updateAnnotation(ann.id, {
              x: ann.x * ratio,
              y: ann.y * ratio,
              width: ann.width * ratio,
              height: ann.height * ratio,
            });
          });
          const { overlays, updateOverlay } = useOverlayStore.getState();
          overlays.forEach((o) => {
            updateOverlay(o.id, {
              x: o.x * ratio, y: o.y * ratio,
              scaleX: o.scaleX * ratio, scaleY: o.scaleY * ratio,
            });
          });
          set({ canvasSize: size });
        }
      },
      restoreCanvas: async () => {
        const { uvImageData, backgroundImageData } = get();

        // Rehydrate background image (independent of UV canvas)
        if (backgroundImageData) {
          const bgImg = new window.Image();
          bgImg.src = backgroundImageData;
          bgImg.onload = () => set({ backgroundImage: bgImg });
        }

        if (!uvImageData) return;

        const img = new Image();
        img.src = uvImageData;
        await new Promise((resolve) => {
          img.onload = resolve;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          set({ uvCanvas: canvas });

          // Also recreate texture if needed, but ModelViewer handles creating texture from canvas if it's missing?
          // Actually ModelViewer uses uvTexture from store.
          // So we should recreate texture too.
          const texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.flipY = false;
          set({ uvTexture: texture });
        }
      },
    }),
    {
      name: 'canvas-storage',
      storage: idbStorage as any,
      partialize: (state) => ({
        uvImageData: state.uvImageData,
        canvasSize: state.canvasSize,
        backgroundImageData: state.backgroundImageData,
        backgroundImageName: state.backgroundImageName,
        showWireframe: state.showWireframe,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.restoreCanvas();
        }
      },
    }
  )
);

/** Overlay Store */
export interface OverlayItem {
  id: string;
  imageData: string;
  imageName: string;
  opacity: number;
  visible: boolean;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  lockAspect: boolean;
  editMode: boolean;
  image: HTMLImageElement | null; // runtime only
}

export interface OverlayState {
  overlays: OverlayItem[];
  selectedOverlayId: string | null;
  addOverlay: (dataUrl: string, name: string) => void;
  updateOverlay: (id: string, updates: Partial<Omit<OverlayItem, 'id'>>) => void;
  removeOverlay: (id: string) => void;
  removeAllOverlays: () => void;
  setSelectedOverlayId: (id: string | null) => void;
  fitOverlayToCanvas: (id: string) => void;
  restoreOverlays: () => Promise<void>;
}

export const useOverlayStore = create<OverlayState>()(
  persist(
    (set, get) => ({
      overlays: [],
      selectedOverlayId: null,
      addOverlay: (dataUrl, name) => {
        const id = `overlay-${Date.now()}`;
        const img = new window.Image();
        img.src = dataUrl;
        img.onload = () => {
          set((state) => ({
            overlays: [...state.overlays, {
              id,
              imageData: dataUrl,
              imageName: name,
              opacity: 0.5,
              visible: true,
              x: 0,
              y: 0,
              scaleX: 1,
              scaleY: 1,
              lockAspect: true,
              editMode: false,
              image: img,
            }],
            selectedOverlayId: id,
          }));
        };
      },
      updateOverlay: (id, updates) => {
        set((state) => ({
          overlays: state.overlays.map((o) => o.id === id ? { ...o, ...updates } : o),
        }));
      },
      removeOverlay: (id) => {
        set((state) => ({
          overlays: state.overlays.filter((o) => o.id !== id),
          selectedOverlayId: state.selectedOverlayId === id ? null : state.selectedOverlayId,
        }));
      },
      removeAllOverlays: () => set({ overlays: [], selectedOverlayId: null }),
      setSelectedOverlayId: (id) => set({ selectedOverlayId: id }),
      fitOverlayToCanvas: (id) => {
        const overlay = get().overlays.find((o) => o.id === id);
        if (!overlay?.image) return;
        const canvasSize = useCanvasStore.getState().canvasSize;
        const imgW = overlay.image.naturalWidth;
        const imgH = overlay.image.naturalHeight;
        if (imgW === 0 || imgH === 0) return;
        const scale = Math.min(canvasSize / imgW, canvasSize / imgH);
        const x = (canvasSize - imgW * scale) / 2;
        const y = (canvasSize - imgH * scale) / 2;
        set((state) => ({
          overlays: state.overlays.map((o) => o.id === id
            ? { ...o, scaleX: scale, scaleY: scale, x, y }
            : o
          ),
        }));
      },
      restoreOverlays: async () => {
        const { overlays } = get();
        const restored = await Promise.all(
          overlays.map(async (o) => {
            if (!o.imageData) return o;
            const img = new window.Image();
            img.src = o.imageData;
            await new Promise((resolve) => { img.onload = resolve; });
            return { ...o, image: img };
          })
        );
        set({ overlays: restored });
      },
    }),
    {
      name: 'overlay-storage',
      storage: idbStorage as any,
      partialize: (state) => ({
        overlays: state.overlays.map(({ image, ...rest }) => rest),
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.restoreOverlays();
        }
      },
    }
  )
);

/** Paint Store */
export interface PaintState {
  isPaintMode: boolean;
  brushSize: number;
  paintedUVCoords: Array<{ u: number; v: number }>;
  setPaintMode: (enabled: boolean) => void;
  setBrushSize: (size: number) => void;
  addPaintedUVCoord: (coord: { u: number; v: number }) => void;
  clearPaintedUVCoords: () => void;
  // New method to create annotation from paint strokes
  createAnnotationFromPaint: () => void;
}
export const usePaintStore = create<PaintState>()(
  persist(
    (set, get) => ({
      isPaintMode: false,
      brushSize: 20,
      paintedUVCoords: [],
      setPaintMode: (enabled) => set({ isPaintMode: enabled, paintedUVCoords: enabled ? [] : [] }),
      setBrushSize: (size) => set({ brushSize: size }),
      addPaintedUVCoord: (coord) => {
        const state = get();
        // Access uvCanvas and uvTexture from the CanvasStore
        const { uvCanvas, uvTexture } = useCanvasStore.getState();
        const { brushSize } = state;

        if (!uvCanvas) return;
        const ctx = uvCanvas.getContext('2d');
        if (!ctx) return;
        const x = coord.u * uvCanvas.width;
        const y = coord.v * uvCanvas.height; // Use V as-is (no flip)
        ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
        ctx.beginPath();
        ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
        if (uvTexture) { uvTexture.needsUpdate = true; }
        set((state) => ({ paintedUVCoords: [...state.paintedUVCoords, coord] }));
      },
      clearPaintedUVCoords: () => set({ paintedUVCoords: [] }),
      // Implement createAnnotationFromPaint by delegating to existing useStore logic
      createAnnotationFromPaint: () => {
        const { paintedUVCoords, setPaintMode } = get();
        const { uvCanvas, uvTexture } = useCanvasStore.getState();
        const { selectedMesh } = useModelStore.getState();
        const { annotations, addAnnotation, setPendingLabelEdit } = useAnnotationStore.getState();

        if (paintedUVCoords.length === 0 || !uvCanvas) return;

        // Convert UV coords (0-1) to pixel coords
        const pixelCoords = paintedUVCoords.map(({ u, v }) => ({
          x: u * uvCanvas.width,
          y: v * uvCanvas.height, // Use V as-is (no flip)
        }));

        // Calculate bounding box
        const minX = Math.min(...pixelCoords.map(p => p.x));
        const maxX = Math.max(...pixelCoords.map(p => p.x));
        const minY = Math.min(...pixelCoords.map(p => p.y));
        const maxY = Math.max(...pixelCoords.map(p => p.y));

        // Add some padding
        const padding = 10;
        const x = Math.max(0, minX - padding);
        const y = Math.max(0, minY - padding);
        // Calculate top-left coordinates
        const width = Math.min(uvCanvas.width - x, maxX - minX + padding * 2);
        const height = Math.min(uvCanvas.height - y, maxY - minY + padding * 2);

        // Create annotation with b${n} naming
        const existingBoxCount = annotations.filter(a => a.label.match(/^b\d+$/)).length;
        const colorIndex = annotations.length % ANNOTATION_COLORS.length;
        
        const newAnnotation: Annotation = {
          id: `ann-${Date.now()}`,
          x,
          y,
          width,
          height,
          rotation: 0,
          label: `b${existingBoxCount + 1}`,
          color: ANNOTATION_COLORS[colorIndex].name,
          visible: true,
        };

        // Update stores
        addAnnotation(newAnnotation);
        setPaintMode(false);
        setPendingLabelEdit(newAnnotation.id);

        // Redraw canvas (clean paint strokes and draw annotations)
        if (uvCanvas && selectedMesh) {
          import('../utils/uvGenerator').then(({ generateUVLayout }) => {
            const ctx = uvCanvas.getContext('2d');
            if (!ctx) return;

            // 1. Regenerate clean UV layout
            const { canvasSize } = useCanvasStore.getState();
            const { canvas: newCanvas } = generateUVLayout(selectedMesh, canvasSize);
            ctx.clearRect(0, 0, uvCanvas.width, uvCanvas.height);
            ctx.drawImage(newCanvas, 0, 0);

            // 2. Draw overlays and annotations
            const currentAnnotations = useAnnotationStore.getState().annotations;
            import('../services/annotationRenderer').then(({ renderAnnotationsToCanvas, renderOverlaysToCanvas }) => {
                const currentOverlays = useOverlayStore.getState().overlays;
                renderOverlaysToCanvas(ctx, currentOverlays);
                renderAnnotationsToCanvas(ctx, currentAnnotations);

                if (uvTexture) {
                    uvTexture.needsUpdate = true;
                }
            });
          });
        }
      },
    }),
    {
      name: 'paint-storage',
      partialize: (state) => ({
        isPaintMode: state.isPaintMode,
        brushSize: state.brushSize,
        paintedUVCoords: state.paintedUVCoords,
      }),
    }
  )
);

