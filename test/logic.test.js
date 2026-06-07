'use strict';

/* Testes pontuais do engine (sem framework). Rode: node test/logic.test.js */

const assert = require('assert');
const path = require('path');

const { classificarGrupo } = require('../src/logic/standings');
const { fairPlayTotais, pontosFairPlayNoJogo } = require('../src/logic/fairplay');
const { rankearTerceiros } = require('../src/logic/thirds');
const { montarChave } = require('../src/logic/bracket');
const { artilharia } = require('../src/logic/scorers');
const { partesBrasilia } = require('../src/logic/timezone');
const copa = require('../src/copa');

const CONFIG = {
  pontos: { vitoria: 3, empate: 1, derrota: 0 },
  fairPlay: { amarelo: -1, segundoAmarelo: -3, vermelhoDireto: -4, amareloMaisVermelho: -5 },
};

let passes = 0;
function ok(nome, fn) { fn(); passes++; console.log('  ✓', nome); }

function jogoGrupo(grupo, mandante, visitante, gm, gv, eventos = []) {
  return {
    id: `${grupo}-${mandante}-${visitante}`, fase: 'grupo', grupo,
    mandante: { tipo: 'time', ref: mandante }, visitante: { tipo: 'time', ref: visitante },
    jogado: gm != null, placar: { mandante: gm, visitante: gv },
    penaltis: { mandante: null, visitante: null }, eventos,
  };
}
const times = (ids) => Object.fromEntries(ids.map((id, i) => [id, { id, nome: id, sigla: id, rankingFifa: i + 1 }]));

console.log('standings');

ok('ordena por pontos quando não há empate', () => {
  const ids = ['T1', 'T2', 'T3', 'T4'];
  const matches = [
    jogoGrupo('A', 'T1', 'T2', 1, 0),
    jogoGrupo('A', 'T1', 'T3', 1, 0),
    jogoGrupo('A', 'T1', 'T4', 1, 0),  // T1 9 pts
    jogoGrupo('A', 'T2', 'T3', 1, 0),
    jogoGrupo('A', 'T2', 'T4', 1, 0),  // T2 6 pts
    jogoGrupo('A', 'T3', 'T4', 1, 0),  // T3 3 pts, T4 0
  ];
  const fp = fairPlayTotais(matches, CONFIG);
  const r = classificarGrupo('A', { groups: { A: ids }, matches, teamsById: times(ids), config: CONFIG, fairPlayTot: fp });
  assert.deepStrictEqual(r.times.map((t) => t.timeId), ['T1', 'T2', 'T3', 'T4']);
  assert.strictEqual(r.completo, true);
});

ok('confronto direto vem ANTES do saldo geral (Art. 13)', () => {
  // T1,T2,T3 empatam em 6 pts; ciclo H2H separa T1>T2>T3,
  // mas o saldo GERAL é invertido (T3>T2>T1) pelos jogos com T4.
  const ids = ['T1', 'T2', 'T3', 'T4'];
  const matches = [
    jogoGrupo('A', 'T1', 'T2', 3, 0), // ciclo
    jogoGrupo('A', 'T2', 'T3', 3, 0),
    jogoGrupo('A', 'T3', 'T1', 1, 0),
    jogoGrupo('A', 'T1', 'T4', 1, 0), // saldos gerais invertidos
    jogoGrupo('A', 'T2', 'T4', 5, 0),
    jogoGrupo('A', 'T3', 'T4', 9, 0),
  ];
  const fp = fairPlayTotais(matches, CONFIG);
  const r = classificarGrupo('A', { groups: { A: ids }, matches, teamsById: times(ids), config: CONFIG, fairPlayTot: fp });
  assert.deepStrictEqual(r.times.map((t) => t.timeId), ['T1', 'T2', 'T3', 'T4'],
    'esperava ordem do confronto direto, não do saldo geral');
});

