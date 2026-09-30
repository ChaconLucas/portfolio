/**
 * Numeros que rolam (Number Flow).
 *
 * So numeros que JA estao no site, nada inventado:
 *  - indice do Arquivo Tecnico ("01 / 09") e o numero grande da orbita, que
 *    renderStack() reescreve a cada troca de dominio;
 *  - os contadores dos capitulos ("01 / 04"), que rolam a partir de zero na
 *    primeira vez que aparecem.
 *
 * Quem escreve o texto continua sendo o codigo antigo (textContent). Um
 * MutationObserver ve a troca e redesenha o mesmo texto como colunas de
 * digitos que rolam do valor anterior para o novo. Leitor de tela recebe o
 * texto final inteiro (.nf-sr); as colunas sao aria-hidden.
 */

const TROCAM = '.stack-domain-index, .vault-orbit-art b';
const ENTRAM = '.chapter-count';

export function montarNumeros() {
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduz) return;
  const anterior = new WeakMap();
  let escrevendo = false;

  function desenhar(el, de, para) {
    escrevendo = true;
    el.textContent = '';
    const sr = document.createElement('span');
    sr.className = 'nf-sr';
    sr.textContent = para;
    el.appendChild(sr);
    const vis = document.createElement('span');
    vis.className = 'nf';
    vis.setAttribute('aria-hidden', 'true');
    // alinha pela direita: "9" -> "10" rola a coluna das unidades com a das unidades
    const pad = Math.max(0, para.length - de.length);
    const deAlinhado = ' '.repeat(pad) + de;
    const fitas = [];
    [...para].forEach((ch, i) => {
      if (!/\d/.test(ch)) { vis.appendChild(document.createTextNode(ch)); return; }
      const col = document.createElement('span');
      col.className = 'nf-col';
      const fita = document.createElement('span');
      fita.className = 'nf-fita';
      fita.textContent = '0123456789';
      col.appendChild(fita);
      vis.appendChild(col);
      const velho = /\d/.test(deAlinhado[i] || '') ? +deAlinhado[i] : 0;
      fita.style.transform = `translateY(${-velho * 10}%)`;
      // colunas da esquerda rolam um tiquinho depois: le como um contador
      fita.style.transitionDelay = (i * 45) + 'ms';
      fitas.push([fita, +ch]);
    });
    el.appendChild(vis);
    // proximo quadro: vai para o valor novo, com a transicao do CSS
    requestAnimationFrame(() => requestAnimationFrame(() => {
      for (const [f, n] of fitas) f.style.transform = `translateY(${-n * 10}%)`;
    }));
    anterior.set(el, para);
    escrevendo = false;
  }

  // Troca feita por outro codigo: rola do valor que estava para o novo
  const mo = new MutationObserver((mut) => {
    if (escrevendo) return;
    const vistos = new Set();
    for (const m of mut) {
      const el = (m.target.nodeType === 3 ? m.target.parentElement : m.target).closest(TROCAM);
      if (!el || vistos.has(el)) continue;
      vistos.add(el);
      if (el.querySelector(':scope > .nf')) continue;         // e o nosso desenho
      const novo = el.textContent.trim();
      const velho = anterior.get(el) ?? novo;
      if (novo && novo !== velho) desenhar(el, velho, novo);
      else anterior.set(el, novo);
    }
  });
  const observar = () => {
    document.querySelectorAll(TROCAM).forEach((el) => {
      if (!anterior.has(el)) anterior.set(el, el.textContent.trim());
      mo.observe(el, { childList: true, characterData: true, subtree: true });
    });
  };
  observar();

  // Contadores de capitulo: rolam de zero, uma vez, ao aparecer
  const io = new IntersectionObserver((ents) => {
    for (const e of ents) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const txt = e.target.textContent.trim();
      desenhar(e.target, txt.replace(/\d/g, '0'), txt);
    }
  }, { threshold: .6 });
  document.querySelectorAll(ENTRAM).forEach((el) => io.observe(el));
}
