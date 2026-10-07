/**
 * Qualidade automatica do site inteiro. Mede o FPS de verdade da pagina e,
 * SO se a maquina nao estiver aguentando, baixa um pouco a resolucao das cenas
 * 3D (Stack Universe, projetos, buraco negro); quando sobra folga, volta ao
 * maximo. Em PC bom o fator fica em 1 e nada muda.
 *
 * Cada cena se registra com uma funcao aplicar(fator) — para renderers do
 * three.js, registrarRenderer(renderer) ja faz (resolucao original x fator).
 * O Stack Universe e criado num script do index.html antes deste modulo: ele
 * deixa o renderer em window.__qualidadeFila e este modulo pega na carga.
 */
const regs = new Set();
let fator = 1;

export function registrar(aplicar) {
  const r = { aplicar }; regs.add(r);
  if (fator !== 1) aplicar(fator);
  return () => regs.delete(r);
}
export function registrarRenderer(renderer) {
  const base = renderer.getPixelRatio();
  return registrar((f) => { if (renderer.getContext().isContextLost?.()) return; renderer.setPixelRatio(base * f); });
}
export const fatorAtual = () => fator;

function mudar(novo) {
  novo = Math.round(novo * 100) / 100;
  if (novo === fator) return;
  fator = novo;
  for (const r of regs) { try { r.aplicar(fator); } catch (e) { /* cena ja descartada */ } }
}

// medicao: janelas de 2 s; cai rapido (FPS < 40), sobe devagar (3 janelas boas)
let t0 = 0, n = 0, boas = 0, espera = 2;
function medir(t) {
  requestAnimationFrame(medir);
  if (document.hidden || window.__jogoAberto) { t0 = 0; return; }
  if (!t0) { t0 = t; n = 0; return; }
  n++;
  if (t - t0 < 2000) return;
  const fps = n * 1000 / (t - t0); t0 = t; n = 0;
  if (espera > 0) { espera--; return; }   // a carga inicial (shaders, modelos) nao conta
  if (fps < 40) { boas = 0; mudar(Math.max(.5, fator * (fps < 25 ? .75 : .87))); espera = 1; }
  else if (fps > 56 && fator < 1) { if (++boas >= 3) { boas = 0; mudar(Math.min(1, fator * 1.12)); espera = 1; } }
  else boas = 0;
}
requestAnimationFrame(medir);

// renderers criados antes deste modulo (script do index.html)
for (const r of window.__qualidadeFila || []) registrarRenderer(r);
window.__qualidadeFila = { push: (r) => registrarRenderer(r) };
