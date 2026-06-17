'use strict';

/* app.js — utilidades compartilhadas do frontend Pac Copa 2026. */

/** GET em JSON com tratamento de erro simples. */
async function apiGet(rota) {
  const resp = await fetch(rota, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} em ${rota}`);
  return resp.json();
}
