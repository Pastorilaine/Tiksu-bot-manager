'use strict';

/**
 * Bot env vars hold Discord tokens. Storing them as plain JSON in
 * %APPDATA%\Tiksu Bot Manager\config.json means anything running as the user
 * can read them. Electron's safeStorage encrypts with the OS keychain (DPAPI
 * on Windows), so we keep them as one encrypted blob per bot.
 *
 * On-disk shape:
 *   { …bot, envEnc: "<base64>" }          ← encrypted (current)
 *   { …bot, envVars: { KEY: "value" } }   ← plaintext (pre-1.8 / no keychain)
 *
 * safeStorage is injected so this module can be tested outside Electron.
 */

/** Bot as stored on disk → bot with a usable `envVars` object. */
function decryptBot(safeStorage, bot) {
  if (!bot || !bot.envEnc) return bot;
  const { envEnc, ...rest } = bot;
  try {
    const json = safeStorage.decryptString(Buffer.from(envEnc, 'base64'));
    return { ...rest, envVars: JSON.parse(json) };
  } catch (err) {
    // Keychain unavailable or blob written by another user/machine — better to
    // hand back an empty set than to crash the whole bot list.
    return { ...rest, envVars: {} };
  }
}

/** Bot from memory → bot safe to write to disk. */
function encryptBot(safeStorage, bot) {
  if (!bot) return bot;
  const { envVars, envEnc, ...rest } = bot;
  const vars = envVars ?? {};
  if (!safeStorage.isEncryptionAvailable()) {
    // No OS keychain (some Linux desktops): keep working, keep it plaintext.
    return { ...rest, envVars: vars };
  }
  return { ...rest, envEnc: safeStorage.encryptString(JSON.stringify(vars)).toString('base64') };
}

const decryptBots = (safeStorage, bots) => bots.map((b) => decryptBot(safeStorage, b));
const encryptBots = (safeStorage, bots) => bots.map((b) => encryptBot(safeStorage, b));

module.exports = { decryptBot, encryptBot, decryptBots, encryptBots };
