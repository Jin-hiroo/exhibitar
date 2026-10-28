# Migration: WebXR → matar

Status: **in progress** (decided 2026-10-19). M1–M5 are done: the Studio
makes mats with matar tags, and the viewer and calibration track them with
matar. M6–M8 (assets, data budget, tests and docs) are next; ARCHITECTURE.md
§5 still describes the WebXR viewer until M8.

Decisions of 2026-10-28: ship to iPhone and Android together, iOS marked
unverified until an iPhone test; existing exhibits rebuild and reprint their
mat (no viewer for design ≤ 2 mats); vendor the tarball, and matar's repo
goes public; land the work as stacked PRs (M1–M2, M3–M5, M6 + M8), M7 after.

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
  Apache-2.0; private until v0.1 worked on devices, going public with the
  vendored tarball, decided 2026-10-28): the tracker library.
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
2. **Local development across both repos:** `pnpm link ../matar`. Turbopack
   only reads files under its root, so while linked also set
   `turbopack: { root: path.join(__dirname, '..') }` in `next.config.ts`.
   Commit neither the `link:` dependency nor that root.
3. **Once matar is public on npm:** `"matar": "^0.x"`, and delete `vendor/`.

The matar version in use is the single source of truth for tag family and board
format; mats store `tagFamily` so old mats stay readable.

## WS-M Migrate the viewer to matar

Owned directories: `src/lib/ar`, `src/components/viewer`, `src/lib/mat`
(tag drawing/layout only), `src/app/v/[id]`, `vendor/`. Ticks go here.

- [ ] **M0 matar v0.1 ready**: matar TASKS.md I4 (v0.1.0) done and its demo
      passes matar DEVICE-TESTS.md on one iPhone and one Android phone.
      _Android done (matar DEVICE-TESTS 2026-10-25 and 2026-10-28); no iPhone
      run yet. The maintainer chose to go ahead without it (2026-10-28)._
- [x] **M1 Types**: in `src/lib/types.ts` replace `Marker` (image markers) with
      a tag list `{ id, centerMm, sizeMm, rotationDeg }` plus `mat.tagFamily`;
      make `trackImage` legacy-optional. Note the change in the commit (it
      affects every workstream). _Done: `mat.tags: MatTag[]` and
      `mat.tagFamily`; `markers` and `trackImage` stay optional and
      deprecated, so stored design ≤ 2 mats still load (and are told to
      rebuild)._
- [x] **M2 Mat design v3**: draw matar AprilTag **tag36h11** tags instead of the
      seeded art, using matar's `layoutBorderTags` and `tagSvg`/`boardSvg`.
      Layout (matar ARCHITECTURE.md §3.1): `layoutBorderTags` fills the border
      band of a page rectangle (8 mm margin, one white cell between tags,
      corners shared, evenly spaced), so on A4 a ring of **16 tags of 32 mm**
      along all edges (the object and hands can't hide them all). Add an inner
      ring of 20 mm tags for close-ups with a second call whose area is the
      footprint rectangle grown outward (on A4 it fits only around footprints
      up to ≈ 55 × 140 mm; larger objects get A3 or no inner ring). A3 for objects ≳ 10 cm; ≤ 40 tags.
      Pass `originMm` = the page position of the mat-frame origin (the
      footprint centre, ARCHITECTURE.md §2), so matar's board frame is the mat
      frame. Keep-outs are rectangles; tags touching one are dropped. Keep
      `layout.keepOut` (footprint) and the seam-avoid rules; tiled mats must be aligned to ≲ 1 mm. Pick tag IDs per
      project with `pickTagIds(seed)` seeded from the project ID, so
      neighbouring exhibits in one room don't share many tags (matar rejects
      the few that do). Drop `texture.ts`, `quality.ts`, the whole-page
      `trackPng`. Bump `MAT_DESIGN_VERSION` to 3 (the Studio already offers a
      rebuild for outdated mats). Keep the 100 mm ruler and add the ID-1 card
      outline (`boardSvg` options): print scale can't be measured by the
      camera, so a mat printed at the wrong scale is corrected with
      `scaleBoard(board, s)` from the measured ruler.
      _Done, with these differences:_
      - _The title, QR, ruler and FRONT arrow go inside the outer ring (or
        where the object displaced ring tags), so the inner ring fits only
        when they still do: on A4 around objects up to about 30 mm. Moving
        them into the ring band would make room (open)._
      - _Tiled mats: the sheets are planned first and tags whose footprint
        would straddle a seam are dropped (a ring along every edge can't keep
        clear of every seam)._
      - _A mat whose ring would exceed 32 tags takes bigger tags (40–64 mm)._
      - _No ID-1 card outline yet: it needs about 86 × 54 mm of free space.
        The 100 mm ruler stays the print-scale check._
      - _The tags are drawn from matar's `tagCells` into the mat's own
        display list (SVG and PDF), not with `tagSvg`. A test renders the mat
        and checks that matar's detector finds every tag within 0.75 px of
        the mat data at 3 px/mm._
