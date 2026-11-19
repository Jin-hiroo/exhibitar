/**
 * Open-source notices for the hosted app (`pnpm notices`, run by `pnpm build`).
 *
 * ExhibitAR is closed source, but it ships open-source packages to the browser and
 * runs them on the server. Their licences (MIT, BSD, Apache 2.0 and others) ask that
 * their copyright and licence notices go along with every copy, so the build writes
 * them all to one text file, served at /third-party-notices.txt. The list is every
 * installed production dependency, found by walking `dependencies` and
 * `optionalDependencies` through node_modules the way Node resolves them (not with
 * `pnpm licenses`, which needs pnpm's store, absent when Vercel restores a cached
 * node_modules). That is a superset of what reaches the browser. It includes the
 * licence files of components bundled inside the packages
 * (next/dist/compiled/*). A package that ships no licence file gets a reviewed copy of
 * its upstream licence from scripts/third-party-licences/; without one the build fails.
 */
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface NoticeFile {
  name: string;
  text: string;
}

export interface PackageNotice {
  name: string;
  version: string;
  /** SPDX expression from the package's package.json, e.g. `MIT` or `(MPL-2.0 OR Apache-2.0)`. */
  license: string;
  homepage?: string;
  author?: string;
  /** The licence and notice files, by path in the package (or a reviewed fallback). */
  files: NoticeFile[];
}

/** One installed copy of a package. */
export interface InstalledPackage {
  name: string;
  license: string;
  dir: string;
  homepage?: string;
  author?: string;
}

/** LICENSE, LICENCE.md, LICENSE-MIT, COPYING.LESSER, NOTICE, THIRD_PARTY_NOTICES, … */
const NOTICE_FILE = /^(licen[cs]e|copying|notice|third[-_]?party[-_]?notices?)([-_.][\w.-]*)?$/i;
/** …but not code or data that happens to start with those words (license-checker.js). */
const NOT_TEXT = /\.(?:[cm]?[jt]sx?|json|map|html?|css)$/i;
/** The package's own licence text: a LICENSE/LICENCE/COPYING file at its top level. */
const OWN_LICENCE = /^(licen[cs]e|copying)([-_.][\w.-]*)?$/i;

const RULE = '-'.repeat(79);

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

interface Manifest {
  name?: unknown;
  version?: unknown;
  license?: unknown;
  licenses?: unknown;
  author?: unknown;
  homepage?: unknown;
  dependencies?: unknown;
  optionalDependencies?: unknown;
  peerDependencies?: unknown;
  peerDependenciesMeta?: unknown;
}

function readManifest(dir: string): Manifest {
  return JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as Manifest;
}

function typeOf(value: unknown): string | undefined {
  return typeof value === 'string'
    ? text(value)
    : value && typeof value === 'object'
      ? text((value as { type?: unknown }).type)
      : undefined;
}

/** The licence a package.json declares: `license`, or the old `{ type }` / `licenses` forms. */
export function declaredLicense(manifest: Manifest): string {
  const one = typeOf(manifest.license);
  if (one) return one;
  const many = Array.isArray(manifest.licenses)
    ? manifest.licenses.map(typeOf).filter((t): t is string => t !== undefined)
    : [];
  if (many.length > 0) return many.length === 1 ? many[0] : `(${many.join(' OR ')})`;
  return 'Unknown';
}

