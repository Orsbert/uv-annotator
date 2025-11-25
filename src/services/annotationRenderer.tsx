// src/services/annotationRenderer.ts

import type { Annotation } from '../types';
import { getColorTheme } from '../types';
import { Group, Rect, Text, Transformer } from 'react-konva';
import { useEffect, useRef, useState } from 'react';
import Konva from 'konva';

interface AnnotationBoxProps {
  annotation: Annotation;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: Partial<Annotation>) => void;
}

/**
 * Render a single annotation as a Konva Group.
 * This is a React component that properly uses hooks.
 */
export function AnnotationBox({ annotation, isSelected, onSelect, onChange }: AnnotationBoxProps) {
  const { x, y, width, height, rotation, label, color } = annotation;
  const rectGroupRef = useRef<Konva.Group>(null);
  const rectRef = useRef<Konva.Rect>(null);
  const labelGroupRef = useRef<Konva.Group>(null);
  const labelBgRef = useRef<Konva.Rect>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const textRef = useRef<Konva.Text>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Get color theme
  const colorTheme = getColorTheme(color);

  // Attach transformer to the rectangle group only
  useEffect(() => {
    if (isSelected && rectGroupRef.current && transformerRef.current) {
      transformerRef.current.nodes([rectGroupRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  // Sync label position with rectangle group
  useEffect(() => {
    if (rectGroupRef.current && labelGroupRef.current) {
      const rectGroup = rectGroupRef.current;
      const labelGroup = labelGroupRef.current;
      
      labelGroup.x(rectGroup.x());
      labelGroup.y(rectGroup.y());
      labelGroup.rotation(rectGroup.rotation());
      labelGroup.getLayer()?.batchDraw();
    }
  }, [x, y, rotation, width, height]);

  // Calculate label background width to accommodate text overflow
  // Not needed anymore since labels use the box width
  
  
  return (
    <>
      {/* Main group positioned at CENTER for center rotation */}
      <Group
        x={x + width / 2}
        y={y + height / 2}
        rotation={rotation}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        ref={rectGroupRef}
        onDragEnd={() => {
          const node = rectGroupRef.current;
          if (!node) return;
          // Convert center position back to top-left
          onChange({
            x: node.x() - width / 2,
            y: node.y() - height / 2,
          });
        }}
        onTransformEnd={() => {
          const node = rectGroupRef.current;
          const rect = rectRef.current;
          if (!node || !rect) return;

          const scaleX = node.scaleX();
          const scaleY = node.scaleY();

          const newWidth = Math.max(5, width * scaleX);
          const newHeight = Math.max(5, height * scaleY);

          // Update rectangle dimensions
          rect.width(newWidth);
          rect.height(newHeight);
          rect.offsetX(newWidth / 2);
          rect.offsetY(newHeight / 2);

          // Reset scale
          node.scaleX(1);
          node.scaleY(1);

          // Force transformer update
          if (transformerRef.current) {
            transformerRef.current.forceUpdate();
            transformerRef.current.getLayer()?.batchDraw();
          }

          // Notify parent with updated attributes (convert center to top-left)
          onChange({
            x: node.x() - newWidth / 2,
            y: node.y() - newHeight / 2,
            width: newWidth,
            height: newHeight,
            rotation: node.rotation(),
          });
        }}
        onDragMove={() => {
          // Keep label group in sync
          const rectGroup = rectGroupRef.current;
          const labelGroup = labelGroupRef.current;
          if (rectGroup && labelGroup) {
            labelGroup.x(rectGroup.x());
            labelGroup.y(rectGroup.y());
            labelGroup.rotation(rectGroup.rotation());
          }
        }}
      >
        {/* Main rectangle - centered */}
        <Rect
          ref={rectRef}
          offsetX={width / 2}
          offsetY={height / 2}
          width={width}
          height={height}
          stroke={colorTheme.main}
          strokeWidth={isSelected ? 3 : (isHovered ? 2.5 : 2)}
          fill={isHovered ? colorTheme.light + '40' : colorTheme.light}
          opacity={isHovered || isSelected ? 0.8 : 0.6}
        />
      </Group>

      {/* Label group – positioned at center, follows rotation */}
      <Group
        x={x + width / 2}
        y={y + height / 2}
        rotation={rotation}
        ref={labelGroupRef}
        listening={false}
      >
        {/* Determine if label should be inside or outside based on height */}
        {(() => {
          const labelHeight = 22;
          const isInside = height >= labelHeight + 10; // Need at least 10px padding
          const labelY = isInside ? (-height / 2) : (-height / 2 - labelHeight);
          
          return (
            <>
              {/* Label background */}
              <Rect
                ref={labelBgRef}
                offsetX={width / 2}
                x={0}
                y={labelY}
                width={width}
                height={labelHeight}
                fill={colorTheme.dark}
                cornerRadius={isInside ? [0, 0, 0, 0] : [4, 4, 0, 0]}
              />
              {/* Label text */}
              <Text
                ref={textRef}
                x={0}
                y={labelY + 4}
                text={label}
                fontSize={14}
                fill="#ffffff"
                align="center"
                width={width}
                offsetX={width / 2}
              />
            </>
          );
        })()}
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
          ignoreStroke={true}
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
  const { x, y, width, height, rotation, label, color } = ann;
  const colorTheme = getColorTheme(color);
  
  ctx.save();
  // Translate to centre for rotation
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-(x + width / 2), -(y + height / 2));

  // Filled rectangle
  ctx.fillStyle = colorTheme.light;
  ctx.globalAlpha = 0.6;
  ctx.fillRect(x, y, width, height);
  ctx.globalAlpha = 1.0;

  // Border
  ctx.strokeStyle = colorTheme.main;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);

  // Label - place inside if height allows
  const labelHeight = 22;
  const isInside = height >= labelHeight + 10;
  const labelY = isInside ? y : y - labelHeight;
  
  // Label background
  ctx.fillStyle = colorTheme.dark;
  ctx.fillRect(x, labelY, width, labelHeight);

  // Label text
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x + width / 2, labelY + 4);

  ctx.restore();
}

/**
 * Render an array of annotations to a canvas context.
 */
export function renderAnnotationsToCanvas(ctx: CanvasRenderingContext2D, annotations: Annotation[]) {
  annotations.forEach((ann) => renderAnnotationToCanvas(ctx, ann));
}

