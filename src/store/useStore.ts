import { create } from 'zustand';
import * as THREE from 'three';
import type { Annotation } from '../types';

interface AppState {
  // Model State
  model: THREE.Group | null;
  selectedMesh: THREE.Mesh | null;
  meshes: THREE.Mesh[];
  
  // UV and Texture State
  uvTexture: THREE.CanvasTexture | null;
  uvCanvas: HTMLCanvasElement | null;
  
  // Annotations State
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  pendingLabelEdit: string | null;
  
  // Paint Mode State
  isPaintMode: boolean;
  brushSize: number;
  paintedUVCoords: Array<{ u: number; v: number }>;
  
  // Actions
  setModel: (model: THREE.Group | null) => void;
  setMeshes: (meshes: THREE.Mesh[]) => void;
  setSelectedMesh: (mesh: THREE.Mesh | null) => void;
  setUVTexture: (texture: THREE.CanvasTexture | null, canvas: HTMLCanvasElement | null) => void;
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  setSelectedAnnotationId: (id: string | null) => void;
  clearAnnotations: () => void;
  setPaintMode: (enabled: boolean) => void;
  setBrushSize: (size: number) => void;
  addPaintedUVCoord: (coord: { u: number; v: number }) => void;
  clearPaintedUVCoords: () => void;
  createAnnotationFromPaint: () => void;
  redrawAnnotationsOnCanvas: () => void;
  setPendingLabelEdit: (id: string | null) => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  model: null,
  selectedMesh: null,
  meshes: [],
  uvTexture: null,
  uvCanvas: null,
  annotations: [],
  selectedAnnotationId: null,
  pendingLabelEdit: null,
  isPaintMode: false,
  brushSize: 20,
  paintedUVCoords: [],
  
  // Actions
  setModel: (model) => set({ model }),
  setMeshes: (meshes) => set({ meshes }),
  setSelectedMesh: (mesh) => set({ selectedMesh: mesh }),
  setUVTexture: (texture, canvas) => set({ uvTexture: texture, uvCanvas: canvas }),
  
  addAnnotation: (annotation) => {
    set((state) => ({ 
      annotations: [...state.annotations, annotation],
      selectedAnnotationId: annotation.id 
    }));
    // Redraw annotations on canvas texture
    setTimeout(() => get().redrawAnnotationsOnCanvas(), 0);
  },
  
  updateAnnotation: (id, updates) => {
    set((state) => ({
      annotations: state.annotations.map((ann) =>
        ann.id === id ? { ...ann, ...updates } : ann
      ),
    }));
    // Redraw annotations on canvas texture
    setTimeout(() => get().redrawAnnotationsOnCanvas(), 0);
  },
  
  deleteAnnotation: (id) => {
    set((state) => ({
      annotations: state.annotations.filter((ann) => ann.id !== id),
      selectedAnnotationId: state.selectedAnnotationId === id ? null : state.selectedAnnotationId,
    }));
    // Redraw annotations on canvas texture
    setTimeout(() => get().redrawAnnotationsOnCanvas(), 0);
  },
  
  setSelectedAnnotationId: (id) => set({ selectedAnnotationId: id }),
  
  setPendingLabelEdit: (id) => set({ pendingLabelEdit: id }),
  
  clearAnnotations: () => set({ annotations: [], selectedAnnotationId: null }),
  
  setPaintMode: (enabled) => set({ isPaintMode: enabled, paintedUVCoords: enabled ? [] : [] }),
  
  setBrushSize: (size) => set({ brushSize: size }),
  
  addPaintedUVCoord: (coord) => {
    const state = get();
    const { uvCanvas, uvTexture, brushSize } = state;
    
    if (!uvCanvas) return;
    
    // Draw on the canvas immediately
    const ctx = uvCanvas.getContext('2d');
    if (!ctx) return;
    
    // Convert UV coords (0-1) to pixel coords (0-1024)
    const x = coord.u * uvCanvas.width;
    const y = (1 - coord.v) * uvCanvas.height; // Flip V
    
    // Draw a circle at the brush position
    ctx.fillStyle = 'rgba(0, 255, 0, 0.5)'; // Semi-transparent green
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Update texture
    if (uvTexture) {
      uvTexture.needsUpdate = true;
    }
    
    // Store the coordinate for bounding box calculation
    set((state) => ({
      paintedUVCoords: [...state.paintedUVCoords, coord],
    }));
  },
  
