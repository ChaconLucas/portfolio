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

## Jogo da nave — etapa 1: voo, entrar no planeta, pousar e decolar (05/10/2026)
- **Onde fica:** `src/jogo/` (`index.js`, `nave.js`, `cenas.js`, `jogo.css`). Só carrega no clique do botão "🚀 PILOTAR NAVE" na seção Stack Universe (`#botaoPilotar`). O botão aparece só com o universo interativo e só com mouse; o toque é a etapa 4.
- **Nave:** "Spaceship" da Quaternius, domínio público, via poly.pizza (`public/assets/jogo/nave.glb`, 161 KB). O propulsor é feito no código: chama em dois cones, halo, luz e rastro de partículas. O turbo deixa a chama azul.
- **Espaço:** os 9 planetas das áreas da stack, cada um com uma cor de bioma, mais sol, estrelas, nebulosas, cinturão de asteroides e poeira perto da câmera (dá a sensação de velocidade). O HUD tem velocidade, alvo mais próximo, rótulos com distância e radar.
- **Estados:** espaco → entrando (piloto automático, tremor e flash) → superficie (voo baixo com gravidade leve; perto do chão e devagar, E pousa; E decola; acima de 140 m volta ao espaço) → saindo.
- **Pausa do site:** com `window.__jogoAberto`, o universo e as estrelas do site não desenham.
- **Teste sem rAF:** `?debugjogo` expõe `window.__jogo.passo(n)` pra avançar a simulação (o painel de preview roda a ~1 fps em segundo plano).
- **Mouse (05/10/2026):** o clique trava o ponteiro (Pointer Lock). Mexer pros lados vira, pra cima/baixo aponta o nariz (`s.mira`, ±1,15 rad no espaço e ±0,65 na superfície). No espaço o voo é 3D: o arrasto lateral vale nos 3 eixos e não tem freio vertical. A rodinha dá zoom na câmera (0,6–2,2×). Pousado, o mouse gira a câmera em volta da nave. Com o mouse travado, o 1º Esc só solta o mouse e o 2º sai do jogo. Mira no centro; a dica "clique na tela" aparece com o mouse solto.
- **Mouse solto (05/10/2026):** a primeira versão só pilotava com o ponteiro travado, e no navegador do Lucas "não funcionou". Agora, com o mouse solto, a nave segue o cursor: a distância do centro vira taxa de giro, com zona morta de 12% (anel tracejado no centro). A trava fica como extra, e se o navegador recusar (`pointerlockerror`) aparece um aviso. O site esconde o cursor do sistema (`.cursor-proprio`); dentro do jogo volta `crosshair` e o cursor do site some.
- **Mouse e teclado juntos (05/10/2026):** o mouse solto só vira a nave enquanto alguma tecla de movimento está apertada (W/S/A/D/Espaço/Ctrl/setas); parada, o mouse fica livre. A/D viraram deslize lateral (34 m/s²) e as setas ←/→ continuam virando, pra quem joga só no teclado. Com o mouse travado, ele mira sempre.
- **Controle "de jogo" (05/10/2026):** o modelo virou mira em terceira pessoa. O MOVIMENTO do mouse (`movementX/Y`, que existe sem trava; fallback pela diferença de `clientX`) gira a mira (`alvoRumo/alvoMira`) na hora, e a câmera fica atrás da mira. A nave persegue a mira com inércia: mola de giro com taxa máxima de 2,6 rad/s, leve passada e inclinação proporcional à velocidade de giro. Mouse parado, nada gira; não depende de tecla. Pousado, a mira só orbita a câmera. As setas também mexem na mira.
- **Flutuar parada (05/10/2026):** a "gravidade leve" da superfície (6 m/s²) fazia a nave descer sozinha. Saiu. Com os controles soltos, o arrasto sobe (1,8 no geral e 3 no vertical) e a nave freia até pairar na altura em que está. Pra descer: Ctrl ou nariz pra baixo + W.

## Jogo da nave — etapa 2: entrada cinematográfica, a pé e prédios da stack (05/10/2026)
- **Entrada sem flash:** `entrando` (2,25 s) faz o mergulho acelerando até a superfície, com a câmera abrindo de lado, o plasma no nariz (`nave.reentrada(k)`: concha e brilho de laranja a branco, faíscas laranja no rastro), a borda da tela em brasa (`.jogo-calor`) e tremor. As nuvens (`.jogo-nuvens`) cobrem a tela e a cena troca. Em `descendo`, a nave sai das nuvens a 255 m e o piloto automático desce até ~70 m perto da praça. A saída (`subindo`) é o caminho inverso; no espaço o plasma e as nuvens se dissipam.
- **A pé:** astronauta da Quaternius (`public/assets/jogo/astronauta.glb`, 774 KB, ~234 KB gzip; clips Idle_Neutral, Walk, Run, Wave e Interact). Pousado, E sai da nave (acenando) e Espaço decola; a pé, W/A/S/D andam relativos à câmera, Shift corre, Espaço pula, E entra no prédio ou embarca. Colide com os prédios e a nave. Na superfície a nave tem escala 2,6 (pessoa ao lado).
- **Prédios da stack:** um por tecnologia da área (`STACK` em `src/jogo/dados.js`, gerado da `stackData` do index.html), em anel com raio 46 numa praça plana de raio 70, com porta virada pro centro, letreiro em neon com nome e nível, e caminho de luz. E na porta abre o painel: nível, descrição, a área e "usado em" (`PROJETOS_POR_TECH`, ou o `usado` da área), com links "ver no site", que fecham o jogo e rolam até o capítulo. Visitado, o letreiro fica verde; todos vistos dá a conquista "planeta completo ✓". O progresso fica no HUD e no radar (que mostra a praça).
- **Sem setas (05/10/2026):** a pedido do Lucas, as setas saíram. Só o mouse vira (a visão), e W/A/S/D movem relativos a ela; o deslize A/D da nave usa `alvoRumo` (a visão), não o nariz.
- **Escala e velocidade da luz (05/10/2026):** o sistema cresceu (`ESC_ORBITA` 26→92, `ESC_TAM` 7→24; sol de raio 52; cinturão em 880; limite 1050; céu a 3000 m; far da câmera 7000), e a câmera fica 35% mais longe da nave no espaço. Velocidade normal até ~430 km/h. Shift+W entra em **dobra** (`s.dobra`): aceleração de até 490, teto de ~2600–3000 km/h, FOV +34°, tremor leve, túnel de linhas (`.jogo-dobra`, conic-gradient girando) e a poeira virando riscos esticados na direção do voo (LineSegments em `criarEspaco`). Bater num planeta ou no sol corta a dobra.
- **Cursor:** dentro do jogo o cursor some (`cursor:none`; o mouse pilota pelo movimento) e só volta em cima do botão de sair e dos links do painel. O anel tracejado do centro saiu. A dica do mouse foi pra baixo, no centro.
- **Mouse sempre preso (05/10/2026):** o clique em "Pilotar" já trava o ponteiro (`requestPointerLock` dentro da ativação do usuário). Com o mouse solto ele não pilota (antes o cursor batia na borda e aparecia fora do jogo), e a tela mostra "▶ clique para pilotar". Esc solta e o 2º Esc sai. O painel do prédio solta o mouse (pra clicar nos links) e trava de novo ao fechar. Se o navegador recusar (`pointerlockerror`), entra o modo reserva `sem-trava`, em que o movimento pilota mesmo solto. A mira fica sempre no centro.
- **Câmera colada na dobra:** a câmera de voo suaviza o deslocamento relativo à nave (`camRel`/`olhaRel`), não a posição no mundo. Suavizar no mundo deixava a câmera ~90 m pra trás a 800 m/s e a nave sumia lá na frente. Em dobra a câmera chega 22% mais perto e o FOV só abre +14°; o efeito fica nos riscos e no túnel.
- **Borda do sistema:** só remove a componente da velocidade que vai pra fora (a nave desliza na borda). Antes cortava a velocidade pela metade a cada quadro e a nave ficava presa.
- **Distorção em volta na dobra (05/10/2026):** pós-processamento só com `s.dobra > .02`. A cena vai pra um render target (MSAA 4) e um quad de tela inteira aplica desfoque radial de 14 amostras puxando pro centro, lente curvando as bordas e aberração cromática. A força cresce do centro (`smoothstep(.16,.62,r)`), então a nave fica nítida. O shader aplica tonemapping e colorspace (o render target é linear). O túnel em CSS caiu pra 55% de opacidade.
- **"Tudo achatado" (05/10/2026):** ao inserir o pós-processamento eu apaguei sem querer a chamada `medir()` (que dimensiona o renderer). O canvas ficou no padrão 300×150 esticado pra tela inteira: tudo achatado e pixelado. Recolocada. Ao mexer nesse trecho, conferir `canvas.width` contra `innerWidth * pixelRatio`.

## Jogo: mouse no Safari, entrada "como entrar na Terra" e planetas maiores (05/10/2026)
- **Trava do mouse:** o Safari só aceita `requestPointerLock` dentro do próprio gesto. Agora o clique em "Pilotar" (`src/effects/index.js`) pede a trava no `documentElement` antes de carregar o jogo, e o jogo confere `document.pointerLockElement` (qualquer elemento) e chama `aoTravar()` ao abrir. Cliques no jogo pedem de novo.
- **Escala:** `ESC_ORBITA` 165 e `ESC_TAM` 62 (planetas com raio 40–63), sol de raio 130, cinturão em ~1580, limite 1780, câmera com near 0,4 e far 16000. Velocidade normal até ~680 km/h e dobra até ~3400 km/h.
- **Tipos de planeta:** `atmosfera` em `PLANETAS`. Frontend, Backend, Mobile, Data, Security e Analytics têm atmosfera; Infra, Tooling e AI Workflow são tipo lua (céu preto estrelado, sem neblina nem nuvens, chão acinzentado, sem fogo de reentrada).
- **Entrada contínua:** `entrando` (2,6 s) é um mergulho acelerando (k^2,3) até a superfície do planeta, que cresce até encher a tela. No fim um véu da cor do céu (ou do chão, nos tipo lua) cobre a troca de cena. Em `descendo` a nave sai a 1500 m sobre um **globo** de raio 6000 (o terreno de 3000 m curva junto: `alturaChao` desconta `r²/2R`), vê o horizonte curvo, atravessa as nuvens em 450–750 m (overlay pela altitude) e desce até ~85 m perto da praça. A neblina abre com a altitude. A subida passa de 220 m, vai até 1700 e sai pelo escuro.
- **Globo** a -R-22: os vales do terreno descem até ~-15 e o globo aparecia neles como manchas.

