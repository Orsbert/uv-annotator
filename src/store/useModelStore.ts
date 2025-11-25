import { create } from 'zustand';
import * as THREE from 'three';

/**
 * Store responsible for 3D model related state.
 * Keeps only serialisable data (no THREE objects) where possible.
 */
export interface ModelState {
  model: THREE.Group | null;
  selectedMesh: THREE.Mesh | null;
  meshes: THREE.Mesh[];
  // actions
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
