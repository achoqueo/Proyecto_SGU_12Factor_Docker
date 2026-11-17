'use strict';

class AppError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function mapErrorToHttp(err) {
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      body: {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {})
        }
      }
    };
  }

  if (err && err.code === '23505') {
    return {
      statusCode: 409,
      body: {
        error: {
          code: 'DUPLICATE_ENROLLMENT',
          message: 'El estudiante ya se encuentra matriculado en esta sección.'
        }
      }
    };
  }

  return {
    statusCode: 500,
    body: {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Ocurrió un error interno al procesar la solicitud.'
      }
    }
  };
}

module.exports = { AppError, mapErrorToHttp };