## Jogo: entrada no planeta sem corte (05/10/2026)
- **Problema:** perto de um planeta de ~60 m, a nave (3,2 m, câmera ~20 m atrás) parecia do tamanho dele, e a troca de cena era um véu de cor cobrindo a tela. O ponto de vista também pulava: mergulhando de frente pro planeta e, logo depois, voando nivelado sobre um chão.
- **Como ficou:** `entrando` dura 5,2 s. Quem cresce é o planeta, em escala log, em volta do ponto embaixo da nave, até o raio do globo da superfície (`R_GLOBO`). Ao mesmo tempo a altitude relativa h/R cai até a de chegada (1723/6000), e a nave anda pra frente, então o rastro sai certo.
  - A nave e a câmera vão de "como estavam" para o mergulho no centro, depois para o voo nivelado: slerp de quaternions; a câmera usa offset no referencial dela.
  - A base do planeta no ponto de entrada (`ex`, `n` = pra fora, `f` = o que era "cima" na tela) é mapeada na base da superfície em `P_SUP` (`S2W`/`W2S`). Por isso, no fim, espaço e superfície estão no **mesmo ponto de vista**. `irParaSuperficie` converte posição, câmera, rumo e velocidade por essa base.
  - Antes de trocar, a última imagem do espaço vai para `rtFoto` e se dissolve por cima da superfície em 0,9 s (quad com tonemapping e colorspace). O véu saiu.
- **`criarEspaco().aproximar(p, R, centro, kCeu, kLuz, dirLuz)`:**
  - escala e move o planeta;
  - esconde os planetas e o sol que ele engole, as órbitas e o cinturão;
  - acende uma luz direcional no lugar do sol da superfície (entrando pelo lado da noite, era uma bola escura);
  - leva a cor e o emissivo ao tom do globo;
  - com atmosfera, o fundo vira a cor do céu, as estrelas e nebulosas apagam e entra a mesma neblina da superfície a ~1700 m;
  - o planeta focado para de girar.
- **Planetas com mais cara de planeta:**
  - textura 1024×512 com grão fino;
  - os tipo lua têm crateras e cor dessaturada;
  - os com atmosfera ganham uma casca de nuvens a 1,08 R. No globo da superfície há a mesma casca, a ~480 m, a altura das nuvens de lá. O globo usa a mesma textura do planeta.
- **Plasma e rastro:** o brilho do plasma foi reduzido (com a nave em escala 2,6 ele virava uma bola branca), e as partículas do rastro têm tamanho máximo de 48 px (perto da câmera viravam manchas enormes).
- **Teste:** com `?debugjogo`, sobrescrever `window.requestAnimationFrame = () => 0` antes de abrir o jogo deixa a simulação só no `__jogo.passo(n)`, quadro a quadro. O print do painel às vezes vem atrasado; basta tirar outro.

## Jogo: céu com o sistema, saída sem corte e troca sem engasgo (05/10/2026)
- **Os outros planetas e o sol não somem mais na entrada.** Antes eram escondidos quando o planeta crescendo os "engolia". Agora `porNoCeu` escala cada astro em volta do olho: mesma direção e mesmo tamanho na tela, só que a `DIST_CEU` (7000) da câmera. A direção sai de onde a nave estaria no sistema de verdade (`ent.ver`). No fim da entrada eles aparecem 2× maiores (`m`).
- **Céu da superfície:** os mesmos planetas (`montarPlaneta`, mesma textura, nuvens e anel) e o sol, nas direções reais (`atualizar` recebe `verdadeiro` e `W2S`), sem neblina, com a luz do sol junto.
  - Os tipo lua mostram o mesmo céu estrelado do espaço (`ceuEstrelado`), girado por `qW2S`.
  - Os com ar têm o domo em degradê (`domoCeu`). No espaço, o mesmo domo é girado pra "cima" da superfície e aparece com `kCeu`.
  - Cerca de metade dos planetas fica abaixo do horizonte, porque o sistema é plano.
- **O globo da superfície é o próprio planeta** (`montarPlaneta` com escala `R_GLOBO/raio`, girado por `qW2S` × o giro que o planeta tinha). Todos os planetas param de girar ao entrar (`focar`).
  - O terreno pega a cor de cada vértice da textura do globo logo abaixo, sem um quadrado de outra cor visto do alto.
  - As luzes do espaço viram as da superfície no fim (`luzEntrada` + `hemi` acendem, ambiente e contraluz apagam).
- **Troca sem engasgo:**
  - a próxima cena é montada antes, numa `Scene` separada: a superfície no E, o espaço ao começar a subir (`prepararSaida`);
  - é compilada com uma luz pontual de mentira, no lugar da luz do propulsor;
  - na troca só se troca a referência (`let cena`).
- **Foto da dissolução:** a "foto" vem de `copyFramebufferToTexture`, logo depois de redesenhar o quadro. Com render target, o domo (ShaderMaterial sem os chunks de cor) saía mais claro que na tela.
- **Saída (`saindo`, 4,6 s):** o caminho inverso, usando a mesma base da entrada.
  - Em 1500 m a cena troca no mesmo ponto de vista.
  - O planeta encolhe até o tamanho real enquanto a nave se afasta, o céu escurece, as estrelas voltam, e a órbita e o cinturão reaparecem.
  - A nave vira para fora, puxada para o lado do sol.
  - No fim, `terminarSaida` desloca nave e câmera juntas pro lugar de verdade (nada muda na tela) e `restaurar()` devolve tudo. O véu preto e o `voltarAoEspaco` saíram.
- **Custo:** montar a superfície leva ~100 ms no E (as texturas ficam em cache, então a volta leva ~20 ms). A troca leva ~50 ms de JS.

## Jogo: planetas e sol iguais ao site, maiores, e camada de gás na entrada (05/10/2026)
- **Igual ao Stack Universe do site:**
  - `PLANETAS` usa órbita, ângulo, tamanho e matiz do `domains` do index.html (todos roxo/azul), com órbitas elípticas (z × .55);
  - `canvasPlaneta` é o `planetTexture` do site, com semente `27 + i*41`;
  - o material é o `MeshPhysicalMaterial` do site (bump, clearcoat, sheen, emissivo), mais a atmosfera fina (1.055 R), a esfera "sombra" e o anel do Tooling;
  - o sol é o shader de plasma do site com os três brilhos (glow e duas texturas de raios);
  - as luzes também são as do site (pontual do sol, hemisférica, fill, rim azul e ambiente), com as intensidades das pontuais × `ESC^decaimento`, e exposição 1,24 no espaço (1 na superfície).
- **Escala:** uma unidade do site vale `ESC = 340` m, para tamanho e distância. Os planetas têm raio de 220 a 350 m, o sol 517 m, o cinturão fica em ~3700 e o limite em 4000. A velocidade vai até 320 m/s, e até ~2200 m/s na dobra. A nave começa em (-1500, 650, 2900), olhando o sistema como a câmera do site. Câmera com far 45000, estrelas a 20000.
- **Só do jogo, invisíveis de longe:** a atmosfera grossa (`atmosfera()`, casca de 1.2 R com brilho pela distância do raio de visão ao centro, mais borda no disco) e as nuvens aparecem só durante a entrada (`halo`, `nuv` em `aproximar`).
- **Camada de gás (planetas com ar):**
  - a entrada passa a durar 7 s; mergulha, e entre u≈.3 e .7 atravessa o gás;
  - o gás é uma esfera de 75 m em volta da câmera (a nave fica dentro e aparece), na cor do planeta, com 80 fiapos (sprites) vindo de frente em velocidade (`velGas`);
  - nesse trecho: plasma, tremor, FOV +10, poeira esticada e o céu ganhando cor por trás;
  - depois o gás abre, a nave nivela e se vê o horizonte curvo;
  - a saída atravessa o mesmo gás no começo.
- **Astros no céu crescem junto com o planeta** (`porNoCeu` com `kk = min(S, DIST_CEU/dist)`): antes, quem estava atrás do planeta que crescia aparecia na frente dele.
- **Rótulos:** o nome de um planeta atrás de outro (ou do sol) some (`escondido`).

## Jogo da nave — etapas 3 e 4: prédios com cara própria e controles de toque (05/10/2026)
- **Prédios (`src/jogo/predios.js`):** 8 tipos, um por tecnologia da área, então na praça nenhum se repete:
  - torre afinando com janelas e antena piscando;
  - domo de vidro com núcleo girando;
  - zigurate com pirâmide;
  - silos de dados com "bits" subindo;
  - cubo holográfico flutuando;
  - antena com prato girando e ondas;
  - torre torcida;
  - servidor com LEDs piscando e ventoinha.

  Todos têm a mesma portaria na frente (porta, batente e o círculo de entrada continuam iguais), o letreiro em cima do teto e um **emblema holográfico** com a sigla da tecnologia (sprite girando). A altura continua pelo nível.
- **Decoração temática por planeta** (`decorar`, instanciada, ~70–130 peças fora da praça): painéis de interface flutuando (Frontend), canos (Backend), monólitos-tela (Mobile), pilhas de discos (Data), pilones de escudo (Security), antenas (Infra), engrenagens (Tooling), barras de gráfico (Analytics) e orbes (AI). Os cristais caíram pra 160.
- **Toque (etapa 4):**
  - `TOQUE` = `maxTouchPoints` e `pointer:coarse`, ou `?debugtoque` pra testar no desktop;
  - metade esquerda da tela: joystick analógico, que aparece onde o dedo encosta;
  - metade direita: arrastar pra olhar;
  - botões ⚡ (turbo/correr/dobra), ▲ (subir/pular/decolar), E (ação, pisca verde quando tem algo) e ▼ (descer);
  - tocar no aviso de ação também interage.
