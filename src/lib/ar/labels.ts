import { CanvasTexture, LinearFilter, SRGBColorSpace, Sprite, SpriteMaterial } from 'three';

/**
 * Billboarded label sprites, shared by the AR viewer, the fallback 3D viewer
 * and the Studio preview (TASKS.md C4). Browser-only (uses a canvas).
 */

const FONT_PX = 30;
const PAD_PX = 14;
const HEIGHT_PX = 56;
const PX_RATIO = 2;

export interface LabelStyle {
  selected: boolean;
}

/** A pill with a numbered badge and the annotation title. Bottom-centre anchored. */
export function createLabelSprite(number: number, title: string): Sprite {
  const material = new SpriteMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
  const sprite = new Sprite(material);
  sprite.center.set(0.5, 0);
  sprite.renderOrder = 3;
  sprite.userData.number = number;
  sprite.userData.title = title;
  drawLabel(sprite, { selected: false });
  return sprite;
}

export function drawLabel(sprite: Sprite, style: LabelStyle): void {
  const number = sprite.userData.number as number;
  const title = sprite.userData.title as string;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = `600 ${FONT_PX * PX_RATIO}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.font = font;
  const text = title.length > 32 ? `${title.slice(0, 31)}…` : title;
  const badge = HEIGHT_PX * PX_RATIO * 0.7;
  const w = Math.ceil(
    PAD_PX * PX_RATIO * 2 + badge + PAD_PX * PX_RATIO * 0.7 + ctx.measureText(text).width,
  );
  const h = HEIGHT_PX * PX_RATIO;
  canvas.width = w;
  canvas.height = h;

  ctx.font = font;
  ctx.fillStyle = style.selected ? 'rgba(255,196,0,0.95)' : 'rgba(18,18,22,0.82)';
  roundRect(ctx, 0, 0, w, h, h / 2);
  ctx.fill();
  // badge
  const cx = PAD_PX * PX_RATIO * 0.6 + badge / 2;
  ctx.fillStyle = style.selected ? '#111' : '#ffc400';
  ctx.beginPath();
  ctx.arc(cx, h / 2, badge / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = style.selected ? '#ffc400' : '#111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), cx, h / 2 + 1);
  // title
  ctx.fillStyle = style.selected ? '#111' : '#fff';
  ctx.textAlign = 'left';
  ctx.fillText(text, cx + badge / 2 + PAD_PX * PX_RATIO * 0.7, h / 2 + 1);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  const mat = sprite.material;
  mat.map?.dispose();
  mat.map = texture;
  mat.needsUpdate = true;
  sprite.userData.aspect = w / h;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