ok('fair play desempata quando tudo mais é igual', () => {
  // T1 e T2 empatam 1-1; idênticos em tudo. T2 leva vermelho direto (−4).
  const ids = ['T1', 'T2'];
  const matches = [
    jogoGrupo('A', 'T1', 'T2', 1, 1, [{ tipo: 'vermelho', subtipo: 'direto', timeId: 'T2', jogador: 'X' }]),
  ];
  const fp = fairPlayTotais(matches, CONFIG);
  const r = classificarGrupo('A', { groups: { A: ids }, matches, teamsById: times(ids), config: CONFIG, fairPlayTot: fp });
  assert.deepStrictEqual(r.times.map((t) => t.timeId), ['T1', 'T2']);
  assert.strictEqual(r.times[1].vermelhos, 1);
  assert.strictEqual(r.times[1].fairPlay, -4);
});

console.log('fairplay');

ok('amarelo + vermelho direto do mesmo jogador = −5', () => {
  const jogo = jogoGrupo('A', 'T1', 'T2', 0, 0, [
    { tipo: 'amarelo', timeId: 'T1', jogador: 'João', minuto: 10 },
    { tipo: 'vermelho', subtipo: 'direto', timeId: 'T1', jogador: 'João', minuto: 60 },
  ]);
  const p = pontosFairPlayNoJogo(jogo, CONFIG);
  assert.strictEqual(p.T1, -5);
});

ok('dois amarelos (expulsão) = −3, não −2', () => {
  const jogo = jogoGrupo('A', 'T1', 'T2', 0, 0, [
    { tipo: 'amarelo', timeId: 'T2', jogador: 'Ana', minuto: 10 },
    { tipo: 'amarelo', timeId: 'T2', jogador: 'Ana', minuto: 70 },
  ]);
  const p = pontosFairPlayNoJogo(jogo, CONFIG);
  assert.strictEqual(p.T2, -3);
});

console.log('thirds');

ok('rankeia terceiros e escolhe os 8 melhores', () => {
  // 12 grupos fictícios; o 3º de cada tem pontos decrescentes -> 8 primeiros classificam.
  const classificacao = 'ABCDEFGHIJKL'.split('').map((g, i) => ({
    grupo: g, completo: true,
    times: [
      { posicao: 1, timeId: g + '1' }, { posicao: 2, timeId: g + '2' },
      { posicao: 3, timeId: g + '3', nome: g + '3', sigla: g + '3', pts: 12 - i, sg: 0, gp: 0, fairPlay: 0, rankingFifa: i + 1 },
      { posicao: 4, timeId: g + '4' },
    ],
  }));
  const r = rankearTerceiros(classificacao);
  assert.strictEqual(r.ranking.length, 12);
  assert.strictEqual(r.ranking.filter((t) => t.classificado).length, 8);
  assert.strictEqual(r.comboQualificados, 'ABCDEFGH');
  assert.strictEqual(r.ranking[0].grupo, 'A'); // mais pontos
});

console.log('bracket');

ok('propaga vencedor para a fase seguinte', () => {
  const teamsById = times(['TA1', 'TB1']);
  const matches = [
    { id: 'M73', numero: 73, fase: '16avos', dataHoraUTC: '2026-06-28T19:00:00Z', estadioId: 's',
      mandante: { tipo: 'slot', ref: 'Winner Group A' }, visitante: { tipo: 'slot', ref: 'Winner Group B' },
      jogado: true, placar: { mandante: 2, visitante: 1 }, penaltis: { mandante: null, visitante: null } },
    { id: 'M90', numero: 90, fase: 'oitavas', dataHoraUTC: '2026-07-04T19:00:00Z', estadioId: 's',
      mandante: { tipo: 'slot', ref: 'Winner Match 73' }, visitante: { tipo: 'slot', ref: 'Winner Match 75' },
      jogado: false, placar: { mandante: null, visitante: null }, penaltis: { mandante: null, visitante: null } },
  ];
  const classificacaoPorGrupo = {
    A: { times: [{ posicao: 1, timeId: 'TA1' }] },
    B: { times: [{ posicao: 1, timeId: 'TB1' }] },
  };
  const { mapa } = montarChave({ matches, classificacaoPorGrupo, comboQualificados: '', anexoC: { combinacoes: {} }, teamsById });
  assert.strictEqual(mapa.M73.mandanteId, 'TA1');
  assert.strictEqual(mapa.M73.visitanteId, 'TB1');
  assert.strictEqual(mapa.M73.vencedorId, 'TA1');
  assert.strictEqual(mapa.M90.mandanteId, 'TA1'); // Vencedor do Jogo 73 propagado
  assert.strictEqual(mapa.M90.visitanteId, null); // Jogo 75 ainda indefinido
});