- **HUD no toque:** compacto, com velocidade e alvo em cima, radar pequeno e sem ajuda de teclas. O painel do prédio ganhou "✕ sair do prédio".
- **Celular no geral:**
  - pixel ratio até 1,25;
  - o botão "Pilotar" agora aparece no celular, e no clique pede tela cheia (Android) em vez de travar o mouse;
  - no celular em pé o HUD se reorganiza.

## Jogo: Esc pausa, Esc de novo sai (05/10/2026)
- **Antes:** o Esc que solta o mouse chega à página antes ou depois de soltar, conforme o navegador, e a janela de 250 ms nem sempre cobria. Às vezes o 2º Esc era ignorado; às vezes o 1º já fechava o jogo.
- **Agora:**
  - Esc com o mouse preso chama `exitPointerLock()` e o jogo **pausa** (a simulação para, só redesenha), com o menu "▶ continuar" e "✕ sair do jogo";
  - o Esc que chega até 500 ms depois de soltar é ignorado;
  - Esc com o menu na tela sai;
  - teclas repetidas (`e.repeat`) são ignoradas.

## Jogo: nave no site, espaço de jogo, mapa, tiros, sons, mundo aberto, interiores e jetpack (05/10/2026, em andamento)
- **Site:** a nave do jogo orbita os planetas no Stack Universe (uma volta e meia em cada, curva bezier até o próximo). Clicar nela (ou no rótulo "🚀 pilotar") abre o jogo pelo mesmo caminho do botão Pilotar.
- **Espaço:**
  - planetas ~2× maiores (`ESC_TAM` 650, órbitas ×700, menor folga ~280 m);
  - céu pintado com a faixa da Via Láctea, mais três camadas de estrelas com cor e cintilar (shader);
  - cinturão com 5000 rochas e 4 campos de asteroides que giram, batem na nave e quebram com tiro (voltam em 25 s);
  - 2 buracos negros no cenário (disco de acreção em shader e anel de fótons).
- **Tiros:**
  - **Clique** (com o mouse preso; segurar dá rajada) ou **✦** no toque;
  - dois lasers saindo das asas (`tiros.js`), com faíscas e clarão;
  - quebram rochas e soltam faíscas em planetas, no chão e nos prédios.
- **Mapa:** **M** (ou 🗺) mostra uma visão de cima. No espaço: planetas com progresso, cinturão, campos, buracos negros e a nave. Na superfície: os locais das tecnologias, visitados ou não.
- **Sons** (`som.js`, Web Audio, nada baixado):
  - motor só quando acelera;
  - ronco na reentrada, no gás e na dobra;
  - jetpack, tiro, explosão, dobra, passos, pouso, porta, bips e acorde de conquista;
  - **N** (ou 🔊) liga e desliga, e fica lembrado.
- **Superfície (mundo aberto):**
  - mapa de ±2000 m com montanhas (`criarAltura`);
  - cada tecnologia num **local espalhado** (480–1320 m): praça, plataforma de pouso e feixe de luz de 420 m com o nome no alto (fica verde quando visitado);
  - decoração temática espalhada; sair do planeta só acima de 430 m.
- **Interior dos prédios (`interior.js`):** E na porta leva a um salão em y -3000, montado só enquanto se está dentro:
  - chão de grade em neon e paredes com código correndo;
  - emblema holográfico com icosaedro e partículas;
  - painéis NÍVEL / O QUE É / NA ÁREA / USADO EM;
  - terminal (E abre os links dos projetos) e portal de saída (E).
- **Astronauta:** corre em 8 direções olhando pra câmera (Walk, Run, Run_Back, Run_Left, Run_Right), com o ritmo da animação pela velocidade e o som dos passos. **Jetpack** (segurar Espaço no ar ou ▲) com chama, fumaça e combustível que recarrega no chão; **C** rola.
- **A conferir:** a superfície nova, o interior e o jetpack ainda não foram testados a fundo no preview.

## Jogo: mapa interativo com destino e prédios sem afundar (07/10/2026)
- **Prédios afundando:** o chão desconta a curva do globo (`r²/2R`). A 1 km do centro essa curva inclina o chão ~17%, então a praça de 52 m ficava ~4 m mais baixa de um lado e o prédio (reto) afundava. Agora, dentro de cada praça (e na transição de 70 m), a curva usada é a do centro da praça (`criarAltura`): praça plana de verdade.
- **Mapa interativo (M):**
  - arrastar move; rodinha (zoom em volta do cursor) ou pinça no toque;
  - clique num planeta (área do disco), sol, campo de asteroides, buraco negro, local de tecnologia, plataforma, na **sua nave** (estando a pé) ou em qualquer ponto **marca o destino**; clicar de novo nele desmarca;
  - o mapa mostra o destino pulsando e uma linha tracejada desde a nave;
  - com o mapa aberto o mouse fica solto e o jogo não pausa (`pausado()` ignora o mapa). Ao fechar, trava de novo;
  - cada mundo lembra a vista; na superfície ela começa centrada em você.
- **Marcador do destino na tela** (`.jogo-destino`):
  - círculo com nome e distância (até a superfície, no caso de planeta);
  - fora da visão vira uma seta na borda apontando o caminho;
  - ao chegar some com aviso e bip;
  - trocar de cena (entrar/sair de planeta) limpa o destino.
- **Bug achado no teste:** os dados dos planetas enviados ao mapa não tinham `key`, e o clique num planeta dava erro.

## Jogo: jetpack no Espaço segurado, animações sincronizadas, armas e inventário, tiro da nave (07/10/2026)
- **Tiro da nave não saía:** com o mouse preso (pointer lock no `<html>`), o `mousedown` vai pro elemento travado e não pro canvas. Agora o clique é ouvido no `document`.
- **Jetpack:**
  - sem combustível;
  - **só liga enquanto o Espaço está segurado no ar**. O pulo é normal: segurando, liga no alto do pulo (`subidaDoPulo` acaba com `velY < 1,2`); soltando e apertando de novo no ar, liga na hora;
  - ligado: empuxo nas 4 direções com inércia (16 m/s, 30 com Shift) e subida de 7 m/s. Espaço + Ctrl voa reto;
  - solto no ar: cai com gravidade e mantém o embalo.
- **Animações fluidas:** todos os ciclos de passo (Walk, Run, Run_Back, Run_Left, Run_Right, Run_Shoot) andam numa **fase comum** controlada à mão (`timeScale` 0, `time = fase × duração`), avançada pela velocidade. Misturar andar/correr ou frente/lado não embaralha as pernas, e os passos (som) saem nas fases 0 e 0,5. Pesos suavizados a 7/s, inclinação no voo a 4/s, com balanço leve no ar.
- **Armas** (GLB com `Idle_Gun_Pointing`, `Idle_Gun_Shoot`, `Run_Shoot` e `Gun_Shoot`; +23 KB gzip):
  - modelos procedurais (blaster, rifle e canhão) presos no osso `WristR`, montados na pose de mira;
  - armado, o astronauta sempre olha pra onde a câmera olha.
- **Tiro a pé:** sai da boca da arma em direção ao primeiro ponto do raio do centro da tela (chão, prédio ou parede do salão).
  - Blaster: tiro a tiro;
  - rifle: rajada;
  - canhão: lento, com explosão maior.
- **Inventário:** **TAB** (mouse solto, pausa ignorada) com 4 slots (mãos livres, blaster, rifle, canhão); clique ou **1–4**. A arma atual aparece embaixo, no centro. No toque, o botão 🔫 troca.

## Jogo: arsenal da nave e impacto nos asteroides (07/10/2026)
- **Inventário por contexto:** o TAB mostra o arsenal de quem está jogando (`montarInventario`): a pé, as armas do astronauta; pilotando, as da nave. A arma atual aparece sempre embaixo. 1–4 escolhem no contexto atual.
- **Armas da nave** (`NAVE_ARMAS`, `tiros.disparar(corpo, vel, escala, opções)`):
  - lasers duplos (dano 1);
  - metralhadora de plasma (alterna as asas, espalha um pouco, dano 0,45);
  - **mísseis teleguiados**: pegam a rocha viva mais perto num cone de ~35° à frente (`alvoNaFrente`), viram e aceleram até ela, deixam rastro, dano 4 em área de 90 m;
  - canhão de íons (bola lenta, dano 9 em área de 220 m).
- **Asteroides com vida** (`hp ≈ tamanho/20`):
  - cada acerto solta faísca no ponto do impacto, faz a rocha piscar clara, inchar 6% e levar um tranco de giro, com um "toc" de som;
  - ao quebrar: explosão grande, 6–26 **destroços** (InstancedMesh de 260 pedaços) que saem girando e encolhem, estrondo e tremor de câmera (`abalo`), mais forte quanto maior e mais perto a rocha.
- **Cinturão destrutível:** as 5000 rochas do cinturão guardam posição local, tamanho e vida, separadas em 360 setores de ângulo (`rochasPerto` só olha os setores perto do ponto, já descontando o giro do cinturão). Quebradas, voltam em 30 s.
- **Separação dos tiros:** os tiros a pé levam `dados.pe` (testam chão/prédio/parede); os da nave levam `dano`/`area`/`alvo`.

## Jogo: roda de armas, mira, primeira pessoa, arma em 3D e planetas mais cheios (07/10/2026)
- **Roda de armas (`roda.js`, estilo GTA):**
  - TAB segurado abre uma roda com as armas em fatias, cada uma com a **silhueta vetorial** da arma (a mesma forma do modelo 3D);
  - no centro: nome, descrição e barras de dano, cadência e alcance;
  - o mouse preso empurra um ponteiro virtual (`mover`); solto ou no toque, aponta direto;
  - soltar o TAB equipa (um toque rápido deixa aberta, até clicar ou apertar TAB de novo);
  - enquanto está aberta, o jogo roda a 25% (câmera lenta);
  - pilotando mostra o arsenal da nave.
- **Mira e tiro a pé:**
  - armado, a câmera vai pro ombro direito (mais perto) e a mira vira 4 traços que abrem a cada tiro (`--abre`);
  - clarão no cano da arma (sprite por arma), coice (a mira sobe um pouco) e a animação `Idle_Gun_Shoot` acelerada.
