# ARCHITECTURE

Everything lives in `D:\portfolio\index.html` (10,266 lines). There are no modules, no imports between parts, no build-time composition. Coupling happens through three channels only: **the DOM (ids)**, **CSS custom properties written from JS**, and **two globals** (`window.__portfolioUniverseScroll`, a `stack-project-focus` CustomEvent).

## Runtime layers (bottom to top)

1. **Global atmosphere** — fixed, full-viewport, `aria-hidden`, painted behind everything: `.noise`, `.progress`, `.universe-nebula`, `.universe-tech`, and a Canvas-2D starfield (`#universeStars`). Markup 4465–4468; starfield loop at 9888–9958.
2. **Chrome** — `<nav>` with theme switcher and two `onclick="…scrollIntoView()"` pills (4469–4481).
3. **IntroExperience** — one sticky section holding hero → fluid/goo transition → orbit handoff, all in the same viewport so the Universe is already alive before the hero leaves (4482–4620).
4. **Stack Universe (Three.js)** — the approved baseline. Mounts into `#threeUniverse` / `#threeCanvas` inside the intro's orbit layer. Sole module script, 9584–9887.
5. **Experience** — long sticky scene, scroll-scrubbed axis + stops + "current core" (markup 4621–4674, driver 10178–10265).
6. **Projects** — three independent `.project-chapter` articles, each its own sticky scrubbed chapter: GateCheck, WSL, Rare7 (markup 4675–4752, driver 10054–10177).
7. **Stack archive + AI workflow** and **Contact** — closing sections, mostly static markup with a small JS-rendered tech grid (4753–4785; renderer at 5164–5195).

## Data / scroll flow

```
window scroll (passive)
  ├─ handleScroll()  index.html:4891–4991   ← the orchestrator
  │     ├─ sectionProgress(el)  :4853       ← clamp(-rect.top / (offsetHeight - innerHeight), 0, 1)
  │     ├─ writes CSS vars on section elements (--universe-s, stage/reveal vars)
  │     └─ window.__portfolioUniverseScroll = clamp((introProgress - .30) / .70, 0, 1)   :4988
  │              │
  │              └──> Three RAF reads it each frame  :9846
  │                      universeScrollSmooth += (target - smooth) * .07   :9847
  │                      scrollRotation = smooth * .58 rad (~33°)          :9852
  ├─ updateIntroTarget()  :4859   → introTargetP, smoothed by its own RAF :5328
  ├─ updateProjectsTarget() :5371 → projectsTargetP (feeds the *disabled* legacy master)
  ├─ project chapters tick  :10171 → per-chapter progress → screenshot crossfade + fake route text
  └─ experience frame       :10203 → axis fill, stop activation, bridge core
```

Nothing pushes state *into* the Three scene; the scene **pulls** one scalar global per frame. That is the entire coupling surface between DOM scroll and WebGL — the cleanest seam in the file, and the one to preserve during modularization.

Planet click flows the other way: raycaster → `selectPlanet()` → DOM panel writes → a `stack-project-focus` CustomEvent dispatched on `window` (9835) for "related project" chips. **No listener for that event exists anywhere in the file** — the chips are inert.

## Script blocks (execution order)

| Lines | Kind | Role |
|---|---|---|
| 4786–5743 | classic | Orchestrator: `safeStorage`, theme, `handleScroll`, stack/orbit panels, intro RAF, legacy project master (disabled) |
| 5744–9573 | classic | **DEAD.** Shadow-DOM Canvas-2D universe; guarded on `#stackUniverseInline`, which does not exist in markup. 3,830 lines never run. |
| 9574–9583 | classic | Forces `editorial`+`dark` into localStorage and body classes, overriding the theme system above |
| 9584–9887 | **module** | Three.js Stack Universe — the do-not-touch baseline |
| 9888–9958 | classic | Canvas-2D starfield + link web |
| 9959–9976 | classic | Injects `.scene-beacon` labels into sections |
| 9977–10053 | `<style>` | Beacon CSS (a second stylesheet, after `</head>`) |
| 10054–10177 | classic | Project chapters scroll driver |
| 10178–10265 | classic | Experience scroll driver |

## Universe internals (baseline — record before touching)
Full sub-range table is in `STRUCTURE.md`. Shape: setup 9587–9605 → procedural textures 9607–9660 → sun shader 9664–9729 → corona sprites + lights 9731–9797 → data tables 9799–9814 → orbits/planets/labels 9816–9828 → interaction 9830–9842 → RAF 9844–9886.

## Modularization implication
The DOM-id coupling means a split must extract **markup, CSS and JS for one section together**, or ids will resolve across module boundaries by accident. The single largest safe first move is deleting the dead 5744–9573 block, which removes 37% of the file without touching a running line.
