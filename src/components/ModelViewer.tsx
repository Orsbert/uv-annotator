import { useRef, useState, useEffect } from 'react';
import { Canvas, ThreeEvent, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, TransformControls } from '@react-three/drei';
import { useModelStore, meshKeyOf, useUiStore, useReferenceStore } from '../store/combinedStores';
import type { AxisLock } from '../store/combinedStores';
import { useCanvasStore } from '../store/combinedStores';
import { usePaintStore } from '../store/combinedStores';
import { useSessionStore } from '../store/useSessionStore';
import { ReferencePlanes } from './ReferencePlanes';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

// How strongly the annotation texture self-illuminates on the mesh. 0 = fully
// lit (annotations can wash out), 1 = full emissive (flat/unlit look). ~0.6
// keeps shading on the part while making annotations pop.
const ANNOTATION_EMISSIVE_INTENSITY = 0.6;

// three.js Object3D.onBeforeRender defaults to an empty function; we restore to
// this when turning "show on top" off so the depth-clear hook is removed.
const NOOP_BEFORE_RENDER: THREE.Object3D['onBeforeRender'] = () => {};

function CameraController() {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const updateSession = useSessionStore((state) => state.updateSession);
  const sessions = useSessionStore((state) => state.sessions);
  const isPaintMode = usePaintStore((state) => state.isPaintMode);
  const surfaceDragActive = useUiStore((state) => state.surfaceDragActive);

  // Restore camera state on mount or session change
  useEffect(() => {
    if (!currentSessionId || !controlsRef.current) return;
    
    const session = sessions.find(s => s.id === currentSessionId);
    if (session?.cameraState) {
      camera.position.fromArray(session.cameraState.position);
      controlsRef.current.target.fromArray(session.cameraState.target);
      controlsRef.current.update();
    }
  }, [currentSessionId, camera, sessions]);

  // Save camera state when interaction ends
  const handleEnd = () => {
    if (!currentSessionId || !controlsRef.current || isPaintMode) return;

    const position = camera.position.toArray() as [number, number, number];
    const target = controlsRef.current.target.toArray() as [number, number, number];

    updateSession(currentSessionId, {
        cameraState: { position, target }
    });
  };

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={!isPaintMode && !surfaceDragActive}
      onEnd={handleEnd}
      enableDamping={true}
      dampingFactor={0.05}
    />
  );
}

