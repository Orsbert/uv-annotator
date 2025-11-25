import { Plus, Trash2, X, FolderOpen, Image as ImageIcon } from 'lucide-react';
import { useSessionStore } from '../store/useSessionStore';
import { createNewSession, loadSession, deleteSession } from '../services/sessionManager';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

export function SessionSidebar() {
  const sessions = useSessionStore((state) => state.sessions);
  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const isSidebarOpen = useSessionStore((state) => state.isSidebarOpen);
  const setSidebarOpen = useSessionStore((state) => state.setSidebarOpen);
  const updateSession = useSessionStore((state) => state.updateSession);

  // Close sidebar when clicking outside (optional, for now just X button)
  
  const handleCreateSession = async () => {
    await createNewSession();
    // Sidebar stays open
  };

  const handleLoadSession = async (id: string) => {
    if (id === currentSessionId) return;
    await loadSession(id);
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this session?')) {
      await deleteSession(id);
    }
  };

  const handleRename = (id: string, newName: string) => {
    updateSession(id, { name: newName });
  };

  return (
    <>
      {/* Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed top-0 left-0 h-full w-80 bg-background border-r shadow-xl z-50 transition-transform duration-300 ease-in-out transform",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-4 border-b flex items-center justify-between bg-muted/30">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Projects
          </h2>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4">
          <Button onClick={handleCreateSession} className="w-full mb-4">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>

          <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-180px)]">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => handleLoadSession(session.id)}
                className={cn(
                  "group relative p-3 rounded-lg border cursor-pointer transition-all hover:border-primary",
                  currentSessionId === session.id ? "bg-accent border-primary" : "bg-card hover:bg-accent/50"
                )}
              >
                <div className="flex gap-3">
                  {/* Thumbnail Placeholder */}
                  <div className="w-16 h-16 bg-muted rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {session.thumbnail ? (
                      <img src={session.thumbnail} alt={session.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-muted-foreground opacity-50" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={session.name}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleRename(session.id, e.target.value)}
                      className="bg-transparent font-medium text-sm w-full focus:outline-none focus:underline truncate"
                    />
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {session.modelName || 'No Model'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(session.lastModified).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleDeleteSession(e, session.id)}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}

            {sessions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No projects yet.</p>
                <p className="text-sm">Create one to get started!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
