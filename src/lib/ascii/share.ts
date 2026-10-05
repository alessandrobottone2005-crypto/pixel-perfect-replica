import { DEFAULT_STATE, type StudioState } from "./types";

function toB64Url(bytes: Uint8Array) {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Keeps only known keys with matching primitive types. */
export function sanitizeState(raw: unknown): StudioState {
  const out: Record<string, unknown> = { ...DEFAULT_STATE };
  if (raw && typeof raw === "object") {
    for (const [k, def] of Object.entries(DEFAULT_STATE)) {
      const v = (raw as Record<string, unknown>)[k];
      if (v === undefined) continue;
      if (typeof def === "object" && def && typeof v === "object" && v) {
        out[k] = { ...def, ...(v as object) };
      } else if (typeof v === typeof def) {
        out[k] = v;
      }
    }
  }
  return out as StudioState;
}

export async function encodeState(s: StudioState): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(s));
  return toB64Url(await pipe(json, new CompressionStream("deflate-raw")));
}

export async function decodeState(code: string): Promise<StudioState> {
  const bytes = await pipe(fromB64Url(code), new DecompressionStream("deflate-raw"));
  return sanitizeState(JSON.parse(new TextDecoder().decode(bytes)));
}

export function downloadTemplate(s: StudioState) {
  const blob = new Blob([JSON.stringify({ app: "ascii-studio", version: 2, state: s }, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ascii-template-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function readTemplate(file: File): Promise<StudioState> {
  const data = JSON.parse(await file.text());
  return sanitizeState(data?.state ?? data);
}
