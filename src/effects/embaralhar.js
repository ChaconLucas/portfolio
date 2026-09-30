/**
 * Micro-rotulos que se embaralham e resolvem (Text Scramble).
 *
 * Roda uma vez quando o rotulo aparece e de novo ao passar o mouse. Cada
 * letra fica um tempo trocando por caracteres aleatorios e trava na certa,
 * da esquerda para a direita. Espacos e separadores (/ · —) nao embaralham:
 * sao eles que dao a forma do rotulo.
 *
 * O texto de verdade NAO e tocado. Ele fica transparente e o embaralhado e
 * desenhado por cima num ::after, lido de data-embaralho. Motivo: o tradutor
 * PT/EN observa mutacao de texto em #projects e reescreveria o no a cada
 * quadro (matando a animacao e varrendo a pagina toda por quadro). Atributo
 * ele nao observa.
 */

const ALVOS = '.hero-kicker, .micro-label, .scene-index, .experience-v14-index, .experience-v14-kicker, .projects-v11-header > span, .chapter-kicker';
const GLIFOS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#<>/_*';
const FIXOS = /[\s/·—\-|.:]/;

export function montarEmbaralhar() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rodando = new WeakSet();

  function embaralhar(el) {
    if (rodando.has(el)) return;
    // lido na hora: se o idioma mudou, embaralha o texto do idioma atual
    const alvo = el.textContent.replace(/\s+/g, ' ').trim();
    if (!alvo) return;
    rodando.add(el);
    if (getComputedStyle(el).position === 'static') el.classList.add('embaralho-rel');
    el.classList.add('embaralhando');
    const passo = Math.min(28, 520 / alvo.length);      // rotulo longo nao demora mais
    const t0 = performance.now();

    function quadro(agora) {
      const dt = agora - t0;
      let s = '', fim = true;
      for (let i = 0; i < alvo.length; i++) {
        const ch = alvo[i];
        if (FIXOS.test(ch) || dt >= 120 + i * passo) s += ch;
        else { s += GLIFOS[(Math.random() * GLIFOS.length) | 0]; fim = false; }
      }
      el.dataset.embaralho = s;
      if (!fim) { requestAnimationFrame(quadro); return; }
      el.classList.remove('embaralhando');
      delete el.dataset.embaralho;
      rodando.delete(el);
    }
    requestAnimationFrame(quadro);
  }

  const io = new IntersectionObserver((ents) => {
    for (const e of ents) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      embaralhar(e.target);
    }
  }, { threshold: .8 });

  const mouse = matchMedia('(hover: hover) and (pointer: fine)').matches;
  document.querySelectorAll(ALVOS).forEach((el) => {
    io.observe(el);
    if (mouse) el.addEventListener('pointerenter', () => embaralhar(el));
  });
}
