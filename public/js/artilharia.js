'use strict';
const { api, el, esc, siglaHTML, montarLayout, vazio } = window.PacCopa;

montarLayout('artilharia');

(async function init() {
  const conteudo = document.getElementById('conteudo');
  let lista;
  try { lista = await api.get('/api/artilharia'); }
  catch (e) { conteudo.append(vazio('⚠️', 'Erro ao carregar', e.message)); return; }

  if (!lista.length) {
    conteudo.append(vazio('⚽', 'Ainda não há gols registrados',
      'Edite uma partida e adicione eventos de gol para ver a artilharia aqui.'));
    return;
  }

  const thead = el('tr', {},
    el('th', { class: 'l' }, '#'), el('th', { class: 'l' }, 'Jogador'), el('th', { class: 'l' }, 'Seleção'),
    el('th', {}, 'Gols'), el('th', {}, 'Pên'));

  const corpo = el('tbody', {});
  for (const a of lista) {
    corpo.append(el('tr', { class: a.posicao === 1 ? 'zona-classificado' : '' },
      el('td', { class: 'pos l' }, (a.posicao === 1 ? '🥇 ' : '') + a.posicao),
      el('td', { class: 'l destaque' }, a.jogador),
      el('td', { class: 'l', html: `<span class="time-cell">${siglaHTML(a.sigla)}<span class="nome">${esc(a.time)}</span></span>` }),
      el('td', { class: 'pts' }, String(a.gols)),
      el('td', {}, a.penaltis ? String(a.penaltis) : '–')));
  }

  conteudo.append(el('div', { class: 'tabela-wrap' }, el('table', { class: 'tabela' }, el('thead', {}, thead), corpo)));
})();
