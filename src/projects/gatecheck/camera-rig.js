import * as THREE from 'three';

/**
 * Trilho da camera. O scroll comanda um unico valor (0 a 1) e o rig traduz esse
 * valor em posicao + alvo.
 *
 * Decisao importante: quem se aproxima e a CAMERA, andando pelo espaco. A tela
 * fica parada. Puxar a tela para frente ou abrir o FOV dao o efeito de objeto
 * voando, que e exatamente o que nao se quer aqui — o FOV fica fixo e o
 * movimento e dolly puro.
 */

/** Chaves do percurso: de plano geral ate encostar na tela. */
const CHAVES = [
  { p: 0.00, pos: [2.00, 1.72, 1.72], alvo: [0.10, 1.04, 0.02] },
  { p: 0.30, pos: [1.32, 1.56, 1.48], alvo: [0.05, 1.12, -0.02] },
  { p: 0.58, pos: [0.62, 1.44, 1.24], alvo: [0.00, 1.19, -0.08] },
  { p: 0.82, pos: [0.14, 1.26, 0.62], alvo: [0.00, 1.21, -0.11] },
  { p: 1.00, pos: [0.00, 1.213, 0.14], alvo: [0.00, 1.213, -0.11] }
];

const suave = (t) => t * t * (3 - 2 * t);

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

function amostrar(prog, campo, out) {
  const p = Math.max(0, Math.min(1, prog));
  for (let i = 0; i < CHAVES.length - 1; i++) {
    const c0 = CHAVES[i], c1 = CHAVES[i + 1];
    if (p >= c0.p && p <= c1.p) {
      const t = suave((p - c0.p) / (c1.p - c0.p));
      _a.fromArray(c0[campo]);
      _b.fromArray(c1[campo]);
      return out.copy(_a).lerp(_b, t);
    }
  }
  return out.fromArray(CHAVES[CHAVES.length - 1][campo]);
}

export function criarRigCamera(camera) {
  const posAlvo = new THREE.Vector3().fromArray(CHAVES[0].pos);
  const olharAlvo = new THREE.Vector3().fromArray(CHAVES[0].alvo);
  const olharAtual = olharAlvo.clone();

  camera.position.copy(posAlvo);
  camera.lookAt(olharAtual);

  /** deslocamento do ponteiro: parallax discreto, some conforme entra na tela */
  const ponteiro = new THREE.Vector2();
  const ponteiroSuave = new THREE.Vector2();

  return {
    /** @param {number} x -1..1 @param {number} y -1..1 */
    apontar(x, y) { ponteiro.set(x, y); },

    /**
     * @param {number} prog  progresso do scroll no capitulo (0..1)
     * @param {number} dt    delta em segundos, para o amortecimento nao depender do FPS
     */
    atualizar(prog, dt) {
      amostrar(prog, 'pos', posAlvo);
      amostrar(prog, 'alvo', olharAlvo);

      // o parallax fecha perto do fim: colado na tela ele viraria tremor
      const peso = (1 - suave(Math.min(1, Math.max(0, (prog - 0.55) / 0.45)))) * 0.9;
      ponteiroSuave.lerp(ponteiro, 1 - Math.pow(0.002, dt));
      posAlvo.x += ponteiroSuave.x * 0.16 * peso;
      posAlvo.y += ponteiroSuave.y * 0.10 * peso;

      // amortecimento exponencial independente de framerate
      const a = 1 - Math.pow(0.0008, dt);
      camera.position.lerp(posAlvo, a);
      olharAtual.lerp(olharAlvo, a);
      camera.lookAt(olharAtual);
    },

    /** Distancia normalizada ate a tela — usada para calar a animacao no fim. */
    proximidade(prog) { return suave(Math.min(1, Math.max(0, (prog - 0.6) / 0.4))); }
  };
}
