# Device test checklist

## Setup (Android, over USB)

1. On the phone: Chrome up to date, "Google Play Services for AR" installed.
2. `chrome://flags/#webxr-incubations` → **Enabled** → Relaunch.
3. On the Mac: `pnpm dev`, phone connected with USB debugging, then
   `adb reverse tcp:3000 tcp:3000` (the phone now reaches the Mac at `http://localhost:3000`,
   which counts as a secure context).

## Get a mat

The mock exhibit (`mockcube01`) has its own markers — use *its* mat:

- **Print (recommended):** `http://localhost:3000/fixtures/mock-cube-mat.pdf`, A4 landscape,
  **Actual size / 100 %**. The black-and-white bar must measure 100 mm.
- **On screen (quick check):** open `http://localhost:3000/fixtures/mock-cube-mat.svg` on a
  monitor and zoom the browser until the bar measures 100 mm with a real ruler. Matte screens
  work better; alignment is only as good as that zoom.

## AR smoke test

Open `http://localhost:3000/v/mockcube01?debug` on the phone → **Start AR** → allow the camera.

- [ ] Landing card shows no capability warning (otherwise follow its instructions).
- [ ] Session starts; the hint "Point your camera at the mat" appears.
- [ ] HUD `trackable` shows `ok` for m0–m3 (a `NO` means ARCore rejected that marker image).
- [ ] Pointing at the mat: status becomes "Tracking · N markers"; HUD `markers` shows `T`.
- [ ] Green squares (Debug) sit exactly on the printed markers; the orange square on the
      contact outline; blue axis points to FRONT.
- [ ] **Model** on: the translucent 60 mm cube stands on the contact outline.
- [ ] HUD `pose fit residual` < ~5 mm with all 4 markers visible.
- [ ] HUD `convention` switches from `(default)` to `(detected)` → record the value in D0-FINDINGS.
- [ ] Walk a full circle: content stays put; covering markers → "Mat out of view" but
      content holds; uncovering re-snaps smoothly.
- [ ] Tap "Front face" label or the front face → yellow highlight + detail sheet.
- [ ] Tour ‹ › cycles through the points.
- [ ] With a real 60 mm printed cube on the outline and **Model** off: labels on the far
      side are hidden by the cube (occlusion).

## QR check

- [ ] Scan the mat's QR with the phone camera → opens `https://exhibitar.vercel.app/v/mockcube01`
      (works once this branch is deployed to production).
