# src/lib/ar — WS-D AR Viewer

WebXR session, image tracking, pose fusion, occlusion, labels.

- `pose.ts` — marker poses in the mat frame, multi-marker fusion → `worldFromMat`,
  smoothing/re-snap filter, `worldFromModel = worldFromMat ∘ calibration ∘ objectToMat`

Runtime unit: **metres**. See docs/ARCHITECTURE.md §2 and §5.
Task D0 (device spike) must confirm the tracked-image pose convention before D1+.
