'use strict';

/*
 * Passo 6 — valida os slots do mata-mata e a propagação automática.
 * Simula um torneio inteiro a partir dos dados reais e confere:
 *  - integridade da árvore (cada vencedor/perdedor alimenta o jogo certo);
 *  - 16-avos totalmente resolvidos após a fase de grupos;
 *  - alocação dos 8 terceiros pelo Anexo C;
 *  - propagação até a final e a disputa de 3º lugar (perdedores das semis).
 * Roda: node test/knockout.test.js
 */

const assert = require('assert');

const { classificarGrupo } = require('../src/logic/standings');
const { fairPlayTotais } = require('../src/logic/fairplay');
const { rankearTerceiros } = require('../src/logic/thirds');
const { montarChave } = require('../src/logic/bracket');

const teams = require('../data/teams.json');
const groups = require('../data/groups.json');
const matchesReais = require('../data/matches.json');
const config = require('../data/config.json');
const anexoC = require('../data/third-place-allocation.json');

const teamsById = Object.fromEntries(teams.map((t) => [t.id, t]));
const clone = (x) => JSON.parse(JSON.stringify(x));

let passes = 0;
function ok(nome, fn) { fn(); passes++; console.log('  ✓', nome); }

function refNum(side, prefixo) {
  const m = side.ref.match(new RegExp(`^${prefixo} Match (\\d+)$`));
  return m ? +m[1] : null;
}

console.log('integridade da árvore do mata-mata');

ok('cada vencedor/perdedor alimenta exatamente o jogo seguinte certo', () => {
  const ko = matchesReais.filter((m) => m.fase !== 'grupo');
  assert.strictEqual(ko.length, 32);
  const usosW = {}; const usosL = {};
  for (const m of ko) {
    for (const side of [m.mandante, m.visitante]) {
      const w = refNum(side, 'Winner'); if (w) usosW[w] = (usosW[w] || 0) + 1;
      const l = refNum(side, 'Loser'); if (l) usosL[l] = (usosL[l] || 0) + 1;
    }
  }
  // Jogos 73..100 são consumidos como "Vencedor" exatamente 1 vez.
  for (let n = 73; n <= 100; n++) assert.strictEqual(usosW[n], 1, `Jogo ${n} deveria alimentar 1 confronto (vencedor)`);
  // Semifinais (101,102): vencedor -> final (1x); perdedor -> 3º lugar (1x).
  assert.strictEqual(usosW[101], 1); assert.strictEqual(usosW[102], 1);
  assert.strictEqual(usosL[101], 1); assert.strictEqual(usosL[102], 1);
  // Não há referência a jogos 103/104 (folhas).
  assert.ok(!usosW[103] && !usosW[104] && !usosL[103] && !usosL[104]);
});

// --- Simulação determinística da fase de grupos: melhor ranking FIFA vence 1-0 ---
function simularGrupos(matches) {
  for (const m of matches) {
    if (m.fase !== 'grupo') continue;
    const ra = teamsById[m.mandante.ref].rankingFifa;
    const rb = teamsById[m.visitante.ref].rankingFifa;
    m.jogado = true;
    m.placar = ra < rb ? { mandante: 1, visitante: 0 } : { mandante: 0, visitante: 1 };
  }
}

function calcularChave(matches) {
  const fairPlayTot = fairPlayTotais(matches.filter((m) => m.fase === 'grupo'), config);
  const classificacao = Object.keys(groups).map((g) =>
    classificarGrupo(g, { groups, matches, teamsById, config, fairPlayTot }));
  const classificacaoPorGrupo = Object.fromEntries(classificacao.map((c) => [c.grupo, c]));
  const terceiros = rankearTerceiros(classificacao);
  const chave = montarChave({
    matches, classificacaoPorGrupo, comboQualificados: terceiros.comboQualificados, anexoC, teamsById,
  });
  return { classificacaoPorGrupo, terceiros, chave };
}

console.log('\nfase de grupos -> 16-avos');

let combo; let allocation;

ok('os 32 confrontos dos 16-avos resolvem para 32 seleções distintas', () => {
  const matches = clone(matchesReais);
  simularGrupos(matches);
  const { chave } = calcularChave(matches);

  const r32 = chave.rodadas.find((r) => r.fase === '16avos').jogos;
  assert.strictEqual(r32.length, 16);
  const ids = [];
  for (const j of r32) {
    assert.ok(j.mandante.timeId, `${j.id}: mandante não resolvido`);
    assert.ok(j.visitante.timeId, `${j.id}: visitante não resolvido`);
    ids.push(j.mandante.timeId, j.visitante.timeId);
  }
  assert.strictEqual(ids.length, 32);
  assert.strictEqual(new Set(ids).size, 32, '32 seleções distintas nos 16-avos');
});

ok('os 8 terceiros caem nos jogos certos conforme o Anexo C', () => {
  const matches = clone(matchesReais);
  simularGrupos(matches);
  const { classificacaoPorGrupo, terceiros, chave } = calcularChave(matches);
  combo = terceiros.comboQualificados;
  allocation = anexoC.combinacoes[combo];
  assert.ok(allocation, `combinação ${combo} existe no Anexo C`);

  const terceiroDoGrupo = (g) => classificacaoPorGrupo[g].times.find((t) => t.posicao === 3).timeId;

  const r32 = chave.rodadas.find((r) => r.fase === '16avos').jogos;
  let conferidos = 0;
  for (const j of r32) {
    if (!j.visitante.ref.startsWith('3rd Group')) continue;
    const grupoVencedor = j.mandante.ref.match(/Winner Group ([A-L])/)[1];
    const grupoEsperado = allocation[grupoVencedor];
    assert.strictEqual(j.visitante.timeId, terceiroDoGrupo(grupoEsperado),
      `${j.id}: 3º esperado do grupo ${grupoEsperado}`);
    conferidos++;
  }
  assert.strictEqual(conferidos, 8, '8 jogos com terceiro colocado');
});

console.log(`  (combinação dos terceiros classificados: ${combo})`);

console.log('\npropagação completa até a final + 3º lugar');

ok('mata-mata inteiro propaga; perdedores das semis vão à disputa de 3º', () => {
  const matches = clone(matchesReais);
  simularGrupos(matches);
  // Define TODOS os jogos de mata-mata como realizados; mandante vence 1-0.
  for (const m of matches) {
    if (m.fase === 'grupo') continue;
    m.jogado = true;
    m.placar = { mandante: 1, visitante: 0 };
  }
  const { chave } = calcularChave(matches);
  const mapa = chave.mapa;

  // Todos os 32 confrontos resolvidos com vencedor.
  for (const r of chave.rodadas) for (const j of r.jogos) {
    assert.ok(mapa[j.id].mandanteId && mapa[j.id].visitanteId, `${j.id} não resolveu os dois lados`);
    assert.ok(mapa[j.id].vencedorId, `${j.id} sem vencedor`);
  }

  // Final = vencedores das semis; 3º lugar = perdedores das semis.
  assert.strictEqual(mapa.M104.mandanteId, mapa.M101.vencedorId);
  assert.strictEqual(mapa.M104.visitanteId, mapa.M102.vencedorId);
  assert.strictEqual(mapa.M103.mandanteId, mapa.M101.perdedorId);
  assert.strictEqual(mapa.M103.visitanteId, mapa.M102.perdedorId);

  // Campeão é uma seleção real.
  assert.ok(teamsById[mapa.M104.vencedorId], 'campeão é uma seleção válida');
});

console.log(`\n${passes} testes OK`);
