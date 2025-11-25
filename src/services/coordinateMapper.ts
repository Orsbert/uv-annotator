// src/services/coordinateMapper.ts

/**
 * Utility functions for converting between UV space (0‑1) and canvas pixel space (0‑1024).
 * Centralises the "1 - v" flip and scaling logic.
 */
export const CANVAS_SIZE = 1024; // UV canvas is always 1024×1024

/** Convert UV coordinates (0‑1) to canvas pixel coordinates. */
export function uvToCanvas({ u, v }: { u: number; v: number }) {
  const x = u * CANVAS_SIZE;
  // UV v is bottom‑up, canvas y is top‑down, so we flip
  const y = (1 - v) * CANVAS_SIZE;
  return { x, y };
}

/** Convert canvas pixel coordinates back to UV space. */
export function canvasToUv({ x, y }: { x: number; y: number }) {
  const u = x / CANVAS_SIZE;
  const v = 1 - y / CANVAS_SIZE;
  return { u, v };
}

/** Helper to convert an array of UV coordinates to canvas points. */
export function uvArrayToCanvas(uvArray: Array<{ u: number; v: number }>) {
  return uvArray.map(uvToCanvas);
}
