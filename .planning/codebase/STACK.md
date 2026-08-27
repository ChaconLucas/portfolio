# STACK

## Runtime
- Static single-page site. No framework, no router, no server.
- Browser ES modules, served/bundled by Vite. **Must not be opened via `file://`** (bare `import * as THREE from 'three'` needs Vite resolution).
- Language: HTML + vanilla JS (ES2020+) + hand-written CSS. No TypeScript, no JSX, no preprocessor.
- Page language is `pt-BR` (`<html lang="pt-BR">`); copy is mixed PT/EN.

## Dependencies (package.json, v0.17.0, `"type": "module"`)
| Package | Version | Role |
|---|---|---|
| `three` | 0.180.0 | dependency — the Stack Universe (only runtime dep) |
| `vite` | 7.1.3 | devDependency — dev server + build |

No lockfile drift concerns beyond these two; `package-lock.json` is present and small (~35 KB).

## Scripts
```
npm run dev      # vite --host 0.0.0.0
npm run build    # vite build   -> dist/
npm run preview  # vite preview --host 0.0.0.0
npm run check    # alias for build (the only "gate" that exists)
```
The project gate is `npm run build`: it must pass before any change is declared complete. There is no lint, no typecheck, no test runner.

## Entry point
`index.html` at repo root is the Vite entry, the whole app, and the whole design system: 10,266 lines / ~415 KB. It contains one 4,455-line `<style>` block, a second small `<style>` block, and eight `<script>` blocks. See `ARCHITECTURE.md` / `STRUCTURE.md` for the line map.

## Three.js usage profile
Only one module script imports Three (index.html:9585). It pulls the whole `three` namespace (`import * as THREE`), so tree-shaking is weak — the bundle carries far more than the ~20 classes actually used (Scene, PerspectiveCamera, WebGLRenderer, Group, Points/PointsMaterial/BufferGeometry, Line/LineLoop/LineBasicMaterial, EllipseCurve, SphereGeometry/RingGeometry, MeshPhysicalMaterial/MeshBasicMaterial, ShaderMaterial, Sprite/SpriteMaterial, CanvasTexture, PointLight/HemisphereLight/DirectionalLight/AmbientLight, Raycaster, Clock, FogExp2, Vector2/Vector3, Color).
No `OrbitControls`, no loaders, no post-processing — all textures are generated procedurally on `<canvas>` at runtime, so there are **zero texture files to ship**.

## Asset pipeline
- `public/` is copied verbatim by Vite. Only content: `public/assets/projects/*.webp` (9 files).
- Referenced from markup as absolute root paths (`/assets/projects/gatecheck-1.webp`) — correct for the default Vite `base: '/'`. Any non-root deploy base would break every screenshot silently.
- No `vite.config.js` exists: defaults apply (`base: '/'`, `outDir: dist`, esbuild minify, assets inlined under 4 KB).
- Fonts: none bundled or linked. CSS asks for `Inter` and falls back to `system-ui`; in practice most users see the system font.
- One inlined SVG noise texture as a `data:` URI (index.html:112).

## Build output expectations
`vite build` emits `dist/index.html` (with the giant inline CSS/JS preserved inline — Vite does not extract inline blocks) plus one hashed JS chunk for the Three module and the copied `assets/`. The ~415 KB of inline HTML is therefore **not** minified/split the way an external module would be.
