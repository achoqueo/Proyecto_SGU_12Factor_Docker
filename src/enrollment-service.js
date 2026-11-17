'use strict';

const { AppError } = require('./errors');

function validateEnrollmentInput(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new AppError(422, 'VALIDATION_ERROR', 'El cuerpo de la solicitud debe ser un objeto JSON.');
  }

  const studentId = Number(payload.studentId);
  const sectionId = Number(payload.sectionId);

  if (!Number.isInteger(studentId) || studentId <= 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'El campo studentId debe ser un entero positivo.');
  }
  if (!Number.isInteger(sectionId) || sectionId <= 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'El campo sectionId debe ser un entero positivo.');
  }

  return { studentId, sectionId };
}

class EnrollmentService {
  constructor(pool, logger) {
    this.pool = pool;
    this.logger = logger;
  }

  async getCatalog() {
    const [studentsRes, sectionsRes] = await Promise.all([
      this.pool.query('SELECT id, code, full_name, active FROM students ORDER BY id ASC'),
      this.pool.query(
        'SELECT id, course_code, course_name, period, capacity, enrolled_count, (capacity - enrolled_count) AS available FROM sections ORDER BY id ASC'
      )
    ]);

    return {
      students: studentsRes.rows,
      sections: sectionsRes.rows
    };
  }

  async getDashboardData() {
    const [studentsCount, enrollmentsCount, vacanciesSum, enrollmentsList] = await Promise.all([
      this.pool.query('SELECT COUNT(*)::int AS total FROM students WHERE active = TRUE'),
      this.pool.query('SELECT COUNT(*)::int AS total FROM enrollments'),
      this.pool.query('SELECT COALESCE(SUM(capacity - enrolled_count), 0)::int AS total FROM sections'),
      this.pool.query(`
        SELECT e.id, e.student_id AS "studentId", s.code AS "studentCode", s.full_name AS "studentName",
               e.section_id AS "sectionId", sec.course_code AS "courseCode", sec.course_name AS "courseName",
               sec.period, e.status, e.created_at AS "createdAt"
        FROM enrollments e
        JOIN students s ON s.id = e.student_id
        JOIN sections sec ON sec.id = e.section_id
        ORDER BY e.id DESC
      `)
    ]);

    return {
      kpis: {
        activeStudents: studentsCount.rows[0].total,
        totalEnrollments: enrollmentsCount.rows[0].total,
        availableVacancies: vacanciesSum.rows[0].total
      },
      enrollments: enrollmentsList.rows
    };
  }

  async enroll({ studentId, sectionId }, requestId) {
    const validInput = validateEnrollmentInput({ studentId, sectionId });
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const studentRes = await client.query(
        'SELECT id, code, full_name, active FROM students WHERE id = $1',
        [validInput.studentId]
      );
      if (studentRes.rowCount === 0) {
        throw new AppError(404, 'STUDENT_NOT_FOUND', `El estudiante con ID ${validInput.studentId} no existe.`);
      }
      if (!studentRes.rows[0].active) {
        throw new AppError(409, 'STUDENT_INACTIVE', 'El estudiante no se encuentra activo para matrícula.');
      }

      const sectionRes = await client.query(
        'SELECT id, course_code, course_name, capacity, enrolled_count, period FROM sections WHERE id = $1 FOR UPDATE',
        [validInput.sectionId]
      );
      if (sectionRes.rowCount === 0) {
        throw new AppError(404, 'SECTION_NOT_FOUND', `La sección con ID ${validInput.sectionId} no existe.`);
      }

      const section = sectionRes.rows[0];

      const dupRes = await client.query(
        'SELECT id FROM enrollments WHERE student_id = $1 AND section_id = $2',
        [validInput.studentId, validInput.sectionId]
      );
      if (dupRes.rowCount > 0) {
        throw new AppError(409, 'DUPLICATE_ENROLLMENT', 'El estudiante ya está matriculado en esta sección.');
      }

      if (section.enrolled_count >= section.capacity) {
        throw new AppError(409, 'NO_VACANCIES', 'La sección no cuenta con vacantes disponibles.');
      }

      const insertRes = await client.query(
        `INSERT INTO enrollments (student_id, section_id, status, created_at)
         VALUES ($1, $2, 'CONFIRMED', NOW())
         RETURNING id, student_id, section_id, status, created_at`,
        [validInput.studentId, validInput.sectionId]
      );

      await client.query(
        'UPDATE sections SET enrolled_count = enrolled_count + 1 WHERE id = $1',
        [validInput.sectionId]
      );

      await client.query('COMMIT');

      const record = insertRes.rows[0];
      if (this.logger) {
        this.logger.info('Matrícula registrada exitosamente', {
          requestId,
          enrollmentId: record.id,
          studentId: validInput.studentId,
          sectionId: validInput.sectionId
        });
      }

      return {
        id: record.id,
        studentId: record.student_id,
        studentName: studentRes.rows[0].full_name,
        sectionId: record.section_id,
        courseCode: section.course_code,
        courseName: section.course_name,
        status: record.status,
        createdAt: record.created_at
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = { EnrollmentService, validateEnrollmentInput };