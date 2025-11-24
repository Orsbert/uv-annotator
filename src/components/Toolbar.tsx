import { Download, Sparkles, Keyboard } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Button } from './ui/button';
import { generateUVLayout } from '../utils/uvGenerator';
import { useState } from 'react';

export function Toolbar() {
  const selectedMesh = useStore((state) => state.selectedMesh);
  const setUVTexture = useStore((state) => state.setUVTexture);
  const uvCanvas = useStore((state) => state.uvCanvas);
  const annotations = useStore((state) => state.annotations);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const handleGenerateUV = () => {
    if (!selectedMesh) {
      alert('Please select a mesh first');
      return;
    }

    try {
      const { canvas, texture } = generateUVLayout(selectedMesh);
      setUVTexture(texture, canvas);
    } catch (error) {
      console.error('Error generating UV layout:', error);
      alert('Failed to generate UV layout');
    }
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
        <h1 className="text-xl font-bold">UV Annotator</h1>
      </div>
      
      <div className="flex items-center gap-2">
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
        <div className="absolute top-16 right-4 bg-card border rounded-lg shadow-lg p-4 z-50">
          <h3 className="font-semibold mb-2">How to Use</h3>
          <div className="space-y-1 text-sm mb-3">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Draw Annotation</span>
              <kbd className="px-2 py-1 bg-muted rounded">Click & Drag</kbd>
            </div>
          </div>
          <h3 className="font-semibold mb-2">Keyboard Shortcuts</h3>
          <div className="space-y-1 text-sm">
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
              <span className="text-muted-foreground">Deselect</span>
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
