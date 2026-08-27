# ARCHITECTURE

## Estado atual
A baseline ainda é um `index.html` grande porque isso preservou rapidamente o protótipo visual. O primeiro trabalho técnico deve ser modularização **sem redesign**.

## Runtime
- Vite
- Three.js 0.180.0
- HTML/CSS/JavaScript sem framework obrigatório
- Assets em `public/assets/projects/`

## Camadas principais
1. **Global atmosphere** — starfield, glows, background e HUD.
2. **IntroExperience** — Hero e handoff para Universe.
3. **Stack Universe** — WebGL/Three.js, planetas, sol, raycasting, tech detail.
4. **Experience** — trajetória sticky baseada em progresso de scroll.
5. **Projects** — capítulos independentes: GateCheck, WSL, Rare7.
6. **Stack archive / AI workflow / Contact** — fechamento do portfólio.

## Refatoração recomendada
Após congelar screenshots de referência:
```text
src/
  main.js
  styles/
    tokens.css
    base.css
    hero.css
    universe.css
    experience.css
    projects.css
    contact.css
  universe/
    createUniverse.js
    sunShader.js
    planetFactory.js
    interaction.js
    universeScroll.js
  motion/
    scrollProgress.js
    lerp.js
  projects/
    gatecheck.js
    wsl.js
    rare7.js
```

Não fazer essa separação em uma única alteração gigante. Migrar módulo por módulo e validar visualmente após cada etapa.

## Estado e interação
- Scroll progress deve ser normalizado em 0..1 por seção.
- RAF é o único loop contínuo central para visual pesado.
- Three.js recebe estado suavizado por lerp.
- Click de planeta via raycaster abre domínio.
- Click de projeto relacionado navega para capítulo real do projeto.
- Respeitar `prefers-reduced-motion`.
