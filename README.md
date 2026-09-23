# ExhibitAR

Turn any 3D-printed object into an AR exhibit. An exhibitor uploads an STL,
marks points of interest and prints a paper placement mat with tracking
markers; visitors scan a QR code and see labels registered onto the real object.

- Product spec: [docs/SPEC.md](docs/SPEC.md)
- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Tasks / workstreams: [docs/TASKS.md](docs/TASKS.md)
- Agent/contributor rules: [CLAUDE.md](CLAUDE.md)

## Setup

```bash
pnpm install
cp .env.example .env.local   # fill in Supabase URL + publishable key
pnpm dev
```

| Command                       | What it does                                                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                    | local dev server on http://localhost:3000                                                                               |
| `pnpm lint && pnpm typecheck` | ESLint + `next typegen` + `tsc --noEmit`                                                                                |
| `pnpm test`                   | Vitest unit tests (`src/**/*.test.ts`, `tests/**/*.test.ts`)                                                            |
| `pnpm test:e2e`               | Playwright smoke tests (starts its own dev server on :3100)                                                             |
| `pnpm fixtures`               | writes fixture STLs (binary + ASCII) to `tests/fixtures/out/`                                                           |
| `pnpm demo`                   | runs the full geometry + mat pipeline on every fixture → `tests/fixtures/out/demo/` (GLB, mat SVG/PDF, marker PNGs, QR) |
| `pnpm mock`                   | regenerates `tests/fixtures/project.mock.json` + `public/fixtures/*` from the real pipeline                             |

## Try the AR viewer (Android)

1. Phone: Chrome + "Google Play Services for AR"; enable `chrome://flags/#webxr-incubations`.
2. Print `http://localhost:3000/fixtures/mock-cube-mat.pdf` at **Actual size** (A4 landscape).
3. `pnpm dev`, connect the phone by USB, `adb reverse tcp:3000 tcp:3000`.
4. On the phone open `http://localhost:3000/v/mockcube01?debug` → **Start AR** → point at the mat.

Full checklist: [docs/DEVICE-TESTS.md](docs/DEVICE-TESTS.md). Findings: [docs/D0-FINDINGS.md](docs/D0-FINDINGS.md).

## Testing WebXR on a phone (HTTPS)

WebXR only runs in a secure context. Three options, easiest first:

1. **Android over USB (recommended for Android).** Plain `pnpm dev`, then
   forward the port so the phone sees it as `localhost` (a secure context):

   ```bash
   adb reverse tcp:3000 tcp:3000
   ```

   Open `http://localhost:3000` in Chrome on the phone. Remote-debug via
   `chrome://inspect` on the desktop.

2. **Over Wi-Fi with a local certificate.**

   ```bash
   pnpm dev --experimental-https --hostname 0.0.0.0
   ```

   Next.js generates a certificate with mkcert. The phone must trust the mkcert
   root CA (`mkcert -CAROOT` → install `rootCA.pem` on the device), otherwise
   WebXR will refuse the page. Browse to `https://<your-LAN-IP>:3000`.

3. **Vercel preview deployment.** Every pushed branch gets an HTTPS preview URL.
   Previews are behind Vercel Authentication, so sign in on the phone first
   (or use the production domain for public audience tests).

## Deployment

- GitHub: `Jin-hiroo/exhibitar` (private). Pushes deploy to Vercel project
  `exhibitar` (team _jin-hiroo's projects_); `main` → production, branches → previews.
- Supabase project `exhibitar` (ref `abrbtlqpqjfvsyhvzgdg`, ap-northeast-1).
- Env vars are set on Vercel for all environments; see `.env.example`.
