import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Transformer, Text, Image as KonvaImage } from 'react-konva';
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
  const rectRef = useRef<Konva.Rect>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && rectRef.current && transformerRef.current) {
      transformerRef.current.nodes([rectRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <Rect
        ref={rectRef}
        x={annotation.x}
        y={annotation.y}
        width={annotation.width}
        height={annotation.height}
        rotation={annotation.rotation}
        stroke="#ff0000"
        strokeWidth={2}
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
          const node = rectRef.current;
          if (node) {
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();

            node.scaleX(1);
            node.scaleY(1);

            onChange({
              x: node.x(),
              y: node.y(),
              width: Math.max(5, node.width() * scaleX),
              height: Math.max(5, node.height() * scaleY),
              rotation: node.rotation(),
            });
          }
        }}
      />
      <Text
        x={annotation.x}
        y={annotation.y - 20}
        text={annotation.label}
        fontSize={14}
        fill="#ffffff"
        padding={4}
        fillAfterStrokeEnabled
        listening={false}
        background="#ff0000"
      />
      {isSelected && (
        <Transformer
          ref={transformerRef}
          rotateEnabled={true}
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
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
  const uvTexture = useStore((state) => state.uvTexture);
  
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const stageRef = useRef<Konva.Stage>(null);

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
    <div className="w-full h-full overflow-auto bg-muted">
      <Stage
        ref={stageRef}
        width={1024}
        height={1024}
        onClick={(e) => {
          // Deselect when clicking on empty area
          if (e.target === e.target.getStage()) {
            setSelectedAnnotationId(null);
          }
        }}
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
        </Layer>
      </Stage>
    </div>
  );
}
