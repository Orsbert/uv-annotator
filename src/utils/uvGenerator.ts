import * as THREE from 'three';

/**
 * Compute the tight bounding box of a mesh's UV island, in canvas pixel space.
 * Returns null if the mesh has no UVs. Box uses the same V-axis convention as
 * the rest of the app (no flip), so it lines up with the rendered wireframe.
 */
export function computeUVBoundingBox(
  mesh: THREE.Mesh,
  canvasSize: number
): { x: number; y: number; width: number; height: number } | null {
  const uvAttr = mesh.geometry.attributes.uv as THREE.BufferAttribute | undefined;
  if (!uvAttr || uvAttr.count === 0) return null;

  let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
  for (let i = 0; i < uvAttr.count; i++) {
    const u = uvAttr.getX(i);
    const v = uvAttr.getY(i);
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  if (!isFinite(minU)) return null;

  // Clamp to [0,1] for UVs that overshoot the canonical square
  minU = Math.max(0, Math.min(1, minU));
  maxU = Math.max(0, Math.min(1, maxU));
  minV = Math.max(0, Math.min(1, minV));
  maxV = Math.max(0, Math.min(1, maxV));

  return {
    x: minU * canvasSize,
    y: minV * canvasSize,
    width: (maxU - minU) * canvasSize,
    height: (maxV - minV) * canvasSize,
  };
}

export function generateUVLayout(mesh: THREE.Mesh, canvasSize: number = 1024): { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }
  
  // Clear canvas with white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Get geometry UVs
  const geometry = mesh.geometry;
  const uvAttribute = geometry.attributes.uv;
  
  if (!uvAttribute) {
    // If no UVs, show a message
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#333333';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('No UV mapping found', canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    return { canvas, texture };
  }
  
  // Draw UV wireframe
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  
  const index = geometry.index;
  const position = geometry.attributes.position;
  
  if (index) {
    // Indexed geometry
    for (let i = 0; i < index.count; i += 3) {
      const indices = [
        index.getX(i),
        index.getX(i + 1),
        index.getX(i + 2),
      ];
      
      ctx.beginPath();
      for (let j = 0; j < 3; j++) {
        const idx = indices[j];
        const u = uvAttribute.getX(idx);
        const v = uvAttribute.getY(idx); // Use V coordinate as-is (no flip)
        const x = u * canvas.width;
        const y = v * canvas.height;
        
        if (j === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.stroke();
    }
  } else {
    // Non-indexed geometry
    for (let i = 0; i < position.count; i += 3) {
      ctx.beginPath();
      for (let j = 0; j < 3; j++) {
        const idx = i + j;
        const u = uvAttribute.getX(idx);
        const v = uvAttribute.getY(idx); // Use V coordinate as-is (no flip)
        const x = u * canvas.width;
        const y = v * canvas.height;
        
        if (j === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  
  // Create Three.js texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  // Prevent vertical flip so UV layout matches three.js UV coordinates (origin bottom-left)
  texture.flipY = false;
  // The canvas is painted in sRGB; tag it so three.js does the sRGB→linear
  // conversion. Without this the renderer treats the values as linear and the
  // mesh renders noticeably brighter/washed-out than the 2D canvas.
  texture.colorSpace = THREE.SRGBColorSpace;

  return { canvas, texture };
}

export function updateCanvasWithAnnotations(
  canvas: HTMLCanvasElement,
  baseImageData: ImageData | null,
  annotations: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    label: string;
  }>
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // Restore base image if we have it
  if (baseImageData) {
    ctx.putImageData(baseImageData, 0, 0);
  }
  
  // Draw annotations
  annotations.forEach((ann) => {
    ctx.save();
    
    // Translate to annotation center for rotation
    ctx.translate(ann.x + ann.width / 2, ann.y + ann.height / 2);
    ctx.rotate((ann.rotation * Math.PI) / 180);
    ctx.translate(-(ann.x + ann.width / 2), -(ann.y + ann.height / 2));
    
    // Draw rectangle
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.strokeRect(ann.x, ann.y, ann.width, ann.height);
    
    // Draw label background
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    const labelHeight = 20;
    ctx.fillRect(ann.x, ann.y - labelHeight, ann.width, labelHeight);
    
    // Draw label text
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(ann.label, ann.x + ann.width / 2, ann.y - 5);
    
    ctx.restore();
  });
}
