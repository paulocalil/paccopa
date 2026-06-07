'use strict';

/**
 * thirds.js — ranking dos 12 terceiros colocados e escolha dos 8 melhores.
 *
 * Ordem (mesma família dos critérios gerais, sem confronto direto pois são de
 * grupos diferentes): pontos → saldo geral → gols geral → fair play →
 * ranking FIFA → sorteio (fallback alfabético, marca "provisório").
 */

/**
 * @param {Array} classificacao  saída de classificarGrupo por grupo (12 itens)
 * @returns {{ ranking: Array, comboQualificados: string, provisorio: boolean }}
 *   ranking: [{ posicao, grupo, timeId, nome, sigla, pts, sg, gp, fairPlay, rankingFifa, classificado }]
 *   comboQualificados: 8 letras de grupo ordenadas (chave do Anexo C)
 */
function rankearTerceiros(classificacao) {
  let provisorio = false;

  const terceiros = classificacao
    .map((g) => {
      const t = g.times.find((x) => x.posicao === 3);
      return t ? { ...t, grupo: g.grupo } : null;
    })
    .filter(Boolean);

  terceiros.sort((a, b) =>
    b.pts - a.pts ||
    b.sg - a.sg ||
    b.gp - a.gp ||
    (b.fairPlay || 0) - (a.fairPlay || 0) ||
    (a.rankingFifa || 9999) - (b.rankingFifa || 9999) ||
    (provisorio = true, a.nome.localeCompare(b.nome, 'pt-BR')));

  const ranking = terceiros.map((t, i) => ({
    posicao: i + 1,
    grupo: t.grupo,
    timeId: t.timeId,
    nome: t.nome,
    sigla: t.sigla,
    pts: t.pts, sg: t.sg, gp: t.gp,
    fairPlay: t.fairPlay, rankingFifa: t.rankingFifa,
    classificado: i < 8,
  }));

  const comboQualificados = ranking
    .filter((t) => t.classificado)
    .map((t) => t.grupo)
    .sort()
    .join('');

  return { ranking, comboQualificados, provisorio };
}

module.exports = { rankearTerceiros };
