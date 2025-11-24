import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Transformer, Text, Image as KonvaImage, Group } from 'react-konva';
import Konva from 'konva';
import { useStore } from '../store/useStore';
import type { Annotation } from '../types';

interface AnnotationBoxProps {
  annotation: Annotation;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: Partial<Annotation>) => void;
}

function AnnotationBox({ annotation, isSelected, onSelect, onChange }: AnnotationBoxProps) {
  const groupRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const textRef = useRef<Konva.Text>(null);
  const [isEditingLabel, setIsEditingLabel] = useState(false);

  useEffect(() => {
    if (isSelected && groupRef.current && transformerRef.current) {
      transformerRef.current.nodes([groupRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const handleLabelDoubleClick = () => {
    setIsEditingLabel(true);

    // Create a text input element
    const textNode = textRef.current;
    if (!textNode) return;

    const stage = textNode.getStage();
    if (!stage) return;

    const textPosition = textNode.absolutePosition();
    const stageBox = stage.container().getBoundingClientRect();

    const areaPosition = {
      x: stageBox.left + textPosition.x,
      y: stageBox.top + textPosition.y,
    };

    const textarea = document.createElement('input');
    document.body.appendChild(textarea);

    textarea.value = annotation.label;
    textarea.style.position = 'absolute';
    textarea.style.top = areaPosition.y + 'px';
    textarea.style.left = areaPosition.x + 'px';
    textarea.style.minWidth = annotation.width + 'px';
    textarea.style.fontSize = '14px';
    textarea.style.border = '2px solid #ff0000';
    textarea.style.padding = '2px';
    textarea.style.margin = '0px';
    textarea.style.overflow = 'hidden';
    textarea.style.background = 'rgba(255, 0, 0, 0.9)';
    textarea.style.color = 'white';
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.textAlign = 'center';

    textarea.focus();
    textarea.select();

    const removeTextarea = () => {
      textarea.parentNode?.removeChild(textarea);
      setIsEditingLabel(false);
    };

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        onChange({ label: textarea.value });
        removeTextarea();
      }
      if (e.key === 'Escape') {
        removeTextarea();
      }
    });

    textarea.addEventListener('blur', () => {
      onChange({ label: textarea.value });
      removeTextarea();
    });
  };

  return (
    <>
      <Group
        ref={groupRef}
        x={annotation.x}
        y={annotation.y}
        rotation={annotation.rotation}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={() => {
          const node = groupRef.current;
          if (node) {
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();

            node.scaleX(1);
            node.scaleY(1);

            onChange({
              x: node.x(),
              y: node.y(),
              width: Math.max(5, annotation.width * scaleX),
              height: Math.max(5, annotation.height * scaleY),
              rotation: node.rotation(),
            });
          }
        }}
      >
        <Rect
          width={annotation.width}
          height={annotation.height}
          stroke="#ff0000"
          strokeWidth={2}
          fill="rgba(255, 0, 0, 0.2)"
        />
        <Rect
          y={-22}
          width={annotation.width}
          height={22}
          fill="rgba(255, 0, 0, 0.9)"
          cornerRadius={[4, 4, 0, 0]}
        />
        <Text
          ref={textRef}
          x={annotation.width / 2}
          y={-18}
          text={annotation.label}
          fontSize={14}
          fill="#ffffff"
          offsetX={0}
          align="center"
          wrap="none"
          onClick={onSelect}
          onTap={onSelect}
          onDblClick={handleLabelDoubleClick}
          onDblTap={handleLabelDoubleClick}
        />
      </Group>
      {isSelected && (
        <Transformer
          ref={transformerRef}
          rotateEnabled={true}
          enabledAnchors={[
            'top-left', 'top-center', 'top-right',
            'middle-left', 'middle-right',
            'bottom-left', 'bottom-center', 'bottom-right'
          ]}
        />
      )}
    </>
  );
}

export function AnnotationEditor() {
  const uvCanvas = useStore((state) => state.uvCanvas);
  const annotations = useStore((state) => state.annotations);
  const selectedAnnotationId = useStore((state) => state.selectedAnnotationId);
  const updateAnnotation = useStore((state) => state.updateAnnotation);
  const setSelectedAnnotationId = useStore((state) => state.setSelectedAnnotationId);
  const addAnnotation = useStore((state) => state.addAnnotation);
  const uvTexture = useStore((state) => state.uvTexture);
  
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const stageRef = useRef<Konva.Stage>(null);
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

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

  const handleMouseDown = (e: any) => {
    // Only start drawing if clicking on the background (not on existing annotations)
    if (e.target !== e.target.getStage() && e.target.getClassName() !== 'Image') {
      return;
    }

    const stage = stageRef.current;
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    setIsDrawing(true);
    setDrawStart(pos);
    setCurrentRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
    setSelectedAnnotationId(null);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing || !drawStart) return;

    const stage = stageRef.current;
    if (!stage) return;

    const pos = stage.getPointerPosition();
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
      const newAnnotation: Annotation = {
        id: `ann-${Date.now()}`,
        x: currentRect.x,
        y: currentRect.y,
        width: currentRect.width,
        height: currentRect.height,
        rotation: 0,
        label: 'New Annotation',
      };
      addAnnotation(newAnnotation);
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

  return (
    <div className="w-full h-full flex items-center justify-center bg-muted p-4">
      <Stage
        ref={stageRef}
        width={1024}
        height={1024}
        scaleX={0.9}
        scaleY={0.9}
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
          ))}

          {/* Draw preview rectangle while dragging */}
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
  );
}
