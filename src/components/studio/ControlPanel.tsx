import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Copy, Download, FileCode2, Layers, Regex, Sliders, Video, Zap } from "lucide-react";
import { Field, SectionNote, SelectField, SliderField } from "./controls";
import {
  RAMPS,
  type RampConfig,
  type StudioState,
} from "@/lib/ascii/types";

type Props = {
  s: StudioState;
  set: (patch: Partial<StudioState>) => void;
  onPng: () => void;
  onSvg: () => void;
  onWebm: () => void;
  onCopy: () => void;
  recording: boolean;
};

function RampEditor({
  label,
  cfg,
  onChange,
}: {
  label: string;
  cfg: RampConfig;
  onChange: (c: RampConfig) => void;
}) {
  const presets: { key: RampConfig["preset"]; label: string }[] = [
    { key: "standard", label: "Standard" },
    { key: "code", label: "Code" },
    { key: "blocks", label: "Blocks" },
    { key: "custom", label: "Custom" },
  ];
  return (
    <Field label={label}>
      <div className="grid grid-cols-4 gap-1">
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => onChange({ ...cfg, preset: p.key })}
            className={`rounded-sm border px-1 py-1 text-[10px] transition-colors ${
              cfg.preset === p.key
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {cfg.preset === "custom" ? (
        <Input
          value={cfg.custom}
          onChange={(e) => onChange({ ...cfg, custom: e.target.value })}
          placeholder="dense → sparse"
          className="h-8 font-mono text-xs"
        />
      ) : (
        <div className="truncate rounded-sm border border-border/60 bg-muted/40 px-2 py-1.5 font-mono text-[11px] text-foreground/60">
          {RAMPS[cfg.preset as keyof typeof RAMPS]}
        </div>
      )}
    </Field>
  );
}

export function ControlPanel({ s, set, onPng, onSvg, onWebm, onCopy, recording }: Props) {
  return (
    <Accordion
      type="multiple"
      defaultValue={["layers", "ascii", "motion", "export"]}
      className="w-full"
    >
      <AccordionItem value="layers" className="border-border/60">
        <AccordionTrigger className="px-4 text-[11px] uppercase tracking-[0.2em] hover:no-underline">
          <span className="flex items-center gap-2">
            <Layers className="size-3.5" /> Layers
          </span>
        </AccordionTrigger>
        <AccordionContent className="space-y-5 px-4 pb-5">
          <div className="space-y-3 rounded-md border border-border/60 bg-card/40 p-3">
            <p className="text-[10px] uppercase tracking-[0.22em] text-foreground/50">Background</p>
            <SelectField
              label="Generator"
              value={s.bgKind}
              onChange={(v) => set({ bgKind: v })}
              options={[
                { value: "simplex", label: "Simplex Noise" },
                { value: "matrix", label: "Matrix Rain" },
                { value: "scanlines", label: "Grid Scanlines" },
                { value: "waves", label: "Geometric Waves" },
                { value: "none", label: "Empty" },
              ]}
            />
            <SliderField
              label="Noise scale"
              value={s.noiseScale}
              min={0.4}
              max={12}
              step={0.1}
              onChange={(v) => set({ noiseScale: v })}
            />
            <SliderField
              label="Speed"
              value={s.bgSpeed}
              min={0}
              max={4}
              onChange={(v) => set({ bgSpeed: v })}
            />
            <SliderField
              label="Contrast"
              value={s.contrast}
              min={0.2}
              max={4}
              onChange={(v) => set({ contrast: v })}
            />
          </div>

          <div className="space-y-3 rounded-md border border-border/60 bg-card/40 p-3">
            <p className="text-[10px] uppercase tracking-[0.22em] text-foreground/50">Foreground</p>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  { v: "text", l: "Type" },
                  { v: "shape", l: "3D" },
                  { v: "none", l: "Off" },
                ] as const
              ).map((m) => (
                <button
                  key={m.v}
                  onClick={() => set({ fgMode: m.v })}
                  className={`rounded-sm border px-2 py-1.5 text-[10px] uppercase tracking-widest transition-colors ${
                    s.fgMode === m.v
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m.l}
                </button>
              ))}
            </div>

            {s.fgMode === "text" && (
              <>
                <Field label="Text">
                  <Textarea
                    value={s.text}
                    onChange={(e) => set({ text: e.target.value })}
                    rows={3}
                    className="resize-none font-mono text-xs"
                  />
                </Field>
                <SelectField
                  label="Font"
                  value={s.font}
                  onChange={(v) => set({ font: v })}
                  options={[
                    { value: "mono", label: "Monospace" },
                    { value: "serif", label: "Serif" },
                    { value: "sans", label: "Sans" },
                  ]}
                />
                <SliderField
                  label="Size"
                  value={s.textSize}
                  min={0.05}
                  max={0.9}
                  onChange={(v) => set({ textSize: v })}
                />
                <SliderField
                  label="Tracking"
                  value={s.tracking}
                  min={-1}
                  max={4}
                  onChange={(v) => set({ tracking: v })}
                />
                <SliderField
                  label="Leading"
                  value={s.leading}
                  min={0.6}
                  max={2.4}
                  onChange={(v) => set({ leading: v })}
                />
                <SliderField
                  label="Weight"
                  value={s.weight}
                  min={100}
                  max={900}
                  step={100}
                  onChange={(v) => set({ weight: v })}
                />
                <div className="flex items-center justify-between pt-1">
                  <Label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Kinetic
                  </Label>
                  <Switch checked={s.kinetic} onCheckedChange={(v) => set({ kinetic: v })} />
                </div>
              </>
            )}

            {s.fgMode === "shape" && (
              <>
                <SelectField
                  label="Primitive"
                  value={s.shape}
                  onChange={(v) => set({ shape: v })}
                  options={[
                    { value: "torusKnot", label: "Torus Knot" },
                    { value: "sphere", label: "Sphere" },
                    { value: "metaballs", label: "Metaballs" },
                  ]}
                />
                <SectionNote>Drag the canvas to orbit, scroll to dolly.</SectionNote>
                <SliderField
                  label="Light X"
                  value={s.lightX}
                  min={-10}
                  max={10}
                  step={0.1}
                  onChange={(v) => set({ lightX: v })}
                />
                <SliderField
                  label="Light Y"
                  value={s.lightY}
                  min={-10}
                  max={10}
                  step={0.1}
                  onChange={(v) => set({ lightY: v })}
                />
                <SliderField
                  label="Light Z"
                  value={s.lightZ}
                  min={-10}
                  max={10}
                  step={0.1}
                  onChange={(v) => set({ lightZ: v })}
                />
                <SliderField
                  label="Intensity"
                  value={s.lightIntensity}
                  min={0}
                  max={6}
                  onChange={(v) => set({ lightIntensity: v })}
                />
              </>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="ascii" className="border-border/60">
        <AccordionTrigger className="px-4 text-[11px] uppercase tracking-[0.2em] hover:no-underline">
          <span className="flex items-center gap-2">
            <Regex className="size-3.5" /> ASCII Engine
          </span>
        </AccordionTrigger>
        <AccordionContent className="space-y-5 px-4 pb-5">
          <SliderField
            label="Grid density"
            value={s.cols}
            min={30}
            max={260}
            step={1}
            onChange={(v) => set({ cols: Math.round(v) })}
            format={(v) => `${Math.round(v)} cols`}
          />
          <RampEditor label="Background ramp" cfg={s.bgRamp} onChange={(c) => set({ bgRamp: c })} />
          <RampEditor label="Foreground ramp" cfg={s.fgRamp} onChange={(c) => set({ fgRamp: c })} />
          <SliderField
            label="Grid jitter"
            value={s.jitter}
            min={0}
            max={1}
            onChange={(v) => set({ jitter: v })}
          />
          <SliderField
            label="Glitch swap"
            value={s.glitch}
            min={0}
            max={0.5}
            onChange={(v) => set({ glitch: v })}
          />
          <SelectField
            label="Color mode"
            value={s.colorMode}
            onChange={(v) => set({ colorMode: v })}
            options={[
              { value: "dual", label: "Dual Tone" },
              { value: "matrix", label: "Matrix Green" },
              { value: "rgbsplit", label: "RGB Split" },
            ]}
          />
          {s.colorMode !== "matrix" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ink">
                <input
                  type="color"
                  value={s.inkColor}
                  onChange={(e) => set({ inkColor: e.target.value })}
                  className="h-8 w-full cursor-pointer rounded-sm border border-border bg-transparent"
                />
              </Field>
              <Field label="Paper">
                <input
                  type="color"
                  value={s.paperColor}
                  onChange={(e) => set({ paperColor: e.target.value })}
                  className="h-8 w-full cursor-pointer rounded-sm border border-border bg-transparent"
                />
              </Field>
            </div>
          )}
          {s.colorMode === "rgbsplit" && (
            <SliderField
              label="Aberration"
              value={s.rgbSplit}
              min={0}
              max={2}
              onChange={(v) => set({ rgbSplit: v })}
            />
          )}
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="motion" className="border-border/60">
        <AccordionTrigger className="px-4 text-[11px] uppercase tracking-[0.2em] hover:no-underline">
          <span className="flex items-center gap-2">
            <Sliders className="size-3.5" /> Motion
          </span>
        </AccordionTrigger>
        <AccordionContent className="space-y-4 px-4 pb-5">
          <SliderField
            label="Global speed"
            value={s.speed}
            min={0}
            max={4}
            onChange={(v) => set({ speed: v })}
          />
          <SliderField
            label="Z rotation"
            value={s.zRotation}
            min={-2}
            max={2}
            onChange={(v) => set({ zRotation: v })}
          />
          <SliderField
            label="Wave frequency"
            value={s.waveFrequency}
            min={0}
            max={6}
            onChange={(v) => set({ waveFrequency: v })}
          />
          <SectionNote>
            <Zap className="mr-1 inline size-3" />
            Wave frequency drives kinetic type and the 3D tumble.
          </SectionNote>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="export" className="border-b-0 border-border/60">
        <AccordionTrigger className="px-4 text-[11px] uppercase tracking-[0.2em] hover:no-underline">
          <span className="flex items-center gap-2">
            <Download className="size-3.5" /> Export
          </span>
        </AccordionTrigger>
        <AccordionContent className="space-y-2 px-4 pb-6">
          <Button onClick={onPng} className="w-full justify-start gap-2 text-xs" size="sm">
            <Download className="size-3.5" /> Download high-res PNG
          </Button>
          <Button
            onClick={onSvg}
            variant="secondary"
            className="w-full justify-start gap-2 text-xs"
            size="sm"
          >
            <FileCode2 className="size-3.5" /> Export SVG (plotter)
          </Button>
          <Button
            onClick={onWebm}
            variant="secondary"
            disabled={recording}
            className="w-full justify-start gap-2 text-xs"
            size="sm"
          >
            <Video className="size-3.5" /> {recording ? "Recording 5s…" : "Record 5s WebM"}
          </Button>
          <Button
            onClick={onCopy}
            variant="outline"
            className="w-full justify-start gap-2 text-xs"
            size="sm"
          >
            <Copy className="size-3.5" /> Copy ASCII
          </Button>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
