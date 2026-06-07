'use strict';

/**
 * storage.js — leitura e gravação de arquivos JSON em `data/`.
 *
 * Princípios:
 *  - JSON é a ÚNICA fonte de dados (sem banco).
 *  - Gravação ATÔMICA: escreve num arquivo temporário e renomeia (rename é
 *    atômico no mesmo volume), evitando arquivos corrompidos por gravação parcial.
 *  - BACKUP com timestamp em `data/backups/` antes de sobrescrever um arquivo
 *    existente, para que nenhuma edição destrua o estado anterior.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

/** Garante que as pastas de dados/backup existam. */
function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/** Caminho absoluto de um arquivo de dados a partir do nome (ex.: "matches.json"). */
function dataPath(fileName) {
  return path.join(DATA_DIR, fileName);
}

/** Timestamp seguro para nome de arquivo: 2026-06-05T14-32-07-123Z */
function timestampTag(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

/**
 * Lê e faz parse de um arquivo JSON de `data/`.
 * @param {string} fileName  ex.: "matches.json"
 * @param {*} fallback       valor retornado se o arquivo não existir
 */
function readJSON(fileName, fallback = null) {
  const file = dataPath(fileName);
  if (!fs.existsSync(file)) {
    return fallback;
  }
  const raw = fs.readFileSync(file, 'utf8');
  if (raw.trim() === '') {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`JSON inválido em ${fileName}: ${err.message}`);
  }
}

/**
 * Faz uma cópia de backup do arquivo (se existir) em `data/backups/`.
 * @returns {string|null} caminho do backup criado, ou null se não havia arquivo.
 */
function backup(fileName) {
  ensureDirs();
  const file = dataPath(fileName);
  if (!fs.existsSync(file)) {
    return null;
  }
  const tag = timestampTag(new Date());
  const base = path.basename(fileName, '.json');
  const backupFile = path.join(BACKUP_DIR, `${base}.${tag}.json`);
  fs.copyFileSync(file, backupFile);
  return backupFile;
}

/**
 * Grava um valor como JSON de forma atômica, fazendo backup do arquivo anterior.
 * @param {string} fileName  ex.: "matches.json"
 * @param {*} value          objeto/array serializável
 */
function writeJSON(fileName, value) {
  ensureDirs();
  const file = dataPath(fileName);
  backup(fileName);

  const tmp = `${file}.${process.pid}.${timestampTag(new Date())}.tmp`;
  const json = JSON.stringify(value, null, 2);
  fs.writeFileSync(tmp, json, 'utf8');
  fs.renameSync(tmp, file); // troca atômica
  return file;
}

module.exports = {
  DATA_DIR,
  BACKUP_DIR,
  ensureDirs,
  dataPath,
  readJSON,
  writeJSON,
  backup,
};
