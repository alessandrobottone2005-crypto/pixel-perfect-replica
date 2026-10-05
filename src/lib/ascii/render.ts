import { CELL_ASPECT, hash01, hexToRgb, rampChars, type StudioState } from "./types";

export type Grid = {
  cols: number;
  rows: number;
  chars: string[];
  bright: Float32Array;
  isFg: Uint8Array;
  /** Optional source colour per cell (r,g,b), used by full-color mode. */
  rgb: Uint8ClampedArray | null;
};

export function gridSizeFor(cols: number, width: number, height: number) {
  const cellW = width / cols;
  const cellH = cellW / CELL_ASPECT;
  const rows = Math.max(4, Math.floor(height / cellH));
  return { cols, rows, cellW, cellH: height / rows };
}

function pickChar(ramp: string, b: number) {
  const i = Math.round((1 - Math.min(1, Math.max(0, b))) * (ramp.length - 1));
  return ramp[i] ?? " ";
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Quantises brightness to the ramp levels with ordered or error-diffusion dithering. */
function dither(b: Float32Array, levelsOf: (i: number) => number, cols: number, rows: number, s: StudioState) {
  const amt = s.ditherAmount;
  if (s.dither === "bayer") {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const L = levelsOf(i);
        const t = (BAYER4[(y & 3) * 4 + (x & 3)]! + 0.5) / 16 - 0.5;
        const v = b[i]! + (t * amt) / L;
        b[i] = Math.min(1, Math.max(0, Math.round(v * L) / L));
      }
    }
  } else if (s.dither === "floyd") {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const L = levelsOf(i);
        const old = Math.min(1, Math.max(0, b[i]!));
        const q = Math.round(old * L) / L;
        b[i] = q;
        const e = (old - q) * amt;
        if (x + 1 < cols) b[i + 1]! += (e * 7) / 16;
        if (y + 1 < rows) {
          if (x > 0) b[i + cols - 1]! += (e * 3) / 16;
          b[i + cols]! += (e * 5) / 16;
          if (x + 1 < cols) b[i + cols + 1]! += e / 16;
        }
      }
    }
  }
}

/** Sobel edge char for a cell, or null when below threshold. */
function edgeChar(b: Float32Array, x: number, y: number, cols: number, rows: number, thr: number) {
  if (x < 1 || y < 1 || x >= cols - 1 || y >= rows - 1) return null;
  const p = (dx: number, dy: number) => b[(y + dy) * cols + x + dx]!;
  const gx = -p(-1, -1) - 2 * p(-1, 0) - p(-1, 1) + p(1, -1) + 2 * p(1, 0) + p(1, 1);
  const gy = -p(-1, -1) - 2 * p(0, -1) - p(1, -1) + p(-1, 1) + 2 * p(0, 1) + p(1, 1);
  const mag = Math.sqrt(gx * gx + gy * gy);
  if (mag < thr * 4) return null;
  // Edge direction is perpendicular to the gradient; correct for cell aspect.
  let a = (Math.atan2(gy * CELL_ASPECT, gx) * 180) / Math.PI;
  if (a < 0) a += 180;
  if (a < 22.5 || a >= 157.5) return "|";
  if (a < 67.5) return gy > 0 === gx > 0 ? "\\" : "/";
  if (a < 112.5) return y < rows - 1 && p(0, 1) > p(0, -1) ? "_" : "-";
  return gy > 0 === gx > 0 ? "/" : "\\";
}

/** Combines background + foreground buffers into a character grid. */
export function composeGrid(
  cols: number,
  rows: number,
  bg: Float32Array,
  fg: Float32Array,
  fgMask: Uint8Array,
  hasForeground: boolean,
  s: StudioState,
  time: number,
  fgRgb: Uint8ClampedArray | null = null,
): Grid {
  const n = cols * rows;
  const chars = new Array<string>(n);
  const bright = new Float32Array(n);
  const isFg = new Uint8Array(n);
  const rgb = fgRgb && hasForeground ? new Uint8ClampedArray(n * 3) : null;
  const bgRamp = rampChars(s.bgRamp);
  const fgRamp = rampChars(s.fgRamp);
  const bucket = Math.floor(time * 10);
  const kinetic = s.kinetic && s.fgMode === "text";
  const amp = rows * 0.035;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      let fgVal = 0;
      let covered = 0;
      let j = i;
      if (hasForeground) {
        let sx = x;
        let sy = y;
        if (kinetic) {
          sy = Math.round(y - Math.sin((x / cols) * Math.PI * 2 * s.waveFrequency + time * 2) * amp);
          sx = Math.round(
            x - Math.sin((y / rows) * Math.PI * 2 * s.waveFrequency * 0.6 + time * 1.4) * amp * 0.5,
          );
        }
        if (sx >= 0 && sx < cols && sy >= 0 && sy < rows) {
          j = sy * cols + sx;
          fgVal = fg[j]!;
          covered = fgMask[j]!;
        }
      }
      if (covered) {
        bright[i] = s.fgMode === "text" ? Math.min(1, 0.35 + fgVal * 0.85) : fgVal;
        isFg[i] = 1;
        if (rgb && fgRgb) {
          rgb[i * 3] = fgRgb[j * 3]!;
          rgb[i * 3 + 1] = fgRgb[j * 3 + 1]!;
          rgb[i * 3 + 2] = fgRgb[j * 3 + 2]!;
        }
      } else {
        bright[i] = bg[i]!;
      }
    }
  }

  if (s.dither !== "none") {
    const bgL = Math.max(1, bgRamp.length - 1);
    const fgL = Math.max(1, fgRamp.length - 1);
    dither(bright, (i) => (isFg[i] ? fgL : bgL), cols, rows, s);
  }

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const fgFlag = isFg[i] === 1;
      let ch: string | null = s.edges ? edgeChar(bright, x, y, cols, rows, s.edgeThreshold) : null;
      if (ch === null) ch = pickChar(fgFlag ? fgRamp : bgRamp, bright[i]!);
      if (s.glitch > 0) {
        const r = hash01(x, y, bucket);
        if (r < s.glitch) {
          const pool = fgFlag ? fgRamp : bgRamp;
          ch = pool[Math.floor(hash01(y, x, bucket + 7) * pool.length) % pool.length] ?? ch;
        }
      }
      chars[i] = ch;
    }
  }
  return { cols, rows, chars, bright, isFg, rgb };
}

