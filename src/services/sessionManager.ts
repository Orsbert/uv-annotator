import { get, set, del } from 'idb-keyval';
import { useModelStore, useAnnotationStore, useCanvasStore, usePaintStore, useOverlayStore } from '../store/combinedStores';
import { useSessionStore, SessionMetadata } from '../store/useSessionStore';

export const saveCurrentSession = async () => {
  const currentSessionId = useSessionStore.getState().currentSessionId;
  if (!currentSessionId) return;

  const modelState = useModelStore.getState();
  const annotationState = useAnnotationStore.getState();
  const canvasState = useCanvasStore.getState();
  const paintState = usePaintStore.getState();

  // Don't save if stores appear unhydrated (avoid overwriting good data with empty state)
  const hasAnnotations = Object.values(annotationState.annotationsByMesh).some((arr) => arr.length > 0);
  const hasBackgrounds = Object.keys(canvasState.backgroundsByMesh).length > 0;
  if (!modelState.modelBuffer && !hasAnnotations && !hasBackgrounds) {
    return;
  }

  await set(`session-${currentSessionId}-model`, {
    modelBuffer: modelState.modelBuffer,
    modelName: modelState.modelName,
    selectedMeshName: modelState.selectedMeshName,
  });
  await set(`session-${currentSessionId}-annotations`, {
    annotationsByMesh: annotationState.annotationsByMesh,
  });
  await set(`session-${currentSessionId}-canvas`, {
    canvasSize: canvasState.canvasSize,
    showWireframe: canvasState.showWireframe,
    backgroundsByMesh: canvasState.backgroundsByMesh,
  });
  await set(`session-${currentSessionId}-paint`, {
    isPaintMode: paintState.isPaintMode,
    brushSize: paintState.brushSize,
    paintedUVCoords: paintState.paintedUVCoords,
  });

  const overlayState = useOverlayStore.getState();
  await set(`session-${currentSessionId}-overlay`, {
    overlays: overlayState.overlays.map(({ image, ...rest }) => rest),
  });

  useSessionStore.getState().updateSession(currentSessionId, {
    lastModified: Date.now(),
    modelName: modelState.modelName || 'Untitled Model',
  });
};

export const loadSession = async (sessionId: string) => {
  await saveCurrentSession();

  const modelData = await get<any>(`session-${sessionId}-model`);
  const annotationData = await get<any>(`session-${sessionId}-annotations`);
  const canvasData = await get<any>(`session-${sessionId}-canvas`);
  const paintData = await get<any>(`session-${sessionId}-paint`);
  const overlayData = await get<any>(`session-${sessionId}-overlay`);

  const { setModelBuffer, loadModelFromBuffer, setModel } = useModelStore.getState();
  const { setPaintMode, setBrushSize, clearPaintedUVCoords } = usePaintStore.getState();

  // Restore Model
  if (modelData && modelData.modelBuffer) {
    useModelStore.setState({
      modelBuffer: modelData.modelBuffer,
      modelName: modelData.modelName,
      selectedMeshName: modelData.selectedMeshName,
    });
    await loadModelFromBuffer();
  } else {
    setModel(null);
    setModelBuffer(null, null);
    useModelStore.setState({ selectedMeshName: null });
  }

  // Restore Annotations (per-mesh)
  useAnnotationStore.setState({
    annotationsByMesh: annotationData?.annotationsByMesh ?? {},
    selectedAnnotationId: null,
    pendingLabelEdit: null,
  });

  // Restore Canvas (per-mesh backgrounds + global size/wireframe)
  useCanvasStore.setState({
    canvasSize: canvasData?.canvasSize ?? 1024,
    showWireframe: canvasData?.showWireframe ?? true,
    backgroundsByMesh: canvasData?.backgroundsByMesh ?? {},
    backgroundImagesByMesh: {},
    canvasByMesh: {},
    textureByMesh: {},
  });
  await useCanvasStore.getState().restoreBackgrounds();

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

  // Restore Overlays
  if (overlayData && overlayData.overlays && overlayData.overlays.length > 0) {
    useOverlayStore.setState({
      overlays: overlayData.overlays.map((o: any) => ({ ...o, rotation: o.rotation ?? 0, image: null })),
      selectedOverlayId: null,
    });
    await useOverlayStore.getState().restoreOverlays();
  } else {
    useOverlayStore.getState().removeAllOverlays();
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
    modelName: 'No Model',
  };

  useSessionStore.getState().addSession(newSession);
  useSessionStore.getState().setCurrentSessionId(newId);

  // Clear active stores
  useModelStore.getState().setModel(null);
  useModelStore.getState().setModelBuffer(null, null);
  useModelStore.setState({ selectedMeshName: null });
  useAnnotationStore.setState({
    annotationsByMesh: {},
    selectedAnnotationId: null,
    pendingLabelEdit: null,
  });
  useCanvasStore.setState({
    canvasSize: 1024,
    showWireframe: true,
    backgroundsByMesh: {},
    backgroundImagesByMesh: {},
    canvasByMesh: {},
    textureByMesh: {},
  });
  usePaintStore.getState().setPaintMode(false);
  usePaintStore.getState().clearPaintedUVCoords();
  useOverlayStore.getState().removeAllOverlays();

  return newId;
};

export const deleteSession = async (sessionId: string) => {
  await del(`session-${sessionId}-model`);
  await del(`session-${sessionId}-annotations`);
  await del(`session-${sessionId}-canvas`);
  await del(`session-${sessionId}-paint`);
  await del(`session-${sessionId}-overlay`);
  useSessionStore.getState().removeSession(sessionId);

  if (useSessionStore.getState().currentSessionId === sessionId) {
    const sessions = useSessionStore.getState().sessions;
    if (sessions.length > 0) {
      await loadSession(sessions[0].id);
    } else {
      await createNewSession();
    }
  }
};
