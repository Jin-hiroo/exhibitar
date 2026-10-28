# vendor/

`matar-0.1.0.tgz`: the matar tracking library (Apache-2.0,
github.com/Jin-hiroo/matar), packed with `pnpm build && pnpm pack` from matar
commit `55f4d0a` while matar isn't on npm (docs/MATAR-MIGRATION.md, "How
ExhibitAR depends on matar"). It includes matar's unreleased changes after the
v0.1.0 tag (its CHANGELOG, `[Unreleased]`).

To update it: build and pack matar, replace the tarball here, keep
`"matar": "file:vendor/matar-<version>.tgz"` in package.json in step, run
`pnpm install`, and commit the tarball with the lockfile.
