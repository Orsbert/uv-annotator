import { ChevronLeft, ImagePlus, Trash2 } from 'lucide-react';
import { useAnnotationStore } from '../../store/combinedStores';
import type { Annotation, ImageAlign, ImageFit } from '../../types';
import { getColorTheme } from '../../types';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { NumberField } from '../ui/number-field';
import { PropertySection } from '../ui/property-section';
import { ImagePaddingControl } from './ImagePaddingControl';

const ALIGN_GRID: ImageAlign[][] = [
  ['top-left', 'top-center', 'top-right'],
  ['middle-left', 'center', 'middle-right'],
  ['bottom-left', 'bottom-center', 'bottom-right'],
];

interface RegionPropertiesProps {
  annotation: Annotation;
  /** Name of the mesh this region belongs to, shown in the back-to-mesh chip. */
  meshName: string;
  /** Deselect the region and return to the mesh view. */
  onBackToMesh: () => void;
}

/**
 * The "region selected" view of the properties panel: an identity header (with
 * a chip that returns to the mesh view) plus Transform / Style / Image sections.
 * `updateAnnotation` is id-global, so this needs no mesh key.
 */
export function RegionProperties({ annotation, meshName, onBackToMesh }: RegionPropertiesProps) {
  const updateAnnotation = useAnnotationStore((s) => s.updateAnnotation);

  const commitField = (field: 'x' | 'y' | 'width' | 'height' | 'rotation', value: number) => {
    updateAnnotation(annotation.id, { [field]: value });
  };

  const handleLabelChange = (value: string) => {
    updateAnnotation(annotation.id, { label: value });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateAnnotation(annotation.id, {
        imageData: reader.result as string,
        imageName: file.name,
        imageFit: annotation.imageFit ?? 'contain',
        imageAlign: annotation.imageAlign ?? 'center',
        imageOpacity: annotation.imageOpacity ?? 1,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const clearImage = () => {
    updateAnnotation(annotation.id, { imageData: undefined, imageName: undefined });
  };

  return (
    <div className="py-2">
      {/* Identity header */}
      <div className="flex items-center gap-2 px-4 pb-2 pt-2">
        <span
          className="h-3 w-3 shrink-0 rounded-sm"
          style={{ backgroundColor: getColorTheme(annotation.color).main }}
        />
        <span className="truncate text-sm font-medium">{annotation.label}</span>
        <button
          onClick={onBackToMesh}
          title="Back to mesh"
          className="ml-auto flex max-w-[45%] shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="h-3 w-3 shrink-0" />
          <span className="truncate">{meshName}</span>
        </button>
      </div>

      {/* Transform */}
      <PropertySection title="Transform">
        <div>
          <Label className="mb-2 block text-xs text-muted-foreground">Location</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1">
              <span className="w-4 text-xs">X</span>
              <NumberField
                value={annotation.x}
                onCommit={(n) => commitField('x', n)}
                className="h-7 text-xs"
                aria-label="X"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="w-4 text-xs">Y</span>
              <NumberField
                value={annotation.y}
                onCommit={(n) => commitField('y', n)}
                className="h-7 text-xs"
                aria-label="Y"
              />
            </div>
          </div>
        </div>

        <div>
          <Label className="mb-2 block text-xs text-muted-foreground">Size</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1">
              <span className="w-4 text-xs">W</span>
              <NumberField
                value={annotation.width}
                onCommit={(n) => commitField('width', n)}
                className="h-7 text-xs"
                aria-label="Width"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="w-4 text-xs">H</span>
              <NumberField
                value={annotation.height}
                onCommit={(n) => commitField('height', n)}
                className="h-7 text-xs"
                aria-label="Height"
              />
            </div>
          </div>
        </div>

        <div>
          <Label className="mb-2 block text-xs text-muted-foreground">Rotation</Label>
          <div className="flex items-center gap-1">
            <span className="w-4 text-xs">R</span>
            <NumberField
              value={annotation.rotation}
              onCommit={(n) => commitField('rotation', n)}
              className="h-7 text-xs"
              aria-label="Rotation"
            />
            <span className="text-xs">°</span>
          </div>
        </div>
      </PropertySection>

      {/* Style */}
      <PropertySection title="Style">
        <div>
          <Label className="mb-2 block text-xs text-muted-foreground">Label</Label>
          <Input
            value={annotation.label}
            onChange={(e) => handleLabelChange(e.target.value)}
            className="h-7 text-xs"
          />
        </div>
        <div>
          <Label className="mb-2 block text-xs text-muted-foreground">Color</Label>
          <div className="flex items-center gap-2">
            <div
              className="h-6 w-6 rounded border"
              style={{ backgroundColor: getColorTheme(annotation.color).main }}
            />
            <span className="text-xs">{annotation.color}</span>
          </div>
        </div>
      </PropertySection>

      {/* Image */}
      <PropertySection title="Image" defaultOpen={false} dot={!!annotation.imageData}>
        <div className="flex items-center gap-2">
          <input
            type="file"
            id={`ann-image-upload-${annotation.id}`}
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => document.getElementById(`ann-image-upload-${annotation.id}`)?.click()}
          >
            <ImagePlus className="mr-2 h-3 w-3" />
            {annotation.imageData ? 'Change' : 'Upload'}
          </Button>
          {annotation.imageData && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={clearImage}
              title="Remove image"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>

        {annotation.imageData && (
          <>
            <div className="flex items-center gap-2 rounded border p-2">
              <img
                src={annotation.imageData}
                alt={annotation.imageName ?? ''}
                className="h-10 w-10 rounded border object-cover"
              />
              <span className="flex-1 truncate text-xs" title={annotation.imageName ?? ''}>
                {annotation.imageName}
              </span>
            </div>

            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Fit</Label>
              <select
                value={annotation.imageFit ?? 'contain'}
                onChange={(e) =>
                  updateAnnotation(annotation.id, { imageFit: e.target.value as ImageFit })
                }
                className="h-7 w-full rounded border bg-background px-2 text-xs"
              >
                <option value="fill">Fill (stretch)</option>
                <option value="contain">Contain (fit inside)</option>
                <option value="cover">Cover (fill &amp; crop)</option>
              </select>
            </div>

            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Alignment</Label>
              <div className="grid w-fit grid-cols-3 gap-1">
                {ALIGN_GRID.flat().map((align) => {
                  const active = (annotation.imageAlign ?? 'center') === align;
                  return (
                    <button
                      key={align}
                      title={align}
                      onClick={() => updateAnnotation(annotation.id, { imageAlign: align })}
                      className={`flex h-6 w-6 items-center justify-center rounded border text-xs ${
                        active
                          ? 'border-primary bg-primary'
                          : 'border-border bg-background hover:bg-accent'
                      }`}
                    >
                      <span
                        className={`block h-1.5 w-1.5 rounded-full ${
                          active ? 'bg-primary-foreground' : 'bg-muted-foreground/60'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <ImagePaddingControl
              key={annotation.id}
              value={annotation.imagePadding}
              onChange={(p) => updateAnnotation(annotation.id, { imagePadding: p })}
            />

            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Opacity</Label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={Math.round((annotation.imageOpacity ?? 1) * 100)}
                  onChange={(e) =>
                    updateAnnotation(annotation.id, { imageOpacity: Number(e.target.value) / 100 })
                  }
                  className="flex-1"
                />
                <span className="w-8 text-right text-xs">
                  {Math.round((annotation.imageOpacity ?? 1) * 100)}%
                </span>
              </div>
            </div>
          </>
        )}
      </PropertySection>
    </div>
  );
}
