'use strict';

/**
 * Self-check for electron/restart-policy.js — run with:
 *   node test/restart-policy.test.js
 */

const assert = require('assert');
const { nextRestart, MAX_RESTARTS, HEALTHY_RUN_MS } = require('../electron/restart-policy');

const INSTANT = 500;  // crashed half a second in

// ── 1. A bot crashing on startup backs off, then gives up ──────────────────
const delays = [];
let count = 0;
for (let i = 0; i < MAX_RESTARTS; i++) {
  const r = nextRestart(count, INSTANT);
  assert.strictEqual(r.restart, true, `attempt ${i + 1} should still restart`);
  assert.strictEqual(r.attempt, i + 1);
  delays.push(r.delayMs);
  count = r.count;
}
assert.deepStrictEqual(delays, [3000, 6000, 12000, 24000, 48000]);

const givenUp = nextRestart(count, INSTANT);
assert.strictEqual(givenUp.restart, false, 'must stop after MAX_RESTARTS');
assert.strictEqual(givenUp.delayMs, 0);

// ── 2. Delay is capped even if the counter somehow runs high ──────────────
const capped = nextRestart(0, INSTANT);
assert.ok(capped.delayMs <= 60000);
assert.ok(nextRestart(3, INSTANT).delayMs <= 60000);

// ── 3. A run that stayed up gets the full budget back ─────────────────────
const recovered = nextRestart(MAX_RESTARTS, HEALTHY_RUN_MS);
assert.strictEqual(recovered.restart, true, 'a healthy run resets the budget');
assert.strictEqual(recovered.attempt, 1);
assert.strictEqual(recovered.delayMs, 3000);

// ── 4. Just under the healthy threshold does NOT reset ─────────────────────
const stillCounting = nextRestart(MAX_RESTARTS, HEALTHY_RUN_MS - 1);
assert.strictEqual(stillCounting.restart, false);

console.log('restart-policy.test.js: all checks passed');
