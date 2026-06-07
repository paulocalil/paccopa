'use strict';
const { api, el, esc, siglaHTML, montarLayout, subnavBolao, vazio } = window.PacCopa;

montarLayout('bolao');
document.getElementById('subnav').append(subnavBolao('visualizacao'));

const conteudo = document.getElementById('conteudo');
const seloEl = (pts) => el('span', { class: `selo p${pts}` }, String(pts));

function confMini(j) {
  return el('div', { class: 'conf-mini' },
    el('span', { html: siglaHTML(j.mandante.sigla, '?') }),
    el('span', { class: 'vs2' }, '×'),
    el('span', { html: siglaHTML(j.visitante.sigla, '?') }),
    el('span', { class: 'nota', style: 'margin-left:4px' }, `${j.quando.diaSemana} ${j.quando.data.slice(0, 5)}`));
}

(async function init() {
  let dados;
  try { dados = await api.get('/api/bolao/visualizacao'); }
  catch (e) { conteudo.append(vazio('⚠️', 'Erro ao carregar', e.message)); return; }

  if (!dados.usuarios.length) {
    conteudo.append(vazio('👀', 'Sem apostadores', 'Cadastre apostadores e registre palpites para comparar aqui.'));
    return;
  }

  // só mostra jogos com confronto definido ou com alguma aposta
  const jogos = dados.jogos.filter((j) =>
    (j.mandante.definido && j.visitante.definido) || j.apostas.some((a) => a.palpite));

  const thead = el('tr', {},
    el('th', { class: 'jogo-col' }, 'Jogo'),
    el('th', {}, 'Resultado'),
    ...dados.usuarios.map((u) => el('th', {}, u.nome)));

  const corpo = el('tbody', {});
  for (const j of jogos) {
    const res = j.jogado
      ? el('td', { class: 'res', style: 'text-align:center' }, `${j.placar.mandante}×${j.placar.visitante}`)
      : el('td', { style: 'text-align:center;color:var(--tinta-fraca)' }, '—');
    const cells = dados.usuarios.map((u) => {
      const a = j.apostas.find((x) => x.usuarioId === u.id);
      if (!a || !a.palpite) return el('td', { class: 'palpite-cel sem' }, '—');
      const conteudoCel = [el('span', { class: 'ap' }, `${a.palpite.mandante}×${a.palpite.visitante}`)];
      if (j.jogado) conteudoCel.push(document.createTextNode(' '), seloEl(a.pontos));
      return el('td', { class: 'palpite-cel' }, ...conteudoCel);
    });
    corpo.append(el('tr', {}, el('td', { class: 'jogo-col' }, confMini(j)), res, ...cells));
  }

  conteudo.append(
    el('div', { class: 'nota', style: 'margin-bottom:10px' }, `${jogos.length} jogos · ${dados.usuarios.length} apostadores · role para o lado para ver todos`),
    el('div', { class: 'matriz-wrap' }, el('table', { class: 'matriz' }, el('thead', {}, thead), corpo)));
})();
