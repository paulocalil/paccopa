'use strict';

/**
 * scorers.js — artilharia. Agrega todos os eventos de gol dos jogos.
 *
 * Eventos de gol: { tipo:'gol', timeId, jogador, minuto, subtipo? }
 *  - subtipo 'contra' (gol contra) NÃO conta para a artilharia.
 *  - subtipo 'penalti' conta normalmente.
 */

/**
 * @param {Array} jogos        matches.json
 * @param {Object} timesPorId  { teamId: {nome, sigla, ...} }
 * @returns {Array} ordenada por gols desc, depois nome. Cada item:
 *   { jogador, timeId, time, sigla, gols, penaltis }
 */
function artilharia(jogos, timesPorId) {
  const mapa = new Map(); // chave: timeId|jogador

  for (const jogo of jogos) {
    for (const ev of jogo.eventos || []) {
      if (ev.tipo !== 'gol') continue;
      if (ev.subtipo === 'contra') continue;        // gol contra não pontua
      if (!ev.jogador) continue;                     // sem autor identificado
      const chave = `${ev.timeId}|${ev.jogador}`;
      let r = mapa.get(chave);
      if (!r) { r = { jogador: ev.jogador, timeId: ev.timeId, gols: 0, penaltis: 0 }; mapa.set(chave, r); }
      r.gols++;
      if (ev.subtipo === 'penalti') r.penaltis++;
    }
  }

  const lista = [...mapa.values()].map((r) => {
    const time = timesPorId[r.timeId] || {};
    return { ...r, time: time.nome || r.timeId, sigla: time.sigla || r.timeId };
  });

  lista.sort((a, b) =>
    b.gols - a.gols ||
    a.time.localeCompare(b.time, 'pt-BR') ||
    a.jogador.localeCompare(b.jogador, 'pt-BR'));

  // posição (com empate compartilhando posição)
  let pos = 0, anterior = null;
  lista.forEach((r, i) => {
    if (r.gols !== anterior) { pos = i + 1; anterior = r.gols; }
    r.posicao = pos;
  });

  return lista;
}

module.exports = { artilharia };
