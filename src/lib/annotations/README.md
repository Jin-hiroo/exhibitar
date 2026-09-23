# src/lib/annotations — WS-C Annotations

Point picking (three-mesh-bvh raycast → position + normal), region brush painting
(triangle index sets into the stored GLB), serialization.

Depends on: `Annotation` in `src/lib/types.ts`; the frozen GLB from WS-A
(`tests/fixtures/project.mock.json` + `public/fixtures/` until then).
Shared label renderer lives in `src/lib/ar/labels.ts` (owned by WS-D).
