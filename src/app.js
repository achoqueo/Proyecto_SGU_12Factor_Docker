'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { AppError, mapErrorToHttp } = require('./errors');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function sendJson(res, statusCode, payload, requestId) {
  const body = JSON.stringify({ ...payload, requestId });
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'X-Request-Id': requestId
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        reject(new AppError(413, 'PAYLOAD_TOO_LARGE', 'El cuerpo de la petición excede el límite permitido.'));
      }
    });
    req.on('end', () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new AppError(400, 'INVALID_JSON', 'El cuerpo de la solicitud no es un JSON válido.'));
      }
    });
    req.on('error', reject);
  });
}

function serveStaticFile(reqPath, res, requestId) {
  const publicDir = path.join(__dirname, '..', 'public');
  const safePath = reqPath === '/' ? 'index.html' : reqPath.replace(/^\/+/, '');
  const fullPath = path.resolve(publicDir, safePath);

  if (!fullPath.startsWith(publicDir)) {
    return sendJson(res, 403, { error: { code: 'FORBIDDEN', message: 'Acceso denegado.' } }, requestId);
  }

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      return sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Recurso no encontrado.' } }, requestId);
    }
    const ext = path.extname(fullPath);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'X-Request-Id': requestId
    });
    res.end(content);
  });
}

function createApp({ config, db, enrollmentService, logger }) {
  return http.createServer(async (req, res) => {
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    const start = Date.now();
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    res.on('finish', () => {
      logger.info('HTTP Request', {
        requestId,
        method: req.method,
        path: url.pathname,
        statusCode: res.statusCode,
        durationMs: Date.now() - start
      });
    });

    try {
      // Healthcheck de disponibilidad (liveness/readiness)
      if (req.method === 'GET' && url.pathname === '/health/ready') {
        await db.checkHealth();
        return sendJson(
          res,
          200,
          { status: 'ready', service: config.serviceName, timestamp: new Date().toISOString() },
          requestId
        );
      }

      // Catálogo de estudiantes y secciones
      if (req.method === 'GET' && url.pathname === '/api/v1/catalog') {
        const data = await enrollmentService.getCatalog();
        return sendJson(res, 200, { data }, requestId);
      }

      // KPIs y lista de matrículas para el dashboard
      if (req.method === 'GET' && url.pathname === '/api/v1/dashboard') {
        const data = await enrollmentService.getDashboardData();
        return sendJson(res, 200, { data }, requestId);
      }

      // Registro de matrícula
      if (req.method === 'POST' && url.pathname === '/api/v1/enrollments') {
        const payload = await readJsonBody(req);
        const enrollment = await enrollmentService.enroll(payload, requestId);
        return sendJson(res, 201, { data: enrollment }, requestId);
      }

      // Servir frontend estático (public/)
      if (req.method === 'GET') {
        return serveStaticFile(url.pathname, res, requestId);
      }

      throw new AppError(404, 'ROUTE_NOT_FOUND', `Ruta no encontrada: ${req.method} ${url.pathname}`);
    } catch (err) {
      const mapped = mapErrorToHttp(err);
      if (mapped.statusCode >= 500) {
        logger.error('Error interno procesando petición', { requestId, err });
      } else {
        logger.warn('Solicitud rechazada por validación o negocio', {
          requestId,
          code: mapped.body.error.code,
          statusCode: mapped.statusCode
        });
      }
      return sendJson(res, mapped.statusCode, mapped.body, requestId);
    }
  });
}

module.exports = { createApp };