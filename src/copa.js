'use strict';

/**
 * copa.js — orquestra os módulos de lógica sobre os dados em `data/`.
 * Tudo é recalculado sob demanda a partir dos JSON (nada derivado é persistido).
 */

const storage = require('./storage');
const { fairPlayTotais } = require('./logic/fairplay');
const { classificarGrupo } = require('./logic/standings');
const { rankearTerceiros } = require('./logic/thirds');
const { montarChave } = require('./logic/bracket');
const { artilharia } = require('./logic/scorers');
const { partesBrasilia } = require('./logic/timezone');

const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

/** Carrega todos os dados crus de uma vez. */
function carregar() {
  const teams = storage.readJSON('teams.json', []);
  const teamsById = Object.fromEntries(teams.map((t) => [t.id, t]));
  const stadiums = storage.readJSON('stadiums.json', []);
  const stadiumsById = Object.fromEntries(stadiums.map((s) => [s.id, s]));
  return {
    teams, teamsById, stadiums, stadiumsById,
    groups: storage.readJSON('groups.json', {}),
    matches: storage.readJSON('matches.json', []),
    config: storage.readJSON('config.json', {}),
    anexoC: storage.readJSON('third-place-allocation.json', { combinacoes: {} }),
  };
}

/** Calcula classificação, terceiros, chave e a artilharia de uma só vez. */
function calcular(dados = carregar()) {
  const { teams, teamsById, groups, matches, config, anexoC } = dados;

  const jogosGrupo = matches.filter((m) => m.fase === 'grupo');
  const fairPlayTot = fairPlayTotais(jogosGrupo, config);
  const sorteio = config.sorteioGrupos || {}; // { grupo: { teamId: ordem } } — opcional

  const classificacao = LETRAS
    .filter((g) => groups[g])
    .map((g) => classificarGrupo(g, {
      groups, matches, teamsById, config, fairPlayTot,
      sorteio: sorteio[g] || {},
    }));
  const classificacaoPorGrupo = Object.fromEntries(classificacao.map((c) => [c.grupo, c]));

  const terceiros = rankearTerceiros(classificacao);

  const chave = montarChave({
    matches, classificacaoPorGrupo,
    comboQualificados: terceiros.comboQualificados,
    anexoC, teamsById,
  });

  const artilheiros = artilharia(matches, teamsById);

  return { dados, classificacao, classificacaoPorGrupo, terceiros, chave, artilheiros };
}

/** Lado de um jogo de grupo (sempre um time real → definido). */
function ladoTime(lado, teamsById) {
  const t = teamsById[lado.ref] || {};
  return { tipo: 'time', ref: lado.ref, timeId: lado.ref, label: t.nome || lado.ref, nome: t.nome || lado.ref, sigla: t.sigla || lado.ref, definido: true };
}

/** Lista de jogos enriquecida (com filtros opcionais). */
function jogos(filtros = {}, calc = calcular()) {
  const { dados, chave } = calc;
  const { teamsById, stadiumsById, matches } = dados;

  // Itens de mata-mata já vêm enriquecidos (label, timeId, nome, sigla) do bracket.
  const ladosMata = {};
  for (const r of chave.rodadas) for (const j of r.jogos) ladosMata[j.id] = { mandante: j.mandante, visitante: j.visitante };

  let lista = matches.map((m) => {
    const estadio = stadiumsById[m.estadioId] || null;
    const lados = ladosMata[m.id];
    return {
      id: m.id, numero: m.numero, fase: m.fase, grupo: m.grupo || null,
      quando: partesBrasilia(m.dataHoraUTC), dataHoraUTC: m.dataHoraUTC,
      estadio: estadio ? { id: estadio.id, estadio: estadio.estadio, cidade: estadio.cidade, pais: estadio.pais } : null,
      mandante: lados ? lados.mandante : ladoTime(m.mandante, teamsById),
      visitante: lados ? lados.visitante : ladoTime(m.visitante, teamsById),
      jogado: m.jogado,
      placar: m.placar,
      penaltis: m.penaltis,
      eventos: m.eventos || [],
    };
  });

  if (filtros.fase) lista = lista.filter((j) => j.fase === filtros.fase);
  if (filtros.grupo) lista = lista.filter((j) => j.grupo === filtros.grupo);
  if (filtros.data) lista = lista.filter((j) => j.quando && j.quando.diaChave === filtros.data);

  lista.sort((a, b) => a.numero - b.numero);
  return lista;
}

