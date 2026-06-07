'use strict';

/**
 * bolao.js (orquestrador) — usuários, palpites, visualização e classificação.
 * Lê/grava `bolao-users.json` e `bolao-guesses.json`; pontua via logic/bolao.
 */

const storage = require('./storage');
const copa = require('./copa');
const { pontuar, indexarPalpites, classificacao } = require('./logic/bolao');

class ErroValidacao extends Error { constructor(m) { super(m); this.status = 400; } }

const lerUsuarios = () => storage.readJSON('bolao-users.json', []);
const lerPalpites = () => storage.readJSON('bolao-guesses.json', []);
const cfgBolao = () => (storage.readJSON('config.json', {}).bolao) || { placarExato: 15, resultadoCerto: 10, totalGolsCerto: 5, erro: 0 };

/* ---------- Usuários ---------- */
function listarUsuarios() { return lerUsuarios(); }

function criarUsuario(nome) {
  const limpo = String(nome || '').trim();
  if (!limpo) throw new ErroValidacao('Informe o nome do apostador');
  if (limpo.length > 40) throw new ErroValidacao('Nome muito longo (máx. 40)');
  const users = lerUsuarios();
  if (users.some((u) => u.nome.toLowerCase() === limpo.toLowerCase()))
    throw new ErroValidacao('Já existe um apostador com esse nome');
  const id = 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
  const u = { id, nome: limpo };
  users.push(u);
  storage.writeJSON('bolao-users.json', users);
  return u;
}

/* ---------- Palpites ---------- */

/** Jogos com adversários definidos e ainda não realizados (abertos a palpite). */
function jogosDisponiveis(calc = copa.calcular()) {
  return copa.jogos({}, calc)
    .filter((j) => !j.jogado && j.mandante.definido && j.visitante.definido);
}

/** Tudo que a página de palpites precisa para um usuário. */
function palpitesDoUsuario(usuarioId) {
  const users = lerUsuarios();
  const usuario = users.find((u) => u.id === usuarioId);
  if (!usuario) { const e = new Error('Apostador não encontrado'); e.status = 404; throw e; }

  const cfg = cfgBolao();
  const meus = indexarPalpites(lerPalpites())[usuarioId] || {};
  const calc = copa.calcular();

  // Lista os jogos com adversários definidos (abertos ou já realizados).
  const jogos = copa.jogos({}, calc)
    .filter((j) => j.mandante.definido && j.visitante.definido)
    .map((j) => {
      const palpite = meus[j.id] || null;
      return {
        id: j.id, numero: j.numero, fase: j.fase, grupo: j.grupo, quando: j.quando,
        mandante: { label: j.mandante.nome || j.mandante.label, sigla: j.mandante.sigla },
        visitante: { label: j.visitante.nome || j.visitante.label, sigla: j.visitante.sigla },
        jogado: j.jogado,
        placar: j.jogado ? j.placar : null,
        palpite,
        pontos: j.jogado ? pontuar(palpite, j.placar, cfg) : null,
        editavel: !j.jogado,
      };
    });

  return { usuario, jogos };
}

function validarPlacar(v, rotulo) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 99) throw new ErroValidacao(`${rotulo} inválido`);
  return n;
}

/** Insere/edita palpites de um usuário (apenas jogos abertos a palpite). */
function salvarPalpites(usuarioId, lista) {
  const users = lerUsuarios();
  if (!users.some((u) => u.id === usuarioId)) { const e = new Error('Apostador não encontrado'); e.status = 404; throw e; }
  if (!Array.isArray(lista)) throw new ErroValidacao('palpites deve ser uma lista');

  const calc = copa.calcular();
  const abertos = new Map(jogosDisponiveis(calc).map((j) => [j.id, j]));
  let guesses = lerPalpites();

  for (const item of lista) {
    const jogoId = item.jogoId;
    if (!abertos.has(jogoId)) throw new ErroValidacao(`Jogo ${jogoId} não está aberto a palpite`);
    const p = item.palpite || {};
    const mandante = validarPlacar(p.mandante, 'palpite do mandante');
    const visitante = validarPlacar(p.visitante, 'palpite do visitante');

    guesses = guesses.filter((g) => !(g.usuarioId === usuarioId && g.jogoId === jogoId));
    if (mandante != null && visitante != null) {
      guesses.push({ usuarioId, jogoId, palpite: { mandante, visitante } });
    }
  }
  storage.writeJSON('bolao-guesses.json', guesses);
  return palpitesDoUsuario(usuarioId);
}

/* ---------- Visualização (todos os jogos × apostadores × pontos) ---------- */
function visualizacao() {
  const users = lerUsuarios();
  const cfg = cfgBolao();
  const idx = indexarPalpites(lerPalpites());
  const calc = copa.calcular();

  const jogos = copa.jogos({}, calc).map((j) => ({
    id: j.id, numero: j.numero, fase: j.fase, grupo: j.grupo, quando: j.quando,
    mandante: { label: j.mandante.nome || j.mandante.label, sigla: j.mandante.sigla, definido: j.mandante.definido },
    visitante: { label: j.visitante.nome || j.visitante.label, sigla: j.visitante.sigla, definido: j.visitante.definido },
    jogado: j.jogado,
    placar: j.jogado ? j.placar : null,
    apostas: users.map((u) => {
      const p = (idx[u.id] || {})[j.id] || null;
      return { usuarioId: u.id, palpite: p, pontos: j.jogado ? pontuar(p, j.placar, cfg) : null };
    }),
  }));

  return { usuarios: users, jogos };
}

/* ---------- Classificação ---------- */
function ranking() {
  const matches = storage.readJSON('matches.json', []);
  return classificacao(lerUsuarios(), lerPalpites(), matches, cfgBolao());
}

module.exports = {
  listarUsuarios, criarUsuario,
  jogosDisponiveis, palpitesDoUsuario, salvarPalpites,
  visualizacao, ranking,
};
