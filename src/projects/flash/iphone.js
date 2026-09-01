import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * iPhone em escala real: 146,6 x 70,6 x 8,25 mm.
 *
 * A escala importa porque a cena inteira e medida em metros — o aparelho vai
 * ficar na mao de um personagem de 1,75 m, e qualquer arredondamento aqui
 * aparece como celular de brinquedo ou tijolo.
 *
 * `tela` e o mesh que recebe as capturas do app; a proporcao dele segue a do
 * aparelho de verdade (2556 x 1179), entao print em retrato entra sem recorte.
 */

export const CORPO = { largura: 0.0706, altura: 0.1466, espessura: 0.00825 };
export const TELA = { largura: 0.0654, altura: 0.1414 };   // 2556 x 1179

const caixa = (l, a, p, r, s = 4) => new RoundedBoxGeometry(l, a, p, s, r);

/**
 * Retangulo de cantos arredondados, extrudado.
 *
 * `RoundedBoxGeometry` nao serve para o corpo do aparelho: ela arredonda TODAS
 * as arestas com o mesmo raio, e esse raio e limitado pela metade da menor
 * dimensao. Com 8,25 mm de espessura, o canto de 10,5 mm era cortado para 4 mm
 * — e e exatamente por isso que o celular saia com cara de bloco.
 * Extrudando um contorno, o canto do CONTORNO fica com o raio certo e a
 * espessura fica livre.
 */
function placa(l, a, esp, raio, bisel = 0.0006) {
  const f = new THREE.Shape();
  const w = l / 2, h = a / 2, r = Math.min(raio, w, h);
  f.moveTo(-w + r, -h);
  f.lineTo(w - r, -h);
  f.quadraticCurveTo(w, -h, w, -h + r);
  f.lineTo(w, h - r);
  f.quadraticCurveTo(w, h, w - r, h);
  f.lineTo(-w + r, h);
  f.quadraticCurveTo(-w, h, -w, h - r);
  f.lineTo(-w, -h + r);
  f.quadraticCurveTo(-w, -h, -w + r, -h);

  const g = new THREE.ExtrudeGeometry(f, {
    depth: esp - bisel * 2,
    bevelEnabled: bisel > 0,
    bevelThickness: bisel,
    bevelSize: bisel,
    bevelSegments: 2,
    curveSegments: 16
  });
  g.translate(0, 0, -(esp - bisel * 2) / 2);
  return g;
}

/**
 * @param {object} [op]
 * @param {number} [op.cor]  cor do titanio
 * @returns {{grupo:THREE.Group, tela:THREE.Mesh, luz:THREE.PointLight}}
 */
