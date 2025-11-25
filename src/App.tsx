import './index.css';
import { ModelViewer } from './components/ModelViewer';
import { ModelUploader } from './components/ModelUploader';
import { MeshSelector } from './components/MeshSelector';
import { AnnotationEditor } from './components/AnnotationEditor';
import { AnnotationControls } from './components/AnnotationControls';
import { Toolbar } from './components/Toolbar';
import { SessionSidebar } from './components/SessionSidebar';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Separator } from './components/ui/separator';
import { useEffect } from 'react';
import { useSessionStore } from './store/useSessionStore';
import { createNewSession, loadSession } from './services/sessionManager';

function App() {
  useKeyboardShortcuts();
  
  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const sessions = useSessionStore((state) => state.sessions);

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      if (currentSessionId) {
        // Ensure data is loaded for the current session ID
        // This handles page reloads where zustand/persist restores the ID
        // but we might need to ensure the model buffer is loaded (which useModelStore handles)
        // However, if we are switching between sessions, we need to ensure the *correct* data is in the stores.
        // Since we are using a single "Active" store that is persisted, and "Archive" stores in IDB,
        // we just need to make sure we don't accidentally overwrite the active store with empty data if it's already there.
        // Actually, loadSession handles the swap.
        // But on *refresh*, the active store is already hydrated by persist middleware.
        // So we don't need to do anything!
        
        // EXCEPT if the user cleared storage or something weird happened.
        // But let's assume standard behavior.
      } else {
        // No session selected.
        if (sessions.length > 0) {
          // Load the most recent one
          const mostRecent = [...sessions].sort((a, b) => b.lastModified - a.lastModified)[0];
          await loadSession(mostRecent.id);
        } else {
          // Create new default session
          await createNewSession();
        }
      }
    };
    
    initSession();
  }, []); // Run once on mount

  return (
    <div className="h-screen flex flex-col bg-background relative overflow-hidden">
      <SessionSidebar />
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
