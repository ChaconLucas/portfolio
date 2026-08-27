# ABERTURA — duas variantes de terminal (26/08/2026)

O site abre com um overlay `#energyBurst` em `position:fixed`, que some sozinho e devolve
a página. Existem **duas aberturas coexistindo no mesmo arquivo**; nenhuma foi descartada.

| Variante | `data-intro` | Ideia | Fim da cortina |
|---|---|---|---|
| Hacking | `hack` | invadir o próprio portfólio pelo terminal | 4,42 s |
| Claude Code | `ai` | sessão real do Claude Code editando o projeto | 4,86 s |

## Como trocar
1. `?intro=hack` ou `?intro=ai` na URL — a escolha fica salva em `localStorage['lc-intro']`.
2. Sem parâmetro, vale o que estiver salvo.
3. Sem nada salvo, vale a constante `INTRO_PADRAO` no script. **Hoje: `'hack'`.**

Consequência a lembrar: quem abrir uma vez com `?intro=ai` continua vendo a de IA nas
próximas visitas, mesmo sem o parâmetro. Não é bug.

## Ritmo global
```js
const VEL=1.14;   // >1 acelera a abertura inteira
eb0.getAnimations({subtree:true}).forEach(a=>a.updatePlaybackRate(VEL));
```
Um número só acelera as duas variantes. A alternativa — editar `animation-delay` linha por
linha — já causou descolamento entre a abertura e o nome do hero (ver KNOWN_ISSUES).
Quem mexer no `VEL` precisa lembrar dos dois consumidores fora do CSS:
o contador de tokens (`INICIO`/`DUR` divididos por `VEL`) e a rede de segurança
(`setTimeout(sair, 7400/1.14)`).

## Variante `hack`
`nmap -sV -p 443` → porta aberta → `./lc --exploit --payload rev` → banner LC em ASCII →
`[*] handshake ok` → `[ATTEMPT]` com barra → `[SUCCESS] key accepted` → `[✓] ACCESS GRANTED`.

## Variante `ai`
Reproduz a tela real de abertura do Claude Code:
`PS C:\Users\lucas> claude` → banner (marca + `Claude Code v2.1.246` + modelo + cwd) →
`› melhora a secao de projetos` → `● Read` → `● Edit` → `● Bash npm run build` com barra →
linha de trabalho com **contador de tokens** → `✓ 7 modules transformed · DEPLOY READY · ↑ 18.4k tokens`.

### Marca do Claude (`.cc-mark`)
Desenhada em CSS, sem imagem externa. 40×27 px, cor `#d97757`.
A silhueta **não é um bloco com entalhes** — é o detalhe que faz a marca ser reconhecível:
- cabeça de 17 % a 83 % da largura;
- faixa central de 0 a 100 %, entre 27 % e 58 % da altura — **as saliências laterais**;
- pernas de 58 % a 100 %, três delas, com dois vãos;
- olhos de 10 % × 18 % em 29 % e 61 %, recortados em `::before`/`::after` **na cor do fundo do
  terminal** (`#080a11`), não pintados por cima.
Se o fundo da janela do terminal mudar, os olhos precisam mudar junto.

### Contador de tokens
`rAF` escrevendo em `.cc-tok`: 0 → 18,4k em 800 ms/`VEL`, arredondado à centena, com
`font-variant-numeric:tabular-nums` para o número não tremer. A linha some quando o
resultado chega e o total reaparece no fim, em `.cc-tok-fim`.

## Pular
- Botão `#introSkip` no canto superior direito, visível em ~0,8 s, vale para as duas.
- `Esc` faz o mesmo.
- Qualquer `pointerdown`/`keydown` depois de 300 ms também pula. Os 300 ms existem porque
  automação e scroll restaurado disparavam evento no `load` e matavam a abertura na hora.
- O overlay é `pointer-events:none`; o botão reativa só para si com `pointer-events:auto`.

Pular precisa fazer **duas** coisas, não uma: rodar a cortina *e* adiantar o nome do hero
(`--nome-atraso`). Fazer só a primeira deixa a tela quase vazia por segundos.

## Redes de segurança
- `prefers-reduced-motion` remove a abertura na hora e zera `--nome-atraso`.
- `setTimeout(sair, 7400/VEL)` garante que a abertura nunca prende a página, mesmo se um
  `animationend` não disparar.
- A saída é por CSS (`animation:ebOut`), então funciona mesmo que o JS falhe.
