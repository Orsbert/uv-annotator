import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Image as KonvaImage, Transformer } from 'react-konva';
import Konva from 'konva';
import { Plus, Minus, Maximize2, MousePointer2, Square } from 'lucide-react';
import { useAnnotationStore, useModelStore, useOverlayStore, useUiStore, meshKeyOf, EMPTY_ANNOTATIONS } from '../store/combinedStores';
import { useCanvasStore } from '../store/combinedStores';
import type { Annotation } from '../types';
import { ANNOTATION_COLORS } from '../types';
import { AnnotationBox, renderAnnotationBasesToCanvas, renderAnnotationDecalsToCanvas, renderOverlaysToCanvas, subscribeAnnotationImages } from '../services/annotationRenderer';
import { generateUVLayout } from '../utils/uvGenerator';
import { Button } from './ui/button';
import { AnnotationContextMenu } from './AnnotationContextMenu';

// Deprecated AnnotationBoxProps interface removed.


export function AnnotationEditor() {
  const selectedMesh = useModelStore((state) => state.selectedMesh);
  const meshKey = meshKeyOf(selectedMesh);

  const canvasSize = useCanvasStore((state) => state.canvasSize);
  const showWireframe = useCanvasStore((state) => state.showWireframe);
  const uvCanvas = useCanvasStore((state) => state.canvasByMesh[meshKey] ?? null);
  const uvTexture = useCanvasStore((state) => state.textureByMesh[meshKey] ?? null);
  const backgroundImage = useCanvasStore((state) => state.backgroundImagesByMesh[meshKey] ?? null);
  const baseOpacity = useCanvasStore((state) => state.baseOpacityByMesh[meshKey] ?? 1);
  const setMeshCanvas = useCanvasStore((state) => state.setMeshCanvas);

  const annotations = useAnnotationStore((state) => state.annotationsByMesh[meshKey] ?? EMPTY_ANNOTATIONS);
  const selectedAnnotationIds = useAnnotationStore((state) => state.selectedAnnotationIds);
  const updateAnnotation = useAnnotationStore((state) => state.updateAnnotation);
  const setSelectedAnnotationIds = useAnnotationStore((state) => state.setSelectedAnnotationIds);
  const toggleAnnotationSelection = useAnnotationStore((state) => state.toggleAnnotationSelection);
  const moveAnnotations = useAnnotationStore((state) => state.moveAnnotations);
  const patchAnnotations = useAnnotationStore((state) => state.patchAnnotations);
  const addAnnotation = useAnnotationStore((state) => state.addAnnotation);
  const setPendingLabelEdit = useAnnotationStore((state) => state.setPendingLabelEdit);

  const canvasTool = useUiStore((state) => state.canvasTool);
  const setCanvasTool = useUiStore((state) => state.setCanvasTool);

  const overlays = useOverlayStore((state) => state.overlays);
  const updateOverlay = useOverlayStore((state) => state.updateOverlay);

  // Auto-create per-mesh canvas + texture when a mesh is selected and none exists yet.
  useEffect(() => {
    if (!selectedMesh) return;
    if (uvCanvas && uvTexture) return;
    const { canvas, texture } = generateUVLayout(selectedMesh, canvasSize);
    setMeshCanvas(meshKey, canvas, texture);
  }, [selectedMesh, meshKey, canvasSize, uvCanvas, uvTexture, setMeshCanvas]);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRefs = useRef<Map<string, Konva.Image>>(new Map());
  const overlayTransformerRef = useRef<Konva.Transformer>(null);
  // Shared transformer for a multi-selection: one bounding box with move/scale/
  // rotate handles that acts on every selected box at once (Figma-style).
  const groupTransformerRef = useRef<Konva.Transformer>(null);
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Marquee (rubber-band) selection state — active only with the Select tool.
  const [isMarqueeing, setIsMarqueeing] = useState(false);
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const marqueeAdditiveRef = useRef(false);

  // Live Konva nodes per annotation id, so a multi-selection can be translated
  // together during a drag. Populated by each AnnotationBox via registerNode.
  const nodeRegistry = useRef<Map<string, { group: Konva.Group; label: Konva.Group }>>(new Map());
  const registerNode = useCallback(
    (id: string, nodes: { group: Konva.Group; label: Konva.Group } | null) => {
      if (nodes) nodeRegistry.current.set(id, nodes);
      else nodeRegistry.current.delete(id);
    },
    [],
  );
  // Start-of-drag CENTER positions of every selected node, keyed by id.
  const groupDragStartRef = useRef<Map<string, { x: number; y: number }> | null>(null);

  // Right-click context menu for an annotation box (viewport coords + target id).
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  
  // Container dimensions for responsive sizing
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  
  // Zoom and pan state
  const [stageScale, setStageScale] = useState(1);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const minScale = 0.1;
  const maxScale = 10;

  // Hold space to pan (Figma/Photoshop convention)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      setIsSpaceHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpaceHeld(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Close the context menu when the active mesh changes.
  useEffect(() => setCtxMenu(null), [meshKey]);

  // Cache wireframe canvas -- only regenerate when mesh or canvasSize changes
  const wireframeCanvas = useMemo(() => {
    if (!selectedMesh) return null;
    const { canvas } = generateUVLayout(selectedMesh, canvasSize);
    return canvas;
  }, [selectedMesh, canvasSize]);

  // Build the base layer image for the Konva editor (background + wireframe only).
  // Overlays and annotations are drawn as Konva nodes on top, so we exclude them
  // here to avoid double-rendering when the user moves them.
  useEffect(() => {
    if (!uvCanvas) return;
    const base = document.createElement('canvas');
    base.width = uvCanvas.width;
    base.height = uvCanvas.height;
    const ctx = base.getContext('2d');
    if (!ctx) return;

    if (backgroundImage && backgroundImage.complete && backgroundImage.naturalWidth > 0) {
      ctx.drawImage(backgroundImage, 0, 0, base.width, base.height);
    }
    if (showWireframe && wireframeCanvas) {
      ctx.drawImage(wireframeCanvas, 0, 0);
    }

    const img = new window.Image();
    img.src = base.toDataURL();
    img.onload = () => setImage(img);
  }, [uvCanvas, backgroundImage, showWireframe, wireframeCanvas]);

  // Tick to redraw when annotation images finish loading async
  const [annImageTick, setAnnImageTick] = useState(0);
  useEffect(() => subscribeAnnotationImages(() => setAnnImageTick((t) => t + 1)), []);

  // Update 3D texture when annotations or overlays or background change
  useEffect(() => {
    if (!uvTexture || !uvCanvas || !wireframeCanvas) return;
    const ctx = uvCanvas.getContext('2d');
    if (!ctx) return;

    // Phase 1: composite "base" layers (background + wireframe + overlays + annotation
    // colored fills/labels) into a temp canvas at full alpha. These are the layers that
    // dim with the mesh-opacity slider.
    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = uvCanvas.width;
    baseCanvas.height = uvCanvas.height;
    const bctx = baseCanvas.getContext('2d');
    if (!bctx) return;

    if (backgroundImage && backgroundImage.complete && backgroundImage.naturalWidth > 0) {
      bctx.drawImage(backgroundImage, 0, 0, baseCanvas.width, baseCanvas.height);
    }
    if (showWireframe) {
      bctx.drawImage(wireframeCanvas, 0, 0);
    }
    renderOverlaysToCanvas(bctx, overlays);
    renderAnnotationBasesToCanvas(bctx, annotations);

    // Phase 2: clear main canvas, blit base at the user's chosen opacity, then
    // draw in-box decal images on top at full alpha so they stay opaque.
    ctx.clearRect(0, 0, uvCanvas.width, uvCanvas.height);
    ctx.globalAlpha = baseOpacity;
    ctx.drawImage(baseCanvas, 0, 0);
    ctx.globalAlpha = 1;
    renderAnnotationDecalsToCanvas(ctx, annotations);

    uvTexture.needsUpdate = true;
  }, [annotations, overlays, uvTexture, uvCanvas, wireframeCanvas, backgroundImage, showWireframe, baseOpacity, annImageTick]);

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

  // Attach transformer to any overlay in edit mode
  const editingOverlay = overlays.find((o) => o.editMode && o.visible);
  useEffect(() => {
    if (editingOverlay && overlayTransformerRef.current) {
      const node = overlayRefs.current.get(editingOverlay.id);
      if (node) {
        overlayTransformerRef.current.nodes([node]);
        overlayTransformerRef.current.getLayer()?.batchDraw();
      }
    }
  }, [editingOverlay?.id, overlays]);

  // Bind/unbind the shared group transformer to the selected boxes. Re-runs when
  // the selection changes and after any annotation change (nodes are recreated on
  // re-render, so their registry entries are fresh). Child registerNode effects
  // run before this parent effect, so nodeRegistry is current here.
  useEffect(() => {
    const tr = groupTransformerRef.current;
    if (!tr) return;
    if (selectedAnnotationIds.length > 1) {
      const groups = selectedAnnotationIds
        .map((id) => nodeRegistry.current.get(id)?.group)
        .filter((g): g is Konva.Group => !!g);
      tr.nodes(groups);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedAnnotationIds, annotations]);

  // ----- Group drag: translate the whole multi-selection together -----------
  // Grabbing an unselected box makes it the sole selection (then a normal drag).
  const handleDragSelect = useCallback(
    (id: string) => setSelectedAnnotationIds([id]),
    [setSelectedAnnotationIds],
  );

  // Snapshot every selected node's center at drag start.
  const beginGroupDrag = useCallback(() => {
    const ids = useAnnotationStore.getState().selectedAnnotationIds;
    const starts = new Map<string, { x: number; y: number }>();
    for (const id of ids) {
      const n = nodeRegistry.current.get(id);
      if (n) starts.set(id, { x: n.group.x(), y: n.group.y() });
    }
    groupDragStartRef.current = starts;
  }, []);

  // Move the non-dragged members by the same delta as the dragged one, live.
  const updateGroupDrag = useCallback((draggedId: string) => {
    const starts = groupDragStartRef.current;
    if (!starts) return;
    const dragged = nodeRegistry.current.get(draggedId);
    const from = starts.get(draggedId);
    if (!dragged || !from) return;
    const dx = dragged.group.x() - from.x;
    const dy = dragged.group.y() - from.y;
    starts.forEach((start, id) => {
      if (id === draggedId) return;
      const n = nodeRegistry.current.get(id);
      if (!n) return;
      n.group.x(start.x + dx);
      n.group.y(start.y + dy);
      n.label.x(start.x + dx);
      n.label.y(start.y + dy);
    });
    dragged.group.getLayer()?.batchDraw();
  }, []);

  // Commit the whole group's move as one store write (one undo entry).
  const endGroupDrag = useCallback(
    (draggedId: string) => {
      const starts = groupDragStartRef.current;
      groupDragStartRef.current = null;
      if (!starts) return;
      const dragged = nodeRegistry.current.get(draggedId);
      const from = starts.get(draggedId);
      if (!dragged || !from) return;
      const dx = dragged.group.x() - from.x;
      const dy = dragged.group.y() - from.y;
      if (dx !== 0 || dy !== 0) moveAnnotations(Array.from(starts.keys()), dx, dy);
    },
    [moveAnnotations],
  );

  // Bake a group scale/rotate (from the shared transformer) back into each box's
  // stored geometry, in one write. Each box's Konva group is positioned at its
  // center, so g.x()/g.y() is the new center and g.rotation() the new angle; the
  // transformer's scale is folded into width/height and the node scale reset so
  // the next render starts clean.
  const endGroupTransform = useCallback(() => {
    const state = useAnnotationStore.getState();
    const ids = state.selectedAnnotationIds;
    const key = meshKeyOf(useModelStore.getState().selectedMesh);
    const byId = new Map((state.annotationsByMesh[key] ?? []).map((a) => [a.id, a]));
    const patches: Array<{ id: string; updates: Partial<Annotation> }> = [];
    for (const id of ids) {
      const n = nodeRegistry.current.get(id);
      const ann = byId.get(id);
      if (!n || !ann) continue;
      const g = n.group;
      const newW = Math.max(5, ann.width * g.scaleX());
      const newH = Math.max(5, ann.height * g.scaleY());
      patches.push({
        id,
        updates: { x: g.x() - newW / 2, y: g.y() - newH / 2, width: newW, height: newH, rotation: g.rotation() },
      });
      g.scaleX(1);
      g.scaleY(1);
    }
    if (patches.length) patchAnnotations(patches);
  }, [patchAnnotations]);

  const handleMouseDown = (e: any) => {
    const stage = stageRef.current;
    if (!stage) return;

    // Only start drawing/panning if clicking on the background
    if (e.target !== e.target.getStage() && e.target.getClassName() !== 'Image') {
      return;
    }

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    // Middle-click, right-click, or space-held left-click = pan.
    const isMiddleOrRight = e.evt.button === 1 || e.evt.button === 2;
    if (isMiddleOrRight || isSpaceHeld) {
      setIsPanning(true);
      setPanStart(pointer);
      return;
    }

    const pos = stage.getRelativePointerPosition();
    if (!pos) return;

    if (canvasTool === 'draw') {
      // Draw tool: rubber-band a new annotation box.
      setIsDrawing(true);
      setDrawStart(pos);
      setCurrentRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
      setSelectedAnnotationIds([]);
    } else {
      // Select tool: rubber-band a marquee. Selection resolves on mouse-up, so a
      // plain click (no drag) clears, and shift/cmd adds to the current set.
      marqueeStartRef.current = pos;
      marqueeAdditiveRef.current = e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey;
      setIsMarqueeing(true);
      setMarqueeRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
    }
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

    if (isMarqueeing && marqueeStartRef.current) {
      const pos = stage.getRelativePointerPosition();
      if (!pos) return;
      const s = marqueeStartRef.current;
      setMarqueeRect({
        x: Math.min(s.x, pos.x),
        y: Math.min(s.y, pos.y),
        width: Math.abs(pos.x - s.x),
        height: Math.abs(pos.y - s.y),
      });
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

    if (isMarqueeing) {
      const box = marqueeRect;
      const additive = marqueeAdditiveRef.current;
      setIsMarqueeing(false);
      setMarqueeRect(null);
      marqueeStartRef.current = null;
      // A press with no real drag is a "click on empty" → clear (unless additive).
      if (!box || (box.width < 3 && box.height < 3)) {
        if (!additive) setSelectedAnnotationIds([]);
        return;
      }
      // Touch semantics: select every visible box the marquee overlaps.
      const hits = annotations
        .filter((a) => a.visible !== false)
        .filter((a) => Konva.Util.haveIntersection(box, { x: a.x, y: a.y, width: a.width, height: a.height }))
        .map((a) => a.id);
      if (additive) {
        const current = useAnnotationStore.getState().selectedAnnotationIds;
        setSelectedAnnotationIds(Array.from(new Set([...current, ...hits])));
      } else {
        setSelectedAnnotationIds(hits);
      }
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
        visible: true,
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

    // Ctrl/Cmd+wheel (or trackpad pinch — fires with ctrlKey=true) = zoom.
    // Bare wheel / two-finger trackpad drag = pan.
    const isZoom = e.evt.ctrlKey || e.evt.metaKey;

    if (!isZoom) {
      setStagePosition({
        x: stagePosition.x - e.evt.deltaX,
        y: stagePosition.y - e.evt.deltaY,
      });
      return;
    }

    const scaleBy = 1.1;
    const oldScale = stageScale;
    const newScale = e.evt.deltaY > 0
      ? Math.max(minScale, oldScale / scaleBy)
      : Math.min(maxScale, oldScale * scaleBy);

    setStageScale(newScale);

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
  const baseSize = canvasSize;
  const padding = 32; // 16px padding on each side
  const availableWidth = containerSize.width - padding;
  const availableHeight = containerSize.height - padding;
  const scale = Math.min(availableWidth / baseSize, availableHeight / baseSize, 1);
  const stageWidth = baseSize;
  const stageHeight = baseSize;

  return (
    <div
      ref={containerRef}
      className={`w-full h-full flex items-center justify-center bg-muted overflow-hidden relative ${
        isPanning ? 'cursor-grabbing' : isSpaceHeld ? 'cursor-grab' : canvasTool === 'draw' ? 'cursor-crosshair' : ''
      }`}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Tool toggle (Select / Draw) */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 rounded-lg border bg-background/90 p-2 shadow-lg backdrop-blur-sm">
        <Button
          size="icon"
          variant={canvasTool === 'select' ? 'default' : 'outline'}
          onClick={() => setCanvasTool('select')}
          className="h-8 w-8"
          title="Select / move — V"
        >
          <MousePointer2 className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant={canvasTool === 'draw' ? 'default' : 'outline'}
          onClick={() => setCanvasTool('draw')}
          className="h-8 w-8"
          title="Draw new box — D"
        >
          <Square className="h-4 w-4" />
        </Button>
      </div>

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

            {overlays.filter((o) => o.visible && o.image).map((o) => {
              // Offset to the image center so rotation pivots in place; x/y stay top-left.
              const imgW = o.image!.naturalWidth;
              const imgH = o.image!.naturalHeight;
              return (
              <KonvaImage
                key={o.id}
                ref={(node) => {
                  if (node) overlayRefs.current.set(o.id, node);
                  else overlayRefs.current.delete(o.id);
                }}
                image={o.image!}
                x={o.x + (imgW * o.scaleX) / 2}
                y={o.y + (imgH * o.scaleY) / 2}
                offsetX={imgW / 2}
                offsetY={imgH / 2}
                scaleX={o.scaleX}
                scaleY={o.scaleY}
                rotation={o.rotation}
                opacity={o.opacity}
                draggable={o.editMode}
                listening={o.editMode}
                onDragEnd={(e) => {
                  const node = e.target;
                  updateOverlay(o.id, {
                    x: node.x() - (imgW * node.scaleX()) / 2,
                    y: node.y() - (imgH * node.scaleY()) / 2,
                  });
                }}
                onTransformEnd={() => {
                  const node = overlayRefs.current.get(o.id);
                  if (!node) return;
                  updateOverlay(o.id, {
                    x: node.x() - (imgW * node.scaleX()) / 2,
                    y: node.y() - (imgH * node.scaleY()) / 2,
                    scaleX: node.scaleX(),
                    scaleY: node.scaleY(),
                    rotation: node.rotation(),
                  });
                }}
              />
              );
            })}
            {editingOverlay && (
              <Transformer
                ref={overlayTransformerRef}
                rotateEnabled={false}
                keepRatio={editingOverlay.lockAspect}
                enabledAnchors={[
                  'top-left', 'top-right',
                  'bottom-left', 'bottom-right',
                ]}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 10 || newBox.height < 10) return oldBox;
                  return newBox;
                }}
              />
            )}

            {annotations.filter((a) => a.visible !== false).map((annotation) => (
              <AnnotationBox
                key={annotation.id}
                annotation={annotation}
                isSelected={selectedAnnotationIds.includes(annotation.id)}
                selectionCount={selectedAnnotationIds.length}
                registerNode={registerNode}
                onSelect={(e) => {
                  const me = e.evt as MouseEvent;
                  if (me.shiftKey || me.metaKey || me.ctrlKey) {
                    toggleAnnotationSelection(annotation.id);
                  } else {
                    setSelectedAnnotationIds([annotation.id]);
                  }
                }}
                onDragSelect={handleDragSelect}
                onGroupDragStart={beginGroupDrag}
                onGroupDragMove={updateGroupDrag}
                onGroupDragEnd={endGroupDrag}
                onChange={(newAttrs) => updateAnnotation(annotation.id, newAttrs)}
                onContextMenu={(e) => {
                  e.evt.preventDefault();
                  // Right-click a non-member selects just it; a member keeps the set.
                  if (!useAnnotationStore.getState().selectedAnnotationIds.includes(annotation.id)) {
                    setSelectedAnnotationIds([annotation.id]);
                  }
                  setCtxMenu({ x: e.evt.clientX, y: e.evt.clientY, id: annotation.id });
                }}
              />
            ))}

            {/* Shared group transformer — move/scale/rotate the whole selection */}
            {selectedAnnotationIds.length > 1 && (
              <Transformer
                ref={groupTransformerRef}
                rotateEnabled={true}
                enabledAnchors={[
                  'top-left', 'top-center', 'top-right',
                  'middle-left', 'middle-right',
                  'bottom-left', 'bottom-center', 'bottom-right',
                ]}
                onTransformEnd={endGroupTransform}
                boundBoxFunc={(oldBox, newBox) => (newBox.width < 5 || newBox.height < 5 ? oldBox : newBox)}
              />
            )}

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

            {/* Marquee selection rectangle (Select tool) */}
            {isMarqueeing && marqueeRect && (marqueeRect.width > 0 || marqueeRect.height > 0) && (
              <Rect
                x={marqueeRect.x}
                y={marqueeRect.y}
                width={marqueeRect.width}
                height={marqueeRect.height}
                stroke="#3b82f6"
                strokeWidth={1}
                dash={[4, 4]}
                fill="rgba(59, 130, 246, 0.12)"
                listening={false}
              />
            )}
          </Layer>
        </Stage>
      </div>

      {ctxMenu && (() => {
        const ann = annotations.find((a) => a.id === ctxMenu.id);
        if (!ann) return null;
        return (
          <AnnotationContextMenu
            annotation={ann}
            x={ctxMenu.x}
            y={ctxMenu.y}
            onClose={() => setCtxMenu(null)}
          />
        );
      })()}
    </div>
  );
}
