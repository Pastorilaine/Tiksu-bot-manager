'use strict';

/**
 * How often a crashing bot may be restarted automatically.
 *
 * Without a cap, a bot that dies on startup (bad token, syntax error) restarts
 * every 3 s forever and buries the log. Backoff doubles each attempt and the
 * chain stops after MAX_RESTARTS consecutive failures — a bot that managed to
 * stay up for HEALTHY_RUN_MS gets its full budget back.
 */

const MAX_RESTARTS = 5;
const BASE_DELAY_MS = 3000;
const MAX_DELAY_MS = 60000;
const HEALTHY_RUN_MS = 60000;

/**
 * @param {number} count consecutive auto-restarts so far
 * @param {number} ranMs how long the run that just ended lasted
 * @returns {{ restart: boolean, count: number, delayMs: number, attempt: number }}
 */
function nextRestart(count, ranMs) {
  const used = ranMs >= HEALTHY_RUN_MS ? 0 : count;
  if (used >= MAX_RESTARTS) return { restart: false, count: used, delayMs: 0, attempt: used };
  return {
    restart: true,
    count: used + 1,
    delayMs: Math.min(BASE_DELAY_MS * 2 ** used, MAX_DELAY_MS),
    attempt: used + 1,
  };
}

module.exports = { nextRestart, MAX_RESTARTS, HEALTHY_RUN_MS };
