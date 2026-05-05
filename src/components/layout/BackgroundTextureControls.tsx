import { useState } from 'react';
import { ChevronDown, ChevronRight, ImagePlus, Trash2 } from 'lucide-react';
import { useCanvasStore } from '../../store/combinedStores';
import { Button } from '../ui/button';
import { Label } from '../ui/label';

export function BackgroundTextureControls() {
  const backgroundImageData = useCanvasStore((s) => s.backgroundImageData);
  const backgroundImageName = useCanvasStore((s) => s.backgroundImageName);
  const showWireframe = useCanvasStore((s) => s.showWireframe);
  const setBackgroundImage = useCanvasStore((s) => s.setBackgroundImage);
  const clearBackgroundImage = useCanvasStore((s) => s.clearBackgroundImage);
  const setShowWireframe = useCanvasStore((s) => s.setShowWireframe);

  const [open, setOpen] = useState(true);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setBackgroundImage(dataUrl, file.name);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="border-b">
      <button
        className="w-full flex items-center gap-2 p-3 hover:bg-accent/50 text-sm font-semibold"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Background Texture
      </button>

      {open && (
        <div className="p-3 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="file"
              id="bg-texture-upload"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => document.getElementById('bg-texture-upload')?.click()}
            >
              <ImagePlus className="mr-2 h-3 w-3" />
              {backgroundImageData ? 'Change' : 'Upload'}
            </Button>
            {backgroundImageData && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={clearBackgroundImage}
                title="Remove background texture"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>

          {backgroundImageData && (
            <div className="border rounded p-2 flex items-center gap-2">
              <img
                src={backgroundImageData}
                alt={backgroundImageName ?? ''}
                className="h-10 w-10 object-cover rounded border"
              />
              <span className="flex-1 text-xs truncate" title={backgroundImageName ?? ''}>
                {backgroundImageName}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="show-wireframe"
              checked={showWireframe}
              onChange={(e) => setShowWireframe(e.target.checked)}
              className="h-3 w-3"
            />
            <Label htmlFor="show-wireframe" className="text-xs cursor-pointer">
              Show UV wireframe
            </Label>
          </div>
        </div>
      )}
    </div>
  );
}
