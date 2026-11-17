'use strict';

const { loadConfig } = require('./config');
const { createLogger } = require('./logger');
const { createDb } = require('./db');
const { EnrollmentService } = require('./enrollment-service');
const { createApp } = require('./app');

async function start() {
  const config = loadConfig();
  const logger = createLogger({ serviceName: config.serviceName, level: config.logLevel });
  const db = createDb(config.db, logger);
  const enrollmentService = new EnrollmentService(db.pool, logger);
  const server = createApp({ config, db, enrollmentService, logger });

  server.listen(config.port, '0.0.0.0', () => {
    logger.info('Servidor iniciado correctamente', {
      port: config.port,
      nodeEnv: config.nodeEnv
    });
  });

  async function shutdown(signal) {
    logger.info(`Señal ${signal} recibida. Iniciando apagado ordenado...`);
    server.close(async () => {
      try {
        await db.close();
        logger.info('Pool de base de datos cerrado. Proceso finalizado.');
        process.exit(0);
      } catch (err) {
        logger.error('Error cerrando conexiones de base de datos', { err });
        process.exit(1);
      }
    });

    setTimeout(() => {
      logger.error('Tiempo de espera agotado para apagado ordenado. Forzando salida.');
      process.exit(1);
    }, 10000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  process.stderr.write(`${JSON.stringify({ level: 'error', message: err.message })}\n`);
  process.exit(1);
});