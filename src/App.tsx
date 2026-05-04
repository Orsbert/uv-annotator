import { useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Toolbar } from './components/Toolbar';
import { ModelViewer } from './components/ModelViewer';
import { AnnotationEditor } from './components/AnnotationEditor';
import { MeshSelector } from './components/MeshSelector';
import { AnnotationControls } from './components/AnnotationControls';
import { SessionSidebar } from './components/SessionSidebar';
import { AnnotationOutliner } from './components/layout/AnnotationOutliner';
import { PropertiesPanel } from './components/layout/PropertiesPanel';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { createNewSession, loadSession, saveCurrentSession } from './services/sessionManager';
import { useSessionStore } from './store/useSessionStore';

function App() {
  useKeyboardShortcuts();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const sessions = useSessionStore((state) => state.sessions);

  // Initialize session on mount — Zustand persist already rehydrates store state,
  // so we only need to call loadSession when picking a different session or creating one.
  useEffect(() => {
    const initializeSession = async () => {
      if (currentSessionId) {
        // Zustand persist already rehydrated all stores — nothing to reload
      } else if (sessions.length > 0) {
        const mostRecent = sessions.sort((a, b) => b.lastModified - a.lastModified)[0];
        await loadSession(mostRecent.id);
      } else {
        await createNewSession();
      }
    };
    initializeSession();
  }, []); // Only run once on mount

  // Auto-save current session before page unload
  useEffect(() => {
    const handleBeforeUnload = () => { saveCurrentSession(); };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Periodic auto-save every 30s as a safety net
  useEffect(() => {
    const interval = setInterval(() => { saveCurrentSession(); }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full w-full flex flex-col bg-background overflow-hidden">
      <Toolbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <SessionSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <PanelGroup direction="horizontal" className="flex-1" autoSaveId="uv-annotator-layout">
        {/* Left Sidebar - Annotation Outliner */}
        <Panel defaultSize={20} minSize={15} maxSize={30} collapsible>
          <AnnotationOutliner />
        </Panel>

        <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />

        {/* Main Content Area */}
        <Panel defaultSize={55} minSize={30}>
          <PanelGroup direction="vertical">
            {/* UV Editor */}
            <Panel defaultSize={70} minSize={40}>
              <AnnotationEditor />
            </Panel>

            <PanelResizeHandle className="h-1 bg-border hover:bg-primary/50 transition-colors" />

            {/* 3D Preview */}
            <Panel defaultSize={30} minSize={20} collapsible>
              <div className="h-full flex items-center justify-center bg-muted/30 border-t">
                <ModelViewer />
              </div>
            </Panel>
          </PanelGroup>
        </Panel>

        <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />

        {/* Right Sidebar - Properties */}
        <Panel defaultSize={25} minSize={20} maxSize={35} collapsible>
          <PropertiesPanel />
        </Panel>
      </PanelGroup>

      {/* Legacy components (hidden for now, to be integrated) */}
      <div className="hidden">
        <MeshSelector />
        <AnnotationControls />
      </div>
    </div>
  );
}

export default App;
