# src/lib/mat — WS-B Mat & Markers

Framework-free placement-mat generation. Runs inside `src/workers/mat.worker.ts`.

- `generate.ts` — `generateMat(input)`: layout → drawing → SVG/PDF/QR + `Project.mat` metadata
  (the tags are data: IDs and positions, no images)
- `layout.ts`, `paper.ts` — matar tag rings (`layoutBorderTags`), QR/ruler/arrow/title placement,
  paper choice, tiling (tags on a seam are dropped)
- `tag-cells.ts` — a tag's black cells as rectangles (also used by the 3D preview)
- `display-list.ts`, `drawing.ts`, `svg.ts`, `pdf.ts` — one list of mm primitives, two backends
- `raster.ts`, `raster-drawing.ts`, `png.ts` — grayscale rendering (the QR PNG; tests render the
  mat and check that matar finds every tag)
- `qr.ts`, `instructions.ts`

Units: **millimetres**, in the mat XZ plane. SVG x = mat X + origin, SVG y = mat Z + origin
(FRONT is the bottom edge of the page); the mat frame is matar's board frame. Tag IDs are
picked by matar's `pickTagIds` from project id + geometryVersion.
