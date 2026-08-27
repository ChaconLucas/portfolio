# CONCERNS

Ranked for the stabilization + modularization work. Every item carries the line range in `D:\portfolio\index.html` where it lives.

---

## 1. 3,830 lines of dead code — 37% of the file — `5744–9573`
An entire second Stack Universe: a shadow-DOM, Canvas-2D implementation with its own `<style>` (5749–8701), its own markup (8701–8855), its own planet table, its own tech-detail UI and its own RAF (`draw`, 9331–9333). It is guarded on `document.getElementById('stackUniverseInline')`, and **that id appears nowhere in the body** — only in two orphan CSS rules (2701, 3909). The block returns on line 5747 and never executes.
Every search, every token count, every "read the file" cost so far has been paying for this. **Delete it first.** It is the only change that removes a third of the file while touching zero running code. Related orphans to remove with it: CSS at 2701 and 3909.

## 2. 1,439 `!important` declarations across `8–4462`
The stylesheet is 22 stacked generations (V4.1 → V15), each banner-commented, each overriding the last rather than replacing it: `/* V8.2 */` 1193, `/* V9.4 */` 2072, `/* V10C */` 3073, `/* V11 */` 3466, `/* V12 */` 3778, `/* V13 */` 3916, `/* V14 */` 4018, `/* V15 */` 4374. Several generations of *project transition* CSS (1193–1755, 1873–2071) style effects that V11 superseded.
This is the hard blocker for splitting CSS into files: **specificity here is positional**, so moving a rule to another file changes what wins. Any split must preserve source order exactly, or be preceded by a pass that deletes the superseded generations. Do the deletion pass first, one generation at a time, screenshotting between each.

## 3. Five concurrent RAF loops, none gated — `5328`, `9845`, `9895`, `10171`, `10203`
`introSmoothLoop` (5328–5344), Three `animate` (9845–9886), starfield `draw` (9895–9956), project chapters `tick` (10171–10175), experience `frame` (10203–10263). All self-schedule unconditionally. There is **no `cancelAnimationFrame` anywhere**, no `document.hidden` check, no viewport gating — the WebGL scene and the Canvas-2D starfield keep rendering full-rate while the user reads the contact section in a background tab. On mobile this is a battery and thermal problem, and it is the most likely cause of scroll jank. `docs/ARCHITECTURE.md` already mandates a single central loop; `docs/KNOWN_ISSUES.md` lists "vários RAFs; consolidar" as a known issue.

## 4. `prefers-reduced-motion` is CSS-only — `859, 1184, 1309, 1610, 2262, 3365`
Six media blocks disable CSS animations and transitions. **No JavaScript consults the preference.** A user who has asked for reduced motion still gets: a rotating 3D solar system, a drifting starfield, five scroll-scrub scrubbers and a smoothed dolly camera. Accessibility defect, and it interacts with #3 — the fix is the same central loop, which can then short-circuit on the media query.

## 5. Global-scope leakage and id-only coupling — `4786–5743` (first script block)
The first script is **not** wrapped in an IIFE, unlike every other block. Everything it declares is a `window` global: `$`, `$$`, `clamp`, `safeStorage`, `stackData`, `orbitStackData`, `projectRoutes`, `projectLabels`, `orbitTransitioning`, `orbitCurrentKey`, `introTargetP`, `projectsSmoothP`, and ~30 more. Note `stackData` is declared here (4999) **and again** inside the Three module (9802) with different content — the module scope is the only thing preventing a collision today. Modularizing means these names stop being globals; anything that silently depends on the global (including the disabled legacy code) breaks at runtime, not at build.
Compounding this, all cross-layer coupling is by string id. `vite build` cannot see it — a renamed id builds clean and fails silently, because most lookups are `if(!el) return`.

---

## Secondary

**6. The error reporter is broken — `4805–4811`, `603`.** `window.onerror` writes into `#previewError`, which exists in CSS only and never in markup. Every uncaught exception is swallowed with no visible trace. Since "nenhuma exceção JS" is the stated definition of done (`docs/KNOWN_ISSUES.md`), the check currently has no instrument. Restore the element early — it makes every later step observable.

**7. The theme system is overridden by a later script — `4820–4850` vs `9574–9583`.** Three `.theme-choice` buttons (4471–4475) write `lc-palette` to localStorage; then a script near the bottom unconditionally forces `editorial`/`dark` back on every load. The plum and mono palettes (52–91) are unreachable. Either delete the switcher and its CSS, or delete the forcing script — but decide, because the modularization will otherwise carry a dead branch into a new file.

**8. `innerHTML` with interpolation — `5177, 5178, 5228–5233, 9399–9408, 9439, 9835, 9972`.** All inputs are hard-coded literals today, so there is no live XSS. It matters for two other reasons: 9835 rebuilds the whole stack panel as one 1,900-character template string on **every planet click**, destroying and recreating DOM (and its listeners) inside a WebGL interaction; and these strings are where a future dynamic data source would inject unescaped. Convert the hot one (9835) to node reuse during the Universe extraction.

**9. `renderProjectsMaster()` is disabled but still present — `5628–5742`.** Explicitly commented "V11: legacy project master disabled". Its scroll listeners (`updateProjectsTarget`, 5371–5376) are still registered and still run on every scroll event, feeding a function whose body does nothing observable. Delete the function, the listeners and the `projectsTargetP`/`projectsSmoothP` state together.

**10. Dead beacon target — `9963`, `9996`, `10004`.** The beacon injector targets `#projectsShowcase`; the section id is `projects` (4675). The "03 / SELECTED MISSIONS" beacon is never created, and its CSS styles nothing. One-character fix or a deliberate removal — but it is currently a silent missing UI element.

**11. Mobile: 65 `@media` blocks, no consolidated strategy.** Breakpoints are scattered per-generation across the stylesheet. `docs/KNOWN_ISSUES.md` flags that long sticky scenes must fall back to a linear layout on mobile — the experience section (4621–4674) and each project chapter are the exposures. The Universe DPR is clamped to 1.75 (9597) but nothing reduces star counts, sphere segments (`SphereGeometry(size,80,80)`, 9822) or the 1024×512 procedural textures on low-end devices.

**12. Nine `<img>`, none lazy — `4702–4705`, `4749`.** No `loading="lazy"` or `decoding="async"`, all far below the fold, all competing with first paint alongside a WebGL context and two canvases. `alt` text is present on all nine (good).

**13. Accessibility gaps beyond motion — `4469–4481`, `4596–4617`.** 10 inline `onclick` handlers including nav scroll actions; the Universe is pointer-only (drag + click raycast at 9840–9842) with **no keyboard path to select a planet** and no focus management when the stack panel opens; only 13 `aria-*` attributes in the entire document; no skip link; no `<h1>` outside the shadow-DOM dead block.

**14. WebGL has no failure path — `9587`, `9596`.** The whole module is guarded on `mount` existing, but nothing handles a `WebGLRenderer` constructor throw, a missing WebGL context, or `webglcontextlost`. On an unsupported device the user gets a blank region where the site's centrepiece should be, and (per #6) no visible error.

**15. Three sub-ranges to freeze before touching anything — `9584–9887`.** The 3D Universe is approved baseline and must be preserved exactly unless a task explicitly targets it. The fragile parts are the GLSL strings (`9667–9728`), the corona sprite pulse constants (9786–9792, 9859–9869) and the camera focus/idle branch (9871–9880) — all tuned by eye with magic numbers and no comments explaining the values. Extract this file **verbatim, byte for byte**, as its own step with no cleanup, and verify all 9 planet clicks plus scroll rotation before any other change lands on it.
