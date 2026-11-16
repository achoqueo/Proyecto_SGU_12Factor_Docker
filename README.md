# SGU–UNJBG: Módulo de Matrícula (MVP a Cloud-Ready)

Proyecto práctico de Ingeniería de Software I (Unidad II – Semana 14, 2026-II). Implementa la API REST y dashboard web del módulo de matrícula aplicando los principios de **12-Factor App**, manejo estructurado de errores, logs correlacionables con `requestId`, contenerización multi-etapa con Docker y orquestación con Docker Compose + PostgreSQL.

## 1. Arquitectura y Estructura del Proyecto
- `public/`: Dashboard web (HTML, CSS y JS) con KPIs, formulario y consola JSON.
- `src/app.js`: Endpoints HTTP/REST (`/health/ready`, `/api/v1/catalog`, `/api/v1/dashboard`, `/api/v1/enrollments`).
- `src/config.js`: Carga y validación inmutable (`Object.freeze`) de variables de entorno.
- `src/enrollment-service.js`: Reglas de negocio y transacción atómica (`BEGIN` / `SELECT ... FOR UPDATE` / `COMMIT` / `ROLLBACK`).
- `src/errors.js` y `src/logger.js`: Contrato de errores públicos (`201`, `404`, `409`, `422`, `500`) y logs JSON con `requestId`.
- `Dockerfile` y `compose.yaml`: Construcción multi-etapa con usuario no-root (`USER node`), healthchecks y volumen persistente `sgu_data`.

## 2. Requisitos Previos
- Docker Desktop operativo y Docker Compose v2.
- Node.js 24.x (opcional para pruebas unitarias locales).
- Puerto TCP `8080` disponible en el host.

## 3. Guía de Instalación y Ejecución Reproducible

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/achoqueo/Proyecto_SGU_12Factor_Docker.git
   cd Proyecto_SGU_12Factor_Docker
