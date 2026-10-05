import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AudioLines, Camera, Link2, Monitor, Palette, Upload } from "lucide-react";
import { SelectField, SliderField, SectionNote } from "./controls";
import { PRESETS } from "@/lib/ascii/presets";
import type { AudioTarget, StudioState } from "@/lib/ascii/types";

export type StudioActions = {
  mediaName: string;
  modelName: string;
  audioName: string;
  levelsRef: MutableRefObject<{ bass: number; mid: number; high: number }>;
  onWebcam: () => void;
  onMediaFile: (f: File) => void;
  onStopMedia: () => void;
  onModelFile: (f: File) => void;
  onMic: () => void;
  onAudioFile: (f: File) => void;
  onStopAudio: () => void;
  onPreset: (patch: Partial<StudioState>) => void;
  onShare: () => void;
  onSaveJson: () => void;
  onLoadJson: (f: File) => void;
  busy: "gif" | "html" | null;
  onGif: (fps: number, width: number) => void;
  onHtml: () => void;
  onAnsi: () => void;
};

type P = { s: StudioState; set: (p: Partial<StudioState>) => void; a: StudioActions };

export function FilePick({ accept, label, onFile }: { accept: string; label: string; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" accept={accept} hidden onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) onFile(f);
        e.target.value = "";
      }} />
      <Button size="sm" variant="secondary" className="w-full justify-start gap-2 text-xs" onClick={() => ref.current?.click()}>
        <Upload className="size-3.5" /> {label}
      </Button>
    </>
  );
}

const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between">
    <Label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</Label>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

const trig = "px-4 text-[11px] uppercase tracking-[0.2em] hover:no-underline";

export function MediaControls({ s, set, a }: P) {
  return (
    <>
      <Button size="sm" className="w-full justify-start gap-2 text-xs" onClick={a.onWebcam}>
        <Camera className="size-3.5" /> Start webcam
      </Button>
      <FilePick accept="image/*,video/*" label="Upload image / video / GIF" onFile={a.onMediaFile} />
      {a.mediaName && (
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="truncate">{a.mediaName}</span>
          <button className="underline" onClick={a.onStopMedia}>Stop</button>
        </div>
      )}
      <SliderField label="Brightness" value={s.mediaBrightness} min={-0.5} max={0.5} onChange={(v) => set({ mediaBrightness: v })} />
      <SliderField label="Contrast" value={s.mediaContrast} min={0.2} max={4} onChange={(v) => set({ mediaContrast: v })} />
      <Toggle label="Mirror webcam" checked={s.mediaMirror} onChange={(v) => set({ mediaMirror: v })} />
      <SectionNote>You can also drop files directly on the canvas.</SectionNote>
    </>
  );
}

function Meter({ levelsRef }: { levelsRef: StudioActions["levelsRef"] }) {
  const [lv, setLv] = useState(levelsRef.current);
  useEffect(() => {
    const id = setInterval(() => setLv({ ...levelsRef.current }), 100);
    return () => clearInterval(id);
  }, [levelsRef]);
  return (
    <div className="grid grid-cols-3 gap-2">
      {(["bass", "mid", "high"] as const).map((k) => (
        <div key={k} className="space-y-1">
          <div className="h-12 overflow-hidden rounded-sm bg-muted/40 flex items-end">
            <div className="w-full bg-primary transition-[height]" style={{ height: `${Math.min(100, lv[k] * 100)}%` }} />
          </div>
          <p className="text-center text-[9px] uppercase text-muted-foreground">{k}</p>
        </div>
      ))}
    </div>
  );
}

const TARGETS: { value: AudioTarget; label: string }[] = [
  { value: "none", label: "None" }, { value: "glitch", label: "Glitch" }, { value: "wave", label: "Wave amplitude" },
  { value: "jitter", label: "Jitter" }, { value: "rotation", label: "3D rotation" }, { value: "contrast", label: "Contrast" },
];

