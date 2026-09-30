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

## Motion novo: portal, buraco negro e cursor (30/09/2026)
Inspirados em componentes do 21st.dev (Glyph Portal, Black Hole, Morphing Cursor), reescritos em JS puro —
o site não usa React. Código novo fica em `src/effects/`, fora do `index.html`.

Portal (hero → universo), em `index.html` dentro do driver `handleScroll`:
- A câmera entra pelo "O" de CHACON. O hero escala com origem no miolo da letra (escala exponencial, até
  o miolo cobrir os cantos) e o universo aparece recortado por `clip-path: ellipse` do mesmo tamanho.
- O miolo é MEDIDO: `medirPortal()` desenha a letra num canvas com a fonte computada e varre a partir do
  centro da tinta. Não depende de Arial nem do tamanho do título. Remede em `resize` e `fonts.ready`.
- O universo fica em camada ACIMA do hero (z 5 x 3), por isso é recortado nele e não furado no hero.
- `clip-path` vale antes do `transform`: o raio é dividido pela escala da própria camada.
- Desktop (>900px) e sem reduced-motion. Fora disso `portalState()` devolve null e roda o caminho antigo.
- CORRIGIDO: o recorte saia abaixo do miolo. O "O" era medido no load, com o nome ainda na animacao de
  entrada (`nameRise`, ~26px abaixo) e com a inclinacao do ponteiro. Agora so o FORMATO do miolo e
  guardado (`portalMedida`: offset dentro da letra + raios); a POSICAO da letra e lida todo quadro pelo
  Range e desfeita do zoom (`portalAplicado`). Erro medido: 0px de 1x a 18x. Durante o portal o nome
  fica reto (`.portal-ativo`).
- CUIDADO: `handleScroll` chama `portalState`. Se a função sumir, o script inteiro para ali e `stackData`
  fica em TDZ ("Cannot access 'stackData' before initialization") — o erro aparece longe da causa.

Buraco negro (`src/effects/buraco-negro.js`), no Contato:
- WebGL2 puro, quad em tela cheia, analítico (lente fina + disco inclinado + imagem dobrada + Doppler).
  ~0,7 ms de GPU por quadro em 2160x1733. Paleta do site (violeta → lavanda → branco), não laranja.
- Carregado por `import()` só quando o Contato está a 600px; RAF só com a seção na tela.
- Canvas com alfa: só sombra e luz são opacos. z-index 1 (acima das estrelas, abaixo do texto).
- Celular: resolução ×.85 (abaixo disso a borda da sombra serrilha).

Cursor (`src/effects/cursor.js`):
- Ponto + anel com mola. Sobre clicável o anel abraça o elemento e o elemento é puxado (propriedade
  `translate`, para não brigar com o `transform` do hover). Sobre h1/h2 vira lente com `mix-blend-mode:
  difference`. Sobre o universo, anel tracejado de arrasto.
- Só com `(hover:hover) and (pointer:fine)` e sem reduced-motion. O laço dorme quando assenta.
- Molas são por TEMPO (`1-(1-k)^(dt/16.7)`), não por quadro: iguais em 30, 60 ou 120 Hz.

## Motion, segunda leva (30/09/2026)
- **Fluxos + onda de choque** (Gateway Flow) dentro do shader do buraco negro: filamentos em espiral
  logaritmica caindo no disco; clique em area vazia do Contato solta uma onda que entorta lente e disco.
- **Persiana** (Shutter Text) nos 4 titulos de secao, SEM split em letras — o motor PT/EN troca nos de
  texto. Mascara `linear-gradient` animada por `@property --persiana`, removida ao fim (`.assentada`).
  O `- 1%` na parada existe porque com as duas paradas em 0% o Chrome pintava um fio por lamina.
- **Vapor** (`src/effects/vapor.js`): o PRODUCTS vira particulas que espiralam para o portal. Funcao pura
  de `window.__portal.t` (escrito pelo driver): rolar para cima remonta a palavra.
