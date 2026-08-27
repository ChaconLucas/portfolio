# KNOWN ISSUES / CHECKLIST

## Antes de alterar design
- [ ] Rodar o site pelo Vite.
- [ ] Capturar baseline desktop 1440x900.
- [ ] Verificar Hero.
- [ ] Verificar universo 3D e clique em todos os 9 domínios.
- [ ] Verificar scroll rotation do universo.
- [ ] Verificar Experience inteira.
- [ ] Verificar GateCheck 4 telas.
- [ ] Verificar WSL.
- [ ] Verificar Rare7 5 telas.
- [ ] Verificar Contact.

## Pontos sensíveis
- Existe CSS legado acumulado no `index.html`; modularização deve remover overrides gradualmente.
- Há vários RAFs no protótipo; consolidar onde possível.
- Não mudar simultaneamente estrutura + motion + estética de uma seção. Fazer uma dimensão por vez.
- Screenshots precisam usar `object-fit` conscientemente; não cortar conteúdo importante.
- Em mobile, sticky longo deve cair para layout linear quando necessário.

## Critério de pronto
Nenhuma exceção JS, nenhuma tela vazia, todos projetos acessíveis, nenhuma seção com scroll sem reação visual e `npm run build` passando.

## Correções aplicadas (26/08/2026)
- Labels dos planetas agora são ancoradas em espaço de câmera (offset = raio aparente em px + meia altura da label + 10px), não mais com offset em world +Y. Antes afundavam dentro do planeta em planetas grandes/próximos e ao dar zoom no foco.
- `CAM_FIT=1.12` afasta a câmera 12% mantendo a mesma direção 3/4, para o sistema inteiro caber no stage sem cortar as órbitas externas.
- Transição das labels era `transition:.22s ease` (todas as propriedades), incluindo `left`/`top`/`transform`, que são reescritas todo frame. As labels ficavam interpolando com 220ms de atraso e "flutuavam" atrás do planeta, principalmente ao clicar (lerp grande de câmera). Agora a transição cobre só cor/borda/fundo/sombra/opacidade.

## Estabilização (26/08/2026)
- Removido o bloco `<script>` do universo em Canvas 2D + shadow DOM (3.830 linhas). O host `#stackUniverseInline` nunca existiu no HTML, então o bloco saía em `if(!host) return`. `index.html` construído caiu de 393 kB para 278 kB.
- Loop RAF do Universe agora é gateado por `IntersectionObserver` (`rootMargin:240px`): nada de WebGL/shader/label enquanto o universo está fora da tela. Verificado congelando e retomando sem pop.
- Ainda dead: as regras CSS `#stackUniverseInline` (2 blocos). Deixadas para a fase de CSS.

## Painel de domínio + transição Universe → Experience (26/08/2026)
Painel (`.three-stack-panel`):
- Tipografia estava abaixo do limiar de legibilidade (`small` 5.6px, `em` 6.7px, detail 5.5px). Subida para 8 / 9.5 / 10.5px com contraste maior — era isso que dava a sensação de "embaçado".
- Removido `backdrop-filter:blur(9px)` dos 8 cards (leitosidade + custo de composição). Fundo agora é opaco.
- Conteúdo: `"production workflow"` repetido em todos os cards e a coluna "Experiência" eram filler. Trocados pelos projetos reais de `projectsByTech`; quando não há projeto mapeado a linha some em vez de inventar texto.
- PENDENTE: o rótulo `Primary`/`Working` ainda é derivado de `i<3`, não de dado real. Confirmar o agrupamento correto com o Lucas.

Transição Universe → Experience:
- O universo era fatiado por uma borda reta (bottom do sticky) com a barra `.intro-progress` de 1px bem no encontro, e só depois o Experience entrava — sem overlap.
- `orbitExit = ease(ip,.82,1)` dissolve e afasta o universo em profundidade no fim do intro; HUD (`.intro-progress` + `#introPhase`) sai junto.
- `#experience{margin-top:-62vh}` (só ≥901px) faz o Experience nascer enquanto o universo ainda dissolve. O `experience-bridge` (núcleo luminoso → eixo da timeline) passa a ler como continuação do universo.
- PENDENTE: a emenda Experience → Projects tem o mesmo problema, em grau menor.

