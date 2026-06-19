'use strict';
const { api, el, montarLayout, subnavBolao, vazio } = window.PacCopa;

montarLayout('bolao');
document.getElementById('subnav').append(subnavBolao('classificacao'));

const conteudo = document.getElementById('conteudo');
const MEDALHAS = { 1: '🥇', 2: '🥈', 3: '🥉' };

function regrasEl() {
  const regra = (cls, n, txt) => el('div', { class: `regra ${cls}` }, el('b', {}, String(n)), el('small', {}, txt));
  return el('div', { class: 'regras-bolao' },
    regra('r15', 15, 'Placar exato'),
    regra('r10', 10, 'Acertou o resultado (vencedor ou empate)'),
    regra('r5', 5, 'Acertou o total de gols'));
}

(async function init() {
  let lista;
  try { lista = await api.get('/api/bolao/classificacao'); }
  catch (e) { conteudo.append(vazio('⚠️', 'Erro ao carregar', e.message)); return; }

  if (!lista.length) {
    conteudo.append(vazio('🏅', 'Bolão ainda vazio', 'Cadastre apostadores e registre palpites para ver o ranking.'));
    return;
  }

  conteudo.append(regrasEl());
  
  const avaliados = lista[0].jogosAvaliados;
  conteudo.append(el('div', { class: 'nota', style: 'margin:6px 0 14px' },
    avaliados ? `Pontuação sobre ${avaliados} jogo${avaliados !== 1 ? 's' : ''} já realizado${avaliados !== 1 ? 's' : ''}.`
      : 'Nenhum jogo realizado ainda — todos com 0 ponto. Lance resultados em Jogos.'));

  const thead = el('tr', {},
    el('th', { class: 'l' }, '#'), el('th', { class: 'l' }, 'Apostador'),
    el('th', {}, 'Pontos'),
    el('th', { title: 'Placar exato (15)' }, '15'),
    el('th', { title: 'Resultado certo (10)' }, '10'),
    el('th', { title: 'Total de gols (5)' }, '5'),
    el('th', {}, 'Palpites'));

  const corpo = el('tbody', {});
  for (const u of lista) {
    corpo.append(el('tr', { class: u.posicao === 1 ? 'zona-classificado' : '' },
      el('td', { class: 'pos l' }, (MEDALHAS[u.posicao] ? MEDALHAS[u.posicao] + ' ' : '') + u.posicao),
      el('td', { class: 'l destaque' }, u.nome),
      el('td', { class: 'pts', style: 'font-size:1.1rem' }, String(u.pontos)),
      el('td', {}, String(u.exatos)),
      el('td', {}, String(u.resultado)),
      el('td', {}, String(u.totalGols)),
      el('td', {}, String(u.palpitados))));
  }

  conteudo.append(el('div', { class: 'tabela-wrap' }, el('table', { class: 'tabela' }, el('thead', {}, thead), corpo)));
})();
