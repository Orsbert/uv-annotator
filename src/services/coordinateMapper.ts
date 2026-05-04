// src/services/coordinateMapper.ts

/**
 * Utility functions for converting between UV space (0-1) and canvas pixel space.
 * Centralises the "1 - v" flip and scaling logic.
 */
export const DEFAULT_CANVAS_SIZE = 1024;

/** Convert UV coordinates (0-1) to canvas pixel coordinates. */
export function uvToCanvas({ u, v }: { u: number; v: number }, canvasSize: number = DEFAULT_CANVAS_SIZE) {
  const x = u * canvasSize;
  // UV v is bottom-up, canvas y is top-down, so we flip
  const y = (1 - v) * canvasSize;
  return { x, y };
}

/** Convert canvas pixel coordinates back to UV space. */
export function canvasToUv({ x, y }: { x: number; y: number }, canvasSize: number = DEFAULT_CANVAS_SIZE) {
  const u = x / canvasSize;
  const v = 1 - y / canvasSize;
  return { u, v };
}

/** Helper to convert an array of UV coordinates to canvas points. */
export function uvArrayToCanvas(uvArray: Array<{ u: number; v: number }>, canvasSize: number = DEFAULT_CANVAS_SIZE) {
  return uvArray.map((uv) => uvToCanvas(uv, canvasSize));
}
