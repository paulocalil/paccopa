'use strict';

/* common.js — layout compartilhado e utilidades do frontend Pac Copa 2026.
 * Envolvido em IIFE: scripts clássicos compartilham o escopo global, então
 * nada deve "vazar" além de window.PacCopa (senão colide com os const das páginas). */
(function () {

const NAV = [
  { href: '/jogos.html', nome: 'Jogos', chave: 'jogos' },
  { href: '/classificacao.html', nome: 'Classificação', chave: 'classificacao' },
  { href: '/terceiros.html', nome: 'Terceiros', chave: 'terceiros' },
  { href: '/mata-mata.html', nome: 'Mata-mata', chave: 'mata-mata' },
  { href: '/artilharia.html', nome: 'Artilharia', chave: 'artilharia' },
  { href: '/estatisticas.html', nome: 'Estatísticas', chave: 'estatisticas' },
];

const FASE_LABEL = {
  grupo: 'Fase de grupos', '16avos': '16-avos de final', oitavas: 'Oitavas de final',
  quartas: 'Quartas de final', semi: 'Semifinais', terceiro: 'Disputa de 3º lugar', final: 'Final',
};

/* ---------- API ---------- */
const api = {
  async get(rota) {
    const r = await fetch(rota, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || `HTTP ${r.status}`);
    return r.json();
  },
  put(rota, corpo) { return enviar('PUT', rota, corpo); },
  post(rota, corpo) { return enviar('POST', rota, corpo); },
};
async function enviar(metodo, rota, corpo) {
  const r = await fetch(rota, {
    method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(dados.erro || `HTTP ${r.status}`);
  return dados;
}

/* ---------- DOM ---------- */
function el(tag, attrs = {}, ...filhos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v != null) n.setAttribute(k, v);
  }
  for (const f of filhos.flat()) if (f != null) n.append(f.nodeType ? f : document.createTextNode(f));
  return n;
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- Sigla / monograma da seleção ---------- */
function siglaHTML(sigla, vazio) {
  if (!sigla) return `<span class="sigla sigla--vazia">${esc(vazio || '?')}</span>`;
  return `<span class="sigla">${esc(sigla)}</span>`;
}

/* ---------- Layout (cabeçalho + rodapé) ---------- */
function montarLayout(ativa) {
  const nav = NAV.map((p) =>
    `<a href="${p.href}" class="${p.chave === ativa ? 'is-active' : ''}">${p.nome}</a>`).join('');

  const header = `
    <header class="site-header">
      <div class="container site-header__inner">
        <a class="brand" href="/">
          <span class="brand__mark"><span></span></span>
          <span class="brand__name"><b>PAC</b> COPA <i>2026</i></span>
        </a>
        <nav class="site-nav">
          ${nav}
          <span class="sep"></span>
          <a href="/bolao-classificacao.html" class="${ativa === 'bolao' ? 'is-active' : ''}">Bolão</a>
        </nav>
      </div>
    </header>`;

  const footer = `
    <footer class="site-footer">
      <div class="container site-footer__inner">
        <span>© 2026 <b>Pac Copa 2026</b></span>
        <span class="flag-bar"><i></i><i></i><i></i></span>
      </div>
    </footer>`;

  const topo = document.getElementById('topo');
  if (topo) topo.outerHTML = header;
  const rod = document.getElementById('rodape');
  if (rod) rod.outerHTML = footer;
}

// Sub-navegação das páginas do bolão.
const BOLAO_NAV = [
  { href: '/bolao-usuarios.html', nome: 'Apostadores', chave: 'usuarios' },
  { href: '/bolao-palpites.html', nome: 'Palpites', chave: 'palpites' },
  { href: '/bolao-visualizacao.html', nome: 'Visualização', chave: 'visualizacao' },
  { href: '/bolao-classificacao.html', nome: 'Classificação', chave: 'classificacao' },
];
function subnavBolao(ativa) {
  return el('div', { class: 'subnav' },
    ...BOLAO_NAV.map((p) => el('a', { href: p.href, class: p.chave === ativa ? 'is-on' : '' }, p.nome)));
}

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg, erro = false) {
  let t = document.querySelector('.toast');
  if (!t) { t = el('div', { class: 'toast' }); document.body.append(t); }
  t.textContent = msg;
  t.classList.toggle('erro', erro);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ---------- Estado vazio ---------- */
function vazio(icone, titulo, sub) {
  return el('div', { class: 'vazio' },
    el('div', { class: 'big' }, icone),
    el('div', { html: `<strong>${esc(titulo)}</strong>` }),
    sub ? el('div', { class: 'nota', html: esc(sub) }) : null);
}

window.PacCopa = { api, el, esc, siglaHTML, montarLayout, subnavBolao, toast, vazio, NAV, FASE_LABEL };

})();
