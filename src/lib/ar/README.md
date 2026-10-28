# src/lib/ar — WS-D AR Viewer

The AR viewer on [matar](../../../vendor/README.md): the phone camera in the
page, the printed tags tracked in a worker, three.js drawn over the analysed
frame. No WebXR, the same in iOS Safari and Android Chrome
(docs/MATAR-MIGRATION.md).

- `ar-runtime.ts`: `ArRuntime`, matar's tracker and `MatarThree` behind the
  viewer's callbacks (`onStatus`, `onGuide`, `onSelect`, `onEnd`). The mat frame
  is matar's board frame, so the exhibit stays at the world origin and matar
  moves the camera. `cameraErrorText` explains camera failures to visitors.
- `saved-intrinsics.ts`: the focal length matar measured, kept per camera in
  `localStorage` so the next visit doesn't calibrate again.
- `capabilities.ts`: secure context, camera API, WebGL; in-app browsers.
- `pose.ts`: `matFromModel = calibration ∘ objectToMat`.
- `exhibit-scene.ts`, `labels.ts`, `label-placement.ts`, `occlusion.ts`: the
  model, its labels and what hides them.
- `orbit-viewer.ts`: the fallback 3D view with a picture of the mat.

Runtime unit: **metres**. See docs/ARCHITECTURE.md §2.
