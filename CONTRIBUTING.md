# Contributing to ExhibitAR

This repository is private. These rules apply to everyone who works on it.

## Before you start

- Read [docs/SPEC.md](docs/SPEC.md) (what the app does) and
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (how it works: frames, units, data model).
- The "Core ideas" and "Conventions" in [CLAUDE.md](CLAUDE.md) apply to everyone, not only to
  coding agents. The two that matter most: tracking uses only the paper mat, and the original
  STL never leaves the exhibitor's browser.
- For anything bigger than a small fix, open an issue first so we can agree on the approach.

## Development

```bash
pnpm install
cp .env.example .env.local   # optional: Supabase URL + publishable key
pnpm dev
```

The Studio and the demo exhibit at `/v/mockcube01` work without Supabase. Sign-in and
publishing need a Supabase project with the migrations applied; see "Self-hosting" in the
[README](README.md).

## Pull requests

Run these before you push:

```bash
pnpm lint && pnpm typecheck
pnpm test
pnpm test:e2e
pnpm format:check
```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs the same checks on every pull
request. It also builds for production, runs the e2e tests against that build, and fails if an
existing migration was changed. A pull request can merge only when CI passes.

After a merge, Vercel deploys `main` to production. Migrations are not applied automatically: a
maintainer applies new files in `supabase/migrations/` to the hosted Supabase project by hand.

- Keep commits small and focused. Messages follow the existing style, for example
  `fix(viewer): …` or `feat(mat): …`.
- Put pure geometry and mat logic in `src/lib/**` with unit tests. Keep React components thin.
- If you change `src/lib/types.ts`, say so in the PR description: every part of the app uses it.
- Database changes go in a new file in `supabase/migrations/`. Never edit an applied migration.
- Never commit secrets, `.env*` files or user STL files.

## Reporting security issues

Don't open a public issue. See [SECURITY.md](SECURITY.md).

## License

ExhibitAR is proprietary (see [LICENSE](LICENSE)); only the tracking library
[matar](https://github.com/Jin-hiroo/matar) is open source. Contribute only under terms agreed
with the copyright holder.

- Don't copy ExhibitAR code into matar or anywhere public.
- Add only dependencies whose licence allows closed-source use (MIT, BSD, ISC, Apache 2.0 and
  similar; no GPL or AGPL in the app). Vendored code keeps its licence and notices (see
  [NOTICE](NOTICE)).
- `pnpm build` writes every production dependency's licence to `/third-party-notices.txt`. A
  package that ships no licence file stops the build until its upstream licence is added to
  `scripts/third-party-licences/` and listed in `FALLBACKS` (`scripts/third-party-notices-lib.ts`).
