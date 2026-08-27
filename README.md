# Lucas Chacon — Portfolio V17

Base de handoff para continuidade no Claude Code. Esta versão preserva o universo 3D em Three.js e as telas reais de GateCheck/Rare7.

## Rodar

```bash
npm install
npm run dev
```

Abra a URL mostrada pelo Vite. Não abra `index.html` diretamente por `file://`, porque o projeto usa ES modules.

## Build

```bash
npm run build
npm run preview
```

## Ordem de leitura para IA

2. `docs/HANDOFF.md`
3. `docs/ARCHITECTURE.md`
4. `docs/MOTION_SYSTEM.md`
5. `docs/DESIGN_SYSTEM.md`
6. `docs/KNOWN_ISSUES.md`

## Regra principal

O universo 3D atual é **baseline aprovado**. Não substituí-lo por Canvas 2D, iframe, vídeo ou imagem estática. Evoluções devem preservar interação, profundidade, shaders, iluminação, labels clicáveis e o comportamento de scroll.
