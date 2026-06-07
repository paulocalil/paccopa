'use strict';

/* app.js — utilidades compartilhadas do frontend Pac Copa 2026. */

/** GET em JSON com tratamento de erro simples. */
async function apiGet(rota) {
  const resp = await fetch(rota, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} em ${rota}`);
  return resp.json();
}

/** Atualiza o "pílula" de status do servidor no cabeçalho, se existir. */
async function atualizarStatus() {
  const el = document.querySelector('[data-status-pill]');
  if (!el) return;
  const texto = el.querySelector('[data-status-text]');
  try {
    const s = await apiGet('/api/status');
    el.classList.remove('is-offline');
    el.classList.add('is-online');
    if (texto) texto.textContent = 'Servidor no ar';
    // Preenche números do hero a partir dos dados carregados, quando houver.
    document.querySelectorAll('[data-stat]').forEach((node) => {
      const chave = node.getAttribute('data-stat');
      if (s.dados && chave in s.dados) node.textContent = s.dados[chave];
    });
  } catch (err) {
    el.classList.remove('is-online');
    el.classList.add('is-offline');
    if (texto) texto.textContent = 'Servidor offline';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  atualizarStatus();
});
