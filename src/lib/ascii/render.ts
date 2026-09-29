import { CELL_ASPECT, hash01, rampChars, type StudioState } from "./types";

export type Grid = {
  cols: number;
  rows: number;
  chars: string[];
  bright: Float32Array;
  isFg: Uint8Array;
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
): Grid {
  const chars = new Array<string>(cols * rows);
  const bright = new Float32Array(cols * rows);
  const isFg = new Uint8Array(cols * rows);
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
          const j = sy * cols + sx;
          fgVal = fg[j];
          covered = fgMask[j];
        }
      }

      let b: number;
      let fgFlag: number;
      if (covered) {
        b = s.fgMode === "text" ? Math.min(1, 0.35 + fgVal * 0.85) : fgVal;
        fgFlag = 1;
      } else {
        b = bg[i];
        fgFlag = 0;
      }

      let ch = pickChar(fgFlag ? fgRamp : bgRamp, b);
      if (s.glitch > 0) {
        const r = hash01(x, y, bucket);
        if (r < s.glitch) {
          const pool = fgFlag ? fgRamp : bgRamp;
          ch = pool[Math.floor(hash01(y, x, bucket + 7) * pool.length) % pool.length];
        }
      }
      chars[i] = ch;
      bright[i] = b;
      isFg[i] = fgFlag;
    }
  }
  return { cols, rows, chars, bright, isFg };
}

function colorFor(s: StudioState, b: number, isFg: boolean): string {
  if (s.colorMode === "matrix") {
    const l = 24 + b * 62 + (isFg ? 10 : 0);
    return `hsl(128 92% ${Math.min(92, l)}%)`;
  }
  return s.inkColor;
}

export type DrawOptions = {
  width: number;
  height: number;
  /** When true the paper color is painted first (export/preview both use it). */
  paintBackground?: boolean;
};

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  s: StudioState,
  opts: DrawOptions,
) {
  const { width, height } = opts;
  const cellW = width / grid.cols;
  const cellH = height / grid.rows;
  const fontPx = cellH * 0.94;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (opts.paintBackground !== false) {
    ctx.fillStyle = s.colorMode === "matrix" ? "#04100a" : s.paperColor;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.font = `${fontPx}px ${"'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, monospace"}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const passes: { dx: number; dy: number; color: string | null; alpha: number }[] =
    s.colorMode === "rgbsplit"
      ? [
          { dx: -s.rgbSplit * cellW * 1.6, dy: 0, color: "#ff2b3d", alpha: 1 },
          { dx: s.rgbSplit * cellW * 1.6, dy: 0, color: "#00e5ff", alpha: 1 },
          { dx: 0, dy: 0, color: null, alpha: 1 },
        ]
      : [{ dx: 0, dy: 0, color: null, alpha: 1 }];

  const prevOp = ctx.globalCompositeOperation;
  for (let p = 0; p < passes.length; p++) {
    const pass = passes[p];
    ctx.globalCompositeOperation =
      s.colorMode === "rgbsplit" && p < passes.length - 1 ? "lighter" : "source-over";
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
        ctx.fillStyle = pass.color ?? colorFor(s, grid.bright[i], grid.isFg[i] === 1);
        ctx.fillText(
          ch,
          x * cellW + cellW / 2 + jx + pass.dx,
          y * cellH + cellH / 2 + jy + pass.dy,
        );
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
