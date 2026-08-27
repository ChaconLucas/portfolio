# HANDOFF — Estado atual do portfólio

## Objetivo
Portfólio pessoal cinematográfico para recrutadores e clientes, com identidade espacial/tecnológica premium. A experiência deve parecer um produto digital autoral, não um template de portfólio.

## Baseline aprovado
- Fundo near-black espacial, lavanda/roxo como acento.
- Hero editorial grande.
- Stack Universe em Three.js como principal assinatura visual.
- Universo em câmera 3/4, levemente visto de cima e voltado para a esquerda.
- Sol procedural com shader/plasma e emissão; não usar uma esfera transparente como halo.
- Planetas texturizados, iluminados e clicáveis.
- Scroll deve ter resposta visual contínua; evitar trechos em que o usuário rola e nada acontece.
- Experience deve ser uma trajetória visual alinhada, reagindo ao scroll.
- Projetos são capítulos sticky com screenshots reais.
- GateCheck usa 4 screenshots reais. Rare7 usa 5 screenshots reais.

## Não fazer
- Não usar iframe.
- Não trocar o universo 3D por Canvas 2D.
- Não reconstruir tudo do zero sem necessidade.
- Não voltar para estética neon hacker/Matrix.
- Não criar parede de cards genéricos.
- Não adicionar blur forte, transições que escondam conteúdo ou scroll morto.
- Não inventar dados profissionais/projetos.

## Estado em 26/08/2026
- No ar: https://portfolio-delta-five-78.vercel.app (Vercel, todo push na `main` republica).
- Site nasce em **português**; botão EN no header troca por dicionário PT→EN.
- Abertura em terminal, duas variantes (`hack` padrão e `ai`) — ver `INTRO_ANIMATION.md`.
- Screenshots reais nos três capítulos: GateCheck (4), Rare7 (5), WSL (7, em totem retrato).
- Favicon, título e imagem de compartilhamento (`og.png`) prontos.

## Em aberto (próxima sessão)
1. **Mobile** — três partes apontadas e ainda não resolvidas: a Trajetória (Experience),
   os capítulos de Projetos, e o fim do Arquivo Técnico. Lembrar que a Experience voltou a
   ser linear no mobile por limite físico de largura, não por escolha estética.
2. Coluna de texto dos capítulos de projeto com ~55% de vazio — falta **conteúdo**
   (o que foi construído, números, links), não layout. Só o Lucas pode fornecer.
3. Link da demo da WSL (`https://wsl-sportv-games.vercel.app`) ainda não está no site.
4. Modularizar `index.html` (~6.500 linhas, 1.439 `!important`). O acúmulo de `!important`
   já causou bug de especificidade no grid do mobile e no skip da abertura.

## Prioridade de evolução
1. Estabilizar e modularizar sem alterar aparência.
2. Testar desktop 1440x900, 1920x1080 e mobile.
3. Melhorar transições Hero → Universe → Experience → Projects.
4. Tornar todos os capítulos de projetos tão refinados quanto o Universe.
5. Performance e acessibilidade.

## Fonte de verdade
`index.html` é a baseline visual atual. Antes de refatorar, capture screenshots e verifique regressão visual.
