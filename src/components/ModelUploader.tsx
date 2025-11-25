import { useRef } from 'react';
import { Upload } from 'lucide-react';
import { Button } from './ui/button';
import { useModelStore } from '../store/combinedStores';
import { useSessionStore } from '../store/useSessionStore';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export function ModelUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setModelBuffer = useModelStore((state) => state.setModelBuffer);
  const loadModelFromBuffer = useModelStore((state) => state.loadModelFromBuffer);
  const model = useModelStore((state) => state.model);
  const modelName = useModelStore((state) => state.modelName);
  const updateSession = useSessionStore((state) => state.updateSession);
  const currentSessionId = useSessionStore((state) => state.currentSessionId);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      setModelBuffer(buffer, file.name);
      await loadModelFromBuffer();
      
      if (currentSessionId) {
        updateSession(currentSessionId, { name: file.name, modelName: file.name });
      }
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Failed to read file.');
    }
  };

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
          {model ? `Change Model (${modelName})` : 'Upload Model'}
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
