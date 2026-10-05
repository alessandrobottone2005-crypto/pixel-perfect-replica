import { CELL_ASPECT, type StudioState } from "./types";

type GifFrame = { bitmap: ImageBitmap; duration: number };

/**
 * A user media source (webcam, image, video, animated GIF) sampled down to
 * the ASCII grid: writes luminance, coverage mask and per-cell RGB.
 */
export class MediaLayer {
  kind: "webcam" | "image" | "video" | "gif" | null = null;
  name = "";
  private video: HTMLVideoElement | null = null;
  private image: HTMLImageElement | null = null;
  private gif: GifFrame[] = [];
  private gifTotal = 0;
  private stream: MediaStream | null = null;
  private url: string | null = null;
  private canvas = document.createElement("canvas");

  get ready() {
    return this.kind !== null;
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video.removeAttribute("src");
    }
    this.video = null;
    this.image = null;
    this.gif.forEach((f) => f.bitmap.close());
    this.gif = [];
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
    this.kind = null;
    this.name = "";
  }

  async startWebcam() {
    this.stop();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.srcObject = stream;
    await v.play();
    this.stream = stream;
    this.video = v;
    this.kind = "webcam";
    this.name = "Webcam";
  }

  async loadFile(file: File) {
    this.stop();
    if (file.type === "image/gif" && "ImageDecoder" in window) {
      try {
        await this.loadGif(file);
        return;
      } catch {
        /* fall back to static image */
      }
    }
    const url = URL.createObjectURL(file);
    this.url = url;
    if (file.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.src = url;
      await v.play();
      this.video = v;
      this.kind = "video";
    } else {
      const img = new Image();
      img.src = url;
      await img.decode();
      this.image = img;
      this.kind = "image";
    }
    this.name = file.name;
  }

  private async loadGif(file: File) {
    // ImageDecoder is not yet in the TS DOM lib everywhere.
    const Decoder = (window as unknown as { ImageDecoder: new (o: object) => any }).ImageDecoder;
    const dec = new Decoder({ data: await file.arrayBuffer(), type: "image/gif" });
    await dec.tracks.ready;
    const count: number = dec.tracks.selectedTrack.frameCount;
    const frames: GifFrame[] = [];
    for (let i = 0; i < Math.min(count, 300); i++) {
      const { image } = await dec.decode({ frameIndex: i });
      const duration = (image.duration ?? 100000) / 1000;
      frames.push({ bitmap: await createImageBitmap(image), duration: Math.max(20, duration) });
      image.close();
    }
    if (!frames.length) throw new Error("empty gif");
    this.gif = frames;
    this.gifTotal = frames.reduce((a, f) => a + f.duration, 0);
    this.kind = "gif";
    this.name = file.name;
  }

  private currentSource(): { src: CanvasImageSource; w: number; h: number } | null {
    if (this.video && this.video.videoWidth) {
      return { src: this.video, w: this.video.videoWidth, h: this.video.videoHeight };
    }
    if (this.image) return { src: this.image, w: this.image.naturalWidth, h: this.image.naturalHeight };
    if (this.gif.length) {
      let t = performance.now() % this.gifTotal;
      for (const f of this.gif) {
        if (t < f.duration) return { src: f.bitmap, w: f.bitmap.width, h: f.bitmap.height };
        t -= f.duration;
      }
      const f = this.gif[0]!;
      return { src: f.bitmap, w: f.bitmap.width, h: f.bitmap.height };
    }
    return null;
  }

  sample(
    lum: Float32Array,
    mask: Uint8Array,
    rgb: Uint8ClampedArray,
    cols: number,
    rows: number,
    s: StudioState,
  ): boolean {
    const cur = this.currentSource();
    if (!cur) return false;
    const c = this.canvas;
    if (c.width !== cols || c.height !== rows) {
      c.width = cols;
      c.height = rows;
    }
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    // "Cover" fit, accounting for cells being taller than wide.
    const visW = cols;
    const visH = rows / CELL_ASPECT;
    const scale = Math.max(visW / cur.w, visH / cur.h);
    const dw = cur.w * scale;
    const dh = cur.h * scale * CELL_ASPECT;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cols, rows);
    if (s.mediaMirror && this.kind === "webcam") {
      ctx.translate(cols, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(cur.src, (cols - dw) / 2, (rows - dh) / 2, dw, dh);
    const d = ctx.getImageData(0, 0, cols, rows).data;
    const n = cols * rows;
    for (let i = 0; i < n; i++) {
      const r = d[i * 4]!;
      const g = d[i * 4 + 1]!;
      const b = d[i * 4 + 2]!;
      let l = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      l = (l - 0.5) * s.mediaContrast + 0.5 + s.mediaBrightness;
      lum[i] = l < 0 ? 0 : l > 1 ? 1 : l;
      mask[i] = 1;
      rgb[i * 3] = r;
      rgb[i * 3 + 1] = g;
      rgb[i * 3 + 2] = b;
    }
    return true;
  }
}
