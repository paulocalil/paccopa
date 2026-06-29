'use strict';
const { api, el, esc, siglaHTML, montarLayout, toast, FASE_LABEL } = window.PacCopa;

montarLayout('jogos');

const id = new URLSearchParams(location.search).get('id');

const TIPOS = [
  ['gol', 'Gol', '⚽'],
  ['gol-penalti', 'Gol (pênalti)', '⚽P'],
  ['gol-contra', 'Gol contra', '🥅'],
  ['amarelo', 'Cartão amarelo', '🟨'],
  ['vermelho-direto', 'Vermelho direto', '🟥'],
  ['vermelho-2a', '2º amarelo (vermelho)', '🟨🟥'],
];

const uiParaEvento = (ui, timeId, jogador, minuto) => {
  const base = {
    'gol': { tipo: 'gol' }, 'gol-penalti': { tipo: 'gol', subtipo: 'penalti' }, 'gol-contra': { tipo: 'gol', subtipo: 'contra' },
    'amarelo': { tipo: 'amarelo' }, 'vermelho-direto': { tipo: 'vermelho', subtipo: 'direto' }, 'vermelho-2a': { tipo: 'vermelho', subtipo: 'segundo-amarelo' },
  }[ui];
  const ev = { ...base, timeId };
  if (jogador) ev.jogador = jogador;
  if (minuto !== '' && minuto != null) ev.minuto = Number(minuto);
  return ev;
};
const eventoParaUI = (ev) => {
  if (ev.tipo === 'gol') return ev.subtipo === 'penalti' ? 'gol-penalti' : ev.subtipo === 'contra' ? 'gol-contra' : 'gol';
  if (ev.tipo === 'amarelo') return 'amarelo';
  if (ev.tipo === 'vermelho') return ev.subtipo === 'segundo-amarelo' ? 'vermelho-2a' : 'vermelho-direto';
  return 'gol';
};

let jogo;
let sides = []; // { id, label } dos lados com time resolvido

function linhaEvento(ev = {}, defaults = {}) {

  const tipoInicial = ev.tipo ? eventoParaUI(ev) : (defaults.tipo || TIPOS[0][0]);
  const timeInicial = ev.timeId || defaults.timeId || '';

  const selTipo = el('select', {}, ...TIPOS.map(([v, l]) =>
    el('option', {value: v, ...(tipoInicial === v ? { selected: '' } : {})}, l)));

  const selTime = el('select', {}, ...(sides.length
    ? sides.map((s) => el('option', {value: s.id, ...(timeInicial === s.id ? { selected: '' } : {})}, s.label))
    : [el('option', { value: '' }, '—')]));

  const inJog = el('input', { type: 'text', placeholder: 'Jogador', value: ev.jogador || '' });
  const inMin = el('input', { type: 'number', min: '0', max: '130', placeholder: "min", value: ev.minuto ?? '' });
  const linha = el('div', { class: 'evento-linha' }, selTipo, selTime, inJog, inMin,
    el('button', { class: 'rm', title: 'Remover', onclick: () => linha.remove() }, '✕'));
  linha._coleta = () => uiParaEvento(selTipo.value, selTime.value, inJog.value.trim(), inMin.value);
  return linha;
}

function barraAtalhos(side, lista) {
  return el(
    'div',
    { class: 'eventos-atalhos' },
    el('span', { class: 'atalhos-time' }, side.label),
    ...TIPOS.map(([tipo, label, icone]) =>
      el(
        'button',
        {
          type: 'button',
          class: 'atalho-evento',
          title: label,
          onclick: () =>
            lista.append(
              linhaEvento({}, {
                tipo,
                timeId: side.id,
              })
            ),
        },
        icone
      )
    )
  );
}