- [x] **M3 Runtime**: replace `ar-runtime.ts` with a thin wrapper around matar
      that keeps today's callbacks (`onStatus`, `onGuide`, `onSelect`, `onEnd`)
      and `setGhost`/`setDebug`. Mat frame = world: `exhibit.root.matrix` stays
      identity and matar sets the camera (`ExhibitScene` is unchanged). Taps:
      `pointerup` → ray → `exhibit.pick`. Delete `xr-image-tracking.ts` and the
      convention / emulated / print-scale code in `pose.ts` (keep `rigidFit`,
      `PoseFilter` only if still used).
      _Done: neither was still used, so `pose.ts` keeps only `matFromModel`.
      The canvas goes into a container under the UI overlay (no DOM overlay);
      taps on it that don't move are picks. The focal length matar measures is
      saved per camera label in `localStorage` and reused on the next visit
      (`saved-intrinsics.ts`, as matar's demo does). matar's options are left at
      their defaults: the short exposure and edge gamma tried on the Android
      phone are opt-in in matar and tested on one device only._
- [x] **M4 Viewer UI**: one "Start AR" for iOS and Android; remove the App Clip
      link, flag notes, `?convention`, `?mattrack`; new status/debug text from
      matar's status. `capabilities.ts` checks secure context + `getUserMedia` +
      WebGL. Detect in-app browsers and tell users to open the page in Safari/Chrome.
      _Done. Camera errors (blocked, in use, none) get their own text. A mat of
      design ≤ 2 can't be tracked: Start AR is disabled with a note to rebuild,
      and the 3D view still works. e2e: Chromium's fake camera plays a picture
      of the mock mat rendered with `matar/testing`; the viewer tracks all 16
      tags (0.17 px) on matar's module worker, in dev and production builds._
- [x] **M5 Calibration**: `CalibrateApp` uses the new runtime (constructor change).
- [ ] **M6 Assets & publish**: stop uploading/preloading marker and track PNGs;
      AR needs only the GLB + project JSON. The orbit viewer draws tags from
      their bits instead of the PNGs. No Supabase migration (`mat` is jsonb).
      _Uploading stopped and the orbit viewer draws the tags (with M2); the
      viewer page still preloads a design ≤ 2 mat's PNGs until M3–M4._
- [ ] **M7 Data budget**: store the exact total download size at publish; show
      it on the Start card ("1.3 MB, one time"). Make repeat visits download
      nothing (matar RESEARCH.md §1.7):
      - versioned, immutable URLs for viewer chunks and exhibit assets, served
        with `Cache-Control: public, max-age=31536000, immutable` (the HTTP
        cache is outside WebKit's script-storage policy);
      - a service worker that pre-caches the app shell, viewer chunks
        (including matar's separate worker chunk, which Next emits with its
        own hashed URL) and the exhibit's assets in the Cache API, plus
        `navigator.storage.persist()`;
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
