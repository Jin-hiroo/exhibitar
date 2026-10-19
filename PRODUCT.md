# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Exhibitors** (primary): museum and gallery staff, teachers and science centres, design
  and architecture studios presenting physical models, and hobbyists with a 3D printer. They
  have an STL and a print of it, and want visitors to learn what they are looking at without
  placards crowding the object. They work in the **Studio**, a desktop-first web tool.
- **Audience** (secondary): visitors at the exhibit. They scan a QR code on the mat with a
  phone, with no account and no install, and land straight on the exhibit's `/v/<id>` page,
  not on the landing page.

## Product Purpose

ExhibitAR turns any 3D-printed object into an AR exhibit. The exhibitor uploads the STL,
marks points and regions of interest with text, and prints a paper placement mat. Visitors
point a phone at the mat and the object, and see labels, highlights and descriptions pinned
to the real object. The exhibitor's whole physical cost is one 3D print and one sheet of
paper. Success (v1): STL to published exhibit in under 10 minutes; labels within ~3 mm on a
~20 cm object; content stays registered while walking a full circle around it.

## Positioning

Tracking uses only the printed mat, never the object: the object's pose is known because it
stands on its printed outline. So any printable shape works, with nothing to scan or train.
The original STL never leaves the exhibitor's browser; only a simplified model, the mat and
the annotations are uploaded. Visitors need nothing installed. It is open source.

## Operating Context

- An STL file and a 3D print of it; an ordinary paper printer (print at 100 %, check the
  100 mm ruler; A4/A3 or Letter/Tabloid, tiled across sheets for large objects).
- The printed object stands on the contact outline, facing the FRONT arrow.
- One-time calibration on a phone, saved for every visitor.
- Visitors: Android Chrome with ARCore runs WebXR image tracking (currently behind
  `chrome://flags/#webxr-incubations`); iPhone goes through the Needle Go App Clip, which is
  **not yet device-tested**; any other browser gets a 3D view of the exhibit with the same
  labels.

## Capabilities and Constraints

- Studio: upload STL (processed locally in Web Workers), set units/size and resting
  orientation, choose FRONT, generate the mat (outline, markers, QR, ruler) as PDF/SVG,
  annotate with points and painted regions (title, text, optional image and link, tour
  order), preview, publish, calibrate.
- Studio works as an in-tab draft without an account; publishing needs sign-in (Google,
  email + password, or passkey).
- In AR, the printed object hides labels behind it, and labels fade when seen from behind.
  Tapping a label opens a detail sheet and lights up its region; there is an optional guided
  tour.
- Viewer pages must be interactive in under 3 s on 4G (GLB budget ≤ 1.5 MB).
- Not in v1: recognising objects without a mat, several objects per mat, visitor accounts,
  editing geometry.

## Brand Commitments

- Name: **ExhibitAR** (still a working title).
- The landing page is bilingual, **English and Japanese**; the rest of the app is English.
- Open source under **Apache 2.0**, repo `github.com/Jin-hiroo/exhibitar`. The repo is
  still private, so that link 404s until it goes public; the owner chose to link it anyway.
- Hosted at https://exhibitar.vercel.app.

## Evidence on Hand

- Real AR photos of a printed skull on its mat, labels 1 左目 (left eye) and 2 歯 (teeth):
  `docs/images/ar-skull-front.jpg`, `docs/images/ar-skull-angle.jpg`.
- Screenshots of the same published "skull on stand" exhibit (id `s10qQFEvnE`):
  `docs/images/studio-mat.png` (A3 mat), `docs/images/studio-annotate.png`,
  `docs/images/viewer-phone.png` (phone 3D view with a detail sheet).
- A demo exhibit that needs no backend: `/v/mockcube01`, with its printable mat at
  `/fixtures/mock-cube-mat.pdf`.
- Sample STLs in `public/samples/`.
- **None yet:** testimonials, named customers or institutions, usage numbers, press. Don't
  invent them. Don't claim iPhone AR works until it has been device-tested.

## Product Principles

1. The physical object is the exhibit; AR is an invisible information layer on top of it.
2. Paper is the interface: everything the tracking needs is on one printed sheet.
3. The exhibitor's model is theirs: geometry is processed on their machine.
4. Visitors get in with one scan: no account, no app, fast on mobile data.
5. Say only what is true today, platform support included.

## Accessibility & Inclusion

Visitor-facing pages are public and mobile-first, and must stay fast on 4G. Japanese text
must render properly (the photos and real exhibits use Japanese labels).
