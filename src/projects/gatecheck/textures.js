import * as THREE from 'three';

/**
 * Texturas desenhadas em canvas, em tempo de execucao.
 * Motivo: nenhum arquivo de imagem entra no bundle e nada depende de licenca —
 * a camisa e a tatuagem sao codigo, nao asset.
 */

function tela(l = 256, a = 256) {
  const c = document.createElement('canvas');
  c.width = l; c.height = a;
  return { c, ctx: c.getContext('2d') };
}

function finalizar(c, repetir = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repetir) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}

/**
 * Camisa listrada na diagonal: branca com a faixa preta atravessando o peito.
 * E o padrao do uniforme, desenhado como forma geometrica — sem escudo, sem
 * marca e sem qualquer emblema de clube.
 */
export function texturaCamisa() {
  const { c, ctx } = tela(512, 512);

  ctx.fillStyle = '#f4f4f6';
  ctx.fillRect(0, 0, 512, 512);

  // faixa preta na diagonal, do ombro esquerdo ao quadril direito
  ctx.save();
  ctx.translate(256, 256);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = '#111318';
  ctx.fillRect(-460, -76, 920, 152);
  // vivo fino de cada lado da faixa, para nao virar um bloco chapado
  ctx.fillStyle = '#2a2d36';
  ctx.fillRect(-460, -84, 920, 8);
  ctx.fillRect(-460, 76, 920, 8);
  ctx.restore();

  // sombreado suave nas laterais: tira a sensacao de adesivo plano
  const g = ctx.createLinearGradient(0, 0, 512, 0);
  g.addColorStop(0, 'rgba(0,0,0,.22)');
  g.addColorStop(0.5, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,.22)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);

  return finalizar(c);
}

/**
 * Pele tatuada: manga fechada de tracos escuros sobre o tom de pele.
 * Formas abstratas de proposito — nada figurativo, nada copiado.
 */