## Seção Experience (26/08/2026)
- 340vh → 280vh: era scroll demais para 3 cargos (dead scroll).
- Piso de visibilidade subido: head .35→.58, map .18→.46, stops .15→.32. Antes o primeiro terço da seção era um quadro praticamente vazio com só o núcleo luminoso.
- Janelas dos stops antecipadas ([.28,.48],[.45,.66],[.62,.82] → [.18,.40],[.34,.56],[.50,.72]) e eixo `ease(.16,.74)`, para a timeline terminar antes da saída.
- Saída dissolvida (`exit=ease(.90,1,p)` no sticky). Antes a headline era cortada no meio da letra pela borda do sticky ao emendar com Projects.
- ATENÇÃO: `getP()` retorna 1 fixo em ≤900px, então o ramp de saída precisa do guard `innerWidth<=900?0:...` — sem ele a seção inteira some no mobile.

## Observado no mobile, não corrigido
- A headline `EXPERIENCE` estoura a borda direita em 375px.
- O bloco `02 / EXPERIENCE` aparece duplicado no topo da seção.

## Experience — composição vertical (26/08/2026)
Medido em 1440x900 antes: head 94–262, **vazio 262–568 (306px)**, timeline 568–760, footer 846.
A timeline estava jogada no terço inferior e o buraco caía no centro óptico.
- `.experience-axis`, `.experience-stop` e `.experience-current-core`: `top:53%` → `top:30%`.
- Cargos com mais massa: largura `min(260px,20vw)` → `min(310px,22vw)`, h3 34→38px, texto 11→12px.
- Tags a 6px e meta a 7px (mesmo patamar ilegível do painel de domínio) → 8.5px com mais contraste.
Depois: head 94–262, timeline 463–682, footer 846. Vazios de 201px acima e 164px abaixo, timeline no centro.
- CUIDADO: `.experience-current-core` também usa `top:53%`; mover só eixo/stops desalinha o badge FULL STACK.
- PENDENTE: ainda sobra ar. Encher de verdade depende de conteúdo que não existe (são 3 cargos). Opções discutidas com o Lucas antes de mexer.

## Orbe persistente na Experience (26/08/2026)
O núcleo da ponte morria em `p=.31` (`handOut`) e deixava a faixa acima do eixo vazia pelo resto da seção.
Agora ele nasce igual, mas em `settle=ease(.16,.34)` encolhe (86px → 19px) e assume a posição de marcador da trajetória,
viajando em `travel=ease(.16,.74)` de 6% a 72% do eixo, sempre 62px acima dele. Os anéis viram halo (scale ×.38, opacidade ×.34).
Posição derivada do rect de `.experience-axis`, não de % do sticky, para acompanhar qualquer viewport.
Medido em 1440x900: p.10 orbe (713,450) d=86 · p.45 (594,402) d=19 · p.78 (949,402) d=19, livre do badge FULL STACK (1121–1256).
Mobile não é afetado: `.experience-bridge{display:none}` abaixo de 900px.

## Orbe da Experience — versão final (26/08/2026)
Pedido: círculo grande, centralizado, girando como se flutuasse (não um ponto que persegue a linha).
- Fica no eixo central (`dx` removido), sobe para a faixa livre e cresce: birth 86px → 160px.
- `.experience-bridge-core` virou esfera: `radial-gradient(circle at 38% 33%,...)` + `::before` com conic-gradient
  girando via `--spin` + `::after` com rim light. Ambos com `--spin-op` para não aparecerem durante o nascimento.
- Giro e flutuação são por `performance.now()`, não por scroll: continua vivo com a página parada.
- Anéis com alvo explícito (1.36 / 1.27). A fórmula multiplicativa anterior fazia os dois terminarem
  do mesmo tamanho e virarem um anel só.

## Header (26/08/2026)
- O wordmark era `<div>`. Virou `<button id="brandHome">` com `scrollTo({top:0,behavior:'smooth'})`, hover e focus-visible.
- O scrim da nav parava em `.55` com `blur(10px)`: a headline gigante passava por baixo e virava borrão atrás do logo.
  Agora vai até `.52` em 76% com `blur(7px)` e `padding-bottom:26px`.

## Screenshots dos projetos — corte (26/08/2026)
Causa medida: `object-fit:cover` com a moldura em proporção diferente da imagem.
- GateCheck: telas 1.96–2.15, moldura do shot 1.79 → ~14% da largura era cortada (sumia o "E" de EVENTOS/ESTÃO e a coluna de preços).
  Stage 1.58/1 → 1.77/1 (shot vai a 2.03) e `object-fit:contain`.
  Breakpoint 901–1200px: 1.46/1 → 1.63/1.
- Rare7: telas variam de 1.65 a 2.23 — não existe moldura única. Só `object-fit:contain` resolve.
  As barras somem no fundo (`#f8f8f8` na GateCheck, `#090a0c` na Rare7, iguais às UIs).

