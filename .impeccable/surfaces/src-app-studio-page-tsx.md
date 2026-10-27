---
version: 1
slug: "src-app-studio-page-tsx"
primary_target: "src/app/studio/page.tsx"
related_targets: ["src/app/login","src/components/studio/SignInSheet.tsx","src/components/studio/sign-in.module.css"]
---

# Studio, signed out (`/studio` and `/login`)

## Scope and mode

What a signed-out visitor sees at `/studio`, and the same page at `/login` (which pages send
people to with `?next=`). Mode: **Operate**. Visitors are exhibitors arriving from the
landing's "Open Studio" or "Make an exhibit", or sent here from a Studio page that needs an
account. The signed-in Studio (exhibit list, editor) is not in scope and keeps its older UI.

## Strategy

- **Task:** sign in (Google, or email and password) or create an account, then continue to
  `next` (a new exhibit when they came from "Make an exhibit").
- **Rule (owner, 2026-10-26):** adding an exhibit needs an account. Signed-out `/studio/new`
  redirects here with `?next=/studio/new`. A copy with no Supabase has no sign-in, so this
  page offers "Start a draft" instead and the Studio stays an in-tab draft.
- **States:** sign in, create account, busy, error (OAuth error codes from `/auth/callback`,
  password errors), no backend.
- **Structure (owner pick, 2026-10-27, after one re-roll):** "Taped sheet".

## Direction contract

THESIS: Signing in is one paper form taped to the exhibitor's cutting mat, the landing
page's workbench carried into the Studio's front door. It refuses the centred white login
card on a blank page.

OWN-WORLD: The landing's world unchanged: mat green with the 1 cm grid, cream rulers and
pointer cursor, one off-white sheet with masking tape across its top edge and the rest
shadow, everything on it printed in ink, square corners, the label-yellow tape as the only
action colour.

STORY: The visitor recognises the workbench from the landing, sees why an account is needed
and what an exhibit takes, signs in with Google or email, and lands where they were going.

FIRST VIEWPORT: Rulers and the printed nav (wordmark, How it works, Try the demo, Home). One
sheet, up to 540px, centred: "Sign in to the Studio", one sentence, Continue with Google,
"or with email", email, password, the yellow tape "Sign in", create-account link, then a
ruled row of three needs (STL file, a print, a printer) and the terms line. Fine print on
the mat below.

FORM: Taped sheet, position 2 on the ordered list. seed:d324d36251b49ce7

SIGNATURE: The sheet settles onto the mat once on load; the rulers' yellow cursor follows
the pointer; the tape straightens and lifts on hover.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Open decisions

- Google sign-in errors still return through `/login`, which now shows this same page.
