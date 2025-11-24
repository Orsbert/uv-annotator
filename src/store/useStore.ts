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
}

export const useStore = create<AppState>((set) => ({
  // Initial state
  model: null,
  selectedMesh: null,
  meshes: [],
  uvTexture: null,
  uvCanvas: null,
  annotations: [],
  selectedAnnotationId: null,
  
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
}));
