// src/services/annotationService.ts

import type { Annotation } from '../types';
import { CANVAS_SIZE } from './coordinateMapper';

/** Generate a sequential label like "b1", "b2" based on existing annotations */
export function generateLabel(annotations: Annotation[]): string {
  const count = annotations.filter((a) => /^b\d+$/.test(a.label)).length;
  return `b${count + 1}`;
}

/** Export the current UV canvas (including annotations) as a data URL */
export function exportCanvasAsDataURL(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

/** Convert an annotation from painted UV coordinates (array of {u,v}) */
export function createAnnotationFromPaint(
  paintedUVCoords: Array<{ u: number; v: number }>,
  canvasWidth: number = CANVAS_SIZE,
  canvasHeight: number = CANVAS_SIZE,
): Omit<Annotation, 'id' | 'label'> {
  const xs = paintedUVCoords.map((c) => c.u * canvasWidth);
  const ys = paintedUVCoords.map((c) => (1 - c.v) * canvasHeight);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padding = 10;
  const x = Math.max(0, minX - padding);
  const y = Math.max(0, minY - padding);
  const width = Math.min(canvasWidth - x, maxX - minX + padding * 2);
  const height = Math.min(canvasHeight - y, maxY - minY + padding * 2);
  return { x, y, width, height, rotation: 0 };
}
