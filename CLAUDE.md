# CLAUDE.md — ExhibitAR (working title)

A web app that turns any 3D-printed object into an AR exhibit.
An **Exhibitor** uploads an STL, marks points of interest, and prints a paper
**placement mat** (SVG) with tracking markers. An **Audience** member scans a QR
code, points their phone at the mat + object, and sees labels, highlights and
descriptions registered onto the real object.

Hosted on **Vercel**. Read these before working:

- `docs/SPEC.md` — product spec: roles, user flows, features (the "what")
- `docs/ARCHITECTURE.md` — stack, coordinate systems, data model, pipelines (the "how")
- `docs/TASKS.md` — workstreams, ownership, order, acceptance criteria (the "who/when")

If these docs and the code disagree, stop and ask; don't silently pick one.

## Core ideas (never violate)

1. **Tracking uses only the paper mat markers.** The app never tries to
   recognize the object itself. The object's pose is known because the exhibitor
   placed it on the printed outline.
2. **The original STL never leaves the Exhibitor's browser.** All geometry
   processing runs client-side (Web Workers). Only the simplified GLB, mat
   metadata, marker images and annotations are uploaded.
3. **One simplified mesh is the source of truth after publishing.** The
   annotation editor, region painting, occlusion and calibration all use the
   *same* stored GLB. Never re-simplify a published model; regions store
   triangle indices into it.
4. **Units:** millimetres in STL/SVG/UI; metres in three.js/WebXR runtime.
   Convert only at clearly named boundaries (`mmToM`, `mToMm` in `src/lib/units.ts`).
5. **Coordinate frame:** the *mat frame* is the world for everything
   (see ARCHITECTURE.md §2). Don't invent other frames.
6. **Audience side is public, mobile-first, and must load fast** (target:
   interactive in < 3 s on 4G; GLB budget ≤ 1.5 MB).

## Stack

Next.js (App Router) + TypeScript (strict) · three.js · React Three Fiber for
the Studio editor · plain three.js + WebXR for the AR viewer · Needle Go App
Clip for iOS WebXR · meshoptimizer (simplification) · Supabase (auth, Postgres,
storage) · Vercel hosting · Vitest + Playwright.

## Commands

```bash
pnpm install
pnpm dev          # local dev (use `pnpm dev --experimental-https` for WebXR on device)
pnpm test         # vitest
pnpm test:e2e     # playwright
pnpm lint && pnpm typecheck
```

## Conventions

- TypeScript strict; no `any` in `src/lib/**`.
- Shared types live in `src/lib/types.ts`. Changing them affects every
  workstream: do it deliberately and note it in the PR/commit message.
- Pure geometry/mat logic goes in `src/lib/**` as framework-free functions with
  unit tests. React components stay thin.
- Heavy work (STL parsing, simplification, footprint, SVG generation) runs in
  Web Workers via `src/workers/**`.
- Never log or upload user STL content.
- **Python:** if any tooling/scripts are written in Python, ALWAYS create and
  use a virtual environment (`python -m venv .venv && source .venv/bin/activate`).
  Never install packages globally.
- Small, focused commits. Each task in `docs/TASKS.md` should be completable and
  testable on its own.

## Working with parallel sessions / subagents

Work is split into workstreams with **owned directories** (see TASKS.md).
Stay inside your workstream's directories. If you need something from another
workstream, depend on the interface in `src/lib/types.ts` and use a stub/mock
until the real implementation lands. Update the checkbox in `docs/TASKS.md`
when a task is done.

## Unknowns to verify, not assume

- Current status of WebXR `image-tracking` in Android Chrome (may require a flag).
- Needle Go App Clip: image-tracking support and how a plain three.js app hooks in.
  Read the docs at engine.needle.tools before implementing.
- These are Task D0 in TASKS.md. Their outcome can change the AR viewer design.
