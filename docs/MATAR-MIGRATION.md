# Migration: WebXR → matar

Status: **planned** (decided 2026-10-19). Until WS-M below lands, `main` still
runs the WebXR viewer described in ARCHITECTURE.md §5.

## Why

- **iPhone:** Safari has no WebXR AR (still true in 2026). The current path
  hands iPhone users to the Needle Go App Clip, an external tool that was never
  device-tested.
- **Android:** WebXR image tracking still needs `chrome://flags/#webxr-incubations`
  (D0-FINDINGS §4, Chrome 153). Ordinary visitors won't turn on a flag.
- **Data:** marker PNGs plus a page image up to 1600 px are downloaded for
  tracking. Square tags need only their IDs and positions (well under 1 KB).

ExhibitAR only ever tracks the printed mat (core idea 1), so it doesn't need
world tracking. Classic marker tracking in the browser is enough:
`getUserMedia` camera frames → square ID tags → camera pose → three.js. That
works the same in iOS Safari and Android Chrome with no flags and no app.

## What changes where

- **matar** (separate repo, `~/dev/matar`, `github.com/Jin-hiroo/matar`,
  Apache-2.0, private until v0.1 works on devices): the tracker library.
  Generic: board = tag list, output = camera pose. It has its own CLAUDE.md
  and docs; build tracker features there, not here.
- **ExhibitAR** (this repo): mat design with matar tags, the viewer and
  calibration wrapper around matar, caching and data-budget UI.
- **The WebXR viewer is kept** on branch **`webxr`** (cut from `main` at
  `6963fab`, 2026-10-19). Don't delete that branch. Don't port new features to
  it unless asked.

## How ExhibitAR depends on matar

1. **While matar is private:** vendor a packed tarball. In matar,
   `pnpm build && pnpm pack`, then copy `matar-<version>.tgz` to
   `vendor/` here and depend on `"matar": "file:vendor/matar-<version>.tgz"`.
   Vercel installs it with no credentials. Commit the tarball with the bump.
2. **Local development across both repos:** `pnpm link ../matar`. Never commit
   a `link:` dependency.
3. **Once matar is public on npm:** `"matar": "^0.x"`, and delete `vendor/`.

The matar version in use is the single source of truth for tag family and board
format; mats store `tagFamily` so old mats stay readable.

## WS-M Migrate the viewer to matar

Owned directories: `src/lib/ar`, `src/components/viewer`, `src/lib/mat`
(tag drawing/layout only), `src/app/v/[id]`, `vendor/`. Ticks go here.

- [ ] **M0 matar v0.1 ready**: matar TASKS.md I4 (v0.1.0) done and its demo
      passes matar DEVICE-TESTS.md on one iPhone and one Android phone.
      _Blocked on matar._
- [ ] **M1 Types**: in `src/lib/types.ts` replace `Marker` (image markers) with
      a tag list `{ id, centerMm, sizeMm, rotationDeg }` plus `mat.tagFamily`;
      make `trackImage` legacy-optional. Note the change in the commit (it
      affects every workstream).
- [ ] **M2 Mat design v3**: draw matar AprilTag **tag36h11** tags instead of the
      seeded art, using matar's `layoutBorderTags` and `tagSvg`/`boardSvg`.
      Layout (matar ARCHITECTURE.md §3.1): on A4 a ring of 12–14 tags of 32 mm
      along all edges (so the object and hands can't hide them all), plus an
      inner ring of 4–6 tags of 20 mm around the footprint for close-ups; A3
      for objects ≳ 10 cm; ≤ 40 tags; tags ≥ 8 mm from the page edge with one
      extra white cell between them. Keep `layout.keepOut` (footprint) and the
      seam-avoid rules; tiled mats must be aligned to ≲ 1 mm. Pick tag IDs per
      project with `pickTagIds(seed)` seeded from the project ID, so
      neighbouring exhibits in one room don't share many tags (matar rejects
      the few that do). Drop `texture.ts`, `quality.ts`, the whole-page
      `trackPng`. Bump `MAT_DESIGN_VERSION` to 3 (the Studio already offers a
      rebuild for outdated mats). Keep the 100 mm ruler and add the ID-1 card
      outline (`boardSvg` options): print scale can't be measured by the
      camera, so a mat printed at the wrong scale is corrected with
      `scaleBoard(board, s)` from the measured ruler.
- [ ] **M3 Runtime**: replace `ar-runtime.ts` with a thin wrapper around matar
      that keeps today's callbacks (`onStatus`, `onGuide`, `onSelect`, `onEnd`)
      and `setGhost`/`setDebug`. Mat frame = world: `exhibit.root.matrix` stays
      identity and matar sets the camera (`ExhibitScene` is unchanged). Taps:
      `pointerup` → ray → `exhibit.pick`. Delete `xr-image-tracking.ts` and the
      convention / emulated / print-scale code in `pose.ts` (keep `rigidFit`,
      `PoseFilter` only if still used).
- [ ] **M4 Viewer UI**: one "Start AR" for iOS and Android; remove the App Clip
      link, flag notes, `?convention`, `?mattrack`; new status/debug text from
      matar's status. `capabilities.ts` checks secure context + `getUserMedia` +
      WebGL. Detect in-app browsers and tell users to open the page in Safari/Chrome.
- [ ] **M5 Calibration**: `CalibrateApp` uses the new runtime (constructor change).
- [ ] **M6 Assets & publish**: stop uploading/preloading marker and track PNGs;
      AR needs only the GLB + project JSON. The orbit viewer draws tags from
      their bits instead of the PNGs. No Supabase migration (`mat` is jsonb).
- [ ] **M7 Data budget**: store the exact total download size at publish; show
      it on the Start card ("1.3 MB, one time"). Make repeat visits download
      nothing (matar RESEARCH.md §1.7):
      - versioned, immutable URLs for viewer chunks and exhibit assets, served
        with `Cache-Control: public, max-age=31536000, immutable` (the HTTP
        cache is outside WebKit's script-storage policy);
      - a service worker that pre-caches the app shell, viewer chunks and the
        exhibit's assets in the Cache API, plus `navigator.storage.persist()`;
      - on iOS, an "Add to Home Screen" hint: a Safari **tab** deletes the
        Cache API and service worker after 7 days without a visit, Home Screen
        web apps keep theirs (whether `persist()` exempts a tab: unverified,
        test on a device).
      Optional "Save for offline" button. Verify with `pnpm perf:viewer` and a
      second-visit test (0 bytes of assets). Camera frames never leave the
      phone, so tracking itself uses no data.
- [ ] **M8 Tests, fixtures, docs**: update the tests, fixtures and scripts that
      use marker PNGs / WebXR (`pose.test.ts`, mat tests, `publish.test.ts`,
      `tests/fixtures/project.mock.json`, `tests/e2e/routes.spec.ts` App Clip
      test → Start AR test, `scripts/track-scores.ts` → delete). Rewrite
      ARCHITECTURE.md §5, SPEC "iPhone via App Clip", DEVICE-TESTS, README,
      CLAUDE.md stack line; record the decision in D0-FINDINGS.

**Done when:** a published exhibit tracks on an iPhone in Safari and on an
Android phone in Chrome with no flags, labels sit within the matar accuracy
target, a repeat visit downloads 0 bytes of exhibit assets, and `pnpm lint
typecheck test test:e2e` pass.
