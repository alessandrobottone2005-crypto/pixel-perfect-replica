import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Terminal } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ControlPanel } from "./ControlPanel";
import {
  ASPECTS,
  DEFAULT_STATE,
  type AspectKey,
  type StudioState,
} from "@/lib/ascii/types";
import { renderBackground, renderTextField } from "@/lib/ascii/field";
import { composeGrid, drawGrid, gridSizeFor, type Grid } from "@/lib/ascii/render";
import { ThreeLayer, type OrbitState } from "@/lib/ascii/three-scene";
import { copyAscii, exportPNG, exportSVG, recordWebM } from "@/lib/ascii/export";

export function AsciiStudio() {
  const [state, setState] = useState<StudioState>(DEFAULT_STATE);
  const [recording, setRecording] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<Grid | null>(null);
  const orbitRef = useRef<OrbitState>({ azimuth: 0.7, polar: 1.15, radius: 8 });
  const threeRef = useRef<ThreeLayer | null>(null);
  const buffersRef = useRef<{
    bg: Float32Array;
    fg: Float32Array;
    mask: Uint8Array;
    size: number;
  }>({ bg: new Float32Array(1), fg: new Float32Array(1), mask: new Uint8Array(1), size: 0 });
  const textDirty = useRef(true);
  const timeRef = useRef(0);

  const set = useCallback((patch: Partial<StudioState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      if (
        patch.text !== undefined ||
        patch.font !== undefined ||
        patch.tracking !== undefined ||
        patch.leading !== undefined ||
        patch.weight !== undefined ||
        patch.textSize !== undefined ||
        patch.cols !== undefined ||
        patch.aspect !== undefined ||
        patch.fgMode !== undefined
      ) {
        textDirty.current = true;
      }
      return next;
    });
  }, []);

  // Canvas sizing to the selected aspect ratio.
  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const fit = () => {
      const a = ASPECTS[stateRef.current.aspect];
      const ratio = a.w / a.h;
      const pad = 48;
      const availW = stage.clientWidth - pad;
      const availH = stage.clientHeight - pad;
      let w = availW;
      let h = w / ratio;
      if (h > availH) {
        h = availH;
        w = h * ratio;
      }
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.style.width = `${Math.round(w)}px`;
      canvas.style.height = `${Math.round(h)}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      textDirty.current = true;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [state.aspect]);

  // Main render loop.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = stateRef.current;
      if (s.playing) timeRef.current += dt * s.speed;
      const time = timeRef.current;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      const { cols, rows } = gridSizeFor(s.cols, canvas.width, canvas.height);
      const size = cols * rows;
      const bufs = buffersRef.current;
      if (bufs.size !== size) {
        bufs.bg = new Float32Array(size);
        bufs.fg = new Float32Array(size);
        bufs.mask = new Uint8Array(size);
        bufs.size = size;
        textDirty.current = true;
      }

      renderBackground(bufs.bg, cols, rows, time, s);

      let hasFg = false;
      if (s.fgMode === "text") {
        if (textDirty.current) {
          renderTextField(bufs.fg, cols, rows, s);
          for (let i = 0; i < size; i++) bufs.mask[i] = bufs.fg[i]! > 0.12 ? 1 : 0;
          textDirty.current = false;
        }
        hasFg = true;
      } else if (s.fgMode === "shape") {
        if (!threeRef.current) {
          try {
            threeRef.current = new ThreeLayer();
          } catch {
            threeRef.current = null;
          }
        }
        const layer = threeRef.current;
        if (layer) {
          layer.setSize(cols, rows, canvas.width / canvas.height);
          layer.render(bufs.fg, bufs.mask, s, orbitRef.current, time);
          hasFg = true;
        }
      }

      const grid = composeGrid(cols, rows, bufs.bg, bufs.fg, bufs.mask, hasFg, s, time);
      gridRef.current = grid;
      drawGrid(ctx, grid, s, { width: canvas.width, height: canvas.height });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    return () => {
      threeRef.current?.dispose();
      threeRef.current = null;
    };
  }, []);

  // Orbit interaction for the 3D layer.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dragging = false;
    let px = 0;
    let py = 0;
    const down = (e: PointerEvent) => {
      if (stateRef.current.fgMode !== "shape") return;
      dragging = true;
      px = e.clientX;
      py = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const o = orbitRef.current;
      o.azimuth -= (e.clientX - px) * 0.008;
      o.polar = Math.max(0.08, Math.min(Math.PI - 0.08, o.polar - (e.clientY - py) * 0.008));
      px = e.clientX;
      py = e.clientY;
    };
    const up = (e: PointerEvent) => {
      dragging = false;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };
    const wheel = (e: WheelEvent) => {
      if (stateRef.current.fgMode !== "shape") return;
      e.preventDefault();
      const o = orbitRef.current;
      o.radius = Math.max(2, Math.min(16, o.radius + e.deltaY * 0.004));
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
    };
  }, []);

  const withGrid = (fn: (g: Grid) => void) => {
    const g = gridRef.current;
    if (!g) {
      toast.error("Canvas is not ready yet");
      return;
    }
    fn(g);
  };

  const handlePng = () =>
    withGrid((g) => {
      const a = ASPECTS[state.aspect];
      exportPNG(g, state, a.w, a.h);
      toast.success(`PNG exported at ${a.w}×${a.h}`);
    });

  const handleSvg = () =>
    withGrid((g) => {
      const a = ASPECTS[state.aspect];
      exportSVG(g, state, a.w, a.h);
      toast.success("SVG exported with live text nodes");
    });

  const handleCopy = () =>
    withGrid((g) => {
      copyAscii(g)
        .then(() => toast.success("ASCII copied to clipboard"))
        .catch(() => toast.error("Clipboard permission denied"));
    });

  const handleWebm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setRecording(true);
    recordWebM(canvas, 5)
      .then(() => toast.success("5 second WebM downloaded"))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setRecording(false));
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <aside className="flex w-[300px] shrink-0 flex-col border-r border-border/60 bg-sidebar">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-4">
          <Terminal className="size-4 text-primary" />
          <div className="leading-tight">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em]">ASCII Studio</p>
            <p className="text-[10px] text-muted-foreground">Typography · 3D · Generative</p>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <ControlPanel
            s={state}
            set={set}
            onPng={handlePng}
            onSvg={handleSvg}
            onWebm={handleWebm}
            onCopy={handleCopy}
            recording={recording}
          />
        </ScrollArea>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-3">
          <div className="flex items-center gap-1">
            {(Object.keys(ASPECTS) as AspectKey[]).map((k) => (
              <button
                key={k}
                onClick={() => set({ aspect: k })}
                title={ASPECTS[k].note}
                className={`rounded-sm border px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] transition-colors ${
                  state.aspect === k
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {ASPECTS[k].label}
              </button>
            ))}
            <span className="ml-3 font-mono text-[10px] text-muted-foreground">
              {ASPECTS[state.aspect].note}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
              t {timeRef.current.toFixed(1)}s
            </span>
            <Button
              size="sm"
              variant={state.playing ? "secondary" : "default"}
              className="gap-2 text-xs"
              onClick={() => set({ playing: !state.playing })}
            >
              {state.playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              {state.playing ? "Pause" : "Play"}
            </Button>
          </div>
        </div>

        <div
          ref={stageRef}
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_30%,color-mix(in_oklab,var(--color-primary)_8%,transparent),transparent_60%)] p-6"
        >
          <canvas
            ref={canvasRef}
            className={`rounded-sm border border-border/60 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.8)] ${
              state.fgMode === "shape" ? "cursor-grab active:cursor-grabbing" : ""
            }`}
          />
        </div>
      </main>
    </div>
  );
}
