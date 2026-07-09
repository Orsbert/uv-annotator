import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { DecalGeometry } from 'three-stdlib';
import { Html } from '@react-three/drei';
import { useReferenceStore, useModelStore, meshKeyOf } from '../store/combinedStores';
import type { ProjectedBox, ReferenceItem } from '../store/combinedStores';
import { getColorTheme } from '../types';
import { renderBoxDecalCanvas } from '../utils/boxGraphics';

// Mirrors ReferencePlanes.planeSize — the plane geometry is normalized so the image's
// longer side is 1 unit; box rects are in that same UV space.
function planeSize(aspect: number): [number, number] {
  if (!Number.isFinite(aspect) || aspect <= 0) return [1, 1];
  return aspect >= 1 ? [1, 1 / aspect] : [aspect, 1];
}

/**
 * Project one box, drawn on a grounded reference plane, straight onto its target
 * mesh as a decal that conforms to the surface. The projection direction is the
 * plane's normal, so a box around a feature in the flat overlay lands around the
 * same feature on the curved model — that's what makes the 2D proof and the 3D
 * agree where UV-space annotations drift.
 *
 * Returns null geometry when the plane doesn't cover the mesh at that box (nothing
 * to project onto).
 */
function computeDecal(
  box: ProjectedBox,
  reference: ReferenceItem,
  mesh: THREE.Mesh
): { geometry: THREE.BufferGeometry | null; texture: THREE.CanvasTexture | null; center: THREE.Vector3 | null } {
  const [pw, ph] = planeSize(reference.aspect);
  const [px, py, pz] = reference.position;
  const [rx, ry, rz] = reference.rotation;
  const [sx, sy] = reference.scale;

  const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  const planeMatrix = new THREE.Matrix4().compose(
    new THREE.Vector3(px, py, pz),
    quat,
    new THREE.Vector3(sx, sy, 1)
  );

  // Box center in plane-UV → plane-local (v up) → world.
  const cu = box.u + box.w / 2;
  const cv = box.v + box.h / 2;
  const worldCenter = new THREE.Vector3((cu - 0.5) * pw, (cv - 0.5) * ph, 0).applyMatrix4(planeMatrix);
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(quat).normalize();

  const worldW = box.w * pw * sx;
  const worldH = box.h * ph * sy;
  if (worldW <= 0 || worldH <= 0) return { geometry: null, texture: null, center: null };

  mesh.updateWorldMatrix(true, false);
  const bbox = new THREE.Box3().setFromObject(mesh);
  const diag = bbox.getSize(new THREE.Vector3()).length() || 1;

  // Walk the plane normal to the first surface point under the box center.
  const ray = new THREE.Raycaster();
  ray.set(worldCenter.clone().addScaledVector(normal, diag), normal.clone().negate());
  let hit = ray.intersectObject(mesh, false)[0];
  if (!hit) {
    ray.set(worldCenter.clone().addScaledVector(normal, -diag), normal.clone());
    hit = ray.intersectObject(mesh, false)[0];
  }
  if (!hit) return { geometry: null, texture: null, center: null };

  // Depth is kept modest so the projection catches the near surface, not the back face.
  const depth = Math.max(worldW, worldH, diag * 0.2);
  const size = new THREE.Vector3(worldW, worldH, depth);
  const orientation = new THREE.Euler().setFromQuaternion(quat);
  // DecalGeometry needs position/normal attributes; guard so a mesh missing them
  // (or any projection failure) skips its decal instead of crashing the canvas.
  let geometry: THREE.BufferGeometry | null = null;
  try {
    geometry = new DecalGeometry(mesh, hit.point, orientation, size);
  } catch {
    return { geometry: null, texture: null, center: null };
  }

  const texture = new THREE.CanvasTexture(renderBoxDecalCanvas(box, worldH > 0 ? worldW / worldH : 1));
  texture.colorSpace = THREE.SRGBColorSpace;
  // `center` = the surface point under the box, where the constant-size label sits.
  return { geometry, texture, center: hit.point };
}

function BoxDecal({ box, reference, mesh }: { box: ProjectedBox; reference: ReferenceItem; mesh: THREE.Mesh }) {
  // Recompute whenever the box rect, the plane transform, or the mesh transform
  // changes. Reading transformsByMesh here is what makes the decal follow the mesh
  // after a gizmo move.
  const transform = useModelStore((s) => s.transformsByMesh[box.meshKey]);

  const { geometry, texture, center } = useMemo(
    () => computeDecal(box, reference, mesh),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      box.u, box.v, box.w, box.h, box.color, box.label,
      reference.position, reference.rotation, reference.scale, reference.aspect,
      mesh, transform,
    ]
  );

  useEffect(
    () => () => {
      geometry?.dispose();
      texture?.dispose();
    },
    [geometry, texture]
  );

  if (!geometry || !texture) return null;

  const theme = getColorTheme(box.color);

  return (
    <>
      <mesh geometry={geometry} renderOrder={1200}>
        <meshBasicMaterial
          map={texture}
          transparent
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-4}
          depthTest
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {center && box.label && (
        // Constant screen-size DOM tag pinned to the box's surface point — always
        // legible on the model regardless of box size or zoom, unlike text baked
        // into the decal texture.
        <Html
          position={[center.x, center.y, center.z]}
          center
          zIndexRange={[100, 0]}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <div
            style={{
              background: theme.main,
              color: '#fff',
              fontFamily: 'ui-sans-serif, system-ui, -apple-system, Arial',
              fontSize: '11px',
              fontWeight: 600,
              lineHeight: 1,
              padding: '2px 5px',
              borderRadius: '4px',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
            }}
          >
            {box.label}
          </div>
        </Html>
      )}
    </>
  );
}

export function ProjectedBoxDecals() {
  const references = useReferenceStore((s) => s.references);
  const meshes = useModelStore((s) => s.meshes);

  const byKey = useMemo(() => {
    const map = new Map<string, THREE.Mesh>();
    meshes.forEach((m) => map.set(meshKeyOf(m), m));
    return map;
  }, [meshes]);

  // Decals are driven by each box's own visibility (and the plane being grounded),
  // NOT the plane's visibility — so you can hide the overlay image (B) and still
  // review clean boxes on the model.
  return (
    <>
      {references
        .filter((r) => !r.lockToView)
        .flatMap((r) =>
          r.boxes
            .filter((b) => b.visible && b.meshKey && byKey.has(b.meshKey))
            .map((b) => <BoxDecal key={b.id} box={b} reference={r} mesh={byKey.get(b.meshKey)!} />)
        )}
    </>
  );
}
