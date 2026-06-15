// src/store/combinedStores.ts

import { create } from 'zustand';
import { persist, StorageValue } from 'zustand/middleware';
import { temporal } from 'zundo';
import { get, set, del } from 'idb-keyval';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import type { Annotation } from '../types';
import { ANNOTATION_COLORS } from '../types';

// Tiny trailing-edge debouncer used to coalesce rapid state changes (drags, scrubs,
// slider tweaks) into one undo entry per "gesture". Returns a debounced version
// of the same function with the same call signature.
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let t: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  }) as T;
}

type PersistedModelState = Pick<ModelState, 'modelBuffer' | 'modelName' | 'selectedMeshName' | 'transformsByMesh'>;

export function meshKeyOf(mesh: { name: string; uuid: string } | null | undefined): string {
  if (!mesh) return '';
  return mesh.name || mesh.uuid;
}

// Stable empty-array reference — used as `?? EMPTY_ANNOTATIONS` in selectors so
// React's useSyncExternalStore comparison doesn't see a new reference every render.
export const EMPTY_ANNOTATIONS: Annotation[] = [];

/* -------------------------------------------------------------------------- */
/* UI mode store (transient — not persisted, not undoable)                     */
/* -------------------------------------------------------------------------- */

// Blender-style axis constraint for the transform gizmo.
//   'x' / 'y' / 'z'    → only that axis is interactive
//   'no-x' / 'no-y' / 'no-z' → that axis is hidden (Blender's Shift+X "all but X" plane lock)
//   null               → unconstrained, all 3 handles visible
export type AxisLock = null | 'x' | 'y' | 'z' | 'no-x' | 'no-y' | 'no-z';

interface UiState {
  surfaceDragMode: boolean;       // user toggle: drag selected mesh along nearby surfaces
  surfaceDragActive: boolean;     // transient: a drag is in progress, freeze OrbitControls
  axisLock: AxisLock;
  setSurfaceDragMode: (v: boolean) => void;
  setSurfaceDragActive: (v: boolean) => void;
  setAxisLock: (a: AxisLock) => void;
}

export const useUiStore = create<UiState>((set) => ({
  surfaceDragMode: false,
  surfaceDragActive: false,
  axisLock: null,
  setSurfaceDragMode: (surfaceDragMode) => set({ surfaceDragMode }),
  setSurfaceDragActive: (surfaceDragActive) => set({ surfaceDragActive }),
  setAxisLock: (axisLock) => set({ axisLock }),
}));

/* -------------------------------------------------------------------------- */
/* Cross-store undo / redo coordinator                                         */
/* -------------------------------------------------------------------------- */

export type UndoStoreName = 'annotation' | 'model' | 'canvas' | 'overlay';

// Filled in after each store is created. Lets the coordinator call undo/redo
// without static circular imports.
const temporalRegistry: Partial<Record<UndoStoreName, {
  undo: () => void;
  redo: () => void;
  clearFuture: () => void;
}>> = {};

interface HistoryState {
  past: UndoStoreName[];
  future: UndoStoreName[];
  push: (name: UndoStoreName) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

export const useHistoryStore = create<HistoryState>((setState, getState) => ({
  past: [],
  future: [],
  push: (name) => {
    // Any new edit invalidates the redo branch on every store, not just this one.
    Object.values(temporalRegistry).forEach((t) => t?.clearFuture());
    setState((s) => ({ past: [...s.past, name], future: [] }));
  },
  undo: () => {
    const { past } = getState();
    if (past.length === 0) return;
    const last = past[past.length - 1];
    temporalRegistry[last]?.undo();
    setState((s) => ({ past: s.past.slice(0, -1), future: [...s.future, last] }));
  },
  redo: () => {
    const { future } = getState();
    if (future.length === 0) return;
    const next = future[future.length - 1];
    temporalRegistry[next]?.redo();
    setState((s) => ({ future: s.future.slice(0, -1), past: [...s.past, next] }));
  },
  clear: () => setState({ past: [], future: [] }),
}));

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
export type MeshTransform = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
};

