import { ImagePlus, Trash2 } from 'lucide-react';
import { useCanvasStore, useModelStore, meshKeyOf } from '../../store/combinedStores';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { PropertySection } from '../ui/property-section';

export function BackgroundTextureControls() {
  const meshKey = meshKeyOf(useModelStore((s) => s.selectedMesh));
  const bg = useCanvasStore((s) => s.backgroundsByMesh[meshKey]);
  const backgroundImageData = bg?.imageData ?? null;
  const backgroundImageName = bg?.imageName ?? null;
  const showWireframe = useCanvasStore((s) => s.showWireframe);
  const setBackgroundImage = useCanvasStore((s) => s.setBackgroundImage);
  const clearBackgroundImage = useCanvasStore((s) => s.clearBackgroundImage);
  const setShowWireframe = useCanvasStore((s) => s.setShowWireframe);

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
    <PropertySection title="Background" defaultOpen={false} dot={!!backgroundImageData || showWireframe}>
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
            onClick={() => clearBackgroundImage()}
            title="Remove background texture"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {backgroundImageData && (
        <div className="flex items-center gap-2 rounded border p-2">
          <img
            src={backgroundImageData}
            alt={backgroundImageName ?? ''}
            className="h-10 w-10 rounded border object-cover"
          />
          <span className="flex-1 truncate text-xs" title={backgroundImageName ?? ''}>
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
    </PropertySection>
  );
}
