import { Eye, EyeOff, Trash2, ImagePlus, Camera, Pin, Layers, Maximize, Square, Download } from 'lucide-react';
import { useReferenceStore, useModelStore } from '../../store/combinedStores';
import type { ReferenceItem, AlignCommand } from '../../store/combinedStores';
import { getColorTheme } from '../../types';
import { buildProofCanvas } from '../../utils/boxGraphics';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { NumberField } from '../ui/number-field';
import { PropertySection } from '../ui/property-section';

/** A numeric field with a drag-to-scrub label — same interaction as MeshControls. */
function ScrubField({
  label,
  value,
  onCommit,
  step = 0.01,
  precision = 3,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  step?: number;
  precision?: number;
}) {
  const startScrub = (e: React.MouseEvent<HTMLSpanElement>) => {
    e.preventDefault();
    const target = e.currentTarget;
    let cumulative = value;
    target.requestPointerLock?.();
    const move = (mv: MouseEvent) => {
      const factor = mv.shiftKey ? 10 : mv.altKey ? 0.1 : 1;
      cumulative += mv.movementX * step * factor;
      onCommit(Math.round(cumulative * 1e6) / 1e6);
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      if (document.pointerLockElement === target) document.exitPointerLock();
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  return (
    <div className="flex items-center gap-1">
      <span
        className="w-4 cursor-ew-resize select-none text-xs text-muted-foreground hover:text-foreground"
        onMouseDown={startScrub}
        title="Drag to scrub · Shift = 10× · Alt = 0.1×"
      >
        {label}
      </span>
      <NumberField
        value={value}
        onCommit={onCommit}
        step={step}
        precision={precision}
        className="h-7 px-1 text-xs"
        aria-label={label}
      />
    </div>
  );
}

function ReferenceItemControls({ reference }: { reference: ReferenceItem }) {
  const updateReference = useReferenceStore((s) => s.updateReference);
  const setLockToView = useReferenceStore((s) => s.setLockToView);
  const fitReferenceToMesh = useReferenceStore((s) => s.fitReferenceToMesh);
  const setDrawBoxes = useReferenceStore((s) => s.setDrawBoxes);
  const updateBox = useReferenceStore((s) => s.updateBox);
  const removeBox = useReferenceStore((s) => s.removeBox);
  const removeReference = useReferenceStore((s) => s.removeReference);
  const selectedId = useReferenceStore((s) => s.selectedReferenceId);
  const setSelectedReferenceId = useReferenceStore((s) => s.setSelectedReferenceId);
  const selectedMesh = useModelStore((s) => s.selectedMesh);
  const hasModel = useModelStore((s) => !!s.model);
  const fitTarget = selectedMesh?.name || (hasModel ? 'model' : null);

  const isExpanded = selectedId === reference.id;
  const { position, rotation, scale, lockToView, boxes, drawBoxes } = reference;

  const exportProof = () => {
    if (!reference.image) return;
    buildProofCanvas(reference.image, boxes).toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reference.imageName.replace(/\.[^.]+$/, '')}-boxes.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const setPos = (a: 0 | 1 | 2, v: number) => {
    const n: [number, number, number] = [...position];
    n[a] = v;
    updateReference(reference.id, { position: n });
  };
  const setRot = (a: 0 | 1 | 2, v: number) => {
    const n: [number, number, number] = [...rotation];
    n[a] = v;
    updateReference(reference.id, { rotation: n });
  };
  const setScl = (a: 0 | 1, v: number) => {
    const n: [number, number, number] = [...scale];
    n[a] = v;
    n[2] = 1;
    updateReference(reference.id, { scale: n });
  };
  const align = (cmd: AlignCommand) => updateReference(reference.id, { pendingAlign: cmd });

  return (
    <div className="space-y-2 rounded border p-2">
      {/* Header row */}
      <div className="flex items-center gap-1">
        <button
          className="flex-1 truncate text-left text-xs hover:text-foreground"
          title={reference.imageName}
          onClick={() => setSelectedReferenceId(isExpanded ? null : reference.id)}
        >
          {reference.imageName}
        </button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={() => updateReference(reference.id, { visible: !reference.visible })}
          title={reference.visible ? 'Hide' : 'Show'}
        >
          {reference.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={() => removeReference(reference.id)}
          title="Remove"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {isExpanded && (
        <div className="space-y-3 pt-1">
          {/* Bounding boxes — draw on the plane, project onto the mesh */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={drawBoxes ? 'default' : 'outline'}
                className="flex-1"
                disabled={lockToView}
                onClick={() => setDrawBoxes(reference.id, !drawBoxes)}
                title={lockToView ? 'Turn off Lock to view to draw boxes' : 'Draw bounding boxes on this plane'}
              >
                <Square className="mr-2 h-3 w-3" />
                {drawBoxes ? 'Drawing… (click to stop)' : 'Draw boxes'}
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                disabled={!reference.image || boxes.length === 0}
                onClick={exportProof}
                title="Export the flat image + boxes as a PNG — the 2D proof"
              >
                <Download className="h-3 w-3" />
              </Button>
            </div>
            {drawBoxes && (
              <p className="text-[10px] text-muted-foreground">
                Drag on the plane in 3D. Each box projects onto{' '}
                <span className="text-foreground">{selectedMesh?.name || 'the selected mesh'}</span>.
              </p>
            )}
            {lockToView && (
              <p className="text-[10px] text-muted-foreground">
                Boxes project from a grounded plane — turn off Lock to view.
              </p>
            )}
            {boxes.length > 0 && (
              <div className="space-y-0.5">
                {boxes.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs hover:bg-accent/50"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: getColorTheme(b.color).main }}
                    />
                    <span className="flex-1 truncate">{b.label}</span>
                    {!b.meshKey && (
                      <span className="text-[9px] text-muted-foreground" title="No mesh was under this box when drawn">
                        no mesh
                      </span>
                    )}
                    <button
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => updateBox(reference.id, b.id, { visible: !b.visible })}
                      title={b.visible ? 'Hide' : 'Show'}
                    >
                      {b.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    </button>
                    <button
                      className="text-destructive/80 hover:text-destructive"
                      onClick={() => removeBox(reference.id, b.id)}
                      title="Delete box"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mode toggles */}
          <div className="space-y-1.5">
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={lockToView}
                onChange={(e) => setLockToView(reference.id, e.target.checked)}
                className="h-3 w-3"
              />
              <Pin className="h-3 w-3 text-muted-foreground" />
              <span>Lock to view</span>
              <span className="ml-auto text-[10px] text-muted-foreground">rotoscope</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={reference.showOnTop}
                disabled={lockToView}
                onChange={(e) => updateReference(reference.id, { showOnTop: e.target.checked })}
                className="h-3 w-3"
              />
              <Layers className="h-3 w-3 text-muted-foreground" />
              <span className={lockToView ? 'text-muted-foreground' : ''}>Show on top (X-ray)</span>
            </label>
          </div>

          {/* Opacity */}
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Opacity</Label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={Math.round(reference.opacity * 100)}
                onChange={(e) => updateReference(reference.id, { opacity: Number(e.target.value) / 100 })}
                className="flex-1"
              />
              <span className="w-8 text-right text-xs">{Math.round(reference.opacity * 100)}%</span>
            </div>
          </div>

          {lockToView ? (
            /* Rotoscope: screen-space offset + roll + size. Placement is camera-driven. */
            <>
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">Offset (screen)</Label>
                <div className="grid grid-cols-2 gap-1">
                  <ScrubField label="X" value={position[0]} onCommit={(v) => setPos(0, v)} />
                  <ScrubField label="Y" value={position[1]} onCommit={(v) => setPos(1, v)} />
                </div>
              </div>
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">Size</Label>
                <div className="grid grid-cols-2 gap-1">
                  <ScrubField label="X" value={scale[0]} onCommit={(v) => setScl(0, v)} />
                  <ScrubField label="Y" value={scale[1]} onCommit={(v) => setScl(1, v)} />
                </div>
              </div>
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">Roll (rad)</Label>
                <ScrubField label="Z" value={rotation[2]} onCommit={(v) => setRot(2, v)} />
              </div>
              <p className="-mt-1 text-[10px] text-muted-foreground">
                Pinned to the camera. Orbit the model underneath to line it up, then paint.
              </p>
            </>
          ) : (
            /* Grounded: full 3D transform + quick-align presets. Gizmo works in 3D too. */
            <>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={!fitTarget}
                onClick={() => fitReferenceToMesh(reference.id)}
                title={fitTarget ? `Size and center onto ${fitTarget}` : 'Select a mesh or load a model first'}
              >
                <Maximize className="mr-2 h-3 w-3" />
                Fit to Mesh
              </Button>
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">Align</Label>
                <div className="grid grid-cols-4 gap-1">
                  <Button size="sm" variant="outline" className="h-7 px-0" onClick={() => align('camera')} title="Face the current camera view">
                    <Camera className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 px-0 text-[10px]" onClick={() => align('front')} title="Face +Z (front)">
                    Front
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 px-0 text-[10px]" onClick={() => align('side')} title="Face +X (side)">
                    Side
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 px-0 text-[10px]" onClick={() => align('top')} title="Face +Y (top)">
                    Top
                  </Button>
                </div>
              </div>
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">Position</Label>
                <div className="grid grid-cols-3 gap-1">
                  <ScrubField label="X" value={position[0]} onCommit={(v) => setPos(0, v)} />
                  <ScrubField label="Y" value={position[1]} onCommit={(v) => setPos(1, v)} />
                  <ScrubField label="Z" value={position[2]} onCommit={(v) => setPos(2, v)} />
                </div>
              </div>
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">Rotation (rad)</Label>
                <div className="grid grid-cols-3 gap-1">
                  <ScrubField label="X" value={rotation[0]} onCommit={(v) => setRot(0, v)} />
                  <ScrubField label="Y" value={rotation[1]} onCommit={(v) => setRot(1, v)} />
                  <ScrubField label="Z" value={rotation[2]} onCommit={(v) => setRot(2, v)} />
                </div>
              </div>
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">Size</Label>
                <div className="grid grid-cols-2 gap-1">
                  <ScrubField label="X" value={scale[0]} onCommit={(v) => setScl(0, v)} />
                  <ScrubField label="Y" value={scale[1]} onCommit={(v) => setScl(1, v)} />
                </div>
              </div>
              <p className="-mt-1 text-[10px] text-muted-foreground">
                Selected in 3D — drag the gizmo, or press G / R / S. Paint mode traces through it.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function ReferenceControls() {
  const references = useReferenceStore((s) => s.references);
  const addReference = useReferenceStore((s) => s.addReference);
  const removeAllReferences = useReferenceStore((s) => s.removeAllReferences);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => addReference(reader.result as string, file.name);
    reader.readAsDataURL(file);
    // Reset so the same file can be re-selected
    e.target.value = '';
  };

  return (
    <PropertySection
      title="Reference Images (3D)"
      defaultOpen={false}
      dot={references.length > 0}
      trailing={
        references.length > 0 ? (
          <span className="text-xs text-muted-foreground">{references.length}</span>
        ) : undefined
      }
    >
      <div className="flex items-center gap-2">
        <input
          type="file"
          id="reference-upload"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => document.getElementById('reference-upload')?.click()}
        >
          <ImagePlus className="mr-2 h-3 w-3" />
          Add Reference
        </Button>
        {references.length > 1 && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={removeAllReferences}
            title="Remove all reference images"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {references.length === 0 && (
        <p className="py-2 text-center text-xs text-muted-foreground">
          Put a photo/blueprint on a plane in 3D, draw boxes on it, and they project
          onto the model — so the 2D and 3D match on curved parts.
        </p>
      )}
      {references.map((reference) => (
        <ReferenceItemControls key={reference.id} reference={reference} />
      ))}
    </PropertySection>
  );
}
