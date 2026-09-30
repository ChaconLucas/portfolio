/**
 * Campo de estrelas do hero, em profundidade, ligado ao portal.
 *
 * O resto do site ja vive no espaco, mas a primeira tela tinha fundo opaco
 * (.intro-sticky pinta #06070c por cima das estrelas globais) e parecia outra
 * pagina. Aqui o mesmo espaco entra atras do nome:
 *
 *  - parado: estrelas em 3D vindo devagar na direcao da camera, com paralaxe
 *    no ponteiro e cintilar;
 *  - no portal: o ponto de fuga e o miolo do "O" (window.__portal) e a
 *    velocidade cresce com o progresso — as estrelas viram riscos de dobra
 *    entrando no nome, ate o universo tomar a tela.
 *
 * Canvas 2D, ~300 pontos. So desenha com o hero na tela e enquanto o
 * universo ainda nao cobriu tudo.
 */

const BASE = .035;         // velocidade em z por segundo, parado
const DOBRA = 5.2;         // velocidade extra no fim do portal

export function montarCampoEstrelas(sticky) {
  const canvas = document.createElement('canvas');
  canvas.className = 'campo-estrelas';
  canvas.setAttribute('aria-hidden', 'true');
  sticky.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, dpr = 1, estrelas = [];
  let mx = 0, my = 0, px = 0, py = 0;          // ponteiro -1..1, suavizado
  let raf = 0, visivel = false, ultimo = 0;

  const nova = (z) => ({
    x: (Math.random() * 2 - 1) * 1.6,
    y: (Math.random() * 2 - 1) * 1.1,
    z: z ?? (.08 + Math.random() * .92),
    tam: .5 + Math.random() * 1.3,
    fase: Math.random() * 6.28,
    pisca: .6 + Math.random() * 2.2,
    violeta: Math.random() < .16,
    sx: null, sy: null
  });

  function medir() {
    const r = sticky.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 1.25);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(520, Math.max(180, W * H / 2600)));
    while (estrelas.length < n) estrelas.push(nova());
    estrelas.length = n;
  }

  function quadro(agora) {
    const dt = ultimo ? Math.min(.1, (agora - ultimo) / 1000) : .016;
    ultimo = agora;
    const P = window.__portal;
    const t = P ? P.t : 0;
    // universo ja cobriu a tela inteira: nada para desenhar aqui
    if (t >= 1) { ctx.clearRect(0, 0, W, H); raf = visivel ? requestAnimationFrame(quadro) : 0; if (!raf) ultimo = 0; return; }

    px += (mx - px) * (1 - Math.pow(.02, dt));
    py += (my - py) * (1 - Math.pow(.02, dt));
    // ponto de fuga: o miolo do "O" no portal; sem portal, um pouco acima do centro
    const cx = P ? P.x : W * .5, cy = P ? P.y : H * .46;
    const f = Math.min(W, H) * .62;
    const dobra = t * t * DOBRA;
    const vz = reduz ? 0 : (BASE + dobra) * dt;

    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';
    for (const s of estrelas) {
      const zAntes = s.z;
      s.z -= vz;
      if (s.z < .03) { Object.assign(s, nova(1)); continue; }
      // paralaxe: o que esta perto mexe mais
      const par = (1 - s.z) * 26;
      const x = cx + (s.x / s.z) * f - px * par;
      const y = cy + (s.y / s.z) * f - py * par;
      if (x < -40 || x > W + 40 || y < -40 || y > H + 40) { Object.assign(s, nova(1)); continue; }
      const perto = 1 - s.z;
      const brilho = (.42 + perto * .58) * (reduz ? .8 : .72 + .28 * Math.sin(agora / 1000 * s.pisca + s.fase));
      const cor = s.violeta ? `rgba(196,168,255,${brilho})` : `rgba(244,240,255,${brilho})`;
      // piso de .6: abaixo disso a estrela do fundo some no antialias
      const r = s.tam * (.6 + perto * 1.2);
      if (dobra > .05) {
        // risco: de onde a estrela estava ha um instante ate onde esta
        const xa = cx + (s.x / zAntes) * f - px * par, ya = cy + (s.y / zAntes) * f - py * par;
        ctx.strokeStyle = cor; ctx.lineWidth = r * 1.4;
        ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(x, y); ctx.stroke();
      } else {
        ctx.fillStyle = cor;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
      }
    }
    raf = visivel && !reduz ? requestAnimationFrame(quadro) : 0;
    if (!raf) ultimo = 0;
  }
  const acordar = () => { if (!raf) raf = requestAnimationFrame(quadro); };

  addEventListener('pointermove', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    mx = e.clientX / innerWidth * 2 - 1; my = e.clientY / innerHeight * 2 - 1;
  }, { passive: true });
  // com reduced-motion nao ha laco: redesenha parado quando o scroll muda
  if (reduz) addEventListener('scroll', acordar, { passive: true });
  const io = new IntersectionObserver((es) => { visivel = es[es.length - 1].isIntersecting; if (visivel) acordar(); });
  io.observe(sticky);
  new ResizeObserver(() => { medir(); acordar(); }).observe(sticky);
  medir();
  acordar();
}
