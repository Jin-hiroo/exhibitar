# D0 — AR tracking spike: findings

Status: **Android works** (first device run, 2026-09-24); iPhone / Needle Go not tested yet.
2026-10-14: an A3 mat would not lock at viewing distance; diagnosed and fixed in §4.

## 1. WebXR Image Tracking (Android Chrome)

Source: W3C draft "WebXR Image Tracking" — https://immersive-web.github.io/image-tracking/
(moved from `immersive-web/marker-tracking`).

- Session: `navigator.xr.requestSession('immersive-ar', { optionalFeatures: [...], trackedImages: [{ image: ImageBitmap, widthInMeters }] })`.
  Feature descriptor is **`marker-tracking`** in the current spec, **`image-tracking`** in
  Chrome's original implementation. We request both as optional features.
- Per frame: `frame.getImageTrackingResults()` → `{ imageSpace, index, trackingState: 'tracked' | 'emulated', measuredWidthInMeters }`.
  `index` is the position in `trackedImages`.
- Suitability: spec `session.getImageTrackability()`, Chrome's original
  `session.getTrackedImageScores()` → `'trackable' | 'untrackable'` per image.
- Availability: Android + ARCore ("Google Play Services for AR") + Chrome with
  **chrome://flags/#webxr-incubations** enabled. Still behind the flag as of 2026.
- **Image space convention (spec, normative):** origin at the image centre, **+X toward the
  right edge, +Y toward the top of the image, +Z along the normal toward the viewer.**
  ARCore's native Augmented Image pose is different (+Y normal, +Z toward the image bottom).
  Whether Chrome reports the spec or the ARCore frame is **unverified**.

### How the app copes with the unknowns

- `src/lib/ar/xr-image-tracking.ts` is the only place that knows API names; both spellings
  are handled.
- Since the first device run, every tracked image contributes centre + corners to one
  rigid fit, evaluated for **both** conventions each frame (chosen by inliers → residual →
  gravity → saved preference). The convention the device uses is learned from decisive
  frames and saved in `localStorage`; the Debug HUD shows it (`axes …`). Override for
  testing: `/v/<id>?debug&convention=arcore` (or `spec`).

## 2. iPhone (Needle Go App Clip)

Desk research (not yet device-tested):