/** `Name <email> (url)` → `Name`; `{ name }` → the name as given. */
export function authorName(author: unknown): string | undefined {
  if (typeof author === 'string') return text(author.replace(/\s*[<(].*$/, ''));
  if (author && typeof author === 'object') return text((author as { name?: unknown }).name);
  return undefined;
}

/**
 * Dependency names, each marked optional when a missing copy is fine: listed in
 * `optionalDependencies`, or a peer (the app or another package provides it). Installed
 * optional peers are kept even though most (Next.js's `@playwright/test`, `sass`, …) are
 * development tools: a package may load one at run time (Next.js tries
 * `@opentelemetry/api`), and listing too much is harmless while missing one is not.
 */
function dependenciesOf(manifest: Manifest): [name: string, optional: boolean][] {
  const keys = (v: unknown) => (v && typeof v === 'object' ? Object.keys(v) : []);
  const meta = manifest.peerDependenciesMeta;
  const peers = [...keys(manifest.peerDependencies), ...keys(meta)];
  const optional = new Set(keys(manifest.optionalDependencies));
  // npm also lists optional dependencies under `dependencies`; they stay optional.
  const required = new Set(keys(manifest.dependencies).filter((n) => !optional.has(n)));
  const names = new Set([...required, ...optional, ...peers]);
  return [...names].sort().map((n) => [n, !required.has(n)]);
}

/** Where Node finds package `name` from `fromDir`: the nearest node_modules/<name> upwards. */
function resolvePackageDir(name: string, fromDir: string): string | undefined {
  for (let dir = fromDir; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', name);
    if (existsSync(path.join(candidate, 'package.json'))) return realpathSync(candidate);
    if (path.dirname(dir) === dir) return undefined;
  }
}

/**
 * Every installed production dependency of the project at `root`: its `dependencies`,
 * `optionalDependencies` and installed peers, then theirs, resolved like Node from each
 * package's real folder. One entry per installed copy. A missing optional dependency
 * (another platform's binary) or peer is skipped; a missing required one throws.
 */
export function listProductionPackages(root: string): InstalledPackage[] {
  const found = new Map<string, InstalledPackage>();
  const missing: string[] = [];
  const queue = dependenciesOf(readManifest(root)).map(([name, optional]) => ({
    name,
    optional,
    from: root,
  }));
  for (let next = queue.shift(); next; next = queue.shift()) {
    const dir = resolvePackageDir(next.name, next.from);
    if (!dir) {
      if (!next.optional)
        missing.push(`${next.name} (needed by ${path.relative(root, next.from) || 'the app'})`);
      continue;
    }
    if (found.has(dir)) continue;
    const manifest = readManifest(dir);
    found.set(dir, {
      name: text(manifest.name) ?? next.name,
      license: declaredLicense(manifest),
      dir,
      homepage: text(manifest.homepage),
      author: authorName(manifest.author),
    });
    for (const [name, optional] of dependenciesOf(manifest))
      queue.push({ name, optional, from: dir });
  }
  if (missing.length > 0) {
    throw new Error(`Not installed: ${missing.join(', ')}. Run pnpm install.`);
  }
  return [...found.values()];
}

/** Reviewed upstream licences for packages that ship none (scripts/third-party-licences/). */
export interface Fallback {
  name: RegExp;
  /** The licence the package must still declare for the text to apply. */
  license: string;
  file: string;
}

export const FALLBACKS: readonly Fallback[] = [
  { name: /^@next\/(env|swc-[\w-]+)$/, license: 'MIT', file: 'next.js.txt' },
  { name: /^@react-three\/fiber$/, license: 'MIT', file: 'react-three-fiber.txt' },
  { name: /^maath$/, license: 'MIT', file: 'maath.txt' },
  { name: /^stats-gl$/, license: 'MIT', file: 'stats-gl.txt' },
  { name: /^(client|server)-only$/, license: 'MIT', file: 'react-only-guards.txt' },
  { name: /^draco3d$/, license: 'Apache-2.0', file: 'draco.txt' },
  { name: /^@mediapipe\/tasks-vision$/, license: 'Apache-2.0', file: 'mediapipe.txt' },
  {
    name: /^@img\/sharp-libvips-[\w-]+$/,
    license: 'LGPL-3.0-or-later',
    file: 'sharp-libvips.txt',
  },
];

const FALLBACK_DIR = fileURLToPath(new URL('./third-party-licences/', import.meta.url));

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Top-level files first, then by path. */
const byPath = (a: NoticeFile, b: NoticeFile): number =>
  a.name.split('/').length - b.name.split('/').length ||
  compare(a.name, b.name) ||
  compare(a.text, b.text);

/**
 * The licence and notice files anywhere in one installed package, by path, including
 * those of components bundled inside it. Nested node_modules and symlinked folders are
 * skipped; empty files are left out.
 */
export function readNoticeFiles(dir: string): NoticeFile[] {
  const found: NoticeFile[] = [];
  const walk = (rel: string): void => {
    for (const entry of readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') walk(relPath);
        continue;
      }
      if (!NOTICE_FILE.test(entry.name) || NOT_TEXT.test(entry.name)) continue;
      const full = path.join(dir, relPath);
      if (!statSync(full, { throwIfNoEntry: false })?.isFile()) continue;
      const body = readFileSync(full, 'utf8').trim();
      if (body) found.push({ name: relPath, text: body });
    }
  };
  walk('');
  return found.sort(byPath);
}

