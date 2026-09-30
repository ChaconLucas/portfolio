/**
 * Vapor: o "PRODUCTS" do hero se desfaz em particulas que espiralam para
 * dentro do portal do "O".
 *
 * Nao e uma animacao com tempo proprio: cada particula e uma funcao do
 * progresso do portal (`window.__portal.t`, escrito pelo driver do intro).
 * Rolar para cima remonta a palavra exatamente — nada a desfazer.
 *
 * As particulas saem da propria palavra: ela e desenhada num canvas com a
 * fonte computada, e cada pixel com tinta (numa grade) vira um ponto.
 */

const PASSO = 4;        // px entre amostras; menor = palavra mais cheia, mais custo

export function montarVapor(palavra, sticky) {
  const canvas = document.createElement('canvas');
  canvas.className = 'vapor';
  canvas.setAttribute('aria-hidden', 'true');
  sticky.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // lavanda do site: a cor que as particulas ganham ao serem puxadas
  let pts = null, alfaBase = .03, W = 0, H = 0, dpr = 1;
  const COR = '#c4a8ff';

  function amostrar() {
    // A palavra e medida sem o zoom do portal: o hero volta a escala 1 so
    // durante a leitura, como em medirPortal().
    const hero = palavra.closest('.intro-hero');
    const salva = hero.style.transform;
    hero.style.transform = 'none';
    // Range no texto (e nao a caixa do elemento): o topo dele e o topo da area
    // de conteudo da fonte, entao linha de base = topo + ascent. Mesma conta
    // validada no portal.
    const tn = [...palavra.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    if (!tn) { hero.style.transform = salva; return null; }
    const rg = document.createRange(); rg.selectNodeContents(tn);
    const b = rg.getBoundingClientRect();
    const sb = sticky.getBoundingClientRect();
    hero.style.transform = salva;
    const cs = getComputedStyle(palavra);
    // A palavra e marca d'agua (branco a ~4%): partida com a mesma presenca
    // dela, para a troca texto -> particula nao aparecer.
    const m = cs.color.match(/rgba?\(([^)]+)\)/);
    alfaBase = m ? (m[1].split(',')[3] !== undefined ? parseFloat(m[1].split(',')[3]) : 1) * .72 : .03;
    const w = Math.ceil(b.width), h = Math.ceil(b.height);
    if (!w || !h) return null;
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const o = off.getContext('2d', { willReadFrequently: true });
    o.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    o.textBaseline = 'alphabetic';
    o.fillStyle = '#000';
    const asc = o.measureText(tn.textContent).fontBoundingBoxAscent;
    // letter-spacing do CSS vale no canvas moderno; onde nao valer a palavra
    // sai so um pouco mais estreita, e as particulas continuam dentro dela
    if ('letterSpacing' in o) o.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
    o.fillText(tn.textContent, 0, asc * (h / (asc + o.measureText(tn.textContent).fontBoundingBoxDescent)));
    const px = o.getImageData(0, 0, w, h).data;
    const lista = [];
    for (let y = 0; y < h; y += PASSO) {
      for (let x = 0; x < w; x += PASSO) {
        if (px[(y * w + x) * 4 + 3] < 128) continue;
        // pseudo-aleatorio estavel por ponto: a mesma particula faz sempre o
        // mesmo caminho, entao ir e voltar no scroll nao embaralha nada
        const r = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
        const r2 = Math.abs(Math.sin(x * 39.35 + y * 11.13) * 24634.63) % 1;
        lista.push({
          x: b.left - sb.left + x, y: b.top - sb.top + y,
          // quem esta mais perto do portal parte antes
          atraso: r * .28,
          giro: (r2 - .5) * 2.4 + 1.6,
          tam: 1.2 + r * 1.6
        });
      }
    }
    // ordem de atraso pela distancia horizontal ao portal e decidida no quadro
    return lista;
  }

  function medir() {
    const r = sticky.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  let desenhado = false, raf = 0, visivel = false;

  function quadro() {
    raf = visivel ? requestAnimationFrame(quadro) : 0;
    const P = window.__portal;
    const t = P ? P.t : 0;
    if (!P || t <= 0 || t >= 1) {
      if (desenhado) { ctx.clearRect(0, 0, W, H); desenhado = false; }
      if (!P || t <= 0) pts = null;          // remede na proxima ida
      return;
    }
    if (!pts) pts = amostrar();
    if (!pts) return;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = COR;
    const cx = P.x, cy = P.y;
    // a palavra toda some na primeira metade do portal: depois disso o zoom
    // ja encheu a tela e ninguem veria particula nenhuma
    const T = Math.min(1, t / .55);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      let e = (T - p.atraso) / (1 - p.atraso);
      if (e <= 0) { ctx.globalAlpha = alfaBase; ctx.fillRect(p.x, p.y, 2.4, 2.4); continue; }
      if (e >= 1) continue;
      e = e * e * (3 - 2 * e);                  // parte devagar, acelera, entra
      const dx = p.x - cx, dy = p.y - cy;
      const a = e * p.giro * Math.PI;           // espiral em volta do portal
      const k = Math.pow(1 - e, 1.35);          // e o raio encolhe ate zero
      const ca = Math.cos(a), sa = Math.sin(a);
      const x = cx + (dx * ca - dy * sa) * k;
      const y = cy + (dx * sa + dy * ca) * k;
      const s = p.tam * (1 - e * .7) + 1;
      // acende no meio do voo e apaga ao cruzar a borda do buraco
      ctx.globalAlpha = alfaBase + (1 - alfaBase) * .85 * 4 * e * (1 - e);
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    desenhado = true;
  }

  const io = new IntersectionObserver((es) => {
    const e = es[es.length - 1];   // a mais recente: com rolagem rapida vem mais de uma
    visivel = e.isIntersecting;
    if (visivel && !raf) raf = requestAnimationFrame(quadro);
  });
  io.observe(sticky);
  const aoRedimensionar = () => { medir(); pts = null; };
  addEventListener('resize', aoRedimensionar, { passive: true });
  medir();
  window.__vaporAtivo = true;

  return {
    destruir() {
      cancelAnimationFrame(raf); io.disconnect();
      removeEventListener('resize', aoRedimensionar);
      canvas.remove(); window.__vaporAtivo = false;
    }
  };
}
