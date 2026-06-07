'use strict';

/**
 * fairplay.js — pontuação de conduta (fair play) e contagem de cartões.
 *
 * Regra FIFA (config.fairPlay), aplicada por jogador em cada jogo, tomando a
 * combinação mais severa:
 *   - 1 amarelo ............................... amarelo            (−1)
 *   - 2º amarelo (expulsão por 2 amarelos) .... segundoAmarelo     (−3)
 *   - vermelho direto ......................... vermelhoDireto     (−4)
 *   - amarelo + vermelho direto ............... amareloMaisVermelho(−5)
 *
 * Eventos de cartão em `matches.json`:
 *   { tipo:'amarelo',  timeId, jogador, minuto }
 *   { tipo:'vermelho', subtipo:'direto'|'segundo-amarelo', timeId, jogador, minuto }
 */

/** Penalidade de fair play por time num único jogo. → { timeId: pontosNegativos } */
function pontosFairPlayNoJogo(jogo, config) {
  const fp = config.fairPlay;
  const jogadores = new Map(); // chave -> { timeId, amarelos, vd, vs }
  let anon = 0;

  for (const ev of jogo.eventos || []) {
    if (ev.tipo !== 'amarelo' && ev.tipo !== 'vermelho') continue;
    // Agrupa por jogador; cartões sem jogador identificado contam isolados.
    const chave = ev.jogador ? `${ev.timeId}|${ev.jogador}` : `${ev.timeId}|#${anon++}`;
    let j = jogadores.get(chave);
    if (!j) { j = { timeId: ev.timeId, amarelos: 0, vd: 0, vs: 0 }; jogadores.set(chave, j); }
    if (ev.tipo === 'amarelo') j.amarelos++;
    else if (ev.subtipo === 'segundo-amarelo') j.vs++;
    else j.vd++; // vermelho direto (padrão)
  }

  const porTime = {};
  for (const j of jogadores.values()) {
    let p = 0;
    if (j.vd > 0 && j.amarelos > 0) p = fp.amareloMaisVermelho;
    else if (j.vd > 0) p = fp.vermelhoDireto;
    else if (j.vs > 0 || j.amarelos >= 2) p = fp.segundoAmarelo;
    else if (j.amarelos === 1) p = fp.amarelo;
    porTime[j.timeId] = (porTime[j.timeId] || 0) + p;
  }
  return porTime;
}

/** Contagem bruta de cartões por time num jogo (para exibição). → { timeId: {amarelos, vermelhos} } */
function cartoesNoJogo(jogo) {
  const out = {};
  for (const ev of jogo.eventos || []) {
    if (ev.tipo !== 'amarelo' && ev.tipo !== 'vermelho') continue;
    const t = out[ev.timeId] || (out[ev.timeId] = { amarelos: 0, vermelhos: 0 });
    if (ev.tipo === 'amarelo') t.amarelos++;
    else t.vermelhos++;
  }
  return out;
}

/**
 * Totais de fair play e cartões por time, somando todos os jogos informados.
 * @returns {Object} { timeId: { pontos, amarelos, vermelhos } }
 */
function fairPlayTotais(jogos, config) {
  const tot = {};
  const garante = (id) => (tot[id] || (tot[id] = { pontos: 0, amarelos: 0, vermelhos: 0 }));
  for (const jogo of jogos) {
    const pts = pontosFairPlayNoJogo(jogo, config);
    for (const [id, p] of Object.entries(pts)) garante(id).pontos += p;
    const cart = cartoesNoJogo(jogo);
    for (const [id, c] of Object.entries(cart)) {
      const g = garante(id);
      g.amarelos += c.amarelos;
      g.vermelhos += c.vermelhos;
    }
  }
  return tot;
}

module.exports = { pontosFairPlayNoJogo, cartoesNoJogo, fairPlayTotais };
