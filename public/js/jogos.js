'use strict';
const { api, el, esc, siglaHTML, montarLayout, vazio } = window.PacCopa;

montarLayout('jogos');

const FASES = [
  ['todos', 'Todos'], ['grupo', 'Grupos'], ['16avos', '16-avos'], ['oitavas', 'Oitavas'],
  ['quartas', 'Quartas'], ['semi', 'Semis'], ['terceiro', '3º lugar'], ['final', 'Final'],
];

let todos = [];
const estado = { fase: 'todos', grupo: null };

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function ladoEl(t, casa) {
  const badge = el('span', { html: siglaHTML(t.sigla, t.tipo === 'slot' ? '?' : null) });
  const nome = el('span', { class: 'nome' }, t.timeId ? (t.nome || t.label) : t.label);
  return el('div', { class: 'jogo__time ' + (casa ? 'casa' : 'fora') },
    ...(casa ? [nome, badge] : [badge, nome]));
}

function placarEl(j) {
  if (j.jogado && j.placar.mandante != null) {
    let pen = '';
    if (j.penaltis && j.penaltis.mandante != null)
      pen = `<span class="pen">pên ${j.penaltis.mandante}–${j.penaltis.visitante}</span>`;
    return el('div', { class: 'jogo__placar', html: `${j.placar.mandante} <span class="vs">×</span> ${j.placar.visitante}${pen}` });
  }
  return el('div', { class: 'jogo__placar', html: '<span class="vs">×</span>' });
}

function jogoEl(j) {
  const quando = el('div', { class: 'jogo__quando',
    html: `<span class="hora">${esc(j.quando.hora)}</span><span class="local">${esc(j.estadio ? j.estadio.cidade : '')}</span>` });
  const confronto = el('div', { class: 'jogo__confronto' }, ladoEl(j.mandante, true), placarEl(j), ladoEl(j.visitante, false));
  const tag = j.grupo
    ? el('span', { class: 'tag tag--grupo' }, `Grupo ${j.grupo}`)
    : el('span', { class: 'tag tag--fase' }, FASES.find(([v]) => v === j.fase)?.[1] || j.fase);
  const dir = el('div', { class: 'jogo__dir' }, tag, el('a', { class: 'btn btn--sm', href: `/editar.html?id=${j.id}` }, 'Editar'));
  return el('div', { class: 'jogo' }, quando, confronto, dir);
}

function filtrar() {
  return todos.filter((j) => {
    if (estado.fase !== 'todos' && j.fase !== estado.fase) return false;
    if (estado.grupo && j.grupo !== estado.grupo) return false;
    return true;
  });
}

function renderFiltros() {
  const wrap = document.getElementById('filtros');
  wrap.innerHTML = '';
  const seg = el('div', { class: 'seg' });
  for (const [v, l] of FASES) {
    seg.append(el('button', {
      class: estado.fase === v ? 'is-on' : '',
      onclick: () => { estado.fase = v; if (v !== 'grupo' && v !== 'todos') estado.grupo = null; renderFiltros(); render(); },
    }, l));
  }
  const filtros = el('div', { class: 'filtros' }, seg);
  if (estado.fase === 'todos' || estado.fase === 'grupo') {
    const chips = el('div', { class: 'chips-grupo' });
    for (const g of 'ABCDEFGHIJKL') {
      chips.append(el('button', {
        class: estado.grupo === g ? 'is-on' : '',
        onclick: () => { estado.grupo = estado.grupo === g ? null : g; renderFiltros(); render(); },
      }, g));
    }
    filtros.append(chips);
  }
  filtros.append(el('span', { class: 'contador', 'data-cont': '' }));
  wrap.append(filtros);
}

function render() {
  const lista = document.getElementById('lista');
  lista.innerHTML = '';
  const arr = filtrar().slice().sort((a, b) =>
    new Date(a.dataHoraUTC) - new Date(b.dataHoraUTC) || a.numero - b.numero);

  const cont = document.querySelector('[data-cont]');
  if (cont) cont.textContent = `${arr.length} jogo${arr.length !== 1 ? 's' : ''}`;

  if (!arr.length) { lista.append(vazio('🔍', 'Nenhum jogo com esse filtro', 'Ajuste os filtros acima.')); return; }

  let diaAtual = null, bloco = null;
  for (const j of arr) {
    if (j.quando.diaChave !== diaAtual) {
      diaAtual = j.quando.diaChave;
      bloco = el('div', { class: 'dia-bloco' });
      bloco.append(el('div', { class: 'dia-head' },
        el('h3', { html: `${cap(j.quando.diaSemana)} · <b>${esc(j.quando.data)}</b>` })));
      lista.append(bloco);
    }
    bloco.append(jogoEl(j));
  }
}

(async function init() {
  try {
    todos = await api.get('/api/jogos');
  } catch (e) {
    document.getElementById('lista').append(vazio('⚠️', 'Não foi possível carregar os jogos', e.message));
    return;
  }
  renderFiltros();
  render();
})();
