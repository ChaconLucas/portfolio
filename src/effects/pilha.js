/**
 * Cargos empilhando no celular (Stacking Cards).
 *
 * No mobile a Trajetoria e uma lista — o eixo horizontal nao cabe. Aqui cada
 * cargo gruda no topo (sticky) e o seguinte sobe por cima; o de baixo encolhe
 * e escurece conforme e coberto. E o unico movimento da secao no celular,
 * onde o scroll horizontal do desktop nao existe.
 *
 * Usa as propriedades `scale` e uma camada propria (--pilha) em vez de
 * transform/filter: o CSS antigo do mobile trava `transform:none!important`,
 * e o driver da Experience escreve `filter` todo quadro.
 */

export function montarPilha(secao) {
  const celular = matchMedia('(max-width: 900px)');
  const reduz = matchMedia('(prefers-reduced-motion: reduce)');
  const cards = [...secao.querySelectorAll('[data-exp-stop]')];
  if (cards.length < 2) return;
  cards.forEach((c, i) => c.style.setProperty('--i', i));

  let pendente = false;
  function atualizar() {
    pendente = false;
    if (!celular.matches || reduz.matches) return;
    for (let i = 0; i < cards.length - 1; i++) {
      const a = cards[i].getBoundingClientRect();
      const b = cards[i + 1].getBoundingClientRect();
      // quanto do card de baixo ja foi coberto pelo proximo (0..1)
      const p = Math.max(0, Math.min(1, (a.bottom - b.top) / a.height));
      cards[i].style.scale = (1 - p * .06).toFixed(4);
      cards[i].style.setProperty('--pilha', p.toFixed(3));
    }
  }
  const agendar = () => { if (!pendente) { pendente = true; requestAnimationFrame(atualizar); } };
  addEventListener('scroll', agendar, { passive: true });
  addEventListener('resize', agendar, { passive: true });
  celular.addEventListener('change', () => {
    if (!celular.matches) cards.forEach((c) => { c.style.scale = ''; c.style.removeProperty('--pilha'); });
    agendar();
  });
  agendar();
}
