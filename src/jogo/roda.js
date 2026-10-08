/**
 * Roda de armas (estilo GTA): segurando TAB, uma roda com as armas em volta
 * do centro; o mouse (ou o dedo) aponta a fatia e, soltando o TAB, equipa.
 * Cada fatia mostra o FORMATO da arma (silhueta desenhada em vetor, a mesma
 * forma do modelo 3D) e o centro mostra nome, descricao e barras de dano,
 * cadencia e alcance.
 */
const TAU = Math.PI * 2;

// silhuetas (desenhadas num quadro de -1..1, cano para a direita)
function silhueta(c, id) {
  c.beginPath();
  const R = (x, y, w, h, r = .04) => { c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); };
  switch (id) {
    case null: case 'mao': {
      // mao aberta
      c.ellipse(-.05, .2, .32, .3, 0, 0, TAU);
      [[-.32, -.25, .42], [-.14, -.35, .5], [.04, -.33, .48], [.2, -.24, .4]].forEach(([x, y, h]) => R(x, y - h + .25, .13, h, .06));
      R(.22, .05, .32, .12, .06);
      break;
    }
    case 'espada':
      // espada de energia deitada: cabo, guarda e a lamina comprida
      R(-.85, -.05, .3, .1, .03); R(-.56, -.16, .06, .32, .02); R(-.5, -.035, 1.3, .07, .035);
      break;
    case 'blaster':
      R(-.55, -.18, .85, .26, .06); R(.3, -.12, .4, .12, .03); R(-.45, .05, .2, .42, .05); R(-.2, .06, .18, .08, .02);
      break;
    case 'rifle':
      R(-.85, -.12, .3, .22, .04); R(-.6, -.16, 1, .26, .05); R(.4, -.1, .5, .1, .02); R(-.3, .08, .16, .36, .05); R(-.05, .08, .16, .26, .04); R(-.2, -.3, .4, .1, .03);
      break;
    case 'canhao':
      R(-.7, -.25, 1.15, .42, .18); R(.4, -.3, .25, .52, .08); R(-.35, .14, .2, .36, .06); R(-.45, -.42, .5, .14, .05);
      break;
    case 'laser':
      // nave vista de cima com dois lasers saindo das asas
      c.moveTo(-.7, 0); c.lineTo(.5, -.08); c.lineTo(.5, .08); c.closePath();
      c.moveTo(-.4, -.05); c.lineTo(.1, -.5); c.lineTo(.25, -.45); c.lineTo(0, -.05); c.closePath();
      c.moveTo(-.4, .05); c.lineTo(.1, .5); c.lineTo(.25, .45); c.lineTo(0, .05); c.closePath();
      R(.3, -.5, .6, .05, .02); R(.3, .45, .6, .05, .02);
      break;
    case 'plasma':
      R(-.75, -.16, .9, .32, .08); for (let k = 0; k < 4; k++) R(.15, -.15 + k * .09, .7, .05, .02); R(-.55, .16, .4, .14, .04);
      break;
    case 'missil':
      c.moveTo(.8, 0); c.lineTo(.5, -.12); c.lineTo(-.55, -.12); c.lineTo(-.55, .12); c.lineTo(.5, .12); c.closePath();
      c.moveTo(-.55, -.12); c.lineTo(-.8, -.32); c.lineTo(-.7, -.12); c.closePath();
      c.moveTo(-.55, .12); c.lineTo(-.8, .32); c.lineTo(-.7, .12); c.closePath();
      break;
    case 'ions':
      c.arc(.25, 0, .38, 0, TAU); c.moveTo(-.1, 0); R(-.85, -.14, .75, .28, .08);
      break;
  }
}

/** desenha a silhueta de uma arma centrada em (cx, cy), tamanho s */
export function desenharSilhueta(c, id, cx, cy, s, cor = '#e9e2ff', brilho = 'rgba(124,77,255,.7)') {
  c.save(); c.translate(cx, cy); c.scale(s, s); silhueta(c, id ?? 'mao');
  c.fillStyle = cor; c.shadowColor = brilho; c.shadowBlur = 10; c.fill(); c.restore();
}

