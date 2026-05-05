import { useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import * as THREE from 'three';
import { useModelStore, useCanvasStore, useUiStore, meshKeyOf } from '../../store/combinedStores';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';

export function MeshControls() {
  const selectedMesh = useModelStore((s) => s.selectedMesh);
  const meshKey = meshKeyOf(selectedMesh);
  const baseOpacity = useCanvasStore((s) => s.baseOpacityByMesh[meshKey] ?? 1);
  const setBaseOpacity = useCanvasStore((s) => s.setBaseOpacity);
  const transform = useModelStore((s) => s.transformsByMesh[meshKey]);
  const setMeshTransform = useModelStore((s) => s.setMeshTransform);
  const surfaceDragMode = useUiStore((s) => s.surfaceDragMode);
  const setSurfaceDragMode = useUiStore((s) => s.setSurfaceDragMode);
  const [open, setOpen] = useState(true);
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

  const updateAxis = (
    field: 'position' | 'rotation' | 'scale',
    axis: 0 | 1 | 2,
    value: string
  ) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    const current = field === 'position' ? position : field === 'rotation' ? rotation : scale;
    const next: [number, number, number] = [...current];
    next[axis] = num;
    setMeshTransform(meshKey, { [field]: next });
    setTick((t) => t + 1);
  };

  // Arrow keys: ↑/↓ = base step, Shift = ×10 coarser, Alt = ×0.1 finer.
  const handleStepKey = (
    e: React.KeyboardEvent<HTMLInputElement>,
    field: 'position' | 'rotation' | 'scale',
    axis: 0 | 1 | 2
  ) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const baseStep = 0.01;
    const factor = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
    const step = baseStep * factor;
    const direction = e.key === 'ArrowUp' ? 1 : -1;
    const current = field === 'position' ? position : field === 'rotation' ? rotation : scale;
    // Round to 6 decimals to keep float drift out of the display
    const newVal = Math.round((current[axis] + direction * step) * 1e6) / 1e6;
    const next: [number, number, number] = [...current];
    next[axis] = newVal;
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
    setMeshTransform(meshKey, {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    });
    setTick((t) => t + 1);
  };

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
    <div className="border-b">
      <button
        className="w-full flex items-center gap-2 p-3 hover:bg-accent/50 text-sm font-semibold"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Mesh
        <span className="ml-auto text-xs text-muted-foreground truncate max-w-[140px]" title={selectedMesh.name}>
          {selectedMesh.name || 'unnamed'}
        </span>
      </button>

      {open && (
        <div className="p-3 space-y-3">
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
                  <Input
                    type="number"
                    step="0.01"
                    value={position[a].toFixed(3)}
                    onChange={(e) => updateAxis('position', a as 0 | 1 | 2, e.target.value)}
                    onKeyDown={(e) => handleStepKey(e, 'position', a as 0 | 1 | 2)}
                    className="h-7 text-xs px-1"
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
                  <Input
                    type="number"
                    step="0.01"
                    value={rotation[a].toFixed(3)}
                    onChange={(e) => updateAxis('rotation', a as 0 | 1 | 2, e.target.value)}
                    onKeyDown={(e) => handleStepKey(e, 'rotation', a as 0 | 1 | 2)}
                    className="h-7 text-xs px-1"
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
                  <Input
                    type="number"
                    step="0.01"
                    value={scale[a].toFixed(3)}
                    onChange={(e) => updateAxis('scale', a as 0 | 1 | 2, e.target.value)}
                    onKeyDown={(e) => handleStepKey(e, 'scale', a as 0 | 1 | 2)}
                    className="h-7 text-xs px-1"
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
            title="Reset position / rotation / scale"
          >
            <RotateCcw className="mr-2 h-3 w-3" />
            Reset transform
          </Button>

          <label className="flex items-center gap-2 text-xs cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={surfaceDragMode}
              onChange={(e) => setSurfaceDragMode(e.target.checked)}
              className="h-3 w-3"
            />
            <span>Surface drag</span>
            <span className="text-[10px] text-muted-foreground ml-auto">
              click + drag in 3D
            </span>
          </label>

          {/* Opacity */}
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs text-muted-foreground">Opacity</Label>
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
            <p className="text-[10px] text-muted-foreground mt-1">
              Decal images stay fully opaque; only the base texture dims.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
