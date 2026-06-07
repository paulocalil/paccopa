'use strict';
const { api, el, esc, siglaHTML, montarLayout, vazio } = window.PacCopa;

montarLayout('terceiros');

const sg = (n) => (n > 0 ? `+${n}` : `${n}`);

(async function init() {
  let dados;
  try { dados = await api.get('/api/terceiros'); }
  catch (e) { document.getElementById('tabela').append(vazio('⚠️', 'Erro ao carregar', e.message)); return; }

  const houveJogo = dados.ranking.some((t) => t.pts > 0);
  const avisos = document.getElementById('avisos');
  if (!houveJogo) {
    avisos.append(el('div', { class: 'aviso' },
      el('span', { class: 'ic' }, '🧭'),
      el('span', { html: 'Ainda sem resultados — ranking <b>projetado</b> pelos critérios (ranking FIFA decide). Os 8 primeiros avançam aos 16-avos pelo Anexo C.' })));
  }

  const thead = el('tr', {},
    el('th', { class: 'l' }, '#'), el('th', { class: 'l' }, 'Grupo'), el('th', { class: 'l' }, 'Seleção'),
    el('th', {}, 'Pts'), el('th', {}, 'SG'), el('th', {}, 'GP'), el('th', { class: 'l' }, 'Situação'));

  const corpo = el('tbody', {});
  dados.ranking.forEach((t, i) => {
    if (i === 8) corpo.append(el('tr', {}, el('td', { colspan: '7', class: 'l', style: 'background:var(--papel-2);color:var(--tinta-fraca);font-weight:700;font-size:.78rem;letter-spacing:.06em;text-transform:uppercase' }, '— linha de corte · acima classificam —')));
    corpo.append(el('tr', { class: t.classificado ? 'zona-classificado' : '' },
      el('td', { class: 'pos l' }, String(t.posicao)),
      el('td', { class: 'l' }, el('span', { class: 'tag tag--grupo' }, t.grupo)),
      el('td', { class: 'l', html: `<span class="time-cell">${siglaHTML(t.sigla)}<span class="nome">${esc(t.nome)}</span></span>` }),
      el('td', { class: 'pts' }, String(t.pts)),
      el('td', {}, sg(t.sg)),
      el('td', {}, String(t.gp)),
      el('td', { class: 'l' }, t.classificado
        ? el('span', { class: 'tag tag--class' }, 'Classificado')
        : el('span', { class: 'tag tag--fora' }, 'Fora'))));
  });

  document.getElementById('tabela').append(el('div', { class: 'tabela-wrap' }, el('table', { class: 'tabela' }, el('thead', {}, thead), corpo)));
})();