export function texturaTatuagem() {
  const { c, ctx } = tela(256, 256);

  ctx.fillStyle = '#d9a888';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = 'rgba(38,34,52,.55)';
  ctx.lineCap = 'round';

  // tracos no SENTIDO do membro. Desenhados na horizontal eles davam a volta na
  // capsula e o braco virava um poste de barbeiro.
  for (let i = 0; i < 22; i++) {
    ctx.beginPath();
    ctx.lineWidth = 1.2 + (i % 3) * 0.7;
    const x = 6 + i * 11.4;
    ctx.moveTo(x, -8);
    ctx.bezierCurveTo(x + 14, 70, x - 12, 170, x + 6, 264);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(34,30,48,.42)';
  for (let i = 0; i < 26; i++) {
    const x = (i * 47) % 244 + 6;
    const y = (i * 89) % 232 + 8;
    ctx.beginPath();
    ctx.ellipse(x, y, 4 + (i % 3) * 2, 10 + (i % 4) * 3, (i % 5) * 0.4, 0, 6.3);
    ctx.fill();
  }

  return finalizar(c, true);
}

/** Tela de malha do encosto ergonomico: trama fina, com furos de verdade. */
export function texturaMalha() {
  const { c, ctx } = tela(128, 128);
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = '#1d2029';
  for (let y = 0; y < 128; y += 8) {
    for (let x = 0; x < 128; x += 8) {
      ctx.fillRect(x, y, 5, 1.6);
      ctx.fillRect(x, y, 1.6, 5);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(7, 9);
  return t;
}

/** Blackout: preenchimento solido com recortes de pele, do ombro ao punho. */
export function texturaBlackout() {
  const { c, ctx } = tela(256, 256);
  ctx.fillStyle = '#14131c';
  ctx.fillRect(0, 0, 256, 256);
  // faixas de pele deixadas em negativo, que e como o blackout e desenhado
  ctx.fillStyle = '#d9a888';
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.translate(0, i * 52);
    ctx.beginPath();
    ctx.moveTo(-10, 8);
    ctx.bezierCurveTo(80, -6, 170, 22, 266, 6);
    ctx.lineTo(266, 14);
    ctx.bezierCurveTo(170, 30, 80, 2, -10, 16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(217,168,136,.30)');
  g.addColorStop(0.22, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return finalizar(c, true);
}

/** Mousepad de tecido: trama fina, ruido leve e costura na borda. */
export function texturaMousepad() {
  const { c, ctx } = tela(512, 512);

  ctx.fillStyle = '#ff5fa2';
  ctx.fillRect(0, 0, 512, 512);

  // trama: fios claros e escuros cruzados, bem sutis
  ctx.globalAlpha = 0.10;
  for (let i = 0; i < 512; i += 3) {
    ctx.fillStyle = i % 6 === 0 ? '#ffffff' : '#7a1d45';
    ctx.fillRect(i, 0, 1, 512);
    ctx.fillRect(0, i, 512, 1);
  }
  ctx.globalAlpha = 1;

  // grão irregular, para o tecido nao virar xadrez perfeito
  const d = ctx.getImageData(0, 0, 512, 512);
  for (let i = 0; i < d.data.length; i += 4) {
    const n = ((i * 2654435761) % 23) - 11;
    d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n;
  }
  ctx.putImageData(d, 0, 0);

  // costura da borda
  ctx.strokeStyle = '#c2306e';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 502, 502);
  ctx.strokeStyle = 'rgba(255,255,255,.22)';
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 6]);
  ctx.strokeRect(12, 12, 488, 488);
  ctx.setLineDash([]);

  return finalizar(c);
}

/**
 * Tela do notebook: editor com terminal embaixo.
 * Desenhada em formas, nao em texto de verdade — a essa distancia glifo nao se
 * le, e barra colorida com o ritmo certo de indentacao le como codigo.
 */
export function texturaEditor() {
  const L = 1024, A = 640;
  const { c, ctx } = tela(L, A);

  const FUNDO = '#1e1e1e', PAINEL = '#252526', BARRA = '#323233';
  ctx.fillStyle = FUNDO; ctx.fillRect(0, 0, L, A);

  // barra de atividades
  ctx.fillStyle = '#333334'; ctx.fillRect(0, 0, 46, A);
  ['#c5c5c5', '#6f6f6f', '#6f6f6f', '#6f6f6f', '#6f6f6f'].forEach((cor, i) => {
    ctx.fillStyle = cor;
    ctx.fillRect(14, 26 + i * 46, 18, 18);
  });

  // arvore de arquivos
  ctx.fillStyle = PAINEL; ctx.fillRect(46, 0, 210, A);
  ctx.fillStyle = '#8a8a8a';
  ctx.font = '13px ui-monospace, monospace';
  ctx.fillText('PORTFOLIO', 62, 26);
  const arquivos = ['src', ' projects', '  gatecheck', '   index.js', '   scene.js', '   camera.js',
                    'public', ' assets', 'index.html', 'package.json'];
  arquivos.forEach((f, i) => {
    ctx.fillStyle = f.includes('index.js') ? '#e7e7e7' : '#9d9d9d';
    if (f.includes('index.js')) { ctx.fillStyle = '#37373d'; ctx.fillRect(46, 42 + i * 22, 210, 22); ctx.fillStyle = '#ffffff'; }
    ctx.fillText(f, 62, 58 + i * 22);
  });

  // abas
  ctx.fillStyle = BARRA; ctx.fillRect(256, 0, L - 256, 34);
  ctx.fillStyle = FUNDO; ctx.fillRect(256, 0, 150, 34);
  ctx.fillStyle = '#4ec9b0'; ctx.font = '12px ui-monospace, monospace';
  ctx.fillText('index.js', 276, 22);

  // codigo: barras coloridas com indentacao, no ritmo de codigo de verdade
  const linhas = [
    [1, ['#c586c0:6', '#9cdcfe:9', '#ce9178:14']],
    [1, ['#c586c0:6', '#9cdcfe:7', '#ce9178:18']],
    [0, []],
    [1, ['#569cd6:5', '#dcdcaa:11', '#9cdcfe:6']],
    [2, ['#c586c0:4', '#9cdcfe:8', '#b5cea8:3']],
    [2, ['#9cdcfe:7', '#d4d4d4:2', '#dcdcaa:9', '#ce9178:11']],
    [3, ['#9cdcfe:10', '#d4d4d4:1', '#b5cea8:4']],
    [2, ['#d4d4d4:1']],
    [2, ['#c586c0:6', '#9cdcfe:5']],
    [1, ['#d4d4d4:1']],
    [0, []],
    [1, ['#6a9955:26']],
    [1, ['#569cd6:5', '#dcdcaa:13', '#9cdcfe:4']],
    [2, ['#9cdcfe:8', '#d4d4d4:2', '#4ec9b0:12']],
    [2, ['#c586c0:6', '#9cdcfe:6', '#d4d4d4:1']]
  ];
  let y = 56;
  linhas.forEach(([ind, segs]) => {
    let x = 280 + ind * 22;
    segs.forEach((sg) => {
      const [cor, n] = sg.split(':');
      ctx.fillStyle = cor;
      ctx.fillRect(x, y, +n * 7.2, 8);
      x += +n * 7.2 + 9;
    });
    y += 22;
  });

  // terminal
  const topo = A - 210;
  ctx.fillStyle = PAINEL; ctx.fillRect(256, topo, L - 256, 210);
  ctx.fillStyle = '#3c3c3c'; ctx.fillRect(256, topo, L - 256, 30);
  ctx.fillStyle = '#cccccc'; ctx.font = '12px ui-monospace, monospace';
  ctx.fillText('TERMINAL', 276, topo + 20);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(272, topo + 28, 74, 2);

  ctx.font = '13px ui-monospace, monospace';
  const saida = [
    ['#4ec9b0', '➜  portfolio '], ['#dcdcaa', 'npm run dev'],
    null,
    ['#8a8a8a', '  VITE v7.1.3  ready in 214 ms'],
    null,
    ['#8a8a8a', '  ➜  Local:   '], ['#4ec9b0', 'http://localhost:5173/'],
    null,
    ['#4ec9b0', '➜  portfolio '], ['#dcdcaa', 'git status'],
    null,
    ['#8a8a8a', '  modified: src/projects/gatecheck/index.js']
  ];
  let ty = topo + 56, tx = 276;
  saida.forEach((it) => {
    if (!it) { ty += 20; tx = 276; return; }
    ctx.fillStyle = it[0];
    ctx.fillText(it[1], tx, ty);
    tx += ctx.measureText(it[1]).width;
  });
  // cursor
  ctx.fillStyle = '#cccccc';
  ctx.fillRect(276, ty + 12, 8, 15);

  // barra de status
  ctx.fillStyle = '#7048d6'; ctx.fillRect(0, A - 24, L, 24);

  return finalizar(c);
}
