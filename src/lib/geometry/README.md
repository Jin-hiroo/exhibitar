# src/lib/geometry — WS-A Geometry

Framework-free STL → frozen model pipeline. Runs inside `src/workers/geometry.worker.ts`.

- `pipeline.ts` — `loadModel` (parse → scale → resting candidates) and
  `prepareModel` (orient → freeze GLB → footprint); what the worker calls
- `parse-stl.ts` — binary/ASCII STL → `IndexedMesh` (merged vertices), stats, warnings
- `scale.ts` — unit/scale factor (`sourceScale`), bounds in mm, dimension label
- `orient.ts` — resting-face candidates (convex hull + stability), `applyOrientation` → `objectToMat`
- `contact.ts` — which triangles touch the table (shared by orient + footprint)
- `simplify.ts`, `glb.ts` — meshoptimizer simplification; lossless meshopt GLB encode/decode; `freezeModel`
- `footprint.ts` — contact + shadow outlines in mat mm
- `polygons.ts` — mm polygon ops on Clipper2 (also used by WS-B)
- `mesh.ts`, `three.ts` — `IndexedMesh` helpers and the `BufferGeometry` adapter

Internal unit: **millimetres**. Outputs that cross into the runtime (`objectToMat`,
GLB) are converted to metres via `src/lib/units.ts`. The frozen GLB keeps
triangle order exactly (no quantize/reorder): region annotations index it.
