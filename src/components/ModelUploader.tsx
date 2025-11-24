import { useRef, useEffect, useState } from 'react';
import { GLTFLoader } from 'three-stdlib';
import * as THREE from 'three';
import { Upload } from 'lucide-react';
import { Button } from './ui/button';
import { useStore } from '../store/useStore';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export function ModelUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setModel = useStore((state) => state.setModel);
  const setMeshes = useStore((state) => state.setMeshes);
  const model = useStore((state) => state.model);
  const [modelUrl, setModelUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setModelUrl(url);
  };

  // Load the model when URL changes
  useEffect(() => {
    if (!modelUrl) return;

    const loadModel = async () => {
      try {
        const loader = new GLTFLoader();
        loader.load(
          modelUrl,
          (gltf) => {
            const meshes: THREE.Mesh[] = [];
            gltf.scene.traverse((child: THREE.Object3D) => {
              if (child instanceof THREE.Mesh) {
                meshes.push(child);
              }
            });

            setModel(gltf.scene);
            setMeshes(meshes);
          },
          undefined,
          (error) => {
            console.error('Error loading model:', error);
            alert('Failed to load model. Please ensure it\'s a valid GLTF/GLB file.');
          }
        );
      } catch (error) {
        console.error('Error loading model:', error);
        alert('Failed to load model. Please ensure it\'s a valid GLTF/GLB file.');
      }
    };

    loadModel();

    return () => {
      if (modelUrl) URL.revokeObjectURL(modelUrl);
    };
  }, [modelUrl, setModel, setMeshes]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Model Upload</CardTitle>
      </CardHeader>
      <CardContent>
        <input
          ref={fileInputRef}
          type="file"
          accept=".gltf,.glb"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          className="w-full"
          variant={model ? "outline" : "default"}
        >
          <Upload className="mr-2 h-4 w-4" />
          {model ? 'Change Model' : 'Upload Model'}
        </Button>
        {model && (
          <p className="text-sm text-muted-foreground mt-2">
            Model loaded successfully
          </p>
        )}
      </CardContent>
    </Card>
  );
}