- **Primeira pessoa (V, a pé):** câmera no capacete (near 0,08), corpo escondido, e a arma num modelo próprio na frente da tela (`vista1`), com balanço ao andar e coice. Os tiros saem da boca dessa arma.
- **Arma atual em 3D** (canto inferior esquerdo, na fileira dos painéis):
  - uma cena pequena desenhada por cima, num recorte da própria tela (`setScissor`/`setViewport`, sem outro contexto WebGL);
  - a pé: o modelo da arma girando; na nave: o tipo de tiro (lasers, plasma, míssil, bola de íons).
- **Planetas mais cheios (`estruturas.js`):**
  - 7 **naves caídas** (clone do modelo da nave, escurecido, tombado, com cratera, fogo piscando e coluna de fumaça);
  - 12 **ruínas** (torre quebrada, arco, colunata);
  - **rios** nos planetas com ar, com leito cavado no terreno (`riosDe` + `criarAltura`) e água em shader correndo;
  - ~90 **barris e caixas destrutíveis**: barril explode e explode os vizinhos; tiro da nave ou a pé; o canhão acerta em área;
  - **chuva de meteoros** em parte dos planetas: com ar os meteoros queimam no céu, sem ar batem no chão com clarão, estrondo e tremor se estiver perto.
  - As estruturas têm colisão a pé e soltam faísca no tiro.
- **Custo:** os rios encarecem a altura do terreno, e montar a superfície no E passou de ~100 para ~210 ms. Dá pra otimizar com uma grade de distância aos rios.

## Jogo online: contas, salas e PvP (07/10/2026)
- **Servidor** (`party/index.js` + `wrangler.jsonc`): Cloudflare Workers + Durable Objects no plano gratuito, na conta do Lucas, em `https://stack-universe.chaconlucas.workers.dev`. Publicar: `npx wrangler deploy`.
  - O PartyKit hospedado não aceita mais projetos novos (o `partykit.dev` bateu o limite de 10 mil domínios da Cloudflare); por isso usamos o PartyServer na própria conta.
- **Contas** (Durable Object `Contas`, SQLite): `/api/registrar`, `/api/entrar`, `/api/eu`, `/api/sair`.
  - A senha vira hash PBKDF2-SHA256 (100 mil voltas, sal por conta), com comparação em tempo constante e hash mesmo pra usuário inexistente.
  - A sessão é um token aleatório guardado no navegador (`localStorage` `su-sessao`).
  - Limite de 20 tentativas por minuto por IP; CORS só pro site, previews do Vercel e localhost.
- **Salas** (`Sala`, PartyServer): uma por lugar (`espaco`, `planeta-<área>`), e só entra quem tem sessão válida (o nome vem da conta). O servidor repassa estado (~10/s) e tiros.
  - **PvP:** cada jogador liga o seu (P ou ⚔); só quem ligou acerta e é acertado.
  - O dano vem da tabela do servidor (por arma), com alcance e cadência conferidos; morte, renascer em 4 s e placar.
- **Site:** "Pilotar" sem conta sobe até o terminal do topo e começa `criar-conta` (email, usuário, senha com •••, confirmação). Outros comandos: `entrar`, `conta`, `sair`, `pilotar`. `src/conta.js` é compartilhado entre o site e o jogo.
- **Jogo** (`src/jogo/rede.js`):
  - outros jogadores aparecem como astronauta animado (SkeletonUtils) ou nave, com nome em cima (vermelho e com barra de vida se o PvP estiver ligado), interpolados;
  - os tiros deles aparecem só como efeito; o dano quem decide é o servidor;
  - HUD: contador de jogadores, feed (entrou, saiu, abates), vida quando o PvP está ligado, tela de "você foi abatido" e placar no **TAB** (segurar).
  - As armas agora são **1–4** e a roda abre no **I**; a caixa da arma mostra os slots.
- **Testar sem mexer na produção:** `npx wrangler dev --port 8787` e abrir o site com `?servidor=local`. Os dados locais ficam em `.wrangler/`, que está no `.gitignore`.

## Jogo: aviso de troca de arma, caixa da arma, conta no HUD, lados e ré (07/10/2026)
- **Troca de arma (1–4 ou roda):** aparece no meio da tela por ~1,3 s a silhueta da arma (`desenharSilhueta`, exportada de `roda.js`), na cor dela, com nome e descrição.
- **Caixa da arma, redesenhada:** nome numa linha em cima (borda na cor da arma), 3D no meio (lasers e plasma agora saem das asas da própria nave) e os 4 slots com número e silhueta, com o atual aceso.
- **Conta:** o usuário logado fica embaixo do título (👤). Ao abrir o jogo aparece "logado como …" ou "sem conta, jogando offline".
- **Nave de lado e de ré:**
  - A/D eram 34 m/s² com um freio lateral forte, então a nave parava em ~14 m/s. Agora são 150 m/s² no espaço (38 na superfície), sem freio lateral enquanto a tecla está apertada, com teto de 220 m/s (45 na superfície);
  - S freia e, parada, dá ré (teto de 160 m/s no espaço, 30 na superfície).
- **A pé de lado e de costas:**
  - a cadência agora vem da passada de cada clipe (andar ~1,5 m/s e correr ~5,2 m/s na velocidade natural). De lado e de costas usam clipes de corrida, que antes rodavam no ritmo do andar e pareciam "travados";
  - velocidades por direção: frente 3,4, lado 3,0 e costas 2,5 m/s (com Shift: 6,8 / 5,6 / 4,6).

## Admin, mira dos tiros, aviso de login e rodinha (07/10/2026)
- **Área de admin** (`/admin.html`, ou o comando `admin` no terminal do site):
  - mostra contas (sem senha), quem está online e onde, logins, abates e mortes;
  - o servidor só responde (`/api/admin`) se o email da conta estiver no segredo `ADMINS` da Cloudflare (`npx wrangler secret put ADMINS`, vários separados por vírgula). O email não fica no código.
- **Tiros vão para a mira:**
  - antes, a nave atirava para onde o nariz apontava, e o nariz segue a mira com atraso (até ~45° numa virada rápida);
  - agora o centro da tela vira um raio (`rochaNoRaio` no espaço, chão na superfície) e cada laser sai da sua asa convergindo nesse ponto;
  - a pé, a mira também para em prédios e em outros jogadores (antes atravessava e o tiro ia para o chão atrás).
- **Login visível:** ao abrir o jogo aparece um aviso grande "LOGADO COMO …" (ou "SEM CONTA"), próprio, sem ser trocado por outros avisos. Embaixo do título fica um selo com ponto verde.
- **Rodinha do mouse:** para cima aproxima e para baixo afasta (estava invertida).

## Jogo: cor de cada jogador, nave do admin e mirar com o botão direito (07/10/2026)
- **Cor por jogador:** tirada do nome (`matizDe` em `nave.js`), sempre a mesma. Pinta a nave no shader mantendo o claro/escuro da textura, além da chama, do nome em cima, do placar e do selo do HUD.
- **Nave do admin:** roxa e rosa, com dois anéis girando, luzes nas asas e aura; o nome leva 👑.
  - O servidor manda `admin` por jogador (pelo email no segredo `ADMINS`).
  - Ninguém mais recebe roxo ou rosa (matiz de 250 a 345 é pulado).
- **Botão direito = mirar:**
  - a pé, a câmera chega no ombro e o ângulo fecha ~32%;
  - na nave, zoom de ~45%;
  - o mouse fica mais fino e a mira fecha e acende verde;
  - o menu do botão direito fica bloqueado durante o jogo.

## Chat de voz, admin completo e "Pilotar" travando depois de publicar (07/10/2026)
- **"Pilotar" travava para quem estava com o site aberto antes de uma publicação nova.**
  - Os arquivos antigos (com hash no nome) somem da Vercel e o import do jogo dava 404.
  - Agora o `vite:preloadError` recarrega a página sozinho (no máximo uma vez a cada 20 s) e o import do jogo recarrega se falhar.
- **Chat de voz** (`src/jogo/voz.js`):
  - uma sala `voz` única no servidor só apresenta os jogadores (WebRTC: oferta, resposta, candidatos) e avisa quem fala; o áudio vai direto entre os navegadores (STUN da Cloudflare e do Google, sem TURN);
  - **T** segurado fala por proximidade: o volume cai com a distância, até 90 m a pé ou na superfície e 1500 m no espaço, e só vale na mesma sala;
  - **Y** segurado fala no rádio: todo mundo online ouve no volume cheio;
  - o microfone só é pedido na primeira fala. Se for bloqueado, aparece um aviso e a pessoa volta a ficar calada;
  - o HUD mostra quem fala, na cor do jogador.
  - Em redes muito fechadas pode não conectar sem um servidor TURN.
- **Admin:**
  - o comando `admin` no terminal fica escondido (para quem não é admin, responde "comando não encontrado") e abre o painel na mesma aba;
  - no painel: histórico de cada conta (tabela `historico`: conta criada, login, senha errada, entrou ou saiu de cada lugar com o tempo, PvP, abates, ban), últimos eventos, **banir** (com motivo) ou **desbanir**, e **excluir** (confirmando o nome);
  - banir e excluir derrubam a pessoa das salas e da voz na hora (`getServerByName(...).expulsar`, código 4003);
  - um admin não pode ser banido nem excluído.

## Jogo: achar os outros jogadores, total online e pinça (07/10/2026)
- **Ninguém se achava:** o universo é enorme e a nave tem 3 m. Já a poucas centenas de metros o outro jogador e o nome dele sumiam.
  - O nome agora tem tamanho fixo na tela (`sizeAttenuation: false`) e mostra a distância (ex.: "1.1 km"). Aparece atrás de planetas também.
  - O radar mostra cada jogador como um ponto na cor dele (na borda, se estiver longe).
  - Só se veem jogadores no mesmo lugar: espaço ou o mesmo planeta (cada lugar é uma sala).
