/**
 * Roda de projetos (Works Wheel) no cabecalho de Projetos.
 *
 * As capas giram num anel 3D em volta do titulo. O giro soma tres coisas:
 * o scroll pela secao, um deslize lento que nunca para, e o arrasto do
 * mouse/dedo com inercia. Clicar numa capa leva ao capitulo.
 *
 * Nada de dado novo: nome e telas vem dos proprios capitulos (h3 e as
 * screenshots reais). Cada projeto entra com duas telas; a segunda copia e
 * decorativa (aria-hidden, fora do Tab), para a roda nao ficar rala com 4.
 *
 * As capas sao "outdoors": sempre de frente para a camera. A projecao e feita
 * aqui (escala = P / (P - z)) e aplicada como transform 2D, de proposito: com
 * perspective/preserve-3d o anel vira um contexto de empilhamento so, e a capa
 * nao conseguiria passar ora por tras, ora pela frente do titulo. Em 2D o
 * z-index de cada capa disputa direto com o do texto.
 */
const P = 1400;             // distancia da camera, px

const DESLIZE = 5;         // graus por segundo, parado
const GIRO_SCROLL = 150;   // graus ao atravessar a secao inteira

export function montarRodaProjetos(cabecalho) {
  const capitulos = [...document.querySelectorAll('.project-chapter[id]')];
  if (capitulos.length < 2) return null;

  const itens = [];
  for (const rodada of [0, 1]) {
    for (const cap of capitulos) {
      // o h3 pode ter <br> ("WSL<br>Games"): troca por espaco antes de ler
      const h3 = cap.querySelector('h3');
      const nome = (h3 ? [...h3.childNodes].map((n) => n.nodeName === 'BR' ? ' ' : n.textContent).join('') : cap.dataset.project || '').replace(/\s+/g, ' ').trim();
      const imgs = [...cap.querySelectorAll('.real-shot img, img')].map((i) => i.getAttribute('src')).filter(Boolean);
      const chave = cap.dataset.project;
      const src = imgs[rodada] || imgs[0] || `/assets/projects/${chave}-${rodada + 1}.webp`;
      itens.push({ nome, src, alvo: cap.id, decorativo: rodada === 1 });
    }
  }

  const raiz = document.createElement('div');
  raiz.className = 'roda-projetos';
  const anel = document.createElement('div');
  anel.className = 'roda-anel';
  raiz.appendChild(anel);

  const cards = itens.map((it) => {
    const a = document.createElement('a');
    a.className = 'roda-card';
    a.href = '#' + it.alvo;
    a.draggable = false;
    if (it.decorativo) { a.setAttribute('aria-hidden', 'true'); a.tabIndex = -1; }
    else a.setAttribute('aria-label', `Ir para o projeto ${it.nome}`);
    const img = document.createElement('img');
    img.src = it.src; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.draggable = false;
    const nome = document.createElement('span');
    nome.textContent = it.nome;
    a.append(img, nome);
    a.addEventListener('click', (e) => {
      if (arrastou) { e.preventDefault(); return; }
      e.preventDefault();
      document.getElementById(it.alvo)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    anel.appendChild(a);
    return a;
  });
  cabecalho.prepend(raiz);
  cabecalho.classList.add('tem-roda');

  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let giroLivre = 0, vel = 0, arrastando = false, arrastou = false, ultimoX = 0, inicioX = 0;
  let raf = 0, visivel = false, ultimo = 0;

  function progressoScroll() {
    const r = cabecalho.getBoundingClientRect();
    return (innerHeight - r.top) / (innerHeight + r.height);   // 0 entrando, 1 saindo
  }

  function posicionar() {
    const w = raiz.clientWidth, h = raiz.clientHeight;
    const celular = innerWidth <= 900;
    const R = Math.min(w * (celular ? .40 : .34), 600);
    const inclina = celular ? .18 : .16;      // achatamento vertical do anel
    const base = progressoScroll() * GIRO_SCROLL + giroLivre;
    const n = cards.length;
    for (let i = 0; i < n; i++) {
      const a = ((i / n) * 360 + base) * Math.PI / 180;
      const x = Math.sin(a) * R, z = Math.cos(a) * R;
      const y = z * inclina;                   // frente mais baixa: passa por baixo do titulo
      const prof = (z / R + 1) / 2;            // 0 = fundo, 1 = frente
      const c = cards[i];
      const k = P / (P - z);
      c.style.transform = `translate(-50%,-50%) translate(${(x * k).toFixed(1)}px,${(y * k).toFixed(1)}px) scale(${k.toFixed(3)})`;
      c.style.opacity = (.16 + prof * .84).toFixed(3);
      c.style.filter = `brightness(${(.45 + prof * .55).toFixed(3)})`;
      // fundo por tras do titulo (z-index 2 do texto), frente por cima
      c.style.zIndex = prof > .72 ? '3' : '1';
      c.classList.toggle('na-frente', prof > .72);
    }
    void h;
  }

  function quadro(agora) {
    const dt = ultimo ? Math.min(.1, (agora - ultimo) / 1000) : 0;
    ultimo = agora;
    if (!arrastando) {
      giroLivre += (reduz ? 0 : DESLIZE) * dt + vel * dt;
      vel *= Math.pow(.04, dt);               // inercia: perde ~96% por segundo
      if (Math.abs(vel) < .5) vel = 0;
    }
    posicionar();
    raf = visivel && !reduz ? requestAnimationFrame(quadro) : 0;
    if (!raf) ultimo = 0;
  }
  const acordar = () => { if (!raf) raf = requestAnimationFrame(quadro); };

  // arrasto: horizontal gira a roda; soltar deixa a velocidade correr
  raiz.addEventListener('pointerdown', (e) => {
    arrastando = true; arrastou = false; ultimoX = inicioX = e.clientX; vel = 0;
    raiz.setPointerCapture(e.pointerId);
    raiz.classList.add('arrastando');
  });
  raiz.addEventListener('pointermove', (e) => {
    if (!arrastando) return;
    const dx = e.clientX - ultimoX; ultimoX = e.clientX;
    if (Math.abs(e.clientX - inicioX) > 6) arrastou = true;
    giroLivre += dx * .35;
    vel = dx * .35 * 60;                      // graus/s aproximados do ultimo movimento
    posicionar();
  });
  const soltar = () => {
    if (!arrastando) return;
    arrastando = false; raiz.classList.remove('arrastando');
    // o click que vem logo depois do arrasto nao deve navegar
    setTimeout(() => { arrastou = false; }, 0);
    acordar();
  };
  raiz.addEventListener('pointerup', soltar);
  raiz.addEventListener('pointercancel', soltar);

  const io = new IntersectionObserver((es) => {
    const e = es[es.length - 1];   // a mais recente: com rolagem rapida vem mais de uma
    visivel = e.isIntersecting;
    if (visivel) acordar();
  }, { rootMargin: '100px' });
  io.observe(cabecalho);
  const aoRolar = () => { if (reduz && visivel) posicionar(); };
  addEventListener('scroll', aoRolar, { passive: true });
  addEventListener('resize', posicionar, { passive: true });
  posicionar();

  return {
    destruir() {
      cancelAnimationFrame(raf); io.disconnect();
      removeEventListener('scroll', aoRolar);
      removeEventListener('resize', posicionar);
      raiz.remove(); cabecalho.classList.remove('tem-roda');
    }
  };
}
