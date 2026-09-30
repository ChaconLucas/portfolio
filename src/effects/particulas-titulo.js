/**
 * Titulo que vira particulas sob o mouse (Particle Text / Vapour).
 *
 * Ao entrar no titulo, ele e trocado por uma copia feita de pontos, na mesma
 * posicao e cor. O ponteiro empurra os pontos; uma mola traz cada um de volta
 * para casa. Quando o mouse sai e tudo assenta, o texto de verdade volta —
 * a troca e invisivel porque os pontos estao exatamente sobre as letras.
 *
 * Os pontos vao direto num buffer de pixels (ImageData), sem fillRect: da
 * para ter ~20 mil sem pesar. O canvas cobre so o titulo mais uma margem.
 *
 * Titulo que quebra em mais de uma linha dentro do mesmo no de texto fica de
 * fora (nao da para saber que pedaco foi para cada linha): so desktop.
 */

const ALVOS = '#titulo-trajetoria, #titulo-projetos, #titulo-stack, #titulo-contato';
const MARGEM = 140;       // px em volta do titulo onde os pontos podem ir
const PASSO = 2;          // px entre amostras
const RAIO = 110;         // alcance do empurrao
const FORCA = 1.9;
const MOLA = .055, ATRITO = .86;

export function montarParticulasTitulo() {
  const mouse = matchMedia('(hover: hover) and (pointer: fine)');
  const reduz = matchMedia('(prefers-reduced-motion: reduce)');
  if (!mouse.matches || reduz.matches) return;

  let ativo = null;   // { el, canvas, ctx, img, buf, W, H, pts, dentro }

  function cor(css) {
    const m = css.match(/rgba?\(([^)]+)\)/);
    if (!m) return [244, 240, 255, 255];
    const p = m[1].split(',').map((v) => parseFloat(v));
    return [p[0], p[1], p[2], Math.round((p[3] ?? 1) * 255)];
  }

  function amostrar(el) {
    const r = el.getBoundingClientRect();
    const W = Math.ceil(r.width + MARGEM * 2), H = Math.ceil(r.height + MARGEM * 2);
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const o = off.getContext('2d', { willReadFrequently: true });
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent.trim() ? 1 : 3) });
    const cores = [];
    let n, k = 0;
    while ((n = w.nextNode())) {
      const rg = document.createRange(); rg.selectNodeContents(n);
      const rects = rg.getClientRects();
      if (rects.length !== 1) return null;                // quebrou linha: fora
      const cs = getComputedStyle(n.parentElement);
      o.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      if ('letterSpacing' in o) o.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
      const asc = o.measureText(n.textContent).fontBoundingBoxAscent;
      // cada no pinta com um "canal" proprio (verde = indice), para saber
      // depois de que cor e cada pixel
      k++;
      o.fillStyle = `rgb(255,${k},0)`;
      o.fillText(n.textContent, rects[0].left - r.left + MARGEM, rects[0].top - r.top + MARGEM + asc);
      cores[k] = cor(cs.webkitTextFillColor && cs.webkitTextFillColor !== 'rgba(0, 0, 0, 0)' ? cs.webkitTextFillColor : cs.color);
    }
    const d = o.getImageData(0, 0, W, H).data;
    const pts = [];
    for (let y = 0; y < H; y += PASSO) {
      for (let x = 0; x < W; x += PASSO) {
        const i = (y * W + x) * 4;
        if (d[i + 3] < 140) continue;
        const c = cores[d[i + 1]] || [244, 240, 255, 255];
        // cor empacotada para Uint32 (little-endian: ABGR)
        const u = ((c[3] << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
        pts.push({ hx: x, hy: y, x, y, vx: 0, vy: 0, u });
      }
    }
    return { W, H, pts };
  }

  function comecar(el) {
    if (ativo) terminar();
    const a = amostrar(el);
    if (!a || !a.pts.length) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'titulo-particulas';
    canvas.width = a.W; canvas.height = a.H;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(a.W, a.H);
    const buf = new Uint32Array(img.data.buffer);
    ativo = { el, canvas, ctx, img, buf, ...a, dentro: true, px: -1e4, py: -1e4, raf: 0 };
    posicionar();
    desenhar();                      // primeiro quadro com os pontos em casa
    el.classList.add('titulo-em-particulas');
    ativo.raf = requestAnimationFrame(quadro);
  }

  function posicionar() {
    const r = ativo.el.getBoundingClientRect();
    ativo.ox = r.left - MARGEM; ativo.oy = r.top - MARGEM;
    ativo.canvas.style.transform = `translate(${ativo.ox}px,${ativo.oy}px)`;
  }

  function desenhar() {
    const { buf, W, H, pts } = ativo;
    buf.fill(0);
    for (const p of pts) {
      const x = p.x | 0, y = p.y | 0;
      if (x < 0 || y < 0 || x >= W - 1 || y >= H - 1) continue;
      const i = y * W + x;
      // 2x2: cobre a grade de passo 2 sem buracos
      buf[i] = buf[i + 1] = buf[i + W] = buf[i + W + 1] = p.u;
    }
    ativo.ctx.putImageData(ativo.img, 0, 0);
  }

  // Fisica por tempo: MOLA/ATRITO/FORCA sao calibrados para passos de 60 Hz
  // e o dt real vira frações desse passo (subpassos quando o quadro atrasa).
  // Por quadro, a 120 Hz a mola ficaria com o dobro da velocidade.
  function passo(f) {
    const mx = ativo.px - ativo.ox, my = ativo.py - ativo.oy;
    const atrito = Math.pow(ATRITO, f);
    let mexendo = false;
    for (const p of ativo.pts) {
      if (ativo.dentro) {
        const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
        if (d2 < RAIO * RAIO) {
          const d = Math.sqrt(d2) || 1, g = (1 - d / RAIO) * FORCA * 2.2 * f;
          p.vx += dx / d * g; p.vy += dy / d * g;
        }
      }
      p.vx += (p.hx - p.x) * MOLA * f; p.vy += (p.hy - p.y) * MOLA * f;
      p.vx *= atrito; p.vy *= atrito;
      p.x += p.vx * f; p.y += p.vy * f;
      if (!mexendo && (Math.abs(p.x - p.hx) > .4 || Math.abs(p.y - p.hy) > .4 || Math.abs(p.vx) > .05)) mexendo = true;
    }
    return mexendo;
  }

  function quadro(agora) {
    if (!ativo) return;
    posicionar();
    let f = ativo.ultimo ? (agora - ativo.ultimo) / 16.667 : 1;
    ativo.ultimo = agora;
    f = Math.min(f, 12);                      // aba voltou do fundo: nao explode
    let mexendo = false;
    while (f > 0) { const s = Math.min(1, f); mexendo = passo(s) || mexendo; f -= s; }
    desenhar();
    // mouse fora e tudo em casa: devolve o texto de verdade
    if (!ativo.dentro && !mexendo) { terminar(); return; }
    ativo.raf = requestAnimationFrame(quadro);
  }

  function terminar() {
    if (!ativo) return;
    cancelAnimationFrame(ativo.raf);
    ativo.el.classList.remove('titulo-em-particulas');
    ativo.canvas.remove();
    ativo = null;
  }

  document.querySelectorAll(ALVOS).forEach((el) => {
    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      // espera a persiana terminar: amostrar no meio pegaria o titulo cortado
      if (el.classList.contains('persiana') && !el.classList.contains('assentada')) return;
      if (!ativo || ativo.el !== el) comecar(el);
      if (ativo) { ativo.dentro = true; ativo.px = e.clientX; ativo.py = e.clientY; }
    });
    el.addEventListener('pointermove', (e) => {
      if (ativo && ativo.el === el) { ativo.px = e.clientX; ativo.py = e.clientY; }
    });
    el.addEventListener('pointerleave', () => { if (ativo && ativo.el === el) ativo.dentro = false; });
  });
  // rolar para longe com o titulo ativo: encerra
  addEventListener('scroll', () => {
    if (!ativo) return;
    const r = ativo.el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) terminar();
  }, { passive: true });
}
