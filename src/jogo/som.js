/**
 * Sons do jogo, todos sintetizados na hora (Web Audio): nada para baixar.
 *  - motor: dois serrotes desafinados + ruido filtrado; volume pelo empuxo,
 *    tom pela velocidade;
 *  - vento/ronco: ruido grave (reentrada, camada de gas, velocidade da luz);
 *  - jetpack: chiado de ruido em banda;
 *  - avulsos: tiro, explosao, dobra (entrar na velocidade da luz), passo,
 *    pouso, bip de interface e o acorde de conquista.
 * O navegador so libera o audio depois de um gesto: `destravar()` e chamado
 * no primeiro clique/tecla. M = mudo e lembrado no localStorage.
 */
export function criarSom() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return semSom();
  const ctx = new AC();
  let mudo = false;
  try { mudo = localStorage.getItem('jogo-mudo') === '1'; } catch (e) { /* */ }
  const mestre = ctx.createGain(); mestre.gain.value = mudo ? 0 : .55; mestre.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor(); comp.connect(mestre);

  // ruido branco (2 s, em loop)
  const ruidoBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  { const d = ruidoBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const ruido = () => { const s = ctx.createBufferSource(); s.buffer = ruidoBuf; s.loop = true; return s; };

  /* ---- continuos (so tocam quando tem motivo: acelerando, jetpack, reentrada) ---- */
  // motor: sopro grave de ruido filtrado + um grave senoidal bem baixo; parado
  // (sem acelerar) fica em silencio — nada de zumbido constante
  const motorG = ctx.createGain(); motorG.gain.value = 0; motorG.connect(comp);
  const motorF = ctx.createBiquadFilter(); motorF.type = 'lowpass'; motorF.frequency.value = 300; motorF.Q.value = .7; motorF.connect(motorG);
  const motorR = ruido(); motorR.connect(motorF);
  const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 48;
  const oG = ctx.createGain(); oG.gain.value = .35; o1.connect(oG); oG.connect(motorG);
  const o2 = ctx.createOscillator(); o2.frequency.value = 1; // (sem uso: mantem o start/stop simples)

  const ventoG = ctx.createGain(); ventoG.gain.value = 0; ventoG.connect(comp);
  const ventoF = ctx.createBiquadFilter(); ventoF.type = 'lowpass'; ventoF.frequency.value = 300; ventoF.connect(ventoG);
  const vento = ruido(); vento.connect(ventoF);

  const jetG = ctx.createGain(); jetG.gain.value = 0; jetG.connect(comp);
  const jetF = ctx.createBiquadFilter(); jetF.type = 'bandpass'; jetF.frequency.value = 1400; jetF.Q.value = .6; jetF.connect(jetG);
  const jet = ruido(); jet.connect(jetF);

  let ligados = false;
  function ligar() { if (ligados) return; ligados = true; [o1, o2, motorR, vento, jet].forEach((n) => n.start()); }
  const agora = () => ctx.currentTime;
  const alvo = (p, v, t = .08) => p.setTargetAtTime(v, agora(), t);

  /* ---- avulsos ---- */
  function envelope(g, pico, ataque, queda) {
    const t = agora(); g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(pico, t + ataque); g.gain.exponentialRampToValueAtTime(0.0001, t + ataque + queda);
  }
  function tiro() {
    // "pew": dois tons descendo rapido, um pouco desafinados
    const t = agora(), g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200;
    f.connect(g); g.connect(comp); envelope(g, .13, .003, .14);
    [[1900, 'square'], [1420, 'sawtooth']].forEach(([fr, tipo]) => {
      const o = ctx.createOscillator(); o.type = tipo;
      o.frequency.setValueAtTime(fr, t); o.frequency.exponentialRampToValueAtTime(fr * .14, t + .13);
      o.connect(f); o.start(t); o.stop(t + .18);
    });
  }
  function explosao(forca = 1) {
    const s = ruido(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'lowpass';
    const t = agora(); f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(90, t + .9);
    s.connect(f); f.connect(g); g.connect(comp); envelope(g, .9 * forca, .01, .9); s.start(t); s.stop(t + 1.1);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(30, t + .5);
    o.connect(og); og.connect(comp); envelope(og, .7 * forca, .01, .5); o.start(t); o.stop(t + .6);
  }
  function dobra() {
    const s = ruido(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.Q.value = 2;
    const t = agora(); f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(4000, t + 1.2);
    s.connect(f); f.connect(g); g.connect(comp); envelope(g, .5, .3, 1.1); s.start(t); s.stop(t + 1.6);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(900, t + 1.1);
    o.connect(og); og.connect(comp); envelope(og, .18, .2, 1); o.start(t); o.stop(t + 1.4);
  }
  function passo(corrida) {
    const s = ruido(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'lowpass'; f.frequency.value = corrida ? 700 : 500;
    s.connect(f); f.connect(g); g.connect(comp); envelope(g, corrida ? .22 : .14, .004, .09); const t = agora(); s.start(t); s.stop(t + .15);
  }
  function pouso() { explosao(.35); }
  function bip(freq = 880, dur = .09) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = freq;
    o.connect(g); g.connect(comp); envelope(g, .15, .005, dur); const t = agora(); o.start(t); o.stop(t + dur + .05);
  }
  function conquista() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => bip(f, .25), i * 110)); }
  function porta() { bip(440, .08); setTimeout(() => bip(660, .12), 80); }

  return {
    destravar() { if (ctx.state !== 'running') ctx.resume().catch(() => {}); ligar(); },
    /** a cada quadro: empuxo 0..1, vel (m/s), ronco 0..1 (reentrada/gas/dobra), jetpack 0..1 */
    atualizar({ empuxo = 0, vel = 0, ronco = 0, jet = 0, ligado = true }) {
      if (!ligados) return;
      const acel = Math.max(0, (empuxo - .2) / .8);
      alvo(motorG.gain, ligado ? acel * .32 : 0, .12);
      alvo(o1.frequency, 40 + acel * 22 + Math.min(1, vel / 900) * 18);
      alvo(motorF.frequency, 180 + acel * 700 + Math.min(1, vel / 900) * 400);
      alvo(ventoG.gain, ronco * .9, .2); alvo(ventoF.frequency, 200 + ronco * 900, .2);
      alvo(jetG.gain, jet * .35, .06);
    },
    tiro, explosao, dobra, passo, pouso, bip, conquista, porta,
    get mudo() { return mudo; },
    alternarMudo() {
      mudo = !mudo; alvo(mestre.gain, mudo ? 0 : .55, .05);
      try { localStorage.setItem('jogo-mudo', mudo ? '1' : '0'); } catch (e) { /* */ }
      return mudo;
    },
    fechar() { try { ctx.close(); } catch (e) { /* */ } }
  };
}
function semSom() {
  const nada = () => {};
  return { destravar: nada, atualizar: nada, tiro: nada, explosao: nada, dobra: nada, passo: nada, pouso: nada, bip: nada, conquista: nada, porta: nada, mudo: true, alternarMudo: () => true, fechar: nada };
}