  clearPaintedUVCoords: () => set({ paintedUVCoords: [] }),
  
  createAnnotationFromPaint: () => {
    const state = get();
    const { paintedUVCoords, uvCanvas, uvTexture } = state;
    
    if (paintedUVCoords.length === 0 || !uvCanvas) return;
    
    // Convert UV coords (0-1) to pixel coords (0-1024)
    const pixelCoords = paintedUVCoords.map(({ u, v }) => ({
      x: u * uvCanvas.width,
      y: (1 - v) * uvCanvas.height, // Flip V
    }));
    
    // Calculate bounding box
    const minX = Math.min(...pixelCoords.map(p => p.x));
    const maxX = Math.max(...pixelCoords.map(p => p.x));
    const minY = Math.min(...pixelCoords.map(p => p.y));
    const maxY = Math.max(...pixelCoords.map(p => p.y));
    
    // Add some padding
    const padding = 10;
    const x = Math.max(0, minX - padding);
    const y = Math.max(0, minY - padding);
    const width = Math.min(uvCanvas.width - x, maxX - minX + padding * 2);
    const height = Math.min(uvCanvas.height - y, maxY - minY + padding * 2);
    
    // Clear the painted strokes from the canvas
    const ctx = uvCanvas.getContext('2d');
    if (ctx) {
      // Redraw the base UV layout without the paint strokes
      const selectedMesh = state.selectedMesh;
      if (selectedMesh) {
        import('../utils/uvGenerator').then(({ generateUVLayout }) => {
          const { canvas: newCanvas } = generateUVLayout(selectedMesh);
          // Copy the clean UV layout back
          ctx.clearRect(0, 0, uvCanvas.width, uvCanvas.height);
          ctx.drawImage(newCanvas, 0, 0);
          
          if (uvTexture) {
            uvTexture.needsUpdate = true;
          }
        });
      }
    }
    
    // Create annotation with b${n} naming
    const existingBoxCount = state.annotations.filter(a => a.label.match(/^b\d+$/)).length;
    const newAnnotation: Annotation = {
      id: `ann-${Date.now()}`,
      x,
      y,
      width,
      height,
      rotation: 0,
      label: `b${existingBoxCount + 1}`,
      color: 'coral',
      visible: true,
    };

    set((state) => ({
      annotations: [...state.annotations, newAnnotation],
      selectedAnnotationId: newAnnotation.id,
      paintedUVCoords: [],
      isPaintMode: false,
      pendingLabelEdit: newAnnotation.id, // Flag for showing label dialog
    }));
    
    // Redraw all annotations on the UV canvas
    get().redrawAnnotationsOnCanvas();
  },
  
  // Helper function to draw annotations on the UV canvas texture
  redrawAnnotationsOnCanvas: () => {
    const state = get();
    const { uvCanvas, uvTexture, annotations } = state;
    
    if (!uvCanvas) return;
    
    const ctx = uvCanvas.getContext('2d');
    if (!ctx) return;
    
    // First regenerate clean UV layout
    const selectedMesh = state.selectedMesh;
    if (!selectedMesh) return;
    
    import('../utils/uvGenerator').then(({ generateUVLayout }) => {
      const { canvas: newCanvas } = generateUVLayout(selectedMesh);
      ctx.clearRect(0, 0, uvCanvas.width, uvCanvas.height);
      ctx.drawImage(newCanvas, 0, 0);
      
      // Draw all annotations on top
      annotations.forEach((ann) => {
        ctx.save();
        
        // Translate to annotation center for rotation
        ctx.translate(ann.x + ann.width / 2, ann.y + ann.height / 2);
        ctx.rotate((ann.rotation * Math.PI) / 180);
        ctx.translate(-(ann.x + ann.width / 2), -(ann.y + ann.height / 2));
        
        // Draw filled rectangle with transparency
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.fillRect(ann.x, ann.y, ann.width, ann.height);
        
        // Draw rectangle border
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.strokeRect(ann.x, ann.y, ann.width, ann.height);
        
        // Draw label background
        ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
        const labelHeight = 22;
        ctx.fillRect(ann.x, ann.y - labelHeight, ann.width, labelHeight);
        
        // Draw label text
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(ann.label, ann.x + ann.width / 2, ann.y - 5);
        
        ctx.restore();
      });
      
      // Update texture
      if (uvTexture) {
        uvTexture.needsUpdate = true;
      }
    });
  },
}));