export interface ModelState {
  model: THREE.Group | null;
  selectedMesh: THREE.Mesh | null;
  meshes: THREE.Mesh[];
  modelBuffer: ArrayBuffer | null;
  modelName: string | null;
  selectedMeshName: string | null;
  transformsByMesh: Record<string, MeshTransform>;
  setModel: (model: THREE.Group | null) => void;
  setMeshes: (meshes: THREE.Mesh[]) => void;
  setSelectedMesh: (mesh: THREE.Mesh | null) => void;
  setModelBuffer: (buffer: ArrayBuffer | null, name: string | null) => void;
  setMeshTransform: (meshKey: string, transform: Partial<MeshTransform>) => void;
  loadModelFromBuffer: () => Promise<void>;
}

export const useModelStore = create<ModelState>()(
  temporal(
    persist(
      (set, get) => ({
      model: null,
      selectedMesh: null,
      meshes: [],
      modelBuffer: null,
      modelName: null,
      selectedMeshName: null,
      transformsByMesh: {},
      setModel: (model) => set({ model }),
      setMeshes: (meshes) => set({ meshes }),
      setSelectedMesh: (mesh) => set({ selectedMesh: mesh, selectedMeshName: mesh?.name || null }),
      setModelBuffer: (buffer, name) => {
        console.log('setModelBuffer called. Name:', name, 'Size:', buffer?.byteLength);
        set({ modelBuffer: buffer, modelName: name });
      },
      setMeshTransform: (meshKey, partial) => {
        set((state) => {
          const current = state.transformsByMesh[meshKey] ?? {
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          };
          const next: MeshTransform = {
            position: partial.position ?? current.position,
            rotation: partial.rotation ?? current.rotation,
            scale: partial.scale ?? current.scale,
          };
          return { transformsByMesh: { ...state.transformsByMesh, [meshKey]: next } };
        });
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

          const { selectedMeshName, transformsByMesh } = get();
          let selectedMesh = null;
          if (selectedMeshName) {
            selectedMesh = meshes.find(m => m.name === selectedMeshName) || null;
          }

          // Re-apply any persisted per-mesh transforms to the freshly-loaded scene
          for (const m of meshes) {
            const t = transformsByMesh[meshKeyOf(m)];
            if (!t) continue;
            m.position.fromArray(t.position);
            m.rotation.set(t.rotation[0], t.rotation[1], t.rotation[2]);
            m.scale.fromArray(t.scale);
            m.updateMatrix();
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
        transformsByMesh: state.transformsByMesh,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.loadModelFromBuffer();
        }
      },
    }
  ),
  {
    // Only the per-mesh transform map is undoable. Selection / model file etc. aren't.
    partialize: (state) => ({ transformsByMesh: state.transformsByMesh }),
    limit: 100,
    handleSet: (handleSet) => debounce(handleSet as any, 250),
    onSave: () => useHistoryStore.getState().push('model'),
  }
  )
);

// Sync persisted/undone transforms back to live meshes whenever the map changes.
useModelStore.subscribe((state, prev) => {
  if (state.transformsByMesh === prev.transformsByMesh) return;
  for (const m of state.meshes) {
    const t = state.transformsByMesh[meshKeyOf(m)];
    if (!t) continue;
    m.position.fromArray(t.position);
    m.rotation.set(t.rotation[0], t.rotation[1], t.rotation[2]);
    m.scale.fromArray(t.scale);
    m.updateMatrix();
  }
});

temporalRegistry.model = {
  undo: () => useModelStore.temporal.getState().undo(),
  redo: () => useModelStore.temporal.getState().redo(),
  clearFuture: () => useModelStore.temporal.setState({ futureStates: [] }),
};

/** Annotation Store (per-mesh) */
export interface AnnotationState {
  annotationsByMesh: Record<string, Annotation[]>;
  selectedAnnotationId: string | null;
  pendingLabelEdit: string | null;
  addAnnotation: (annotation: Annotation, meshKey?: string) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  setSelectedAnnotationId: (id: string | null) => void;
  setPendingLabelEdit: (id: string | null) => void;
  clearAnnotations: (meshKey?: string) => void;
}

function currentMeshKey(): string {
  return meshKeyOf(useModelStore.getState().selectedMesh);
}

export const useAnnotationStore = create<AnnotationState>()(
  temporal(
    persist(
    (set) => ({
      annotationsByMesh: {},
      selectedAnnotationId: null,
      pendingLabelEdit: null,
      addAnnotation: (annotation, meshKey) => {
        const key = meshKey ?? currentMeshKey();
        set((state) => ({
          annotationsByMesh: {
            ...state.annotationsByMesh,
            [key]: [...(state.annotationsByMesh[key] ?? []), annotation],
          },
          selectedAnnotationId: annotation.id,
        }));
      },
      updateAnnotation: (id, updates) => {
        set((state) => {
          const next: Record<string, Annotation[]> = { ...state.annotationsByMesh };
          for (const key of Object.keys(next)) {
            const arr = next[key];
            const idx = arr.findIndex((a) => a.id === id);
            if (idx >= 0) {
              const newArr = arr.slice();
              newArr[idx] = { ...arr[idx], ...updates };
              next[key] = newArr;
              break;
            }
          }
          return { annotationsByMesh: next };
        });
      },
      deleteAnnotation: (id) => {
        set((state) => {
          const next: Record<string, Annotation[]> = { ...state.annotationsByMesh };
          for (const key of Object.keys(next)) {
            const arr = next[key];
            const idx = arr.findIndex((a) => a.id === id);
            if (idx >= 0) {
              next[key] = arr.filter((a) => a.id !== id);
              break;
            }
          }
          return {
            annotationsByMesh: next,
            selectedAnnotationId: state.selectedAnnotationId === id ? null : state.selectedAnnotationId,
          };
        });
      },
      setSelectedAnnotationId: (id) => set({ selectedAnnotationId: id }),
      setPendingLabelEdit: (id) => set({ pendingLabelEdit: id }),
      clearAnnotations: (meshKey) => {
        const key = meshKey ?? currentMeshKey();
        set((state) => ({
          annotationsByMesh: { ...state.annotationsByMesh, [key]: [] },
          selectedAnnotationId: null,
        }));
      },
    }),
    {
      name: 'annotation-storage',
      partialize: (state) => ({ annotationsByMesh: state.annotationsByMesh }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Migrate from legacy flat `annotations` array → annotationsByMesh[''] bucket.
        const legacy = (state as any).annotations;
        if (Array.isArray(legacy) && legacy.length > 0 && Object.keys(state.annotationsByMesh ?? {}).length === 0) {
          const fallbackKey = useModelStore.getState().selectedMeshName ?? '';
          state.annotationsByMesh = { [fallbackKey]: legacy as Annotation[] };
          delete (state as any).annotations;
        }
      },
    }
  ),
  {
    partialize: (state) => ({ annotationsByMesh: state.annotationsByMesh }),
    limit: 100,
    handleSet: (handleSet) => debounce(handleSet as any, 250),
    onSave: () => useHistoryStore.getState().push('annotation'),
  }
  )
);

temporalRegistry.annotation = {
  undo: () => useAnnotationStore.temporal.getState().undo(),
  redo: () => useAnnotationStore.temporal.getState().redo(),
  clearFuture: () => useAnnotationStore.temporal.setState({ futureStates: [] }),
};

/** Canvas Store */
export const CANVAS_SCALE_OPTIONS = [1024, 2048, 3072, 4096] as const;
export type CanvasSize = (typeof CANVAS_SCALE_OPTIONS)[number];

export interface CanvasState {
  canvasSize: CanvasSize;
  showWireframe: boolean;

  // Per-mesh runtime maps (not persisted)
  canvasByMesh: Record<string, HTMLCanvasElement>;
  textureByMesh: Record<string, THREE.CanvasTexture>;
  backgroundImagesByMesh: Record<string, HTMLImageElement>;

  // Per-mesh persisted maps
  backgroundsByMesh: Record<string, { imageData: string; imageName: string }>;
  // Opacity applied to the "base" layers of each mesh's texture (background + wireframe
  // + overlays + annotation fills/labels). In-box decal images stay at full alpha.
  baseOpacityByMesh: Record<string, number>;

  setMeshCanvas: (meshKey: string, canvas: HTMLCanvasElement, texture: THREE.CanvasTexture) => void;
  clearMeshCanvas: (meshKey: string) => void;
  setBackgroundImage: (dataUrl: string, name: string, meshKey?: string) => void;
  clearBackgroundImage: (meshKey?: string) => void;
  setShowWireframe: (show: boolean) => void;
  setBaseOpacity: (meshKey: string, opacity: number) => void;
  setCanvasSize: (size: CanvasSize) => void;
  restoreBackgrounds: () => Promise<void>;
}

export const useCanvasStore = create<CanvasState>()(
  temporal(
    persist(
    (set, get) => ({
      canvasSize: 1024 as CanvasSize,
      showWireframe: true,
      canvasByMesh: {},
      textureByMesh: {},
      backgroundImagesByMesh: {},
      backgroundsByMesh: {},
      baseOpacityByMesh: {},

      setBaseOpacity: (meshKey, opacity) => {
        set((state) => ({
          baseOpacityByMesh: { ...state.baseOpacityByMesh, [meshKey]: opacity },
        }));
      },

      setMeshCanvas: (meshKey, canvas, texture) => {
        set((state) => ({
          canvasByMesh: { ...state.canvasByMesh, [meshKey]: canvas },
          textureByMesh: { ...state.textureByMesh, [meshKey]: texture },
        }));
      },

      clearMeshCanvas: (meshKey) => {
        set((state) => {
          const c = { ...state.canvasByMesh };
          const t = { ...state.textureByMesh };
          delete c[meshKey];
          delete t[meshKey];
          return { canvasByMesh: c, textureByMesh: t };
        });
      },

      setBackgroundImage: (dataUrl, name, meshKey) => {
        const key = meshKey ?? meshKeyOf(useModelStore.getState().selectedMesh);
        const img = new window.Image();
        img.src = dataUrl;
        img.onload = () => {
          set((state) => ({
            backgroundsByMesh: { ...state.backgroundsByMesh, [key]: { imageData: dataUrl, imageName: name } },
            backgroundImagesByMesh: { ...state.backgroundImagesByMesh, [key]: img },
          }));
        };
      },

      clearBackgroundImage: (meshKey) => {
        const key = meshKey ?? meshKeyOf(useModelStore.getState().selectedMesh);
        set((state) => {
          const b = { ...state.backgroundsByMesh };
          const i = { ...state.backgroundImagesByMesh };
          delete b[key];
          delete i[key];
          return { backgroundsByMesh: b, backgroundImagesByMesh: i };
        });
      },

      setShowWireframe: (show) => set({ showWireframe: show }),

      setCanvasSize: (size) => {
        const oldSize = get().canvasSize;
        if (size === oldSize) return;
        const ratio = size / oldSize;

        // Scale all per-mesh annotations
        const { annotationsByMesh, updateAnnotation } = useAnnotationStore.getState();
        Object.values(annotationsByMesh).forEach((arr) => {
          arr.forEach((ann) => {
            updateAnnotation(ann.id, {
              x: ann.x * ratio,
              y: ann.y * ratio,
              width: ann.width * ratio,
              height: ann.height * ratio,
            });
          });
        });

        // Scale all overlays (still global)
        const { overlays, updateOverlay } = useOverlayStore.getState();
        overlays.forEach((o) => {
          updateOverlay(o.id, {
            x: o.x * ratio, y: o.y * ratio,
            scaleX: o.scaleX * ratio, scaleY: o.scaleY * ratio,
          });
        });

        // Drop all per-mesh canvases — they will regenerate at the new size on next selection.
        set({ canvasSize: size, canvasByMesh: {}, textureByMesh: {} });
      },

      restoreBackgrounds: async () => {
        const { backgroundsByMesh } = get();
        const restored: Record<string, HTMLImageElement> = {};
        await Promise.all(
          Object.entries(backgroundsByMesh).map(async ([key, bg]) => {
            const img = new window.Image();
            img.src = bg.imageData;
            await new Promise((resolve) => { img.onload = resolve; });
            restored[key] = img;
          })
        );
        set({ backgroundImagesByMesh: restored });
      },
    }),
    {
      name: 'canvas-storage',
      storage: idbStorage as any,
      partialize: (state) => ({
        canvasSize: state.canvasSize,
        showWireframe: state.showWireframe,
        backgroundsByMesh: state.backgroundsByMesh,
        baseOpacityByMesh: state.baseOpacityByMesh,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.restoreBackgrounds();
        }
      },
    }
  ),
  {
    partialize: (state) => ({
      backgroundsByMesh: state.backgroundsByMesh,
      backgroundImagesByMesh: state.backgroundImagesByMesh,
      baseOpacityByMesh: state.baseOpacityByMesh,
      showWireframe: state.showWireframe,
    }),
    limit: 100,
    handleSet: (handleSet) => debounce(handleSet as any, 250),
    onSave: () => useHistoryStore.getState().push('canvas'),
  }
  )
);

temporalRegistry.canvas = {
  undo: () => useCanvasStore.temporal.getState().undo(),
  redo: () => useCanvasStore.temporal.getState().redo(),
  clearFuture: () => useCanvasStore.temporal.setState({ futureStates: [] }),
};

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
  rotation: number;
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
  temporal(
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
              rotation: 0,
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
            return { ...o, rotation: o.rotation ?? 0, image: img };
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
  ),
  {
    partialize: (state) => ({ overlays: state.overlays }),
    limit: 100,
    handleSet: (handleSet) => debounce(handleSet as any, 250),
    onSave: () => useHistoryStore.getState().push('overlay'),
  }
  )
);

