import './index.css';
import { ModelViewer } from './components/ModelViewer';
import { ModelUploader } from './components/ModelUploader';
import { MeshSelector } from './components/MeshSelector';
import { AnnotationEditor } from './components/AnnotationEditor';
import { AnnotationControls } from './components/AnnotationControls';
import { Toolbar } from './components/Toolbar';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Separator } from './components/ui/separator';

function App() {
  useKeyboardShortcuts();

  return (
    <div className="h-screen flex flex-col bg-background">
      <Toolbar />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - 3D Viewer */}
        <div className="w-3/5 flex flex-col border-r">
          <div className="flex-1">
            <ModelViewer />
          </div>
          
          <div className="p-4 space-y-4 border-t bg-card max-h-96 overflow-y-auto">
            <ModelUploader />
            <MeshSelector />
          </div>
        </div>

        {/* Right Panel - Annotation Editor */}
        <div className="w-2/5 flex flex-col">
          <div className="flex-1 overflow-auto">
            <AnnotationEditor />
          </div>
          
          <Separator />
          
          <div className="p-4 bg-card border-t max-h-96 overflow-y-auto">
            <AnnotationControls />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
