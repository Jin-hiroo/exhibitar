# Contributing to ExhibitAR

Thanks for helping. Bug reports, device test results and pull requests are all welcome.

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

ExhibitAR is licensed under the [Apache License 2.0](LICENSE). By submitting a contribution you
agree that it is licensed under the same terms (section 5 of the license).
