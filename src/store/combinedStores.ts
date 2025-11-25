// src/store/combinedStores.ts

import { create } from 'zustand';
import * as THREE from 'three';
import type { Annotation } from '../types';

/** Model Store */
export interface ModelState {
  model: THREE.Group | null;
  selectedMesh: THREE.Mesh | null;
  meshes: THREE.Mesh[];
  setModel: (model: THREE.Group | null) => void;
  setMeshes: (meshes: THREE.Mesh[]) => void;
  setSelectedMesh: (mesh: THREE.Mesh | null) => void;
}
export const useModelStore = create<ModelState>((set) => ({
  model: null,
  selectedMesh: null,
  meshes: [],
  setModel: (model) => set({ model }),
  setMeshes: (meshes) => set({ meshes }),
  setSelectedMesh: (mesh) => set({ selectedMesh: mesh }),
}));

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
export const useAnnotationStore = create<AnnotationState>((set) => ({
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
}));

/** Canvas Store */
export interface CanvasState {
  uvCanvas: HTMLCanvasElement | null;
  uvTexture: THREE.CanvasTexture | null;
  setUVCanvas: (canvas: HTMLCanvasElement | null) => void;
  setUVTexture: (texture: THREE.CanvasTexture | null) => void;
}
export const useCanvasStore = create<CanvasState>((set) => ({
  uvCanvas: null,
  uvTexture: null,
  setUVCanvas: (canvas) => set({ uvCanvas: canvas }),
  setUVTexture: (texture) => set({ uvTexture: texture }),
}));

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
export const usePaintStore = create<PaintState>((set, get) => ({
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
    const y = (1 - coord.v) * uvCanvas.height; // UV origin is bottom-left, canvas is top-left
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
      y: (1 - v) * uvCanvas.height, // Flip V
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
    const width = Math.min(uvCanvas.width - x, maxX - minX + padding * 2);
    const height = Math.min(uvCanvas.height - y, maxY - minY + padding * 2);

    // Create annotation with b${n} naming
    const existingBoxCount = annotations.filter(a => a.label.match(/^b\d+$/)).length;
    const newAnnotation: Annotation = {
      id: `ann-${Date.now()}`,
      x,
      y,
      width,
      height,
      rotation: 0,
      label: `b${existingBoxCount + 1}`,
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
        const { canvas: newCanvas } = generateUVLayout(selectedMesh);
        ctx.clearRect(0, 0, uvCanvas.width, uvCanvas.height);
        ctx.drawImage(newCanvas, 0, 0);

        // 2. Draw all annotations (including the new one)
        const currentAnnotations = useAnnotationStore.getState().annotations;
        import('../services/annotationRenderer').then(({ renderAnnotationsToCanvas }) => {
            renderAnnotationsToCanvas(ctx, currentAnnotations);
            
            if (uvTexture) {
                uvTexture.needsUpdate = true;
            }
        });
      });
    }
  },
}));

