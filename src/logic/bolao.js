'use strict';

/**
 * bolao.js — pontuação dos palpites e classificação do bolão.
 *
 * Camadas mutuamente exclusivas (maior pontuação aplicável), de config.bolao:
 *   15 — placar exato (mandante e visitante batem)
 *   10 — acertou o resultado (vencedor certo, ou empate quando foi empate)
 *    5 — acertou o total de gols (soma igual), mas errou o resultado
 *    0 — nada disso
 * Só pontua jogos já realizados; palpite ausente = 0.
 */

const sinal = (n) => (n > 0 ? 1 : n < 0 ? -1 : 0);

/** Pontos de um palpite contra o placar real. */
function pontuar(palpite, placar, cfg) {
  if (!palpite || palpite.mandante == null || palpite.visitante == null) return 0;
  if (!placar || placar.mandante == null || placar.visitante == null) return 0;
  const { mandante: pm, visitante: pv } = palpite;
  const { mandante: rm, visitante: rv } = placar;
  if (pm === rm && pv === rv) return cfg.placarExato;            // 15
  if (sinal(pm - pv) === sinal(rm - rv)) return cfg.resultadoCerto; // 10 (inclui empate)
  if (pm + pv === rm + rv) return cfg.totalGolsCerto;            // 5
  return cfg.erro;                                               // 0
}

/** Índice rápido { usuarioId: { jogoId: palpite } }. */
function indexarPalpites(guesses) {
  const idx = {};
  for (const g of guesses) {
    (idx[g.usuarioId] || (idx[g.usuarioId] = {}))[g.jogoId] = g.palpite;
  }
  return idx;
}

/**
 * Classificação do bolão. Soma os pontos de cada usuário nos jogos realizados.
 * Desempate: nº de placares exatos → nome (alfabético).
 */
function classificacao(users, guesses, matches, cfg) {
  const idx = indexarPalpites(guesses);
  const realizados = matches.filter((m) => m.jogado && m.placar && m.placar.mandante != null);

  const linhas = users.map((u) => {
    const meus = idx[u.id] || {};
    let pontos = 0, exatos = 0, resultado = 0, totalGols = 0, palpitados = 0;
    for (const m of realizados) {
      const p = meus[m.id];
      if (p && p.mandante != null) palpitados++;
      const pts = pontuar(p, m.placar, cfg);
      pontos += pts;
      if (pts === cfg.placarExato) exatos++;
      else if (pts === cfg.resultadoCerto) resultado++;
      else if (pts === cfg.totalGolsCerto) totalGols++;
    }
    return { usuarioId: u.id, nome: u.nome, pontos, exatos, resultado, totalGols, palpitados, jogosAvaliados: realizados.length };
  });

  linhas.sort((a, b) => b.pontos - a.pontos || b.exatos - a.exatos || a.nome.localeCompare(b.nome, 'pt-BR'));

  let pos = 0, ant = null;
  linhas.forEach((l, i) => { if (l.pontos !== ant) { pos = i + 1; ant = l.pontos; } l.posicao = pos; });
  return linhas;
}

module.exports = { pontuar, indexarPalpites, classificacao };
