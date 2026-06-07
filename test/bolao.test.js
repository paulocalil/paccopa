'use strict';

/* Testes do bolão (pontuação 15/10/5/0 e classificação). Roda: node test/bolao.test.js */

const assert = require('assert');
const { pontuar, classificacao } = require('../src/logic/bolao');

const CFG = { placarExato: 15, resultadoCerto: 10, totalGolsCerto: 5, erro: 0 };
let passes = 0;
const ok = (n, f) => { f(); passes++; console.log('  ✓', n); };

const P = (m, v) => ({ mandante: m, visitante: v });

console.log('pontuação do palpite');

ok('placar exato = 15', () => assert.strictEqual(pontuar(P(2, 1), P(2, 1), CFG), 15));
ok('resultado certo (vitória) sem placar = 10', () => assert.strictEqual(pontuar(P(1, 0), P(3, 1), CFG), 10));
ok('empate certo sem placar = 10', () => assert.strictEqual(pontuar(P(1, 1), P(2, 2), CFG), 10));
ok('total de gols certo, resultado errado = 5', () => assert.strictEqual(pontuar(P(2, 0), P(0, 2), CFG), 5));
ok('erro total = 0', () => assert.strictEqual(pontuar(P(0, 0), P(3, 1), CFG), 0));
ok('palpite ausente = 0', () => assert.strictEqual(pontuar(null, P(1, 0), CFG), 0));
ok('jogo sem placar = 0', () => assert.strictEqual(pontuar(P(1, 0), P(null, null), CFG), 0));
ok('empate previsto x vitória real (mesmo total) = 5', () => assert.strictEqual(pontuar(P(1, 1), P(2, 0), CFG), 5));

console.log('classificação do bolão');

ok('soma, ordena e desempata por placares exatos', () => {
  const users = [{ id: 'a', nome: 'Ana' }, { id: 'b', nome: 'Bia' }, { id: 'c', nome: 'Carla' }];
  const matches = [
    { id: 'M1', jogado: true, placar: P(2, 1) },
    { id: 'M2', jogado: true, placar: P(0, 0) },
    { id: 'M3', jogado: false, placar: P(null, null) }, // não pontua
  ];
  const guesses = [
    { usuarioId: 'a', jogoId: 'M1', palpite: P(2, 1) },   // 15
    { usuarioId: 'a', jogoId: 'M2', palpite: P(1, 1) },   // 10 (empate certo)
    { usuarioId: 'b', jogoId: 'M1', palpite: P(1, 0) },   // 10
    { usuarioId: 'b', jogoId: 'M2', palpite: P(0, 0) },   // 15
    { usuarioId: 'c', jogoId: 'M1', palpite: P(3, 3) },   // 0
    { usuarioId: 'a', jogoId: 'M3', palpite: P(5, 5) },   // ignorado (não realizado)
  ];
  const r = classificacao(users, guesses, matches, CFG);
  // Ana e Bia: 25 cada; desempate por exatos (1 cada) → alfabético: Ana, Bia. Carla: 0.
  assert.deepStrictEqual(r.map((x) => x.nome), ['Ana', 'Bia', 'Carla']);
  assert.strictEqual(r[0].pontos, 25);
  assert.strictEqual(r[1].pontos, 25);
  assert.strictEqual(r[0].posicao, 1);
  assert.strictEqual(r[1].posicao, 1); // empate em pontos e exatos compartilha posição
  assert.strictEqual(r[2].posicao, 3);
  assert.strictEqual(r[0].exatos, 1);
  assert.strictEqual(r[2].pontos, 0);
});

console.log(`\n${passes} testes OK`);
