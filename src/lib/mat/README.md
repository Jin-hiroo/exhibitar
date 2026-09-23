# src/lib/mat — WS-B Mat & Markers

Framework-free placement-mat generation. Runs inside `src/workers/mat.worker.ts`.

- `prng.ts`, `raster.ts`, `png.ts`, `markers.ts` — seeded marker art → SVG fragment + PNG, quality check
- `layout.ts`, `paper.ts` — marker/QR/ruler/arrow placement, paper choice, tiling
- `display-list.ts`, `svg.ts`, `pdf.ts` — one list of mm primitives, two backends
- `qr.ts`, `instructions.ts`

Units: **millimetres**, in the mat XZ plane. SVG x = mat X + offset, SVG y = mat Z + offset
(FRONT is the bottom edge of the page).
