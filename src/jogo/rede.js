import * as THREE from 'three';
import PartySocket from 'partysocket';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as clonarEsqueleto } from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * Multiplayer: conecta na SALA do lugar onde o jogador esta ("espaco" ou
 * "planeta-<area>") no servidor da Cloudflare (party/index.js) e
 *  - manda o estado ~10x/s (posicao, rumo, modo, arma) e os tiros;
 *  - desenha os outros jogadores: astronauta animado (a pe) ou a nave, com
 *    o nome em cima (vermelho e com barra de vida quando o PvP dele esta
 *    ligado), indo suave ate a ultima posicao recebida;
 *  - PvP: liga/desliga, manda "acertei fulano" (o servidor confere e aplica).
 * aoEvento(tipo, dados) avisa o jogo: 'tiro', 'vida', 'morte', 'renasceu',
 * 'placar', 'entrou', 'saiu', 'conectado', 'erro'.
 */
export function criarRede({ token, host, modeloNave, aoEvento }) {
  let sock = null, sala = null, meuId = null, enviadoEm = 0;
  const remotos = new Map();
  let astroGltf = null;
  new GLTFLoader().loadAsync('/assets/jogo/astronauta.glb').then((g) => { astroGltf = g; }).catch(() => {});

  function entrar(nova) {
    if (nova === sala) return;
    sala = nova;
    for (const r of remotos.values()) removerVisual(r);
    remotos.clear();
    if (sock) { sock.onmessage = null; sock.close(); }
    sock = new PartySocket({ host, party: 'sala', room: sala, query: { token } });
    sock.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } receber(m); };
    sock.onclose = (e) => { if (e.code === 4001) { aoEvento('erro', { msg: 'faça login de novo para jogar online' }); sock.close(); } };
  }

  function receber(m) {
    if (m.t === 'oi') { meuId = m.id; m.jogadores.forEach((j) => atualizarRemoto(j, true)); aoEvento('conectado', { id: m.id, nome: m.nome, n: remotos.size }); }
    else if (m.t === 'entrou') { atualizarRemoto(m, true); aoEvento('entrou', m); }
    else if (m.t === 'estado') atualizarRemoto(m);
    else if (m.t === 'saiu') { const r = remotos.get(m.id); if (r) { removerVisual(r); remotos.delete(m.id); aoEvento('saiu', { nome: r.nome }); } }
    else if (m.t === 'tiro') aoEvento('tiro', m);
    else if (m.t === 'pvp') { const r = remotos.get(m.id); if (r) { r.pvp = m.on; r.rotuloSujo = true; } aoEvento('pvp', { ...m, eu: m.id === meuId }); }
    else if (m.t === 'vida') { const r = remotos.get(m.id); if (r) { r.vida = m.vida; r.rotuloSujo = true; r.flash = 1; } aoEvento('vida', { ...m, eu: m.id === meuId }); }
    else if (m.t === 'morte') { const r = remotos.get(m.id); if (r) { r.vivo = false; r.rotuloSujo = true; } aoEvento('morte', { ...m, eu: m.id === meuId, fuiEu: m.por === meuId }); }
    else if (m.t === 'renasceu') { const r = remotos.get(m.id); if (r) { r.vivo = true; r.vida = 100; r.rotuloSujo = true; } aoEvento('renasceu', { ...m, eu: m.id === meuId }); }
    else if (m.t === 'placar') aoEvento('placar', m);
    else if (m.t === 'erro') aoEvento('erro', m);
  }

  function atualizarRemoto(j, novo) {
    if (j.id === meuId) return;
    let r = remotos.get(j.id);
    if (!r) {
      r = { id: j.id, nome: j.nome || 'astronauta', pvp: !!j.pvp, vida: j.vida ?? 100, vivo: true, pos: new THREE.Vector3(), alvo: new THREE.Vector3(), rumo: 0, alvoRumo: 0, modo: 'espaco', esc: 1, vel: 0, rotuloSujo: true, flash: 0, obj: null, tipo: null };
      remotos.set(j.id, r); novo = true;
    }
    if (j.nome) r.nome = j.nome;
    if (j.p) { r.alvo.fromArray(j.p); if (novo) r.pos.copy(r.alvo); }
    if (j.r !== undefined) r.alvoRumo = j.r;
    if (j.modo) r.modo = j.modo;
    if (j.esc) r.esc = j.esc;
    if (j.pvp !== undefined) { r.pvp = j.pvp; r.rotuloSujo = true; }
  }

  /* ---- visual de cada jogador ---- */
  function criarVisual(r, tipo) {
    removerVisual(r);
    const g = new THREE.Group();
    if (tipo === 'pe' && astroGltf) {
      const m = clonarEsqueleto(astroGltf.scene);
      const cx = new THREE.Box3().setFromObject(m); m.scale.setScalar(1.85 / (cx.max.y - cx.min.y));
      m.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
      g.add(m);
      const mixer = new THREE.AnimationMixer(m), clip = (n) => astroGltf.animations.find((a) => a.name === n);
      const acoes = {}; ['Idle_Neutral', 'Walk', 'Run', 'Idle'].forEach((n) => { const c = clip(n); if (c) { acoes[n] = mixer.clipAction(c); acoes[n].play(); acoes[n].setEffectiveWeight(n === 'Idle_Neutral' ? 1 : 0); } });
      r.mixer = mixer; r.acoes = acoes;
    } else if (tipo === 'nave' && modeloNave) {
      const m = modeloNave.clone(true); const corpo = new THREE.Group(); corpo.add(m); g.add(corpo);
      // chama do propulsor
      const ch = new THREE.Mesh(new THREE.ConeGeometry(.3, 1.6, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xb48cff, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }));
      ch.rotation.x = -Math.PI / 2; ch.position.z = -2.4; corpo.add(ch);
      r.mixer = null;
    }
    // nome em cima
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, fog: false }));
    sp.renderOrder = 20; g.add(sp);
    r.obj = g; r.tipo = tipo; r.rotulo = { cv, tex, sp }; r.rotuloSujo = true;
  }
  function removerVisual(r) {
    if (!r.obj) return;
    r.obj.parent?.remove(r.obj);
    r.obj.traverse((o) => { if (o.isMesh && o.material && !o.isSkinnedMesh) { /* materiais do clone sao compartilhados */ } });
    r.rotulo?.tex.dispose(); r.rotulo?.sp.material.dispose();
    r.obj = null; r.tipo = null;
  }
  function desenharRotulo(r) {
    const { cv, tex } = r.rotulo, c = cv.getContext('2d');
    c.clearRect(0, 0, 256, 64);
    c.font = '800 26px ui-monospace, Menlo, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.75)'; c.strokeText((r.pvp ? '⚔ ' : '') + r.nome, 128, 22);
    c.fillStyle = r.pvp ? '#ff6b6b' : '#e9e2ff'; c.fillText((r.pvp ? '⚔ ' : '') + r.nome, 128, 22);
    if (r.pvp) { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(48, 44, 160, 10); c.fillStyle = r.vida > 35 ? '#2bff8f' : '#ff5f57'; c.fillRect(48, 44, 160 * Math.max(0, r.vida) / 100, 10); }
    tex.needsUpdate = true; r.rotuloSujo = false;
  }

  const _v = new THREE.Vector3();
  return {
    get sala() { return sala; }, get meuId() { return meuId; }, remotos,
    entrar,
    /** estado do jogador local (limitado a ~10 por segundo) */
    estado(e) {
      const agora = performance.now(); if (!sock || agora - enviadoEm < 100) return; enviadoEm = agora;
      sock.send(JSON.stringify({ t: 'estado', p: [+e.p.x.toFixed(2), +e.p.y.toFixed(2), +e.p.z.toFixed(2)], r: +e.r.toFixed(3), modo: e.modo, arma: e.arma, esc: e.esc }));
    },
    tiro(o, d, arma) { sock?.send(JSON.stringify({ t: 'tiro', o: [o.x, o.y, o.z].map((v) => +v.toFixed(2)), d: [d.x, d.y, d.z].map((v) => +v.toFixed(3)), arma })); },
    pvp(on) { sock?.send(JSON.stringify({ t: 'pvp', on })); },
    acerto(alvo, arma) { sock?.send(JSON.stringify({ t: 'acerto', alvo, arma })); },
    /** jogador remoto perto de p (para os tiros): devolve o remoto ou null */
    remotoEm(p) {
      for (const r of remotos.values()) {
        if (!r.obj || !r.vivo || r.modo === 'cinema') continue;
        if (r.tipo === 'pe') { _v.copy(r.pos); _v.y += 1; if (_v.distanceTo(p) < 1.2) return r; }
        else if (r.pos.distanceTo(p) < 3.2 * r.esc) return r;
      }
      return null;
    },
    atualizar(dt, cena) {
      for (const r of remotos.values()) {
        const tipo = r.modo === 'cinema' ? null : r.modo === 'pe' ? 'pe' : 'nave';
        if (tipo !== r.tipo) { if (tipo) criarVisual(r, tipo); else removerVisual(r); }
        if (!r.obj) continue;
        if (r.obj.parent !== cena) cena.add(r.obj);
        // vai suave ate a ultima posicao recebida (teleporte se longe demais)
        const d = r.pos.distanceTo(r.alvo);
        if (d > 300) r.pos.copy(r.alvo); else r.pos.lerp(r.alvo, 1 - Math.exp(-dt * 10));
        r.vel += ((d / Math.max(dt, .001)) * .1 - r.vel) * (1 - Math.exp(-dt * 6));
        r.rumo += Math.atan2(Math.sin(r.alvoRumo - r.rumo), Math.cos(r.alvoRumo - r.rumo)) * (1 - Math.exp(-dt * 10));
        r.obj.position.copy(r.pos); r.obj.rotation.y = r.rumo;
        r.obj.visible = r.vivo;
        if (r.tipo === 'nave') r.obj.scale.setScalar(r.esc);
        if (r.mixer) {
          const v = Math.min(8, r.vel), a = r.acoes;
          a.Idle_Neutral?.setEffectiveWeight(Math.max(0, 1 - v / 1.2)); a.Walk?.setEffectiveWeight(Math.max(0, Math.min(1, v / 1.2) - Math.max(0, (v - 3) / 2))); a.Run?.setEffectiveWeight(Math.max(0, Math.min(1, (v - 3) / 2)));
          r.mixer.update(dt);
        }
        // rotulo acima (a pe: da cabeca; nave: um pouco acima)
        const sp = r.rotulo.sp; sp.position.set(0, r.tipo === 'pe' ? 2.35 : 2.2 * 1, 0);
        const esc = r.tipo === 'nave' ? 1 / r.esc : 1; sp.scale.set(2.6 * esc * (r.tipo === 'nave' ? 3 : 1), .65 * esc * (r.tipo === 'nave' ? 3 : 1), 1);
        if (r.rotuloSujo) desenharRotulo(r);
      }
    },
    fechar() { if (sock) { sock.onmessage = null; sock.close(); } for (const r of remotos.values()) removerVisual(r); remotos.clear(); }
  };
}
