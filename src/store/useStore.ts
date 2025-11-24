import { create } from 'zustand';
import * as THREE from 'three';
import type { Annotation } from '../types';

interface AppState {
  // Model State
  model: THREE.Group | null;
  selectedMesh: THREE.Mesh | null;
  meshes: THREE.Mesh[];
  
  // UV and Texture State
  uvTexture: THREE.CanvasTexture | null;
  uvCanvas: HTMLCanvasElement | null;
  
  // Annotations State
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  
  // Paint Mode State
  isPaintMode: boolean;
  brushSize: number;
  paintedUVCoords: Array<{ u: number; v: number }>;
  
  // Actions
  setModel: (model: THREE.Group | null) => void;
  setMeshes: (meshes: THREE.Mesh[]) => void;
  setSelectedMesh: (mesh: THREE.Mesh | null) => void;
  setUVTexture: (texture: THREE.CanvasTexture | null, canvas: HTMLCanvasElement | null) => void;
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  setSelectedAnnotationId: (id: string | null) => void;
  clearAnnotations: () => void;
  setPaintMode: (enabled: boolean) => void;
  setBrushSize: (size: number) => void;
  addPaintedUVCoord: (coord: { u: number; v: number }) => void;
  clearPaintedUVCoords: () => void;
  createAnnotationFromPaint: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  model: null,
  selectedMesh: null,
  meshes: [],
  uvTexture: null,
  uvCanvas: null,
  annotations: [],
  selectedAnnotationId: null,
  isPaintMode: false,
  brushSize: 20,
  paintedUVCoords: [],
  
  // Actions
  setModel: (model) => set({ model }),
  setMeshes: (meshes) => set({ meshes }),
  setSelectedMesh: (mesh) => set({ selectedMesh: mesh }),
  setUVTexture: (texture, canvas) => set({ uvTexture: texture, uvCanvas: canvas }),
  
  addAnnotation: (annotation) => 
    set((state) => ({ 
      annotations: [...state.annotations, annotation],
      selectedAnnotationId: annotation.id 
    })),
  
  updateAnnotation: (id, updates) =>
    set((state) => ({
      annotations: state.annotations.map((ann) =>
        ann.id === id ? { ...ann, ...updates } : ann
      ),
    })),
  
  deleteAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.filter((ann) => ann.id !== id),
      selectedAnnotationId: state.selectedAnnotationId === id ? null : state.selectedAnnotationId,
    })),
  
  setSelectedAnnotationId: (id) => set({ selectedAnnotationId: id }),
  
  clearAnnotations: () => set({ annotations: [], selectedAnnotationId: null }),
  
  setPaintMode: (enabled) => set({ isPaintMode: enabled, paintedUVCoords: enabled ? [] : [] }),
  
  setBrushSize: (size) => set({ brushSize: size }),
  
  addPaintedUVCoord: (coord) =>
    set((state) => ({
      paintedUVCoords: [...state.paintedUVCoords, coord],
    })),
  
  clearPaintedUVCoords: () => set({ paintedUVCoords: [] }),
  
  createAnnotationFromPaint: () => {
    const state = get();
    const { paintedUVCoords, uvCanvas } = state;
    
    if (paintedUVCoords.length === 0 || !uvCanvas) return;
    
    // Convert UV coords (0-1) to pixel coords (0-1024)
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
    
    // Create annotation
    const newAnnotation: Annotation = {
      id: `ann-${Date.now()}`,
      x,
      y,
      width,
      height,
      rotation: 0,
      label: 'Painted Annotation',
    };
    
    set((state) => ({
      annotations: [...state.annotations, newAnnotation],
      selectedAnnotationId: newAnnotation.id,
      paintedUVCoords: [],
      isPaintMode: false,
    }));
  },
}));
