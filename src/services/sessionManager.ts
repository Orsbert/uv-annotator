import { get, set, del } from 'idb-keyval';
import { useModelStore, useAnnotationStore, useCanvasStore, usePaintStore } from '../store/combinedStores';
import { useSessionStore, SessionMetadata } from '../store/useSessionStore';

export const saveCurrentSession = async () => {
  const currentSessionId = useSessionStore.getState().currentSessionId;
  if (!currentSessionId) return;

  const modelState = useModelStore.getState();
  const annotationState = useAnnotationStore.getState();
  const canvasState = useCanvasStore.getState();
  const paintState = usePaintStore.getState();
  
  // Save to IDB with session ID prefix
  await set(`session-${currentSessionId}-model`, {
      modelBuffer: modelState.modelBuffer,
      modelName: modelState.modelName,
      selectedMeshName: modelState.selectedMeshName
  });
  await set(`session-${currentSessionId}-annotations`, { annotations: annotationState.annotations });
  await set(`session-${currentSessionId}-canvas`, { uvImageData: canvasState.uvImageData });
  await set(`session-${currentSessionId}-paint`, {
      isPaintMode: paintState.isPaintMode,
      brushSize: paintState.brushSize,
      paintedUVCoords: paintState.paintedUVCoords
  });
  
  // Update metadata
  useSessionStore.getState().updateSession(currentSessionId, {
      lastModified: Date.now(),
      modelName: modelState.modelName || 'Untitled Model'
  });
};

export const loadSession = async (sessionId: string) => {
    // 1. Save current session first (if any)
    await saveCurrentSession();

    // 2. Load data for new session
    const modelData = await get<any>(`session-${sessionId}-model`);
    const annotationData = await get<any>(`session-${sessionId}-annotations`);
    const canvasData = await get<any>(`session-${sessionId}-canvas`);
    const paintData = await get<any>(`session-${sessionId}-paint`);
    
    // 3. Update stores
    const { setModelBuffer, loadModelFromBuffer, setModel } = useModelStore.getState();
    const { clearAnnotations, addAnnotation } = useAnnotationStore.getState();
    const { setUVCanvas, setUVTexture, restoreCanvas } = useCanvasStore.getState();
    const { setPaintMode, setBrushSize, clearPaintedUVCoords } = usePaintStore.getState();
    
    // Restore Model
    if (modelData && modelData.modelBuffer) {
        // We need to set the buffer AND the selectedMeshName
        // But setModelBuffer only takes buffer and name.
        // We need to manually set selectedMeshName in the store state if we want loadModelFromBuffer to pick it up.
        // But loadModelFromBuffer reads from get().selectedMeshName.
        // So we need an action to set it? Or just rely on persist rehydration?
        // Wait, we are manually setting state here, bypassing persist rehydration for the *active* store.
        // So we need to set the state in the store.
        
        // Let's update useModelStore to allow setting selectedMeshName directly or just use setState logic?
        // Zustand's setState is not exposed here.
        // We can use useModelStore.setState({ selectedMeshName: ... })
        
        useModelStore.setState({ 
            modelBuffer: modelData.modelBuffer, 
            modelName: modelData.modelName,
            selectedMeshName: modelData.selectedMeshName 
        });
        await loadModelFromBuffer();
    } else {
        setModel(null);
        setModelBuffer(null, null);
        useModelStore.setState({ selectedMeshName: null });
    }
    
    // Restore Annotations
    clearAnnotations();
    if (annotationData && annotationData.annotations) {
        annotationData.annotations.forEach((ann: any) => addAnnotation(ann));
    }
    
    // Restore Canvas
    if (canvasData && canvasData.uvImageData) {
        useCanvasStore.setState({ uvImageData: canvasData.uvImageData });
        await restoreCanvas();
    } else {
        setUVCanvas(null);
        setUVTexture(null);
        useCanvasStore.setState({ uvImageData: null });
    }

    // Restore Paint
    if (paintData) {
        setPaintMode(paintData.isPaintMode);
        setBrushSize(paintData.brushSize);
        usePaintStore.setState({ paintedUVCoords: paintData.paintedUVCoords || [] });
    } else {
        setPaintMode(false);
        setBrushSize(20);
        clearPaintedUVCoords();
    }
    
    useSessionStore.getState().setCurrentSessionId(sessionId);
};

export const createNewSession = async () => {
    await saveCurrentSession();
    
    const newId = crypto.randomUUID();
    const newSession: SessionMetadata = {
        id: newId,
        name: 'Untitled Session',
        lastModified: Date.now(),
        modelName: 'No Model'
    };
    
    useSessionStore.getState().addSession(newSession);
    useSessionStore.getState().setCurrentSessionId(newId);
    
    // Clear active stores
    // Clear active stores
    useModelStore.getState().setModel(null);
    useModelStore.getState().setModelBuffer(null, null);
    useModelStore.setState({ selectedMeshName: null });
    useAnnotationStore.getState().clearAnnotations();
    useCanvasStore.getState().setUVCanvas(null);
    useCanvasStore.getState().setUVTexture(null);
    useCanvasStore.setState({ uvImageData: null });
    usePaintStore.getState().setPaintMode(false);
    usePaintStore.getState().clearPaintedUVCoords();
    
    return newId;
};

export const deleteSession = async (sessionId: string) => {
    await del(`session-${sessionId}-model`);
    await del(`session-${sessionId}-annotations`);
    await del(`session-${sessionId}-canvas`);
    await del(`session-${sessionId}-paint`);
    useSessionStore.getState().removeSession(sessionId);
    
    // If we deleted the current session, switch to another one
    if (useSessionStore.getState().currentSessionId === sessionId) {
        const sessions = useSessionStore.getState().sessions;
        if (sessions.length > 0) {
            await loadSession(sessions[0].id);
        } else {
            await createNewSession();
        }
    }
};
