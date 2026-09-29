# Generative ASCII Typography & 3D Artwork Studio

A full-screen dark studio app where you compose a background pattern and a foreground (text or 3D shape), render everything as live ASCII art, animate it, and export it as image, vector, video, or raw text.

## Screen layout

```text
+---------------------------------------------------------------+
|  Studio name        [1:1] [9:16] [A3 300DPI]      [Play/Pause] |
+-------------------+-------------------------------------------+
| Layers            |                                           |
| ASCII Engine      |        ASCII canvas viewer                |
| Motion            |        (live, animated)                   |
| Export            |                                           |
| (scrollable)      |                                           |
+-------------------+-------------------------------------------+
```

## What you can control

**Layers**
- Background generator: Simplex Noise, Matrix Rain, Grid Scanlines, Geometric Waves, with noise scale, speed, contrast.
- Foreground in one of two modes:
  - Text: your words, monospace/serif/sans, tracking, leading, weight, and a "Kinetic" toggle for wave/glitch motion.
  - 3D: torus knot, sphere, metaball blob, rotatable by dragging, lit by a movable light (X/Y/Z + intensity) whose shading drives the ASCII characters.

**ASCII engine**
- Separate character ramps for background and foreground: Standard, Code, Blocks, or your own custom string.
- Grid Jitter slider for raw, analog-print imperfection.
- Glitch Swap slider for random character corruption.

**Color**
- Dual tone (pick text and background colors), Matrix Green, RGB Split chromatic aberration.

**Motion**
- Global play/pause and speed, Z-axis rotation, wave frequency.

**Export**
- High-res PNG for print.
- SVG with real text nodes for pen plotters and screen printing.
- 5-second WebM recording of the live animation.
- Copy the raw ASCII text to clipboard.

## Build order

1. Studio shell: dark theme, sidebar accordions, aspect-ratio bar, animation clock.
2. ASCII renderer core: a character grid driven by a brightness field, drawn to canvas, with ramps, jitter, glitch, and color modes.
3. Background generators.
4. Text foreground with kinetic motion.
5. 3D foreground: offscreen Three.js render whose depth + lighting feeds the same brightness field, composited over the background.
6. Export module.

## Technical notes

- Stack here is TanStack Start + React 19 + Tailwind v4 + shadcn/ui, so the app is built as a route rather than a Vite CRA-style app; React Three Fiber, `three`, and `simplex-noise` get added.
- Single shared brightness buffer: background generator writes it, foreground composites over it, one ASCII pass converts it to characters. This keeps 3D lighting and text in the same grid and avoids a second render path.
- The 3D layer renders headlessly into an offscreen WebGL target at grid resolution and is read back per frame; luminance (light-dependent) plus depth mask become foreground brightness. Grid resolution is capped and readback throttled to hold 60fps.
- ASCII output is drawn on a 2D canvas (fast, exportable, recordable): PNG via canvas at a print scale factor, WebM via `canvas.captureStream()` + MediaRecorder, SVG generated directly from the character grid (no DOM rasterization needed), clipboard from the same grid.
- All 3D/WebGL and recorder code is client-only, loaded after hydration so server rendering stays clean.
- Design tokens (studio greys, accent, panel surfaces) go in `src/styles.css`; no hardcoded colors in components.

## Scope note

This is a large build. It will land as one app in the order above, with the 3D layer and export module last — those are the two heaviest pieces.