const byNameThenVersion = (a: PackageNotice, b: PackageNotice): number =>
  compare(a.name, b.name) || compare(a.version, b.version);

/**
 * One entry per package name and version, in a stable order. Copies of one version
 * (peer-dependency variants) contribute every distinct notice file. A package with no
 * licence file of its own at its top level (a NOTICE or bundled components' licences
 * don't count) gets its reviewed fallback first; if there is none, or the package's
 * licence no longer matches it, this throws.
 */
export function noticesFor(
  installed: readonly InstalledPackage[],
  { fallbacks = FALLBACKS, fallbackDir = FALLBACK_DIR } = {},
): PackageNotice[] {
  const byKey = new Map<string, PackageNotice>();
  for (const p of installed) {
    const manifest = JSON.parse(readFileSync(path.join(p.dir, 'package.json'), 'utf8')) as {
      version?: unknown;
    };
    const version = text(manifest.version) ?? '0.0.0';
    const files = readNoticeFiles(p.dir);
    const seen = byKey.get(`${p.name}@${version}`);
    if (seen) {
      for (const f of files) {
        if (!seen.files.some((g) => g.name === f.name && g.text === f.text)) seen.files.push(f);
      }
      seen.files.sort(byPath);
      continue;
    }
    byKey.set(`${p.name}@${version}`, {
      name: p.name,
      version,
      license: p.license,
      homepage: p.homepage,
      author: p.author,
      files,
    });
  }

  const missing: string[] = [];
  for (const n of byKey.values()) {
    // A NOTICE or a bundled component's licence is not the package's own licence text.
    if (n.files.some((f) => !f.name.includes('/') && OWN_LICENCE.test(f.name))) continue;
    const fallback = fallbacks.find((f) => f.name.test(n.name));
    if (!fallback || fallback.license !== n.license) {
      missing.push(`${n.name}@${n.version} (${n.license})`);
      continue;
    }
    n.files.unshift({
      name: `${fallback.file} (not in the package; reviewed upstream licence)`,
      text: readFileSync(path.join(fallbackDir, fallback.file), 'utf8').trim(),
    });
  }
  if (missing.length > 0) {
    throw new Error(
      `No licence file and no reviewed licence text for ${missing.join(', ')}. Add the ` +
        'upstream licence to scripts/third-party-licences/ and list it in FALLBACKS.',
    );
  }
  return [...byKey.values()].sort(byNameThenVersion);
}

/** The notices of every installed production dependency of the project at `root`. */
export function collectNotices(root: string): PackageNotice[] {
  return noticesFor(listProductionPackages(root));
}

export function formatNotices(packages: readonly PackageNotice[]): string {
  const lines = [
    'Open-source software in ExhibitAR',
    '=================================',
    '',
    'ExhibitAR itself is not open source. It uses the open-source packages below,',
    'each under its own licence. For every production dependency of the app, this',
    'file gives the licence, the author the package names, and the licence and notice',
    'files it ships, including those of components bundled inside it. Where a package',
    `ships none, a reviewed copy of its upstream licence is given (${packages.length} packages).`,
    '',
  ];
  for (const p of packages) {
    const licence =
      p.license === 'Unknown' ? 'not declared in package.json (see the licence file)' : p.license;
    lines.push(RULE, `${p.name} ${p.version}`, `Licence: ${licence}`);
    if (p.author) lines.push(`Author: ${p.author}`);
    if (p.homepage) lines.push(p.homepage);
    for (const f of p.files) lines.push('', `--- ${f.name}`, '', f.text);
    lines.push('');
  }
  lines.push(RULE, '');
  return lines.join('\n');
}