export function criarIphone(op = {}) {
  const g = new THREE.Group();
  g.name = 'iphone';

  /* Titanio natural e escuro e fosco, nao cromado. Com 0x8f8f96 e rugosidade
     0,34 ele refletia demais e o aro virava uma faixa clara em volta da tela —
     que e a primeira coisa que denuncia o modelo. */
  const titanio = new THREE.MeshPhysicalMaterial({
    color: op.cor || 0x55565c, roughness: 0.52, metalness: 0.82, clearcoat: 0
  });
  const preto = new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.45, metalness: 0.3 });
  const vidroTras = new THREE.MeshPhysicalMaterial({
    color: 0x1c1e24, roughness: 0.22, metalness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.1
  });

  const { largura: L, altura: A, espessura: E } = CORPO;
  const raio = 0.0105;   // canto do iPhone e bem arredondado

  // aro de titanio: e a peca que da a silhueta
  const aro = new THREE.Mesh(placa(L, A, E, raio, 0.0009), titanio);
  aro.castShadow = true;
  g.add(aro);

  // vidro traseiro, levemente rebaixado do aro
  const tras = new THREE.Mesh(placa(L - 0.0024, A - 0.0024, 0.0010, raio - 0.0012, 0.0002), vidroTras);
  tras.position.z = -E / 2 + 0.0006;
  g.add(tras);

  /* Moldura preta POR CIMA do aro, nao atras dele.
     Estando atras, a face frontal do titanio aparecia inteira e virava uma
     borda clara e larga em volta da tela — num iPhone o que se ve de frente e
     preto, e o titanio e so o fio da lateral. */
  const moldura = new THREE.Mesh(placa(L - 0.0005, A - 0.0005, 0.0008, raio - 0.0002, 0.0002), preto);
  moldura.position.z = E / 2 - 0.0001;
  g.add(moldura);

  /* Tela com cantos arredondados de verdade: um plano reto denuncia o modelo,
     porque o canto quadrado nao existe em nenhum iPhone. */
  const forma = new THREE.Shape();
  {
    const w = TELA.largura / 2, h = TELA.altura / 2, r = 0.0092;
    forma.moveTo(-w + r, -h);
    forma.lineTo(w - r, -h);
    forma.quadraticCurveTo(w, -h, w, -h + r);
    forma.lineTo(w, h - r);
    forma.quadraticCurveTo(w, h, w - r, h);
    forma.lineTo(-w + r, h);
    forma.quadraticCurveTo(-w, h, -w, h - r);
    forma.lineTo(-w, -h + r);
    forma.quadraticCurveTo(-w, -h, -w + r, -h);
  }
  const geoTela = new THREE.ShapeGeometry(forma, 12);
  // UV normalizado: sem isso a textura sai deslocada, porque ShapeGeometry
  // gera coordenadas no espaco da propria forma
  {
    const pos = geoTela.getAttribute('position');
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = pos.getX(i) / TELA.largura + 0.5;
      uv[i * 2 + 1] = pos.getY(i) / TELA.altura + 0.5;
    }
    geoTela.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  const tela = new THREE.Mesh(geoTela, new THREE.MeshBasicMaterial({
    color: 0x0a0b0f, toneMapped: false
  }));
  tela.name = 'telaIphone';
  tela.position.z = E / 2 + 0.0005;
  g.add(tela);

  // ilha dinamica
  const ilha = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.0038, 0.0122, 4, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  ilha.rotation.z = Math.PI / 2;
  ilha.position.set(0, A / 2 - 0.0135, E / 2 + 0.0010);
  g.add(ilha);

  // botoes: volume e acao a esquerda, energia a direita
  const bot = (a, y, lado) => {
    const b = new THREE.Mesh(caixa(0.0016, a, 0.0042, 0.0006, 2), titanio);
    b.position.set(lado * (L / 2), y, 0);
    g.add(b);
  };
  bot(0.0170, 0.0210, -1);
  bot(0.0170, 0.0010, -1);
  bot(0.0105, 0.0400, -1);
  bot(0.0260, 0.0180, 1);

  /* Modulo de camera: tres lentes em triangulo, na quina de cima a esquerda.
     E o detalhe que faz reconhecer o aparelho por tras. */
  const modulo = new THREE.Mesh(placa(0.0290, 0.0290, 0.0022, 0.0082, 0.0002), vidroTras);
  modulo.position.set(-L / 2 + 0.0210, A / 2 - 0.0210, -E / 2 - 0.0010);
  g.add(modulo);
  [[-0.0062, 0.0062], [0.0062, 0.0062], [0, -0.0068]].forEach(([dx, dy]) => {
    const anel = new THREE.Mesh(new THREE.CylinderGeometry(0.0052, 0.0052, 0.0020, 18), titanio);
    anel.rotation.x = Math.PI / 2;
    anel.position.set(modulo.position.x + dx, modulo.position.y + dy, -E / 2 - 0.0020);
    g.add(anel);
    const lente = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 0.0006, 18),
      new THREE.MeshPhysicalMaterial({ color: 0x05070c, roughness: 0.06, metalness: 0.1, clearcoat: 1 }));
    lente.rotation.x = Math.PI / 2;
    lente.position.set(anel.position.x, anel.position.y, -E / 2 - 0.0031);
    g.add(lente);
  });

  // a tela acesa ilumina a mao em volta
  const luz = new THREE.PointLight(0x9fb6ff, 0.14, 0.28, 2);
  luz.position.set(0, 0, E / 2 + 0.05);
  g.add(luz);

  return { grupo: g, tela, luz };
}
