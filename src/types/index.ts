import * as THREE from 'three';

export type ImageFit = 'fill' | 'contain' | 'cover';
export type ImageAlign =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export interface Annotation {
  id: string;
  x: number; // Top-left X
  y: number; // Top-left Y
  width: number;
  height: number;
  rotation: number;
  label: string;
  color: string; // Theme color name
  visible: boolean;
  imageData?: string;
  imageName?: string;
  imageFit?: ImageFit;
  imageAlign?: ImageAlign;
  imageOpacity?: number;
}

/**
 * Compute the source-rect / dest-rect for drawing an image inside a box
 * with object-fit + alignment semantics. Returns args for ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh).
 */
export function computeImageRect(
  box: { x: number; y: number; width: number; height: number },
  imgW: number,
  imgH: number,
  fit: ImageFit = 'contain',
  align: ImageAlign = 'center'
): { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number } {
  if (imgW <= 0 || imgH <= 0) {
    return { sx: 0, sy: 0, sw: imgW, sh: imgH, dx: box.x, dy: box.y, dw: box.width, dh: box.height };
  }

  const [hAlign, vAlign] = parseAlign(align);

  if (fit === 'fill') {
    return { sx: 0, sy: 0, sw: imgW, sh: imgH, dx: box.x, dy: box.y, dw: box.width, dh: box.height };
  }

  if (fit === 'contain') {
    const scale = Math.min(box.width / imgW, box.height / imgH);
    const dw = imgW * scale;
    const dh = imgH * scale;
    const dx = box.x + alignOffset(box.width - dw, hAlign);
    const dy = box.y + alignOffset(box.height - dh, vAlign);
    return { sx: 0, sy: 0, sw: imgW, sh: imgH, dx, dy, dw, dh };
  }

  // cover: fill the box; crop overflow on the image (source rect)
  const scale = Math.max(box.width / imgW, box.height / imgH);
  const sw = box.width / scale;
  const sh = box.height / scale;
  const sx = alignOffset(imgW - sw, hAlign);
  const sy = alignOffset(imgH - sh, vAlign);
  return { sx, sy, sw, sh, dx: box.x, dy: box.y, dw: box.width, dh: box.height };
}

function parseAlign(align: ImageAlign): ['left' | 'center' | 'right', 'top' | 'center' | 'bottom'] {
  const [v, h] = align.split('-') as [string, string];
  const vMap: Record<string, 'top' | 'center' | 'bottom'> = { top: 'top', middle: 'center', center: 'center', bottom: 'bottom' };
  const hMap: Record<string, 'left' | 'center' | 'right'> = { left: 'left', center: 'center', right: 'right' };
  // Single-word aligns ("center") map to center/center
  if (h === undefined) return ['center', 'center'];
  return [hMap[h] ?? 'center', vMap[v] ?? 'center'];
}

function alignOffset(slack: number, side: 'left' | 'center' | 'right' | 'top' | 'center' | 'bottom'): number {
  if (side === 'left' || side === 'top') return 0;
  if (side === 'right' || side === 'bottom') return slack;
  return slack / 2;
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
