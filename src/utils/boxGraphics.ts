import { getColorTheme } from '../types';
import type { ProjectedBox } from '../store/combinedStores';

/**
 * Shared bounding-box graphic. Both the flat plane texture (the 2D proof) and the
 * per-box projected decal draw through this so a box looks identical whether the
 * client is looking at the 2D image or the 3D model.
 *
 * Draws a translucent fill, a solid border, and a label chip at the top-left, all
 * in pixel space. `scale` bumps line/label size for large canvases.
 */
export function drawBoxGraphic(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  colorName: string,
  label: string,
  scale = 1
): void {
  const theme = getColorTheme(colorName);
  ctx.save();

  ctx.fillStyle = theme.light;
  ctx.fillRect(x, y, w, h);

  ctx.lineWidth = Math.max(2, 3 * scale);
  ctx.strokeStyle = theme.main;
  ctx.strokeRect(x, y, w, h);

  if (label) {
    const fs = Math.max(11, 15 * scale);
    ctx.font = `600 ${fs}px ui-sans-serif, system-ui, -apple-system, Arial`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const padX = 5 * scale;
    const chipH = fs + 8 * scale;
    const tw = ctx.measureText(label).width;
    const chipW = Math.min(w, tw + padX * 2);
    ctx.fillStyle = theme.dark;
    ctx.fillRect(x, y, chipW, chipH);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x + padX, y + chipH / 2);
  }

  ctx.restore();
}

/**
 * A box's rect converted from plane-UV (origin bottom-left, v up) to canvas pixels
 * (origin top-left, y down) for a canvas of the given size. Used when compositing
 * boxes onto the plane's image texture.
 */
export function boxRectToCanvas(
  box: { u: number; v: number; w: number; h: number },
  canvasW: number,
  canvasH: number
): { x: number; y: number; w: number; h: number } {
  return {
    x: box.u * canvasW,
    y: (1 - (box.v + box.h)) * canvasH, // top edge of the box, flipping v
    w: box.w * canvasW,
    h: box.h * canvasH,
  };
}

/**
 * Build the flat "2D proof": the reference image with every box drawn on top, at the
 * image's native resolution. This is the artifact the client compares against the 3D
 * — and because the 3D boxes are the same rects projected, they line up.
 */
export function buildProofCanvas(
  image: HTMLImageElement,
  boxes: { u: number; v: number; w: number; h: number; color: string; label: string; visible: boolean }[]
): HTMLCanvasElement {
  const W = image.naturalWidth || 1024;
  const H = image.naturalHeight || 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(image, 0, 0, W, H);
    for (const b of boxes) {
      if (!b.visible) continue;
      const r = boxRectToCanvas(b, W, H);
      drawBoxGraphic(ctx, r.x, r.y, r.w, r.h, b.color, b.label);
    }
  }
  return canvas;
}

/**
 * Render a single box to its own transparent canvas, the box graphic filling the
 * whole canvas (inset slightly so the border isn't clipped). This canvas becomes
 * the decal texture projected onto the mesh. `aspect` = box world width / height,
 * so the border and label aren't stretched on non-square boxes.
 */
export function renderBoxDecalCanvas(box: ProjectedBox, aspect: number): HTMLCanvasElement {
  const LONG = 512;
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const w = a >= 1 ? LONG : Math.max(16, Math.round(LONG * a));
  const h = a >= 1 ? Math.max(16, Math.round(LONG / a)) : LONG;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const inset = Math.max(3, Math.round(LONG * 0.012));
    // Border + fill only. The label is drawn as a separate constant-size 3D tag
    // (see ProjectedBoxDecals) because text baked into the decal is illegible once
    // the decal is minified onto the surface. A bold border reads at any size.
    drawBoxGraphic(ctx, inset, inset, w - inset * 2, h - inset * 2, box.color, '', 1.8);
  }
  return canvas;
}
