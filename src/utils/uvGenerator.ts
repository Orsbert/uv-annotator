import * as THREE from 'three';

export function generateUVLayout(mesh: THREE.Mesh): { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
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
        const v = 1 - uvAttribute.getY(idx); // Flip V coordinate
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
        const v = 1 - uvAttribute.getY(idx); // Flip V coordinate
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
