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

- [x] B1 Seeded marker generator → SVG fragment + PNG; quality check (corners, asymmetry)
- [x] B2 Layout: markers in free space around shadow, QR, ruler, FRONT arrow, title
- [x] B3 Paper selection + tiling with alignment marks
- [x] B4 SVG writer in mm units; PDF export (actual size); print instructions text
- [x] B5 QR generation for `/v/[id]`

**Tests:** markers never overlap shadow polygon; SVG physical size equals
computed mat size; same seed → identical output.

## WS-C Annotations (`src/lib/annotations`, `src/components/studio/annotate`)

- [x] C1 Point picking on mesh (raycast, BVH via three-mesh-bvh) → position + normal
- [x] C2 Region brush painting on the simplified mesh → triangle index set
- [x] C3 Annotation list: edit title/body/image/link, reorder (tour order), delete _(images upload to `annotation-media` on save/publish)_
- [x] C4 Label rendering shared with viewer (back-face fade, occlusion) — coordinate with WS-D, _(src/lib/ar/labels.ts, used by Viewer, Preview and the annotate view)_
      put the shared renderer in `src/lib/ar/labels.ts` owned by WS-D
- [x] C5 Per-annotation label distance (`labelOffsetMm`, slider in the annotation panel; label moves live while dragging) _(placement in src/lib/ar/label-placement.ts)_

**Tests:** painted triangle indices round-trip through GLB save/load unchanged.

## WS-D AR Viewer (`src/lib/ar`, `src/components/viewer`, `/v/[id]`)

- [ ] **D0 Spike (first):** minimal page tracking one printed image target.
      Verify on (a) Android Chrome WebXR `image-tracking` (flag needed?),
      (b) iPhone via Needle Go App Clip with plain three.js. Record findings in
      `docs/D0-FINDINGS.md`. If either fails, evaluate the open-source 8th Wall
      engine image targets as fallback and propose a decision.
      _(desk research + on-device test harness done: `/v/mockcube01?debug`, see D0-FINDINGS.md
      and DEVICE-TESTS.md; device results pending)_
- [x] D1 Session setup, dom-overlay UI, capability detection, non-AR fallback viewer
- [x] D2 Multi-marker pose fusion → `worldFromMat`; smoothing; loss/re-snap
- [x] D3 Occluder GLB; labels; region highlights; tap selection
- [x] D4 Guided tour + off-screen arrow
- [x] D5 Calibration mode UI (ghost, nudge controls, save)

**Tests:** pose-fusion math unit tests with synthetic marker poses;
manual device test checklist in `docs/DEVICE-TESTS.md`.

## WS-E Backend & Auth (`src/lib/db`, `src/app/api`, `supabase/`)

- [x] E1 Supabase project, auth (email + password, passkeys; was magic link until the built-in mailer's rate limit blocked sign-in), env vars on Vercel _(dashboard steps in README → Supabase)_
- [x] E2 `projects` table + RLS + public view for published projects
- [x] E3 Storage buckets + signed upload route; public read for published assets _(direct uploads guarded by storage RLS instead of signed URLs)_
- [x] E4 CRUD routes / server actions; `geometryVersion` bump logic _(geometry_version bump enforced by a DB trigger)_
- [x] E5 Simple view counter (optional)

## WS-F Studio integration (`src/app/studio`, `src/components/studio`)

Depends on A, B, C, E (can start with mocks).

- [x] F1 Upload → units → orientation wizard
- [x] F2 Mat tab: preview SVG, regenerate, download
- [x] F3 Annotate tab (embeds WS-C)
- [x] F4 Preview tab: object on virtual mat with labels
- [x] F5 Publish: upload assets, show URL + QR + print checklist;
      warn when geometry changes invalidate a printed mat

---

## Milestones

- **M1** D0 findings + WS-0 done.
- **M2** Studio end-to-end: STL → mat PDF → published project (no AR yet).
- **M3** Viewer: printed mat + printed object → labels registered on phone.
- **M4** Calibration, guided tour, fallback viewer, polish, device test pass.
