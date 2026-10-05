import type { StudioState } from "./types";

let scratch: HTMLCanvasElement | null = null;
let scratch2: HTMLCanvasElement | null = null;

function getScratch(w: number, h: number, second = false) {
  let c = second ? scratch2 : scratch;
  if (!c) {
    c = document.createElement("canvas");
    if (second) scratch2 = c;
    else scratch = c;
  }
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  return c;
}

/**
 * Retro monitor post-process applied in place on a 2D canvas: phosphor bloom,
 * barrel curvature (strip-based approximation), animated scanlines, vignette.
 */
export function applyCRT(ctx: CanvasRenderingContext2D, w: number, h: number, s: StudioState, time: number) {
  const canvas = ctx.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Bloom: additive blurred copy.
  if (s.crtBloom > 0) {
    const b = getScratch(w, h);
    const bctx = b.getContext("2d")!;
    bctx.clearRect(0, 0, w, h);
    bctx.filter = `blur(${Math.max(1, (w / 400) * 3)}px)`;
    bctx.drawImage(canvas, 0, 0);
    bctx.filter = "none";
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = Math.min(1, s.crtBloom * 0.8);
    ctx.drawImage(b, 0, 0);
    ctx.restore();
  }

  // Curvature: pinch rows horizontally, then columns vertically.
  if (s.crtCurve > 0) {
    const k = s.crtCurve * 0.18;
    const a = getScratch(w, h);
    const actx = a.getContext("2d")!;
    actx.clearRect(0, 0, w, h);
    actx.drawImage(canvas, 0, 0);
    const c2 = getScratch(w, h, true);
    const c2x = c2.getContext("2d")!;
    c2x.fillStyle = "#000";
    c2x.fillRect(0, 0, w, h);
    const strip = Math.max(2, Math.round(h / 240));
    for (let y = 0; y < h; y += strip) {
      const ny = (y + strip / 2) / h - 0.5;
      const sc = 1 - k * 4 * ny * ny;
      const dw = w * sc;
      c2x.drawImage(a, 0, y, w, strip, (w - dw) / 2, y, dw, strip);
    }
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    const stripX = Math.max(2, Math.round(w / 240));
    for (let x = 0; x < w; x += stripX) {
      const nx = (x + stripX / 2) / w - 0.5;
      const sc = 1 - k * 4 * nx * nx;
      const dh = h * sc;
      ctx.drawImage(c2, x, 0, stripX, h, x, (h - dh) / 2, stripX, dh);
    }
  }

  // Scanlines.
  if (s.crtScanlines > 0) {
    const gap = Math.max(2, Math.round(h / 360));
    const offset = (time * 30) % (gap * 2);
    ctx.save();
    ctx.globalAlpha = s.crtScanlines * 0.45;
    ctx.fillStyle = "#000";
    for (let y = -gap * 2 + offset; y < h; y += gap * 2) ctx.fillRect(0, y, w, gap);
    // rolling bright band
    const band = ((time * 0.15) % 1.3) * h - h * 0.15;
    const g = ctx.createLinearGradient(0, band - h * 0.08, 0, band + h * 0.08);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,0.06)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(0, band - h * 0.08, w, h * 0.16);
    ctx.restore();
  }

  // Vignette.
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, `rgba(0,0,0,${0.35 + s.crtCurve * 0.5})`);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}
