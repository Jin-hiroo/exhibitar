/**
 * `pnpm notices`: writes public/third-party-notices.txt, the licences and notices of
 * every production dependency (see third-party-notices-lib.ts). `pnpm build` runs it
 * first, so every deployment serves the list for exactly what it installed. The file
 * is generated, not committed.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectNotices, formatNotices } from './third-party-notices-lib';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, 'public', 'third-party-notices.txt');

const notices = collectNotices(root);
if (notices.length === 0) throw new Error('pnpm licenses listed no production dependencies');
writeFileSync(out, formatNotices(notices));
console.log(`notices: ${notices.length} packages → ${path.relative(root, out)}`);
