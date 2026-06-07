'use strict';
const { api, el, esc, montarLayout, subnavBolao, toast, vazio } = window.PacCopa;

montarLayout('bolao');
document.getElementById('subnav').append(subnavBolao('usuarios'));

const CORES = ['#009c3b', '#1351b4', '#f7b500', '#00712b', '#002776'];
const corDe = (nome) => CORES[[...nome].reduce((a, c) => a + c.charCodeAt(0), 0) % CORES.length];
const iniciais = (nome) => nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

const conteudo = document.getElementById('conteudo');

function render(users) {
  conteudo.innerHTML = '';

  const input = el('input', { type: 'text', placeholder: 'Nome do apostador', maxlength: '40',
    onkeydown: (e) => { if (e.key === 'Enter') adicionar(input); } });
  const form = el('div', { class: 'form-card' },
    el('h3', {}, 'Novo apostador'),
    el('div', { class: 'sub' }, 'Informe apenas o nome. Você adiciona quantos quiser.'),
    el('div', { class: 'form-inline' },
      el('div', { class: 'campo' }, el('label', {}, 'Nome'), input),
      el('button', { class: 'btn btn--verde', onclick: () => adicionar(input) }, '+ Adicionar')));
  conteudo.append(form);

  if (!users.length) {
    conteudo.append(vazio('👤', 'Nenhum apostador ainda', 'Cadastre o primeiro acima para começar o bolão.'));
    return;
  }
  const grid = el('div', { class: 'lista-users' });
  users.forEach((u) => grid.append(el('div', { class: 'user-card' },
    el('span', { class: 'av', style: `background:${corDe(u.nome)}` }, iniciais(u.nome)),
    el('span', { class: 'nome' }, u.nome))));
  conteudo.append(el('div', { class: 'nota', style: 'margin:18px 0 4px' }, `${users.length} apostador${users.length !== 1 ? 'es' : ''}`), grid);
}

async function adicionar(input) {
  const nome = input.value.trim();
  if (!nome) { toast('Digite um nome', true); return; }
  try {
    await api.post('/api/bolao/usuarios', { nome });
    toast(`${nome} entrou no bolão!`);
    render(await api.get('/api/bolao/usuarios'));
  } catch (e) { toast(e.message, true); }
}

(async function init() {
  try { render(await api.get('/api/bolao/usuarios')); }
  catch (e) { conteudo.append(vazio('⚠️', 'Erro ao carregar', e.message)); }
})();
