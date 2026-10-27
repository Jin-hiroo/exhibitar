---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/components/landing"]
---

# Landing page (`/`)

## Scope and mode

The public home page at `/`. Mode: **Persuade**. Visitors are prospective exhibitors (museums,
educators, design and architecture studios, hobbyists). Audience members who scan a mat never
land here; they go straight to `/v/<id>`.

## Strategy

- **Action:** start an exhibit in the Studio (`/studio/new`; signed-out visitors sign in on
  `/studio` first). Secondary: try the demo mat on this screen with a phone.
- **Belief:** a sheet of printed paper is all the tracking needs, so any 3D print can carry
  labels that sit on the real object, with nothing for visitors to install.
- **Steps (owner-set order):** Upload your STL, Mark what matters, Print the mat,
  Visitors see it in AR, Or view it in 3D. Step 4 is a real AR photo; step 5 is the phone's
  View in 3D on the printed-mat paper (owner's order, 2026-10-18). Step 1 puts the Studio's drop area under its paragraph and the Setup tab right after the drop as its visual (2026-10-19: the earlier two stacked plates left the text floating and their crop marks collided).
- **Proof:** the real AR photos of the printed skull, the Studio screenshots, and the demo mat
  shown on screen with a scannable QR code (honest that a screen is not the 1:1 printed setup).
- **Who it is for (2026-10-19):** the audience statement was a sentence on its own and "had no
  information" (owner). Under it, one example per audience: a jar (museums), a caffeine molecule
  (classrooms), a massing model (studios) and a gear train (anyone with a printer). The models
  were made for the page but labelled and rendered in the real Studio Preview, with English and
  Japanese titles, and a legend says so. Plates stay near 440px, two across, because the Studio
  draws labels at a fixed screen size.
- **Language:** English and Japanese on one URL; browser language picks, a switch overrides
  and is remembered.
- **Feels wrong if:** too techy, or toy-like.
- **Headline (user-pinned):** "Turn any 3D print into an AR exhibit".

## Direction contract

THESIS: The hero is the green self-healing cutting mat the exhibitor works on, with the AR
photo taped to it and measured by its rulers. Below it, the page is a sheet of paper lying
on the mat: the Studio screens and the placement mat are printed on it inside crop marks. It
refuses the phone-mockup hero over a row of feature-icon cards. (Revised 2026-10-18 at the
owner's request: green only in the hero, not the whole page.)

OWN-WORLD: Mat green fills the hero only, with a printed 1 cm grid, heavier 5 cm lines and
cm rulers along the top and left edges, all in pale line-cream; the AR photo rests on it as
a taped print with a soft shadow. The rest of the page is warm off-white paper, its top edge
taped to the mat, with everything printed in ink: type, hairline rules, a 45° guide, and
white plates holding the screenshots inside printer's crop marks. Label yellow (`#ffc400`,
the AR label colour) is kept for the tape you click: the call to action. Barlow Condensed
for headlines and ruler numerals, Barlow for text, M PLUS 1 for Japanese.

STORY: An exhibitor sees a real print with labels on it, understands that the paper mat does
the tracking, tries the demo mat on screen with their phone, and starts an exhibit.

FIRST VIEWPORT: Top ruler, with the navigation printed on the mat beneath it. Left seven
columns: the headline in white at up to 96px (in whichever language is active), one sentence,
a yellow tape "Make an exhibit" and a "Try the demo" link. Right five columns: the AR skull photo as a
print, turned about −2.5°, taped down, with a dimension-line caption.

FORM: Cutting mat, position 1 on the ordered list (the pick card). seed:30b1ba6c836bd0f2

SIGNATURE: the rulers measure the page. The left ruler counts centimetres down the whole
page, cream on the mat and then printed in ink on the paper, without a break in the count;
yellow ticks on both rulers follow the pointer like a set square. Motion: the hero print
settles onto the mat once, on load, from an already-visible state.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Open decisions

- The name ExhibitAR is still a working title.
- The GitHub link 404s until the repo goes public (owner's choice to link it now).