// ---------------------------------------------------------------------------
// Edição de partida (PUT /api/jogos/:id)
// ---------------------------------------------------------------------------

const TIPOS_EVENTO = new Set(['gol', 'amarelo', 'vermelho']);

class ErroValidacao extends Error {
  constructor(msg) { super(msg); this.status = 400; }
}

function validarPlacar(v, rotulo) {
  if (v == null) return null;
  if (!Number.isInteger(v) || v < 0 || v > 99) throw new ErroValidacao(`${rotulo} inválido`);
  return v;
}

function normalizarEventos(eventos, jogo) {
  if (!Array.isArray(eventos)) throw new ErroValidacao('eventos deve ser uma lista');
  const idsValidos = new Set();
  if (jogo.mandante.tipo === 'time') idsValidos.add(jogo.mandante.ref);
  if (jogo.visitante.tipo === 'time') idsValidos.add(jogo.visitante.ref);
  return eventos.map((ev, i) => {
    if (!TIPOS_EVENTO.has(ev.tipo)) throw new ErroValidacao(`evento ${i}: tipo inválido`);
    if (!ev.timeId) throw new ErroValidacao(`evento ${i}: timeId obrigatório`);
    // Em jogo de grupo, o time precisa ser um dos participantes; no mata-mata aceitamos
    // qualquer id (o confronto pode ainda estar projetado).
    if (idsValidos.size && jogo.fase === 'grupo' && !idsValidos.has(ev.timeId))
      throw new ErroValidacao(`evento ${i}: timeId não participa do jogo`);
    const out = { tipo: ev.tipo, timeId: ev.timeId };
    if (ev.jogador != null) out.jogador = String(ev.jogador).slice(0, 80);
    if (ev.minuto != null) {
      if (!Number.isInteger(ev.minuto) || ev.minuto < 0 || ev.minuto > 130)
        throw new ErroValidacao(`evento ${i}: minuto inválido`);
      out.minuto = ev.minuto;
    }
    if (ev.subtipo != null) out.subtipo = String(ev.subtipo);
    return out;
  });
}

/**
 * Edita uma partida: placar, eventos, pênaltis, "jogado". Recalcula tudo na
 * próxima leitura. Grava com backup atômico.
 */
function editarJogo(id, corpo) {
  const matches = storage.readJSON('matches.json', []);
  const idx = matches.findIndex((m) => m.id === id);
  if (idx < 0) { const e = new Error('Jogo não encontrado'); e.status = 404; throw e; }
  const jogo = matches[idx];

  if (corpo.placar !== undefined) {
    const p = corpo.placar || {};
    jogo.placar = {
      mandante: validarPlacar(p.mandante, 'placar do mandante'),
      visitante: validarPlacar(p.visitante, 'placar do visitante'),
    };
  }

  if (corpo.penaltis !== undefined) {
    if (jogo.fase === 'grupo' && corpo.penaltis && (corpo.penaltis.mandante != null || corpo.penaltis.visitante != null))
      throw new ErroValidacao('pênaltis só se aplicam ao mata-mata');
    const p = corpo.penaltis || {};
    jogo.penaltis = {
      mandante: validarPlacar(p.mandante, 'pênaltis do mandante'),
      visitante: validarPlacar(p.visitante, 'pênaltis do visitante'),
    };
  }

  if (corpo.eventos !== undefined) jogo.eventos = normalizarEventos(corpo.eventos, jogo);

  if (corpo.jogado !== undefined) {
    jogo.jogado = !!corpo.jogado;
  } else if (corpo.placar !== undefined) {
    // conveniência: informar placar marca como realizado
    jogo.jogado = jogo.placar.mandante != null && jogo.placar.visitante != null;
  }

  // Coerência: jogo de mata-mata empatado precisa de pênaltis para ter vencedor.
  storage.writeJSON('matches.json', matches);
  return jogo;
}

module.exports = {
  carregar, calcular, jogos, editarJogo,
  // expostos para os endpoints de leitura
  classificacao: (calc = calcular()) => calc.classificacao,
  terceiros: (calc = calcular()) => calc.terceiros,
  chave: (calc = calcular()) => calc.chave.rodadas,
  artilharia: (calc = calcular()) => calc.artilheiros,
};
