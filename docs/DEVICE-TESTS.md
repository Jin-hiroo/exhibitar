# Device test checklist

## Setup (Android)

1. On the phone: Chrome up to date, "Google Play Services for AR" installed.
2. `chrome://flags/#webxr-incubations` → **Enabled** → Relaunch.
3. Either use the live site (`https://exhibitar.vercel.app`, simplest: scan the mat's QR), or
   for local development: `pnpm dev`, USB debugging on, `adb reverse tcp:3000 tcp:3000`, and
   open `http://localhost:3000` on the phone (a secure context).

## iPhone

Open the exhibit URL in Safari → **Start AR** opens the Needle Go App Clip (live site only;
the App Clip cannot reach localhost). Record what happens in D0-FINDINGS §2.

## Get a mat

The mock exhibit (`mockcube01`) has its own markers — use *its* mat. Mats from before
2026-10-14 (no black confetti texture, 60 mm markers) no longer match it: reprint.

- **Print (recommended):** `http://localhost:3000/fixtures/mock-cube-mat.pdf`, A4 landscape,
  **Actual size / 100 %**. The black-and-white bar must measure 100 mm.
- **On screen (quick check):** open `http://localhost:3000/fixtures/mock-cube-mat.svg` on a
  monitor and zoom the browser until the bar measures 100 mm with a real ruler. Matte screens
  work better; alignment is only as good as that zoom.

## AR smoke test

Open `https://exhibitar.vercel.app/v/mockcube01?debug` (or the localhost URL) on the phone →
**Start AR** → allow the camera.

- [ ] Landing card shows no capability warning (otherwise follow its instructions).
- [ ] Session starts; the hint "Point your camera at the mat" appears.
- [ ] HUD `trackable` shows `ok` for m0–m3 **and `mat`** (a `NO` means ARCore rejected that
      image). The hint then reads "Keep the whole mat in view, 30–60 cm away".
- [ ] **Old mats** (printed before the texture, `mat:NO`): the hint reads "Move in close to one
      corner marker until it fills about half the screen width…"; doing that locks within a few
      seconds, and stepping back keeps tracking. To get `mat:ok`: Studio → Mat or Publish tab →
      **Make a new mat**, then print the new PDF.
- [ ] Pointing at the mat: status becomes "Tracking · N markers"; HUD `images` shows `T`.
- [ ] Debug overlay: green squares sit exactly on the printed markers, the cyan rectangle on
      the page edges, orange on the contact outline; blue axis points to FRONT.
- [ ] **Model** on: the translucent 60 mm cube stands on the contact outline.
- [ ] HUD `images` lists `mat` too; from 40–60 cm the view locks and `mat` shows `T`
      (actively tracked) without first going close to a marker.
- [ ] HUD `fit` < ~5 mm; `print` ≈ 100 % (otherwise the mat was not printed at actual size).
- [ ] Compare alignment with `?mattrack=0` (markers only) vs default (markers + page).
- [ ] HUD `axes … saved <x> (detected)` appears after a few seconds with several images
      tracked → record the value in D0-FINDINGS.
- [ ] Walk a full circle: content stays put; covering markers → "Mat out of view" but
      content holds; uncovering re-snaps smoothly.
- [ ] Tap "Front face" label or the front face → yellow highlight + detail sheet.
- [ ] Tour ‹ › cycles through the points.
- [ ] With a real 60 mm printed cube on the outline and **Model** off: labels on the far
      side are hidden by the cube (occlusion).

## QR check

- [ ] Scan the mat's QR with the phone camera → opens `https://exhibitar.vercel.app/v/mockcube01`.

## Calibration (owner)

Requires a published exhibit (Studio → Publish) and being signed in on the phone.

- [ ] Studio → Publish → **Calibrate on phone** (or `/studio/<id>/calibrate`) → Start.
- [ ] Ghost model visible; nudging X/Z/Turn moves it immediately.
- [ ] Save → reopen the public Viewer: labels use the new alignment.
