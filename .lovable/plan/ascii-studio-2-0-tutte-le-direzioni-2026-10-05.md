# ASCII Studio 2.0 — tutte le direzioni

Lavoro diviso in 5 fasi, implementate in ordine nello stesso giro. Ogni fase aggiunge una sezione nella barra laterale.

## 1. Nuove sorgenti
- Nuova modalità primo piano "Media" con sotto-opzioni: **Webcam**, **Immagine**, **Video/GIF**.
- Webcam live (richiesta permesso), con luminosità, contrasto, specchio.
- Upload immagine/video/GIF tramite pulsante o trascinamento sul canvas; video in loop.
- Modalità 3D: nuova voce "Modello personalizzato" con upload/trascinamento di file .obj, .gltf, .glb, centrato e scalato automaticamente, con la luce esistente.

## 2. Rendering avanzato
- **Contorni (Sobel)**: interruttore che sostituisce i caratteri sui bordi con / \ | - _ secondo la direzione.
- **Dithering**: Nessuno / Floyd-Steinberg / Bayer 4x4, con intensità.
- **Colore per cella**: nuove modalità "Full color" (colori reali della sorgente media o shader 3D) e "Gradiente" (due colori scelti dall'utente mappati sulla luminosità).
- **Effetto CRT**: curvatura, bloom fosforico, scanline animate, vignettatura (applicati solo in anteprima e opzionalmente in export).

## 3. Preset e condivisione
- Galleria con 5 preset: Cyberpunk Terminal, Acid Rave, Monochrome Swiss, 80s Arcade, Matrix Deep.
- Pulsante "Copia link": tutti i parametri salvati nell'URL (hash compresso); all'apertura il link ricarica la creazione.
- Salva / carica template JSON (download e upload file).

## 4. Export estesi
- **GIF animata** (3s, frame rate e dimensione scelti).
- **HTML stand-alone**: un singolo file che riproduce l'opera animata (sfondi procedurali + testo; per media/3D esporta una sequenza di frame ASCII in loop).
- **ANSI text**: file .ans / copia con colori escape a 24-bit.

## 5. Audio-reattività
- Sorgente: microfono o file audio (MP3/WAV) con player.
- Analisi bassi / medi / alti; per ognuno si sceglie il parametro da modulare (glitch, ampiezza onda, jitter, rotazione 3D, contrasto) e la quantità.
- Indicatore livelli in tempo reale.

## Dettagli tecnici
- Nuovi moduli in `src/lib/ascii/`: `media.ts` (webcam/video/immagine → buffer luminosità+RGB a risoluzione griglia via canvas off-screen), `post.ts` (Sobel, dithering), `crt.ts` (overlay canvas 2D), `presets.ts`, `share.ts` (serializzazione stato, base64url + CompressionStream), `audio.ts` (Web Audio AnalyserNode), `export-extra.ts` (GIF con `gifenc`, HTML, ANSI).
- La griglia acquisisce un buffer opzionale `rgb: Uint8ClampedArray` per il colore per cella; `drawGrid`, SVG e ANSI lo usano.
- Il layer 3D legge anche il colore dal render target; modelli caricati con `OBJLoader`/`GLTFLoader` di `three/examples`, normalizzati con bounding box.
- Lo stato media/audio (stream, file) resta fuori da `StudioState` (non serializzabile); preset/URL/JSON salvano solo parametri.
- Dipendenza nuova: `gifenc`. Tutto resta client-only.
- `AGENTS.md` aggiornato con la regola del buffer colore condiviso.
