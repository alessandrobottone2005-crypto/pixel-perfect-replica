import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { applyCRT } from "./crt";
import { cellRgb, drawGrid, gridToText, paperColor, type Grid } from "./render";
import { hash01, hexToRgb, type StudioState } from "./types";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function exportPNG(grid: Grid, s: StudioState, width: number, height: number, time = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  drawGrid(ctx, grid, s, { width, height });
  if (s.crt && s.crtInExport) applyCRT(ctx, width, height, s, time);
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `ascii-studio-${Date.now()}.png`);
  }, "image/png");
}

const hex = (c: [number, number, number]) =>
  "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

export function exportSVG(grid: Grid, s: StudioState, width: number, height: number) {
  const cellW = width / grid.cols;
  const cellH = height / grid.rows;
  const fontPx = cellH * 0.94;
  const parts: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="${paperColor(s)}"/>`,
    `<g font-family="monospace" font-size="${fontPx.toFixed(2)}" text-anchor="middle" dominant-baseline="central">`,
  ];
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      const i = y * grid.cols + x;
      const ch = grid.chars[i];
      if (!ch || ch === " ") continue;
      const jx = s.jitter > 0 ? (hash01(x, y, 1) - 0.5) * s.jitter * cellW * 2.2 : 0;
      const jy = s.jitter > 0 ? (hash01(x, y, 2) - 0.5) * s.jitter * cellH * 1.4 : 0;
      const color = hex(cellRgb(s, grid, i));
      const esc = ch.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      parts.push(
        `<text x="${(x * cellW + cellW / 2 + jx).toFixed(2)}" y="${(y * cellH + cellH / 2 + jy).toFixed(2)}" fill="${color}">${esc}</text>`,
      );
    }
  }
  parts.push("</g></svg>");
  downloadBlob(new Blob([parts.join("\n")], { type: "image/svg+xml" }), `ascii-studio-${Date.now()}.svg`);
}

export function copyAscii(grid: Grid): Promise<void> {
  return navigator.clipboard.writeText(gridToText(grid));
}

/** 24-bit ANSI escape art. */
export function gridToAnsi(grid: Grid, s: StudioState): string {
  const [pr, pg, pb] = hexToRgb(paperColor(s));
  const lines: string[] = [];
  for (let y = 0; y < grid.rows; y++) {
    let line = `\x1b[48;2;${pr};${pg};${pb}m`;
    let last = "";
    for (let x = 0; x < grid.cols; x++) {
      const i = y * grid.cols + x;
      const c = cellRgb(s, grid, i).map((v) => Math.round(v)).join(";");
      if (c !== last) {
        line += `\x1b[38;2;${c}m`;
        last = c;
      }
      line += grid.chars[i] ?? " ";
    }
    lines.push(line + "\x1b[0m");
  }
  return lines.join("\n") + "\n";
}

export function exportAnsi(grid: Grid, s: StudioState) {
  downloadBlob(new Blob([gridToAnsi(grid, s)], { type: "text/plain" }), `ascii-studio-${Date.now()}.ans`);
}

export function recordWebM(canvas: HTMLCanvasElement, seconds = 5): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = canvas.captureStream(30);
    const types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t));
    if (!mimeType) {
      reject(new Error("WebM recording is not supported in this browser"));
      return;
    }
    const chunks: BlobPart[] = [];
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12_000_000 });
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    rec.onstop = () => {
      downloadBlob(new Blob(chunks, { type: "video/webm" }), `ascii-studio-${Date.now()}.webm`);
      resolve();
    };
    rec.onerror = () => reject(new Error("Recording failed"));
    rec.start();
    setTimeout(() => rec.state !== "inactive" && rec.stop(), seconds * 1000);
  });
}

export type FrameSubscribe = (fn: (grid: Grid, canvas: HTMLCanvasElement) => void) => () => void;

/** Captures frames from the live canvas and encodes an animated GIF. */
export function recordGif(
  subscribe: FrameSubscribe,
  opts: { seconds: number; fps: number; width: number },
): Promise<void> {
  return new Promise((resolve) => {
    const gif = GIFEncoder();
    const delay = 1000 / opts.fps;
    let next = 0;
    let count = 0;
    const total = Math.round(opts.seconds * opts.fps);
    const off = document.createElement("canvas");
    const unsub = subscribe((_g, src) => {
      const now = performance.now();
      if (now < next) return;
      next = (next || now) + delay;
      const w = opts.width;
      const h = Math.round((src.height / src.width) * w);
      off.width = w;
      off.height = h;
      const ctx = off.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(src, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      const palette = quantize(data, 256);
      gif.writeFrame(applyPalette(data, palette), w, h, { palette, delay });
      count++;
      if (count >= total) {
        unsub();
        gif.finish();
        downloadBlob(new Blob([gif.bytes()], { type: "image/gif" }), `ascii-studio-${Date.now()}.gif`);
        resolve();
      }
    });
  });
}

/** Captures ASCII frames and writes a self-contained looping HTML player. */
export function recordHtml(subscribe: FrameSubscribe, s: StudioState, seconds = 3, fps = 15): Promise<void> {
  return new Promise((resolve) => {
    const frames: { t: string; c: string[] | null }[] = [];
    const total = Math.round(seconds * fps);
    const delay = 1000 / fps;
    let next = 0;
    const perCell = s.colorMode !== "dual" && s.colorMode !== "rgbsplit";
    let size = { cols: 0, rows: 0 };
    const unsub = subscribe((g) => {
      const now = performance.now();
      if (now < next) return;
      next = (next || now) + delay;
      size = { cols: g.cols, rows: g.rows };
      let colors: string[] | null = null;
      if (perCell) {
        colors = [];
        for (let i = 0; i < g.cols * g.rows; i++) colors.push(hex(cellRgb(s, g, i)).slice(1));
      }
      frames.push({ t: gridToText(g), c: colors });
      if (frames.length >= total) {
        unsub();
        const html = buildHtml(frames, size, s, fps);
        downloadBlob(new Blob([html], { type: "text/html" }), `ascii-studio-${Date.now()}.html`);
        resolve();
      }
    });
  });
}

function buildHtml(
  frames: { t: string; c: string[] | null }[],
  size: { cols: number; rows: number },
  s: StudioState,
  fps: number,
) {
  const data = JSON.stringify(frames).replace(/</g, "\\u003c");
  const shadow = s.crt ? `text-shadow:0 0 6px currentColor;` : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ASCII Studio artwork</title>
<style>
html,body{margin:0;height:100%;background:${paperColor(s)};display:grid;place-items:center;overflow:hidden}
pre{margin:0;font:1px/1 'JetBrains Mono',Menlo,Consolas,monospace;color:${s.inkColor};${shadow}white-space:pre;cursor:pointer}
</style></head><body><pre id="a" title="Click to pause"></pre>
<script>
const F=${data},C=${size.cols},R=${size.rows},el=document.getElementById('a');let i=0,p=false;
function fit(){const fs=Math.min(innerWidth/(C*0.6),innerHeight/R);el.style.fontSize=fs+'px';el.style.lineHeight=fs+'px'}
function esc(c){return c==='<'?'&lt;':c==='>'?'&gt;':c==='&'?'&amp;':c}
function draw(){const f=F[i];if(!f.c){el.textContent=f.t;return}let h='',k=0,last='';
for(const ch of f.t){if(ch==='\\n'){h+='\\n';continue}const c=f.c[k++];if(c!==last){if(last)h+='</span>';h+='<span style="color:#'+c+'">';last=c}h+=esc(ch)}
el.innerHTML=h+'</span>'}
addEventListener('resize',fit);el.onclick=()=>p=!p;fit();draw();
setInterval(()=>{if(!p){i=(i+1)%F.length;draw()}},${Math.round(1000 / fps)});
</script></body></html>`;
}
