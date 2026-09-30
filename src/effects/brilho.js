/**
 * Borda que acende perto do cursor (Glowing Effect).
 *
 * Um ouvinte so para a pagina: a cada quadro com movimento, os cards visiveis
 * recebem a posicao do ponteiro em coordenadas proprias (--gx/--gy) e uma
 * proximidade 0..1 (--gp). O CSS desenha o anel com isso.
 *
 * O anel e um <span class="brilho"> injetado na primeira vez que o ponteiro
 * chega perto: os cards do Arquivo Tecnico sao recriados a cada troca de
 * dominio, entao qualquer coisa montada no load se perderia.
 */

const ALVOS = '.stack-tech, .stack-mini-case, .contact-actions a.contact-cta';
const ALCANCE = 140;   // px fora do card em que o brilho ja comeca

export function montarBrilho() {
  let mx = -1e4, my = -1e4, pendente = false;

  function atualizar() {
    pendente = false;
    for (const el of document.querySelectorAll(ALVOS)) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -ALCANCE || r.top > innerHeight + ALCANCE) continue;
      // distancia do ponteiro ate a borda do retangulo (0 dentro)
      const dx = Math.max(r.left - mx, 0, mx - r.right);
      const dy = Math.max(r.top - my, 0, my - r.bottom);
      const perto = Math.max(0, 1 - Math.hypot(dx, dy) / ALCANCE);
      if (perto <= 0 && !el.__brilho) continue;
      if (!el.__brilho) {
        const s = document.createElement('span');
        s.className = 'brilho';
        s.setAttribute('aria-hidden', 'true');
        el.appendChild(s);
        el.__brilho = s;
        el.classList.add('tem-brilho');
      }
      el.style.setProperty('--gx', (mx - r.left).toFixed(0) + 'px');
      el.style.setProperty('--gy', (my - r.top).toFixed(0) + 'px');
      el.style.setProperty('--gp', perto.toFixed(3));
    }
  }

  const aoMover = (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    mx = e.clientX; my = e.clientY;
    if (!pendente) { pendente = true; requestAnimationFrame(atualizar); }
  };
  const aoSair = () => { mx = my = -1e4; if (!pendente) { pendente = true; requestAnimationFrame(atualizar); } };
  addEventListener('pointermove', aoMover, { passive: true });
  // rolar muda a posicao dos cards sob um ponteiro parado
  addEventListener('scroll', () => { if (mx > -1e4 && !pendente) { pendente = true; requestAnimationFrame(atualizar); } }, { passive: true });
  document.documentElement.addEventListener('pointerleave', aoSair);
}
