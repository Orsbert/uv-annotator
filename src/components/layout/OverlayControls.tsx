import { useState } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, Trash2, Link2, Unlink, Move, Maximize, ImagePlus } from 'lucide-react';
import { useOverlayStore } from '../../store/combinedStores';
import type { OverlayItem } from '../../store/combinedStores';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

function OverlayItemControls({ overlay }: { overlay: OverlayItem }) {
  const updateOverlay = useOverlayStore((state) => state.updateOverlay);
  const removeOverlay = useOverlayStore((state) => state.removeOverlay);
  const fitOverlayToCanvas = useOverlayStore((state) => state.fitOverlayToCanvas);
  const selectedOverlayId = useOverlayStore((state) => state.selectedOverlayId);
  const setSelectedOverlayId = useOverlayStore((state) => state.setSelectedOverlayId);

  const isExpanded = selectedOverlayId === overlay.id;

  const handleScaleXChange = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    if (overlay.lockAspect) {
      const ratio = overlay.scaleX !== 0 ? num / overlay.scaleX : 1;
      updateOverlay(overlay.id, { scaleX: num, scaleY: overlay.scaleY * ratio });
    } else {
      updateOverlay(overlay.id, { scaleX: num });
    }
  };

  const handleScaleYChange = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    if (overlay.lockAspect) {
      const ratio = overlay.scaleY !== 0 ? num / overlay.scaleY : 1;
      updateOverlay(overlay.id, { scaleX: overlay.scaleX * ratio, scaleY: num });
    } else {
      updateOverlay(overlay.id, { scaleY: num });
    }
  };

  return (
    <div className="border rounded p-2 space-y-2">
      {/* Header row */}
      <div className="flex items-center gap-1">
        <button
          className="flex-1 text-left text-xs truncate hover:text-foreground"
          title={overlay.imageName}
          onClick={() => setSelectedOverlayId(isExpanded ? null : overlay.id)}
        >
          {overlay.imageName}
        </button>
        <Button
          size="icon"
          variant={overlay.editMode ? "default" : "ghost"}
          className="h-6 w-6"
          onClick={() => updateOverlay(overlay.id, { editMode: !overlay.editMode })}
          title={overlay.editMode ? 'Lock overlay' : 'Transform overlay'}
        >
          <Move className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={() => updateOverlay(overlay.id, { visible: !overlay.visible })}
          title={overlay.visible ? 'Hide' : 'Show'}
        >
          {overlay.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={() => removeOverlay(overlay.id)}
          title="Remove"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Expanded controls */}
      {isExpanded && (
        <div className="space-y-2 pt-1">
          {/* Fit to canvas */}
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => fitOverlayToCanvas(overlay.id)}
          >
            <Maximize className="mr-2 h-3 w-3" />
            Fit to Canvas
          </Button>

          {/* Opacity */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Opacity</Label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={Math.round(overlay.opacity * 100)}
                onChange={(e) => updateOverlay(overlay.id, { opacity: Number(e.target.value) / 100 })}
                className="flex-1"
              />
              <span className="text-xs w-8 text-right">{Math.round(overlay.opacity * 100)}%</span>
            </div>
          </div>

          {/* Position */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Position</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1">
                <span className="text-xs w-4">X</span>
                <Input
                  type="number"
                  value={overlay.x.toFixed(0)}
                  onChange={(e) => updateOverlay(overlay.id, { x: parseFloat(e.target.value) || 0 })}
                  className="h-7 text-xs"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs w-4">Y</span>
                <Input
                  type="number"
                  value={overlay.y.toFixed(0)}
                  onChange={(e) => updateOverlay(overlay.id, { y: parseFloat(e.target.value) || 0 })}
                  className="h-7 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Scale */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs text-muted-foreground">Scale</Label>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5"
                onClick={() => updateOverlay(overlay.id, { lockAspect: !overlay.lockAspect })}
                title={overlay.lockAspect ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
              >
                {overlay.lockAspect ? <Link2 className="h-3 w-3" /> : <Unlink className="h-3 w-3" />}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1">
                <span className="text-xs w-4">X</span>
                <Input
                  type="number"
                  step="0.01"
                  value={overlay.scaleX.toFixed(2)}
                  onChange={(e) => handleScaleXChange(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs w-4">Y</span>
                <Input
                  type="number"
                  step="0.01"
                  value={overlay.scaleY.toFixed(2)}
                  onChange={(e) => handleScaleYChange(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function OverlayControls() {
  const overlays = useOverlayStore((state) => state.overlays);
  const addOverlay = useOverlayStore((state) => state.addOverlay);
  const removeAllOverlays = useOverlayStore((state) => state.removeAllOverlays);

  const [overlayOpen, setOverlayOpen] = useState(true);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      addOverlay(dataUrl, file.name);
    };
    reader.readAsDataURL(file);

    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  return (
    <div className="border-b">
      <button
        className="w-full flex items-center gap-2 p-3 hover:bg-accent/50 text-sm font-semibold"
        onClick={() => setOverlayOpen(!overlayOpen)}
      >
        {overlayOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Template Overlays
        {overlays.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">{overlays.length}</span>
        )}
      </button>

      {overlayOpen && (
        <div className="p-3 space-y-2">
          {/* Add overlay button */}
          <div className="flex items-center gap-2">
            <input
              type="file"
              id="overlay-upload"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => document.getElementById('overlay-upload')?.click()}
            >
              <ImagePlus className="mr-2 h-3 w-3" />
              Add Overlay
            </Button>
            {overlays.length > 1 && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={removeAllOverlays}
                title="Remove all overlays"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Overlay list */}
          {overlays.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">No overlays added</p>
          )}
          {overlays.map((overlay) => (
            <OverlayItemControls key={overlay.id} overlay={overlay} />
          ))}
        </div>
      )}
    </div>
  );
}
