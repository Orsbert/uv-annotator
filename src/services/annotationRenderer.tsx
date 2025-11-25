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
  const getLabelWidth = () => {
    if (textRef.current) {
      const textWidth = textRef.current.width();
      const padding = 16; // 8px on each side
      return Math.max(width, textWidth + padding);
    }
    return width;
  };

  const labelWidth = getLabelWidth();
  
  return (
    <>
      {/* Main group positioned at top-left, rotation around top-left */}
      <Group
        x={x}
        y={y}
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
          // Direct top-left coordinates
          onChange({
            x: node.x(),
            y: node.y(),
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

          // Update label size
          const labelBg = labelBgRef.current;
          const labelText = textRef.current;
          if (labelBg && labelText) {
            const textWidth = labelText.width();
            const padding = 16;
            const newLabelWidth = Math.max(newWidth, textWidth + padding);
            labelBg.width(newLabelWidth);
            labelBg.x(-newLabelWidth / 2);
            labelText.x(0);
          }

          // Reset scale
          node.scaleX(1);
          node.scaleY(1);

          // Force transformer update
          if (transformerRef.current) {
            transformerRef.current.forceUpdate();
            transformerRef.current.getLayer()?.batchDraw();
          }

          // Notify parent with updated attributes (position stays top-left)
          onChange({
            x: node.x(),
            y: node.y(),
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
        {/* Main rectangle */}
        <Rect
          ref={rectRef}
          width={width}
          height={height}
          stroke={colorTheme.main}
          strokeWidth={isHovered ? 3 : 2}
          fill={colorTheme.light}
        />
      </Group>

      {/* Label group – positioned at top-left, follows rotation */}
      <Group
        x={x}
        y={y}
        rotation={rotation}
        ref={labelGroupRef}
        listening={false}
      >
        {/* Label background centered */}
        <Rect
          ref={labelBgRef}
          x={-labelWidth / 2}
          y={-22}
          width={labelWidth}
          height={22}
          fill={colorTheme.dark}
          cornerRadius={[4, 4, 0, 0]}
        />
        {/* Label text */}
        <Text
          ref={textRef}
          x={0}
          y={-18}
          text={label}
          fontSize={14}
          fill="#ffffff"
          align="center"
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

