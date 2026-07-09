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
  /**
   * Per-side inset applied to the decal image, as a fraction of the box's
   * shorter side, so the art sits with a margin instead of running edge-to-edge.
   * Absent = no padding.
   */
  imagePadding?: { top: number; right: number; bottom: number; left: number };
  /**
   * The mesh UV frame this annotation was authored against (see uvGenerator).
   * Absent on annotations created before the UV-frame fix; used to detect ones
   * that may be mispositioned on out-of-range-UV meshes.
   */
  authoredFrame?: { minU: number; minV: number; spanU: number; spanV: number };
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
  align: ImageAlign = 'center',
  padding?: { top: number; right: number; bottom: number; left: number }
): { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number } {
  // Inset the box by the padding (a fraction of the box's shorter side, so the
  // margin looks even on non-square boxes) and fit/align the art into that inner
  // rect. Everything downstream draws into `inner`, which stays within the box.
  const ref = Math.min(box.width, box.height);
  const pl = (padding?.left ?? 0) * ref;
  const pr = (padding?.right ?? 0) * ref;
  const pt = (padding?.top ?? 0) * ref;
  const pb = (padding?.bottom ?? 0) * ref;
  const inner = {
    x: box.x + pl,
    y: box.y + pt,
    width: Math.max(1, box.width - pl - pr),
    height: Math.max(1, box.height - pt - pb),
  };

  if (imgW <= 0 || imgH <= 0) {
    return { sx: 0, sy: 0, sw: imgW, sh: imgH, dx: inner.x, dy: inner.y, dw: inner.width, dh: inner.height };
  }

  const [hAlign, vAlign] = parseAlign(align);

  if (fit === 'fill') {
    return { sx: 0, sy: 0, sw: imgW, sh: imgH, dx: inner.x, dy: inner.y, dw: inner.width, dh: inner.height };
  }

  if (fit === 'contain') {
    const scale = Math.min(inner.width / imgW, inner.height / imgH);
    const dw = imgW * scale;
    const dh = imgH * scale;
    const dx = inner.x + alignOffset(inner.width - dw, hAlign);
    const dy = inner.y + alignOffset(inner.height - dh, vAlign);
    return { sx: 0, sy: 0, sw: imgW, sh: imgH, dx, dy, dw, dh };
  }

  // cover: fill the inner rect; crop overflow on the image (source rect)
  const scale = Math.max(inner.width / imgW, inner.height / imgH);
  const sw = inner.width / scale;
  const sh = inner.height / scale;
  const sx = alignOffset(imgW - sw, hAlign);
  const sy = alignOffset(imgH - sh, vAlign);
  return { sx, sy, sw, sh, dx: inner.x, dy: inner.y, dw: inner.width, dh: inner.height };
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
