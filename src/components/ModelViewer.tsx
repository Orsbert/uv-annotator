import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import { useStore } from '../store/useStore';
import * as THREE from 'three';

function Scene() {
  const model = useStore((state) => state.model);
  const selectedMesh = useStore((state) => state.selectedMesh);
  const uvTexture = useStore((state) => state.uvTexture);
  const setSelectedMesh = useStore((state) => state.setSelectedMesh);

  // Apply texture to selected mesh
  if (selectedMesh && uvTexture && selectedMesh.material) {
    const material = selectedMesh.material as THREE.MeshStandardMaterial;
    if (material.map !== uvTexture) {
      material.map = uvTexture;
      material.needsUpdate = true;
    }
  }

  const handleMeshClick = (mesh: THREE.Mesh) => {
    setSelectedMesh(mesh);
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
          onClick={(e: any) => {
            e.stopPropagation();
            if (e.object instanceof THREE.Mesh) {
              handleMeshClick(e.object);
            }
          }}
        />
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
      
      <OrbitControls makeDefault />
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
