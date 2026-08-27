# CONVENTIONS

## CSS tokens
Defined on bare `:root` (index.html:10–22) and **redefined per theme on `body`** (`.theme-editorial` 24–51, `.theme-plum` 52–79, `.theme-mono` 80–…), each with a `.dark` variant that swaps the same names.

```
--bg --paper --ink --muted --line --accent --accent2 --accent-soft --dark --panel --panel-dark
```

The Universe overlay/HUD uses a **second, unrelated palette** hard-coded as literals rather than tokens (see `docs/DESIGN_SYSTEM.md`: `#04050A`, `#8F67FF`, `#C4A8FF`, `rgba(12,14,25,.62)`). The dead shadow block (5749+) defines yet a third set (`--purple`, `--purple2`, `--panel`, `--line`) on `:host`. Three token vocabularies coexist; only the first is live and reachable.

**Runtime CSS vars** are the JS→CSS channel. JS writes them with `el.style.setProperty()`; CSS consumes them in `transform`/`opacity`/`width` — never in layout-triggering properties. Key one: `--universe-s` (index.html:4989).

## Theming
- Palette + light/dark persisted through `safeStorage` (a try/catch `localStorage` wrapper, 4787–4801) under keys `lc-palette` and `lc-mode`.
- Applied by toggling body classes in `applyTheme()` (4826).
- **Then overridden**: the script at 9574–9583 unconditionally writes `editorial`/`dark` back into localStorage and the body classes on every load, making the three `.theme-choice` buttons (4471–4475) effectively decorative.

## Naming
- CSS classes: kebab-case, heavily **version-prefixed** — `.experience-v14`, `.projects-v11`, `.stack-v10`, `.contact-v10`, `.su-shell`, `.su-orbit-host`. Version suffixes mark generations, not variants; older generations were left in place.
- CSS sections are separated by banner comments carrying the version that introduced them (`/* V13 — EXPERIENCE STABILITY + SLOW UNIVERSE ROTATION */`, index.html:3916). These banners are the only navigation aid in 4,455 lines of CSS and should be preserved as file boundaries when splitting.
- DOM ids: camelCase (`introHero`, `threeStackPanel`, `experienceAxisFill`). Hooks for JS are ids; hooks for scroll state are `data-` attributes (`data-exp-stop`, `data-project`, `data-stack`, `data-rare-shot`, `data-gate-shot`).
- JS: `const`/`let`, no `var`. Two global helpers `$` / `$$` (4813). Each script block after the first is wrapped in an IIFE; the first block is **not** — everything it declares is a global.

## Scroll progress
One canonical formula, matching `docs/MOTION_SYSTEM.md`:
```js
sectionProgress(el)  // index.html:4853
  = clamp(-rect.top / max(1, el.offsetHeight - innerHeight), 0, 1)
```
Re-implemented locally, not reused, in `chapterProgress()` (10069) and `getP()` (10197). Three copies of the same expression.

Smoothing is always the same lerp, with per-consumer factors:
```js
smooth += (target - smooth) * k
```
| Consumer | k | Line |
|---|---|---|
| intro | .09-ish family | 5328–5344 |
| projects master (disabled) | .105 | 5629 |
| universe scroll | .07 | 9847 |
| universe rotation / camera | .05 | 9853, 9878 |
| planet focus | .042 / .055 | 9872–9874 |

Scroll listeners are all registered `{passive:true}` (4992, 5375). Good.

## RAF pattern
Every loop follows the same shape: `function f(){ requestAnimationFrame(f); …work… }` — self-scheduling first, no `cancelAnimationFrame` anywhere, no visibility gating, no shared clock.

**Five loops run concurrently** (a sixth exists in dead code):
| Loop | Lines | Purpose |
|---|---|---|
| `introSmoothLoop` | 5328–5344 | intro progress smoothing |
| `animate` (Three) | 9845–9886 | WebGL universe |
| `draw` (starfield) | 9895–9956 | Canvas-2D stars |
| `tick` | 10171–10175 | project chapters |
| `frame` | 10203–10263 | experience |
| *`draw` (dead)* | *9331–9333* | *shadow-DOM universe, never started* |

Consolidating these into one loop is the single highest-value motion refactor, and `docs/ARCHITECTURE.md` already calls for it ("RAF é o único loop contínuo central").

## DPR clamping
- Three renderer: `min(devicePixelRatio, 1.75)` (9597).
- Starfield canvas: `min(devicePixelRatio, 2)` (9893, 9896).
- Dead shadow canvas: `min(devicePixelRatio, 2)` (8857).
Two different ceilings for two live canvases; not derived from a shared constant.

## prefers-reduced-motion
Handled **in CSS only**, at six blocks: 859, 1184, 1309, 1610, 2262, 3365. These disable CSS keyframe animations and transitions. **No JS path checks it** — all five RAF loops, the Three scene, the starfield and every scroll-scrub keep running at full motion for a user who asked for less. This is a correctness gap, not just a polish one.

## Motion rules from docs (binding)
`docs/MOTION_SYSTEM.md` prohibits: dead scroll, blur > ~5px on legible content, full-screen random overlays, removing `translate(-50%,-50%)` from centered elements, and autonomous CSS animations fighting scroll-scrub. Universe-specific: scroll rotates the **whole system** ~20–35° (implemented as `s*.58` rad ≈ 33°, line 9852) and must **never** speed up the orbits (orbits advance on `t` only, line 9858).
