'use strict';
const { api, el, esc, siglaHTML, montarLayout, vazio } = window.PacCopa;

montarLayout('classificacao');

const COLS = [
  ['pts', 'P'], ['j', 'J'], ['v', 'V'], ['e', 'E'], ['d', 'D'],
  ['gp', 'GP'], ['gc', 'GC'], ['sg', 'SG'], ['amarelos', 'CA'], ['vermelhos', 'CV'],
];

function sg(n) { return n > 0 ? `+${n}` : `${n}`; }

function linha(t) {
  const cells = [
    el('td', { class: 'pos l' }, String(t.posicao)),
    el('td', { class: 'l', html: `<span class="time-cell">${siglaHTML(t.sigla)}<span class="nome">${esc(t.nome)}</span></span>` }),
  ];
  for (const [k] of COLS) {
    let v = t[k];
    if (k === 'sg') v = sg(t.sg);
    if (k === 'amarelos') v = t.amarelos ? `${t.amarelos}<span class="mini-cartao am"></span>` : '0';
    if (k === 'vermelhos') v = t.vermelhos ? `${t.vermelhos}<span class="mini-cartao vm"></span>` : '0';
    cells.push(el('td', { class: k === 'pts' ? 'pts' : '', html: String(v) }));
  }
  return el('tr', { class: `zona-${t.zona}` }, ...cells);
}

function grupoCard(g) {
  const thead = el('tr', {},
    el('th', { class: 'l' }, '#'), el('th', { class: 'l' }, 'Seleção'),
    ...COLS.map(([, l]) => el('th', {}, l)));
  const tabela = el('table', { class: 'tabela' }, el('thead', {}, thead), el('tbody', {}, ...g.times.map(linha)));
  const status = g.completo
    ? el('span', { class: 'tag tag--class' }, 'Encerrado')
    : el('span', { class: 'tag tag--grupo' }, 'Em andamento');
  const card = el('div', { class: 'grupo-card' },
    el('div', { class: 'grupo-card__head' }, el('h3', { html: `Grupo <b>${g.grupo}</b>` }), status),
    el('div', { class: 'tabela-wrap', style: 'border:none;box-shadow:none;border-radius:0' }, tabela));
  if (g.provisorio) card.append(el('div', { style: 'padding:10px 16px' }, el('div', { class: 'nota' }, '⚠️ Desempate provisório por ordem alfabética (sorteio pendente).')));
  return card;
}

(async function init() {
  let grupos;
  try { grupos = await api.get('/api/classificacao'); }
  catch (e) { document.getElementById('grupos').append(vazio('⚠️', 'Erro ao carregar', e.message)); return; }

  const houveJogo = grupos.some((g) => g.times.some((t) => t.j > 0));
  const avisos = document.getElementById('avisos');
  if (!houveJogo) {
    avisos.append(el('div', { class: 'aviso' },
      el('span', { class: 'ic' }, '🧭'),
      el('span', { html: 'Nenhum resultado lançado ainda — a ordem abaixo é uma <b>projeção</b> pelos critérios de desempate (com ranking FIFA decidindo). Lance resultados em <a href="/jogos.html">Jogos</a>.' })));
  }

  document.getElementById('legenda').append(
    el('span', {}, el('i', { style: 'background:var(--verde)' }), '1º/2º — classificado'),
    el('span', {}, el('i', { style: 'background:var(--amarelo)' }), '3º — disputa vaga (8 melhores)'),
    el('span', {}, 'CA/CV — cartões amarelos/vermelhos'));

  const cont = document.getElementById('grupos');
  grupos.forEach((g) => cont.append(grupoCard(g)));
})();