## Esfera de energia + seam (26/08/2026)
Esfera:
- O `box-shadow` do rim light usava porcentagem (`inset -6% -8% 22%`), que é inválido — a regra inteira era descartada
  pelo parser. Era por isso que não tinha volume nem giro visível.
- Refeita como esfera de energia: núcleo branco-quente sem limbo escuro, duas camadas de plasma (`::before`/`::after`)
  com `mix-blend-mode:screen` correndo em sentidos e velocidades diferentes (`--spin` / `--spin2`, módulo 38px = largura
  base do núcleo, fecha o loop sem emenda). Pulso de brilho e escala em `--pulse`.
- Tamanho adaptativo: mede a faixa entre `head.bottom` e `axis.top` e define o diâmetro em `clamp(96,band-46,190)`.
  Sem isso ela invadia a headline em viewport baixo (testado em 640px de altura).
- `.experience-bridge-line` (o traço saindo para a direita) removido a pedido.

Seam entre capítulos de projeto:
- Era `height:38vh` com uma linha de 1px e label de 7px a 28% de opacidade — meia tela de scroll morto.
- Agora 17vh / min 120px (13vh no mobile), label a 9px/52%, duas linhas que crescem e um ponto de energia pulsando.
- Acende via IntersectionObserver (`.lit`) ao entrar em cena; `prefers-reduced-motion` desliga a animação.

## Contato e AI workflow (26/08/2026)
Contato:
- Os canais eram pills de 7px com borda a 11% de opacidade — praticamente invisíveis no fim da página.
- Viraram três cards com peso de CTA, mostrando o destino real. E-mail é o primário (accent).
- Cada card tem ícone inline (SVG, `currentColor`) + nome da marca no cabeçalho.
- E-MAIL CORRIGIDO: era `lucaschacon.dev@gmail.com` no arquivo original; o correto é **lucaschacon79@gmail.com**.
- Links verificados: github.com/ChaconLucas resolve no perfil real (Lucas Chacon, Rio de Janeiro, 9 repos).
- O muro de login do LinkedIn NÃO vem do portfólio: o link redireciona certo, o LinkedIn é que gateia
  visitante deslogado. Quem já tem sessão cai direto no perfil. Não há como contornar pelo lado do site.
  Como consequência, a slug `lucas-chacon-129414a7` não pôde ser confirmada de fora — checar com o Lucas.
- Cards reduzidos a pedido: 101px → 79px de altura, linha de 1020px → 840px.

AI workflow:
- As linhas do terminal eram um `<code>` único separado por `<br/>`. Viraram `.tline` individuais que
  entram em cascata quando a seção aparece (`.lit` via IntersectionObserver), com cursor piscando no fim.
- Fonte do terminal 11px → 12px.
- `prefers-reduced-motion` desliga cascata e cursor.

## Stack Archive animado (26/08/2026)
A seção era 100% estática. O driver já fazia `el.style.animationDelay=(idx*.04)+'s'` nos cards,
mas **não existia nenhum `@keyframes` correspondente** — o delay não fazia nada. Código morto.
- `stackIn` / `stackNavIn`: headline, índice de domínios (cascata de 9) e cards entram ao aparecer.
- Cards e proof cards são recriados a cada troca de domínio, então a cascata roda de novo sozinha.
  Verificado: ao clicar em Backend os 8 cards voltam a `opacity:0` e sobem para 1.
- `#stackDisplay.swapping` faz o cabeçalho e a descrição reentrarem na troca.
- Órbita de fundo do painel (`.vault-orbit-art i`) gira devagar (42s/68s/95s) para a seção não parecer congelada.
- `anim-ready` é adicionada pelo JS: se o script falhar, tudo permanece visível (sem conteúdo preso invisível).
- `prefers-reduced-motion` desliga tudo.

