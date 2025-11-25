import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Image as KonvaImage } from 'react-konva';
import Konva from 'konva';
import { Plus, Minus, Maximize2 } from 'lucide-react';
import { useAnnotationStore, useModelStore } from '../store/combinedStores';
import { useCanvasStore } from '../store/combinedStores';
import type { Annotation } from '../types';
import { ANNOTATION_COLORS } from '../types';
import { AnnotationBox } from '../services/annotationRenderer';
import { Button } from './ui/button';

// Deprecated AnnotationBoxProps interface removed.


export function AnnotationEditor() {
  const uvCanvas = useCanvasStore((state) => state.uvCanvas);
  const uvTexture = useCanvasStore((state) => state.uvTexture);
  const annotations = useAnnotationStore((state) => state.annotations);
  const selectedAnnotationId = useAnnotationStore((state) => state.selectedAnnotationId);
  const updateAnnotation = useAnnotationStore((state) => state.updateAnnotation);
  const setSelectedAnnotationId = useAnnotationStore((state) => state.setSelectedAnnotationId);
  const addAnnotation = useAnnotationStore((state) => state.addAnnotation);
  const setPendingLabelEdit = useAnnotationStore((state) => state.setPendingLabelEdit);
  const selectedMesh = useModelStore((state) => state.selectedMesh);
  
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  
  // Container dimensions for responsive sizing
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  
  // Zoom and pan state
  const [stageScale, setStageScale] = useState(1);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const minScale = 0.1;
  const maxScale = 10;

  // Load the UV canvas as an image for Konva
  useEffect(() => {
    if (uvCanvas) {
      const img = new window.Image();
      img.src = uvCanvas.toDataURL();
      img.onload = () => {
        setImage(img);
      };
    }
  }, [uvCanvas]);

  // Update texture when annotations change
  useEffect(() => {
    if (uvTexture && uvCanvas) {
      // Redraw canvas with annotations
      const ctx = uvCanvas.getContext('2d');
      if (ctx && selectedMesh) {
        // Need to import these dynamically
        import('../utils/uvGenerator').then(({ generateUVLayout }) => {
          // Regenerate clean UV layout
          const { canvas: newCanvas } = generateUVLayout(selectedMesh);
          ctx.clearRect(0, 0, uvCanvas.width, uvCanvas.height);
          ctx.drawImage(newCanvas, 0, 0);
          
          // Draw annotations
          import('../services/annotationRenderer').then(({ renderAnnotationsToCanvas }) => {
            const currentAnnotations = useAnnotationStore.getState().annotations;
            renderAnnotationsToCanvas(ctx, currentAnnotations);
            
            // Force texture update
            uvTexture.needsUpdate = true;
          });
        });
      }
    }
  }, [annotations, uvTexture, uvCanvas, selectedMesh]);

  // Measure container size and handle resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setContainerSize({ width, height });
      }
    };

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(updateSize);
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [uvCanvas]); // Re-measure when uvCanvas changes

  const handleMouseDown = (e: any) => {
    const stage = stageRef.current;
    if (!stage) return;

    // Only start drawing/panning if clicking on the background
    if (e.target !== e.target.getStage() && e.target.getClassName() !== 'Image') {
      return;
    }

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    // Check if spacebar is held (common pan shortcut) or just regular click for pan
    const shouldPan = true; // For now, background click = pan
    
    if (shouldPan) {
      setIsPanning(true);
      setPanStart(pointer);
    } else {
      const pos = stage.getRelativePointerPosition();
      if (!pos) return;
      setIsDrawing(true);
      setDrawStart(pos);
      setCurrentRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
    }
    
    setSelectedAnnotationId(null);
  };

  const handleMouseMove = () => {
    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    if (isPanning && panStart) {
      const dx = pointer.x - panStart.x;
      const dy = pointer.y - panStart.y;
      setStagePosition({
        x: stagePosition.x + dx,
        y: stagePosition.y + dy,
      });
      setPanStart(pointer);
      return;
    }

    if (!isDrawing || !drawStart) return;

    const pos = stage.getRelativePointerPosition();
    if (!pos) return;

    const width = pos.x - drawStart.x;
    const height = pos.y - drawStart.y;

    setCurrentRect({
      x: width < 0 ? pos.x : drawStart.x,
      y: height < 0 ? pos.y : drawStart.y,
      width: Math.abs(width),
      height: Math.abs(height),
    });
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      return;
    }
    
    if (!isDrawing || !currentRect) {
      setIsDrawing(false);
      setDrawStart(null);
      setCurrentRect(null);
      return;
    }

    // Only create annotation if the box has some size (at least 10x10)
    if (currentRect.width > 10 && currentRect.height > 10) {
      // Count existing boxes with bN pattern to generate next number
      const existingBoxCount = annotations.filter(a => a.label.match(/^b\d+$/)).length;
      
      // Assign color based on total annotation count (cycles through 8 colors)
      const colorIndex = annotations.length % ANNOTATION_COLORS.length;
      
      const newAnnotation: Annotation = {
        id: `ann-${Date.now()}`,
        x: currentRect.x,
        y: currentRect.y,
        width: currentRect.width,
        height: currentRect.height,
        rotation: 0,
        label: `b${existingBoxCount + 1}`,
        color: ANNOTATION_COLORS[colorIndex].name,
      };
      addAnnotation(newAnnotation);
      
      // Trigger label edit dialog (same as 3D paint flow)
      setPendingLabelEdit(newAnnotation.id);
    }

    setIsDrawing(false);
    setDrawStart(null);
    setCurrentRect(null);
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const scaleBy = 1.1;
    const oldScale = stageScale; // Use state scale, not stage.scaleX()
    const newScale = e.evt.deltaY > 0 
      ? Math.max(minScale, oldScale / scaleBy) 
      : Math.min(maxScale, oldScale * scaleBy);

    setStageScale(newScale);

    // Zoom to pointer position
    const mousePointTo = {
      x: (pointer.x - stagePosition.x) / (oldScale * scale),
      y: (pointer.y - stagePosition.y) / (oldScale * scale),
    };

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale * scale,
      y: pointer.y - mousePointTo.y * newScale * scale,
    };

    setStagePosition(newPos);
  };

  const handleZoomIn = () => {
    const newScale = Math.min(maxScale, stageScale * 1.2);
    setStageScale(newScale);
  };

  const handleZoomOut = () => {
    const newScale = Math.max(minScale, stageScale / 1.2);
    setStageScale(newScale);
  };

  const handleResetZoom = () => {
    setStageScale(1);
    setStagePosition({ x: 0, y: 0 });
  };

  if (!uvCanvas) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <p className="text-muted-foreground">
          Generate UV layout first
        </p>
      </div>
    );
  }

  // Calculate scale to fit container while maintaining aspect ratio
  const baseSize = 1024; // UV canvas size
  const padding = 32; // 16px padding on each side
  const availableWidth = containerSize.width - padding;
  const availableHeight = containerSize.height - padding;
  const scale = Math.min(availableWidth / baseSize, availableHeight / baseSize, 1);
  const stageWidth = baseSize;
  const stageHeight = baseSize;

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-muted overflow-hidden relative">
      {/* Zoom controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-background/90 backdrop-blur-sm p-2 rounded-lg border shadow-lg">
        <Button 
          size="icon" 
          variant="outline" 
          onClick={handleZoomIn}
          className="h-8 w-8"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button 
          size="icon" 
          variant="outline" 
          onClick={handleZoomOut}
          className="h-8 w-8"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button 
          size="icon" 
          variant="outline" 
          onClick={handleResetZoom}
          className="h-8 w-8"
          title="Reset zoom"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        <div className="text-xs text-center text-muted-foreground px-1">
          {Math.round(stageScale * 100)}%
        </div>
      </div>

      <div style={{ width: stageWidth * scale, height: stageHeight * scale }}>
        <Stage
          ref={stageRef}
          width={stageWidth}
          height={stageHeight}
          scaleX={scale * stageScale}
          scaleY={scale * stageScale}
          x={stagePosition.x}
          y={stagePosition.y}
          draggable={false}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <Layer>
            {image && <KonvaImage image={image} />}
            
            {annotations.map((annotation) => (
              <AnnotationBox
                key={annotation.id}
                annotation={annotation}
                isSelected={annotation.id === selectedAnnotationId}
                onSelect={() => setSelectedAnnotationId(annotation.id)}
                onChange={(newAttrs) => updateAnnotation(annotation.id, newAttrs)}
              />
            ))}{/* Draw preview rectangle while dragging */}
            {isDrawing && currentRect && (
              <Rect
                x={currentRect.x}
                y={currentRect.y}
                width={currentRect.width}
                height={currentRect.height}
                stroke="#ff0000"
                strokeWidth={2}
                dash={[5, 5]}
                listening={false}
              />
            )}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