- **Contador:** mostra quantos estão jogando no total ("N jogando agora"), contando a sala de voz, onde todo mundo logado entra. Antes contava só quem estava no mesmo lugar.
- **Pinça no trackpad** (chega como rodinha com ctrl): abrir os dedos aproxima e fechar afasta, proporcional ao gesto. Estava invertida.

## Voz pelo servidor, placar com o total, ajuda escondível e jogo bem mais leve (07/10/2026)
- **Voz não chegava** entre redes diferentes: o WebRTC direto, sem servidor TURN, falha com CGNAT (comum em operadora no Brasil).
  - Agora o áudio passa pela sala `voz` do servidor: pedaços de ~64 ms do microfone, reamostrados para 16 kHz e comprimidos em u-law, ~16 KB/s só enquanto fala.
  - O servidor repassa no máximo ~40 pedaços por segundo por pessoa.
  - Quem ouve agenda os pedaços numa fila com ~150 ms de folga. O volume (perto ou rádio) é um GainNode por jogador.
  - O áudio do navegador é liberado no primeiro clique ou tecla.
- **Quantos estão jogando:** fica só no **TAB** ("N jogando agora · M aqui (lugar)"); saiu o selo do topo.
- **Ajuda das teclas:** **H** esconde e mostra, e a escolha fica salva.
- **Leveza:**
  - com o jogo aberto, o site embaixo para de animar (os `requestAnimationFrame` do site ficam guardados e voltam ao fechar) e nem é composto (`visibility: hidden`). Antes o PC desenhava o site e o jogo ao mesmo tempo;
  - **resolução automática** pelo FPS, medido a cada 1,5 s: abaixo de 40 FPS cai, acima de 57 sobe até o máximo (1,5x);
  - **placa fraca** (Intel antiga, Mali, PowerVR, 4 núcleos ou menos) ou **sem aceleração** (SwiftShader, Microsoft Basic Render, llvmpipe) começa sem antisserrilhado e com resolução baixa. Para forçar esse modo: `?baixo`;
  - pausado, redesenha a ~10 quadros/s.

## Site inteiro: qualidade automática (07/10/2026)
- **Medição** (Mac rápido, ms de CPU por segundo e desenhos por quadro):

  | Parte | CPU | Desenhos por quadro |
  |---|---|---|
  | Stack Universe | ~150 ms/s | ~58 |
  | GateCheck (Projetos) | ~187 ms/s | ~313, com sombras suaves a cada quadro e até 2x de resolução com antisserrilhado |
  | Flash | ~45 ms/s | ~47 |

  As animações fora da tela já paravam (no Contato só o buraco negro desenha).
- **`src/effects/qualidade.js`:** mede o FPS da página em janelas de 2 s.
  - **Só se cair abaixo de 40** reduz a resolução das cenas 3D (Stack Universe, GateCheck, Flash, WSL e buraco negro), em degraus de 13% (25% abaixo de 25 FPS), até no mínimo metade.
  - Volta a subir depois de 3 janelas acima de 56 FPS, até o máximo original.
  - Em PC bom o fator fica em 1 e nada muda.
  - Pausa com a aba escondida ou com o jogo aberto.
  - O Stack Universe (criado no `index.html`) entra pela fila `window.__qualidadeFila`.
- **Testado** com um PC lento simulado (35 ms de CPU por quadro): a resolução caiu de 1044 para 689 px e voltou a 1044 em ~35 s depois de tirar a carga.

## Site: conta logada no topo (07/10/2026)
- **No avatar da marca (canto de cima):**
  - bolinha verde (logado) ou vermelha (sem conta);
  - coroa 👑 se a conta for admin (conferido no servidor e guardado na aba em `su-admin`);
  - ficam numa moldura por fora do círculo do avatar, que corta o que passa da borda.
- **Dentro do terminal:**
  - na barra, à direita: "● usuário" (ou "sem conta");
  - ao abrir, uma linha "conta: usuário · pilotar · admin · sair" ou "sem conta · criar-conta ou entrar", com os comandos clicáveis;
  - `conta` e `help` mostram `admin` só para admin.
- Atualiza na hora ao entrar ou sair (`conta.js` dispara `conta-mudou`). `matizDe` e `corCss` (cor do jogador) foram para `conta.js`; `nave.js` reexporta.
- O "Pilotar" sem conta continua abrindo o terminal no cadastro (`pedir-conta`; com `{ modo: 'entrar' }` abre no login).

## Planeta que dá a volta e estruturas novas (07/10/2026)
- **O planeta dá a volta:** a superfície agora é um mundo de 6 × 6 km (`PERIODO` em `cenas.js`) que se repete nas bordas. Indo reto, você volta ao começo.
  - **Relevo periódico:** frequências inteiras por volta e distâncias "pelo lado curto". As praças e os sítios são planos.
  - **Grade de alturas:** o relevo vira uma grade de 10 m que serve a física e o desenho, guardada por planeta.
  - **Rios:** são curvas periódicas que atravessam o planeta e emendam do outro lado.
  - **Chão:** a malha acompanha quem joga (vértices sobre a grade, refeita a cada ~100 m) e a cor vem da textura do planeta repetida.
  - **Globo e nuvens:** o globo de baixo segue a câmera; as nuvens aparecem na cópia mais perto.
  - **Borda:** ao passar dela, nave, astronauta e câmera vão juntos para o outro lado (`darAVolta`). O conteúdo do chão (`mundo.conteudo`) é desenhado de novo do outro lado só quando a câmera está perto da borda (`desenharFantasmas`).
  - **Outros jogadores e destino:** aparecem na cópia mais perto de você.
  - **Saída:** conta como se a nave estivesse em cima do ponto de entrada. O céu (sol e planetas) também é calculado a partir desse ponto.
- **Curvatura só no desenho** (`src/jogo/curva.js`): a física é plana, e cada vértice desce d²/(2R) em volta da câmera.
  - **Onde entra:** é injetada em todos os materiais da superfície, sprites inclusive, e nos shaders próprios (água, fumaça) via `CURVA_GLSL`.
  - **Onde não entra:** céu, astros, sol e o globo ficam marcados com `semCurva`.
  - **No espaço** `CURVA.k` fica em 0. Materiais novos (outros jogadores, tiros) ganham a curva a cada segundo.
- **Estruturas novas** (`estruturas.js`, em 33 sítios por planeta):
  - **Bases** de cobertura para o PvP: contêineres (alguns empilhados), muros de sacos de areia, barreiras de concreto e torre de vigia.
  - **Bunkers e galpões** para entrar: quatro paredes com porta, piso, luzes, tela, prateleiras e passarela no galpão, caixas destrutíveis. O teto some quando você está dentro e a câmera fica presa dentro.
  - **Cavernas:** cúpula de pedras com entrada, cristais brilhando por dentro, câmera presa dentro.
  - **O resto em maior quantidade:** naves caídas (16), ruínas (28), barris e caixas (34 grupos), cristais (1100) e decoração do tema (2,4x).
  - **Leveza:**
    - cada estrutura vira poucas malhas (peças juntadas por material com `mergeGeometries`);
    - o que está longe não é desenhado (alcance por tipo, maior com altitude);
    - sem luzes pontuais novas: os interiores têm luz própria fraca (`emissive`).
- **Colisão:** além dos círculos, há **paredes** (segmentos com espessura) para o astronauta e para os tiros. Tudo conta a volta no mapa.
- **Radar** centrado em você, com os sítios em losangos. O **mapa (M)** também mostra os sítios, que dá para clicar e marcar como destino.
- **Medido** (Mac): 100 a 150 chamadas de desenho no meio do mapa e ~430 perto da borda (o outro lado desenhado), ~250 ms para montar o planeta.
- **A fazer:** a nave ainda atravessa as estruturas novas; as cavernas são cúpulas, não túneis embaixo da terra.

## Cidades futuristas, planeta de 16 km e mapa completo (07/10/2026)
- **Planeta de 16 × 16 km** (`PERIODO`), com grade de relevo de 20 m. Continua dando a volta: é um planeta só, e sair por uma borda é chegar pela outra.
- **Cada tecnologia é uma cidade** (`src/jogo/cidades.js`):
  - **Tamanho pelo nível:** grande para Core/Primary (raio 380 m), média para Professional (250 m), pequena para as outras (190 m).
  - **O que tem:** ruas e avenidas em grade com faixas de neon, postes, anel viário e o prédio da tecnologia na praça do centro.
  - **Prédios futuristas** (mais altos perto do centro), em cinco tipos: torre em degraus, cúpula, agulha com anéis, bloco flutuante e torres gêmeas com ponte.
  - **Ruínas:** de 3 a 5 cidades por planeta, sem tecnologia, com prédios quebrados, tortos e apagados, e entulho.
  - **Leveza:** cada cidade são poucas malhas (peças juntadas por material) e some de longe. Os prédios colidem (círculos).
- **Rodovias** (árvore ligando a plataforma e as cidades, mais atalhos nas grandes): faixa escura com bordas e centro em neon. O terreno debaixo vira um aterro suave, aplicado na grade do relevo.
- **Nada da Terra:**
  - bases viraram **postos avançados** (muros de energia, caixas flutuantes, pilones com cristal, torre de sensor com anel girando);
  - bunkers viraram **módulos** (teto em cúpula, antena);
  - galpões viraram **hangares** (teto em arco com nervuras de neon);
  - colunas gregas viraram **pilones hexagonais**, e o arco virou **portal** de blocos;
  - barris viraram **células de energia** (explodem igual).
- **Sítios:** 66 por planeta (cavernas, módulos, hangares e postos), longe das cidades e das rodovias.
- **Mapa (M):** abre mostrando o **planeta inteiro**, com:
  - cidades no tamanho real (verde quando visitadas), ruínas tracejadas;
  - rodovias, repetidas nas bordas;
  - os sítios: só o quadradinho de longe, com o nome ao aproximar.
- **Medido** (Mac): ~320 ms para montar o planeta (~220 ms ao entrar de novo), ~230 chamadas de desenho dentro de uma cidade grande.

