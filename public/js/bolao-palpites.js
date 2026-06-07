'use strict';
const { api, el, esc, siglaHTML, montarLayout, subnavBolao, toast, vazio } = window.PacCopa;

montarLayout('bolao');
document.getElementById('subnav').append(subnavBolao('palpites'));

const conteudo = document.getElementById('conteudo');
const LS = 'paccopa.bolao.usuario';

const seloEl = (pts) => el('span', { class: `selo p${pts}` }, String(pts));

function regrasEl() {
  const regra = (cls, n, txt) => el('div', { class: `regra ${cls}` }, el('b', {}, String(n)), el('small', {}, txt));
  return el('div', { class: 'regras-bolao' },
    regra('r15', 15, 'Placar exato'),
    regra('r10', 10, 'Acertou o resultado (vencedor ou empate)'),
    regra('r5', 5, 'Acertou o total de gols'));
}

function confEl(j) {
  const casa = el('div', { class: 'lado casa' }, el('span', { class: 'nome' }, j.mandante.label), el('span', { html: siglaHTML(j.mandante.sigla) }));
  const vis = el('div', { class: 'lado' }, el('span', { html: siglaHTML(j.visitante.sigla) }), el('span', { class: 'nome' }, j.visitante.label));
  return el('div', { class: 'palpite__conf' }, casa, el('span', { class: 'x', style: 'text-align:center;color:var(--tinta-fraca)' }, '×'), vis);
}
function quandoEl(j) {
  const tag = j.grupo ? `Grupo ${j.grupo}` : ({ '16avos': '16-avos', oitavas: 'Oitavas', quartas: 'Quartas', semi: 'Semi', terceiro: '3º lugar', final: 'Final' }[j.fase] || j.fase);
  return el('div', { class: 'palpite__quando' }, el('span', { class: 'hora' }, j.quando.hora), `${j.quando.data}`, el('div', {}, el('span', { class: 'tag tag--grupo', style: 'margin-top:4px;display:inline-block' }, tag)));
}

let entradas = []; // { jogoId, inM, inV }

function linhaEditavel(j) {
  const inM = el('input', { class: 'mini', type: 'number', min: '0', max: '99', value: j.palpite ? j.palpite.mandante : '' });
  const inV = el('input', { class: 'mini', type: 'number', min: '0', max: '99', value: j.palpite ? j.palpite.visitante : '' });
  entradas.push({ jogoId: j.id, inM, inV });
  return el('div', { class: 'palpite' }, quandoEl(j), confEl(j),
    el('div', { class: 'palpite__inputs' }, inM, el('span', { class: 'x' }, '×'), inV));
}

function linhaLida(j) {
  const dir = el('div', { class: 'palpite__dir' },
    el('div', { html: `Resultado <b>${j.placar.mandante}×${j.placar.visitante}</b>` }),
    el('div', { class: 'nota' }, j.palpite ? `seu palpite ${j.palpite.mandante}×${j.palpite.visitante}` : 'sem palpite'),
    seloEl(j.pontos != null ? j.pontos : 0));
  return el('div', { class: 'palpite lido' }, quandoEl(j), confEl(j), dir);
}

async function carregar(usuarioId) {
  const alvo = document.getElementById('palpites-area');
  alvo.innerHTML = '';
  entradas = [];
  let dados;
  try { dados = await api.get(`/api/bolao/palpites/${usuarioId}`); }
  catch (e) { alvo.append(vazio('⚠️', 'Erro', e.message)); return; }

  const abertos = dados.jogos.filter((j) => j.editavel);
  const realizados = dados.jogos.filter((j) => !j.editavel);

  alvo.append(regrasEl());

  if (!abertos.length) {
    alvo.append(el('div', { class: 'aviso' }, el('span', { class: 'ic' }, 'ℹ️'),
      el('span', {}, 'Nenhum jogo aberto a palpite no momento (os próximos confrontos ainda dependem de resultados).')));
  } else {
    alvo.append(el('div', { class: 'dia-head' }, el('h3', { html: `Abertos para palpite · <b>${abertos.length}</b>` })));
    abertos.forEach((j) => alvo.append(linhaEditavel(j)));
    alvo.append(el('div', { class: 'barra-salvar' },
      el('span', { class: 'nota' }, 'Placares em branco não pontuam.'),
      el('button', { class: 'btn btn--verde', onclick: () => salvar(usuarioId) }, '💾 Salvar palpites')));
  }

  if (realizados.length) {
    alvo.append(el('div', { class: 'dia-head', style: 'margin-top:34px' }, el('h3', { html: `Já realizados · <b>${realizados.length}</b>` })));
    realizados.forEach((j) => alvo.append(linhaLida(j)));
  }
}

async function salvar(usuarioId) {
  const palpites = entradas.map((e) => ({
    jogoId: e.jogoId,
    palpite: { mandante: e.inM.value === '' ? null : Number(e.inM.value), visitante: e.inV.value === '' ? null : Number(e.inV.value) },
  }));
  try {
    await api.put(`/api/bolao/palpites/${usuarioId}`, { palpites });
    toast('Palpites salvos!');
  } catch (e) { toast(e.message, true); }
}

(async function init() {
  let users;
  try { users = await api.get('/api/bolao/usuarios'); }
  catch (e) { conteudo.append(vazio('⚠️', 'Erro ao carregar', e.message)); return; }

  if (!users.length) {
    conteudo.append(vazio('👤', 'Cadastre apostadores primeiro', 'Vá em Apostadores para adicionar quem vai jogar o bolão.'));
    return;
  }

  const guardado = localStorage.getItem(LS);
  const inicial = users.some((u) => u.id === guardado) ? guardado : users[0].id;
  const sel = el('select', { onchange: () => { localStorage.setItem(LS, sel.value); carregar(sel.value); } },
    ...users.map((u) => el('option', { value: u.id, ...(u.id === inicial ? { selected: '' } : {}) }, u.nome)));

  conteudo.append(
    el('div', { class: 'seletor' }, el('strong', {}, 'Apostador:'), sel),
    el('div', { id: 'palpites-area' }));
  carregar(inicial);
})();
