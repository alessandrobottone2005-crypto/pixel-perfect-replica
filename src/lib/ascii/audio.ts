import type { AudioTarget, StudioState } from "./types";

export type AudioLevels = { bass: number; mid: number; high: number };

/** Microphone or audio file analysed into bass / mid / high levels (0..1). */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: AudioNode | null = null;
  private stream: MediaStream | null = null;
  private data = new Uint8Array(512);
  element: HTMLAudioElement | null = null;
  kind: "mic" | "file" | null = null;
  name = "";
  levels: AudioLevels = { bass: 0, mid: 0, high: 0 };

  private ensure() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.75;
      this.data = new Uint8Array(this.analyser.frequencyBinCount);
    }
    void this.ctx.resume();
    return { ctx: this.ctx, analyser: this.analyser! };
  }

  stop() {
    this.source?.disconnect();
    this.source = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.element) {
      this.element.pause();
      URL.revokeObjectURL(this.element.src);
    }
    this.element = null;
    this.kind = null;
    this.name = "";
    this.levels = { bass: 0, mid: 0, high: 0 };
  }

  async startMic() {
    this.stop();
    const { ctx, analyser } = this.ensure();
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const src = ctx.createMediaStreamSource(this.stream);
    src.connect(analyser);
    this.source = src;
    this.kind = "mic";
    this.name = "Microphone";
  }

  async loadFile(file: File) {
    this.stop();
    const { ctx, analyser } = this.ensure();
    const el = new Audio(URL.createObjectURL(file));
    el.loop = true;
    const src = ctx.createMediaElementSource(el);
    src.connect(analyser);
    analyser.connect(ctx.destination);
    this.source = src;
    this.element = el;
    this.kind = "file";
    this.name = file.name;
    await el.play();
  }

  update() {
    const a = this.analyser;
    if (!a || !this.kind) return this.levels;
    a.getByteFrequencyData(this.data);
    const hzPerBin = (this.ctx!.sampleRate / 2) / this.data.length;
    const band = (lo: number, hi: number) => {
      const s = Math.max(0, Math.floor(lo / hzPerBin));
      const e = Math.min(this.data.length, Math.ceil(hi / hzPerBin));
      let sum = 0;
      for (let i = s; i < e; i++) sum += this.data[i]!;
      return e > s ? sum / (e - s) / 255 : 0;
    };
    this.levels = { bass: band(20, 250), mid: band(250, 2000), high: band(2000, 12000) };
    return this.levels;
  }

  dispose() {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }
}

/** Returns a modulated copy of the state plus the extra 3D spin for this frame. */
export function applyAudio(s: StudioState, lv: AudioLevels): { state: StudioState; spin: number } {
  const out = { ...s };
  let spin = 0;
  const apply = (target: AudioTarget, v: number) => {
    const x = Math.min(1.5, v * s.audioGain);
    switch (target) {
      case "glitch":
        out.glitch = Math.min(0.6, out.glitch + x * 0.35);
        break;
      case "wave":
        out.waveFrequency = out.waveFrequency + x * 3;
        break;
      case "jitter":
        out.jitter = Math.min(1.5, out.jitter + x * 0.8);
        break;
      case "rotation":
        spin += x * 4;
        break;
      case "contrast":
        out.contrast = out.contrast + x * 2.5;
        break;
    }
  };
  apply(s.audioBass, lv.bass);
  apply(s.audioMid, lv.mid);
  apply(s.audioHigh, lv.high);
  return { state: out, spin };
}
