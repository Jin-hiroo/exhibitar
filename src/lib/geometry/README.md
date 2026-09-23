# src/lib/geometry — WS-A Geometry

Framework-free STL → frozen model pipeline. Runs inside `src/workers/geometry.worker.ts`.

- `parse-stl.ts` — binary/ASCII STL → `IndexedMesh` (merged vertices), warnings
- `units.ts` — unit/scale factor, bounds in mm, dimension formatting
- `orient.ts` — resting-face candidates (convex hull + stability), `applyOrientation` → `objectToMat`
- `simplify.ts`, `glb.ts` — meshoptimizer simplification, lossless meshopt GLB encode/decode, freeze
- `footprint.ts` — contact + shadow outlines in mat mm (clipper2)

Internal unit: **millimetres**. Outputs that cross into the runtime (`objectToMat`,
GLB) are converted to metres via `src/lib/units.ts`.
