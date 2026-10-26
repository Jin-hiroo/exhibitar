---
version: 1
slug: "src-app-privacy-page-tsx"
primary_target: "src/app/privacy/page.tsx"
related_targets: ["src/app/terms/page.tsx","src/components/legal"]
---

# Legal pages (`/privacy`, `/terms`)

## Scope and mode

The public Privacy policy and Terms of service. Mode: **Read**. Readers are exhibitors deciding
whether to sign up, visitors who followed a footer link, and reviewers (for example Google's
OAuth consent-screen check, which needs both URLs public). Linked from the landing footer and
the sign-in page.

## Strategy

- **Reader's question:** what happens to my model, my account and my visitors' data, and what
  am I agreeing to. Answered first by a five-line plain-language summary, then by numbered
  sections that can be cited ("see section 7").
- **Source of truth:** the code, not intentions. Every data claim was checked against the repo
  (Supabase schema and storage buckets, auth methods, Vercel Analytics and Speed Insights, browser
  storage keys, the Needle App Clip link, the in-tab draft). Update the pages when those change.
- **Owner decisions (2026-10-26):** operator named as Jin Sa; laws of Japan, Tokyo District Court
  as court of first instance; contact email still to be supplied (one constant in
  `src/components/legal/operator.ts`).
- **Language:** English and Japanese on one URL with the landing page's switch. Neither version
  is declared to prevail yet (open decision).
- **Feels wrong if:** a wall of grey legalese, or a cute page that hides what the terms say.

## Direction contract

THESIS: The legal pages are sheets of the same workbench: a short green mat carries the title and
an engineering drawing's title block, and the document is printed in ink on the paper below, a
calm numbered reading column with its contents beside it. It refuses the generic centred
legal-text page with no wayfinding.

OWN-WORLD: The landing page's Cutting Mat system unchanged: mat green header with cream rulers
and grid, masking-tape edge strips, warm paper sheet, ink at three strengths, Barlow Condensed
for titles and numerals, Barlow for reading, M PLUS 1 for Japanese headings. The title block is
cream-ruled cells (In effect from, Operator, Covers, Sheet n / 2 linking the other document). The
summary is printed on a white plate inside crop marks. Bullets are small printed ink squares.
Label yellow stays reserved for selection and the ruler cursor.

STORY: The reader sees which document, when it took effect and who runs the service, reads the
short version, jumps to the section they care about, and can move to the other sheet.

FIRST VIEWPORT: Top ruler; the site nav on the mat; left seven columns the title (headline size)
and one-sentence lede; right five columns the 2 x 2 title block; the paper's taped edge; below
it the contents list (3 columns, sticky) beside the summary plate (8 columns).

FORM: extension of the established Cutting Mat world to a Read surface, structured by the
document's own content (summary, contents, numbered sections). seed: none (no roll was run: a
narrow request inside an established world, so new-work skips concept-seed)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Open decisions

- Contact email (blocks shipping).
- Which language version prevails if they differ.
- Whether to add delete buttons (project, account) so deletion isn't by request only.
- Have the text reviewed by a lawyer before relying on it.
