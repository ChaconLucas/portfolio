/**
 * Globo com o Rio pulsando (Globe Pulse), no card "CARGO ATUAL" do hero.
 *
 * cobe: globo de pontos em WebGL, ~5 kB. O pulso e o proprio marcador
 * crescendo e voltando — a v2 nao tem onRender, entao o laco e nosso e so
 * roda com o hero na tela. Arrastar gira o globo; soltar, ele volta a girar
 * sozinho.
 *
 * Rio de Janeiro: -22.9068, -43.1729. O globo abre ja virado para ele.
 */
import createGlobe from 'cobe';

const RIO = [-22.9068, -43.1729];
// angulos que poem o Rio de frente para a camera (convencao do cobe,
// a mesma do locationToAngles dos exemplos dele)
const PHI_RIO = Math.PI - (RIO[1] * Math.PI / 180 - Math.PI / 2);
const THETA_RIO = RIO[0] * Math.PI / 180 * .8;   // .8: um pouco do equador aparece

export function montarGlobo(card) {
  const caixa = document.createElement('div');
  caixa.className = 'globo';
  caixa.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  caixa.appendChild(canvas);
  card.appendChild(caixa);
  card.classList.add('tem-globo');

  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  let lado = 0, globo = null;

  function criar() {
    // teto de seguranca: o lado vem do CSS (84px); se o CSS faltar, nao
    // deixa o canvas crescer atras da propria caixa
    lado = Math.min(160, Math.round(caixa.clientWidth) || 84);
    canvas.width = canvas.height = lado * dpr;
    globo?.destroy();
    globo = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: lado * dpr, height: lado * dpr,
      phi: PHI_RIO, theta: THETA_RIO,
      dark: 1, diffuse: 1.6,
      mapSamples: 14000, mapBrightness: 9, mapBaseBrightness: .04,
      baseColor: [.52, .44, .82],
      markerColor: [.95, .9, 1],
      glowColor: [.52, .38, 1],
      markers: [{ location: RIO, size: .06 }],
      markerElevation: .01,
      opacity: .92
    });
  }

  let phi = PHI_RIO, vel = 0, arrastando = false, ultimoX = 0, raf = 0, visivel = false, t0 = performance.now();

  let ultimo = 0;
  function quadro(agora) {
    const t = (agora - t0) / 1000;
    const f = ultimo ? Math.min(6, (agora - ultimo) / 16.667) : 1;   // quadros de 60 Hz passados
    ultimo = agora;
    if (!arrastando) {
      // gira devagar e, depois de um arrasto, deixa a inercia morrer —
      // por tempo, para girar igual em 60 ou 120 Hz
      phi += ((reduz ? 0 : .0035) + vel) * f;
      vel *= Math.pow(.94, f);
    }
    // pulso: cresce e volta, com um batimento a cada ~1,6s
    const b = (t % 1.6) / 1.6;
    const pulso = reduz ? .06 : .045 + .05 * Math.sin(Math.PI * Math.min(1, b * 2.2));
    globo.update({ phi, markers: [{ location: RIO, size: pulso }] });
    raf = visivel ? requestAnimationFrame(quadro) : 0;
    if (!raf) ultimo = 0;
  }

  caixa.addEventListener('pointerdown', (e) => {
    arrastando = true; ultimoX = e.clientX; vel = 0;
    caixa.setPointerCapture(e.pointerId);
    caixa.classList.add('arrastando');
  });
  caixa.addEventListener('pointermove', (e) => {
    if (!arrastando) return;
    const dx = e.clientX - ultimoX; ultimoX = e.clientX;
    phi += dx * .012; vel = dx * .012;
  });
  const soltar = () => { arrastando = false; caixa.classList.remove('arrastando'); };
  caixa.addEventListener('pointerup', soltar);
  caixa.addEventListener('pointercancel', soltar);

  const io = new IntersectionObserver((es) => {
    const e = es[es.length - 1];   // a mais recente: com rolagem rapida vem mais de uma
    visivel = e.isIntersecting;
    if (visivel && !raf) raf = requestAnimationFrame(quadro);
  });
  io.observe(caixa);
  const ro = new ResizeObserver(() => { if (Math.abs((caixa.clientWidth || 0) - lado) > 2) criar(); });
  ro.observe(caixa);
  criar();
  // entra suave, depois do primeiro quadro desenhado
  requestAnimationFrame(() => caixa.classList.add('pronto'));

  return { destruir() { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); globo?.destroy(); caixa.remove(); card.classList.remove('tem-globo'); } };
}
