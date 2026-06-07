'use strict';
const { api, el, esc, siglaHTML, montarLayout, vazio } = window.PacCopa;

montarLayout('mata-mata');

const fmtCurto = (iso) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(new Date(iso));

let cidadePorEstadio = {};

function ladoEl(lado, jogo, ehMandante) {
  const venceu = jogo.vencedorId && lado.timeId && jogo.vencedorId === lado.timeId;
  const projetado = !lado.definido; // tem time só por projeção (ou ainda é slot)
  const gols = jogo.jogado && jogo.placar.mandante != null
    ? (ehMandante ? jogo.placar.mandante : jogo.placar.visitante) : '';
  return el('div', { class: 'confronto__lado' + (venceu ? ' venceu' : '') + (projetado ? ' projetado' : '') },
    el('div', { class: 'nome', html: `${siglaHTML(lado.sigla, '?')}<span class="txt">${esc(lado.timeId ? (lado.nome || lado.label) : lado.label)}</span>` }),
    el('span', { class: 'gols' }, String(gols)));
}

function confrontoEl(jogo, ehFinal) {
  const cidade = cidadePorEstadio[jogo.estadioId] || '';
  let pen = '';
  if (jogo.penaltis && jogo.penaltis.mandante != null) pen = ` · pên ${jogo.penaltis.mandante}–${jogo.penaltis.visitante}`;
  return el('div', { class: 'confronto' + (ehFinal ? ' confronto--final' : ''),
    style: 'cursor:pointer', onclick: () => { location.href = `/editar.html?id=${jogo.id}`; } },
    el('div', { class: 'confronto__meta' },
      el('span', {}, `Jogo ${jogo.numero}${pen}`),
      el('span', {}, `${fmtCurto(jogo.dataHoraUTC)}${cidade ? ' · ' + cidade : ''}`)),
    ladoEl(jogo.mandante, jogo, true),
    ladoEl(jogo.visitante, jogo, false));
}

(async function init() {
  let rodadas, estadios;
  try {
    [rodadas, estadios] = await Promise.all([api.get('/api/chave'), api.get('/api/estadios')]);
  } catch (e) {
    document.getElementById('bracket').append(vazio('⚠️', 'Erro ao carregar', e.message));
    return;
  }
  cidadePorEstadio = Object.fromEntries(estadios.map((s) => [s.id, s.cidade]));

  document.getElementById('legenda').append(
    el('span', {}, el('i', { style: 'background:var(--verde)' }), 'Vencedor / confronto definido'),
    el('span', {}, el('i', { style: 'background:var(--tinta-fraca)' }), 'Posição projetada (itálico)'),
    el('span', {}, '🏆 clique num confronto para lançar o resultado'));

  const board = el('div', { class: 'bracket' });
  for (const r of rodadas) {
    const ehFinal = r.fase === 'final';
    const col = el('div', { class: 'coluna' + (ehFinal ? ' coluna--final' : '') },
      el('div', { class: 'coluna__titulo' }, r.label));
    r.jogos.forEach((j) => col.append(confrontoEl(j, ehFinal)));
    board.append(col);
  }
  document.getElementById('bracket').append(board);
})();
