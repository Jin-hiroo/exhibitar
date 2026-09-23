# D0 — AR tracking spike: findings

Status: **Android works** (first device run, 2026-09-24); iPhone / Needle Go not tested yet.

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

¹ Without `#webxr-incubations` the page is a secure context with `immersive-ar` supported, but
`XRFrame.getImageTrackingResults` does not exist: **the flag is still required on Chrome 153.**

² Diagnosis: at a distance where the whole A4 mat is in view, each 60 mm marker covers only
~20 % of the frame (ARCore recommends ≥ 25 % for reliable detection), so ARCore stopped
actively tracking them and the pose went stale. Response: the whole page is now tracked as an
additional large image, all images contribute corners to one fit, emulated poses are followed
instead of frozen, and the HUD reports print scale. Compare on the device with and without
`?mattrack=0`.

**Plain QR codes as markers?** Not with ARCore image tracking: it needs distinctive natural
features, and QR codes are grids of identical squares (poor, self-similar features). Square
fiducials (ArUco/AprilTag) would be more precise and faster to detect, but need our own
detector running on camera frames (WebXR Raw Camera Access) — a possible later upgrade.

Decision after the first test: the viewer design stands (WebXR image tracking on Android);
tracking robustness improved as described. Next device run: record the detected
convention, residual with/without the page image (`?mattrack=0`), and print scale.
