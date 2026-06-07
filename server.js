'use strict';

/**
 * server.js — Pac Copa 2026
 *
 * Servidor local (Node.js + Express) que:
 *  - serve as páginas estáticas em `public/`;
 *  - expõe uma API REST que lê/grava os JSON de `data/`.
 *
 * Nesta etapa (esqueleto) só existe a infraestrutura: servir o frontend,
 * um endpoint de status e um esboço da API. A lógica de cálculo e as rotas
 * completas entram nas etapas seguintes do plano.
 */

const path = require('path');
const express = require('express');
const storage = require('./src/storage');
const copa = require('./src/copa');
const bolao = require('./src/bolao');

const app = express();
const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(express.json({ limit: '1mb' }));

// --- Arquivos estáticos (HTML/CSS/JS do frontend) ---
app.use(express.static(PUBLIC_DIR));

// --- API ---------------------------------------------------------------

// Status do servidor + contagem básica dos dados disponíveis.
app.get('/api/status', (req, res) => {
  const teams = storage.readJSON('teams.json', []);
  const groups = storage.readJSON('groups.json', {});
  const matches = storage.readJSON('matches.json', []);

  res.json({
    app: 'Pac Copa 2026',
    versao: '0.1.0',
    horaServidor: new Date().toISOString(),
    dados: {
      selecoes: Array.isArray(teams) ? teams.length : 0,
      grupos: groups && typeof groups === 'object' ? Object.keys(groups).length : 0,
      jogos: Array.isArray(matches) ? matches.length : 0,
    },
  });
});

// Pequeno wrapper para repassar erros (com .status) ao handler central.
const rota = (fn) => (req, res, next) => { try { fn(req, res, next); } catch (err) { next(err); } };

// --- Leituras (cálculo sob demanda a partir dos JSON) ---
app.get('/api/jogos', rota((req, res) => {
  const { fase, grupo, data } = req.query;
  res.json(copa.jogos({ fase, grupo, data }));
}));

app.get('/api/jogos/:id', rota((req, res) => {
  const j = copa.jogos().find((x) => x.id === req.params.id);
  if (!j) return res.status(404).json({ erro: 'Jogo não encontrado', id: req.params.id });
  res.json(j);
}));

app.get('/api/classificacao', rota((req, res) => res.json(copa.classificacao())));
app.get('/api/terceiros', rota((req, res) => res.json(copa.terceiros())));
app.get('/api/chave', rota((req, res) => res.json(copa.chave())));
app.get('/api/artilharia', rota((req, res) => res.json(copa.artilharia())));

// Dados de apoio para o frontend
app.get('/api/times', rota((req, res) => res.json(storage.readJSON('teams.json', []))));
app.get('/api/estadios', rota((req, res) => res.json(storage.readJSON('stadiums.json', []))));
app.get('/api/grupos', rota((req, res) => res.json(storage.readJSON('groups.json', {}))));

// --- Escrita: editar resultado/eventos/pênaltis de uma partida ---
app.put('/api/jogos/:id', rota((req, res) => {
  const atualizado = copa.editarJogo(req.params.id, req.body || {});
  res.json(atualizado);
}));

// --- Bolão ---
app.get('/api/bolao/usuarios', rota((req, res) => res.json(bolao.listarUsuarios())));
app.post('/api/bolao/usuarios', rota((req, res) => res.status(201).json(bolao.criarUsuario((req.body || {}).nome))));
app.get('/api/bolao/jogos-disponiveis', rota((req, res) => res.json(bolao.jogosDisponiveis())));
app.get('/api/bolao/palpites/:usuarioId', rota((req, res) => res.json(bolao.palpitesDoUsuario(req.params.usuarioId))));
app.put('/api/bolao/palpites/:usuarioId', rota((req, res) => res.json(bolao.salvarPalpites(req.params.usuarioId, (req.body || {}).palpites))));
app.get('/api/bolao/visualizacao', rota((req, res) => res.json(bolao.visualizacao())));
app.get('/api/bolao/classificacao', rota((req, res) => res.json(bolao.ranking())));

// 404 para rotas de API não encontradas (evita devolver o index.html).
app.use('/api', (req, res) => {
  res.status(404).json({ erro: 'Rota de API não encontrada', rota: req.originalUrl });
});

// Handler central de erros — responde JSON com o status apropriado.
app.use('/api', (err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  if (status >= 500) console.error('Erro na API:', err);
  res.status(status).json({ erro: err.message || 'Erro interno' });
});

// Página amigável para rotas (não-API) inexistentes.
app.use((req, res) => {
  res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
});

// --- Inicialização ------------------------------------------------------

storage.ensureDirs();

app.listen(PORT, () => {
  console.log('');
  console.log('  ⚽  Pac Copa 2026');
  console.log(`  →  http://localhost:${PORT}`);
  console.log('');
});
