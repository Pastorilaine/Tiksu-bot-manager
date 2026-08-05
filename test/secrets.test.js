'use strict';

/**
 * Self-check for electron/secrets.js — run with: node test/secrets.test.js
 * Fake safeStorage stands in for the OS keychain.
 */

const assert = require('assert');
const { decryptBot, encryptBot, decryptBots, encryptBots } = require('../electron/secrets');

// Reversible stand-in for DPAPI — same shape, no keychain needed
const keychain = {
  available: true,
  isEncryptionAvailable() { return this.available; },
  encryptString: (s) => Buffer.from('KEY:' + s, 'utf8'),
  decryptString: (buf) => {
    const s = buf.toString('utf8');
    if (!s.startsWith('KEY:')) throw new Error('bad ciphertext');
    return s.slice(4);
  },
};

const bot = { id: '1', name: 'Testi', envVars: { DISCORD_TOKEN: 'salainen', N: '2' } };

// ── 1. Round trip, and the plaintext never survives on the stored object ───
const stored = encryptBot(keychain, bot);
assert.strictEqual(stored.envVars, undefined, 'plaintext must not be written to disk');
assert.ok(typeof stored.envEnc === 'string' && stored.envEnc.length > 0);
assert.ok(!JSON.stringify(stored).includes('salainen'), 'token must not appear in the stored JSON');
assert.deepStrictEqual(decryptBot(keychain, stored), bot);

// ── 2. Legacy plaintext bots keep working and migrate on the next write ───
const legacy = { id: '2', name: 'Vanha', envVars: { TOKEN: 'abc' } };
assert.deepStrictEqual(decryptBot(keychain, legacy), legacy, 'no envEnc → pass through');
const migrated = encryptBot(keychain, decryptBot(keychain, legacy));
assert.strictEqual(migrated.envVars, undefined);
assert.deepStrictEqual(decryptBot(keychain, migrated).envVars, { TOKEN: 'abc' });

// ── 3. Undecryptable blob → empty env, not a crash (whole list must load) ──
const corrupt = { id: '3', name: 'Rikki', envEnc: Buffer.from('garbage').toString('base64') };
const recovered = decryptBot(keychain, corrupt);
assert.deepStrictEqual(recovered.envVars, {});
assert.strictEqual(recovered.name, 'Rikki');
assert.strictEqual(recovered.envEnc, undefined);

// ── 4. No keychain (some Linux desktops) → stays plaintext, still works ───
keychain.available = false;
const plain = encryptBot(keychain, bot);
assert.deepStrictEqual(plain.envVars, bot.envVars);
assert.strictEqual(plain.envEnc, undefined);
keychain.available = true;

// ── 5. Bots with no env vars at all ───────────────────────────────────────
const bare = encryptBot(keychain, { id: '4', name: 'Tyhjä' });
assert.deepStrictEqual(decryptBot(keychain, bare).envVars, {});

// ── 6. List helpers round-trip ────────────────────────────────────────────
const list = [bot, legacy];
assert.deepStrictEqual(decryptBots(keychain, encryptBots(keychain, list)), list);

console.log('secrets.test.js: all checks passed');