- **Roda de projetos** (`src/effects/roda-projetos.js`, Works Wheel): 8 capas (2 telas reais por projeto,
  lidas dos capitulos) num anel sob o titulo de Projetos. Scroll + deslize + arrasto com inercia; clique
  leva ao capitulo. Projecao feita no JS em 2D de proposito: com preserve-3d o anel vira um contexto de
  empilhamento so e a capa nao alterna entre tras/frente do titulo. O cabecalho passa a 100vh.
- **Trajetoria**: cada linha do cargo sobe de tras de uma mascara em cascata, lendo `--revela` que o
  driver da Experience escreve por cargo.

## Observado, nao corrigido
- Mobile 375px: o grid de `.projects-v11-header` sai com 386px e o paragrafo corta na direita (termina em
  405px). Existia antes da roda (medido com e sem ela).

## Motion, terceira leva (30/09/2026)
- **Borda que acende** (`src/effects/brilho.js`, Glowing Effect) nos cards do Arquivo Técnico e do Contato.
  O `<span class="brilho">` é injetado na primeira aproximação do ponteiro, porque `renderStack` recria os
  cards a cada troca de domínio. Anel de 1px por máscara (content-box em exclude). Só com mouse.
- **Texto em órbita** (`src/effects/orbita.js`, Marquee along SVG path) em volta do buraco negro, com o
  texto de `.contact-meta`. A metade de trás é mascarada pela sombra; acelera com o scroll e cai para 1/4
  com o ponteiro sobre o anel. O buraco negro expõe `centro()` (px CSS) para isso.
- **Nome no rodapé** (`src/effects/rodape.js`, Hover Footer): contorno + gradiente revelado no ponteiro.
  Tamanho medido para caber em 94% da largura. CUIDADO: uma regra antiga do Contato força `color` em todo
  span da seção — por isso o texto usa `-webkit-text-fill-color`, não `color`.
- O buraco negro agora remede o canvas com `ResizeObserver` na seção: o rodapé muda a altura dela depois.
- **Pilha de cargos no celular** (`src/effects/pilha.js`, Stacking Cards). Precisou de `overflow:clip` no
  `.experience-v14-sticky` (com `hidden` o sticky nunca ativa) e de um espaçador `::after` no mapa
  (`padding-bottom` não conta: sticky respeita a caixa de conteúdo do pai). Usa `scale`, não `transform`.

## Motion, ultimos componentes (30/09/2026)
- **Globo** (`src/effects/globo.js`, cobe 2.0.1 — dependência nova no package.json) no card "CARGO ATUAL",
  com o Rio pulsando. O globo tem tamanho fixo no CSS e o canvas fica preso a 100% dele: sem isso o canvas
  ditava o tamanho da caixa, o ResizeObserver recriava o globo maior e o card crescia sem parar (visto:
  566 mil px). No celular fica menor, no canto de baixo (o "Full Stack Developer" vai quase até a borda).
- **Numeros que rolam** (`src/effects/numeros.js`, Number Flow): índice "01 / 09" e número grande do
  Arquivo Técnico ao trocar de domínio; "01 / 04" dos capítulos rolam de zero ao aparecer. Só números que
  já existiam. "3 CARGOS"/"2 EMPRESAS" ficaram de fora: são chaves inteiras do dicionário PT/EN.
  `#gateShotIndex` também ficou de fora (CORREÇÃO: ele É atualizado, pelo `renderChapter`, via o seletor
  `.chapter-screen-label b` — não pelo id). O `rotulo` que o lê pelo id no bloco do GateCheck é código morto.
- **Embaralho** (`src/effects/embaralhar.js`, Text Scramble) nos micro-rótulos, ao aparecer e no hover.
  NÃO escreve no nó de texto: o tradutor observa mutação de texto em #projects e reescreveria o nó a cada
  quadro. O texto real fica transparente e o embaralhado é pintado num ::after via data-embaralho.
- **Titulo em particulas** (`src/effects/particulas-titulo.js`) nos 4 h2 de seção, só desktop com mouse:
  o ponteiro empurra, a mola traz de volta, e o texto real volta quando tudo assenta. Espera a persiana
  terminar antes de amostrar. Física por tempo com subpassos (igual em 60/120 Hz e em máquina lenta).

