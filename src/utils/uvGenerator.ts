import * as THREE from 'three';

export interface UVFrame {
  /** UV coordinate mapped to the canvas top-left (x=0, y=0). */
  minU: number;
  minV: number;
  /** UV width/height the canvas spans. Never zero. */
  spanU: number;
  spanV: number;
}

/**
 * The region of UV space a mesh's texture canvas represents.
 *
 * Defaults to the canonical [0,1]² square but EXPANDS to enclose any UVs that
 * fall outside it. Many exported models (tiled or un-normalized unwraps) carry
 * UVs ranging into the tens or hundreds. Without this the app assumes 0-1, so a
 * painted region lands only on the thin sliver of surface whose UV happens to
 * fall in [0,1] and shows up microscopic. Enclosing the real UV range makes the
 * whole island fill the canvas instead.
 *
 * For meshes whose UVs already sit inside [0,1] the frame is exactly [0,1]² — an
 * identity transform — so existing models and their saved annotations are
 * unaffected. Cached on the mesh; UVs don't change at runtime.
 */
export function computeUVFrame(mesh: THREE.Mesh): UVFrame {
  const cached = mesh.userData.__uvFrame as UVFrame | undefined;
  if (cached) return cached;

  // Seed with the canonical square so the frame always contains [0,1].
  let minU = 0, minV = 0, maxU = 1, maxV = 1;
  const uvAttr = mesh.geometry.attributes.uv as THREE.BufferAttribute | undefined;
  if (uvAttr && uvAttr.count > 0) {
    for (let i = 0; i < uvAttr.count; i++) {
      const u = uvAttr.getX(i);
      const v = uvAttr.getY(i);
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
  }
  const frame: UVFrame = { minU, minV, spanU: maxU - minU || 1, spanV: maxV - minV || 1 };
  mesh.userData.__uvFrame = frame;
  return frame;
}

/** Map a raw UV coordinate into frame-normalized canvas pixel space (no V flip). */
export function uvToFrameCanvas(u: number, v: number, frame: UVFrame, canvasSize: number) {
  return {
    x: ((u - frame.minU) / frame.spanU) * canvasSize,
    y: ((v - frame.minV) / frame.spanV) * canvasSize,
  };
}

/**
 * Configure a canvas texture so a mesh's raw UVs sample into a frame-normalized
 * canvas. The canvas is painted spanning the frame's UV region; offset/repeat
 * remap the mesh's raw UVs into that 0-1 canvas. For an identity frame ([0,1]²)
 * this leaves repeat=(1,1) offset=(0,0), matching prior behavior exactly.
 * GLTFExporter serializes offset/repeat as KHR_texture_transform, so baked
 * exports stay aligned too.
 */
export function applyUVFrameToTexture(texture: THREE.Texture, frame: UVFrame): void {
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1 / frame.spanU, 1 / frame.spanV);
  texture.offset.set(-frame.minU / frame.spanU, -frame.minV / frame.spanV);
  texture.needsUpdate = true;
}

/**
 * Bounding box of a mesh's UV island in canvas pixel space, using the mesh's UV
 * frame. Returns null if the mesh has no UVs. For a normalized model this is the
 * island's rect within [0,1]; for an out-of-range model the island fills the
 * canvas. Uses the same V-axis convention (no flip) as the rendered wireframe.
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

  const frame = computeUVFrame(mesh);
  const tl = uvToFrameCanvas(minU, minV, frame, canvasSize);
  const br = uvToFrameCanvas(maxU, maxV, frame, canvasSize);
  return { x: tl.x, y: tl.y, width: br.x - tl.x, height: br.y - tl.y };
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
  
  // Normalize UVs into the mesh's frame so out-of-range (tiled/un-normalized)
  // unwraps still fill the canvas instead of overflowing off it.
  const frame = computeUVFrame(mesh);

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
        const { x, y } = uvToFrameCanvas(u, v, frame, canvas.width);
        
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
        const { x, y } = uvToFrameCanvas(u, v, frame, canvas.width);
        
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
  // Remap the mesh's raw UVs into the frame-normalized canvas (identity for
  // meshes whose UVs already fit [0,1]).
  applyUVFrameToTexture(texture, frame);

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
