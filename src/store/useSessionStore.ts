import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
}

export interface SessionMetadata {
  id: string;
  name: string;
  lastModified: number;
  thumbnail?: string; // Data URL
  modelName?: string;
  cameraState?: CameraState;
}

interface SessionState {
  sessions: SessionMetadata[];
  currentSessionId: string | null;
  isSidebarOpen: boolean;
  
  addSession: (session: SessionMetadata) => void;
  updateSession: (id: string, updates: Partial<SessionMetadata>) => void;
  removeSession: (id: string) => void;
  setCurrentSessionId: (id: string | null) => void;
  setSidebarOpen: (isOpen: boolean) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      sessions: [],
      currentSessionId: null,
      isSidebarOpen: false,

      addSession: (session) =>
        set((state) => ({ sessions: [session, ...state.sessions] })),
      
      updateSession: (id, updates) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        })),

      removeSession: (id) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          currentSessionId: state.currentSessionId === id ? null : state.currentSessionId,
        })),

      setCurrentSessionId: (id) => set({ currentSessionId: id }),
      setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
    }),
    {
      name: 'uv-annotator-sessions',
      partialize: (state) => ({
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
      }),
    }
  )
);
