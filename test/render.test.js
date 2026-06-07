'use strict';

/*
 * Smoke test de renderização: sobe o servidor em processo, carrega cada página
 * no jsdom (executando o JS real e consumindo a API de verdade) e confere que
 * o DOM foi populado. Semeia um apostador + palpite para exercitar o bolão e
 * limpa ao final. Roda: node test/render.test.js
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
require('../server'); // inicia o Express na porta 3000

const BASE = 'http://localhost:3000';
const DATA = path.join(__dirname, '..', 'data');

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const jfetch = async (m, rota, corpo) => {
  const r = await fetch(BASE + rota, { method: m, headers: { 'Content-Type': 'application/json' }, body: corpo && JSON.stringify(corpo) });
  return r.json();
};

async function carregarPagina(caminho, predicado, tentativas = 30) {
  const dom = await JSDOM.fromURL(BASE + caminho, {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(window) { window.fetch = (u, o) => fetch(new URL(u, BASE), o); },
  });
  for (let i = 0; i < tentativas; i++) {
    await esperar(100);
    try { if (predicado(dom.window.document)) { dom.window.close(); return true; } } catch { /* segue */ }
  }
  dom.window.close();
  return false;
}

const casos = [
  ['/jogos.html', (d) => d.querySelectorAll('.jogo').length >= 50 && d.querySelectorAll('.dia-bloco').length > 0],
  ['/classificacao.html', (d) => d.querySelectorAll('.grupo-card').length === 12 && d.querySelectorAll('.grupo-card .tabela tbody tr').length >= 48],
  ['/terceiros.html', (d) => d.querySelectorAll('#tabela .tabela tbody tr').length >= 12],
  ['/mata-mata.html', (d) => d.querySelectorAll('.coluna').length === 6 && d.querySelectorAll('.confronto').length === 32],
  ['/artilharia.html', (d) => d.querySelector('.vazio') || d.querySelector('.tabela tbody tr')],
  ['/editar.html?id=M01', (d) => d.querySelectorAll('.form-card').length >= 2 && d.querySelectorAll('.num').length >= 2],
  // bolão (com dados semeados)
  ['/bolao-usuarios.html', (d) => d.querySelector('.form-card') && d.querySelectorAll('.user-card').length >= 1],
  ['/bolao-palpites.html', (d) => d.querySelector('.seletor') && d.querySelectorAll('.palpite').length >= 1 && d.querySelectorAll('.regra').length === 3],
  ['/bolao-visualizacao.html', (d) => d.querySelectorAll('.matriz tbody tr').length >= 1],
  ['/bolao-classificacao.html', (d) => d.querySelectorAll('.tabela tbody tr').length >= 1],
];

function limparBolao() {
  fs.writeFileSync(path.join(DATA, 'bolao-users.json'), '[]\n');
  fs.writeFileSync(path.join(DATA, 'bolao-guesses.json'), '[]\n');
  // remove backups criados pela semeadura do teste
  const bdir = path.join(DATA, 'backups');
  for (const f of fs.readdirSync(bdir)) if (f.startsWith('bolao-')) fs.unlinkSync(path.join(bdir, f));
}

(async function run() {
  limparBolao();
  // semeia 1 apostador + 1 palpite
  const u = await jfetch('POST', '/api/bolao/usuarios', { nome: 'Render Teste' });
  const disp = await (await fetch(BASE + '/api/bolao/jogos-disponiveis')).json();
  await jfetch('PUT', `/api/bolao/palpites/${u.id}`, { palpites: [{ jogoId: disp[0].id, palpite: { mandante: 2, visitante: 1 } }] });

  let okCount = 0;
  for (const [caminho, pred] of casos) {
    const ok = await carregarPagina(caminho, pred);
    console.log(ok ? '  ✓' : '  ✗', caminho);
    if (ok) okCount++;
  }

  limparBolao(); // remove dados de teste
  console.log(`\n${okCount}/${casos.length} páginas renderizaram com dados`);
  process.exit(okCount === casos.length ? 0 : 1);
})();
