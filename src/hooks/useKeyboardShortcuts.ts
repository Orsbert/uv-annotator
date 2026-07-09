import { useEffect } from 'react';
import { useAnnotationStore, useModelStore, useCanvasStore, usePaintStore, useOverlayStore, useReferenceStore, meshKeyOf, useHistoryStore } from '../store/combinedStores';
import type { Annotation } from '../types';

export function useKeyboardShortcuts() {
  const selectedAnnotationId = useAnnotationStore((state) => state.selectedAnnotationId);
  const addAnnotation = useAnnotationStore((state) => state.addAnnotation);
  const deleteAnnotation = useAnnotationStore((state) => state.deleteAnnotation);
  const setSelectedAnnotationId = useAnnotationStore((state) => state.setSelectedAnnotationId);
  const selectedMesh = useModelStore((state) => state.selectedMesh);
  const meshKey = meshKeyOf(selectedMesh);
  const uvCanvas = useCanvasStore((state) => state.canvasByMesh[meshKey] ?? null);
  const isPaintMode = usePaintStore((state) => state.isPaintMode);
  const setPaintMode = usePaintStore((state) => state.setPaintMode);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      // Another listener already handled this (e.g., axis-lock cleared Escape)
      if (e.defaultPrevented) return;

      // A - Add new annotation
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        const newAnnotation: Annotation = {
          id: `ann-${Date.now()}`,
          x: 100 + Math.random() * 200,
          y: 100 + Math.random() * 200,
          width: 200,
          height: 150,
          rotation: 0,
          label: 'New Annotation',
          color: 'coral',
          visible: true,
        };
        addAnnotation(newAnnotation);
      }

      // P - Toggle paint mode
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        if (uvCanvas) {
          setPaintMode(!isPaintMode);
        }
      }

      // Delete/Backspace - Delete selected annotation
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAnnotationId) {
        e.preventDefault();
        deleteAnnotation(selectedAnnotationId);
      }

      // Escape - Exit box-draw mode, else paint mode, else deselect reference, else annotation
      if (e.key === 'Escape') {
        e.preventDefault();
        const refState = useReferenceStore.getState();
        const drawing = refState.references.find((r) => r.drawBoxes);
        if (drawing) {
          refState.setDrawBoxes(drawing.id, false);
        } else if (isPaintMode) {
          setPaintMode(false);
        } else if (refState.selectedReferenceId) {
          refState.setSelectedReferenceId(null);
        } else {
          setSelectedAnnotationId(null);
        }
      }

      // U - Generate UV layout (G is now the Blender gizmo "translate" shortcut)
      if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        if (selectedMesh) {
          const event = new CustomEvent('generate-uv');
          window.dispatchEvent(event);
        }
      }

      // Ctrl/Cmd + E - Export
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        if (uvCanvas) {
          const event = new CustomEvent('export-texture');
          window.dispatchEvent(event);
        }
      }

      // Cmd/Ctrl + Z = Undo, Cmd/Ctrl + Shift + Z (or Ctrl + Y) = Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) useHistoryStore.getState().redo();
        else useHistoryStore.getState().undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        useHistoryStore.getState().redo();
      }

      // T - Toggle all overlay visibility
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        const { overlays, updateOverlay } = useOverlayStore.getState();
        if (overlays.length > 0) {
          // If any are visible, hide all; otherwise show all
          const anyVisible = overlays.some((o) => o.visible);
          overlays.forEach((o) => updateOverlay(o.id, { visible: !anyVisible }));
        }
      }

      // B - Toggle all 3D reference-image (backdrop) visibility
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        const { references, updateReference } = useReferenceStore.getState();
        if (references.length > 0) {
          const anyVisible = references.some((r) => r.visible);
          references.forEach((r) => updateReference(r.id, { visible: !anyVisible }));
        }
      }

      // K - Toggle keyboard shortcuts
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        const event = new CustomEvent('toggle-shortcuts');
        window.dispatchEvent(event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAnnotationId, addAnnotation, deleteAnnotation, setSelectedAnnotationId, selectedMesh, uvCanvas, isPaintMode, setPaintMode]);
}