/** Resolves the colour of one cell as [r,g,b] for every colour mode. */
export function cellRgb(s: StudioState, grid: Grid, i: number): [number, number, number] {
  const b = Math.min(1, Math.max(0, grid.bright[i]!));
  const fg = grid.isFg[i] === 1;
  switch (s.colorMode) {
    case "matrix": {
      const l = Math.min(0.92, (24 + b * 62 + (fg ? 10 : 0)) / 100);
      // hsl(128, 92%, l) -> rgb
      const c = (1 - Math.abs(2 * l - 1)) * 0.92;
      const m = l - c / 2;
      const xx = c * (1 - Math.abs(((128 / 60) % 2) - 1));
      return [Math.round(m * 255), Math.round((c + m) * 255), Math.round((xx + m) * 255)];
    }
    case "fullcolor": {
      if (grid.rgb && fg) {
        return [grid.rgb[i * 3]!, grid.rgb[i * 3 + 1]!, grid.rgb[i * 3 + 2]!];
      }
      const [r, g, bb] = hexToRgb(s.inkColor);
      const k = 0.25 + b * 0.75;
      return [r * k, g * k, bb * k];
    }
    case "gradient": {
      const a = hexToRgb(s.gradA);
      const c = hexToRgb(s.gradB);
      return [a[0] + (c[0] - a[0]) * b, a[1] + (c[1] - a[1]) * b, a[2] + (c[2] - a[2]) * b];
    }
    default:
      return hexToRgb(s.inkColor);
  }
}

export function paperColor(s: StudioState) {
  return s.colorMode === "matrix" ? "#04100a" : s.paperColor;
}

export type DrawOptions = {
  width: number;
  height: number;
  paintBackground?: boolean;
};

export function drawGrid(ctx: CanvasRenderingContext2D, grid: Grid, s: StudioState, opts: DrawOptions) {
  const { width, height } = opts;
  const cellW = width / grid.cols;
  const cellH = height / grid.rows;
  const fontPx = cellH * 0.94;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  if (opts.paintBackground !== false) {
    ctx.fillStyle = paperColor(s);
    ctx.fillRect(0, 0, width, height);
  }
  ctx.font = `${fontPx}px ${"'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, monospace"}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const perCell = s.colorMode === "matrix" || s.colorMode === "fullcolor" || s.colorMode === "gradient";
  const ink = s.inkColor;

  const passes: { dx: number; color: string | null }[] =
    s.colorMode === "rgbsplit"
      ? [
          { dx: -s.rgbSplit * cellW * 1.6, color: "#ff2b3d" },
          { dx: s.rgbSplit * cellW * 1.6, color: "#00e5ff" },
          { dx: 0, color: null },
        ]
      : [{ dx: 0, color: null }];

  const prevOp = ctx.globalCompositeOperation;
  for (let p = 0; p < passes.length; p++) {
    const pass = passes[p]!;
    ctx.globalCompositeOperation =
      s.colorMode === "rgbsplit" && p < passes.length - 1 ? "lighter" : "source-over";
    if (!perCell) ctx.fillStyle = pass.color ?? ink;
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        const i = y * grid.cols + x;
        const ch = grid.chars[i];
        if (ch === " " || ch === undefined) continue;
        let jx = 0;
        let jy = 0;
        if (s.jitter > 0) {
          jx = (hash01(x, y, 1) - 0.5) * s.jitter * cellW * 2.2;
          jy = (hash01(x, y, 2) - 0.5) * s.jitter * cellH * 1.4;
        }
        if (perCell) {
          const c = cellRgb(s, grid, i);
          ctx.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
        }
        ctx.fillText(ch, x * cellW + cellW / 2 + jx + pass.dx, y * cellH + cellH / 2 + jy);
      }
    }
  }
  ctx.globalCompositeOperation = prevOp;
}

export function gridToText(grid: Grid): string {
  const out: string[] = [];
  for (let y = 0; y < grid.rows; y++) {
    out.push(grid.chars.slice(y * grid.cols, (y + 1) * grid.cols).join(""));
  }
  return out.join("\n");
}