## Espaço no fundo do hero (30/09/2026)
- O hero parecia outra página: `.intro-sticky` pinta `#06070c !important` por cima do campo de estrelas
  global (`#universeStars`, fixo, z -4), então a primeira tela era chapada.
- `src/effects/campo-estrelas.js`: estrelas em 3D dentro do próprio sticky (canvas, z 1, abaixo do hero),
  paralaxe no ponteiro e cintilar. O ponto de fuga é o miolo do "O" (`window.__portal`) e a velocidade
  cresce com `t²`: no portal as estrelas viram riscos de dobra entrando no nome.
- Nébula: `::after` do `.intro-sticky` (z 0) com três radiais violeta respirando em 26s.

## Desempenho (30/09/2026)
Medido por quadro de rAF (CPU, 1440x900, 240 quadros). Nada de comportamento mudou: portal com 0px de erro,
rótulos dos capítulos trocando 01→04, PT/EN nos capítulos, Trajetória revelando — tudo reconferido.
- Universo 3D renderizava com opacidade 0 durante todo o hero (o IntersectionObserver o via "visível" por
  estar no mesmo sticky). Agora pula o quadro quando `#introOrbit` tem opacidade inline < .004 (só >900px).
- Capítulos: `renderChapter` reescrevia `textContent` todo quadro → o MutationObserver do PT/EN varria a
  página inteira a cada 2 quadros. Agora `escreverTexto` só escreve quando o VALOR muda (compara com o
  último valor escrito, não com o texto na tela — em EN a tela tem a tradução). Capítulo a mais de uma tela
  de distância não é recalculado.
- Trajetória (`frame`) não roda com a seção a mais de meia tela de distância.
- Estrelas globais (`draw`) não redesenham enquanto `.intro-sticky` ou `#contact` (fundos opacos) cobrem a tela.
- Driver do intro só chama `handleScroll` quando progresso, scroll ou janela mudam.
Resultado: hero ~4,7 → 0,86 ms/quadro; Contato ~2,9 → 0,55; Universo ~4,9 → 3,05 (o 3D visível é o custo real).

## Capítulos 3D: vinhetas e fundos com a marca de cada projeto (30/09/2026)
Tempo (`src/effects/transicao-capitulos.js` + `window.progressoCapitulo` no index.html):
- A vinheta só começa quando o capítulo anterior chega na ÚLTIMA tela (p=1). Ela cobre a tela inteira na
  metade; o novo já está por baixo, na 1ª tela, e a vinheta sai revelando. O anterior fica parado na última
  tela (translate segura o sticky que já soltou). Novo capítulo: +--revelacao de altura, progresso descontado
  via `__portalAtraso` (5 drivers usam `progressoCapitulo`).
- Vinhetas: WSL = transmissão SporTV (faixas diagonais verde-água/branca/verde-escura + "WSL GAMES" em
  Barlow Condensed itálico); Rare7 = portas pretas com filete dourado + "RARE7" em Cinzel dourado; FLASH =
  véu vermelho queimando em ruído (WebGL, criado na 1ª vez) com o cachorro e "FLASH" em Rubik Dirt.
- O capítulo que chega é escondido com OPACITY, não clip-path: o IntersectionObserver das cenas conta o
  clip-path dos ancestrais e marcava a cena como invisível.

Fundos (`src/projects/fundos.js`): GateCheck `gate` (tipografia gigante do produto + laser de QR); WSL
`ondas` = parede de LED passando a foto real do surf (`wsl-onda.webp`, recortada do wsl-1, ancorada à direita
da TV para o surfista não ficar escondido, exposição levantada — o original é um pôr do sol escuro) + faixa do
SporTV com o texto correndo; Rare7 `ouro` (ouro líquido + RARE7 em relevo); FLASH `flash` = parede de estúdio
forrada de cartelas de tatuagem (`src/projects/flash-sheet.js` desenha os 8 desenhos em canvas) sendo feitas pela
agulha, mais fraca atrás da coluna de texto. Numa versão anterior a cartela era um painel único e a câmera só via
um pedaço gigante dela: agora são quadros de 1,25 m repetidos.
Vinheta do WSL: a faixa principal tem borda de onda quebrando (clip-path) com espuma (SVG) na mesma curva.
- CUIDADO: CanvasTexture/TextureLoader já vêm com flipY — amostrar com `v` direto. Com `1 - v` o texto saía
  de cabeça para baixo.