- Any public **HTTPS** WebXR page — plain three.js included — opens in the Needle Go App
  Clip via `https://appclip.needle.tools/ar?url=<page URL>`; iOS 14+, nothing to install
  (https://engine.needle.tools/docs/how-to-guides/xr/ios-webxr-app-clip.html).
- Supported inside the App Clip: WebXR sessions, hit-test/planes, DOM overlay and **image
  tracking** (ARKit-backed); anchors and lighting estimation are work in progress
  (https://engine.needle.tools/docs/how-to-guides/xr/image-tracking.html).
- Integration: on iPhone/iPad without WebXR, the Viewer's **Start AR** links to the App Clip
  with the current `/v/<id>` URL; inside it the same runtime runs. The printed QR keeps
  pointing at our own URL (Android and desktop are unaffected). Localhost cannot be used —
  test iPhones against a deployed URL.
- Unknown until tested: whether Needle reports image poses in the spec or ARKit axis
  convention (the fusion detects either), and `getImageTrackability` support.

## 3. Fallback option if Android image tracking fails

Evaluate the open-source 8th Wall engine image targets (TASKS.md D0).

## 4. On-device results

Procedure: see `docs/DEVICE-TESTS.md` → "AR smoke test". Read the values off the Debug HUD.

| Date | Device | Android / Chrome | Flag on? | Session starts? | Trackability m0–m3 | Tracks? | Detected convention | Fit residual | FPS | Notes |
| ---- | ------ | ---------------- | -------- | --------------- | ------------------ | ------- | ------------------- | ------------ | --- | ----- |
| 2026-09-24 | Galaxy S25 Edge (SM-S937B), ARCore 1.56 | 16 / 153 | required¹ | yes | all `ok` | yes | not yet (HUD showed `spec (default)`) | 4.5 mm | 24 | markers fell to `emulated` at ~50 cm; content 1.5–2.5 cm off² |
| 2026-10-14 | Galaxy S25 Edge (SM-S937B), ARCore 1.56 | 16 / 153 | yes | yes | all `ok`; **`mat` NO** | **no** (stuck at `searching`, every image `·`) | – | – | – | `mySkull` A3 portrait mat (v2, 60 mm markers) shown on a laptop screen at 30–60 cm³ |

¹ Without `#webxr-incubations` the page is a secure context with `immersive-ar` supported, but
`XRFrame.getImageTrackingResults` does not exist: **the flag is still required on Chrome 153.**

² Diagnosis: at a distance where the whole A4 mat is in view, each 60 mm marker covers only
~20 % of the frame (ARCore recommends ≥ 25 % for reliable detection), so ARCore stopped
actively tracking them and the pose went stale. Response: the whole page is now tracked as an
additional large image, all images contribute corners to one fit, emulated poses are followed
instead of frozen, and the HUD reports print scale. Compare on the device with and without
`?mattrack=0`.

³ Diagnosis (2026-10-14): the published page and marker PNGs matched the screen, so the mat was
not stale. Two things kept it from locking:

- **The markers were too small in ARCore's camera image.** ARCore starts tracking an image once
  it fills roughly a quarter of the frame. Chrome crops the 3:4 camera image to fill the tall
  screen, so the screen shows only ~60 % of what ARCore sees: a marker 17 % of the screen wide
  was ~10 % of ARCore's frame (~50 px of its 480 px-wide image). The old hint ("30–60 cm away")
  kept users at that distance.
- **ARCore rejected the whole-page image** (`mat:NO`), the target added for exactly this case.
  `arcoreimg` reproduces it: the page fails with "not enough keypoints". It scores *coverage*,
  not just detail: a 512 px marker scores 100 alone but fails once padded into a 1600 px blank
  image, while a 2×2 grid of markers that fills the image scores 100. Four corner markers on an
  otherwise blank A3 page cannot pass.

Response:

- Viewer hint: while the page is not `trackable` (all mats printed before this fix), "Hold your
  phone about 20 cm above one corner marker until it locks on, then step back"; with a trackable
  page, "Keep the whole mat in view, 30–60 cm away".
- New mats: **black confetti texture** over all free space (`src/lib/mat/texture.ts`, kept clear
  of the placement area, markers, QR and text), and **bigger markers** where the sheet allows
  (up to a third of its short side, as long as the title keeps its place: A4 69 mm, mySkull's
  A3 70 mm, a 160 × 120 mm object's A3 98 mm). Existing mats get both via Studio → rebuild mat +
  reprint.
- Rejected: tracking "bands" cut from an old page image (the strip between two markers along an
  edge), which would have needed no reprint. ARCore rejects or scores them 0: the blank stretch
  between the two markers is too long.

`arcoreimg eval-img` scores (0–100, Google recommends ≥ 75; FAIL = too few keypoints, which is
when ARCore reports the image `untrackable`; the device showed `ok` for the marker scoring 60).
`pnpm track-scores` regenerates the images and this table (`ARCOREIMG=<path to arcoreimg>`):

| Mat | Markers | Page | Band top / bottom | Band left / right | Markers m0–m3 |
| --- | ------- | ---- | ----------------- | ----------------- | ------------- |
| mySkull v2 as printed (A3 portrait, no texture) | 60 mm | **FAIL** | FAIL / FAIL | FAIL / FAIL | 100 100 100 60 |
| mySkull, new layout, no texture | 70 mm | 0 | FAIL / FAIL | FAIL / FAIL | 100 100 100 60 |
| mySkull, new layout + texture | 70 mm | 0 (v2 seed) | FAIL / FAIL | FAIL / FAIL | 100 100 100 60 |
| mock cube as printed (A4 landscape) | 60 mm | 0 | FAIL / FAIL | FAIL / 0 | 45 95 100 100 |
| mock cube, new layout + texture | 69 mm | 35 (v1 seed) | FAIL / FAIL | 0 / 0 | 45 95 100 100 |

The page score with texture varies strongly with the texture seed (it moves in steps of 5, as
if counting re-detections in ~20 synthetic views): over geometry versions 1–12 the textured
page scored, for mySkull, 95 0 50 80 100 60 100 100 100 75 100 75 (median ≈ 88) and for the
mock cube 35 100 75 100 100 70 100 80 80 100 80 100 (median 90). Every textured page is
accepted (no FAIL). Texture parameters were chosen by the median over many seeds on four
outlines; very large objects (a 200 mm disc on A3) leave too little free page and stay near 0,
where the bigger markers carry the tracking. Next device run: rebuilt mySkull mat, expect
`mat:ok` and a lock from 40–60 cm.

**Plain QR codes as markers?** Not with ARCore image tracking: it needs distinctive natural
features, and QR codes are grids of identical squares (poor, self-similar features). Square
fiducials (ArUco/AprilTag) would be more precise and faster to detect, but need our own
detector running on camera frames (WebXR Raw Camera Access) — a possible later upgrade.

Decision after the first test: the viewer design stands (WebXR image tracking on Android);
tracking robustness improved as described. Next device run: record the detected
convention, residual with/without the page image (`?mattrack=0`), and print scale.
