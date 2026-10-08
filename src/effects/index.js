import './efeitos.css';
import './qualidade.js';   // resolucao automatica das cenas 3D (so baixa se o PC nao aguentar)

/* Site aberto antes de uma publicacao nova: os arquivos antigos (com hash no
   nome) somem da Vercel e o import do jogo/efeitos da 404 — "Pilotar" travava.
   O Vite avisa com vite:preloadError; a pagina recarrega sozinha (no maximo
   uma vez a cada 20 s, para nunca entrar em loop). */
addEventListener('vite:preloadError', (e) => {
  e.preventDefault();
  let ultima = 0; try { ultima = +sessionStorage.getItem('recarregou-versao') || 0; } catch (x) { /* */ }
  if (Date.now() - ultima < 20000) return;
  try { sessionStorage.setItem('recarregou-versao', String(Date.now())); } catch (x) { /* */ }
  location.reload();
});

/* Efeitos novos ficam aqui, fora do index.html. Cada um e carregado so quando
   faz sentido: o buraco negro quando o Contato esta chegando, o cursor so com
   mouse de verdade e sem pedido de menos movimento. */

const contato = document.getElementById('contact');
if (contato) {
  const io = new IntersectionObserver(async (es) => {
    const e = es[es.length - 1];   // a mais recente: com rolagem rapida vem mais de uma
    if (!e.isIntersecting) return;
    io.disconnect();
    const { montarBuracoNegro } = await import('./buraco-negro.js');
    const buraco = montarBuracoNegro(contato);
    // o texto em orbita precisa do centro do buraco: so monta se o WebGL subiu
    if (buraco) {
      const { montarOrbita } = await import('./orbita.js');
      montarOrbita(contato, buraco);
    }
  }, { rootMargin: '600px 0px' });
  io.observe(contato);
}

const mouseDeVerdade = matchMedia('(hover: hover) and (pointer: fine)');
const menosMovimento = matchMedia('(prefers-reduced-motion: reduce)');
if (mouseDeVerdade.matches && !menosMovimento.matches) {
  import('./cursor.js').then(({ montarCursor }) => montarCursor());
}

// Persiana nos titulos de secao: abre uma vez, quando o titulo entra em cena.
const titulos = document.querySelectorAll('#titulo-trajetoria, #titulo-projetos, #titulo-stack, #titulo-contato');
if (titulos.length && !menosMovimento.matches) {
  const ioTitulo = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      const el = e.target;
      ioTitulo.unobserve(el);
      el.classList.add('aberta');
      // transitionend de propriedade registrada nao dispara em todo navegador:
      // o tempo da transicao (1s) + folga resolve igual.
      setTimeout(() => el.classList.add('assentada'), 1150);
    }
  }, { threshold: .35 });
  titulos.forEach((t) => { t.classList.add('persiana'); ioTitulo.observe(t); });
}

// Vapor: so faz sentido onde existe portal (desktop, com movimento)
const palavra = document.getElementById('introBigWord');
const sticky = document.querySelector('.intro-sticky');
if (palavra && sticky && !menosMovimento.matches) {
  import('./vapor.js').then(({ montarVapor }) => montarVapor(palavra, sticky));
}

// Roda de projetos no cabecalho de Projetos
const cabecalhoProjetos = document.querySelector('.projects-v11-header');
if (cabecalhoProjetos) {
  import('./roda-projetos.js').then(({ montarRodaProjetos }) => montarRodaProjetos(cabecalhoProjetos));
}

// Borda que acende perto do cursor: so com mouse
if (mouseDeVerdade.matches) {
  import('./brilho.js').then(({ montarBrilho }) => montarBrilho());
}

// Nome gigante no pe do Contato
if (contato) {
  import('./rodape.js').then(({ montarRodape }) => montarRodape(contato));
}

// Cargos empilhando no celular
const experiencia = document.getElementById('experience');
if (experiencia) {
  import('./pilha.js').then(({ montarPilha }) => montarPilha(experiencia));
}

// Micro-rotulos embaralhando, numeros que rolam, globo no hero
import('./embaralhar.js').then(({ montarEmbaralhar }) => montarEmbaralhar());
import('./numeros.js').then(({ montarNumeros }) => montarNumeros());
const cardCargo = document.querySelector('.hero-signal-large');
if (cardCargo) import('./globo.js').then(({ montarGlobo }) => montarGlobo(cardCargo));
import('./particulas-titulo.js').then(({ montarParticulasTitulo }) => montarParticulasTitulo());

// Espaco no fundo do hero
if (sticky) import('./campo-estrelas.js').then(({ montarCampoEstrelas }) => montarCampoEstrelas(sticky));

// Portal entre os capitulos de projeto
import('./transicao-capitulos.js').then(({ montarTransicaoCapitulos }) => montarTransicaoCapitulos());

// Avatar em ASCII na marca do header (no lugar do planeta)
import('./avatar-ascii.js').then(({ montarAvatarAscii }) => montarAvatarAscii());

// Jogo da nave: so carrega quando alguem clica em "Pilotar"
// sem conta: o terminal do topo pede o cadastro (email, usuario, senha)
import { sessao } from '../conta.js';
document.getElementById('botaoPilotar')?.addEventListener('click', () => {
  if (!sessao()) { dispatchEvent(new CustomEvent('pedir-conta')); return; }
  // a trava do mouse tem que ser pedida AQUI, no mesmo instante do clique: o
  // Safari recusa se vier depois de carregar o jogo (fim do gesto do usuario)
  const toque = navigator.maxTouchPoints > 0 && matchMedia('(pointer:coarse)').matches;
  // celular: tela cheia (onde der: Android sim, iPhone nao) em vez de travar o mouse
  // tela cheia (celular e computador). No computador tambem trava o mouse e
  // pede o Esc para o jogo (Chrome/Edge): um toque no Esc so pausa; para sair
  // da tela cheia, segura o Esc
  try { const r = document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }); r?.then?.(() => navigator.keyboard?.lock?.(['Escape']).catch(() => {})).catch?.(() => {}); } catch (e) { /* */ }
  if (!toque) try { const r = document.documentElement.requestPointerLock?.(); r?.catch?.(() => {}); } catch (e) { /* sem trava */ }
  import('../jogo/index.js').then(({ abrirJogo }) => abrirJogo()).catch(() => location.reload());   // versao velha do site: recarrega
});