- Fontes das marcas: @import do Google Fonts no topo de `src/effects/efeitos.css`.

## BUG CORRIGIDO: cenas 3D paradas depois de rolagem rápida (30/09/2026)
Os observers liam `es[0].isIntersecting`. Com rolagem rápida o navegador entrega mais de uma entrada no mesmo
aviso, e a PRIMEIRA é o estado antigo: a cena ficava presa em "invisível" e não desenhava (visto no Rare7:
laço a 60 fps, 0 quadros renderizados). Agora todos leem a última entrada — cenas GateCheck/WSL/FLASH,
universo, `aoAproximar` (monta/desmonta cenas) e os módulos de src/effects.

## Ambientes 3D inteiros por projeto (30/09/2026)
Antes só mudava o painel da parede; o feedback foi que o AMBIENTE tem que ser do projeto.
- WSL (`src/projects/wsl/praia.js`): praia de campeonato no fim de tarde — céu em shader (violeta do site →
  laranja), mar com ondas deformando a malha, espuma quebrando na beira e brilho do sol, areia com textura,
  pranchas fincadas, bandeiras-pena WSL/SPORTV/GE tremulando, palanque dos juízes, tenda, e o totem que segura a
  TV (`criarAmbiente('praia')` em room.js tira parede, sala escura, treliça e caixas de som). Névoa na cor do
  horizonte (18–58 m). Sombra atrás da coluna de texto do WSL, porque o céu claro tirava contraste do título.
  Os adereços ficam na faixa que a câmera vê: ela vem da direita olhando para a esquerda.
- FLASH (`src/projects/flash/loja.js`): loja de material de tatuagem com entrega — parede de tijolo, neon FLASH +
  cachorro (tremendo como neon de verdade), estante com 60 frascos de tinta instanciados, caixas de cartucho e
  luvas, balcão com máquina de tatuar, e a moto do motoboy com o baú vermelho FLASH. Névoa 9–22 m.
- GateCheck e Rare7 (`src/projects/gatecheck/ambientes.js`, mesma cena, `opcoes.ambiente`):
  `balada` = entrada de balada/evento com a mesa virando o caixa do check-in — porta com a pista acesa (shader) e
  feixes, neon GATE ✓ ENTRADA, catracas com leitor de QR piscando, corda de veludo com pedestais de latão, fila com
  ingresso aceso no celular, cartazes dos eventos do app. `estadio` (Rare7) = a mesa atrás do gol de um estádio à noite: gol
  com rede a 12 m na direção da câmera, gramado em shader (faixas de corte + todas as linhas do campo), bola na marca
  do pênalti, bandeirinhas, arquibancadas lotadas com flashes de câmera, 4 torres de refletor, placas de LED
  "RARE7 · CAMISAS OFICIAIS · QUALIDADE PREMIUM" rolando e o manequim com a camisa 10 do Brasil ao lado da mesa.
  O estádio vai a ~130 m: `camera.far` sobe para 260 e a névoa vai para 60–200 m, só no Rare7.
  O percurso da câmera do Rare7 (`CHAVES_ESTADIO` em gatecheck/index.js) começa mais alto e atrás, olhando o
  estádio por cima do gol; do meio em diante é o trilho do GateCheck. Sem isso só sobrava uma faixa acima do monitor.
- ENQUADRAMENTO (medido pelo ângulo da câmera, que sai de (2; 1,7; 1,7) olhando para -x -z): na parede do fundo
  (z -2,7) o centro do quadro cai em x ~ -3, a borda direita em x ~ 0, a coluna de texto cobre x < -4,3, e a faixa
  de parede visível acima do monitor é y 1,2–2,1. Tudo o que precisa ser visto fica dentro disso.
- `fundos.js`/`flash-sheet.js`/`wsl-onda.webp` (painéis de parede das versões anteriores) foram apagados: nenhum
  ambiente usa mais painel.