## Online: astronauta dos outros e nave de longe (08/10/2026)
- **O astronauta dos outros não aparecia:**
  - a escala vinha de uma caixa calculada no clone (SkeletonUtils) com o esqueleto ainda não posicionado, e o corpo ficava com ~5 cm;
  - agora a escala sai do modelo original quando ele carrega;
  - se alguém estava a pé antes de o modelo carregar, só o nome era criado e o corpo nunca aparecia; agora o corpo é refeito quando o modelo chega (`semCorpo`).
- **Nave dos outros no espaço:** só o nome aparecia, porque a nave tem 3 m e some a poucas centenas de metros. Cada jogador ganhou um **farol** (brilho na cor dele, do mesmo tamanho na tela a qualquer distância), que aparece de longe e some perto.
- **Astronauta do admin é o único diferente:**
  - traje roxo e rosa (`pintarAstronautaAdmin`: o mesmo tingimento da nave, só nas malhas com esqueleto, as armas não) e auréola de neon girando acima da cabeça (`aureolaAdmin`);
  - aparece para todo mundo, inclusive para o próprio admin;
  - o nome leva o selo rosa **ADM** (no rótulo em cima do jogador, no placar do TAB e no aviso de "entrou").

## Armas novas, duas mãos, superaquecimento, acerto, granada e escudo (08/10/2026)
- **Armas detalhadas** (`src/jogo/armas3d.js`):
  - blocos chanfrados (RoundedBoxGeometry) com **textura de painéis** gerada em canvas (juntas, parafusos, gravação com o nome da arma, faixas de alerta na cor dela, desgaste);
  - metal com **reflexo** (envMap de um RoomEnvironment, gerado uma vez em `index.js`);
  - célula de energia brilhando, cano com aletas, mira holográfica no rifle.
- **As duas mãos:**
  - **IK de dois ossos no braço esquerdo:** a clavícula avança o ombro quando o alvo está longe, e a mão vai até `userData.maoEsq`, por baixo do cabo/guarda-mão. Os dedos fecham.
  - O giro é feito no espaço do osso pai (o esqueleto tem reflexão).
  - Um bug de *aliasing* no `slerpQuaternions` (o mesmo quaternion dos dois lados) zerava o giro.
  - **Distância da mão esquerda ao ponto da arma:** 7 a 15 cm parado (limite do alcance do braço na pose de mira) e 2 cm correndo.
  - **Primeira pessoa:** luvas nas duas mãos, com punho e friso de neon (`maosPrimeiraPessoa`).
- **Superaquecimento:**
  - cada tiro esquenta a arma (blaster 9%, rifle 4,5%, canhão 34%), que esfria sozinha;
  - em 100% ela **trava por 1,8 s**, solta vapor e mostra "SUPERAQUECIDA";
  - a célula vai do tom da arma ao vermelho, o cano acende, e há uma barra de calor embaixo da mira.
- **Acerto:**
  - quatro traços na mira (vermelhos em jogador, brancos em objetos e asteroides);
  - **número de dano** subindo de onde bateu;
  - som de dois tons ao acertar jogador e "BLOQUEADO" (azul) quando o alvo está de escudo.
- **Granada de energia (G):**
  - arco com gravidade, quica no chão e nas paredes, explode em 1,7 s (raio de 9 m), recarga de 3,5 s;
  - quebra destrutíveis; no PvP o servidor aplica 45 de dano (até 4 alvos por granada);
  - os outros veem a explosão (`fx`).
- **Escudo (Q):**
  - 3 s sem levar dano, recarga de 12 s;
  - bolha de energia no astronauta ou na nave, que os outros também veem;
  - o servidor ignora o dano e avisa "bloqueado".
- **HUD:** quadradinhos G e Q, com a recarga enchendo.
- **Testado:** o servidor (com dois clientes) bloqueou o tiro de escudo e aplicou a granada; o rifle travou depois de ~2,8 s de tiro contínuo.
- **Atualização (mesmo dia): pente e recarga no lugar do superaquecimento**, a pedido.
  - **Munição infinita, mas cada arma tem pente:** blaster 12, rifle 30, canhão 1 (recarrega a cada tiro).
  - **Recarga:** acabou o pente, recarrega sozinho (no laço do jogo, logo depois do último tiro); **R** recarrega antes. Tempos: blaster 1,1 s, rifle 1,7 s, canhão 1,25 s.
  - **Animação:** a arma inclina, a célula de energia apaga, troca e enche de novo (`userData.recarga(k)`, aplicada sobre a pose da arma na mão). Sons na saída e na entrada da célula.
  - **Embaixo da mira:** "12 / ∞" e uma barrinha que enche na recarga.
- **Espada de energia no slot 1** (no lugar das mãos livres):
  - lâmina de luz (núcleo branco + brilho na cor), cabo com guarda;
  - anda com as animações sem arma, sem a mão esquerda;
  - o golpe é um arco de ~100° (`userData.golpe`), com o gesto do braço e um leque de luz na frente;
  - acerta destrutíveis num leque de ~110° até ~3 m;
  - no PvP o servidor aplica 35 de dano com alcance de 7 m (testado: perto conta; a 40 m é recusado);
  - o jogo começa com a espada na mão.

## HUD mais limpo (08/10/2026)
- **Topo:**
  - título e conta numa linha só, sem caixa;
  - um botão **☰** no canto abre PvP, mapa, som e sair (as teclas P, M, N e Esc continuam);
  - com PvP ligado aparece só um selo vermelho "⚔ PvP".
- **Caixa da arma** compacta (190 × 92), com a munição no canto ("12/12"). Os slots 1–4 só aparecem na troca (1,8 s) ou com o inventário aberto. O aviso de troca no meio da tela ficou menor e mais rápido.
- **Granada e escudo:** ícones pequenos ao lado da caixa da arma.
- **Velocidade e alvo:** um painel só, mais discreto; a pé some a velocidade.
- **Embaixo da mira:** só a barra de recarga, enquanto recarrega.
- **Ajuda das teclas** começa escondida (H mostra; a escolha fica salva).
- Conferido numa janela de 696 px: nada se sobrepõe.
- **O ☰ não dava para clicar no computador:** durante o jogo o mouse fica preso (vira a mira). As opções foram para o **menu de pausa (Esc)**, onde o mouse fica livre: Continuar, PvP (mostra se está ligado), Mapa, Som (mostra se está ligado) e Sair. O ☰ ficou só no toque (celular).
- **Esc tirava a tela cheia do navegador.**
  - Agora o jogo entra em tela cheia sozinho ao clicar em Pilotar, também no computador (antes só no celular).
  - No **Chrome/Edge**, ele pede o Esc para si (`navigator.keyboard.lock(['Escape'])`): um toque no Esc só pausa, e para sair da tela cheia se **segura** o Esc (o próprio Chrome avisa).
  - No **Firefox/Safari** (sem essa API) o Esc ainda tira a tela cheia, mas ao clicar em Continuar (ou no jogo) ela volta sozinha.
  - Ao fechar o jogo, a trava do Esc é solta e a tela cheia sai.

## Stack Universe: planetas se atravessando (09/10/2026)
- No site, cada planeta girava numa velocidade um pouco diferente (0,023 a 0,026 rad/s) e as órbitas vizinhas são próximas (Data 5,25 e Infra 4,95, raios ~0,5). Um alcançava o outro e as esferas se atravessavam.
- **Tentativa descartada:** um sobe e o outro desce. Falha quando um planeta fica entre dois (Mobile entre AI e Security é empurrado para os dois lados).
- **Solução:**
  - todos na **mesma velocidade angular** (0,024 rad/s), então ninguém alcança ninguém;
  - o ângulo inicial de **AI Workflow** passou de 6,2 para **5,5**, porque com 6,2 ficava encostando em Frontend.
- **Simulado numa volta inteira:** a menor distância entre dois planetas é 1,45× a soma dos raios.
- **No jogo** (mesma tabela, planetas parados): 1,7×.

## Planetas texturizados (site e jogo iguais) e fundo do Stack Universe (09/10/2026)
- **Bug corrigido no ar:** na correção da velocidade igual, um comentário `//` no meio da linha comentou o `planetMeshes.push` e o resto da linha. A nave do site procurava um planeta inexistente, a animação quebrava a cada quadro e o Stack Universe ficava vazio. Agora é `/* */`.
- **`src/planetas/textura.js`: uma textura só para o site e o jogo.** Os dois chamam `texturasPlaneta(renderer, { key, hue, seed })`.
  - **Gerada na placa de vídeo:** um shader de ruído 3D (simplex, fbm, ridged, deformação de domínio) amostrado na esfera de verdade, sem emenda nem polo esticado. Uma vez por planeta, com cache por renderer.
  - **Um tipo por planeta**, na paleta roxa de cada um:
    - Frontend terrestre, Mobile arquipélago e Data oceânico (continentes, mares, picos, gelo nos polos, luzes de cidade);
    - Backend e Tooling gasosos (faixas e uma tempestade);
    - Security vulcânico (rachaduras de lava rosa brilhando);
    - Infra gelado (placas com fendas);
    - Analytics desértico (dunas);
    - AI cristalino (veios brilhando);
    - crateras nos secos e sem ar.
  - **Saídas:** cor, relevo (R altura → bumpMap, G aspereza → roughnessMap) e brilho (emissiveMap, que já inclui o brilho base antigo). `materialPlaneta()` monta o mesmo material nos dois lados.
  - **Cor:** o shader pensa a cor em sRGB e grava linear (`pow 2.2`). Gravar num alvo sRGB convertia duas vezes e o planeta saía lavado.
  - **No jogo:** o chão da superfície usa as cores dessa mesma textura (`pixelsPlaneta`, lida da placa de vídeo uma vez e convertida de volta para sRGB). O brilho próprio do chão continua o roxo fixo de antes, porque o material novo usa emissive branco com mapa.
- **`src/planetas/fundo.js`** (só no site):
  - **buraco negro** no canto de cima à direita: horizonte, disco de acréção girando com o lado do doppler mais forte, anel de fótons, arco de cima e halo;
  - **meteoros:** pedra em brasa com rastro, a cada 5–11 s e às vezes dois.
- **Estrelas cadentes** no fundo de estrelas do site (canvas 2D): uma de vez em quando e, às vezes (22%), uma chuva de 6 a 11. Desligadas com "reduzir movimento".

