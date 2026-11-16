import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectNotices,
  formatNotices,
  noticesFor,
  parsePnpmLicenses,
  readNoticeFiles,
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

function pnpmJson(groups: Record<string, Record<string, unknown>[]>): string {
  return JSON.stringify(groups);
}

describe('third-party notices', () => {
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
    const json = pnpmJson({
      MIT: [{ name: 'zeta', versions: ['2.0.0', '2.0.0'], paths: [a, aPeer], license: 'MIT' }],
      'CC-BY-4.0': [
        {
          name: 'alpha',
          versions: ['1.0.0'],
          paths: [b],
          license: 'CC-BY-4.0',
          author: 'Ada',
          homepage: 'https://alpha',
        },
      ],
    });
    for (const paths of [
      [a, aPeer],
      [aPeer, a],
    ]) {
      const swapped = json.replace(JSON.stringify([a, aPeer]), JSON.stringify(paths));
      const notices = noticesFor(parsePnpmLicenses(swapped));
      expect(notices.map((p) => `${p.name}@${p.version}`)).toEqual(['alpha@1.0.0', 'zeta@2.0.0']);
      expect(notices[1].files.map((f) => f.name)).toEqual(['LICENSE', 'NOTICE']);
    }

    const text = formatNotices(noticesFor(parsePnpmLicenses(json)));
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
    const json = (license: string) =>
      pnpmJson({ [license]: [{ name: 'bare', versions: ['0.0.1'], paths: [bare], license }] });

    const [notice] = noticesFor(parsePnpmLicenses(json('MIT')), { fallbacks, fallbackDir });
    expect(notice.files).toEqual([
      {
        name: 'bare.txt (not in the package; reviewed upstream licence)',
        text: 'Copyright (c) Upstream\nMIT text',
      },
    ]);
    // the package changed its licence: the reviewed text no longer applies
    expect(() => noticesFor(parsePnpmLicenses(json('ISC')), { fallbacks, fallbackDir })).toThrow(
      /no reviewed licence text for bare@0\.0\.1 \(ISC\)/,
    );
    expect(() => noticesFor(parsePnpmLicenses(json('MIT')), { fallbacks: [] })).toThrow(
      /bare@0\.0\.1 \(MIT\)/,
    );
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
      const json = pnpmJson({
        MIT: [{ name: 'partial', versions: ['1.0.0'], paths: [dir], license: 'MIT' }],
      });
      expect(() => noticesFor(parsePnpmLicenses(json), { fallbacks: [] })).toThrow(
        /partial@1\.0\.0/,
      );
      const [notice] = noticesFor(parsePnpmLicenses(json), { fallbacks, fallbackDir });
      expect(notice.files.map((f) => f.text)).toEqual(['own licence', Object.values(files)[0]]);
    }
  });

  it('orders different texts at the same path the same way whatever the install order', () => {
    const one = fakeDir({ 'package.json': '{"version":"1.0.0"}', LICENSE: 'text B' });
    const two = fakeDir({ 'package.json': '{"version":"1.0.0"}', LICENSE: 'text A' });
    const out = (paths: string[]) =>
      formatNotices(
        noticesFor(
          parsePnpmLicenses(
            pnpmJson({
              MIT: [{ name: 'demo', versions: ['1.0.0', '1.0.0'], paths, license: 'MIT' }],
            }),
          ),
        ),
      );
    expect(out([one, two])).toBe(out([two, one]));
    expect(out([one, two]).indexOf('text A')).toBeLessThan(out([one, two]).indexOf('text B'));
  });

  it('rejects pnpm output it does not understand', () => {
    expect(() => parsePnpmLicenses('{"MIT":[{"name":"x","paths":[]}]}')).toThrow(/no install path/);
    expect(() => parsePnpmLicenses('{"MIT":[{"paths":["/x"]}]}')).toThrow(/no name/);
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