## Monitor do Rare7 cintilando / GateCheck sem entrada (30/09/2026)
- **Rare7:** o `camera.far = 260` usado para caber o estádio derrubou a precisão de profundidade, e as peças do monitor, a milímetros umas das outras (tela, moldura, vidro), passaram a brigar entre si. O estádio foi compactado para ~70 m (a câmera só vê até pouco depois do meio-campo), com near 0,1 e far 120 (mesma razão do padrão 0,05/60). A névoa ficou em 45–110. Regra: não aumentar o far sem subir o near na mesma proporção.
- **GateCheck:** ganhou `CHAVES_BALADA`, um começo alto e atrás mirando a porta, e depois as mesmas chaves finais do estádio. A porta ficou com 2,5 de altura e o neon "GATE ✓ ENTRADA" foi para cima dela. A fila, o cordão e os cartazes foram para a direita da porta (a esquerda fica atrás do texto).

## GateCheck: vinheta de entrada e pessoas da fila (30/09/2026)
- **Vinheta:** como o GateCheck é o primeiro capítulo, não tem capítulo anterior pra segurar. O ingresso cai enquanto o capítulo sobe a última tela (a cena fica escondida por opacity), o laser lê o QR, aparece o carimbo "ACESSO LIBERADO" e o ingresso rasga no picote com o capítulo já parado no topo. Ele tem +50vh de altura (+30vh no celular), descontados via __portalAtraso.
- **Pessoas:** a cápsula com a cabeça solta virou uma figura articulada, com tênis, pernas, tronco, braços com cotovelo, pescoço, cabeça e 3 tipos de cabelo. Tem 3 poses: celular com QR aceso, conversa e mãos no bolso. Tem balanço idle e roupas coloridas, e ganhou duas point lights na fila (sem elas a figura vira vulto contra a parede escura).

## GateCheck: ambiente mais vivo (30/09/2026)
- **Pessoas:** ganharam olhos, sobrancelhas e nariz. O celular virou um aparelho preso ao tronco, na frente do peito, com o QR aceso (antes o antebraço ficava espetado e a tela nem aparecia). A fila foi virada pra câmera.
- **Novidades:** segurança de STAFF na cabeça da fila, com leitor de QR piscando e ponto de rádio; marquise com lâmpadas correndo; silhuetas pulando no grave lá dentro da porta; fumaça subindo nos feixes; fita de LED no rodapé e no alto; brilho da porta no chão; painel "CHECK-INS AO VIVO" contando sozinho.
- **Cartazes:** viraram lightbox com moldura e espaçamento de 0,78. Antes se sobrepunham e as bordas davam z-fight.

## GateCheck: fila viva com check-in (30/09/2026)
- `src/projects/gatecheck/fila.js`: figura nova (tronco e quadril em lathe, sem a emenda serrilhada; ombro redondo; pernas com pivô e ciclo de caminhada; cabelo como calota inclinada, que deixa os olhos livres; roupa, altura e cabelo sorteados em `vestir()`).
- **Ciclo:** o primeiro da fila levanta o celular, o segurança lê (tela azul varrendo) e depois vem o resultado:
  - **verde (70%):** halo, luz e um ✓ na cabeça; a catraca abre, a pessoa entra pela porta e o painel de check-ins soma 1;
  - **vermelho:** ✕, o segurança balança a cabeça e a pessoa sai pela frente da corda, olhando pro chão.
- A fila anda a cada saída e repõe na hora pelo fim, usando um pool de bonecos (quem sai de cena fica invisível e volta com outra cara).
- A corda começou a partir de x 0,98 pra cabeça da fila ficar livre na frente do segurança. O contador aleatório antigo saiu; agora só conta check-in válido.
- **Um entrando no outro (30/09/2026):** a fila recebia o destino novo no instante do resultado, e o de trás andava por cima de quem ainda estava saindo. Agora cada pessoa da fila só dá o passo se não tem ninguém a menos de 0,46 m à frente, na direção em que vai (`livre()` em fila.js). O de trás espera o espaço abrir.

