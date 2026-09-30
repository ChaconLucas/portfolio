/**
 * Nome gigante no fim da pagina (Hover Footer).
 *
 * Duas camadas do mesmo texto: o contorno fino, sempre la, e o preenchimento
 * em gradiente, revelado por uma mascara radial que segue o ponteiro com
 * atraso. Sem mouse, o foco passeia sozinho (CSS).
 *
 * E decorativo (aria-hidden): o nome ja esta no header e no titulo.
 */

export function montarRodape(secao) {
  const nome = document.createElement('div');
  nome.className = 'rodape-nome';
  nome.setAttribute('aria-hidden', 'true');
  nome.innerHTML = '<span class="rodape-contorno">LUCAS CHACON</span><span class="rodape-cheio">LUCAS CHACON</span>';
  secao.appendChild(nome);
  secao.classList.add('tem-rodape');

  // Cabe na largura: mede com um tamanho de referencia e escala. vw puro nao
  // serve, porque a largura da palavra depende da fonte que o sistema usar.
  const ajustar = () => {
    const ref = 100;
    secao.style.setProperty('--rodape-fs', ref + 'px');
    const w = nome.querySelector('.rodape-contorno').getBoundingClientRect().width;
    if (w) secao.style.setProperty('--rodape-fs', (ref * (innerWidth * .94) / w).toFixed(1) + 'px');
  };
  ajustar();
  addEventListener('resize', ajustar, { passive: true });
  if (document.fonts) document.fonts.ready.then(ajustar);

  const mouse = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!mouse || reduz) { nome.classList.add('sozinho'); return; }

  let alvoX = -999, alvoY = -999, x = -999, y = -999, raf = 0, ultimo = 0;
  function quadro(agora) {
    const dt = ultimo ? Math.min(.1, (agora - ultimo) / 1000) : .016;
    ultimo = agora;
    const k = 1 - Math.pow(.0005, dt);         // ~ segue em 150ms
    x += (alvoX - x) * k; y += (alvoY - y) * k;
    nome.style.setProperty('--fx', x.toFixed(1) + 'px');
    nome.style.setProperty('--fy', y.toFixed(1) + 'px');
    const parado = Math.abs(alvoX - x) < .3 && Math.abs(alvoY - y) < .3;
    raf = parado ? 0 : requestAnimationFrame(quadro);
    if (!raf) ultimo = 0;
  }
  nome.addEventListener('pointermove', (e) => {
    const r = nome.getBoundingClientRect();
    alvoX = e.clientX - r.left; alvoY = e.clientY - r.top;
    if (x < -900) { x = alvoX; y = alvoY; }
    nome.classList.add('aceso');
    if (!raf) raf = requestAnimationFrame(quadro);
  });
  nome.addEventListener('pointerleave', () => nome.classList.remove('aceso'));
}