export function criarRoda(canvas) {
  const c = canvas.getContext('2d');
  let lista = [], sel = 0, aberta = false, mx = 0, my = 0, aberturaT = 0;
  const W = () => innerWidth, H = () => innerHeight;
  function escolherPorVetor(x, y) {
    if (Math.hypot(x, y) < 40) return;   // perto do centro: mantem
    const a = (Math.atan2(y, x) + Math.PI / 2 + TAU) % TAU, n = lista.length;
    sel = Math.floor(((a + Math.PI / n) % TAU) / (TAU / n)) % n;
  }
  return {
    get aberta() { return aberta; },
    get selecionada() { return sel; },
    abrir(l, atual) { lista = l; sel = atual; aberta = true; mx = my = 0; aberturaT = 0; canvas.classList.add('on'); },
    fechar() { aberta = false; canvas.classList.remove('on'); return sel; },
    /** mouse preso: o movimento empurra um "ponteiro virtual" a partir do centro */
    mover(dx, dy) { mx += dx; my += dy; const d = Math.hypot(mx, my), lim = 160; if (d > lim) { mx *= lim / d; my *= lim / d; } escolherPorVetor(mx, my); },
    /** mouse solto / toque: posicao na tela; devolve o indice se caiu numa fatia */
    apontar(x, y) { escolherPorVetor(x - W() / 2, y - H() / 2); return sel; },
    desenhar(dt) {
      if (!aberta) return;
      aberturaT = Math.min(1, aberturaT + dt * 7);
      const pr = Math.min(2, devicePixelRatio || 1), w = W(), h = H();
      if (canvas.width !== Math.round(w * pr)) { canvas.width = Math.round(w * pr); canvas.height = Math.round(h * pr); }
      c.setTransform(pr, 0, 0, pr, 0, 0); c.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, esc = .85 + aberturaT * .15;
      const R1 = Math.min(w, h) * .14 * esc, R2 = Math.min(w, h) * .36 * esc, n = lista.length;
      c.globalAlpha = aberturaT;
      for (let i = 0; i < n; i++) {
        const a0 = -Math.PI / 2 + (i - .5) * TAU / n + .02, a1 = -Math.PI / 2 + (i + .5) * TAU / n - .02, on = i === sel;
        // fatia
        c.beginPath(); c.arc(cx, cy, R2, a0, a1); c.arc(cx, cy, R1, a1, a0, true); c.closePath();
        const g = c.createRadialGradient(cx, cy, R1, cx, cy, R2);
        g.addColorStop(0, on ? 'rgba(43,255,143,.28)' : 'rgba(20,14,40,.72)'); g.addColorStop(1, on ? 'rgba(43,255,143,.12)' : 'rgba(10,8,20,.82)');
        c.fillStyle = g; c.fill();
        c.lineWidth = on ? 3 : 1.5; c.strokeStyle = on ? '#2bff8f' : 'rgba(169,139,255,.35)'; c.stroke();
        // silhueta da arma
        const am = (a0 + a1) / 2, rm = (R1 + R2) / 2, px = cx + Math.cos(am) * rm, py = cy + Math.sin(am) * rm, s = (R2 - R1) * .36;
        c.save(); c.translate(px, py - 8); c.scale(s, s);
        silhueta(c, lista[i].id ?? 'mao');
        c.fillStyle = on ? '#eafff3' : 'rgba(228,220,255,.85)'; c.shadowColor = on ? '#2bff8f' : 'rgba(124,77,255,.7)'; c.shadowBlur = 14; c.fill();
        c.restore();
        c.font = `${on ? 800 : 600} 12px ui-monospace, Menlo, monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = on ? '#2bff8f' : 'rgba(228,220,255,.7)'; c.fillText(lista[i].nome, px, py + s * .75 + 8);
        c.fillStyle = 'rgba(228,220,255,.4)'; c.font = '700 10px ui-monospace, Menlo, monospace'; c.fillText(String(i + 1), px, py - s * .9 - 8);
      }
      // centro: a arma escolhida
      const a = lista[sel];
      c.beginPath(); c.arc(cx, cy, R1 - 8, 0, TAU); c.fillStyle = 'rgba(8,6,16,.88)'; c.fill(); c.strokeStyle = 'rgba(43,255,143,.5)'; c.lineWidth = 1.5; c.stroke();
      c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = '800 15px ui-monospace, Menlo, monospace'; c.fillText(a.nome, cx, cy - R1 * .45);
      c.fillStyle = 'rgba(228,220,255,.6)'; c.font = '500 10px ui-monospace, Menlo, monospace'; c.fillText(a.desc, cx, cy - R1 * .45 + 18);
      const barras = [['DANO', a.st?.[0] ?? 0], ['CADÊNCIA', a.st?.[1] ?? 0], ['ALCANCE', a.st?.[2] ?? 0]];
      barras.forEach(([nome, v], k) => {
        const y = cy - R1 * .05 + k * 18, bw = R1 * 1.05, x0 = cx - bw / 2;
        c.textAlign = 'left'; c.fillStyle = 'rgba(228,220,255,.5)'; c.font = '700 8px ui-monospace, Menlo, monospace'; c.fillText(nome, x0, y - 5);
        c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(x0, y, bw, 5); c.fillStyle = '#2bff8f'; c.fillRect(x0, y, bw * v, 5);
      });
      // dica
      c.textAlign = 'center'; c.fillStyle = 'rgba(228,220,255,.55)'; c.font = '600 11px ui-monospace, Menlo, monospace';
      c.fillText('mova o mouse para escolher · solte o I (ou clique) para equipar', cx, cy + R2 + 26);
      c.globalAlpha = 1;
    }
  };
}
