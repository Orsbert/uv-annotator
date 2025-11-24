import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import type { Annotation } from '../types';

export function useKeyboardShortcuts() {
  const selectedAnnotationId = useStore((state) => state.selectedAnnotationId);
  const addAnnotation = useStore((state) => state.addAnnotation);
  const deleteAnnotation = useStore((state) => state.deleteAnnotation);
  const setSelectedAnnotationId = useStore((state) => state.setSelectedAnnotationId);
  const selectedMesh = useStore((state) => state.selectedMesh);
  const setUVTexture = useStore((state) => state.setUVTexture);
  const uvCanvas = useStore((state) => state.uvCanvas);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

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
        };
        addAnnotation(newAnnotation);
      }

      // Delete/Backspace - Delete selected annotation
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAnnotationId) {
        e.preventDefault();
        deleteAnnotation(selectedAnnotationId);
      }

      // Escape - Deselect annotation
      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedAnnotationId(null);
      }

      // G - Generate UV layout
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        if (selectedMesh) {
          // Trigger UV generation
          const event = new CustomEvent('generate-uv');
          window.dispatchEvent(event);
        }
      }

      // Ctrl/Cmd + E - Export
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        if (uvCanvas) {
          // Trigger export
          const event = new CustomEvent('export-texture');
          window.dispatchEvent(event);
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
  }, [selectedAnnotationId, addAnnotation, deleteAnnotation, setSelectedAnnotationId, selectedMesh, uvCanvas, setUVTexture]);
}
