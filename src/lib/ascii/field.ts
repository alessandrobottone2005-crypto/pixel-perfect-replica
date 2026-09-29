import { createNoise3D } from "simplex-noise";
import { CELL_ASPECT, FONT_STACKS, type StudioState } from "./types";

const noise3D = createNoise3D(() => 0.42);

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function applyContrast(v: number, contrast: number) {
  return clamp01((v - 0.5) * contrast + 0.5);
}

/**
 * Fills `out` (length cols*rows) with background brightness in 0..1.
 */
export function renderBackground(
  out: Float32Array,
  cols: number,
  rows: number,
  time: number,
  s: StudioState,
) {
  const t = time * s.bgSpeed;
  switch (s.bgKind) {
    case "none": {
      out.fill(0);
      return;
    }
    case "simplex": {
      const sc = s.noiseScale;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const n = noise3D((x / cols) * sc, (y / rows) * sc * (1 / CELL_ASPECT) * 0.55, t * 0.35);
          out[y * cols + x] = applyContrast(n * 0.5 + 0.5, s.contrast);
        }
      }
      return;
    }
    case "matrix": {
      for (let x = 0; x < cols; x++) {
        const speed = 0.5 + ((x * 2654435761) % 1000) / 1000;
        const len = 6 + (((x * 40503) % 100) / 100) * rows * 0.5;
        const head = (t * speed * 18 + ((x * 97) % rows)) % (rows + len);
        for (let y = 0; y < rows; y++) {
          const d = head - y;
          const v = d < 0 || d > len ? 0 : 1 - d / len;
          out[y * cols + x] = applyContrast(v * v, s.contrast);
        }
      }
      return;
    }
    case "scanlines": {
      const f = Math.max(0.4, s.noiseScale);
      for (let y = 0; y < rows; y++) {
        const line = 0.5 + 0.5 * Math.sin((y / rows) * f * 18 + t * 2);
        for (let x = 0; x < cols; x++) {
          const bar = 0.5 + 0.5 * Math.sin((x / cols) * f * 26 - t * 0.6);
          out[y * cols + x] = applyContrast(line * 0.72 + bar * 0.28, s.contrast);
        }
      }
      return;
    }
    case "waves": {
      const f = Math.max(0.3, s.noiseScale);
      for (let y = 0; y < rows; y++) {
        const yy = (y / rows - 0.5) * 2;
        for (let x = 0; x < cols; x++) {
          const xx = (x / cols - 0.5) * 2;
          const r = Math.sqrt(xx * xx + yy * yy);
          const v =
            0.5 +
            0.5 *
              Math.sin(xx * f * 4 + Math.sin(yy * f * 3 + t * 1.4) * 1.8 + t) *
              Math.cos(r * f * 3 - t);
          out[y * cols + x] = applyContrast(v, s.contrast);
        }
      }
      return;
    }
  }
}

let textCanvas: HTMLCanvasElement | null = null;

/**
 * Rasterises the foreground text into a cols×rows luminance buffer.
 * Glyphs are squashed vertically so they read correctly once drawn on the
 * taller-than-wide character grid.
 */
export function renderTextField(
  out: Float32Array,
  cols: number,
  rows: number,
  s: StudioState,
): void {
  out.fill(0);
  if (typeof document === "undefined") return;
  if (!textCanvas) textCanvas = document.createElement("canvas");
  const c = textCanvas;
  if (c.width !== cols || c.height !== rows) {
    c.width = cols;
    c.height = rows;
  }
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cols, rows);

  const lines = s.text.split("\n");
  const pxPerCellY = 1 / CELL_ASPECT; // visual stretch of one row
  const fontPx = Math.max(2, s.textSize * rows * CELL_ASPECT * 1.9);
  ctx.save();
  ctx.translate(cols / 2, rows / 2);
  ctx.scale(1, 1 / pxPerCellY);
  ctx.font = `${s.weight} ${fontPx}px ${FONT_STACKS[s.font]}`;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lineH = fontPx * s.leading * 1.05;
  const total = (lines.length - 1) * lineH;
  lines.forEach((line, i) => {
    const y = -total / 2 + i * lineH;
    if (s.tracking === 0) {
      ctx.fillText(line, 0, y);
      return;
    }
    const track = s.tracking * fontPx * 0.12;
    const widths = [...line].map((ch) => ctx.measureText(ch).width + track);
    const w = widths.reduce((a, b) => a + b, 0) - track;
    let x = -w / 2;
    [...line].forEach((ch, j) => {
      ctx.textAlign = "left";
      ctx.fillText(ch, x, y);
      x += widths[j]!;
    });
    ctx.textAlign = "center";
  });
  ctx.restore();

  const data = ctx.getImageData(0, 0, cols, rows).data;
  for (let i = 0; i < cols * rows; i++) {
    out[i] = data[i * 4 + 3]! / 255;
  }
}
