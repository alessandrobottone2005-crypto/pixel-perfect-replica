<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules

- The ASCII pipeline lives in `src/lib/ascii/` (types, field generators, three-scene, render, export) and all layers write into one shared brightness grid — so background, text, and 3D share a single character pass.
- The 3D layer uses plain Three.js rendered off-screen into a grid-sized render target (not React Three Fiber), because the ASCII pass needs per-frame pixel readback.
- The studio route is `ssr: false`; WebGL, canvas, and MediaRecorder code must never run on the server.
