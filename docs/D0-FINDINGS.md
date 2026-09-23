# D0 — AR tracking spike: findings

Status: **desk research done; on-device results pending** (fill in §4).

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
- With ≥ 3 markers tracked, the mat pose comes from a rigid fit on marker **centres only**
  (`estimateWorldFromMat`, method `fit`): independent of the axis convention.
- While ≥ 3 markers are tracked, `detectImageConvention` compares each marker's reported
  orientation with both conventions; after 20 consistent frames the winner is locked and
  saved in `localStorage` (used when only 1–2 markers are visible). The Debug HUD shows it.
  Override for testing: `/v/<id>?debug&convention=arcore` (or `spec`).

## 2. iPhone (Needle Go App Clip)

Not investigated yet. Next step: read engine.needle.tools docs on image tracking in
Needle Go and how a plain three.js page hooks in. Until then iPhones get the 3D fallback.

## 3. Fallback option if Android image tracking fails

Evaluate the open-source 8th Wall engine image targets (TASKS.md D0).

## 4. On-device results (fill in)

Procedure: see `docs/DEVICE-TESTS.md` → "AR smoke test". Read the values off the Debug HUD.

| Date | Device | Android / Chrome | Flag on? | Session starts? | Trackability m0–m3 | Tracks? | Detected convention (scores) | Fit residual | FPS | Notes |
| ---- | ------ | ---------------- | -------- | --------------- | ------------------ | ------- | ---------------------------- | ------------ | --- | ----- |
|      |        |                  |          |                 |                    |         |                              |              |     |       |

Decision after the test: record here whether the viewer design (ARCHITECTURE.md §5) stands.
