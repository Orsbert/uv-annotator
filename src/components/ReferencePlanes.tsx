import { useEffect, useMemo, useState } from 'react';
import { useThree, useFrame, type ThreeEvent } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useReferenceStore, useUiStore, usePaintStore } from '../store/combinedStores';
import type { ReferenceItem } from '../store/combinedStores';

// How far in front of the camera a "lock to view" / freshly camera-aligned plane sits.
const VIEW_DISTANCE = 3;

// A raycast that contributes no hits — used to make a plane click-through in paint
// mode (paint the mesh behind it) and in lock-to-view mode (a passive backdrop that
// never eats orbit/paint clicks).
const noopRaycast: THREE.Mesh['raycast'] = () => {};
const defaultRaycast = THREE.Mesh.prototype.raycast;

// The plane's base geometry, normalized so the image's longer side is 1 world unit.
// User scale multiplies from there.
function planeSize(aspect: number): [number, number] {
  if (!Number.isFinite(aspect) || aspect <= 0) return [1, 1];
  return aspect >= 1 ? [1, 1 / aspect] : [aspect, 1];
}

function ReferencePlane({ reference }: { reference: ReferenceItem }) {
  const { camera } = useThree();
  const updateReference = useReferenceStore((s) => s.updateReference);
  const selectedId = useReferenceStore((s) => s.selectedReferenceId);
  const setSelectedReferenceId = useReferenceStore((s) => s.setSelectedReferenceId);
  const isPaintMode = usePaintStore((s) => s.isPaintMode);
  const gizmoMode = useUiStore((s) => s.gizmoMode);
  const axisLock = useUiStore((s) => s.axisLock);

  const [obj, setObj] = useState<THREE.Mesh | null>(null);
  const isSelected = selectedId === reference.id;

  const texture = useMemo(() => {
    if (!reference.image) return null;
    const t = new THREE.Texture(reference.image);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }, [reference.image]);

  useEffect(() => () => texture?.dispose(), [texture]);

  const [pw, ph] = planeSize(reference.aspect);
  const { position, rotation, scale, lockToView } = reference;

  // Grounded: mirror the stored transform onto the object. Skipped while pinned to
  // the view (useFrame drives it) and dormant during a gizmo drag (no store change
  // fires until mouse-up, so this never fights the gizmo).
  useEffect(() => {
    if (!obj || lockToView) return;
    obj.position.set(position[0], position[1], position[2]);
    obj.rotation.set(rotation[0], rotation[1], rotation[2]);
    obj.scale.set(scale[0], scale[1], 1);
  }, [obj, lockToView, position, rotation, scale]);

  // Lock to view (rotoscope): pin to the camera every frame. Stored position X/Y is
  // read as a screen-space offset (right / up), rotation Z as roll, scale as size.
  useFrame(() => {
    if (!obj || !lockToView) return;
    const q = camera.quaternion;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    obj.position
      .copy(camera.position)
      .addScaledVector(forward, VIEW_DISTANCE)
      .addScaledVector(right, position[0])
      .addScaledVector(up, position[1]);
    obj.quaternion.copy(q);
    obj.rotateZ(rotation[2]);
    obj.scale.set(scale[0], scale[1], 1);
  });

  // Consume a one-shot quick-align command (needs the live camera / world axes).
  useEffect(() => {
    if (!obj || !reference.pendingAlign) return;
    let nextPos: [number, number, number] = [position[0], position[1], position[2]];
    let nextRot: [number, number, number] = [rotation[0], rotation[1], rotation[2]];
    switch (reference.pendingAlign) {
      case 'camera': {
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const p = camera.position.clone().addScaledVector(forward, VIEW_DISTANCE);
        const e = new THREE.Euler().setFromQuaternion(camera.quaternion);
        nextPos = [p.x, p.y, p.z];
        nextRot = [e.x, e.y, e.z];
        break;
      }
      case 'front': // face +Z
        nextRot = [0, 0, 0];
        break;
      case 'side': // face +X
        nextRot = [0, Math.PI / 2, 0];
        break;
      case 'top': // face +Y
        nextRot = [-Math.PI / 2, 0, 0];
        break;
    }
    updateReference(reference.id, { position: nextPos, rotation: nextRot, pendingAlign: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obj, reference.pendingAlign]);

  if (!reference.visible || !texture) return null;

  // A lock-to-view plane and a paint-mode plane must never intercept pointer events.
  const clickThrough = isPaintMode || lockToView;
  // Draw over the part (ignore depth) when in X-ray or when acting as a view backdrop.
  const onTop = reference.showOnTop || lockToView;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (clickThrough) return;
    e.stopPropagation();
    setSelectedReferenceId(reference.id);
  };

  const showX = axisLock === null || axisLock === 'x' || axisLock === 'no-y' || axisLock === 'no-z';
  const showY = axisLock === null || axisLock === 'y' || axisLock === 'no-x' || axisLock === 'no-z';
  const showZ = axisLock === null || axisLock === 'z' || axisLock === 'no-x' || axisLock === 'no-y';

  const commit = () => {
    if (!obj) return;
    updateReference(reference.id, {
      position: [obj.position.x, obj.position.y, obj.position.z],
      rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
      scale: [obj.scale.x, obj.scale.y, 1],
    });
  };

  const showGizmo = isSelected && !lockToView && !isPaintMode;

  return (
    <>
      <mesh
        ref={setObj}
        renderOrder={onTop ? 1000 : 0}
        raycast={clickThrough ? noopRaycast : defaultRaycast}
        onClick={handleClick}
      >
        <planeGeometry args={[pw, ph]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={reference.opacity}
          side={THREE.DoubleSide}
          depthTest={!onTop}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {showGizmo && obj && (
        <TransformControls
          object={obj}
          mode={gizmoMode}
          showX={showX}
          showY={showY}
          showZ={showZ}
          onMouseUp={commit}
        />
      )}
    </>
  );
}

export function ReferencePlanes() {
  const references = useReferenceStore((s) => s.references);
  return (
    <>
      {references.map((r) => (
        <ReferencePlane key={r.id} reference={r} />
      ))}
    </>
  );
}
