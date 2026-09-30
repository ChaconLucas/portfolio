/**
 * Cursor que muda de forma.
 *
 *  - livre: ponto + anel. O ponto e o mouse cru; o anel vem atras com mola,
 *    e e isso que da peso sem atrasar a mira.
 *  - sobre alvo clicavel: o anel deixa de ser circulo e abraca o elemento
 *    (mesmo raio de borda), e o elemento e puxado um pouco para o ponteiro.
 *  - sobre titulo grande: o anel vira uma lente que inverte as cores.
 *  - sobre o universo 3D: o anel abre e fica fino, sinalizando "arraste".
 *
 * Um laco so, e ele dorme quando tudo assentou. O deslocamento magnetico usa
 * a propriedade `translate`, separada de `transform`, para nao brigar com o
 * hover que os botoes ja tem.
 */

const ALVOS = 'a[href], button, [role="button"], .three-planet-label, .pilha-camada, label[for]';
const TITULOS = 'h1, h2, .intro-big-word';
const ARRASTO = '#threeCanvas';
const IMA = .22;          // quanto o elemento segue o ponteiro
const IMA_MAX = 10;       // px

export function montarCursor() {
  const ponto = document.createElement('div');
  const anel = document.createElement('div');
  ponto.className = 'cursor-ponto';
  anel.className = 'cursor-anel';
  ponto.setAttribute('aria-hidden', 'true');
  anel.setAttribute('aria-hidden', 'true');
  document.body.append(anel, ponto);
  document.documentElement.classList.add('cursor-proprio');

  let mx = -100, my = -100, visivel = false, pressionado = false;
  // estado animado do anel
  const a = { x: -100, y: -100, w: 34, h: 34, r: 17, op: 0 };
  let alvo = null, modo = 'livre', raf = 0;

  // Mola por tempo, nao por quadro: k e o passo de um quadro a 60 Hz, e o
  // passo real e corrigido pelo dt. Igual em 60, 120 ou 30 fps.
  let dtf = 1;
  const lerp = (v, p, k) => v + (p - v) * (1 - Math.pow(1 - k, dtf));
  let ultimo = 0;

  function destino() {
    if (modo === 'alvo' && alvo && alvo.isConnected) {
      const b = alvo.getBoundingClientRect();
      const cs = getComputedStyle(alvo);
      const pad = 7;
      const raio = parseFloat(cs.borderTopLeftRadius) || 4;
      // centro do alvo puxado um pouco para o ponteiro
      const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      return {
        x: cx + (mx - cx) * .12, y: cy + (my - cy) * .12,
        w: b.width + pad * 2, h: b.height + pad * 2,
        r: Math.min(raio + pad, (b.height + pad * 2) / 2)
      };
    }
    const d = modo === 'titulo' ? 96 : modo === 'arrasto' ? 58 : 34;
    const s = pressionado ? .82 : 1;
    return { x: mx, y: my, w: d * s, h: d * s, r: d * s / 2 };
  }

  function quadro(agora) {
    dtf = ultimo ? Math.min(30, (agora - ultimo) / 16.667) : 1;
    ultimo = agora;
    const d = destino();
    const k = modo === 'alvo' ? .24 : .18;
    a.x = lerp(a.x, d.x, k); a.y = lerp(a.y, d.y, k);
    a.w = lerp(a.w, d.w, .2); a.h = lerp(a.h, d.h, .2); a.r = lerp(a.r, d.r, .2);
    a.op = lerp(a.op, visivel ? 1 : 0, .2);

    anel.style.transform = `translate3d(${a.x - a.w / 2}px,${a.y - a.h / 2}px,0)`;
    anel.style.width = a.w + 'px';
    anel.style.height = a.h + 'px';
    anel.style.borderRadius = a.r + 'px';
    anel.style.opacity = a.op.toFixed(3);
    ponto.style.transform = `translate3d(${mx - 3}px,${my - 3}px,0) scale(${modo === 'livre' ? 1 : 0})`;
    ponto.style.opacity = visivel ? '1' : '0';

    // Ima: o alvo atual busca o ponteiro, os que foram soltos voltam a zero
    let imaMexendo = false;
    for (const [el, o] of imas) {
      let tx = 0, ty = 0;
      if (el === alvo && modo === 'alvo') {
        const b = el.getBoundingClientRect();
        // centro "de repouso": desconta o proprio deslocamento
        const cx = b.left + b.width / 2 - o.x, cy = b.top + b.height / 2 - o.y;
        tx = Math.max(-IMA_MAX, Math.min(IMA_MAX, (mx - cx) * IMA));
        ty = Math.max(-IMA_MAX, Math.min(IMA_MAX, (my - cy) * IMA));
      }
      o.x = lerp(o.x, tx, .16); o.y = lerp(o.y, ty, .16);
      if (el !== alvo && Math.abs(o.x) < .05 && Math.abs(o.y) < .05) {
        el.style.translate = ''; imas.delete(el); continue;
      }
      el.style.translate = `${o.x.toFixed(2)}px ${o.y.toFixed(2)}px`;
      if (Math.abs(o.x - tx) > .05 || Math.abs(o.y - ty) > .05) imaMexendo = true;
    }

    const parado = !imaMexendo && Math.abs(a.x - d.x) < .1 && Math.abs(a.y - d.y) < .1 &&
      Math.abs(a.w - d.w) < .1 && Math.abs(a.h - d.h) < .1 && Math.abs(a.op - (visivel ? 1 : 0)) < .01;
    raf = parado ? 0 : requestAnimationFrame(quadro);
    if (!raf) ultimo = 0;
  }
  const acordar = () => { if (!raf) raf = requestAnimationFrame(quadro); };

  const imas = new Map();
  function soltarAlvo() { alvo = null; }
  function pegarAlvo(el) { alvo = el; if (!imas.has(el)) imas.set(el, { x: 0, y: 0 }); }

  function classificar(el) {
    const clicavel = el && el.closest(ALVOS);
    if (clicavel) {
      // botao ou link grande demais (um card inteiro) nao vira abraco: so o ponto some
      const b = clicavel.getBoundingClientRect();
      if (b.width < 520 && b.height < 220) return ['alvo', clicavel];
      return ['titulo', null];
    }
    if (el && el.closest(ARRASTO)) return ['arrasto', null];
    if (el && el.closest(TITULOS)) return ['titulo', null];
    return ['livre', null];
  }

  function aoMover(e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    mx = e.clientX; my = e.clientY;
    if (!visivel) { visivel = true; a.x = mx; a.y = my; }
    const [m, t] = classificar(e.target);
    if (t !== alvo) { soltarAlvo(); if (t) pegarAlvo(t); }
    if (m !== modo) {
      modo = m;
      anel.dataset.modo = m;
    }
    acordar();
  }

  const aoSair = () => { visivel = false; soltarAlvo(); modo = 'livre'; anel.dataset.modo = 'livre'; acordar(); };
  const aoApertar = () => { pressionado = true; anel.classList.add('apertado'); acordar(); };
  const aoSoltar = () => { pressionado = false; anel.classList.remove('apertado'); acordar(); };
  // O alvo se mexe quando a pagina rola; o anel precisa acompanhar
  const aoRolar = () => { if (modo === 'alvo') acordar(); };

  addEventListener('pointermove', aoMover, { passive: true });
  addEventListener('pointerdown', aoApertar, { passive: true });
  addEventListener('pointerup', aoSoltar, { passive: true });
  addEventListener('scroll', aoRolar, { passive: true });
  document.documentElement.addEventListener('pointerleave', aoSair);
  addEventListener('blur', aoSair);

  return {
    destruir() {
      cancelAnimationFrame(raf); soltarAlvo();
      for (const el of imas.keys()) el.style.translate = '';
      removeEventListener('pointermove', aoMover);
      removeEventListener('pointerdown', aoApertar);
      removeEventListener('pointerup', aoSoltar);
      removeEventListener('scroll', aoRolar);
      document.documentElement.removeEventListener('pointerleave', aoSair);
      removeEventListener('blur', aoSair);
      ponto.remove(); anel.remove();
      document.documentElement.classList.remove('cursor-proprio');
    }
  };
}
