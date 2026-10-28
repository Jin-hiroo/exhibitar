import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { createBoard, DEFAULT_FAMILY, type BoardTag } from 'matar';
import { intrinsicsFromFov, lookAtPose, renderBoard } from 'matar/testing';

/**
 * AR in the page with Chromium's fake camera playing a picture of the mock
 * exhibit's printed mat (/v/mockcube01), rendered by matar's own test renderer
 * at a known camera pose: the camera opens, matar's worker finds the tags,
 * and the status says how many it tracks. Real phones and paper are a device
 * test (docs/DEVICE-TESTS.md).
 */
const W = 640;
const H = 480;

/** A two-frame Y4M (I420) still of the mock mat, ≈ 400 mm away, tilted ≈ 18°. */
function fakeCameraVideo(): string {
  const { mat } = JSON.parse(
    readFileSync(new URL('../fixtures/project.mock.json', import.meta.url), 'utf8'),
  ) as { mat: { tagFamily?: string; tags: BoardTag[] } };
  const board = createBoard({ family: mat.tagFamily ?? DEFAULT_FAMILY, tags: mat.tags });
  const img = renderBoard({
    board,
    // the tracker's 68° long-side prior, so the pose it finds needs no calibration
    intrinsics: intrinsicsFromFov(W, H, 68),
    boardFromCamera: lookAtPose([0, 380, 125], [0, 0, 0]),
    blurSigmaPx: 0.8,
    noiseSigma: 2,
    supersample: 2,
  });
  const chroma = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
  const frame = Buffer.concat([Buffer.from('FRAME\n'), Buffer.from(img.data), chroma]);
  const dir = join(tmpdir(), 'exhibitar-e2e');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'mock-mat.y4m');
  writeFileSync(
    file,
    Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F30:1 Ip A1:1 C420jpeg\n`), frame, frame]),
  );
  return file;
}

test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${fakeCameraVideo()}`,
    ],
  },
  permissions: ['camera'],
});

test('Start AR tracks the printed mat; Exit returns to the card', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/v/mockcube01');
  const start = page.getByRole('button', { name: 'Start AR' });
  await expect(start).toBeEnabled({ timeout: 15_000 });
  await start.click();
  const tracking = page.getByText(/^Tracking · (\d+) tags$/);
  await expect(tracking).toBeVisible({ timeout: 20_000 });
  const used = Number(/(\d+) tags/.exec((await tracking.textContent()) ?? '')?.[1]);
  expect(used).toBeGreaterThanOrEqual(12);
  await expect(page.locator('canvas')).toHaveCount(1);

  // the debug panel: the worker runs as a module, and the pose fits the tags
  await page.getByRole('button', { name: 'Debug' }).click();
  await expect(page.getByText(/worker\s+module/)).toBeVisible();
  const err = Number(
    /err\s+([\d.]+) px/.exec((await page.locator('pre').textContent()) ?? '')?.[1],
  );
  console.log(`fake-camera mat: tracking ${used} tags, err ${err} px`);
  expect(err).toBeLessThan(1);
  if (process.env.AR_SHOT) await page.screenshot({ path: process.env.AR_SHOT });

  await page.getByRole('button', { name: /Exit/ }).click();
  await expect(page.getByRole('button', { name: 'Start AR' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
});
