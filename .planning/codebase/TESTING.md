# TESTING

## Current state: no automated tests of any kind
- No test runner, no test files, no `__tests__`/`spec`/`e2e` directory.
- No lint, no formatter config, no typecheck, no CI workflow (`.github/` does not exist).
- `npm run check` is an alias for `npm run build`. **`vite build` succeeding is the entire automated gate** — it proves the module graph resolves and esbuild can parse the JS. It proves nothing about rendering, scroll behaviour, WebGL, or layout.
- That one gate is mandatory: run `npm run build` before declaring any implementation complete.

Note what the build gate cannot catch here: the DOM is coupled by string ids, so a missing element, a renamed id, or a dead script block (index.html:5744–9573) all build cleanly and fail only at runtime — silently, because most lookups are guarded with `if(!el) return`.

## Manual verification — the real test suite
`docs/KNOWN_ISSUES.md` defines the checklist that stands in for tests. Run it before and after any design-affecting change:

**Setup**
1. Serve through Vite (`npm run dev`) — never `file://`, ES modules will not resolve.
2. Capture a baseline screenshot at **desktop 1440×900** before touching anything.

**Checklist**
- [ ] Hero renders and animates.
- [ ] 3D universe renders; **click all 9 domains** (frontend, backend, mobile, data, security, infra, tooling, analytics, ai) — each opens its stack panel.
- [ ] Universe scroll rotation responds (whole system rotates slowly; orbits do **not** accelerate).
- [ ] Experience section traverses end to end.
- [ ] GateCheck — all 4 screens cycle.
- [ ] WSL — chapter plays.
- [ ] Rare7 — all 5 screens cycle.
- [ ] Contact renders and links are clickable.

**Definition of done** (from the same doc)
- Zero JS exceptions.
- Zero empty screens.
- Every project reachable.
- No section that scrolls without visual reaction ("dead scroll").
- `npm run build` passes.

## Built-in runtime signal
There is a global `window.onerror` handler (index.html:4805–4811) that writes the message into `#previewError`. **The `#previewError` element does not exist in the markup** (only CSS at line 603), so the handler always finds `null` and shows nothing. Uncaught errors are therefore invisible unless DevTools is open — treat "no visible error" as no evidence. Restoring that element is a cheap win for the stabilization pass.

## Verification discipline for the modularization
Because there are no tests, each extraction step must be visually diffed:
1. Screenshot baseline (1440×900 plus one mobile width) **before** the step.
2. Extract exactly one module (markup + its CSS + its JS together — ids couple them).
3. `npm run build`.
4. Re-run the checklist section that owns the extracted code, and diff screenshots.
5. Check the console is clean.

`docs/KNOWN_ISSUES.md` explicitly forbids changing structure + motion + aesthetics of a section in the same step — one dimension at a time. Applied to modularization: **move code without editing it**, verify, then clean up in a separate step.

## Suggested first automation (none exists today)
The highest-leverage additions, in order: a console-error assertion on load, a Playwright script that clicks all 9 planets and asserts the panel title changes, and screenshot diffs at 1440×900 / 390×844 for the eight checklist stops. None of these are present or scaffolded.
