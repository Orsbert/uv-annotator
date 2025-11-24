import * as THREE from 'three';

export interface Annotation {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  label: string;
}

export interface ModelData {
  scene: THREE.Group;
  meshes: THREE.Mesh[];
}
