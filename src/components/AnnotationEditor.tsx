import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Image as KonvaImage } from 'react-konva';
import Konva from 'konva';
import { useAnnotationStore } from '../store/combinedStores';
import { useCanvasStore } from '../store/combinedStores';
import type { Annotation } from '../types';
import { ANNOTATION_COLORS } from '../types';
import { AnnotationBox } from '../services/annotationRenderer';

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
  
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  
  // Container dimensions for responsive sizing
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

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
      uvTexture.needsUpdate = true;
    }
  }, [annotations, uvTexture, uvCanvas]);

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
    // Only start drawing if clicking on the background (not on existing annotations)
    if (e.target !== e.target.getStage() && e.target.getClassName() !== 'Image') {
      return;
    }

    const stage = stageRef.current;
    if (!stage) return;

    const pos = stage.getRelativePointerPosition();
    if (!pos) return;

    setIsDrawing(true);
    setDrawStart(pos);
    setCurrentRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
    setSelectedAnnotationId(null);
  };

  const handleMouseMove = () => {
    if (!isDrawing || !drawStart) return;

    const stage = stageRef.current;
    if (!stage) return;

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
    <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-muted overflow-hidden">
      <div style={{ width: stageWidth * scale, height: stageHeight * scale }}>
        <Stage
          ref={stageRef}
          width={stageWidth}
          height={stageHeight}
          scaleX={scale}
          scaleY={scale}
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