## PT/EN e clique no hero (26/08/2026)
Idioma:
- O site agora nasce em **português**; ~50 strings que estavam em inglês foram traduzidas na marcação
  (headlines adaptadas, não literais: EXPERIENCE IN MOTION → TRAJETÓRIA EM MOVIMENTO,
  STACK ARCHIVE → ARQUIVO TÉCNICO, PROJECT MISSIONS → PROJETOS DE VERDADE,
  LET'S BUILD SOMETHING REAL → BORA CONSTRUIR ALGO DE VERDADE).
- Botão `#langToggle` no header alterna PT/EN, persiste em `localStorage` e atualiza `<html lang>`.
- Motor: percorre os nós de texto e troca pelo dicionário PT→EN, guardando o original em `node.__src`.
  Voltar para PT é restauração exata, não tradução reversa. Não exigiu tocar na marcação.
- Painéis redesenhados por JS (`threeStackPanel`, `stackDisplay`, `orbitStackPanel`, `projects`, `threeLabels`)
  são reprocessados via MutationObserver com debounce em rAF. Observo só esses containers de propósito:
  o rótulo de fase do intro muda a cada frame e um observer global entraria em loop.
- Termos técnicos, stacks e linguagens ficam fora do dicionário de propósito.
- PENDENTE: o conteúdo por domínio do Stack Archive vive em objetos JS (`stackData`/`orbitStackData`)
  e ainda não está no dicionário — em EN essas descrições continuam em português.

Botões do hero não clicavam:
- `#introOrbit` recebe `pointer-events:none` enquanto o universo não é interativo, mas `#orbitSystem`
  dentro dele tem `auto`. Em CSS um descendente com `auto` volta a ser alvo de clique mesmo com o
  ancestral em `none` — então `#threeCanvas` (z-index 1) cobria os botões e comia todos os cliques.
- Corrigido seguindo a classe `.is-interactive` que o driver já alternava.
  Verificado com `elementFromPoint`: antes retornava `#threeCanvas`, agora retorna o próprio `<a class="btn">`.

## Ticker do hero e nome (26/08/2026)
Ticker (`01 GATECHECK / 02 WSL GAMES / ...`):
- Cada `<span>` recebia a MESMA animação `translateX(0 → -42px)` e voltava ao início.
  Não era marquee, era um tranco — e o `overflow:hidden` cortava o "01" a cada ciclo.
- São 4 itens curtos que cabem folgados (380px numa faixa de 522px): fazer eles saírem da tela
  é justamente o que fazia parecer desalinhado. Agora ficam fixos e alinhados (primeiro item em x=1)
  e o que se move é o destaque circulando entre eles a cada 2,2s.

Nome grande:
- Entrada por `nameRise` (sobe com blur saindo) e um brilho `nameSheen` que atravessa as letras
  a cada 7,5s via `background-clip:text`.
- `prefers-reduced-motion` volta o texto para preenchimento sólido e desliga as duas animações.

## Pendências abertas
- Data de saída da D&Z: confirmado com o Lucas que já terminou, falta o mês/ano para fechar o período
  e tirar o segundo badge ATUAL da timeline.
- Arquivo Técnico: trocar domínio por scroll e melhorar o motion.
- Dicionário EN não cobre o conteúdo por domínio do Arquivo Técnico (`stackData`/`orbitStackData`).

## Nome do hero — revertido (26/08/2026)
Tentei extrusão 3D em camadas de `text-shadow` + inclinação seguindo o ponteiro. Ficou ruim e o Lucas vetou.
Causa técnica do resultado feio: o brilho usava `background-clip:text` com `-webkit-text-fill-color:transparent`,
então o glifo ficava vazado e as camadas de sombra roxa apareciam POR DENTRO da letra, com um fantasma branco atrás.
Somado a isso, `display:inline-block` + deriva vertical fazia as duas linhas colidirem.
Revertido para tipografia sólida (branco / roxo) com apenas a entrada `nameRise`. Sem sheen, sem extrusão, sem deriva.

## Arquivo Técnico — sticky com container próprio (26/08/2026)
O bloco `.ai-terminal` é irmão seguinte do vault DENTRO da mesma `<section id="stack">`.
Com o sticky preso à seção inteira, o vault continuava pinado enquanto a seção de IA subia por baixo — daí a sobreposição.
Corrigido com um `.stack-pin` envolvendo só o vault: é ele que define até onde o sticky vale.
Verificado em 1800x950: nenhum ponto com sobreposição, e o vault solta em t=1.12.

## Screenshots da WSL (26/08/2026)
Recebidas e convertidas para webp em `public/assets/projects/`:
- `wsl-1` 535x780 — escolha de desafio (sportv | ge tv)
- `wsl-2` 537x891 — jurado: replay + slider + CRAVAR NOTA
- `wsl-3` 535x942 — "Chegou perto!" 8.93 vs 8.98
- `wsl-4` 531x937 — match com Filipe Toledo
- `wsl-5` 442x581 — QR code / resultado
ATENÇÃO: são todas RETRATO (~0.57-0.68), ao contrário de GateCheck (2.09) e Rare7 (1.95).
O capítulo precisa de moldura em retrato, não do browser desktop usado nos outros dois.
`wsl-5` é um recorte de card, não uma tela cheia: proporção 0.76 e resolução menor que as outras,
além de expor a URL do deploy.

## Nome do hero — revelação pelo cursor (26/08/2026)
Substitui a tentativa de 3D falso. Duas camadas com o mesmo texto:
- `.rname-base` — branco / roxo sólido, é o que se vê parado.
- `.rname-glow` — mesmo texto pintado com gradiente + `drop-shadow`, recortado por uma
  `mask-image` radial cuja posição e raio vêm de `--mx/--my/--r`.
O JS interpola essas variáveis por frame (lerp 0.14 na posição, 0.10 no raio), o que dá o
atraso fluido. O raio abre ao entrar no hero e fecha ao sair; o rAF só roda enquanto há
movimento residual, então não fica um loop ligado à toa.
`prefers-reduced-motion` remove a camada inteira.
Verificado: `--r` vai de 0 a 190px ao entrar e a posição acompanha o ponteiro.
- CORREÇÃO: o `drop-shadow` da camada de brilho desenhava um retângulo visível atrás do nome.
  Combinado com `background-clip:text`, o filtro é calculado sobre a caixa do elemento e não
  sobre os glifos. Removido. Raio da revelação também reduzido (0.26 → 0.17 da largura, 130–240px).

## Deploy (26/08/2026)
O projeto é 100% estático: dependências são só `three` (runtime) e `vite` (build), `.env.example`
declara que nenhuma variável de ambiente é necessária, e não há chamada de rede nenhuma
(as ocorrências de "axios" numa busca são texto dentro do SVG de código do hero, não código executado).
`npm run build` gera `dist/` com ~1,9 MB.
- Repositório: https://github.com/ChaconLucas/portfolio (público, branch main)
- `.claude/` (400 arquivos, 4,5 MB do ferramental GSD) fica fora do repo via .gitignore.
- Vercel detecta Vite sozinho: build `npm run build`, saída `dist`. Sem vercel.json —
  é página única sem router, então não precisa de rewrites.

## Abertura — três bugs com a mesma raiz: tempo chumbado em dois lugares (26/08/2026)
Detalhes da abertura em `INTRO_ANIMATION.md`. Aqui só as causas técnicas.

### 1. `both` preenche PARA TRÁS e mata a animação anterior da lista
A linha do contador tinha duas animações:
```css
.ai4b{animation:twShow .16s ease 2.62s both, twHide .2s ease 3.40s both}
```
O `both` da segunda aplica o `from{opacity:1}` desde o tempo 0 (fill backwards), então a
linha **nascia visível com o contador zerado**, em vez de aparecer aos 2,62 s.
Corrigido com `forwards` na segunda: segura só o estado final, não invade o início.
Regra geral: numa lista de animações, a última vence — e `both` faz ela vencer desde t=0.

### 2. `.skip` e `[data-intro]` têm a MESMA especificidade
```css
#energyBurst.skip{animation:ebOut .22s ease both}          /* 1 id + 1 classe */
#energyBurst[data-intro="ai"]{animation-delay:4.86s}       /* 1 id + 1 atributo */
```
Empate de especificidade → vence quem vem depois. Como a regra da variante estava depois,
ela reimpunha o atraso de 4,86 s no `ebOut` do skip: a cortina nunca rodava e o JS removia o
overlay em 240 ms. Resultado: **corte seco em vez de pular**.
Corrigido invertendo a ordem e travando com `animation-delay:0s!important` no `.skip`.

### 3. Atraso do nome do hero casado na mão com o fim da abertura
```css
.hero-name-block h1{animation:nameRise .95s … 4.75s both}   /* número chumbado */
```
Dois efeitos, os dois já estavam no ar:
- ao **pular**, ninguém mexia nesse 4,75 s — o overlay sumia e o nome ainda demorava ~3,5 s.
- ao acelerar a abertura com `VEL=1.14`, a cortina passou a abrir em 3,88 s e o nome
  continuou em 4,75 s: ~0,9 s de tela sem o nome. Esse é o sintoma que chegou como
  "o site parece que ainda está carregando".

Corrigido: o atraso virou `var(--nome-atraso)`; o driver da abertura escreve o valor real
(`FIM/VEL + .10`), o skip zera para `.06s` e `prefers-reduced-motion` zera para `0s`.
**Nenhum tempo do hero deve voltar a ser um número fixo no CSS** — ele tem que derivar do
fim real da abertura, senão qualquer mudança de ritmo abre a brecha de novo.

### Lição
Os três são a mesma falha: um tempo escrito em dois lugares que precisam concordar.
Uma fonte só (variável CSS ou constante JS), e os outros derivam dela.
