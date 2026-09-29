import { drawGrid, gridToText, type Grid } from "./render";
import { hash01, type StudioState } from "./types";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function exportPNG(grid: Grid, s: StudioState, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  drawGrid(ctx, grid, s, { width, height });
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `ascii-studio-${Date.now()}.png`);
  }, "image/png");
}

export function exportSVG(grid: Grid, s: StudioState, width: number, height: number) {
  const cellW = width / grid.cols;
  const cellH = height / grid.rows;
  const fontPx = cellH * 0.94;
  const paper = s.colorMode === "matrix" ? "#04100a" : s.paperColor;
  const parts: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="${paper}"/>`,
    `<g font-family="monospace" font-size="${fontPx.toFixed(2)}" text-anchor="middle" dominant-baseline="central">`,
  ];
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      const i = y * grid.cols + x;
      const ch = grid.chars[i];
      if (!ch || ch === " ") continue;
      const jx = s.jitter > 0 ? (hash01(x, y, 1) - 0.5) * s.jitter * cellW * 2.2 : 0;
      const jy = s.jitter > 0 ? (hash01(x, y, 2) - 0.5) * s.jitter * cellH * 1.4 : 0;
      const color =
        s.colorMode === "matrix"
          ? `hsl(128,92%,${Math.min(92, 24 + grid.bright[i] * 62).toFixed(0)}%)`
          : s.inkColor;
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
