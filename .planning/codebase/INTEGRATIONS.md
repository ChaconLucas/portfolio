# INTEGRATIONS

## Summary
The site is fully self-contained. **No backend, no API calls, no analytics, no CDN, no third-party script, no cookie/consent surface, no telemetry.** There is not a single `fetch`, `XMLHttpRequest`, or `<link rel>` to an external host anywhere in `index.html`.

## Environment
`.env.example`:
```
# No environment variables are required for the current static portfolio.
```
That is the whole file. `.gitignore` still guards `.env` / `.env.*` (with `!.env.example`) for future use. Nothing in the code reads `import.meta.env`.

## npm dependencies
| Package | Version | Where it enters the graph |
|---|---|---|
| `three` | 0.180.0 | `import * as THREE from 'three'` — index.html:9585, the only import statement in the project |
| `vite` | 7.1.3 | dev/build tooling only |

There is **no import map and no CDN fallback**: the bare specifier `three` is resolved by Vite alone. This is why `README.md` warns that opening `index.html` over `file://` fails — the Universe simply never mounts.

## Browser APIs relied on
- **WebGL** via `THREE.WebGLRenderer` (9596), `powerPreference:'high-performance'`. No context-loss handler and no fallback path if WebGL is unavailable — the canvas stays blank.
- **Canvas 2D** — used twice: the live starfield (`#universeStars`, 9891) and every texture in the Universe. All planet/sun/glow/ray textures are drawn procedurally into offscreen canvases at runtime (9630–9660, 9731–9784), so **no image assets are needed for the 3D scene**.
- **localStorage**, wrapped in a try/catch `safeStorage` helper (4787–4801) so private-mode failures degrade silently. Keys: `lc-palette`, `lc-mode`.
- Pointer Events (`pointerdown`/`move`/`up` on the canvas, 9840–9842), `setPointerCapture`.
- `CustomEvent` `stack-project-focus` dispatched on `window` (9835) — **no listener exists**, so this internal integration point is currently a no-op.
- `window.__portfolioUniverseScroll` — the single global that bridges the DOM scroll orchestrator (4988) to the Three RAF (9846).

## Asset references
`public/` is copied verbatim; all references are **absolute root paths**, which means any deploy that is not at domain root silently 404s every screenshot.

| Asset | Referenced at | Notes |
|---|---|---|
| `/assets/projects/gatecheck-1..4.webp` | index.html:4702–4705 | one `<figure>` per shot, `data-gate-shot` index |
| `/assets/projects/rare7-1..5.webp` | index.html:4749 | all five on a single ~1,700-char line |
| WSL chapter | 4715–4738 | **no images** — the mock is drawn entirely in CSS |
| noise texture | index.html:112 | inline `data:image/svg+xml` URI, not a file |

None of the nine `<img>` tags carry `loading="lazy"` or `decoding="async"`; all nine carry `alt` text. All are inside sticky scroll chapters far below the fold, so they compete with first paint.

## Outbound links (contact section, index.html:4782)
- `mailto:lucaschacon.dev@gmail.com`
- `https://github.com/` — **placeholder, points at the GitHub homepage, not a profile**
- `https://linkedin.com/in/lucas-chacon-129414a7`

The GitHub link is a live defect worth fixing during stabilization.

## Fonts
CSS requests `Inter, system-ui, -apple-system, Segoe UI, Arial, sans-serif`. Inter is neither bundled nor linked from Google Fonts, so unless the visitor has it installed locally the site renders in the system UI font — a silent divergence from the intended editorial typography in `docs/DESIGN_SYSTEM.md`.

## Deployment assumptions
No `vite.config.js`, so Vite defaults hold: `base: '/'`, `outDir: dist/`. The output is a static bundle deployable to any static host with no configuration beyond serving from the domain root.