function Scene() {
  const model = useModelStore((state) => state.model);
  const selectedMesh = useModelStore((state) => state.selectedMesh);
  const setSelectedMesh = useModelStore((state) => state.setSelectedMesh);
  const setMeshTransform = useModelStore((state) => state.setMeshTransform);
  const meshes = useModelStore((state) => state.meshes);
  const meshKey = meshKeyOf(selectedMesh);
  const uvTexture = useCanvasStore((state) => state.textureByMesh[meshKey] ?? null);
  const baseOpacity = useCanvasStore((state) => state.baseOpacityByMesh[meshKey] ?? 1);
  const isPaintMode = usePaintStore((state) => state.isPaintMode);
  const addPaintedUVCoord = usePaintStore((state) => state.addPaintedUVCoord);
  const brushSize = usePaintStore((state) => state.brushSize);
  const surfaceDragMode = useUiStore((state) => state.surfaceDragMode);
  const setSurfaceDragActive = useUiStore((state) => state.setSurfaceDragActive);
  const axisLock = useUiStore((state) => state.axisLock);
  const gizmoMode = useUiStore((state) => state.gizmoMode);
  // A selected reference plane takes over the gizmo; hide the mesh gizmo so the two
  // never fight over the transform.
  const selectedReferenceId = useReferenceStore((state) => state.selectedReferenceId);
  const { camera, gl } = useThree();
  const surfaceDragRef = useRef<{ offset: THREE.Vector3 } | null>(null);
  const surfaceRaycaster = useRef(new THREE.Raycaster());

  // Keyboard shortcuts: Blender-style transform conventions.
  //   G / R / S   → translate / rotate / scale gizmo mode
  //   X / Y / Z   → constrain gizmo to one axis (toggle off by pressing same key)
  //   Shift+X/Y/Z → "all but" plane lock (hide that axis)
  //   Escape      → clear axis lock if set (otherwise falls through to the global handler)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey || e.metaKey) return;

      const k = e.key.toLowerCase();
      // Mode switch — never with modifiers (Shift+S etc. is reserved for axis-plane lock)
      if (!e.shiftKey && !e.altKey) {
        if (k === 'g') { useUiStore.getState().setGizmoMode('translate'); return; }
        if (k === 'r') { useUiStore.getState().setGizmoMode('rotate'); return; }
        if (k === 's') { useUiStore.getState().setGizmoMode('scale'); return; }
      }
      if (k === 'x' || k === 'y' || k === 'z') {
        const axis = k as 'x' | 'y' | 'z';
        const desired: AxisLock = e.shiftKey ? (`no-${axis}` as AxisLock) : axis;
        const current = useUiStore.getState().axisLock;
        useUiStore.getState().setAxisLock(current === desired ? null : desired);
        return;
      }
      if (e.key === 'Escape' && useUiStore.getState().axisLock !== null) {
        useUiStore.getState().setAxisLock(null);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The selected mesh always renders on top so the annotations you're working on
  // are visible even when other parts occlude it. renderOrder alone isn't enough
  // for opaque meshes (the depth buffer still rejects them), so we also clear the
  // depth buffer right before this mesh draws. Combined with the high renderOrder
  // it paints over everything already rendered while still self-occluding correctly
  // (front faces over back faces) — which depthTest=false alone wouldn't do. The
  // cleanup resets the previously-selected mesh when the selection changes.
  useEffect(() => {
    const mesh = selectedMesh;
    if (!mesh) return;
    mesh.renderOrder = 999;
    mesh.onBeforeRender = (renderer) => renderer.clearDepth();
    return () => {
      mesh.renderOrder = 0;
      mesh.onBeforeRender = NOOP_BEFORE_RENDER;
    };
  }, [selectedMesh]);

  const showX = axisLock === null || axisLock === 'x' || axisLock === 'no-y' || axisLock === 'no-z';
  const showY = axisLock === null || axisLock === 'y' || axisLock === 'no-x' || axisLock === 'no-z';
  const showZ = axisLock === null || axisLock === 'z' || axisLock === 'no-x' || axisLock === 'no-y';

  // Persist the gizmo's drag result back to the store on mouse-up.
  const commitGizmoTransform = () => {
    if (!selectedMesh) return;
    setMeshTransform(meshKeyOf(selectedMesh), {
      position: [selectedMesh.position.x, selectedMesh.position.y, selectedMesh.position.z],
      rotation: [selectedMesh.rotation.x, selectedMesh.rotation.y, selectedMesh.rotation.z],
      scale: [selectedMesh.scale.x, selectedMesh.scale.y, selectedMesh.scale.z],
    });
  };

  const [paintIndicator, setPaintIndicator] = useState<{ position: THREE.Vector3; normal: THREE.Vector3 } | null>(null);
  const isPaintingRef = useRef(false);

  // Apply texture to selected mesh — clone the material first if it hasn't been
  // cloned yet, so we don't mutate a material that's shared across meshes.
  if (selectedMesh && uvTexture && selectedMesh.material) {
    if (!selectedMesh.userData.uvCloned) {
      selectedMesh.material = (selectedMesh.material as THREE.MeshStandardMaterial).clone();
      selectedMesh.userData.uvCloned = true;
    }
    const material = selectedMesh.material as THREE.MeshStandardMaterial;
    if (material.map !== uvTexture) {
      // Albedo: the texture still receives scene lighting, so the part keeps its
      // shaded, three-dimensional look.
      material.map = uvTexture;
      // Emissive: feed the SAME texture as an emissive map so the annotations
      // self-illuminate. This keeps colored boxes/labels readable in shadow and
      // stops them washing to white under the bright preview lights, while the
      // base surface still reads as shaded geometry. emissive must be white for
      // the emissiveMap to show in full color (it multiplies the map).
      material.emissiveMap = uvTexture;
      material.emissive = new THREE.Color(0xffffff);
      material.emissiveIntensity = ANNOTATION_EMISSIVE_INTENSITY;
      material.needsUpdate = true;
    }
    // Per-pixel transparency comes from the texture's alpha channel; opacity stays at 1.
    const wantTransparent = baseOpacity < 1;
    if (material.transparent !== wantTransparent) {
      material.transparent = wantTransparent;
      material.depthWrite = !wantTransparent;
      material.needsUpdate = true;
    }
    if (material.opacity !== 1) {
      material.opacity = 1;
    }
  }

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (isPaintMode && e.object === selectedMesh) {
      e.stopPropagation();
      isPaintingRef.current = true;
      handlePaint(e);
      return;
    }
    if (surfaceDragMode && e.object === selectedMesh && e.button === 0) {
      e.stopPropagation();
      startSurfaceDrag(e);
    }
  };

  const screenToNdc = (clientX: number, clientY: number): THREE.Vector2 => {
    const rect = gl.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
  };

  const raycastSurface = (clientX: number, clientY: number): THREE.Intersection | null => {
    if (!selectedMesh) return null;
    const ndc = screenToNdc(clientX, clientY);
    surfaceRaycaster.current.setFromCamera(ndc, camera);
    const targets = meshes.filter((m) => m !== selectedMesh && m.visible);
    const hits = surfaceRaycaster.current.intersectObjects(targets, false);
    return hits[0] ?? null;
  };

  const startSurfaceDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!selectedMesh) return;
    setSurfaceDragActive(true);

    // Anchor: prefer a hit on a non-self surface. If the drag begins over empty
    // space (decal floats with no surface beneath it), fall back to the click
    // point on the dragged mesh so the offset is still meaningful.
    const surfaceHit = raycastSurface(e.nativeEvent.clientX, e.nativeEvent.clientY);
    const anchor = surfaceHit ? surfaceHit.point : e.point.clone();
    const offset = new THREE.Vector3().copy(selectedMesh.position).sub(anchor);
    surfaceDragRef.current = { offset };

    const onMove = (mv: PointerEvent) => {
      if (!surfaceDragRef.current || !selectedMesh) return;
      const hit = raycastSurface(mv.clientX, mv.clientY);
      if (!hit) return; // off-surface — hold position rather than snap to camera plane
      selectedMesh.position.copy(hit.point).add(surfaceDragRef.current.offset);
    };

    // Scroll wheel during drag = uniform scale. Blender convention:
    //   plain  → multiply by 1.05 per tick
    //   Shift  → precise (×1.005)
    //   Ctrl   → snap, ±0.1 increments
    // Trackpad pinch fires wheel with ctrlKey=true, which means pinch-to-zoom
    // ends up in the snap branch — that's the closest analog to Blender's
    // pinch-style scaling and feels right in practice.
    const onWheel = (we: WheelEvent) => {
      if (!surfaceDragRef.current || !selectedMesh) return;
      we.preventDefault();
      const dir = we.deltaY > 0 ? -1 : 1;
      if (we.ctrlKey || we.metaKey) {
        // Snap to nearest 0.1 step on each axis
        const step = 0.1;
        const next = (v: number) =>
          Math.max(0.01, Math.round((v + dir * step) / step) * step);
        selectedMesh.scale.set(
          next(selectedMesh.scale.x),
          next(selectedMesh.scale.y),
          next(selectedMesh.scale.z),
        );
      } else {
        const stepFactor = we.shiftKey ? 1.005 : 1.05;
        const factor = dir > 0 ? stepFactor : 1 / stepFactor;
        selectedMesh.scale.multiplyScalar(factor);
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('wheel', onWheel);
      surfaceDragRef.current = null;
      setSurfaceDragActive(false);
      if (!selectedMesh) return;
      // Commit position AND scale to the store as one undo entry
      setMeshTransform(meshKeyOf(selectedMesh), {
        position: [selectedMesh.position.x, selectedMesh.position.y, selectedMesh.position.z],
        scale: [selectedMesh.scale.x, selectedMesh.scale.y, selectedMesh.scale.z],
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    // passive:false so we can preventDefault and stop the canvas from dollying
    window.addEventListener('wheel', onWheel, { passive: false });
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (isPaintMode && e.object === selectedMesh) {
      e.stopPropagation();
      
      // R3F provides point and face automatically
      if (e.point && e.face) {
        setPaintIndicator({
          position: e.point,
          normal: e.face.normal,
        });
        
        if (isPaintingRef.current) {
          handlePaint(e);
        }
      }
    } else if (isPaintMode) {
      // Clear indicator when not over selected mesh
      setPaintIndicator(null);
    }
  };

  const handlePointerUp = () => {
    if (isPaintingRef.current && isPaintMode) {
      // Auto-create annotation when stopping painting
        const paintedUVCoords = usePaintStore.getState().paintedUVCoords;
        if (paintedUVCoords.length > 0) {
          const createAnnotationFromPaint = usePaintStore.getState().createAnnotationFromPaint;
          createAnnotationFromPaint();
        }
    }
    isPaintingRef.current = false;
  };

  const handlePaint = (e: ThreeEvent<PointerEvent>) => {
    if (!isPaintMode || e.object !== selectedMesh) return;

    e.stopPropagation();

    // R3F provides UV coordinates automatically
    if (e.uv) {
      addPaintedUVCoord({ u: e.uv.x, v: e.uv.y });
    }
  };

  const handleMeshClick = (e: ThreeEvent<MouseEvent>) => {
    console.log('Mesh clicked:', e.object.name);
    if (isPaintMode) {
      handlePaint(e as any);
    } else {
      e.stopPropagation();
      // e.nativeEvent.stopImmediatePropagation(); // Sometimes needed if other handlers interfere
      if (e.object instanceof THREE.Mesh) {
        console.log('Setting selected mesh:', e.object.name);
        setSelectedMesh(e.object);
        // Hand the gizmo back to the mesh if a reference plane had it.
        useReferenceStore.getState().setSelectedReferenceId(null);
      }
    }
  };

  return (
    <>
      <color attach="background" args={['#1a1a1a']} />
      {/* Lighting is eased from the usual studio setup so a white/light texture
          doesn't clamp to pure white — that washout is what made annotations
          hard to read. Combined with the emissive annotation map, colors now
          read true while the part keeps its shaded form. */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={0.7} />
      <directionalLight position={[-10, -10, -5]} intensity={0.25} />
      
      {model && (
        <primitive 
          object={model} 
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={handleMeshClick}
        />
      )}
      
      {/* Paint brush cursor - ring on surface */}
      {isPaintMode && paintIndicator && (
        <group position={paintIndicator.position}>
          {/* Outer ring */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[brushSize / 500, brushSize / 500 + 0.01, 32]} />
            <meshBasicMaterial color="#00ff00" side={THREE.DoubleSide} transparent opacity={0.8} depthTest={false} />
          </mesh>
          {/* Inner filled circle for better visibility */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[brushSize / 500, 32]} />
            <meshBasicMaterial color="#00ff00" side={THREE.DoubleSide} transparent opacity={0.2} depthTest={false} />
          </mesh>
          {/* Center dot */}
          <mesh>
            <sphereGeometry args={[0.005, 8, 8]} />
            <meshBasicMaterial color="#00ff00" depthTest={false} />
          </mesh>
        </group>
      )}
      
      <Grid 
        args={[10, 10]} 
        cellSize={0.5} 
        cellThickness={0.5} 
        cellColor={'#6f6f6f'} 
        sectionSize={1} 
        sectionThickness={1} 
        sectionColor={'#9d4b4b'} 
        fadeStrength={1} 
        fadeDistance={30} 
      />
      
      {selectedMesh && !isPaintMode && !surfaceDragMode && !selectedReferenceId && (
        <TransformControls
          object={selectedMesh}
          mode={gizmoMode}
          showX={showX}
          showY={showY}
          showZ={showZ}
          onMouseUp={commitGizmoTransform}
        />
      )}

      <ReferencePlanes />

      <CameraController />
      <Environment preset="studio" environmentIntensity={0.4} />
    </>
  );
}

function AxisLockBadge() {
  const axisLock = useUiStore((s) => s.axisLock);
  if (!axisLock) return null;
  const label = axisLock.startsWith('no-')
    ? `Lock: not ${axisLock.slice(3).toUpperCase()}`
    : `Lock: ${axisLock.toUpperCase()} only`;
  return (
    <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded bg-background/80 border text-xs font-mono pointer-events-none">
      🔒 {label}
    </div>
  );
}

export function ModelViewer() {
  return (
    <div className="w-full h-full relative">
      <Canvas camera={{ position: [3, 3, 3], fov: 50 }}>
        <Scene />
      </Canvas>
      <AxisLockBadge />
    </div>
  );
}
