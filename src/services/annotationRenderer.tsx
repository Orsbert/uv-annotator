// src/services/annotationRenderer.ts

import type { Annotation } from '../types';
import { getColorTheme, computeImageRect } from '../types';
import { Group, Rect, Text, Transformer, Image as KonvaImage } from 'react-konva';
import { useEffect, useRef, useState } from 'react';
import Konva from 'konva';

const annotationImageCache = new Map<string, HTMLImageElement>();
const annotationImageListeners = new Set<() => void>();

export function getAnnotationImage(dataUrl: string): HTMLImageElement | null {
  if (!dataUrl) return null;
  const cached = annotationImageCache.get(dataUrl);
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;
  const img = new window.Image();
  img.onload = () => {
    annotationImageListeners.forEach((cb) => cb());
  };
  img.src = dataUrl;
  annotationImageCache.set(dataUrl, img);
  return null;
}

export function subscribeAnnotationImages(cb: () => void): () => void {
  annotationImageListeners.add(cb);
  return () => { annotationImageListeners.delete(cb); };
}

function useAnnotationImage(dataUrl: string | undefined): HTMLImageElement | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!dataUrl) return;
    if (annotationImageCache.get(dataUrl)?.complete) return;
    return subscribeAnnotationImages(() => setTick((t) => t + 1));
  }, [dataUrl]);
  return dataUrl ? getAnnotationImage(dataUrl) : null;
}

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
  const { x, y, width, height, rotation, label, color, imageData, imageFit, imageAlign, imageOpacity } = annotation;
  const rectGroupRef = useRef<Konva.Group>(null);
  const rectRef = useRef<Konva.Rect>(null);
  const labelGroupRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const textRef = useRef<Konva.Text>(null);
  const [isHovered, setIsHovered] = useState(false);
  const annImage = useAnnotationImage(imageData);

  // Get color theme
  const colorTheme = getColorTheme(color);

  const imageRect = annImage
    ? computeImageRect(
        { x: 0, y: 0, width, height },
        annImage.naturalWidth,
        annImage.naturalHeight,
        imageFit ?? 'contain',
        imageAlign ?? 'center'
      )
    : null;

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
        {/* Image inside box (clipped to rect) */}
        {annImage && imageRect && (
          <Group
            offsetX={width / 2}
            offsetY={height / 2}
            clipFunc={(ctx) => {
              ctx.rect(0, 0, width, height);
            }}
          >
            <KonvaImage
              image={annImage}
              x={imageRect.dx}
              y={imageRect.dy}
              width={imageRect.dw}
              height={imageRect.dh}
              crop={
                imageRect.sx !== 0 || imageRect.sy !== 0 || imageRect.sw !== annImage.naturalWidth || imageRect.sh !== annImage.naturalHeight
                  ? { x: imageRect.sx, y: imageRect.sy, width: imageRect.sw, height: imageRect.sh }
                  : undefined
              }
              opacity={imageOpacity ?? 1}
              listening={false}
            />
          </Group>
        )}

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
          opacity={annImage ? (isHovered || isSelected ? 0.25 : 0.12) : (isHovered || isSelected ? 0.5 : 0.35)}
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
 * Draw an annotation's label as a solid color "chip" with white text at the
 * box's top-left corner. A chip (rather than bare 8px text) is what makes the
 * label legible once the canvas is baked into the mesh texture and downscaled
 * across a face. Drawn in whatever transform the caller has set, so it follows
 * the annotation's rotation.
 */
function drawAnnotationLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  colorTheme: { main: string }
) {
  if (!label) return;

  const fontSize = 16;
  const padX = 7;
  const padY = 4;
  const inset = 6;

  ctx.save();
  ctx.font = `600 ${fontSize}px Arial`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const textW = ctx.measureText(label).width;
  const chipW = textW + padX * 2;
  const chipH = fontSize + padY * 2;
  const chipX = x + inset;
  const chipY = y + inset;

  // Chip background — solid brand color with a soft drop shadow so it lifts off
  // a busy background texture.
  ctx.globalAlpha = 1;
  ctx.fillStyle = colorTheme.main;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(chipX, chipY, chipW, chipH, 5);
  } else {
    ctx.rect(chipX, chipY, chipW, chipH);
  }
  ctx.fill();

  // Label text (no shadow on the glyphs themselves).
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, chipX + padX, chipY + padY);
  ctx.restore();
}

/**
 * Draw a single annotation onto a 2D canvas context.
 * The canvas coordinate system is pixel space (0‑1024).
 */
