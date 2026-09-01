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
