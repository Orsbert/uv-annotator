// src/services/annotationMigration.ts
//
// Detects annotations that were authored before the per-mesh UV-frame fix and
// may therefore be mispositioned on meshes whose UVs fall outside 0-1. See
// utils/uvGenerator.ts (computeUVFrame) and memory/uv-frame-normalization.

import * as THREE from 'three';
import type { Annotation } from '../types';
import { computeUVFrame, uvToFrameCanvas, type UVFrame } from '../utils/uvGenerator';
import { meshKeyOf } from '../store/combinedStores';

/** Pre-fix annotations were authored against the identity frame (raw u*canvasSize). */
const IDENTITY_FRAME: UVFrame = { minU: 0, minV: 0, spanU: 1, spanV: 1 };

/**
 * A reframe that scales a box by more than this factor is "major": the old
 * editor view was too distorted to trust the drawn position, so the user should
 * reposition manually rather than have us keep it on its (wrong) original spot.
 */
export const MAJOR_SPAN = 2;

export function isIdentityFrame(f: UVFrame): boolean {
  return f.minU === 0 && f.minV === 0 && f.spanU === 1 && f.spanV === 1;
}

function framesEqual(a: UVFrame, b: UVFrame): boolean {
  return a.minU === b.minU && a.minV === b.minV && a.spanU === b.spanU && a.spanV === b.spanV;
}

export interface StaleGroup {
  meshKey: string;
  meshName: string;
  frame: UVFrame;
  /** Major reframe → recommend manual review instead of auto-reposition. */
  severe: boolean;
  annotations: Annotation[];
}

/**
 * Find annotations that predate the UV-frame fix on out-of-range meshes.
 * Meshes whose UVs already fit [0,1] have an identity frame and are never
 * flagged, so models that always worked produce zero results.
 */
export function findStaleAnnotations(
  meshes: THREE.Mesh[],
  annotationsByMesh: Record<string, Annotation[]>,
): StaleGroup[] {
  const groups: StaleGroup[] = [];
  for (const mesh of meshes) {
    const frame = computeUVFrame(mesh);
    if (isIdentityFrame(frame)) continue; // working model → nothing to migrate
    const key = meshKeyOf(mesh);
    const stale = (annotationsByMesh[key] ?? []).filter(
      (a) => !a.authoredFrame || !framesEqual(a.authoredFrame, frame),
    );
    if (stale.length === 0) continue;
    groups.push({
      meshKey: key,
      meshName: mesh.name || key,
      frame,
      severe: frame.spanU > MAJOR_SPAN || frame.spanV > MAJOR_SPAN,
      annotations: stale,
    });
  }
  return groups;
}

/**
 * Reposition a pre-fix annotation so it keeps the same surface location under
 * the new frame ("Migration A"). The box is defined in canvas pixels against the
 * old (identity) frame; we recover its UV rect, then re-project it into the new
 * frame's canvas. Returns the box patch plus the current frame stamp.
 *
 * Note: for a severe reframe this faithfully shrinks the box (same spot = tiny),
 * which is why severe groups are surfaced for manual review instead.
 */
export function migrateAnnotation(
  a: Annotation,
  newFrame: UVFrame,
  canvasSize: number,
  oldFrame: UVFrame = IDENTITY_FRAME,
): Partial<Annotation> {
  const uMin = oldFrame.minU + (a.x / canvasSize) * oldFrame.spanU;
  const vMin = oldFrame.minV + (a.y / canvasSize) * oldFrame.spanV;
  const uMax = oldFrame.minU + ((a.x + a.width) / canvasSize) * oldFrame.spanU;
  const vMax = oldFrame.minV + ((a.y + a.height) / canvasSize) * oldFrame.spanV;
  const tl = uvToFrameCanvas(uMin, vMin, newFrame, canvasSize);
  const br = uvToFrameCanvas(uMax, vMax, newFrame, canvasSize);
  return {
    x: tl.x,
    y: tl.y,
    width: br.x - tl.x,
    height: br.y - tl.y,
    authoredFrame: newFrame,
  };
}
