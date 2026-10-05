import type { StudioState } from "./types";

export const PRESETS: { name: string; swatch: [string, string]; patch: Partial<StudioState> }[] = [
  {
    name: "Cyberpunk Terminal",
    swatch: ["#0b0614", "#ff2bd6"],
    patch: {
      bgKind: "scanlines", noiseScale: 2.4, contrast: 1.6, colorMode: "gradient",
      gradA: "#ff2bd6", gradB: "#2be8ff", paperColor: "#0b0614", fgRamp: { preset: "code", custom: "·:+#" },
      bgRamp: { preset: "code", custom: "·:+#" }, glitch: 0.06, jitter: 0.05, crt: true, crtCurve: 0.3,
      crtBloom: 0.7, crtScanlines: 0.6, edges: false, dither: "none",
    },
  },
  {
    name: "Acid Rave",
    swatch: ["#000000", "#c6ff00"],
    patch: {
      bgKind: "waves", noiseScale: 4, contrast: 2.2, bgSpeed: 1.8, colorMode: "rgbsplit", rgbSplit: 0.8,
      inkColor: "#c6ff00", paperColor: "#000000", fgRamp: { preset: "blocks", custom: "·:+#" },
      bgRamp: { preset: "standard", custom: "·:+#" }, glitch: 0.12, jitter: 0.3, kinetic: true,
      waveFrequency: 2.6, crt: false, edges: false, dither: "bayer", ditherAmount: 1,
    },
  },
  {
    name: "Monochrome Swiss",
    swatch: ["#f2efe6", "#111111"],
    patch: {
      bgKind: "none", colorMode: "dual", inkColor: "#111111", paperColor: "#f2efe6", font: "sans",
      weight: 900, tracking: -0.4, fgRamp: { preset: "standard", custom: "·:+#" }, glitch: 0,
      jitter: 0, kinetic: false, crt: false, edges: true, edgeThreshold: 0.3, dither: "none",
    },
  },
  {
    name: "80s Arcade",
    swatch: ["#120a2a", "#ffb000"],
    patch: {
      bgKind: "matrix", contrast: 1.4, colorMode: "gradient", gradA: "#ffb000", gradB: "#ff3d3d",
      paperColor: "#120a2a", fgRamp: { preset: "blocks", custom: "·:+#" },
      bgRamp: { preset: "custom", custom: "█▓▒░ " }, cols: 80, glitch: 0.02, jitter: 0,
      dither: "floyd", ditherAmount: 1, crt: true, crtCurve: 0.45, crtBloom: 0.5, crtScanlines: 0.8,
      edges: false,
    },
  },
  {
    name: "Matrix Deep",
    swatch: ["#04100a", "#39ff6a"],
    patch: {
      bgKind: "matrix", bgSpeed: 1.2, contrast: 1.8, colorMode: "matrix",
      fgRamp: { preset: "code", custom: "·:+#" }, bgRamp: { preset: "custom", custom: "ｱｲｳｴｵ01:. " },
      cols: 140, glitch: 0.08, jitter: 0.05, crt: true, crtCurve: 0.15, crtBloom: 0.8,
      crtScanlines: 0.4, edges: false, dither: "none",
    },
  },
];
