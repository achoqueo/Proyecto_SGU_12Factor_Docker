'use strict';

function parsePositiveInt(value, fallback, name) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`[CONFIG ERROR] La variable ${name} debe ser un entero positivo. Recibido: "${value}"`);
  }
  return parsed;
}

function loadConfig(env = process.env) {
  const dbPassword = env.DB_PASSWORD;
  if (!dbPassword || String(dbPassword).trim() === '') {
    throw new Error('[CONFIG ERROR] Falta la variable obligatoria DB_PASSWORD en el entorno.');
  }

  const config = {
    nodeEnv: env.NODE_ENV || 'development',
    port: parsePositiveInt(env.PORT, 8080, 'PORT'),
    serviceName: env.SERVICE_NAME || 'sgu-matricula-api',
    logLevel: (env.LOG_LEVEL || 'info').toLowerCase(),
    db: Object.freeze({
      host: env.DB_HOST || 'localhost',
      port: parsePositiveInt(env.DB_PORT, 5432, 'DB_PORT'),
      database: env.DB_NAME || 'sgu_matricula',
      user: env.DB_USER || 'sgu_user',
      password: String(dbPassword),
      maxPoolSize: parsePositiveInt(env.DB_POOL_MAX, 10, 'DB_POOL_MAX'),
      idleTimeoutMillis: parsePositiveInt(env.DB_IDLE_TIMEOUT_MS, 30000, 'DB_IDLE_TIMEOUT_MS'),
      connectionTimeoutMillis: parsePositiveInt(env.DB_CONN_TIMEOUT_MS, 5000, 'DB_CONN_TIMEOUT_MS')
    })
  };

  return Object.freeze(config);
}

module.exports = { loadConfig };