export function ExtraPanels({ s, set, a }: P) {
  const [fps, setFps] = useState(12);
  const [gw, setGw] = useState(480);
  return (
    <>
      <AccordionItem value="presets" className="border-border/60">
        <AccordionTrigger className={trig}><span className="flex items-center gap-2"><Palette className="size-3.5" /> Presets & Share</span></AccordionTrigger>
        <AccordionContent className="space-y-2 px-4 pb-5">
          <div className="grid grid-cols-1 gap-1">
            {PRESETS.map((p) => (
              <button key={p.name} onClick={() => a.onPreset(p.patch)} className="flex items-center gap-2 rounded-sm border border-border px-2 py-1.5 text-left text-[11px] hover:border-primary">
                <span className="flex size-4 overflow-hidden rounded-sm">
                  <span className="flex-1" style={{ background: p.swatch[0] }} />
                  <span className="flex-1" style={{ background: p.swatch[1] }} />
                </span>
                {p.name}
              </button>
            ))}
          </div>
          <Button size="sm" className="w-full justify-start gap-2 text-xs" onClick={a.onShare}><Link2 className="size-3.5" /> Copy share link</Button>
          <Button size="sm" variant="secondary" className="w-full justify-start gap-2 text-xs" onClick={a.onSaveJson}>Save template JSON</Button>
          <FilePick accept=".json,application/json" label="Load template JSON" onFile={a.onLoadJson} />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="render" className="border-border/60">
        <AccordionTrigger className={trig}><span className="flex items-center gap-2"><Monitor className="size-3.5" /> Advanced render</span></AccordionTrigger>
        <AccordionContent className="space-y-4 px-4 pb-5">
          <Toggle label="Edge detection" checked={s.edges} onChange={(v) => set({ edges: v })} />
          {s.edges && <SliderField label="Edge threshold" value={s.edgeThreshold} min={0.05} max={1} onChange={(v) => set({ edgeThreshold: v })} />}
          <SelectField label="Dithering" value={s.dither} onChange={(v) => set({ dither: v })} options={[
            { value: "none", label: "None" }, { value: "floyd", label: "Floyd-Steinberg" }, { value: "bayer", label: "Bayer 4×4" },
          ]} />
          {s.dither !== "none" && <SliderField label="Dither amount" value={s.ditherAmount} min={0} max={2} onChange={(v) => set({ ditherAmount: v })} />}
          <Toggle label="CRT monitor" checked={s.crt} onChange={(v) => set({ crt: v })} />
          {s.crt && (
            <>
              <SliderField label="Curvature" value={s.crtCurve} min={0} max={1} onChange={(v) => set({ crtCurve: v })} />
              <SliderField label="Bloom" value={s.crtBloom} min={0} max={1.5} onChange={(v) => set({ crtBloom: v })} />
              <SliderField label="Scanlines" value={s.crtScanlines} min={0} max={1} onChange={(v) => set({ crtScanlines: v })} />
              <Toggle label="Include in PNG" checked={s.crtInExport} onChange={(v) => set({ crtInExport: v })} />
            </>
          )}
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="audio" className="border-border/60">
        <AccordionTrigger className={trig}><span className="flex items-center gap-2"><AudioLines className="size-3.5" /> Audio reactive</span></AccordionTrigger>
        <AccordionContent className="space-y-3 px-4 pb-5">
          <Button size="sm" className="w-full justify-start gap-2 text-xs" onClick={a.onMic}>Use microphone</Button>
          <FilePick accept="audio/*" label="Load audio track" onFile={a.onAudioFile} />
          {a.audioName && (
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="truncate">{a.audioName}</span>
              <button className="underline" onClick={a.onStopAudio}>Stop</button>
            </div>
          )}
          <Meter levelsRef={a.levelsRef} />
          <SelectField label="Bass →" value={s.audioBass} onChange={(v) => set({ audioBass: v })} options={TARGETS} />
          <SelectField label="Mid →" value={s.audioMid} onChange={(v) => set({ audioMid: v })} options={TARGETS} />
          <SelectField label="High →" value={s.audioHigh} onChange={(v) => set({ audioHigh: v })} options={TARGETS} />
          <SliderField label="Sensitivity" value={s.audioGain} min={0} max={4} onChange={(v) => set({ audioGain: v })} />
        </AccordionContent>
      </AccordionItem>

      <div className="hidden" data-gif-config={`${fps}-${gw}`} />
      <GifExportConfig fps={fps} setFps={setFps} gw={gw} setGw={setGw} a={a} />
    </>
  );
}

function GifExportConfig({ fps, setFps, gw, setGw, a }: { fps: number; setFps: (n: number) => void; gw: number; setGw: (n: number) => void; a: StudioActions }) {
  return (
    <AccordionItem value="export-extra" className="border-border/60">
      <AccordionTrigger className={trig}><span className="flex items-center gap-2">Export GIF · HTML · ANSI</span></AccordionTrigger>
      <AccordionContent className="space-y-3 px-4 pb-5">
        <SliderField label="GIF fps" value={fps} min={6} max={24} step={1} onChange={(v) => setFps(Math.round(v))} />
        <SliderField label="GIF width" value={gw} min={240} max={800} step={20} onChange={(v) => setGw(Math.round(v))} format={(v) => `${Math.round(v)}px`} />
        <Button size="sm" className="w-full justify-start text-xs" disabled={!!a.busy} onClick={() => a.onGif(fps, gw)}>
          {a.busy === "gif" ? "Recording GIF 3s…" : "Export 3s GIF"}
        </Button>
        <Button size="sm" variant="secondary" className="w-full justify-start text-xs" disabled={!!a.busy} onClick={a.onHtml}>
          {a.busy === "html" ? "Capturing frames…" : "Export stand-alone HTML"}
        </Button>
        <Button size="sm" variant="outline" className="w-full justify-start text-xs" onClick={a.onAnsi}>Export ANSI text</Button>
      </AccordionContent>
    </AccordionItem>
  );
}