ok('empate no mata-mata é decidido por pênaltis', () => {
  const teamsById = times(['TA1', 'TB1']);
  const matches = [{ id: 'M73', numero: 73, fase: '16avos', dataHoraUTC: 'x', estadioId: 's',
    mandante: { tipo: 'slot', ref: 'Winner Group A' }, visitante: { tipo: 'slot', ref: 'Winner Group B' },
    jogado: true, placar: { mandante: 1, visitante: 1 }, penaltis: { mandante: 4, visitante: 5 } }];
  const classificacaoPorGrupo = { A: { times: [{ posicao: 1, timeId: 'TA1' }] }, B: { times: [{ posicao: 1, timeId: 'TB1' }] } };
  const { mapa } = montarChave({ matches, classificacaoPorGrupo, comboQualificados: '', anexoC: { combinacoes: {} }, teamsById });
  assert.strictEqual(mapa.M73.vencedorId, 'TB1');
  assert.strictEqual(mapa.M73.perdedorId, 'TA1');
});

console.log('scorers');

ok('soma gols por jogador e ignora gol contra', () => {
  const matches = [
    jogoGrupo('A', 'T1', 'T2', 2, 1, [
      { tipo: 'gol', timeId: 'T1', jogador: 'Pelé', minuto: 10 },
      { tipo: 'gol', timeId: 'T1', jogador: 'Pelé', minuto: 50, subtipo: 'penalti' },
      { tipo: 'gol', timeId: 'T2', jogador: 'Zico', minuto: 80 },
      { tipo: 'gol', timeId: 'T1', jogador: 'Adversário', minuto: 90, subtipo: 'contra' },
    ]),
  ];
  const r = artilharia(matches, times(['T1', 'T2']));
  assert.strictEqual(r[0].jogador, 'Pelé');
  assert.strictEqual(r[0].gols, 2);
  assert.strictEqual(r[0].penaltis, 1);
  assert.strictEqual(r.find((x) => x.jogador === 'Adversário'), undefined);
});

console.log('timezone');

ok('converte UTC para horário de Brasília (GMT-3)', () => {
  const p = partesBrasilia('2026-06-11T19:00:00Z');
  assert.strictEqual(p.hora, '16:00');
  assert.strictEqual(p.data, '11/06/2026');
  assert.strictEqual(p.diaChave, '2026-06-11');
});

console.log('integração (dados reais)');

ok('calcula tudo a partir dos JSON reais', () => {
  const calc = copa.calcular();
  assert.strictEqual(calc.classificacao.length, 12);
  assert.strictEqual(calc.terceiros.ranking.length, 12);
  assert.strictEqual(calc.terceiros.comboQualificados.length, 8);
  const fases = calc.chave.rodadas.map((r) => r.fase);
  assert.deepStrictEqual(fases, ['16avos', 'oitavas', 'quartas', 'semi', 'terceiro', 'final']);
  const total = calc.chave.rodadas.reduce((n, r) => n + r.jogos.length, 0);
  assert.strictEqual(total, 32);
  // com Anexo C, o visitante "3º" do Jogo 74 deve resolver para algum time projetado
  const j74 = calc.chave.rodadas[0].jogos.find((j) => j.numero === 74);
  assert.ok(j74.visitante.timeId, 'Anexo C deveria projetar o 3º do Jogo 74');
});

ok('lista de jogos enriquecida tem 104 itens', () => {
  const lista = copa.jogos();
  assert.strictEqual(lista.length, 104);
  assert.ok(lista[0].quando.hora);
  assert.ok(lista[0].estadio);
});

console.log(`\n${passes} testes OK`);
