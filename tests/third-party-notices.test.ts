import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectNotices,
  formatNotices,
  listProductionPackages,
  noticesFor,
  readNoticeFiles,
  type InstalledPackage,
} from '../scripts/third-party-notices-lib';

/** A folder with the given files; names ending in / are folders. */
function fakeDir(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'notices-'));
  for (const [name, text] of Object.entries(files)) {
    const full = path.join(dir, name);
    if (name.endsWith('/')) {
      mkdirSync(full, { recursive: true });
    } else {
      mkdirSync(path.dirname(full), { recursive: true });
      writeFileSync(full, text);
    }
  }
  return dir;
}

function installed(
  name: string,
  dir: string,
  license = 'MIT',
  extra: Partial<InstalledPackage> = {},
): InstalledPackage {
  return { name, dir, license, ...extra };
}

const manifest = (m: Record<string, unknown>) => JSON.stringify(m);

describe('third-party notices', () => {
  it('walks dependencies, optional dependencies and installed peers like Node resolves them', () => {
    const root = fakeDir({
      'package.json': manifest({
        dependencies: { a: '1', 'missing-binary': '1' },
        optionalDependencies: { 'missing-binary': '1' },
        devDependencies: { dev: '1' },
      }),
      'node_modules/a/package.json': manifest({
        name: 'a',
        version: '1.0.0',
        license: { type: 'MIT' },
        author: { name: 'Ann (Research) Foundation' },
        dependencies: { b: '2' },
        peerDependencies: { peer: '1', 'optional-peer': '1', 'absent-peer': '1' },
        peerDependenciesMeta: { 'optional-peer': { optional: true } },
      }),
      'node_modules/a/node_modules/b/package.json': manifest({
        name: 'b',
        version: '2.0.0',
        licenses: [{ type: 'MIT' }, { type: 'Apache-2.0' }],
        author: 'Bob <bob@example.com> (https://example.com)',
      }),
      'node_modules/b/package.json': manifest({ name: 'b', version: '1.0.0', license: 'ISC' }),
      'node_modules/peer/package.json': manifest({
        name: 'peer',
        version: '1.0.0',
        license: 'ISC',
      }),
      'node_modules/optional-peer/package.json': manifest({
        name: 'optional-peer',
        version: '1.0.0',
      }),
      'node_modules/dev/package.json': manifest({ name: 'dev', version: '1.0.0' }),
    });
    const found = listProductionPackages(root)
      .map((p) => [p.name, path.basename(path.dirname(path.dirname(p.dir))), p.license, p.author])
      .sort((x, y) => String(x[0]).localeCompare(String(y[0])));
    expect(found).toEqual([
      ['a', path.basename(root), 'MIT', 'Ann (Research) Foundation'],
      ['b', 'a', '(MIT OR Apache-2.0)', 'Bob'], // a's own copy, not the hoisted b@1
      // an installed optional peer may be loaded at run time, so it is listed
      ['optional-peer', path.basename(root), 'Unknown', undefined],
      ['peer', path.basename(root), 'ISC', undefined],
    ]);

    const broken = fakeDir({ 'package.json': manifest({ dependencies: { gone: '1' } }) });
    expect(() => listProductionPackages(broken)).toThrow(
      /Not installed: gone \(needed by the app\)/,
    );
  });

  it("follows pnpm's symlinked layout and lists each real folder once", () => {
    const root = fakeDir({
      'package.json': manifest({ dependencies: { x: '1', y: '1' } }),
      'node_modules/.pnpm/x@1.0.0/node_modules/x/package.json': manifest({
        name: 'x',
        version: '1.0.0',
        dependencies: { y: '1' },
      }),
      'node_modules/.pnpm/y@1.0.0/node_modules/y/package.json': manifest({
        name: 'y',
        version: '1.0.0',
      }),
    });
    const store = path.join(root, 'node_modules/.pnpm');
    symlinkSync('../../y@1.0.0/node_modules/y', path.join(store, 'x@1.0.0/node_modules/y'));
    symlinkSync('.pnpm/x@1.0.0/node_modules/x', path.join(root, 'node_modules/x'));
    symlinkSync('.pnpm/y@1.0.0/node_modules/y', path.join(root, 'node_modules/y'));
    const found = listProductionPackages(root);
    expect(found.map((p) => p.name).sort()).toEqual(['x', 'y']);
    expect(found.every((p) => p.dir.includes(`${path.sep}.pnpm${path.sep}`))).toBe(true);
  });

  it('reads licence and notice files at any depth, not code, folders or nested node_modules', () => {
    const dir = fakeDir({
      'package.json': '{"version":"1.2.3"}',
      'LICENSE-MIT': ' MIT text \n',
      'NOTICE.md': 'notice',
      THIRD_PARTY_NOTICES: 'bsd',
      'ThirdPartyNotices.txt': 'ms style',
      'COPYING.LESSER': 'lgpl',
      LICENCE: '',
      'license-checker.js': 'not a licence',
      'README.md': 'readme',
      'licenses/': '',
      'dist/compiled/web-vitals/LICENSE': 'apache',
      'node_modules/dep/LICENSE': 'listed under its own package',
    });
    symlinkSync(path.join(dir, 'dist'), path.join(dir, 'linked'));
    expect(readNoticeFiles(dir).map((f) => [f.name, f.text])).toEqual([
      ['COPYING.LESSER', 'lgpl'],
      ['LICENSE-MIT', 'MIT text'],
      ['NOTICE.md', 'notice'],
      ['THIRD_PARTY_NOTICES', 'bsd'],
      ['ThirdPartyNotices.txt', 'ms style'],
      ['dist/compiled/web-vitals/LICENSE', 'apache'],
    ]);
  });

  it('keeps one entry per name and version with the notices of every copy, sorted', () => {
    const a = fakeDir({ 'package.json': '{"version":"2.0.0"}', NOTICE: 'shared' });
    const aPeer = fakeDir({
      'package.json': '{"version":"2.0.0"}',
      NOTICE: 'shared',
      LICENSE: 'second copy',
    });
    const b = fakeDir({ 'package.json': '{"version":"1.0.0"}', LICENSE: 'b licence' });
    const alpha = installed('alpha', b, 'CC-BY-4.0', { author: 'Ada', homepage: 'https://alpha' });
    for (const copies of [
      [a, aPeer],
      [aPeer, a],
    ]) {
      const notices = noticesFor([...copies.map((dir) => installed('zeta', dir)), alpha]);
      expect(notices.map((p) => `${p.name}@${p.version}`)).toEqual(['alpha@1.0.0', 'zeta@2.0.0']);
      expect(notices[1].files.map((f) => f.name)).toEqual(['LICENSE', 'NOTICE']);
    }

    const text = formatNotices(noticesFor([installed('zeta', a), installed('zeta', aPeer), alpha]));
    expect(text).toContain('(2 packages)');
    // the author stays even though the package ships a licence file (CC BY attribution)
    expect(text).toContain(
      'alpha 1.0.0\nLicence: CC-BY-4.0\nAuthor: Ada\nhttps://alpha\n\n--- LICENSE\n\nb licence',
    );
  });

  it('uses a reviewed fallback for a package without licence files, and fails without one', () => {
    const bare = fakeDir({ 'package.json': '{"version":"0.0.1"}', 'index.js': '' });
    const fallbackDir = fakeDir({ 'bare.txt': 'Copyright (c) Upstream\nMIT text\n' });
    const fallbacks = [{ name: /^bare$/, license: 'MIT', file: 'bare.txt' }];
    const json = (license: string) => [installed('bare', bare, license)];

    const [notice] = noticesFor(json('MIT'), { fallbacks, fallbackDir });
    expect(notice.files).toEqual([
      {
        name: 'bare.txt (not in the package; reviewed upstream licence)',
        text: 'Copyright (c) Upstream\nMIT text',
      },
    ]);
    // the package changed its licence: the reviewed text no longer applies
    expect(() => noticesFor(json('ISC'), { fallbacks, fallbackDir })).toThrow(
      /no reviewed licence text for bare@0\.0\.1 \(ISC\)/,
    );
    expect(() => noticesFor(json('MIT'), { fallbacks: [] })).toThrow(/bare@0\.0\.1 \(MIT\)/);
  });

  it("does not take a NOTICE or a bundled component's licence for the package's own licence", () => {
    const fallbackDir = fakeDir({ 'own.txt': 'own licence' });
    const fallbacks = [{ name: /^partial$/, license: 'MIT', file: 'own.txt' }];
    const cases: Record<string, string>[] = [
      { NOTICE: 'attribution only' },
      { 'dist/vendor/LICENSE': 'bundled' },
    ];
    for (const files of cases) {
      const dir = fakeDir({ 'package.json': '{"version":"1.0.0"}', ...files });
      const json = [installed('partial', dir)];
      expect(() => noticesFor(json, { fallbacks: [] })).toThrow(/partial@1\.0\.0/);
      const [notice] = noticesFor(json, { fallbacks, fallbackDir });
      expect(notice.files.map((f) => f.text)).toEqual(['own licence', Object.values(files)[0]]);
    }
  });

  it('orders different texts at the same path the same way whatever the install order', () => {
    const one = fakeDir({ 'package.json': '{"version":"1.0.0"}', LICENSE: 'text B' });
    const two = fakeDir({ 'package.json': '{"version":"1.0.0"}', LICENSE: 'text A' });
    const out = (paths: string[]) =>
      formatNotices(noticesFor(paths.map((dir) => installed('demo', dir))));
    expect(out([one, two])).toBe(out([two, one]));
    expect(out([one, two]).indexOf('text A')).toBeLessThan(out([one, two]).indexOf('text B'));
  });

  it('says so when a package declares no licence', () => {
    const dir = fakeDir({ 'package.json': '{"version":"1.0.0"}', LICENSE: 'MIT text' });
    expect(formatNotices(noticesFor([installed('quiet', dir, 'Unknown')]))).toContain(
      'quiet 1.0.0\nLicence: not declared in package.json (see the licence file)',
    );
  });

  it("lists this app's real dependencies with every notice they need", () => {
    const notices = collectNotices(process.cwd());
    const find = (name: string) => notices.find((p) => p.name === name);

    expect(find('matar')?.license).toBe('Apache-2.0');
    expect(find('matar')?.files.map((f) => f.name)).toEqual([
      'LICENSE',
      'NOTICE',
      'THIRD_PARTY_NOTICES',
    ]);
    expect(find('three')?.license).toBe('MIT');
    expect(notices.some((p) => p.name === 'typescript')).toBe(false); // dev only
    // an optional peer of Next.js that is installed (here as a dev tool) is listed too
    expect(notices.some((p) => p.name === '@playwright/test')).toBe(true);
    // ships no licence file: the reviewed upstream licence names Poimandres
    expect(find('@react-three/fiber')?.files[0].text).toContain('Poimandres');
    // Next bundles other packages (its own React build, web-vitals, …) with their licences
    expect(find('next')?.files.some((f) => f.name.startsWith('dist/compiled/'))).toBe(true);
    expect(notices.every((p) => p.files.length > 0)).toBe(true);

    const text = formatNotices(notices);
    expect(text).toContain('The Regents of The University of Michigan');
    expect(text).toContain('Author: Ben Briggs'); // caniuse-lite, CC BY 4.0
  });
});