## GateCheck: personagens prontos na fila (30/09/2026)
- A figura feita no código foi trocada por personagens da Quaternius (Ultimate Modular Men/Women, CC0, poly.pizza): homem casual, mulher casual e homem de terno (o segurança), em `public/assets/projects/gatecheck-gente` (1,3 MB, ~400 KB com gzip).
- **Enxugados** (script no scratchpad, `enxuga.py`): sem UV, sem COLOR_0 e sem textura (o material é só cor); normal em int8, peso e osso em uint8 (KHR_mesh_quantization). Só 3 clips (Idle_Neutral, Walk, Interact), e só no homem-casual e na mulher-casual.
- **Não quantizar posição:** em int16, com a escala embutida na inverseBindMatrix, a roupa fica com um xadrez. Ficou em float.
- **Nome do osso:** o GLTFLoader tira o ponto dos nomes (`Wrist.R` vira `WristR`).
- **Visual:** a roupa é sorteada por material (cada peça com uma cor só). Os personagens não recebem sombra, porque dava acne. O celular segue a mão a cada quadro, sem herdar a escala 100 do esqueleto. O "não" do segurança é a cabeça balançando por código (o pack não tem esse gesto).
- Descartados: Kenney Mini Characters (cabeçudos quadrados, o Lucas não gostou).
- **Celular na mão (30/09/2026):** antes o celular só seguia a posição do pulso e flutuava acima da mão. Agora segue a orientação do osso `WristR`: o Y aponta pros dedos e o Z sai do dorso, então o aparelho vai ao longo dos dedos, encostado na palma. O clip Interact do pack sobe o braço até o rosto (o segurança parecia pôr a mão na cabeça da pessoa), então ele entra com peso 0,5 misturado ao Idle, o que deixa o braço na altura do peito. O segurança foi pra x -0,02 pra não encostar em quem está na frente.

## Site caindo pra 1-10 fps depois de rolar um tempo (30/09/2026)
- **Sintoma:** página recém-carregada a 60 fps, mas depois de algumas idas e vindas pelos capítulos tudo travava, até o rodapé (sem nenhuma cena de projeto montada). Não havia quadro longo de JS: o gargalo era a placa de vídeo.
- **Causa, contextos WebGL vazados:**
  1. `renderer.dispose()` não solta o contexto; cada desmontagem da cena (GateCheck, WSL, Rare7, FLASH) deixava um vivo;
  2. `suportaWebGL()` criava um contexto novo a cada montagem só pra testar e nunca soltava.
- **Correção:** `renderer.forceContextLoss()` no `destruir` das três cenas; o teste de suporte guarda a resposta e solta o contexto na hora (`WEBGL_lose_context`).
- **Verificação:** contando contextos com `isContextLost()` após 4 voltas pelo site, eram 12 vivos e crescendo; agora ficam só os 3 em tela.

## Marca do header: avatar em ASCII (30/09/2026)
- `src/effects/avatar-ascii.js` troca o planeta (que continua no favicon) por um avatar redondo com o rosto do Lucas em ASCII, redesenhado a ~12 fps e com alguns caracteres trocando.
- **Terminal interativo:** abre passando o mouse na marca (avatar ou nome), mas só com a página no topo (scrollY < 120). Com a página rolada o hover não faz nada, o clique na marca só volta ao topo, e rolar com o terminal aberto fecha ele. No toque, tocar na marca no topo abre. A tecla `~` abre em qualquer lugar. Fecha quando o mouse sai da marca e do terminal (450 ms de folga, ou 2,5 s se digitou há pouco). Ele digita `whoami` sozinho e o retrato decodifica de cima pra baixo, com scanner e o mouse acendendo os caracteres; clicar no rosto decodifica de novo.
- **Comandos:** `help`, `whoami`, `stack [área]` (as 9 áreas do `stackData` do site), `projetos` (clicar rola até o capítulo), `contato`, `sobre`, `cv`, `clear`/Ctrl+L e `exit`/Esc. Tem histórico nas setas e Tab completando.
- **Detalhes:** o `z-index` é 130, acima do nav (100); com 60 o topo ficava atrás do header. O retrato só anima com o terminal aberto, e só o mais recente.
- **Fonte:** `public/assets/lucas-ascii.png`, 160x192 em cinza (15 KB). A foto foi recortada, o celular apagado e o fundo tirado com vinheta; o rosto teve equalização e nitidez.
- **Rampa curta** (` .:-=+*#%@`): com a de 70 caracteres o rosto virava sopa de letras.
- Com menos movimento, o retrato é desenhado uma vez só.

