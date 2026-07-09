import { useEffect, useMemo, useRef, useState } from 'react';
import { useThree, useFrame, type ThreeEvent } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useReferenceStore, useUiStore, usePaintStore } from '../store/combinedStores';
import type { ReferenceItem } from '../store/combinedStores';
import { ANNOTATION_COLORS } from '../types';
import { drawBoxGraphic, boxRectToCanvas } from '../utils/boxGraphics';

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

// A box mid-draw — same shape the composite texture expects, plus color/label so the
// live preview matches the committed box.
type Draft = { u: number; v: number; w: number; h: number; color: string; label: string };

function ReferencePlane({ reference }: { reference: ReferenceItem }) {
  const { camera, gl } = useThree();
  const updateReference = useReferenceStore((s) => s.updateReference);
  const addBox = useReferenceStore((s) => s.addBox);
  const selectedId = useReferenceStore((s) => s.selectedReferenceId);
  const setSelectedReferenceId = useReferenceStore((s) => s.setSelectedReferenceId);
  const isPaintMode = usePaintStore((s) => s.isPaintMode);
  const gizmoMode = useUiStore((s) => s.gizmoMode);
  const axisLock = useUiStore((s) => s.axisLock);
  const setSurfaceDragActive = useUiStore((s) => s.setSurfaceDragActive);

  const [obj, setObj] = useState<THREE.Mesh | null>(null);
  const [draft, setDraftState] = useState<Draft | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const setDraft = (d: Draft | null) => {
    draftRef.current = d;
    setDraftState(d);
  };
  const isSelected = selectedId === reference.id;

  const { image, boxes, aspect, position, rotation, scale, lockToView, drawBoxes } = reference;

  // One canvas + CanvasTexture per plane, drawn with the image and its boxes. This
  // composite is both what shows on the plane and the flat 2D proof for export.
  const { texture, canvas } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { texture: t, canvas: c };
  }, []);

  useEffect(() => () => texture.dispose(), [texture]);

  // Redraw the composite whenever the image, the boxes, or the in-progress draft change.
  useEffect(() => {
    if (!image) return;
    const W = image.naturalWidth || 1024;
    const H = image.naturalHeight || 1024;
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(image, 0, 0, W, H);
    for (const b of boxes) {
      if (!b.visible) continue;
      const r = boxRectToCanvas(b, W, H);
      drawBoxGraphic(ctx, r.x, r.y, r.w, r.h, b.color, b.label);
    }
    if (draft) {
      const r = boxRectToCanvas(draft, W, H);
      drawBoxGraphic(ctx, r.x, r.y, r.w, r.h, draft.color, draft.label);
    }
    texture.needsUpdate = true;
  }, [image, boxes, draft, canvas, texture]);

  const [pw, ph] = planeSize(aspect);

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

  // Draw-a-box mode: intercept canvas drags in the capture phase (so OrbitControls
  // never sees them), raycast this plane directly — ignoring whatever occludes it —
  // and build a rect in the plane's own UV space.
  useEffect(() => {
    if (!drawBoxes || !obj) return;
    const el = gl.domElement;
    const raycaster = new THREE.Raycaster();
    let start: THREE.Vector2 | null = null;

    const nextIdx = boxes.length;
    const color = ANNOTATION_COLORS[nextIdx % ANNOTATION_COLORS.length].name;
    const label = `b${nextIdx + 1}`;

    const uvAt = (clientX: number, clientY: number): THREE.Vector2 | null => {
      const rect = el.getBoundingClientRect();
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const hits: THREE.Intersection[] = [];
      defaultRaycast.call(obj, raycaster, hits); // ignore obj.raycast (may be noop)
      const uv = hits[0]?.uv;
      return uv ? new THREE.Vector2(uv.x, uv.y) : null;
    };

    const onMove = (e: PointerEvent) => {
      if (!start) return;
      const uv = uvAt(e.clientX, e.clientY);
      if (!uv) return;
      setDraft({
        u: Math.min(start.x, uv.x),
        v: Math.min(start.y, uv.y),
        w: Math.abs(uv.x - start.x),
        h: Math.abs(uv.y - start.y),
        color,
        label,
      });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      setSurfaceDragActive(false);
      const d = draftRef.current;
      start = null;
      setDraft(null);
      if (d && d.w > 0.01 && d.h > 0.01) {
        addBox(reference.id, { u: d.u, v: d.v, w: d.w, h: d.h });
      }
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const uv = uvAt(e.clientX, e.clientY);
      if (!uv) return; // not over the plane — let orbit / UI have the event
      e.preventDefault();
      e.stopImmediatePropagation();
      start = uv;
      setSurfaceDragActive(true);
      setDraft({ u: uv.x, v: uv.y, w: 0, h: 0, color, label });
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
    };

    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      setSurfaceDragActive(false);
    };
  }, [drawBoxes, obj, boxes.length, gl, camera, addBox, reference.id, setSurfaceDragActive]);

  if (!reference.visible || !image) return null;

  // Lock-to-view / paint-mode planes must never intercept r3f pointer events. (Draw
  // mode uses its own capture-phase handler above, not r3f events.)
  const clickThrough = isPaintMode || lockToView;
  // Draw over the part (ignore depth) when in X-ray or acting as a view backdrop.
  const onTop = reference.showOnTop || lockToView;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (clickThrough || drawBoxes) return;
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

  const showGizmo = isSelected && !lockToView && !isPaintMode && !drawBoxes;

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