function render() {
  const conteudo = document.getElementById('conteudo');
  const ehMata = jogo.fase !== 'grupo';

  // contexto no hero
  document.getElementById('ctx-fase').textContent =
    (jogo.grupo ? `Grupo ${jogo.grupo}` : FASE_LABEL[jogo.fase]) + ` · Jogo ${jogo.numero}`;
  document.getElementById('ctx-titulo').innerHTML =
    `${esc(jogo.mandante.label)} <span style="color:var(--tinta-fraca)">×</span> ${esc(jogo.visitante.label)}`;
  document.getElementById('ctx-sub').textContent =
    `${jogo.quando.rotulo}${jogo.estadio ? ` · ${jogo.estadio.estadio}, ${jogo.estadio.cidade}` : ''}`;

  conteudo.innerHTML = '';

  // ---- Placar ----
  const inM = el('input', { class: 'num', type: 'number', min: '0', max: '99', value: jogo.placar.mandante ?? '' });
  const inV = el('input', { class: 'num', type: 'number', min: '0', max: '99', value: jogo.placar.visitante ?? '' });
  const cardPlacar = el('div', { class: 'form-card' },
    el('h3', {}, 'Placar'),
    el('div', { class: 'sub' }, 'Deixe em branco se a partida ainda não foi realizada.'),
    el('div', { class: 'placar-edit' },
      el('div', { class: 'lado' }, el('span', { html: siglaHTML(jogo.mandante.sigla, '?') + ' <b>' + esc(jogo.mandante.label) + '</b>' }), inM),
      el('span', { class: 'x' }, '×'),
      el('div', { class: 'lado' }, el('span', { html: siglaHTML(jogo.visitante.sigla, '?') + ' <b>' + esc(jogo.visitante.label) + '</b>' }), inV)));

  // ---- Pênaltis (mata-mata) ----
  let inPM, inPV, cardPen = null;
  if (ehMata) {
    inPM = el('input', { class: 'num', type: 'number', min: '0', max: '30', value: jogo.penaltis?.mandante ?? '' });
    inPV = el('input', { class: 'num', type: 'number', min: '0', max: '30', value: jogo.penaltis?.visitante ?? '' });
    cardPen = el('div', { class: 'form-card' },
      el('h3', {}, 'Pênaltis'),
      el('div', { class: 'sub' }, 'Preencha apenas em caso de empate no tempo normal — define quem avança.'),
      el('div', { class: 'placar-edit' },
        el('div', { class: 'lado' }, el('span', { html: '<b>' + esc(jogo.mandante.label) + '</b>' }), inPM),
        el('span', { class: 'x' }, '×'),
        el('div', { class: 'lado' }, el('span', { html: '<b>' + esc(jogo.visitante.label) + '</b>' }), inPV)));
  }

  // ---- Eventos ----
  const lista = el('div', { class: 'eventos-lista' });
  (jogo.eventos || []).forEach((ev) => lista.append(linhaEvento(ev)));
  const podeEventos = sides.length > 0;
  const addBtn = el('button', { class: 'btn btn--sm', disabled: podeEventos ? null : '', onclick: () => lista.append(linhaEvento()) }, '+ Adicionar evento');
  const cardEventos = el('div', { class: 'form-card' },
    el('h3', {}, 'Gols e cartões'),
    el('div', { class: 'sub' }, podeEventos
      ? 'Gols alimentam a artilharia; cartões alimentam o fair play (desempate). Informe jogador e minuto quando souber.'
      : 'Os dois lados ainda são projeções — defina os classificados antes de lançar gols/cartões.'),
    lista,
    addBtn,
    ...(podeEventos
      ? sides.map((side) => barraAtalhos(side, lista))
      : []),);

  // ---- Ações ----
  const tg = el('input', { type: 'checkbox', ...(jogo.jogado ? { checked: '' } : {}) });
  const acoes = el('div', { class: 'form-card' },
    el('div', { class: 'form-acoes' },
      el('label', { class: 'toggle' }, tg, 'Partida realizada'),
      el('button', { class: 'btn btn--verde', onclick: () => salvar({ inM, inV, inPM, inPV, lista, tg, ehMata }) }, '💾 Salvar'),
      el('a', { class: 'btn', href: '/jogos.html' }, 'Voltar aos jogos')));

  conteudo.append(cardPlacar);
  if (cardPen) conteudo.append(cardPen);
  conteudo.append(cardEventos, acoes);
}

async function salvar({ inM, inV, inPM, inPV, lista, tg, ehMata }) {
  const num = (i) => (i.value === '' ? null : Number(i.value));
  const payload = {
    jogado: tg.checked,
    placar: { mandante: num(inM), visitante: num(inV) },
    eventos: [...lista.querySelectorAll('.evento-linha')].map((l) => l._coleta()).filter((e) => e.timeId),
  };
  if (ehMata) payload.penaltis = { mandante: num(inPM), visitante: num(inPV) };
  try {
    jogo = enriquecerLocal(await api.put(`/api/jogos/${id}`, payload));
    toast('Salvo! Classificação, chave e artilharia recalculadas.');
    // recarrega a versão enriquecida (slots/labels) do servidor
    jogo = await api.get(`/api/jogos/${id}`);
    prepararSides();
    render();
  } catch (e) {
    toast(e.message, true);
  }
}

// O PUT devolve o registro cru; mantemos os labels já carregados para o render imediato.
function enriquecerLocal(cru) {
  return { ...jogo, jogado: cru.jogado, placar: cru.placar, penaltis: cru.penaltis, eventos: cru.eventos };
}

function prepararSides() {
  sides = [jogo.mandante, jogo.visitante]
    .filter((s) => s.timeId)
    .map((s) => ({ id: s.timeId, label: s.nome || s.label }));
}

(async function init() {
  if (!id) { document.getElementById('conteudo').append(window.PacCopa.vazio('🤔', 'Partida não informada', 'Volte para a lista de jogos.')); return; }
  try {
    jogo = await api.get(`/api/jogos/${id}`);
  } catch (e) {
    document.getElementById('conteudo').append(window.PacCopa.vazio('⚠️', 'Jogo não encontrado', e.message));
    return;
  }
  prepararSides();
  render();
})();
