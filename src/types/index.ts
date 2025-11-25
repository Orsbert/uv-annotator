import * as THREE from 'three';

export interface Annotation {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  label: string;
  color: string; // Theme color name
}

export interface ModelData {
  scene: THREE.Group;
  meshes: THREE.Mesh[];
}

// 8 pleasant color themes for annotations
export const ANNOTATION_COLORS = [
  { name: 'coral', main: '#FF6B6B', light: 'rgba(255, 107, 107, 0.4)', dark: 'rgba(255, 107, 107, 0.9)' },
  { name: 'blue', main: '#4ECDC4', light: 'rgba(78, 205, 196, 0.4)', dark: 'rgba(78, 205, 196, 0.9)' },
  { name: 'purple', main: '#A78BFA', light: 'rgba(167, 139, 250, 0.4)', dark: 'rgba(167, 139, 250, 0.9)' },
  { name: 'green', main: '#34D399', light: 'rgba(52, 211, 153, 0.4)', dark: 'rgba(52, 211, 153, 0.9)' },
  { name: 'orange', main: '#FB923C', light: 'rgba(251, 146, 60, 0.4)', dark: 'rgba(251, 146, 60, 0.9)' },
  { name: 'pink', main: '#F472B6', light: 'rgba(244, 114, 182, 0.4)', dark: 'rgba(244, 114, 182, 0.9)' },
  { name: 'yellow', main: '#FBBF24', light: 'rgba(251, 191, 36, 0.4)', dark: 'rgba(251, 191, 36, 0.9)' },
  { name: 'indigo', main: '#818CF8', light: 'rgba(129, 140, 248, 0.4)', dark: 'rgba(129, 140, 248, 0.9)' },
];

export function getColorTheme(colorName: string) {
  return ANNOTATION_COLORS.find(c => c.name === colorName) || ANNOTATION_COLORS[0];
}
