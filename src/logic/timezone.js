'use strict';

/**
 * timezone.js — exibição de horários no fuso de Brasília.
 *
 * Os jogos são armazenados em UTC (`dataHoraUTC`). O Brasil não adota horário
 * de verão desde 2019, então America/Sao_Paulo é GMT-3 fixo. Usamos o
 * `Intl.DateTimeFormat` nativo (ICU embutido no Node), sem dependências.
 */

const TZ = 'America/Sao_Paulo';

const fmtData = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
const fmtDiaSemana = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'short' });
const fmtChaveDia = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

/**
 * Converte um instante UTC (ISO) para partes legíveis em horário de Brasília.
 * @param {string} iso  ex.: "2026-06-11T19:00:00Z"
 * @returns {{iso:string,data:string,hora:string,diaSemana:string,diaChave:string,rotulo:string}}
 */
function partesBrasilia(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const data = fmtData.format(d);                         // 11/06/2026
  const hora = fmtHora.format(d);                         // 16:00
  const diaSemana = fmtDiaSemana.format(d).replace('.', ''); // qui
  const diaChave = fmtChaveDia.format(d);                 // 2026-06-11 (para filtros)
  return {
    iso,
    data,
    hora,
    diaSemana,
    diaChave,
    rotulo: `${diaSemana} ${data} · ${hora}`,
  };
}

module.exports = { TZ, partesBrasilia };
