'use strict';

/**
 * standings.js — classificação de um grupo com os critérios de desempate da
 * FIFA 2026 (Art. 13), nesta ordem (config.criteriosDesempate):
 *   1. Pontos (geral)
 *   2. Confronto direto entre os empatados: pontos → saldo → gols
 *      (reaplicado se um subgrupo continuar empatado)
 *   3. Saldo de gols geral
 *   4. Gols marcados geral
 *   5. Fair play
 *   6. Ranking FIFA
 *   7. Sorteio (entrada manual; fallback: ordem alfabética — marca "provisório")
 */

/** Estatísticas considerando apenas jogos entre os times de `ids`. */
function estatisticas(ids, jogos, pontosCfg) {
  const PV = pontosCfg.vitoria, PE = pontosCfg.empate, PD = pontosCfg.derrota;
  const set = new Set(ids);
  const st = {};
  for (const id of ids) st[id] = { timeId: id, pts: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0 };

  for (const jogo of jogos) {
    if (!jogo.jogado) continue;
    if (jogo.mandante.tipo !== 'time' || jogo.visitante.tipo !== 'time') continue;
    const m = jogo.mandante.ref, v = jogo.visitante.ref;
    if (!set.has(m) || !set.has(v)) continue;
    const gm = jogo.placar.mandante, gv = jogo.placar.visitante;
    if (gm == null || gv == null) continue;

    st[m].j++; st[v].j++;
    st[m].gp += gm; st[m].gc += gv;
    st[v].gp += gv; st[v].gc += gm;
    if (gm > gv) { st[m].pts += PV; st[m].v++; st[v].pts += PD; st[v].d++; }
    else if (gm < gv) { st[v].pts += PV; st[v].v++; st[m].pts += PD; st[m].d++; }
    else { st[m].pts += PE; st[v].pts += PE; st[m].e++; st[v].e++; }
  }
  for (const id of ids) st[id].sg = st[id].gp - st[id].gc;
  return st;
}

/** Agrupa um array já ordenado em blocos consecutivos de mesma chave. */
function blocosConsecutivos(arr, chaveFn) {
  const out = [];
  let atual = null, chaveAtual = Symbol('init');
  for (const x of arr) {
    const k = chaveFn(x);
    if (k !== chaveAtual) { atual = []; out.push(atual); chaveAtual = k; }
    atual.push(x);
  }
  return out;
}

/**
 * Ordena os times de um grupo. Retorna { ordem: [ids...], overall, provisorio }.
 */
function ordenarGrupo(ids, jogosGrupo, ctx) {
  const overall = estatisticas(ids, jogosGrupo, ctx.pontos);
  const estado = { provisorio: false };

  const cmpH2H = (a, b) =>
    b.pts - a.pts || b.sg - a.sg || b.gp - a.gp;
  const chaveH2H = (s) => `${s.pts}|${s.sg}|${s.gp}`;

  // Critérios 3→7 (saldo geral, gols geral, fair play, ranking FIFA, sorteio/alfabético)
  function desempateGeral(cluster) {
    return [...cluster].sort((a, b) => {
      const oa = overall[a], ob = overall[b];
      if (ob.sg !== oa.sg) return ob.sg - oa.sg;
      if (ob.gp !== oa.gp) return ob.gp - oa.gp;
      const fa = ctx.fairPlay[a] || 0, fb = ctx.fairPlay[b] || 0;
      if (fb !== fa) return fb - fa;                       // menos negativo é melhor
      const ra = ctx.rank[a], rb = ctx.rank[b];
      if (ra !== rb) return ra - rb;                       // menor ranking FIFA é melhor
      const sa = ctx.sorteio[a], sb = ctx.sorteio[b];
      if (sa != null && sb != null && sa !== sb) return sa - sb;
      estado.provisorio = true;                            // caiu no fallback alfabético
      return ctx.nome[a].localeCompare(ctx.nome[b], 'pt-BR');
    });
  }

  // Critério 2: confronto direto, recursivo enquanto separar parcialmente.
  function desempateConfronto(cluster) {
    if (cluster.length === 1) return cluster;
    const h2h = estatisticas(cluster, jogosGrupo, ctx.pontos);
    const ordenado = [...cluster].sort((a, b) => cmpH2H(h2h[a], h2h[b]));
    const subs = blocosConsecutivos(ordenado, (id) => chaveH2H(h2h[id]));
    const out = [];
    for (const sub of subs) {
      if (sub.length === 1) out.push(sub[0]);
      else if (sub.length === cluster.length) out.push(...desempateGeral(sub)); // nada separou
      else out.push(...desempateConfronto(sub));                                // reaplica nos restantes
    }
    return out;
  }

  // Critério 1: pontos gerais; depois resolve cada empate.
  const porPontos = [...ids].sort((a, b) => overall[b].pts - overall[a].pts);
  const clusters = blocosConsecutivos(porPontos, (id) => overall[id].pts);
  const ordem = [];
  for (const c of clusters) ordem.push(...(c.length === 1 ? c : desempateConfronto(c)));

  return { ordem, overall, provisorio: estado.provisorio };
}

/**
 * Classificação completa de um grupo (objeto pronto para a API).
 * @param {string} grupo  letra A–L
 * @param {Object} dados  { groups, matches, teamsById, config, fairPlayTot, sorteio }
 */
function classificarGrupo(grupo, dados) {
  const { groups, matches, teamsById, config, fairPlayTot, sorteio = {} } = dados;
  const ids = groups[grupo];
  const jogosGrupo = matches.filter((m) => m.fase === 'grupo' && m.grupo === grupo);
  const completo = jogosGrupo.length > 0 && jogosGrupo.every((m) => m.jogado);

  const ctx = {
    pontos: config.pontos,
    fairPlay: Object.fromEntries(ids.map((id) => [id, (fairPlayTot[id] || {}).pontos || 0])),
    rank: Object.fromEntries(ids.map((id) => [id, (teamsById[id] || {}).rankingFifa || 9999])),
    nome: Object.fromEntries(ids.map((id) => [id, (teamsById[id] || {}).nome || id])),
    sorteio,
  };

  const { ordem, overall, provisorio } = ordenarGrupo(ids, jogosGrupo, ctx);

  const times = ordem.map((id, i) => {
    const o = overall[id];
    const fp = fairPlayTot[id] || { pontos: 0, amarelos: 0, vermelhos: 0 };
    const t = teamsById[id] || {};
    const posicao = i + 1;
    const zona = posicao <= 2 ? (completo ? 'classificado' : 'classificando')
      : posicao === 3 ? 'terceiro' : 'eliminado';
    return {
      posicao, timeId: id, nome: t.nome || id, sigla: t.sigla || id,
      pts: o.pts, j: o.j, v: o.v, e: o.e, d: o.d,
      gp: o.gp, gc: o.gc, sg: o.sg,
      amarelos: fp.amarelos, vermelhos: fp.vermelhos,
      fairPlay: fp.pontos, rankingFifa: t.rankingFifa || null,
      zona,
    };
  });

  return { grupo, completo, provisorio, times };
}

module.exports = { estatisticas, ordenarGrupo, classificarGrupo, blocosConsecutivos };
