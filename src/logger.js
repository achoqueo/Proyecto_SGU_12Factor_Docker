'use strict';

const REDACTED_KEYS = new Set(['password', 'db_password', 'token', 'authorization', 'secret']);

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return {};
  const clean = {};
  for (const [key, value] of Object.entries(meta)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      clean[key] = '[REDACTED]';
    } else if (value instanceof Error) {
      clean[key] = { name: value.name, message: value.message, code: value.code };
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

function createLogger({ serviceName = 'sgu-matricula-api', level = 'info' } = {}) {
  const levels = { debug: 10, info: 20, warn: 30, error: 40 };
  const minLevel = levels[level] ?? levels.info;

  function write(logLevel, message, meta = {}) {
    if ((levels[logLevel] ?? 20) < minLevel) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level: logLevel,
      service: serviceName,
      message,
      ...sanitizeMeta(meta)
    };

    const line = JSON.stringify(entry);
    if (logLevel === 'error' || logLevel === 'warn') {
      process.stderr.write(`${line}\n`);
    } else {
      process.stdout.write(`${line}\n`);
    }
  }

  return {
    debug: (msg, meta) => write('debug', msg, meta),
    info: (msg, meta) => write('info', msg, meta),
    warn: (msg, meta) => write('warn', msg, meta),
    error: (msg, meta) => write('error', msg, meta)
  };
}

module.exports = { createLogger };