## Armas refeitas e sabre de luz (09/10/2026)
- **`src/jogo/armas3d.js` reescrito** (mesma interface: `montarArma`, `maosPrimeiraPessoa`, `ambienteArmas`):
  - as armas de fogo são perfis de lado extrudados com chanfro (slide, receptor, coronha vazada, cabo com janela), canos torneados, cerâmica clara por cima e metal escuro por baixo, frisos na cor da arma e respiros acesos;
  - a munição é uma **célula de energia** de verdade (vidro, núcleo brilhando, tampas): no cabo do blaster, na frente do gatilho do rifle e na lateral do canhão.
- **Sabre de luz** no lugar da espada:
  - cabo de cromo torneado com pomo, anéis, botão aceso e coroa do emissor;
  - lâmina em três camadas: núcleo branco, brilho e aura que somem nas bordas;
  - o comprimento é um uniforme do shader. A lâmina **acende sozinha** quando aparece e cresce do emissor, com som;
  - segurado com **as duas mãos** em guarda: cotovelo direito dobrado e a esquerda no pomo por IK;
  - o golpe prepara por cima do ombro, corta na diagonal e volta, com o tronco girando junto e uma **fita de luz** seguindo a ponta (`criarRastroLamina`).
- **Recarga de verdade:**
  - a arma vira o lado da célula para a mão;
  - a mão esquerda puxa a célula velha, que cai girando com gravidade;
  - a mão busca outra no cinto, encaixa e dá um tapa, e a energia volta piscando;
  - funciona em terceira e em primeira pessoa (a luva esquerda da primeira pessoa está presa ao ponto `maoEsq`, que anda na recarga);
  - sons novos: `som.sabre('liga'|'corte')` e `som.mecanico('solta'|'encaixa'|'carrega')`.
- **Bugs corrigidos:**
  - o deslocamento da arma na recarga era aplicado no espaço do osso do pulso, que tem escala ~90×. A arma "voava" ~2 m; agora o deslocamento é feito no espaço da própria arma;
  - o giro do tronco no golpe se acumulava, porque nem toda animação mexe no osso `Torso`. Agora ele volta ao repouso todo quadro, como os dedos;
  - os dedos médios, anelar e mínimo também fecham na empunhadura (antes só o indicador).
- Modo de teste: `window.__jogo` ganhou `cena`, `astro`, `golpear`, `recarregar`, `atirar`, `escolherArma` e `alternarPrimeiraPessoa`.

## Chão do planeta, cabine da nave e arremesso da granada (09/10/2026)
- **Chão sem "pixel":**
  - antes a cor vinha da textura do planeta lida por vértice: um ponto a cada 20 m, sombreado chapado. Cada triângulo tinha uma cor só e o chão parecia pixelado;
  - agora `materialChao()` (em `cenas.js`) lê a MESMA textura do planeta na placa de vídeo, pela posição no mundo, com filtro;
  - por cima vêm três camadas de ruído (dezenas de metros, metros e palmos), manchas minerais de outro tom e placas escuras;
  - **veios de energia** finos na cor neon (nada de Terra), e o brilho próprio do planeta (lava, cristais) também vem da textura;
  - normais suaves (`computeVertexNormals`). `pixelsPlaneta` não é mais usado no jogo.
- **Cabine da nave** (`src/jogo/cabine.js`, tecla **V** pilotando):
  - a câmera vai para o assento (`CABINE_OFF`, no espaço do corpo da nave) e gira junto com o nariz e a inclinação; o modelo da nave some;
  - na frente: moldura do vidro com frisos acesos, painel inclinado com três telas vivas (velocidade e altitude, radar girando, arma, empuxo e escudo);
  - manche (direita) que inclina com a curva e a subida, e acelerador (esquerda) que anda com o empuxo, com as duas luvas segurando;
  - `criarLuva()` agora é exportada de `armas3d.js`.
- **Granada (G) com animação:**
  - o astronauta pega a granada no cinto com a mão esquerda, leva o braço para trás do ombro (o tronco gira junto) e joga por cima, e o braço acompanha;
  - a granada aparece na mão e sai DELA em ~0,3 s (`astro.arremessar()`, `astro.maoEsqPos()`);
  - na primeira pessoa, uma luva com a granada faz o mesmo movimento na frente da câmera.

## Estrelas mais vivas no Stack Universe (09/10/2026)
- **Estrelas 3D** (`stars()` no `index.html`): antes eram `PointsMaterial` quadrados, de cor única e minúsculos (~1,5 px). Agora são um `ShaderMaterial` próprio:
  - pontos redondos com núcleo, halo e raios em cruz nas maiores;
  - cores de estrelas de verdade, sorteadas por peso: azuladas, brancas, amarelas, laranja, vermelhas e algumas lilás;
  - tamanhos variados (~6% são estrelas grandes);
  - cada uma pisca no seu ritmo (`uT`), e a escala acompanha a altura do canvas (`uEsc`).
- **Estrelas 2D do fundo** (canvas `universeStars`): o núcleo e o brilho agora têm a cor da estrela (azul, amarela, laranja, vermelha, lilás ou branca), com brilho mais forte.

## Primeira pessoa com o corpo de verdade, visão única e nave mais rápida no planeta (09/10/2026)
- **Primeira pessoa a pé** não usa mais um modelo separado com luvas montadas de caixas (`vista1`, `maosPrimeiraPessoa` e a luva da granada foram removidos):
  - a câmera fica dentro do capacete do próprio astronauta;
  - só a cabeça (`SpaceSuit_Head`) e a auréola do admin somem (`astro.primeiraPessoa()`);
  - braços, mãos e arma são os do modelo, com as mesmas animações de tiro, recarga, sabre e granada;
  - o corpo vira junto com o olhar, com `FP_GIRO` para a arma do ombro direito apontar para a mira.
  - a câmera fica ~10 cm acima da cabeça e 5 cm à frente (`FP`, ajustável no teste com `__jogo.ajustarFP(giro, frente, alto)`). Com a câmera no centro da cabeça, os ombros low-poly enchiam a tela e a arma ficava no meio dela; assim aparecem só antebraços, mãos e arma, embaixo à direita.
- **O peito inclina com a mira** para cima e para baixo quando armado (osso `Chest`, volta ao repouso todo quadro), nas duas visões: os braços e a arma acompanham o olhar.
- **Visão única:** `s.fp` vale para a nave (cabine) e a pé. V alterna nos dois modos; entrar e sair da nave mantém a visão. Em primeira pessoa, sair da nave não vira a câmera para o rosto.
- **Nave na superfície mais rápida:** máxima de 70 → 140 m/s e turbo de 150 → 330 m/s, com mais aceleração.

## Correr armado, balanço da câmera e poeira redonda (09/10/2026)
- **Shift correndo armado** (`corridaK` em `index.js`, `corrida` em `astro.atualizar`):
  - **pistola e sabre** sobem numa mão só, perto do ombro; o braço esquerdo solta e o corpo usa a corrida normal;
  - **rifle e canhão** descem na diagonal na frente do corpo, com as duas mãos;
  - não dá para atirar até sair da corrida;
  - na primeira pessoa a pose é mais contida e a cabeça desce um pouco, para a arma continuar na tela;
  - tudo por `bracoDireito()` em `astronauta.js` (direção do braço e do antebraço no espaço do corpo). A guarda do sabre usa a mesma função.
- **Primeira pessoa:** balanço dos passos (mais forte correndo), tranco da câmera ao cair de um pulo, e o corpo e a mira seguem o mouse com um leve atraso, então a arma "balança" ao virar.
- **Poeira** do pouso e dos passos: os pontos ganharam textura redonda e macia (antes eram quadrados brancos).

## Encaixe na mão, punho fechado e luz do tiro (09/10/2026)
- **As armas iam presas no PULSO**, então o cabo ficava atrás da mão. Medido no modelo, o meio do punho fechado fica ~7 cm à frente do pulso (`_PUNHO` em `astronauta.js`). Agora todas as armas são montadas ali, e o cabo do sabre passa por dentro do punho.
- **Dedos:** cada falange fecha 1,25 rad (antes 0,75), e o punho fecha de verdade em volta do cabo.
- **Laser** (`tiros.js`): o tubo de cor chapada virou um shader com brilho que some nas bordas e nas pontas, núcleo branco por dentro e a curva do planeta.
- **Clarão na boca da arma:** estrela pequena com raios finos (`texEstrela`) no lugar da bola borrada grande.
- **Impacto dos tiros de mão:** clarão menor e mais curto, e faíscas pequenas (tamanho mínimo 1,2 → 0,18).

## Pegada das armas longas, jetpack e câmera por arma na primeira pessoa (09/10/2026)
- **Mão esquerda que não chegava na arma:**
  - o braço do modelo alcança ~41 cm (braço 18 + antebraço 23), e no rifle e no canhão a empunhadura da frente ficava a ~55 cm do ombro esquerdo, com erro de 11 a 15 cm;
  - agora as armas longas usam `segurarLonga()`: braço direito recolhido, arma perto do peito, coronha no ombro;
  - `apontarArma()` corrige o pulso para a arma apontar para a mira;
  - a empunhadura da frente do rifle foi recuada 6 cm.
- **Voando de jetpack armado:** pose de mira, com a arma erguida (antes caía na pose parada, de braços abaixados). Na primeira pessoa o corpo não inclina no voo.
- **Primeira pessoa:**
  - FOV 76° a pé (antes 60°);
  - câmera com ajuste por arma (`FP` em `index.js`: giro do corpo, frente, altura, lado), ajustável no teste com `__jogo.ajustarFP(id, g, f, a, l)`.

## Arma da primeira pessoa numa passada própria (09/10/2026)
- **Antes:** com a câmera no capacete, a arma ficava colada no rosto. Recuar a câmera fazia os ombros low-poly aparecerem.
- **Agora `desenhar()` faz duas passadas na primeira pessoa a pé:**
  - o mundo com a câmera normal; o astronauta fica na camada 1, fora dessa passada;
  - por cima, depois de limpar só a profundidade, o astronauta visto por `camVM`. Essa câmera é recuada (`r`) e deslocada para a esquerda e para cima (`x`, `y`), e o plano de corte (`r + c`) esconde ombros e costas.
