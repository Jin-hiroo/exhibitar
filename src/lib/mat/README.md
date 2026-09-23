# src/lib/mat — WS-B Mat & Markers

Framework-free placement-mat generation. Runs inside `src/workers/mat.worker.ts`.

- `generate.ts` — `generateMat(input)`: layout → markers → drawing → SVG/PDF/PNGs/QR + `Project.mat` metadata
- `prng.ts`, `raster.ts`, `png.ts`, `markers.ts`, `quality.ts` — seeded marker art → SVG shapes +
  PNG, corner/asymmetry/distinctness checks
- `layout.ts`, `paper.ts` — marker/QR/ruler/arrow/title placement, paper choice, tiling
- `display-list.ts`, `drawing.ts`, `svg.ts`, `pdf.ts` — one list of mm primitives, two backends
- `qr.ts`, `instructions.ts`

Units: **millimetres**, in the mat XZ plane. SVG x = mat X + origin, SVG y = mat Z + origin
(FRONT is the bottom edge of the page). Marker seeds derive from project id + geometryVersion.