export function renderAnnotationToCanvas(ctx: CanvasRenderingContext2D, ann: Annotation) {
  if (ann.visible === false) return;
  const { x, y, width, height, rotation, label, color, imageData, imageFit, imageAlign, imageOpacity } = ann;
  const colorTheme = getColorTheme(color);

  ctx.save();
  // Translate to centre for rotation
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-(x + width / 2), -(y + height / 2));

  // Image inside box (clipped to rect)
  const annImage = imageData ? getAnnotationImage(imageData) : null;
  if (annImage) {
    const r = computeImageRect(
      { x, y, width, height },
      annImage.naturalWidth,
      annImage.naturalHeight,
      imageFit ?? 'contain',
      imageAlign ?? 'center'
    );
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.globalAlpha = imageOpacity ?? 1;
    ctx.drawImage(annImage, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
    ctx.restore();
  }

  // Tinted fill. colorTheme.light already carries 0.4 alpha, so we don't multiply
  // it down again (the old 0.4 × 0.35 ≈ 0.14 wash was invisible on the mesh). When
  // a decal image is present we keep the fill faint so the image stays readable.
  ctx.fillStyle = colorTheme.light;
  ctx.globalAlpha = annImage ? 0.35 : 1;
  ctx.fillRect(x, y, width, height);
  ctx.globalAlpha = 1.0;

  // Bold, fully-saturated border so the box reads at texture resolution.
  ctx.strokeStyle = colorTheme.main;
  ctx.lineWidth = 4;
  ctx.strokeRect(x, y, width, height);

  drawAnnotationLabel(ctx, label, x, y, colorTheme);

  ctx.restore();
}

/**
 * Render an array of annotations to a canvas context.
 */
export function renderAnnotationsToCanvas(ctx: CanvasRenderingContext2D, annotations: Annotation[]) {
  annotations.forEach((ann) => renderAnnotationToCanvas(ctx, ann));
}

/**
 * Draw the "base" portion of an annotation: colored fill + border + label.
 * Skips the in-box decal image (drawn separately via renderAnnotationDecalToCanvas).
 */
export function renderAnnotationBaseToCanvas(ctx: CanvasRenderingContext2D, ann: Annotation) {
  if (ann.visible === false) return;
  const { x, y, width, height, rotation, label, color, imageData } = ann;
  const colorTheme = getColorTheme(color);
  const hasImage = !!imageData;

  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-(x + width / 2), -(y + height / 2));

  // Tinted fill. colorTheme.light already carries 0.4 alpha, so we don't multiply
  // it down again (the old 0.4 × 0.35 ≈ 0.14 wash was invisible on the mesh). When
  // a decal image is present we keep the fill faint so the image stays readable.
  ctx.fillStyle = colorTheme.light;
  ctx.globalAlpha = hasImage ? 0.35 : 1;
  ctx.fillRect(x, y, width, height);
  ctx.globalAlpha = 1.0;

  // Bold, fully-saturated border so the box reads at texture resolution.
  ctx.strokeStyle = colorTheme.main;
  ctx.lineWidth = 4;
  ctx.strokeRect(x, y, width, height);

  drawAnnotationLabel(ctx, label, x, y, colorTheme);

  ctx.restore();
}

export function renderAnnotationBasesToCanvas(ctx: CanvasRenderingContext2D, annotations: Annotation[]) {
  annotations.forEach((ann) => renderAnnotationBaseToCanvas(ctx, ann));
}

/**
 * Draw only the in-box decal image for an annotation. Used so decals render
 * on top of the (optionally-dimmed) base composite at full alpha.
 */
export function renderAnnotationDecalToCanvas(ctx: CanvasRenderingContext2D, ann: Annotation) {
  if (ann.visible === false) return;
  const { x, y, width, height, rotation, imageData, imageFit, imageAlign, imageOpacity } = ann;
  if (!imageData) return;
  const annImage = getAnnotationImage(imageData);
  if (!annImage) return;

  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-(x + width / 2), -(y + height / 2));

  const r = computeImageRect(
    { x, y, width, height },
    annImage.naturalWidth,
    annImage.naturalHeight,
    imageFit ?? 'contain',
    imageAlign ?? 'center'
  );
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.globalAlpha = imageOpacity ?? 1;
  ctx.drawImage(annImage, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
  ctx.restore();
}

export function renderAnnotationDecalsToCanvas(ctx: CanvasRenderingContext2D, annotations: Annotation[]) {
  annotations.forEach((ann) => renderAnnotationDecalToCanvas(ctx, ann));
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
    rotation: number;
    opacity: number;
  }>
) {
  for (const overlay of overlays) {
    if (!overlay.visible || !overlay.image) continue;
    const w = overlay.image.naturalWidth * overlay.scaleX;
    const h = overlay.image.naturalHeight * overlay.scaleY;
    ctx.save();
    ctx.globalAlpha = overlay.opacity;
    // Rotate around the image center so a typed angle spins it in place.
    ctx.translate(overlay.x + w / 2, overlay.y + h / 2);
    ctx.rotate(((overlay.rotation ?? 0) * Math.PI) / 180);
    ctx.drawImage(overlay.image, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

