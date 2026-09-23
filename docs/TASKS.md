# TASKS

Work is split into workstreams that can run in **parallel Claude Code
sessions or subagents** once WS-0 is done. Each workstream owns directories
(ARCHITECTURE.md §8). Stay inside them; use `src/lib/types.ts` + stubs for
cross-workstream dependencies.

## Order

```text
WS-0 Foundation ──┬──▶ WS-A Geometry ──┐
                  ├──▶ WS-B Mat/Markers ├──▶ WS-F Studio integration ──▶ M2
                  ├──▶ WS-C Annotations ┘
                  ├──▶ WS-D AR Viewer  (D0 spike FIRST — highest risk)  ──▶ M3
                  └──▶ WS-E Backend/Auth
```

Start **D0 on day one**, in parallel with WS-0 if possible: its result may
change the viewer design.

---

## WS-0 Foundation (sequential, do first)

- [x] Next.js App Router + TS strict + pnpm + ESLint/Prettier + Vitest + Playwright
- [x] `src/lib/types.ts` exactly as in ARCHITECTURE.md §3; `src/lib/units.ts`
- [x] Directory skeleton (§8) with README stubs per folder
- [x] Test fixture generator: `tests/fixtures/make.ts` writes cube, L-block,
      tripod (3 small feet), sphere-on-flat STLs (binary + ASCII)
- [x] Vercel project + preview deploys; HTTPS local dev documented
- [x] Mock project JSON in `tests/fixtures/project.mock.json` for WS-C/D/F to build against

**Done when:** `pnpm lint typecheck test` pass, empty pages render on Vercel preview.

## WS-A Geometry (`src/lib/geometry`, `src/workers`)

- [x] A1 STL parse (binary/ASCII) → indexed BufferGeometry; merge verts; normals
- [x] A2 Unit/scale handling; bounds in mm
- [x] A3 Resting-face candidates (convex hull + stability); apply chosen orientation;
      drop to y=0; centre footprint → returns `objectToMat`
- [x] A4 Simplify with meshoptimizer to target; export GLB (meshopt compression); size check
- [x] A5 Contact outline + shadow outline (clipper2) in mat mm
- [x] A6 Worker wrappers with progress events + cancellation

**Tests:** cube → contact = square of side length; tripod → 3 contact islands;
orientation of L-block picks the large face; GLB under budget.

## WS-B Mat & Markers (`src/lib/mat`)

- [ ] B1 Seeded marker generator → SVG fragment + PNG; quality check (corners, asymmetry)
- [ ] B2 Layout: markers in free space around shadow, QR, ruler, FRONT arrow, title
- [ ] B3 Paper selection + tiling with alignment marks
- [ ] B4 SVG writer in mm units; PDF export (actual size); print instructions text
- [ ] B5 QR generation for `/v/[id]`

**Tests:** markers never overlap shadow polygon; SVG physical size equals
computed mat size; same seed → identical output.

## WS-C Annotations (`src/lib/annotations`, `src/components/studio/annotate`)

- [ ] C1 Point picking on mesh (raycast, BVH via three-mesh-bvh) → position + normal
- [ ] C2 Region brush painting on the simplified mesh → triangle index set
- [ ] C3 Annotation list: edit title/body/image/link, reorder (tour order), delete
- [ ] C4 Label rendering shared with viewer (back-face fade, occlusion) — coordinate with WS-D,
      put the shared renderer in `src/lib/ar/labels.ts` owned by WS-D

**Tests:** painted triangle indices round-trip through GLB save/load unchanged.

## WS-D AR Viewer (`src/lib/ar`, `src/components/viewer`, `/v/[id]`)

- [ ] **D0 Spike (first):** minimal page tracking one printed image target.
      Verify on (a) Android Chrome WebXR `image-tracking` (flag needed?),
      (b) iPhone via Needle Go App Clip with plain three.js. Record findings in
      `docs/D0-FINDINGS.md`. If either fails, evaluate the open-source 8th Wall
      engine image targets as fallback and propose a decision.
- [ ] D1 Session setup, dom-overlay UI, capability detection, non-AR fallback viewer
- [ ] D2 Multi-marker pose fusion → `worldFromMat`; smoothing; loss/re-snap
- [ ] D3 Occluder GLB; labels; region highlights; tap selection
- [ ] D4 Guided tour + off-screen arrow
- [ ] D5 Calibration mode UI (ghost, nudge controls, save)

**Tests:** pose-fusion math unit tests with synthetic marker poses;
manual device test checklist in `docs/DEVICE-TESTS.md`.

## WS-E Backend & Auth (`src/lib/db`, `src/app/api`, `supabase/`)

- [ ] E1 Supabase project, auth (email magic link), env vars on Vercel
- [ ] E2 `projects` table + RLS + public view for published projects
- [ ] E3 Storage buckets + signed upload route; public read for published assets
- [ ] E4 CRUD routes / server actions; `geometryVersion` bump logic
- [ ] E5 Simple view counter (optional)

## WS-F Studio integration (`src/app/studio`, `src/components/studio`)

Depends on A, B, C, E (can start with mocks).

- [ ] F1 Upload → units → orientation wizard
- [ ] F2 Mat tab: preview SVG, regenerate, download
- [ ] F3 Annotate tab (embeds WS-C)
- [ ] F4 Preview tab: object on virtual mat with labels
- [ ] F5 Publish: upload assets, show URL + QR + print checklist;
      warn when geometry changes invalidate a printed mat

---

## Milestones

- **M1** D0 findings + WS-0 done.
- **M2** Studio end-to-end: STL → mat PDF → published project (no AR yet).
- **M3** Viewer: printed mat + printed object → labels registered on phone.
- **M4** Calibration, guided tour, fallback viewer, polish, device test pass.
