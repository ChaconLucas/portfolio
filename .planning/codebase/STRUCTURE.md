# STRUCTURE

## File tree
```
D:\portfolio\
├── index.html            10,266 lines / 415 KB — the entire application
├── package.json          v0.17.0, deps: three 0.180.0 / vite 7.1.3
├── package-lock.json
├── .env.example          states that NO env vars are required
├── .gitignore            node_modules, dist, .vite, .env*
├── README.md             run/build + AI reading order
├── docs/
│   ├── HANDOFF.md            declared source of truth
│   ├── ARCHITECTURE.md       intended layering + proposed src/ split
│   ├── DESIGN_SYSTEM.md      palette + universe/visual rules
│   ├── MOTION_SYSTEM.md      scroll-scrub formula, transition rules, prohibitions
│   ├── KNOWN_ISSUES.md       manual verification checklist
│   ├── PROJECT_SCREENSHOTS.md
│   └── ROADMAP_SUGGESTED.md
├── public/assets/projects/
│   ├── gatecheck-1..4.webp   (4)
│   └── rare7-1..5.webp       (5)
└── node_modules/
```
No `src/`, no `vite.config.js`, no test dir, no CI workflow, no `.git` (not a repo).

## index.html — top-level index

| Lines | Content |
|---|---|
| 1–7 | doctype, `<html lang="pt-BR">`, meta, `<title>Lucas Chacon — Portfolio V4</title>` |
| **8–4462** | **`<style>` — the entire stylesheet (4,455 lines)** |
| 4463–4468 | `</head>`, `<body class="theme-editorial dark universe-theme">`, atmosphere layers + `#universeStars` |
| 4469–4481 | `<nav>` — brand, theme-choice buttons, `#themeToggle`, two inline-`onclick` pills |
| **4482–4620** | **`#introExperience`** — sticky hero → fluid → orbit |
| 4485–4529 | `#introHero` + `#introBigWord` |
| 4530–4556 | `#introFluid` (SVG `#fluidGoo` filter) |
| 4557–4567 | `#introTransitionField` |
| 4568–4620 | `#introOrbit` |
| 4573–4595 | `#storyDesc` detail panel (`#detail*` ids, `#storyProgress`) |
| **4596–4617** | **`#orbitSystem` → `#threeUniverse` / `#threeCanvas` / `#threeLabels` / `#threeStackPanel`** |
| 4618–4619 | `#introProgress`, `#introPhase` |
| **4621–4674** | **`#experience`** — `#experienceV14Sticky`, `#experienceBridge`, `#experienceV14Map`, `#experienceAxisFill`, `[data-exp-stop]`, `#experienceCurrentCore` |
| **4675–4752** | **`#projects`** (`.projects-v11`) |
| 4681–4714 | `#project-gatecheck` — 4 webp shots, `#gateShotIndex/Label`, `#gateRoute` |
| 4715–4738 | `#project-wsl` — CSS-drawn mock (no images), `#wslShotIndex/Label` |
| 4739–4752 | `#project-rare7` — 5 webp shots on one 1,700-char line, `#rareRoute` |
| **4753–4778** | **`#stack`** — vault nav (9 `[data-stack]`), `#stackDisplay`, `.ai-terminal` (AI workflow lives inside this section, 4776) |
| 4779–4785 | `#contact` — CTA, `mailto:`, GitHub, LinkedIn |
| 4786–5743 | `<script>` orchestrator |
| 5744–9573 | `<script>` **DEAD** shadow-DOM Canvas-2D universe |
| 9574–9583 | `<script>` theme force |
| **9584–9887** | **`<script type="module">` Three.js Universe** |
| 9888–9958 | `<script>` starfield RAF |
| 9959–9976 | `<script>` scene beacons |
| 9977–10053 | `<style>` beacon CSS (second stylesheet) |
| 10054–10177 | `<script>` project chapters driver |
| 10178–10265 | `<script>` experience driver |
| 10266 | `</body>` |

