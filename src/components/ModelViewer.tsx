import { useRef, useState } from 'react';
import { Canvas, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import { useModelStore } from '../store/combinedStores';
import { useCanvasStore } from '../store/combinedStores';
import { usePaintStore } from '../store/combinedStores';
import * as THREE from 'three';

function Scene() {
  const model = useModelStore((state) => state.model);
  const selectedMesh = useModelStore((state) => state.selectedMesh);
  const setSelectedMesh = useModelStore((state) => state.setSelectedMesh);
  const uvTexture = useCanvasStore((state) => state.uvTexture);
  const isPaintMode = usePaintStore((state) => state.isPaintMode);
  const addPaintedUVCoord = usePaintStore((state) => state.addPaintedUVCoord);
  const brushSize = usePaintStore((state) => state.brushSize);
  
  const [paintIndicator, setPaintIndicator] = useState<{ position: THREE.Vector3; normal: THREE.Vector3 } | null>(null);
  const isPaintingRef = useRef(false);

  // Apply texture to selected mesh
  if (selectedMesh && uvTexture && selectedMesh.material) {
    const material = selectedMesh.material as THREE.MeshStandardMaterial;
    if (material.map !== uvTexture) {
      material.map = uvTexture;
      material.needsUpdate = true;
    }
  }

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (isPaintMode && e.object === selectedMesh) {
      e.stopPropagation();
      isPaintingRef.current = true;
      handlePaint(e);
    }
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
    if (isPaintMode) {
      handlePaint(e as any);
    } else {
      e.stopPropagation();
      if (e.object instanceof THREE.Mesh) {
        setSelectedMesh(e.object);
      }
    }
  };

  return (
    <>
      <color attach="background" args={['#1a1a1a']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <directionalLight position={[-10, -10, -5]} intensity={0.3} />
      
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
      
      {/* Completely disable OrbitControls in paint mode */}
      <OrbitControls makeDefault enabled={!isPaintMode} />
      <Environment preset="studio" />
    </>
  );
}

export function ModelViewer() {
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [3, 3, 3], fov: 50 }}>
        <Scene />
      </Canvas>
    </div>
  );
}
