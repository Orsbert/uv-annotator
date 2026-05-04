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
          strokeWidth={isSelected ? 2 : 1.5}
          fill={colorTheme.light}
          opacity={isHovered || isSelected ? 0.5 : 0.35}
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
        {/* Label text inside box at top-left - shown on hover/select */}
        {(isHovered || isSelected) && (() => {
          const fontSize = 8;
          const padding = 4;
          
          return (
            <Text
              ref={textRef}
              x={-width / 2 + padding}
              y={-height / 2 + padding}
              text={label}
              fontSize={fontSize}
              fill="#ffffff"
              align="left"
              shadowColor="#000000"
              shadowBlur={3}
              shadowOffset={{ x: 0, y: 0 }}
              shadowOpacity={1}
            />
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
  if (ann.visible === false) return;
  const { x, y, width, height, rotation, label, color } = ann;
  const colorTheme = getColorTheme(color);

  ctx.save();
  // Translate to centre for rotation
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-(x + width / 2), -(y + height / 2));

  // Filled rectangle
  ctx.fillStyle = colorTheme.light;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(x, y, width, height);
  ctx.globalAlpha = 1.0;

  // Border
  ctx.strokeStyle = colorTheme.main;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, width, height);

  // Label inside box at top-left with padding
  const fontSize = 8;
  const padding = 4;

  // Draw shadow first
  ctx.fillStyle = '#000000';
  ctx.font = `${fontSize}px Arial`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  // Draw shadow in multiple directions for blur effect
  ctx.globalAlpha = 0.8;
  ctx.fillText(label, x + padding - 1, y + padding + 1);
  ctx.fillText(label, x + padding + 1, y + padding + 1);
  ctx.fillText(label, x + padding - 1, y + padding - 1);
  ctx.fillText(label, x + padding + 1, y + padding - 1);
  ctx.globalAlpha = 1;
  
  // Draw white text on top
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, x + padding, y + padding);

  ctx.restore();
}

/**
 * Render an array of annotations to a canvas context.
 */
export function renderAnnotationsToCanvas(ctx: CanvasRenderingContext2D, annotations: Annotation[]) {
  annotations.forEach((ann) => renderAnnotationToCanvas(ctx, ann));
}

/**
 * Draw all visible overlays onto a 2D canvas context.
 * Renders each overlay at its stored position, scale, and opacity.
 */
export function renderOverlaysToCanvas(
  ctx: CanvasRenderingContext2D,
  overlays: Array<{
    visible: boolean;
    image: HTMLImageElement | null;
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    opacity: number;
  }>
) {
  for (const overlay of overlays) {
    if (!overlay.visible || !overlay.image) continue;
    ctx.save();
    ctx.globalAlpha = overlay.opacity;
    ctx.drawImage(
      overlay.image,
      overlay.x,
      overlay.y,
      overlay.image.naturalWidth * overlay.scaleX,
      overlay.image.naturalHeight * overlay.scaleY
    );
    ctx.restore();
  }
}

