import * as THREE from 'three';

/**
 * Fundo do Stack Universe (site): um buraco negro ao longe e meteoros
 * passando de vez em quando, atras dos planetas.
 *  - buraco negro: horizonte (esfera preta), disco de acrecao girando (lado
 *    que vem para a camera mais brilhante), anel de fotons e o "arco" de luz
 *    por cima (o disco de tras visto pela lente da gravidade);
 *  - meteoros: pedra em brasa com rastro de luz, cruzando o fundo num plano
 *    atras do sistema (a cada 5–11 s; as vezes dois juntos).
 * Tudo sem neblina e sem escrever profundidade (nao corta nada da frente).
 * criarFundoEspaco({ camera }) -> { grupo, atualizar(t, dt), destruir() }
 */
function texAnel(interno, externo, suave = .08) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(Math.max(0, interno - suave), 'rgba(255,255,255,0)');
  g.addColorStop(interno, 'rgba(255,255,255,1)'); g.addColorStop(Math.min(1, externo), 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
function texBrilho() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}

export function criarFundoEspaco({ camera, posicao = new THREE.Vector3(15.5, -2.2, -6.6), raio = 1.1 }) {   // canto de cima a direita, atras do sistema
  const lixo = []; const G = (o) => { lixo.push(o); return o; };
  const grupo = new THREE.Group();

  /* ---- buraco negro ---- */
  const bn = new THREE.Group(); bn.position.copy(posicao); grupo.add(bn);
  const horizonte = new THREE.Mesh(G(new THREE.SphereGeometry(raio, 48, 32)), G(new THREE.MeshBasicMaterial({ color: 0x000000, fog: false })));
  bn.add(horizonte);
  const uDisco = { uT: { value: 0 }, uR0: { value: raio * 1.35 }, uR1: { value: raio * 4.2 } };
  const disco = new THREE.Mesh(G(new THREE.RingGeometry(raio * 1.35, raio * 4.2, 160, 6)), G(new THREE.ShaderMaterial({
    uniforms: uDisco, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform float uT, uR0, uR1; varying vec2 vP;
      float h(float n){ return fract(sin(n) * 43758.5453); }
      void main(){
        float r = length(vP), k = (r - uR0) / (uR1 - uR0), a = atan(vP.y, vP.x);
        // espirais girando (mais rapido perto do centro) e filetes finos
        float gira = a + uT * (1.6 - k * 1.1) + k * 7.;
        float fios = .55 + .45 * sin(gira * 5.) * sin(gira * 3. + k * 20.);
        float grao = .8 + .2 * sin(r * 90. + a * 3.);
        float borda = smoothstep(0., .08, k) * (1. - smoothstep(.55, 1., k));
        // o lado que vem na direcao da camera brilha mais (efeito doppler)
        float doppler = .55 + .75 * (.5 + .5 * cos(a + .6));
        vec3 quente = vec3(1., .95, 1.), meio = vec3(1., .45, .85), fora = vec3(.48, .3, 1.);
        vec3 cor = mix(quente, meio, smoothstep(0., .3, k)); cor = mix(cor, fora, smoothstep(.3, .9, k));
        float i = borda * fios * grao * doppler * (1.25 - k) * 1.6;
        gl_FragColor = vec4(cor * i, i);
      }`
  })));
  disco.renderOrder = -2; bn.add(disco);
  const texA = G(texAnel(.42, .6, .05)), texB = G(texBrilho());
  // anel de fotons (fino, colado no horizonte) e o arco de cima (o disco de tras, dobrado pela gravidade)
  const fotons = new THREE.Sprite(G(new THREE.SpriteMaterial({ map: texA, color: 0xffd6ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
  fotons.scale.setScalar(raio * 4.6); bn.add(fotons);
  const arco = new THREE.Sprite(G(new THREE.SpriteMaterial({ map: G(texAnel(.62, .8, .08)), color: 0xc9a6ff, transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
  arco.scale.setScalar(raio * 6.4); bn.add(arco);
  const halo = new THREE.Sprite(G(new THREE.SpriteMaterial({ map: texB, color: 0x7a4dff, transparent: true, opacity: .32, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
  halo.scale.setScalar(raio * 14); halo.renderOrder = -3; bn.add(halo);

  /* ---- meteoros ---- */
  const matPedra = G(new THREE.MeshStandardMaterial({ color: 0x2a2030, roughness: .9, flatShading: true, emissive: new THREE.Color(0xff7a3c), emissiveIntensity: .9, fog: false }));
  const geoPedra = G(new THREE.IcosahedronGeometry(.13, 0));
  const geoRastro = G(new THREE.PlaneGeometry(1, 1)); geoRastro.translate(-.5, 0, 0);   // a ponta fica na pedra
  const matRastro = () => G(new THREE.ShaderMaterial({
    uniforms: { uCor: { value: new THREE.Color(0xffb0e8) }, uA: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 uCor; uniform float uA; varying vec2 vU; void main(){ float l = vU.x; float lado = 1. - abs(vU.y - .5) * 2.; float a = pow(l, 2.2) * pow(lado, 1.5) * uA; gl_FragColor = vec4(mix(uCor, vec3(1.), l * l) * a, a); }'
  }));
  const meteoros = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Group(); m.visible = false;
    const pedra = new THREE.Mesh(geoPedra, matPedra); m.add(pedra);
    const brasa = new THREE.Sprite(G(new THREE.SpriteMaterial({ map: texB, color: 0xffa060, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }))); brasa.scale.setScalar(.7); m.add(brasa);
    const rastro = new THREE.Mesh(geoRastro, matRastro()); m.add(rastro);
    grupo.add(m);
    meteoros.push({ m, pedra, rastro, vida: 0, dur: 1, de: new THREE.Vector3(), para: new THREE.Vector3(), giro: new THREE.Vector3() });
  }
  let proximo = 3;
  const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _d = new THREE.Vector3(), _c = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _m = new THREE.Matrix4();
  function lancar() {
    const m = meteoros.find((x) => x.vida <= 0); if (!m) return;
    // plano atras do sistema, de frente para a camera
    camera.getWorldDirection(_f); _r.set(1, 0, 0).applyQuaternion(camera.quaternion); _u.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const centro = _c.copy(camera.position).addScaledVector(_f, camera.position.length() + 9);
    const lado = Math.random() < .5 ? -1 : 1, alto = 5 + Math.random() * 6;
    m.de.copy(centro).addScaledVector(_r, -lado * (16 + Math.random() * 6)).addScaledVector(_u, alto);
    m.para.copy(centro).addScaledVector(_r, lado * (10 + Math.random() * 10)).addScaledVector(_u, alto - 8 - Math.random() * 8);
    m.dur = 2.2 + Math.random() * 1.6; m.vida = m.dur; m.m.visible = true;
    m.giro.set(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(6);
    m.rastro.material.uniforms.uCor.value.setHSL(.83 + Math.random() * .12, .9, .7);
  }

  return {
    grupo,
    atualizar(t, dt) {
      uDisco.uT.value = t;
      arco.material.opacity = .4 + Math.sin(t * .7) * .06;
      // o disco fica sempre de lado para a camera (inclinado), como nas fotos
      bn.lookAt(camera.position); disco.rotation.set(1.32, 0, .18);
      // meteoros
      proximo -= dt;
      if (proximo <= 0) { lancar(); if (Math.random() < .25) setTimeout(lancar, 250 + Math.random() * 500); proximo = 5 + Math.random() * 6; }
      for (const m of meteoros) {
        if (m.vida <= 0) continue;
        m.vida -= dt; const k = 1 - m.vida / m.dur;
        if (m.vida <= 0) { m.m.visible = false; continue; }
        m.m.position.lerpVectors(m.de, m.para, k);
        m.pedra.rotation.x += m.giro.x * dt; m.pedra.rotation.y += m.giro.y * dt;
        // rastro: comprido para tras, virado para a camera
        _d.subVectors(m.para, m.de).normalize();
        _z.subVectors(camera.position, m.m.position).normalize();
        _x.copy(_d); _y.crossVectors(_z, _x).normalize(); _z.crossVectors(_x, _y);   // a fita vai de x=-1 (cauda) a 0 (pedra)
        _m.makeBasis(_x, _y, _z); m.rastro.quaternion.setFromRotationMatrix(_m);
        const comp = 3.2 * Math.min(1, k * 4); m.rastro.scale.set(comp, .16, 1);
        m.rastro.position.set(0, 0, 0);
        m.rastro.material.uniforms.uA.value = Math.min(1, m.vida * 2) * Math.min(1, k * 6);
      }
    },
    destruir() { lixo.forEach((o) => o.dispose && o.dispose()); }
  };
}