temporalRegistry.overlay = {
  undo: () => useOverlayStore.temporal.getState().undo(),
  redo: () => useOverlayStore.temporal.getState().redo(),
  clearFuture: () => useOverlayStore.temporal.setState({ futureStates: [] }),
};

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
        const { selectedMesh } = useModelStore.getState();
        const meshKey = meshKeyOf(selectedMesh);
        const { canvasByMesh, textureByMesh } = useCanvasStore.getState();
        const uvCanvas = canvasByMesh[meshKey];
        const uvTexture = textureByMesh[meshKey];
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
        const { selectedMesh } = useModelStore.getState();
        const meshKey = meshKeyOf(selectedMesh);
        const { canvasByMesh, textureByMesh } = useCanvasStore.getState();
        const uvCanvas = canvasByMesh[meshKey];
        const uvTexture = textureByMesh[meshKey];
        const { annotationsByMesh, addAnnotation, setPendingLabelEdit } = useAnnotationStore.getState();
        const annotations = annotationsByMesh[meshKey] ?? [];

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
        addAnnotation(newAnnotation, meshKey);
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
            const currentAnnotations = useAnnotationStore.getState().annotationsByMesh[meshKey] ?? [];
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


// TEMP DEBUG (remove): expose stores for live inspection
if (typeof window !== 'undefined') {
  (window as any).__stores = { model: useModelStore, canvas: useCanvasStore, annotation: useAnnotationStore, overlay: useOverlayStore };
}
