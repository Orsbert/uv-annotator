// src/services/annotationRenderer.ts

import type { Annotation } from '../types';
import { Group, Rect, Text, Transformer } from 'react-konva';
import { useEffect, useRef } from 'react';
import Konva from 'konva';
// import React from 'react'; // removed unused import

/**
 * Render a single annotation as a Konva Group.
 * This mirrors the previous JSX used in AnnotationEditor.
 */
export function renderAnnotationToKonva(annotation: Annotation, isSelected: boolean, onSelect: () => void, onChange: (newAttrs: Partial<Annotation>) => void) {
  const { x, y, width, height, rotation, label } = annotation;
  const groupRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  // Attach transformer when selected
  useEffect(() => {
    if (isSelected && groupRef.current && transformerRef.current) {
      transformerRef.current.nodes([groupRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, annotation]);
  return (
    <>
    <Group
      x={x + width / 2}
      y={y + height / 2}
      offsetX={width / 2}
      offsetY={height / 2}
      rotation={rotation}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      ref={groupRef}
      onDragEnd={(e) => {
        const newX = e.target.x() - annotation.width / 2;
        const newY = e.target.y() - annotation.height / 2;
        onChange({ x: newX, y: newY });
        // Force transformer update after drag
        // Note: transformer is managed by parent if needed
      }}
      onTransformEnd={() => {
        const node = groupRef.current;
        if (node) {
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          const newWidth = Math.max(5, annotation.width * scaleX);
          const newHeight = Math.max(5, annotation.height * scaleY);
          onChange({
            x: node.x() - newWidth / 2,
            y: node.y() - newHeight / 2,
            width: newWidth,
            height: newHeight,
            rotation: node.rotation(),
          });
        }
      }}
    >
      <Rect width={width} height={height} stroke="#ff0000" strokeWidth={2} fill="rgba(255, 0, 0, 0.2)" />
      <Rect y={-22} width={width} height={22} fill="rgba(255, 0, 0, 0.9)" cornerRadius={[4, 4, 0, 0]} />
      <Text
        x={width / 2}
        y={-18}
        text={label}
        fontSize={14}
        fill="#ffffff"
        align="center"
        onClick={onSelect}
        onTap={onSelect}
        onDblClick={onSelect}
      />
    </Group>
      {isSelected && (
        <Transformer
          ref={transformerRef}
          rotateEnabled={true}
          enabledAnchors={[
            'top-left', 'top-center', 'top-right',
            'middle-left', 'middle-right',
            'bottom-left', 'bottom-center', 'bottom-right',
          ]}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
}

/**
 * Draw a single annotation onto a 2D canvas context.
 * The canvas coordinate system is pixel space (0‑1024).
 */
export function renderAnnotationToCanvas(ctx: CanvasRenderingContext2D, ann: Annotation) {
  const { x, y, width, height, rotation, label } = ann;
  ctx.save();
  // Translate to centre for rotation
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-(x + width / 2), -(y + height / 2));

  // Filled rectangle
  ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
  ctx.fillRect(x, y, width, height);

  // Border
  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);

  // Label background
  const labelHeight = 22;
  ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
  ctx.fillRect(x, y - labelHeight, width, labelHeight);

  // Label text
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + width / 2, y - 5);

  ctx.restore();
}

/**
 * Render an array of annotations to a canvas context.
 */
export function renderAnnotationsToCanvas(ctx: CanvasRenderingContext2D, annotations: Annotation[]) {
  annotations.forEach((ann) => renderAnnotationToCanvas(ctx, ann));
}
