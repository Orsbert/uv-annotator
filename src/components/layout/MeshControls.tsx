import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import * as THREE from 'three';
import { useModelStore, useCanvasStore, useUiStore, meshKeyOf } from '../../store/combinedStores';
import { NumberField } from '../ui/number-field';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { PropertySection } from '../ui/property-section';

export function MeshControls() {
  const selectedMesh = useModelStore((s) => s.selectedMesh);
  const meshKey = meshKeyOf(selectedMesh);
  const baseOpacity = useCanvasStore((s) => s.baseOpacityByMesh[meshKey] ?? 1);
  const setBaseOpacity = useCanvasStore((s) => s.setBaseOpacity);
  const transform = useModelStore((s) => s.transformsByMesh[meshKey]);
  const setMeshTransform = useModelStore((s) => s.setMeshTransform);
  const resetMeshTransform = useModelStore((s) => s.resetMeshTransform);
  const moveMode = useUiStore((s) => s.moveMode);
  const setMoveMode = useUiStore((s) => s.setMoveMode);
  const xraySelected = useUiStore((s) => s.xraySelected);
  const setXraySelected = useUiStore((s) => s.setXraySelected);
  const surfaceDragMode = useUiStore((s) => s.surfaceDragMode);
  const setSurfaceDragMode = useUiStore((s) => s.setSurfaceDragMode);
  const [, setTick] = useState(0);

  if (!selectedMesh) return null;

  // Read live transform from the mesh as the source of truth for display
  const position: [number, number, number] = transform?.position ?? [
    selectedMesh.position.x,
    selectedMesh.position.y,
    selectedMesh.position.z,
  ];
  const rotation: [number, number, number] = transform?.rotation ?? [
    selectedMesh.rotation.x,
    selectedMesh.rotation.y,
    selectedMesh.rotation.z,
  ];
  const scale: [number, number, number] = transform?.scale ?? [
    selectedMesh.scale.x,
    selectedMesh.scale.y,
    selectedMesh.scale.z,
  ];

  const commitAxis = (
    field: 'position' | 'rotation' | 'scale',
    axis: 0 | 1 | 2,
    value: number
  ) => {
    const current = field === 'position' ? position : field === 'rotation' ? rotation : scale;
    const next: [number, number, number] = [...current];
    next[axis] = value;
    setMeshTransform(meshKey, { [field]: next });
    setTick((t) => t + 1);
  };

  // Drag-to-scrub on the X/Y/Z label. Pointer lock (when available) hides the cursor
  // and removes the screen-edge limit; otherwise we fall back to bare movementX.
  const startScrub = (
    field: 'position' | 'rotation' | 'scale',
    axis: 0 | 1 | 2
  ) => (e: React.MouseEvent<HTMLSpanElement>) => {
    e.preventDefault();
    const target = e.currentTarget;
    const current = field === 'position' ? position : field === 'rotation' ? rotation : scale;
    let cumulative = current[axis];
    const baseStep = 0.01;

    target.requestPointerLock?.();

    const handleMove = (mv: MouseEvent) => {
      const factor = mv.shiftKey ? 10 : mv.altKey ? 0.1 : 1;
      cumulative += mv.movementX * baseStep * factor;
      const rounded = Math.round(cumulative * 1e6) / 1e6;
      const next: [number, number, number] = [...current];
      next[axis] = rounded;
      setMeshTransform(meshKey, { [field]: next });
      setTick((t) => t + 1);
    };

    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      if (document.pointerLockElement === target) document.exitPointerLock();
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  const resetTransform = () => {
    // Restore the mesh's authored (GLB) transform, not identity — a part modeled
    // away from the origin should return where it belongs, not jump to world zero.
    resetMeshTransform(meshKey);
    setTick((t) => t + 1);
  };

  const isModified = !!transform;

  const handleOpacity = (opacity: number) => {
    setBaseOpacity(meshKey, opacity);
    if (selectedMesh.material) {
      if (!selectedMesh.userData.uvCloned) {
        selectedMesh.material = (selectedMesh.material as THREE.MeshStandardMaterial).clone();
        selectedMesh.userData.uvCloned = true;
      }
      const mat = selectedMesh.material as THREE.MeshStandardMaterial;
      mat.transparent = opacity < 1;
      mat.depthWrite = opacity >= 1;
      mat.opacity = 1;
      mat.needsUpdate = true;
    }
  };

  const axisLabel = (a: number) => (a === 0 ? 'X' : a === 1 ? 'Y' : 'Z');

  return (
    <>
      <PropertySection title="Transform">
        {/* Master gate: model geometry is only movable in the 3D view while this is
            on, so ordinary annotation clicks can never nudge a part out of place. */}
        <label className="flex items-center gap-2 text-xs cursor-pointer rounded border px-2 py-1.5">
          <input
            type="checkbox"
            checked={moveMode}
            onChange={(e) => setMoveMode(e.target.checked)}
            className="h-3 w-3"
          />
          <span className="font-medium">Move parts</span>
          <span className="text-[10px] text-muted-foreground ml-auto">3D gizmo + surface drag</span>
        </label>

        {/* Position */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Position</Label>
          <div className="grid grid-cols-3 gap-1">
            {[0, 1, 2].map((a) => (
              <div key={a} className="flex items-center gap-1">
                <span
                  className="text-xs w-3 cursor-ew-resize select-none hover:text-foreground text-muted-foreground"
                  onMouseDown={startScrub('position', a as 0 | 1 | 2)}
                  title="Drag to scrub · Shift = 10× · Alt = 0.1×"
                >
                  {axisLabel(a)}
                </span>
                <NumberField
                  value={position[a]}
                  onCommit={(n) => commitAxis('position', a as 0 | 1 | 2, n)}
                  step={0.01}
                  precision={3}
                  className="h-7 text-xs px-1"
                  aria-label={`Position ${axisLabel(a)}`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Rotation (radians) */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Rotation (rad)</Label>
          <div className="grid grid-cols-3 gap-1">
            {[0, 1, 2].map((a) => (
              <div key={a} className="flex items-center gap-1">
                <span
                  className="text-xs w-3 cursor-ew-resize select-none hover:text-foreground text-muted-foreground"
                  onMouseDown={startScrub('rotation', a as 0 | 1 | 2)}
                  title="Drag to scrub · Shift = 10× · Alt = 0.1×"
                >
                  {axisLabel(a)}
                </span>
                <NumberField
                  value={rotation[a]}
                  onCommit={(n) => commitAxis('rotation', a as 0 | 1 | 2, n)}
                  step={0.01}
                  precision={3}
                  className="h-7 text-xs px-1"
                  aria-label={`Rotation ${axisLabel(a)}`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Scale */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Scale</Label>
          <div className="grid grid-cols-3 gap-1">
            {[0, 1, 2].map((a) => (
              <div key={a} className="flex items-center gap-1">
                <span
                  className="text-xs w-3 cursor-ew-resize select-none hover:text-foreground text-muted-foreground"
                  onMouseDown={startScrub('scale', a as 0 | 1 | 2)}
                  title="Drag to scrub · Shift = 10× · Alt = 0.1×"
                >
                  {axisLabel(a)}
                </span>
                <NumberField
                  value={scale[a]}
                  onCommit={(n) => commitAxis('scale', a as 0 | 1 | 2, n)}
                  step={0.01}
                  precision={3}
                  className="h-7 text-xs px-1"
                  aria-label={`Scale ${axisLabel(a)}`}
                />
              </div>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground -mt-1">
          Drag X/Y/Z to scrub · Arrows in field · Shift = 10× · Alt = 0.1×
        </p>

        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={resetTransform}
          disabled={!isModified}
          title={isModified ? 'Restore this part to its original position' : 'Part is at its original position'}
        >
          <RotateCcw className="mr-2 h-3 w-3" />
          {isModified ? 'Reset to original' : 'At original position'}
        </Button>

        <label
          className={`flex items-center gap-2 text-xs ${
            moveMode ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
          }`}
          title={moveMode ? undefined : 'Enable “Move parts” first'}
        >
          <input
            type="checkbox"
            checked={surfaceDragMode}
            disabled={!moveMode}
            onChange={(e) => setSurfaceDragMode(e.target.checked)}
            className="h-3 w-3"
          />
          <span>Surface drag</span>
          <span className="text-[10px] text-muted-foreground ml-auto">click + drag in 3D</span>
        </label>
      </PropertySection>

      <PropertySection title="Opacity">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Base texture</Label>
          <span className="text-xs">{Math.round(baseOpacity * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(baseOpacity * 100)}
          onChange={(e) => handleOpacity(Number(e.target.value) / 100)}
          className="w-full"
        />
        <p className="text-[10px] text-muted-foreground">
          Decal images stay fully opaque; only the base texture dims.
        </p>

        {/* When on, the selected part is drawn over everything so you can annotate
            it even when other parts occlude it. Turning it off renders the part in
            true depth order — use it if a selected part looks like it's floating. */}
        <label className="flex items-center gap-2 text-xs cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={xraySelected}
            onChange={(e) => setXraySelected(e.target.checked)}
            className="h-3 w-3"
          />
          <span>X-ray selected</span>
          <span className="text-[10px] text-muted-foreground ml-auto">show over other parts</span>
        </label>
      </PropertySection>
    </>
  );
}