## Primeira tela pesada (30/09/2026)
Medido: o JS da primeira tela gasta ~5 ms por quadro. O peso era de pintura e composição (monitor com densidade 2x):
- **`codeFlow`**, o código dentro do nome: animava o `background-position` de uma camada com `background-clip:text`, fundo SVG com centenas de linhas de texto e 16 máscaras radiais (~750 mil px repintados por quadro), e continuava rodando com a camada 100% mascarada, sem o ponteiro. Agora fica pausado e a classe `.vivo` liga só enquanto a luz do mouse está aberta.
- **`tickerFocus`**: animava `letter-spacing`, o que refazia o layout a cada quadro. Agora anima só a cor.
- **Blur de fundo** no nav, nas pills e nos cards do hero, refeito a cada quadro por cima dos canvases animados. Trocado por fundo quase opaco. A nebulosa perdeu o `filter:blur(34px)` (os gradientes já são suaves).
- **Canvases de tela cheia** limitados a 1,25x de densidade (estrelas, campo-estrelas, vapor) e o universo 3D a 1,5x. Caiu de ~11 para ~6,7 milhões de px por quadro.
- **Cursor:** a lente branca em diferença acendia na caixa inteira do h1 e em qualquer card clicável grande, e virava uma "bola clara" no vazio. Agora só acende em cima das letras (`caretRangeFromPoint` + retângulo do glifo), e card grande fica com cursor normal.
- **Stack do hero:** o rótulo passou de 78 pra 96 px porque "SEGURANÇA" colava no "JWT". O ticker passou de "04 MOBILE" pra "04 FLASH".

## Primeira tela ainda travando com o mouse / stack redesenhada (30/09/2026)
- **Travamento ao mexer o mouse**, dois repintadores de tela cheia:
  - **Relevo do nome:** 13 `text-shadow` (um com 46 px de desfoque) em letras gigantes, com a direção (`--sx/--sy`) seguindo o ponteiro e transição de 0,38 s. O nome inteiro era repintado a cada quadro enquanto o mouse se mexia. Agora a luz do relevo é fixa e a inclinação 3D (transform) continua seguindo o mouse.
  - **Foco da malha de blueprint:** a máscara radial da camada de tela cheia andava por variável de CSS. Virou `.malha-foco`, uma janela de 600 px com máscara fixa que anda por `transform`, com a malha dentro andando ao contrário (as linhas ficam paradas). Nenhum repaint.
- **Pilha de barras inclinadas → "arquitetura ao vivo" (`.arq`):** uma requisição de check-in atravessa Interface → Segurança → API → Dados e volta verde como resposta. Cada camada acende e mostra o próprio log. É só keyframes de transform/opacity, sem JS. No celular vira só as 4 pílulas com os nomes.

## Safari: nome do hero a 15-19 fps (30/09/2026)
Medido no Safari do Lucas, desligando um efeito por vez enquanto mexia o mouse. Base 19 fps; sem a inclinação 3D do nome, 31; sem a camada de código, 28; sem o relevo, 24. O resto (canvases, malha, cursor, card, animações CSS, filtros) ficou entre 15 e 21, dentro do ruído.
- **Inclinação:** `transform-style:preserve-3d` → `flat`, com `perspective()` dentro do transform. O Safari redesenhava as letras a cada quadro da inclinação; plano, ele só inclina a textura. Nenhum filho usa Z.
- **Relevo:** de 13 pra 7 sombras.
- **Camada de código:** `.rname-glow:not(.vivo){visibility:hidden}`, porque no Safari a máscara de 16 gradientes custava mesmo 100% transparente.
- **Snippet de medição** (colar no Console): mede o fps por 3 s com cada efeito desligado e mostra um `console.table`. Está no histórico da conversa de 30/09.
