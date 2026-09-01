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
  const L = 1280, A = 800;
  const { c, ctx } = tela(L, A);
  const mono = (t) => `${t}px ui-monospace, SFMono-Regular, Menlo, monospace`;

  ctx.fillStyle = '#1e1e1e'; ctx.fillRect(0, 0, L, A);

  /* barra de titulo com os tres circulos: e o detalhe que faz a tela ser
     reconhecida como um editor num Mac, e nao um retangulo escuro */
  ctx.fillStyle = '#323233'; ctx.fillRect(0, 0, L, 38);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((cor, i) => {
    ctx.beginPath(); ctx.arc(22 + i * 20, 19, 6.5, 0, 7); ctx.fillStyle = cor; ctx.fill();
  });
  ctx.fillStyle = '#9d9d9d'; ctx.font = mono(13);
  ctx.textAlign = 'center';
  ctx.fillText('index.js — portfolio', L / 2, 24);
  ctx.textAlign = 'left';

  // barra de atividades
  ctx.fillStyle = '#333334'; ctx.fillRect(0, 38, 52, A - 38);
  ['#e7e7e7', '#6f6f6f', '#6f6f6f', '#6f6f6f'].forEach((cor, i) => {
    ctx.fillStyle = cor; ctx.fillRect(17, 66 + i * 48, 18, 18);
  });

  // explorador
  ctx.fillStyle = '#252526'; ctx.fillRect(52, 38, 226, A - 38);
  ctx.fillStyle = '#8a8a8a'; ctx.font = mono(11);
  ctx.fillText('EXPLORADOR', 70, 62);
  ctx.font = mono(13);
  const arv = [['src', 0], ['projects', 1], ['gatecheck', 2], ['index.js', 3], ['workstation.js', 3],
               ['character-glb.js', 3], ['camera-rig.js', 3], ['textures.js', 3],
               ['public', 0], ['index.html', 0], ['package.json', 0]];
  arv.forEach(([f, ind], i) => {
    const yy = 84 + i * 24;
    if (f === 'index.js') { ctx.fillStyle = '#37373d'; ctx.fillRect(52, yy - 15, 226, 24); }
    ctx.fillStyle = f === 'index.js' ? '#ffffff' : (ind === 0 ? '#cccccc' : '#9d9d9d');
    ctx.fillText(f, 70 + ind * 13, yy);
  });

  // aba aberta
  ctx.fillStyle = '#2d2d2d'; ctx.fillRect(278, 38, L - 278, 36);
  ctx.fillStyle = '#1e1e1e'; ctx.fillRect(278, 38, 168, 36);
  ctx.fillStyle = '#e2c08d'; ctx.font = mono(13);
  ctx.fillText('index.js', 302, 61);

  /* codigo com texto de verdade: barras coloridas liam como grafico. A essa
     distancia nao se le a palavra, mas se le que E codigo. */
  const cod = [
    [0, [['#6a9955', '// cena do capitulo GateCheck']]],
    [0, [['#c586c0', 'import'], ['#d4d4d4', ' * '], ['#c586c0', 'as'], ['#4ec9b0', ' THREE'], ['#c586c0', ' from'], ['#ce9178', " 'three'"]]],
    [0, [['#c586c0', 'import'], ['#d4d4d4', ' { '], ['#9cdcfe', 'criarEstacao'], ['#d4d4d4', ' } '], ['#c586c0', 'from'], ['#ce9178', " './workstation.js'"]]],
    [0, []],
    [0, [['#c586c0', 'export function'], ['#dcdcaa', ' montarCenaGatecheck'], ['#d4d4d4', '(container) {']]],
    [1, [['#569cd6', 'const'], ['#9cdcfe', ' renderer'], ['#d4d4d4', ' = '], ['#c586c0', 'new'], ['#4ec9b0', ' THREE.WebGLRenderer'], ['#d4d4d4', '({']]],
    [2, [['#9cdcfe', 'antialias'], ['#d4d4d4', ': '], ['#569cd6', 'true'], ['#d4d4d4', ', '], ['#9cdcfe', 'alpha'], ['#d4d4d4', ': '], ['#569cd6', 'true']]],
    [1, [['#d4d4d4', '});']]],
    [1, []],
    [1, [['#6a9955', '// mapa de ambiente gerado em codigo']]],
    [1, [['#9cdcfe', 'scene'], ['#d4d4d4', '.'], ['#9cdcfe', 'environment'], ['#d4d4d4', ' = '], ['#9cdcfe', 'pmrem'], ['#d4d4d4', '.'], ['#dcdcaa', 'fromScene'], ['#d4d4d4', '(...).'], ['#9cdcfe', 'texture']]],
    [1, []],
    [1, [['#9cdcfe', 'rig'], ['#d4d4d4', '.'], ['#dcdcaa', 'atualizar'], ['#d4d4d4', '(progresso, dt)']]],
    [0, [['#d4d4d4', '}']]]
  ];
  ctx.font = mono(14);
  let y = 104;
  cod.forEach(([ind, segs], i) => {
    ctx.fillStyle = '#5a5a5a'; ctx.font = mono(12);
    ctx.fillText(String(i + 1).padStart(2, ' '), 292, y);
    ctx.font = mono(14);
    let x = 330 + ind * 26;
    segs.forEach(([cor, txt]) => {
      ctx.fillStyle = cor; ctx.fillText(txt, x, y);
      x += ctx.measureText(txt).width;
    });
    y += 25;
  });

  // terminal
  const topo = A - 236;
  ctx.fillStyle = '#181818'; ctx.fillRect(278, topo, L - 278, 236);
  ctx.fillStyle = '#252526'; ctx.fillRect(278, topo, L - 278, 32);
  ctx.font = mono(11);
  [['PROBLEMAS', '#8a8a8a'], ['SAIDA', '#8a8a8a'], ['TERMINAL', '#ffffff']].forEach(([t, cor], i) => {
    ctx.fillStyle = cor; ctx.fillText(t, 300 + i * 92, topo + 21);
  });
  ctx.fillStyle = '#ffffff'; ctx.fillRect(484, topo + 29, 62, 2);

  ctx.font = mono(13.5);
  const linhas = [
    [['#4ec9b0', '➜'], ['#8ab4ff', '  portfolio'], ['#dcdcaa', '  npm run build']],
    [],
    [['#8a8a8a', '  vite v7.1.3 building for production...']],
    [['#4ec9b0', '  ✓'], ['#8a8a8a', ' 7 modules transformed.']],
    [['#8a8a8a', '  dist/index.html            412.08 kB']],
    [['#8a8a8a', '  dist/assets/index.js        896.31 kB']],
    [['#4ec9b0', '  ✓ built in 1.64s']],
    [],
    [['#4ec9b0', '➜'], ['#8ab4ff', '  portfolio'], ['#dcdcaa', '  git status']],
    [['#8a8a8a', '  modificado: src/projects/gatecheck/index.js']]
  ];
  let ty = topo + 58;
  linhas.forEach((segs) => {
    let tx = 300;
    segs.forEach(([cor, txt]) => { ctx.fillStyle = cor; ctx.fillText(txt, tx, ty); tx += ctx.measureText(txt).width; });
    ty += 21;
  });
  ctx.fillStyle = '#cccccc'; ctx.fillRect(300, ty - 12, 8, 15);

  ctx.fillStyle = '#7048d6'; ctx.fillRect(0, A - 26, L, 26);
  ctx.fillStyle = '#ffffff'; ctx.font = mono(11);
  ctx.fillText('main*   0 ⚠   0 ✗', 16, A - 8);
  ctx.textAlign = 'right';
  ctx.fillText('JavaScript   UTF-8   LF', L - 16, A - 8);
  ctx.textAlign = 'left';

  return finalizar(c);
}

