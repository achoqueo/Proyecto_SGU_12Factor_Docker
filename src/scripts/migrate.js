'use strict';

const { loadConfig } = require('../config');
const { createLogger } = require('../logger');
const { createDb } = require('../db');

const DDL = `
CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sections (
  id SERIAL PRIMARY KEY,
  course_code VARCHAR(20) NOT NULL,
  course_name VARCHAR(120) NOT NULL,
  period VARCHAR(20) NOT NULL,
  capacity INT NOT NULL CHECK (capacity > 0),
  enrolled_count INT NOT NULL DEFAULT 0 CHECK (enrolled_count >= 0 AND enrolled_count <= capacity),
  UNIQUE (course_code, period)
);

CREATE TABLE IF NOT EXISTS enrollments (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(id),
  section_id INT NOT NULL REFERENCES sections(id),
  status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, section_id)
);
`;

const SEED = `
INSERT INTO students (code, full_name, active) VALUES
  ('2023-119001', 'Alexandra Valeria Choque Onofre', TRUE),
  ('2023-119002', 'Alejandra Ramos Mamani', TRUE),
  ('2023-119003', 'Diana Mamani Ramos', TRUE),
  ('2023-119004', 'Jairo Zegarra Gutierrez', TRUE),
  ('2023-119005', 'Estudiante Inactivo Prueba', FALSE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sections (course_code, course_name, period, capacity, enrolled_count) VALUES
  ('IS-501', 'Ingeniería de Software I - Grupo A', '2026-II', 30, 0),
  ('BD-502', 'Base de Datos Avanzada - Grupo A', '2026-II', 25, 0),
  ('CLOUD-503', 'Arquitectura Cloud Native - Grupo ÚNICO', '2026-II', 2, 0)
ON CONFLICT (course_code, period) DO NOTHING;
`;

async function migrate() {
  const config = loadConfig();
  const logger = createLogger({ serviceName: config.serviceName, level: config.logLevel });
  const db = createDb(config.db, logger);

  try {
    logger.info('Ejecutando migraciones DDL y datos iniciales (seed)...');
    await db.pool.query(DDL);
    await db.pool.query(SEED);
    logger.info('Migración completada exitosamente.');
  } finally {
    await db.close();
  }
}

migrate().catch((err) => {
  process.stderr.write(`${JSON.stringify({ level: 'error', message: err.message })}\n`);
  process.exit(1);
});