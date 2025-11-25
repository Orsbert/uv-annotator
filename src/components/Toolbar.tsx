import { Download, Sparkles, Keyboard, Paintbrush, Check, Menu } from 'lucide-react';
import { useModelStore } from '../store/combinedStores';
import { useCanvasStore } from '../store/combinedStores';
import { useAnnotationStore } from '../store/combinedStores';
import { usePaintStore } from '../store/combinedStores';
import { useSessionStore } from '../store/useSessionStore';
import { Button } from './ui/button';
import { generateUVLayout } from '../utils/uvGenerator';
import { useState } from 'react';

export function Toolbar() {
  const selectedMesh = useModelStore((state) => state.selectedMesh);
  const uvCanvas = useCanvasStore((state) => state.uvCanvas);
  const setUVTexture = useCanvasStore((state) => state.setUVTexture);
  const setUVCanvas = useCanvasStore((state) => state.setUVCanvas);
  const annotations = useAnnotationStore((state) => state.annotations);
  const isPaintMode = usePaintStore((state) => state.isPaintMode);
  const setPaintMode = usePaintStore((state) => state.setPaintMode);
  const brushSize = usePaintStore((state) => state.brushSize);
  const setBrushSize = usePaintStore((state) => state.setBrushSize);
  const createAnnotationFromPaint = usePaintStore((state) => state.createAnnotationFromPaint);
  const paintedUVCoords = usePaintStore((state) => state.paintedUVCoords);
  
  const setSidebarOpen = useSessionStore((state) => state.setSidebarOpen);
  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const updateSession = useSessionStore((state) => state.updateSession);
  const sessions = useSessionStore((state) => state.sessions);
  const currentSession = sessions.find(s => s.id === currentSessionId);
  
  const [showShortcuts, setShowShortcuts] = useState(false);

  const handleOpenSidebar = () => {
    // Capture thumbnail before opening sidebar
    if (uvCanvas && currentSessionId) {
      // Create a small thumbnail
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 200;
      thumbCanvas.height = 200;
      const ctx = thumbCanvas.getContext('2d');
      if (ctx) {
        // Draw white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 200, 200);
        
        // Draw UV canvas scaled down
        ctx.drawImage(uvCanvas, 0, 0, 200, 200);
        
        // Draw annotations
        annotations.forEach((ann) => {
            // Scale annotation coordinates
            const scaleX = 200 / uvCanvas.width;
            const scaleY = 200 / uvCanvas.height;
            
            ctx.save();
            ctx.translate((ann.x + ann.width / 2) * scaleX, (ann.y + ann.height / 2) * scaleY);
            ctx.rotate((ann.rotation * Math.PI) / 180);
            ctx.translate(-((ann.x + ann.width / 2) * scaleX), -((ann.y + ann.height / 2) * scaleY));
            
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 1;
            ctx.strokeRect(ann.x * scaleX, ann.y * scaleY, ann.width * scaleX, ann.height * scaleY);
            
            ctx.restore();
        });

        const dataUrl = thumbCanvas.toDataURL('image/jpeg', 0.7);
        updateSession(currentSessionId, { thumbnail: dataUrl });
      }
    }
    setSidebarOpen(true);
  };

  const handleGenerateUV = () => {
    if (!selectedMesh) {
      alert('Please select a mesh first');
      return;
    }

    try {
      const { canvas, texture } = generateUVLayout(selectedMesh);
      setUVTexture(texture);
      setUVCanvas(canvas);
    } catch (error) {
      console.error('Error generating UV layout:', error);
      alert('Failed to generate UV layout');
    }
  };

  const handleTogglePaintMode = () => {
    setPaintMode(!isPaintMode);
  };

  const handleFinishPainting = () => {
    createAnnotationFromPaint();
  };

  const handleExport = () => {
    if (!uvCanvas) {
      alert('Please generate UV layout first');
      return;
    }

    // Create a temporary canvas for export
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = 1024;
    exportCanvas.height = 1024;
    const ctx = exportCanvas.getContext('2d');
    
    if (!ctx) return;

    // Draw the UV layout
    ctx.drawImage(uvCanvas, 0, 0);

    // Draw annotations
    annotations.forEach((ann) => {
      ctx.save();
      
      // Translate to annotation center for rotation
      ctx.translate(ann.x + ann.width / 2, ann.y + ann.height / 2);
      ctx.rotate((ann.rotation * Math.PI) / 180);
      ctx.translate(-(ann.x + ann.width / 2), -(ann.y + ann.height / 2));
      
      // Draw rectangle
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.strokeRect(ann.x, ann.y, ann.width, ann.height);
      
      // Draw label background
      ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
      const labelHeight = 20;
      ctx.fillRect(ann.x, ann.y - labelHeight, ann.width, labelHeight);
      
      // Draw label text
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(ann.label, ann.x + ann.width / 2, ann.y - 5);

      
      ctx.restore();
    });

    // Export as PNG
    exportCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `uv-annotation-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="h-16 border-b bg-card px-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={handleOpenSidebar}>
          <Menu className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">UV Annotator</h1>
        {currentSession && (
          <span className="text-sm text-muted-foreground ml-2 border-l pl-2">
            {currentSession.name}
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        {isPaintMode && (
          <>
            <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded">
              <label className="text-sm">Brush Size:</label>
              <input
                type="range"
                min="5"
                max="50"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm w-8">{brushSize}</span>
            </div>
            <Button
              onClick={handleFinishPainting}
              variant="default"
              disabled={paintedUVCoords.length === 0}
            >
              <Check className="mr-2 h-4 w-4" />
              Finish & Create Box
            </Button>
          </>
        )}
        
        <Button
          onClick={handleTogglePaintMode}
          variant={isPaintMode ? "default" : "outline"}
          disabled={!uvCanvas}
          title="Paint Mode (P)"
        >
          <Paintbrush className="mr-2 h-4 w-4" />
          {isPaintMode ? 'Exit Paint Mode' : 'Paint Mode'}
        </Button>
        
        <Button
          onClick={() => setShowShortcuts(!showShortcuts)}
          variant="ghost"
          size="icon"
          title="Keyboard Shortcuts (K)"
        >
          <Keyboard className="h-5 w-5" />
        </Button>
        
        <Button
          onClick={handleGenerateUV}
          disabled={!selectedMesh}
          title="Generate UV Layout (G)"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Generate UV Layout
        </Button>
        
        <Button
          onClick={handleExport}
          disabled={!uvCanvas}
          variant="secondary"
          title="Export (Ctrl/Cmd + E)"
        >
          <Download className="mr-2 h-4 w-4" />
          Export 1024x1024
        </Button>
      </div>

      {showShortcuts && (
        <div className="absolute top-16 right-4 bg-card border rounded-lg shadow-lg p-4 z-50 max-w-md">
          <h3 className="font-semibold mb-2">How to Use</h3>
          <div className="space-y-1 text-sm mb-3">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Draw Annotation</span>
              <kbd className="px-2 py-1 bg-muted rounded">Click & Drag</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Paint on 3D Model</span>
              <kbd className="px-2 py-1 bg-muted rounded">Click & Drag (Paint Mode)</kbd>
            </div>
          </div>
          <h3 className="font-semibold mb-2">Keyboard Shortcuts</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Toggle Paint Mode</span>
              <kbd className="px-2 py-1 bg-muted rounded">P</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Add Annotation</span>
              <kbd className="px-2 py-1 bg-muted rounded">A</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Delete Selected</span>
              <kbd className="px-2 py-1 bg-muted rounded">Delete</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Generate UV</span>
              <kbd className="px-2 py-1 bg-muted rounded">G</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Export</span>
              <kbd className="px-2 py-1 bg-muted rounded">Ctrl/Cmd + E</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Deselect / Exit Paint</span>
              <kbd className="px-2 py-1 bg-muted rounded">Esc</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Toggle Help</span>
              <kbd className="px-2 py-1 bg-muted rounded">K</kbd>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
