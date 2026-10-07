/**
 * Mapa em tela cheia (tecla M / botao no toque). Visto de cima:
 *  - no espaco: sol, orbitas, os 9 planetas (com o progresso de cada um),
 *    o cinturao, os campos de asteroides, os buracos negros e a nave;
 *  - na superficie: os locais de cada tecnologia (verde = visitado), a
 *    plataforma central, a nave e o astronauta.
 * Interativo: d.vista = { zoom, ox, oz } (centro do mapa no mundo). Devolve
 * os pontos clicaveis ja na tela (alvos) e a conversao tela -> mundo, para o
 * jogo marcar o destino. d.destino (se houver) aparece pulsando.
 */
export function desenharMapa(c, W, H, d, t = 0) {
  c.clearRect(0, 0, W, H);
  const v = d.vista || { zoom: 1, ox: 0, oz: 0 };
  const esc = Math.min(W, H) * .44 / d.limite * v.zoom;
  const cx = W / 2 - v.ox * esc, cy = H / 2 + 10 - v.oz * esc;
  const P = (x, z) => [cx + x * esc, cy + z * esc];
  const alvos = [];
  const alvo = (x, z, nome, tipo, extra = {}) => { const [sx, sy] = P(x, z); alvos.push({ x, z, sx, sy, nome, tipo, ...extra }); return [sx, sy]; };
  // grade (acompanha o zoom)
  const passo = d.limite / 5 / Math.pow(2, Math.floor(Math.log2(v.zoom)));
  c.strokeStyle = 'rgba(169,139,255,.08)'; c.lineWidth = 1;
  const x0 = Math.floor((v.ox - W / 2 / esc) / passo) * passo, x1 = v.ox + W / 2 / esc, z0 = Math.floor((v.oz - H / 2 / esc) / passo) * passo, z1 = v.oz + H / 2 / esc;
  for (let g = x0; g <= x1; g += passo) { c.beginPath(); c.moveTo(...P(g, z0)); c.lineTo(...P(g, z1 + passo)); c.stroke(); }
  for (let g = z0; g <= z1 + passo; g += passo) { c.beginPath(); c.moveTo(...P(x0, g)); c.lineTo(...P(x1 + passo, g)); c.stroke(); }
  c.strokeStyle = 'rgba(169,139,255,.3)'; c.setLineDash([6, 6]);
  if (d.modo === 'espaco') { c.beginPath(); c.ellipse(cx, cy, d.limite * esc, d.limite * esc, 0, 0, Math.PI * 2); c.stroke(); }
  else { const [a, b] = P(-d.limite, -d.limite); c.strokeRect(a, b, d.limite * 2 * esc, d.limite * 2 * esc); }
  c.setLineDash([]);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const rotulo = (txt, x, y, cor, peso = 700, tam = 12) => {
    c.font = `${peso} ${tam}px ui-monospace, Menlo, monospace`;
    const w = c.measureText(txt).width + 12;
    c.fillStyle = 'rgba(8,6,16,.75)'; c.fillRect(x - w / 2, y - 9, w, 18);
    c.fillStyle = cor; c.fillText(txt, x, y);
  };

  if (d.modo === 'espaco') {
    c.strokeStyle = 'rgba(115,80,199,.35)';
    d.planetas.forEach((p) => { c.beginPath(); c.ellipse(cx, cy, p.orbita * esc, p.orbita * .55 * esc, 0, 0, Math.PI * 2); c.stroke(); });
    c.strokeStyle = 'rgba(150,140,180,.25)'; c.lineWidth = d.cinturao.largura * esc;
    c.beginPath(); c.ellipse(cx, cy, d.cinturao.raio * esc, d.cinturao.raio * .55 * esc, 0, 0, Math.PI * 2); c.stroke(); c.lineWidth = 1;
    d.campos.forEach((f) => {
      const [x, y] = alvo(f.x, f.z, 'campo de asteroides', 'campo');
      c.fillStyle = 'rgba(160,150,190,.18)'; c.beginPath(); c.arc(x, y, f.r * esc, 0, Math.PI * 2); c.fill();
      for (let i = 0; i < 7; i++) { c.fillStyle = 'rgba(190,180,220,.6)'; c.beginPath(); c.arc(x + Math.cos(i * 2.4) * f.r * esc * .6, y + Math.sin(i * 1.7) * f.r * esc * .6, 2, 0, Math.PI * 2); c.fill(); }
      rotulo('asteroides', x, y + f.r * esc + 12, 'rgba(200,190,230,.8)', 500, 10);
    });
    { const [x, y] = alvo(0, 0, 'Sol', 'sol'); const r = Math.max(4, d.sol.r * esc * 2.2); const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, '#fff'); g.addColorStop(.4, '#d39bff'); g.addColorStop(1, 'rgba(124,77,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
    d.buracos.forEach((b) => {
      const [x, y] = alvo(b.x, b.z, 'buraco negro', 'buraco');
      c.fillStyle = '#000'; c.strokeStyle = '#ff9a4d'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); c.fill(); c.stroke(); c.lineWidth = 1;
      rotulo('buraco negro', x, y + 20, '#ffb37a', 500, 10);
    });
    d.planetas.forEach((p) => {
      const r = Math.max(6, p.r * esc), [x, y] = alvo(p.x, p.z, p.nome, 'planeta', { key: p.key, raio: r });
      c.fillStyle = `hsl(${p.cor},55%,62%)`; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      if (p.completo) { c.strokeStyle = '#2bff8f'; c.lineWidth = 3; c.stroke(); c.lineWidth = 1; }
      rotulo(`${p.nome}${p.tot ? ` ${p.n}/${p.tot}` : ''}`, x, y - r - 13, p.completo ? '#2bff8f' : `hsl(${p.cor},90%,78%)`);
    });
  } else {
    { const [x, y] = alvo(0, 0, 'plataforma', 'plataforma'); c.strokeStyle = '#ffd36b'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 8, 0, Math.PI * 2); c.stroke(); c.lineWidth = 1; rotulo('plataforma', x, y + 20, '#ffd36b', 500, 10); }
    d.predios.forEach((p) => {
      const [x, y] = alvo(p.x, p.z, p.nome, 'predio');
      c.fillStyle = p.visto ? '#2bff8f' : d.cor; c.shadowColor = c.fillStyle; c.shadowBlur = 12;
      c.beginPath(); c.moveTo(x, y - 9); c.lineTo(x + 8, y); c.lineTo(x, y + 9); c.lineTo(x - 8, y); c.closePath(); c.fill(); c.shadowBlur = 0;
      rotulo((p.visto ? '✓ ' : '') + p.nome, x, y - 20, p.visto ? '#2bff8f' : '#fff');
    });
  }
  // destino marcado: alvo pulsando + linha tracejada desde a nave
  if (d.destino) {
    const [x, y] = P(d.destino.x, d.destino.z), pul = 1 + Math.sin(t * 5) * .25;
    if (d.nave) { const [nx, ny] = P(d.nave.x, d.nave.z); c.strokeStyle = 'rgba(43,255,143,.55)'; c.setLineDash([5, 7]); c.lineWidth = 2; c.beginPath(); c.moveTo(nx, ny); c.lineTo(x, y); c.stroke(); c.setLineDash([]); }
    c.strokeStyle = '#2bff8f'; c.lineWidth = 2.5; c.beginPath(); c.arc(x, y, 14 * pul, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(x - 20, y); c.lineTo(x - 8, y); c.moveTo(x + 8, y); c.lineTo(x + 20, y); c.moveTo(x, y - 20); c.lineTo(x, y - 8); c.moveTo(x, y + 8); c.lineTo(x, y + 20); c.stroke(); c.lineWidth = 1;
    rotulo('◎ ' + d.destino.nome, x, y + 30, '#2bff8f');
  }
  // nave e astronauta (setas) — clicaveis tambem (achar a nave estando a pe)
  const seta = (o, cor, tam) => {
    const [x, y] = P(o.x, o.z); c.save(); c.translate(x, y); c.rotate(-o.rumo + Math.PI);
    c.fillStyle = cor; c.shadowColor = cor; c.shadowBlur = 14;
    c.beginPath(); c.moveTo(0, -tam); c.lineTo(tam * .7, tam * .8); c.lineTo(0, tam * .4); c.lineTo(-tam * .7, tam * .8); c.closePath(); c.fill(); c.restore();
  };
  if (d.nave) { seta(d.nave, '#4fd2ff', 11); if (d.pe) alvo(d.nave.x, d.nave.z, 'sua nave', 'nave'); }
  if (d.pe) seta(d.pe, '#fff', 8);
  // titulo e instrucoes
  c.textAlign = 'left'; c.font = '800 14px ui-monospace, Menlo, monospace'; c.fillStyle = '#c7b4ff';
  c.fillText(d.titulo, 24, 70);
  c.font = '500 11px ui-monospace, Menlo, monospace'; c.fillStyle = 'rgba(228,220,255,.6)';
  c.fillText(d.legenda, 24, 90);
  c.fillText('arraste para mover · rodinha/pinça = zoom · clique num ponto para marcar o destino · M fecha', 24, 108);
  return { alvos, paraMundo: (sx, sy) => ({ x: (sx - cx) / esc, z: (sy - cy) / esc }) };
}
