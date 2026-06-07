'use strict';

/**
 * bracket.js — projeção do mata-mata (16-avos → final + disputa de 3º).
 *
 * Resolve os "slots" dos 32 jogos de mata-mata a partir de:
 *  - classificação de cada grupo (1º, 2º, 3º) — projeção "de momento";
 *  - Anexo C, para alocar os 8 terceiros aos jogos certos;
 *  - resultados já inseridos, propagando vencedores (e perdedores das semis
 *    para a disputa de 3º lugar).
 *
 * Um terceiro nunca enfrenta o vencedor do próprio grupo (garantido pelo Anexo C).
 */

const FASES = {
  '16avos': '16-avos de final',
  oitavas: 'Oitavas de final',
  quartas: 'Quartas de final',
  semi: 'Semifinais',
  terceiro: 'Disputa de 3º lugar',
  final: 'Final',
};

/** Rótulo pt-BR para um slot do chaveamento. */
function rotuloSlot(ref) {
  let m;
  if ((m = ref.match(/^Winner Group ([A-L])$/))) return `1º Grupo ${m[1]}`;
  if ((m = ref.match(/^Runner-up Group ([A-L])$/))) return `2º Grupo ${m[1]}`;
  if ((m = ref.match(/^Winner Match (\d+)$/))) return `Vencedor Jogo ${m[1]}`;
  if ((m = ref.match(/^Loser Match (\d+)$/))) return `Perdedor Jogo ${m[1]}`;
  if (ref.startsWith('3rd Group')) return `3º (${ref.replace('3rd Group ', '')})`;
  return ref;
}

/** Decide vencedor/perdedor de um jogo de mata-mata já realizado. */
function decidir(jogo, mandanteId, visitanteId) {
  const gm = jogo.placar.mandante, gv = jogo.placar.visitante;
  if (gm == null || gv == null) return null;
  if (gm > gv) return { vencedorId: mandanteId, perdedorId: visitanteId };
  if (gv > gm) return { vencedorId: visitanteId, perdedorId: mandanteId };
  // empate → pênaltis
  const pm = jogo.penaltis ? jogo.penaltis.mandante : null;
  const pv = jogo.penaltis ? jogo.penaltis.visitante : null;
  if (pm == null || pv == null || pm === pv) return null;
  return pm > pv
    ? { vencedorId: mandanteId, perdedorId: visitanteId }
    : { vencedorId: visitanteId, perdedorId: mandanteId };
}

/**
 * @param {Object} dados { matches, classificacaoPorGrupo, comboQualificados, anexoC, teamsById }
 *   classificacaoPorGrupo: { A: {times:[...]}, ... }
 * @returns {{ rodadas: Array, mapa: Object }}
 *   mapa: { matchId: { mandanteId, visitanteId, vencedorId, perdedorId } }
 */
