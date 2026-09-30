/**
 * Texto em orbita do buraco negro (Marquee along SVG path).
 *
 * Um anel inclinado de texto gira em volta da sombra. A metade de tras passa
 * POR TRAS dela (mascarada pela sombra), a da frente por cima — sem isso o
 * texto parece um adesivo colado no shader.
 *
 * Velocidade: um giro base, que acelera com a velocidade do scroll e cai para
 * um quarto com o ponteiro em cima do anel (o "hover slowdown" do original).
 *
 * O texto sai de .contact-meta, que ja esta na pagina: nada inventado.
 */

const NS = 'http://www.w3.org/2000/svg';
const RAIO = 2.35;          // em raios da sombra
const ACHATA = .42;         // inclinacao do anel (1 = de frente)
const GIRO = -8;            // graus por segundo, parado
const TOMBO = -7;           // graus, acompanha o disco

export function montarOrbita(secao, buraco) {
  const meta = [...secao.querySelectorAll('.contact-meta span')].map((s) => s.textContent.trim()).filter(Boolean);
  const frase = (meta.length ? meta.join(' · ') : 'LUCAS CHACON') + ' · ';
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'orbita-texto');
  svg.setAttribute('aria-hidden', 'true');
  const uid = 'orb' + Math.random().toString(36).slice(2, 7);
  svg.innerHTML = `
    <defs>
      <path id="${uid}-p"/>
      <mask id="${uid}-m" maskUnits="userSpaceOnUse" x="-5000" y="-5000" width="10000" height="10000">
        <rect x="-5000" y="-5000" width="10000" height="10000" fill="#fff"/>
        <ellipse id="${uid}-sombra" fill="#000"/>
      </mask>
      <clipPath id="${uid}-tras"><rect x="-5000" y="-5000" width="10000" height="5000"/></clipPath>
      <clipPath id="${uid}-frente"><rect x="-5000" y="0" width="10000" height="5000"/></clipPath>
    </defs>
    <g class="orbita-base">
      <g clip-path="url(#${uid}-tras)" mask="url(#${uid}-m)" opacity=".45"><g class="orbita-giro"><text><textPath href="#${uid}-p"></textPath></text></g></g>
      <g clip-path="url(#${uid}-frente)"><g class="orbita-giro"><text><textPath href="#${uid}-p"></textPath></text></g></g>
    </g>`;
  secao.appendChild(svg);

  const base = svg.querySelector('.orbita-base');
  const giros = [...svg.querySelectorAll('.orbita-giro')];
  const caminho = svg.querySelector(`#${uid}-p`);
  const sombra = svg.querySelector(`#${uid}-sombra`);
  const textos = [...svg.querySelectorAll('textPath')];

  let raioAtual = 0, angulo = 0, vel = 0, ultimo = 0, raf = 0, visivel = false;
  let ultimoScroll = scrollY, impulso = 0, emCima = false;

  function montarCaminho(Rr) {
    // circulo como dois arcos: textPath precisa de um path, nao de <circle>
    caminho.setAttribute('d', `M ${-Rr} 0 A ${Rr} ${Rr} 0 1 1 ${Rr} 0 A ${Rr} ${Rr} 0 1 1 ${-Rr} 0`);
    const volta = 2 * Math.PI * Rr;
    // repete a frase ate fechar a volta e estica o espacamento para casar
    // exatamente: sem emenda visivel quando o anel gira
    const tam = 11 * .62 + 11 * .32;          // largura media por caractere (px)
    const vezes = Math.max(1, Math.round(volta / (frase.length * tam)));
    const txt = frase.repeat(vezes);
    for (const t of textos) {
      t.textContent = txt;
      t.setAttribute('textLength', volta.toFixed(1));
      t.setAttribute('lengthAdjust', 'spacing');
    }
    raioAtual = Rr;
  }

  function quadro(agora) {
    const dt = ultimo ? Math.min(.1, (agora - ultimo) / 1000) : 0;
    ultimo = agora;
    const c = buraco.centro();
    if (c.r > 0) {
      const Rr = Math.round(c.r * RAIO);
      if (Math.abs(Rr - raioAtual) > 2) montarCaminho(Rr);
      base.setAttribute('transform', `translate(${c.x.toFixed(1)} ${c.y.toFixed(1)}) rotate(${TOMBO}) scale(1 ${ACHATA})`);
      // a sombra, vista dentro do espaco achatado, e uma elipse alta
      sombra.setAttribute('rx', (c.r * 1.03).toFixed(1));
      sombra.setAttribute('ry', (c.r * 1.03 / ACHATA).toFixed(1));
    }
    const alvo = (reduz ? 0 : GIRO) * (emCima ? .25 : 1) - impulso;
    vel += (alvo - vel) * (1 - Math.pow(.02, dt));
    impulso *= Math.pow(.08, dt);
    angulo += vel * dt;
    for (const g of giros) g.setAttribute('transform', `rotate(${angulo.toFixed(2)})`);
    raf = visivel ? requestAnimationFrame(quadro) : 0;
    if (!raf) ultimo = 0;
  }

  const aoRolar = () => {
    const d = scrollY - ultimoScroll; ultimoScroll = scrollY;
    // rolar empurra o anel (limitado para nao virar helice)
    impulso = Math.max(-140, Math.min(140, impulso + d * .6));
  };
  const aoMover = (e) => {
    const c = buraco.centro(), r = secao.getBoundingClientRect();
    if (!c.r) return;
    // distancia do ponteiro ao anel, no espaco achatado
    const x = e.clientX - r.left - c.x, y = (e.clientY - r.top - c.y) / ACHATA;
    const d = Math.hypot(x, y) / (c.r * RAIO);
    emCima = d > .82 && d < 1.18;
  };
  const io = new IntersectionObserver((es) => {
    const e = es[es.length - 1];   // a mais recente: com rolagem rapida vem mais de uma
    visivel = e.isIntersecting;
    if (visivel && !raf) raf = requestAnimationFrame(quadro);
  });
  io.observe(secao);
  addEventListener('scroll', aoRolar, { passive: true });
  secao.addEventListener('pointermove', aoMover, { passive: true });

  return {
    destruir() {
      cancelAnimationFrame(raf); io.disconnect();
      removeEventListener('scroll', aoRolar);
      secao.removeEventListener('pointermove', aoMover);
      svg.remove();
    }
  };
}
