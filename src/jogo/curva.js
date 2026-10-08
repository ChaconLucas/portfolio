import * as THREE from 'three';

/**
 * Planeta "redondo" sem a fisica saber: na superficie tudo e plano (e o mundo
 * se repete nas bordas, da para dar a volta), e so o DESENHO curva — cada
 * vertice desce d²·k, onde d e a distancia (no chao) ate a camera. De onde
 * voce estiver, o horizonte cai como num planeta de raio 1/(2k), igual em
 * qualquer lugar do mapa.
 *
 * CURVA.k fica em 0 no espaco (nada curva) e o jogo liga na superficie antes
 * de desenhar. curvarCena(cena) passa por todos os materiais e injeta a curva
 * (uma vez por material; chame de novo quando entrarem coisas novas).
 * Shaders proprios (agua, fumaca) usam CURVA_GLSL + curvar(pos) no vertice.
 */
export const CURVA = { k: { value: 0 }, c: { value: new THREE.Vector3() } };

export const CURVA_GLSL = `
uniform float uCurvaK; uniform vec3 uCurvaC;
vec4 curvar(vec4 w) { vec2 d = w.xz - uCurvaC.xz; w.y -= dot(d, d) * uCurvaK; return w; }
`;
const PROJETA = `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = viewMatrix * curvar( modelMatrix * mvPosition );
gl_Position = projectionMatrix * mvPosition;
`;

/** liga os uniformes num shader proprio (ShaderMaterial) */
export function usarCurva(uniforms) { uniforms.uCurvaK = CURVA.k; uniforms.uCurvaC = CURVA.c; return uniforms; }

export function curvarMaterial(m) {
  if (!m || m.userData.curva || m.isShaderMaterial || m.isRawShaderMaterial) return;
  m.userData.curva = true;
  const antes = m.onBeforeCompile, chaveAntes = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    antes?.call(m, sh, r);
    sh.uniforms.uCurvaK = CURVA.k; sh.uniforms.uCurvaC = CURVA.c;
    sh.vertexShader = sh.vertexShader.replace('void main() {', CURVA_GLSL + '\nvoid main() {');
    // sprite: so o centro desce (ele continua virado para a camera)
    if (m.isSpriteMaterial) sh.vertexShader = sh.vertexShader.replace('vec4 mvPosition = modelViewMatrix[ 3 ];', 'vec4 mvPosition = viewMatrix * curvar( vec4( modelMatrix[ 3 ].xyz, 1.0 ) );');
    else sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', PROJETA);
  };
  m.customProgramCacheKey = () => (chaveAntes ? chaveAntes.call(m) : '') + '|curva';
  m.needsUpdate = true;
}

/** injeta a curva em tudo da cena (menos o que tiver userData.semCurva) */
export function curvarCena(raiz) {
  raiz.traverse((o) => {
    if (o.userData.semCurva) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) curvarMaterial(m);
  });
}