function montarChave(dados) {
  const { matches, classificacaoPorGrupo, comboQualificados, anexoC, teamsById } = dados;

  const pos = (grupo, p) => {
    const g = classificacaoPorGrupo[grupo];
    if (!g) return null;
    const t = g.times.find((x) => x.posicao === p);
    return t ? t.timeId : null;
  };
  const winners = {}, runners = {}, thirds = {};
  for (const grupo of Object.keys(classificacaoPorGrupo)) {
    winners[grupo] = pos(grupo, 1);
    runners[grupo] = pos(grupo, 2);
    thirds[grupo] = pos(grupo, 3);
  }
  const allocation = (anexoC.combinacoes || {})[comboQualificados] || null;
  const grupoCompleto = (g) => !!(classificacaoPorGrupo[g] && classificacaoPorGrupo[g].completo);
  const todosGruposCompletos = Object.keys(classificacaoPorGrupo).length === 12
    && Object.values(classificacaoPorGrupo).every((c) => c.completo);

  const knockout = matches.filter((m) => m.fase !== 'grupo')
    .sort((a, b) => a.numero - b.numero);

  const resultados = {}; // numero -> {vencedorId, perdedorId}

  function resolverLado(lado, jogo) {
    if (lado.tipo === 'time') return lado.ref;
    const ref = lado.ref;
    let m;
    if ((m = ref.match(/^Winner Group ([A-L])$/))) return winners[m[1]] || null;
    if ((m = ref.match(/^Runner-up Group ([A-L])$/))) return runners[m[1]] || null;
    if ((m = ref.match(/^Winner Match (\d+)$/))) return (resultados[+m[1]] || {}).vencedorId || null;
    if ((m = ref.match(/^Loser Match (\d+)$/))) return (resultados[+m[1]] || {}).perdedorId || null;
    if (ref.startsWith('3rd Group')) {
      // Anexo C: o grupo do 3º depende do vencedor que ele enfrenta (mandante).
      const mh = jogo.mandante.ref.match(/Winner Group ([A-L])/);
      if (!mh || !allocation) return null;
      const grupoDoTerceiro = allocation[mh[1]];
      return grupoDoTerceiro ? (thirds[grupoDoTerceiro] || null) : null;
    }
    return null;
  }

  // Propagação iterativa (Winner/Loser Match dependem de jogos anteriores).
  for (let passo = 0; passo < 7; passo++) {
    for (const jogo of knockout) {
      const mandanteId = resolverLado(jogo.mandante, jogo);
      const visitanteId = resolverLado(jogo.visitante, jogo);
      if (mandanteId && visitanteId && jogo.jogado) {
        const r = decidir(jogo, mandanteId, visitanteId);
        if (r) resultados[jogo.numero] = r;
      }
    }
  }

  // Um lado está "definido" quando vem de um resultado real (não de projeção):
  // 1º/2º de grupo → grupo encerrado; 3º → todos os grupos encerrados;
  // Vencedor/Perdedor de jogo → aquele jogo já decidido.
  function definidoSlot(lado) {
    if (lado.tipo === 'time') return true;
    let m;
    if ((m = lado.ref.match(/^Winner Group ([A-L])$/)) || (m = lado.ref.match(/^Runner-up Group ([A-L])$/)))
      return grupoCompleto(m[1]);
    if (lado.ref.startsWith('3rd Group')) return todosGruposCompletos;
    if ((m = lado.ref.match(/^Winner Match (\d+)$/)) || (m = lado.ref.match(/^Loser Match (\d+)$/)))
      return !!resultados[+m[1]];
    return false;
  }

  // Monta saída final
  const mapa = {};
  const ladoSaida = (lado, jogo) => {
    const timeId = resolverLado(lado, jogo);
    const t = timeId ? teamsById[timeId] : null;
    return {
      ref: lado.ref,
      tipo: lado.tipo,
      label: lado.tipo === 'time' ? (t ? t.nome : lado.ref) : rotuloSlot(lado.ref),
      timeId: timeId || null,
      nome: t ? t.nome : null,
      sigla: t ? t.sigla : null,
      definido: definidoSlot(lado),
    };
  };

  const porFase = {};
  for (const jogo of knockout) {
    const mandante = ladoSaida(jogo.mandante, jogo);
    const visitante = ladoSaida(jogo.visitante, jogo);
    const r = resultados[jogo.numero] || {};
    mapa[jogo.id] = {
      mandanteId: mandante.timeId, visitanteId: visitante.timeId,
      vencedorId: r.vencedorId || null, perdedorId: r.perdedorId || null,
    };
    const item = {
      id: jogo.id, numero: jogo.numero, fase: jogo.fase,
      dataHoraUTC: jogo.dataHoraUTC, estadioId: jogo.estadioId,
      mandante, visitante,
      jogado: jogo.jogado, placar: jogo.placar, penaltis: jogo.penaltis,
      vencedorId: r.vencedorId || null, perdedorId: r.perdedorId || null,
    };
    (porFase[jogo.fase] || (porFase[jogo.fase] = [])).push(item);
  }

  const rodadas = Object.keys(FASES)
    .filter((f) => porFase[f])
    .map((f) => ({ fase: f, label: FASES[f], jogos: porFase[f] }));

  return { rodadas, mapa };
}

module.exports = { montarChave, rotuloSlot, decidir, FASES };
