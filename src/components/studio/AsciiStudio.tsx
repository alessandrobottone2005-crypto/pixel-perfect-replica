import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Terminal, Upload } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ControlPanel } from "./ControlPanel";
import type { StudioActions } from "./ExtraPanels";
import { ASPECTS, DEFAULT_STATE, type AspectKey, type StudioState } from "@/lib/ascii/types";
import { renderBackground, renderTextField } from "@/lib/ascii/field";
import { composeGrid, drawGrid, gridSizeFor, type Grid } from "@/lib/ascii/render";
import { ThreeLayer, loadModelFile, type OrbitState } from "@/lib/ascii/three-scene";
import {
  copyAscii,
  exportAnsi,
  exportPNG,
  exportSVG,
  recordGif,
  recordHtml,
  recordWebM,
  type FrameSubscribe,
} from "@/lib/ascii/export";
import { applyCRT } from "@/lib/ascii/crt";
import { MediaLayer } from "@/lib/ascii/media";
import { AudioEngine, applyAudio } from "@/lib/ascii/audio";
import { decodeState, downloadTemplate, encodeState, readTemplate } from "@/lib/ascii/share";

const TEXT_KEYS: (keyof StudioState)[] = [
  "text", "font", "tracking", "leading", "weight", "textSize", "cols", "aspect", "fgMode",
];

