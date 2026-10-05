export type BackgroundKind = "none" | "simplex" | "matrix" | "scanlines" | "waves";
export type ForegroundMode = "none" | "text" | "shape" | "media";
export type ShapeKind = "torusKnot" | "sphere" | "metaballs" | "custom";
export type RampKey = "standard" | "code" | "blocks" | "custom";
export type ColorMode = "dual" | "matrix" | "rgbsplit" | "fullcolor" | "gradient";
export type DitherKind = "none" | "floyd" | "bayer";
export type AudioTarget = "none" | "glitch" | "wave" | "jitter" | "rotation" | "contrast";
export type AspectKey = "square" | "reel" | "a3";
export type FontKey = "mono" | "serif" | "sans";

export const RAMPS: Record<Exclude<RampKey, "custom">, string> = {
  standard: "@%#*+=-:. ",
  code: "{}[]()<>;=/\\_ ",
  blocks: "█▓▒░▀▄▐▌ ",
};

export const FONT_STACKS: Record<FontKey, string> = {
  mono: "'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, monospace",
  serif: "Georgia, 'Times New Roman', serif",
  sans: "Inter, 'Helvetica Neue', Arial, sans-serif",
};

export const ASPECTS: Record<AspectKey, { label: string; w: number; h: number; note: string }> = {
  square: { label: "1:1", w: 1080, h: 1080, note: "Instagram 1080×1080" },
  reel: { label: "9:16", w: 1080, h: 1920, note: "Reel 1080×1920" },
  a3: { label: "A3", w: 3508, h: 4961, note: "A3 print @300DPI" },
};

export type RampConfig = { preset: RampKey; custom: string };

export type StudioState = {
  aspect: AspectKey;
  cols: number;

  // background
  bgKind: BackgroundKind;
  noiseScale: number;
  bgSpeed: number;
  contrast: number;

  // foreground
  fgMode: ForegroundMode;
  text: string;
  font: FontKey;
  tracking: number;
  leading: number;
  weight: number;
  textSize: number;
  kinetic: boolean;

  shape: ShapeKind;
  lightX: number;
  lightY: number;
  lightZ: number;
  lightIntensity: number;

  // ascii engine
  bgRamp: RampConfig;
  fgRamp: RampConfig;
  jitter: number;
  glitch: number;

  // color
  colorMode: ColorMode;
  inkColor: string;
  paperColor: string;
  rgbSplit: number;

  // motion
  playing: boolean;
  speed: number;
  zRotation: number;
  waveFrequency: number;

  // media source
  mediaBrightness: number;
  mediaContrast: number;
  mediaMirror: boolean;

  // advanced rendering
  edges: boolean;
  edgeThreshold: number;
  dither: DitherKind;
  ditherAmount: number;
  gradA: string;
  gradB: string;
  crt: boolean;
  crtCurve: number;
  crtBloom: number;
  crtScanlines: number;
  crtInExport: boolean;

  // audio reactivity
  audioBass: AudioTarget;
  audioMid: AudioTarget;
  audioHigh: AudioTarget;
  audioGain: number;
};

export const DEFAULT_STATE: StudioState = {
  aspect: "square",
  cols: 120,

  bgKind: "simplex",
  noiseScale: 3.2,
  bgSpeed: 0.6,
  contrast: 1.4,

  fgMode: "text",
  text: "ASCII\nSTUDIO",
  font: "sans",
  tracking: 0,
  leading: 1,
  weight: 800,
  textSize: 0.34,
  kinetic: true,

  shape: "torusKnot",
  lightX: 3,
  lightY: 4,
  lightZ: 5,
  lightIntensity: 2.2,

  bgRamp: { preset: "standard", custom: "·:+#" },
  fgRamp: { preset: "blocks", custom: "·:+#" },
  jitter: 0.12,
  glitch: 0.02,

  colorMode: "dual",
  inkColor: "#f4f1e8",
  paperColor: "#101014",
  rgbSplit: 0.35,

  playing: true,
  speed: 1,
  zRotation: 0.25,
  waveFrequency: 1.2,

  mediaBrightness: 0,
  mediaContrast: 1.2,
  mediaMirror: true,

  edges: false,
  edgeThreshold: 0.35,
  dither: "none",
  ditherAmount: 1,
  gradA: "#ff3d7f",
  gradB: "#3de0ff",
  crt: false,
  crtCurve: 0.25,
  crtBloom: 0.5,
  crtScanlines: 0.5,
  crtInExport: true,

  audioBass: "wave",
  audioMid: "jitter",
  audioHigh: "glitch",
  audioGain: 1,
};

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rampChars(cfg: RampConfig): string {
  if (cfg.preset === "custom") return cfg.custom.length > 0 ? cfg.custom : " ";
  return RAMPS[cfg.preset];
}

/** Stable hash in [0,1) for a cell (optionally salted by a time bucket). */
export function hash01(x: number, y: number, salt = 0): number {
  let h = x * 374761393 + y * 668265263 + salt * 2246822519;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

/** Cell width / cell height ratio for the monospace grid. */
export const CELL_ASPECT = 0.55;