## Three.js Universe sub-ranges (9584–9887) — DO NOT TOUCH baseline

| Lines | What |
|---|---|
| 9585 | `import * as THREE from 'three'` |
| 9587–9590 | mount lookup (`#threeUniverse`, `#threeCanvas`, `#threeLabels`), whole block guarded on `mount` |
| 9591–9600 | Scene, `FogExp2`, `PerspectiveCamera(34,…)` at `(-8.8,13.6,15.2)`, `WebGLRenderer`, **DPR clamp `min(dpr,1.75)`**, sRGB, ACESFilmic, exposure 1.24 |
| 9602–9605 | `universe` Group, initial rotation x -.09 / y .18 |
| 9607–9619 | `stars()` → three `Points` layers (2100 / 850 / 190) |
| 9621–9628 | constellation lines (17 polylines) |
| 9630–9658 | `planetTexture(seed,hue)` — 1024×512 procedural CanvasTexture |
| 9659 | `sunTexture()` |
| 9660 | `glowTexture()` |
| 9664–9666 | `sunGroup`, `sunUniforms {uTime, uPulse}` |
| **9667–9728** | **`ShaderMaterial` — GLSL vertex + fragment strings (the plasma sun)** |
| 9729 | sun `Mesh(SphereGeometry(1.52,96,96))` |
| 9731–9784 | `sunRayTexture(seed)` procedural corona rays |
| 9786–9792 | three additive corona `Sprite`s (inner / outer / rays) |
| 9793–9797 | lights: PointLight, HemisphereLight, DirectionalLight, rim PointLight, AmbientLight |
| 9799–9801 | `domains[]` — 9 tuples `[key,name,orbitR,angle,speed,hue,size]` |
| 9802–9812 | `stackData{}` — per-domain description + tech list |
| 9813 | `projectsByTech{}` |
| 9816 | orbit lines — `EllipseCurve(r, r*.55)` → `LineLoop` per domain |
| 9818–9828 | planet factory: mesh + atmosphere shell + shade shell + Saturn ring for `tooling`; builds `planetMeshes[]` and DOM `labels[]` |
| 9830–9831 | interaction state (`selected`, `focusTarget`, `dragging`, `targetYaw/Pitch`, `universeScroll`, `universeScrollSmooth`) |
| 9832 | `Raycaster` + `Vector2` mouse |
| 9833–9836 | panel refs, `selectPlanet()`, `renderStack()`, close handler |
| 9838 | `resize()` — `renderer.setSize(w,h,false)` from `mount.clientWidth/Height` |
| 9839–9842 | `pointerXY()`, `pointerdown` / `pointermove` (drag yaw+pitch) / `pointerup` (raycast click if movement < threshold) |
| 9844 | `THREE.Clock` |
| **9845–9886** | **`animate()` RAF**: reads scroll global (9846–9847), system rotation `s*.58` (9852–9856), planet orbits by `t` only (9858), sun spin + shader uniforms + sprite pulse (9859–9869), star drift (9870), camera focus-vs-idle branch (9871–9880), label projection (9882), `renderer.render` (9883) |
| 9886 | `animate()` kick-off |

## Dead / disabled ranges
- **5744–9573** — shadow-DOM Canvas-2D universe, 3,830 lines, `return`s immediately (host id absent from markup).
- **5628–5742** — `renderProjectsMaster()`, explicitly commented `V11: legacy project master disabled`.
- 2701 / 3909 — CSS for `#stackUniverseInline`, styling nothing.
- 9963 / 9996 / 10004 — `#projectsShowcase` beacon target; the section id is `projects`, so this beacon is never created.

## Δ desde o mapeamento (26/08/2026)
As faixas de linha acima são anteriores à remoção do bloco morto. O `<script>` do universo Canvas-2D/shadow-DOM (antigo 5744–9573) foi deletado; `index.html` passou de 10.281 para 6.452 linhas. Tudo que estava acima de 5744 mantém o número; tudo abaixo desloca −3.830.