export function AsciiStudio() {
  const [state, setState] = useState<StudioState>(DEFAULT_STATE);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState<"gif" | "html" | null>(null);
  const [mediaName, setMediaName] = useState("");
  const [modelName, setModelName] = useState("");
  const [audioName, setAudioName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<Grid | null>(null);
  const orbitRef = useRef<OrbitState>({ azimuth: 0.7, polar: 1.15, radius: 8 });
  const threeRef = useRef<ThreeLayer | null>(null);
  const mediaRef = useRef<MediaLayer | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const levelsRef = useRef({ bass: 0, mid: 0, high: 0 });
  const listenersRef = useRef(new Set<(g: Grid, c: HTMLCanvasElement) => void>());
  const buffersRef = useRef({
    bg: new Float32Array(1),
    fg: new Float32Array(1),
    mask: new Uint8Array(1),
    rgb: new Uint8ClampedArray(3),
    size: 0,
  });
  const textDirty = useRef(true);
  const timeRef = useRef(0);

  const getThree = () => {
    if (!threeRef.current) {
      try {
        threeRef.current = new ThreeLayer();
      } catch {
        threeRef.current = null;
      }
    }
    return threeRef.current;
  };

  const set = useCallback((patch: Partial<StudioState>) => {
    if (TEXT_KEYS.some((k) => k in patch)) textDirty.current = true;
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  // Load a shared creation from the URL hash.
  useEffect(() => {
    const m = window.location.hash.match(/s=([\w-]+)/);
    if (!m) return;
    decodeState(m[1]!)
      .then((s) => {
        textDirty.current = true;
        setState({ ...s, playing: true });
        toast.success("Shared creation loaded");
      })
      .catch(() => toast.error("The shared link is invalid"));
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
      const base = stateRef.current;
      if (base.playing) timeRef.current += dt * base.speed;
      const time = timeRef.current;

      // Audio reactivity modulates a per-frame copy of the state.
      let s = base;
      const audio = audioRef.current;
      if (audio?.kind) {
        levelsRef.current = audio.update();
        const mod = applyAudio(base, levelsRef.current);
        s = mod.state;
        orbitRef.current.azimuth += mod.spin * dt;
      }

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
        bufs.rgb = new Uint8ClampedArray(size * 3);
        bufs.size = size;
        textDirty.current = true;
      }

      renderBackground(bufs.bg, cols, rows, time, s);

      let hasFg = false;
      let useRgb = false;
      if (s.fgMode === "text") {
        if (textDirty.current) {
          renderTextField(bufs.fg, cols, rows, s);
          for (let i = 0; i < size; i++) bufs.mask[i] = bufs.fg[i]! > 0.12 ? 1 : 0;
          textDirty.current = false;
        }
        hasFg = true;
      } else if (s.fgMode === "shape") {
        const layer = getThree();
        if (layer) {
          layer.setSize(cols, rows, canvas.width / canvas.height);
          layer.render(bufs.fg, bufs.mask, s, orbitRef.current, time, bufs.rgb);
          hasFg = true;
          useRgb = true;
        }
      } else if (s.fgMode === "media") {
        const m = mediaRef.current;
        if (m?.ready && m.sample(bufs.fg, bufs.mask, bufs.rgb, cols, rows, s)) {
          hasFg = true;
          useRgb = true;
        }
      }

      const grid = composeGrid(
        cols, rows, bufs.bg, bufs.fg, bufs.mask, hasFg, s, time, useRgb ? bufs.rgb : null,
      );
      gridRef.current = grid;
      drawGrid(ctx, grid, s, { width: canvas.width, height: canvas.height });
      if (s.crt) applyCRT(ctx, canvas.width, canvas.height, s, time);
      listenersRef.current.forEach((fn) => fn(grid, canvas));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    return () => {
      threeRef.current?.dispose();
      threeRef.current = null;
      mediaRef.current?.stop();
      audioRef.current?.dispose();
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

  const subscribe: FrameSubscribe = (fn) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  };

  const withGrid = (fn: (g: Grid) => void) => {
    const g = gridRef.current;
    if (!g) {
      toast.error("Canvas is not ready yet");
      return;
    }
    fn(g);
  };

  // ---- Sources ----
  const getMedia = () => (mediaRef.current ??= new MediaLayer());
  const getAudio = () => (audioRef.current ??= new AudioEngine());

  const onWebcam = async () => {
    try {
      await getMedia().startWebcam();
      setMediaName("Webcam");
      set({ fgMode: "media" });
    } catch {
      toast.error("Camera access was denied or unavailable");
    }
  };
  const onMediaFile = async (file: File) => {
    try {
      await getMedia().loadFile(file);
      setMediaName(file.name);
      set({ fgMode: "media" });
      toast.success(`${file.name} loaded`);
    } catch {
      toast.error("This file could not be opened");
    }
  };
  const onStopMedia = () => {
    mediaRef.current?.stop();
    setMediaName("");
  };
  const onModelFile = async (file: File) => {
    const layer = getThree();
    if (!layer) {
      toast.error("3D is not supported in this browser");
      return;
    }
    try {
      const obj = await loadModelFile(file);
      layer.setCustomModel(obj);
      setModelName(file.name);
      set({ fgMode: "shape", shape: "custom" });
      toast.success(`${file.name} loaded`);
    } catch (e) {
      toast.error((e as Error).message || "Model could not be loaded");
    }
  };
  const onMic = async () => {
    try {
      await getAudio().startMic();
      setAudioName("Microphone");
    } catch {
      toast.error("Microphone access was denied");
    }
  };
  const onAudioFile = async (file: File) => {
    try {
      await getAudio().loadFile(file);
      setAudioName(file.name);
    } catch {
      toast.error("This audio file could not be played");
    }
  };
  const onStopAudio = () => {
    audioRef.current?.stop();
    setAudioName("");
  };

  // ---- Presets & sharing ----
  const onShare = async () => {
    const code = await encodeState(stateRef.current);
    const url = `${window.location.origin}${window.location.pathname}#s=${code}`;
    window.history.replaceState(null, "", `#s=${code}`);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied");
    } catch {
      toast.message("Link is in the address bar");
    }
  };
  const onLoadJson = async (file: File) => {
    try {
      const s = await readTemplate(file);
      textDirty.current = true;
      setState(s);
      toast.success("Template loaded");
    } catch {
      toast.error("Invalid template file");
    }
  };

  const handleDrop = (file: File) => {
    const name = file.name.toLowerCase();
    if (/\.(obj|gltf|glb)$/.test(name)) void onModelFile(file);
    else if (name.endsWith(".json")) void onLoadJson(file);
    else if (file.type.startsWith("audio/")) void onAudioFile(file);
    else if (file.type.startsWith("image/") || file.type.startsWith("video/")) void onMediaFile(file);
    else toast.error("Unsupported file type");
  };

  // ---- Exports ----
  const exportSize = () => ASPECTS[state.aspect];
  const actions: StudioActions = {
    mediaName,
    modelName,
    audioName,
    levelsRef,
    onWebcam,
    onMediaFile,
    onStopMedia,
    onModelFile,
    onMic,
    onAudioFile,
    onStopAudio,
    onPreset: (patch) => set(patch),
    onShare,
    onSaveJson: () => downloadTemplate(stateRef.current),
    onLoadJson,
    busy,
    onGif: (fps, width) => {
      setBusy("gif");
      recordGif(subscribe, { seconds: 3, fps, width })
        .then(() => toast.success("GIF downloaded"))
        .finally(() => setBusy(null));
    },
    onHtml: () => {
      setBusy("html");
      recordHtml(subscribe, stateRef.current)
        .then(() => toast.success("Stand-alone HTML downloaded"))
        .finally(() => setBusy(null));
    },
    onAnsi: () => withGrid((g) => {
      exportAnsi(g, state);
      toast.success("ANSI file downloaded — run `cat file.ans` in a terminal");
    }),
  };

  const handlePng = () =>
    withGrid((g) => {
      const a = exportSize();
      exportPNG(g, state, a.w, a.h, timeRef.current);
      toast.success(`PNG exported at ${a.w}×${a.h}`);
    });
  const handleSvg = () =>
    withGrid((g) => {
      const a = exportSize();
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
            <p className="text-[10px] text-muted-foreground">Typography · 3D · Media · Audio</p>
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
            actions={actions}
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

        <div
          ref={stageRef}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) handleDrop(f);
          }}
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_30%,color-mix(in_oklab,var(--color-primary)_8%,transparent),transparent_60%)] p-6"
        >
          <canvas
            ref={canvasRef}
            className={`rounded-sm border border-border/60 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.8)] ${
              state.fgMode === "shape" ? "cursor-grab active:cursor-grabbing" : ""
            }`}
          />
          {dragOver && (
            <div className="pointer-events-none absolute inset-4 flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-primary bg-background/70 text-xs uppercase tracking-[0.2em] text-primary">
              <Upload className="size-6" />
              Drop image, video, GIF, 3D model, audio or template
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