- **Resultado:** a arma e as mãos de verdade, com todas as animações, bem à frente e no canto de baixo à direita, como nos jogos de tiro.
- As luzes da cena ganham a camada 1 (uma vez por cena), e o fundo é desligado na segunda passada.
- A cabeça e o jetpack somem na primeira pessoa.
- Valores por arma ficam em `FP` (`index.js`), e no teste: `__jogo.ajustarFP(id, { r, c, x, y, ... })`.

## Entrada no planeta, cabine nova com o piloto de verdade e granada segurada (09/10/2026)
- **Camada de gás da entrada** (`cenas.js`). Antes era uma esfera lilás uniforme (86% opaca) com 80 manchas redondas borradas. Agora:
  - **túnel de nuvens** em shader: faixas de nuvem (ruído 3D em coordenadas de túnel) correndo para trás, com vãos por onde se vê, mais claras em cima e abertas na frente para a nave e o caminho;
  - 36 fiapos alongados no sentido da velocidade.
- **Clarão do plasma:** menor. Na cabine, o brilho em volta da câmera some (`nave.vistaCabine()`).
- **Entrada e saída do planeta em primeira pessoa:** com a visão da cabine ligada, a cinemática inteira é vista de dentro dela.
- **Cabine refeita** (`cabine.js`):
  - capô curvo, painel inclinado com três telas e consoles laterais com 64 botões acesos (alguns piscam);
  - arcos do vidro em tubos curvos com frisos de neon, painel de teto e reflexo no vidro;
  - **HUD holográfico** no vidro: mira, horizonte e escada de arfagem que inclinam com a nave, fitas de velocidade e altitude, e bússola.
- **Piloto de verdade:**
  - as luvas geométricas saíram; o próprio astronauta fica sentado (cabeça escondida), com os ombros fora da visão;
  - as mãos vão por IK até o manche e o acelerador (`astro.pilotar()`; `maoNa()` serve para os dois braços);
  - as armas somem enquanto pilota.
- **Granada:** segurando o G, o braço fica armado lá atrás; ela só é jogada ao soltar (`astro.segurarGranada()`, `G_ARMADO`).
- **Braço "furado" na primeira pessoa:** desenhar o traje dos dois lados fechava o corte, mas mostrava o interior do tronco. Foi desfeito; o corte fica fora da área visível com a câmera da arma ajustada.
- **Inclinação do peito com a mira estava invertida** (o esqueleto é espelhado): olhando para cima a arma descia e olhando para baixo subia. Agora gira no sentido certo, 100% da mira, e a arma fica quase parada na tela.
- **Empunhar** (`empunhar()` em `astronauta.js`): o meio do punho (7 cm à frente do pulso) vai até o ponto do cabo, e o pulso gira para a linha dos nós dos dedos (indicador → mínimo) ficar ao longo do cabo, com a mão apontando para a frente. É usado:
  - no manche e no acelerador;
  - na mão esquerda do rifle e do canhão (empunhadura vertical) e do sabre (eixo da lâmina);
  - antes, só o pulso ia até o ponto, e a mão ficava virada como na pose parada.
- **Na cabine** somem os quadros de velocidade, alvo e arma do HUD da tela, porque o painel e o vidro já mostram isso.

## Tiro na cabine, saída do planeta, atmosfera e personagem deitado (09/10/2026)
- **Personagem de lado:** na cabine o piloto recebe a inclinação da nave. Ao sair, só o `rotation.y` era trocado e a inclinação ficava. Agora é `rotation.set(0, rumo, 0)`.
- **Tiro da nave na cabine:**
  - o laser nascia centrado no ponto de saída (metade atrás) e já andava ~18 m no primeiro quadro;
  - o brilho dependia do ângulo com a superfície e zerava visto ao longo do comprimento;
  - e o apagado das pontas pegava 30% perto da câmera.
- **Agora:**
  - a geometria começa na boca e o laser fica parado no quadro em que nasce;
  - um termo "ao longo do eixo" mantém o laser aceso, e as pontas apagam só 4%;
  - na cabine os tiros saem de baixo do nariz, à vista, mais finos e compridos, com um clarão pequeno e um **feixe** da boca até a mira que some em 0,15 s.
- **Saída do planeta:** no lugar do plasma (o cone amarelo), **riscos de luz** passam em volta da nave (`nave.riscos()`).
  - A imagem da superfície que se dissolvia por cima (o plano pálido cortando a tela) agora dura 0,35 s em vez de 0,9 s.
  - A camada de nuvens só aparece depois de a câmera sair dela.
- **Atmosfera vista do espaço:**
  - antes a casca brilhava por cima do disco inteiro, e de perto o planeta ficava esbranquiçado;
  - agora é só uma faixa na borda, mais forte do lado do sol, que apaga quando a câmera está perto ou dentro (entrando e saindo);
  - a casca é mais fina (1,1 R) e a beirada mais fraca;
  - as luzes da aproximação também foram reduzidas.

## Som respondendo na hora (10/10/2026)
- O `AudioContext` agora é criado com `latencyHint: 0` (o menor buffer que o sistema aceitar): no Chrome do Mac, a latência total caiu de ~29 ms para ~19 ms.
- O áudio é "destravado" também a cada tecla (não só no clique): se o navegador pausou o contexto (troca de aba, saída da tela cheia), os sons não ficam presos esperando.
- **O primeiro tiro sai no próprio clique** (`dispararSePuder()`), em vez de esperar o próximo quadro do jogo; a rajada segurando o botão continua no quadro.
- Fone Bluetooth adiciona 150–250 ms que o navegador não consegue tirar.

## Primeira pessoa estável, entrada direta da velocidade da luz e atmosfera suave (10/10/2026)
- **Armado, o corpo se divide em dois:**
  - as **pernas** seguem os ciclos de passo (cópias dos clipes só com os ossos de baixo, `P_*`);
  - o **tronco** fica sempre na pose de mira (`TRONCO`, só os ossos de cima);
  - antes, correndo de costas e de lado os braços balançavam como se não houvesse arma, e na primeira pessoa ela saía da tela.
- **Inclinação com a mira:**
  - o peito gira com a mira (`-mira`, sinal conferido pela posição da arma na tela);
  - a pegada das armas longas (`bracoDireito`) também gira com a mira;
  - a câmera da arma gira em volta do peito junto com o olhar;
  - resultado: olhando para cima ou para baixo, a arma fica parada no mesmo lugar da tela.
- **Campo de visão e corte do corpo:**
  - a passada da arma tem FOV próprio (54°); com o do mundo (76°) o braço esticava nas bordas;
  - o ombro cortado pelo plano da câmera aparecia como um toco oco. Agora o corte é uma esfera em volta do peito e dos ombros (o shader descarta, `cortarMaterial`), e o plano de corte ficou mínimo.
- **Mãos:**
  - o blaster também é empunhado pela esquerda (a mão envolve o cabo por baixo e pelo lado);
  - os dedos fecham 1,5 rad por falange e o polegar 0,8.
- **Entrada no planeta:**
  - bater no planeta já começa a entrada (antes empurrava a nave e parava);
  - a nave entra com o embalo que tinha, que cai suave para a velocidade do mergulho, e o efeito da velocidade da luz vai sumindo junto.
- **Atmosfera vista do espaço:**
  - a casca fina do site, com borda dura, fazia um anel em volta do planeta e saiu do jogo;
  - a atmosfera nova (faixa na borda, mais forte do lado do sol, véu suave até o fim) fica sempre ligada no espaço (`ATM_FORCA`) e some suave quando o planeta cresce na entrada.
- **Entrada mais direta (10/10):**
  - dura 5,6 s com ar (antes 7) e 4,4 s sem ar (antes 5,2);
  - o planeta cresce rápido desde o começo e só desacelera no fim (curva "ease-out"); antes começava devagar, acelerava e freava de novo.
- **Fogo da reentrada** (`nave.js`): o cone liso virou chamas em shader (ruído correndo da ponta para trás), branco-amarelo na frente e laranja-rosa na cauda. Só aparece na parte do ar, junto com os riscos de luz.
- A camada de nuvens do planeta durante a entrada caiu para 30% (fazia uma faixa pálida grossa no horizonte).
- O brilho do motor ficou menor (visto de trás, virava uma bola branca em cima da nave).
- **Primeira pessoa andando (10/10):**
  - o osso raiz do modelo é o `Body` (não `Hips`), e o giro dele (de lado o corpo vira) agora vem da pose de mira, não dos ciclos de passo. Antes a pistola saía da tela andando de lado e de costas;
  - a câmera da arma usa a posição atual do corpo, porque a do mundo foi posta antes do passo e ficava ~10 cm atrás andando;
  - posições por arma recalculadas com a pose já acomodada (as primeiras medições pegavam a troca de arma ainda em andamento) e mais perto da câmera.

## Braços de verdade na primeira pessoa (10/10/2026)
- **Mãos e braços da primeira pessoa trocados** pelo modelo "fps arms (rigged only)" de para (OpenGameArt, CC0): `public/assets/jogo/bracos.fbx` (FBX binário 7.4, 434 KB) + `bracos.jpg` (textura 1024², convertida de PNG). Os créditos estão em `public/assets/jogo/CREDITOS.txt`.
- **`src/jogo/bracos.js`:**
  - a pele vira luva (textura em tons de cinza, tingida);
  - os ombros ficam presos à câmera da arma;
  - IK de dois ossos até o cabo; a mão (que no rig é um controle à parte) vai para a ponta do antebraço;
  - o pulso gira para a linha dos nós (indicador → mínimo) ficar ao longo do cabo, e cada falange fecha em volta.
- **Na primeira pessoa a pé, o corpo do astronauta some inteiro** (só as armas continuam). `astro.alvosMaos()` dá onde cada mão segura: o cabo (direita), a empunhadura, o ponto da recarga ou a mão da granada (esquerda).
- **FOV e distância:**
  - a primeira pessoa voltou a 66° (o 76° esticava a tela) e o da arma a 50°;
  - a distância ficou intermediária. Recuar demais mostrava a arma por trás e os cortes do braço.
