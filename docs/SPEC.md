# SPEC — Product

## 1. Concept

The physical object is the exhibit. AR is an invisible information layer
registered onto it. Any object that can be 3D printed from an STL works:
skulls, figurines, architectural models, mechanical parts.

The exhibitor's total physical cost: one 3D print + one sheet of paper.

## 2. Roles

### Exhibitor
Owns the exhibit. Uses the **Studio** (desktop-first web tool). Logs in.

### Audience
Visitor at the exhibit. Uses the **Viewer** on their phone. No account, no
install (Android: browser; iPhone: App Clip opens automatically).

## 3. Exhibitor flow (Studio)

1. **Upload STL** (binary or ASCII). Parsed locally; never uploaded.
2. **Units & size.** Assume millimetres. Show dimensions ("180 × 140 × 120 mm").
   Allow unit override (mm / cm / inch) or a uniform scale factor.
   Warn: the physical print must use the same scale.
3. **Orientation.** Auto-suggest the resting face (largest near-planar
   downward region / most stable pose). Exhibitor can rotate in 90° steps and
   free-rotate; the object is then dropped so its lowest point touches the
   table (y = 0). Exhibitor also chooses which way is **FRONT**.
4. **Mat generation (automatic).**
   - Contact outline (where the object touches the table) — solid line.
   - Shadow outline (top-down silhouette) — dashed line.
   - "FRONT" arrow and label.
   - 3–4 unique, high-feature tracking markers around the outline, never
     under the object's shadow.
   - QR code linking to the Viewer URL (QR is for launching only, not tracking).
   - 100 mm calibration ruler + "Print at 100% / Actual size" text.
   - Paper size auto-picked (A4 → A3 → Letter/Tabloid option); tiled across
     multiple sheets with alignment marks if too large.
5. **Annotate.**
   - *Point*: click on the model surface → a point with surface normal.
   - *Region*: brush-paint triangles on the (simplified) model.
   - Each annotation: title, body text, optional image, optional link, and how
     far its label floats off the model (default 25 mm; live while dragging).
   - Reorder list; order doubles as the guided-tour order.
6. **Preview.** Orbit the model on the virtual mat; see labels as the audience
   will (including back-facing fade and occlusion).
7. **Publish.** Saves the project, returns Viewer URL + QR.
   Downloads: mat SVG (and PDF), QR PNG, printing instructions.
8. **Physical setup.** Print mat at 100%, verify ruler, mount on card/foam board,
   place printed object on the contact outline facing FRONT.
9. **Calibrate (on phone).** Open calibrate mode, see a translucent ghost of the
   model over the real object, nudge (x, z translate; yaw rotate; optional y)
   until aligned, save. The correction applies for every audience member.
10. **Edit later.** Annotations can be edited after publishing. Geometry
    changes (new STL / new orientation) create a new mat and invalidate the
    printed one — warn clearly.

## 4. Audience flow (Viewer)

1. Scan QR on the mat → `/v/[id]`.
2. Landing card: exhibit title, short description, "Start AR" button.
3. AR starts (Android WebXR directly; iPhone via App Clip).
4. Hint overlay: "Point your camera at the mat."
5. Markers found → content locks on. Hint disappears.
6. Explore:
   - Labels appear at annotation points, occluded by the real object,
     fading when seen from behind.
   - Tap a label → detail sheet (text/image/link); its region glows.
   - Optional guided tour: Next/Prev; an edge arrow points to off-screen targets.
7. Tracking recovers automatically if lost; re-snaps when a marker is seen again.
8. Fallback if AR is unsupported: a normal 3D viewer of the model with the same
   annotations.

## 5. Non-goals (v1)

- Recognizing objects without a mat.
- Multi-object exhibits on one mat.
- Audience accounts, comments, analytics beyond simple view counts.
- Editing geometry in the browser.

## 6. Success criteria (v1)

- A new exhibitor can go from STL to published exhibit in < 10 minutes.
- After calibration, labels sit within ~3 mm of target on a ~20 cm object
  when viewed from 30–60 cm.
- Walking a full circle around the object keeps content registered.