/**
 * Grao fino para usar como mapa de rugosidade.
 *
 * Superficie branca com rugosidade constante reflete igual em cada ponto e o
 * olho le como plastico chapado. Variando a rugosidade por pixel, o brilho
 * quebra e aparece material — sem custo de memoria relevante, porque e um
 * quadrado pequeno repetido.
 */
export function texturaGrao() {
  const N = 256;
  const { c, ctx } = tela(N, N);
  const img = ctx.createImageData(N, N);
  for (let i = 0; i < img.data.length; i += 4) {
    const p = i / 4;
    const x = p % N, y = (p / N) | 0;
    // duas frequencias: fibra longa mais um ruido fino por cima
    const fibra = Math.sin(y * 0.7 + Math.sin(x * 0.04) * 2.2) * 10;
    const fino = ((x * 374761393 + y * 668265263) % 37) - 18;
    const v = 150 + fibra + fino;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 6);
  return t;
}

/**
 * Teclado desenhado inteiro: teclas, vaos e legendas.
 *
 * Em `InstancedMesh` todas as teclas dividem o mesmo material, entao nao ha como
 * dar uma letra diferente a cada uma sem escrever shader. Nesta distancia o
 * desenho resolve melhor: le como teclado de verdade e custa uma textura so.
 */
export function texturaTeclado() {
  const L = 1024, A = 489;
  const { c, ctx } = tela(L, A);

  ctx.fillStyle = '#c2306e';
  ctx.fillRect(0, 0, L, A);

  const fileiras = [
    [['esc', 1.3], ['F1', 1], ['F2', 1], ['F3', 1], ['F4', 1], ['F5', 1], ['F6', 1],
     ['F7', 1], ['F8', 1], ['F9', 1], ['F10', 1], ['F11', 1], ['F12', 1], ['del', 1.3]],
    [['`', 1], ['1', 1], ['2', 1], ['3', 1], ['4', 1], ['5', 1], ['6', 1], ['7', 1],
     ['8', 1], ['9', 1], ['0', 1], ['-', 1], ['=', 1], ['⌫', 1.6]],
    [['tab', 1.5], ['Q', 1], ['W', 1], ['E', 1], ['R', 1], ['T', 1], ['Y', 1], ['U', 1],
     ['I', 1], ['O', 1], ['P', 1], ['[', 1], [']', 1], ['|', 1.1]],
    [['caps', 1.8], ['A', 1], ['S', 1], ['D', 1], ['F', 1], ['G', 1], ['H', 1], ['J', 1],
     ['K', 1], ['L', 1], [';', 1], ["'", 1], ['↵', 1.8]],
    [['shift', 2.3], ['Z', 1], ['X', 1], ['C', 1], ['V', 1], ['B', 1], ['N', 1], ['M', 1],
     [',', 1], ['.', 1], ['/', 1], ['⇧', 2.3]],
    [['ctrl', 1.3], ['alt', 1.2], ['⌘', 1.3], ['', 6.4], ['⌘', 1.3], ['alt', 1.2],
     ['←', 1], ['↑', 1], ['↓', 1], ['→', 1]]
  ];

  const MARGEM = 14, VAO = 5;
  const alturaLinha = (A - MARGEM * 2 - VAO * (fileiras.length - 1)) / fileiras.length;

  fileiras.forEach((linha, i) => {
    const unidades = linha.reduce((s2, k) => s2 + k[1], 0);
    const largura = (L - MARGEM * 2 - VAO * (linha.length - 1)) / unidades;
    let x = MARGEM;
    const y = MARGEM + i * (alturaLinha + VAO);

    linha.forEach(([rot, u]) => {
      const w = largura * u;
      const h = alturaLinha;

      // sombra sob a tecla, para o vao ter profundidade
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.beginPath(); ctx.roundRect(x, y + 2.5, w, h, 5); ctx.fill();

      // corpo da tecla, com o topo mais claro
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#fdf1f6');
      g.addColorStop(1, '#e6d3dc');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.roundRect(x, y, w, h - 2.5, 5); ctx.fill();

      if (rot) {
        const tam = rot.length > 2 ? 13 : 17;
        ctx.fillStyle = '#5c3247';
        ctx.font = `${tam}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rot, x + w / 2, y + h / 2 - 1);
      }
      x += w + VAO;
    });
  });

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  return finalizar(c);
}
