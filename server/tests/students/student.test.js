'use strict';

const { request } = require('../setup/testServer');
const { getAuthToken } = require('../setup/testData');
const { ROLES } = require('../../src/utils/constants');

describe('7. Student API Tests', () => {
  const adminToken = getAuthToken(ROLES.ADMIN);
  const facultyToken = getAuthToken(ROLES.FACULTY);

  describe('GET /api/students', () => {
    it('should list students with pagination', async () => {
      const res = await request.get('/api/students').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body).toHaveProperty('pagination');
    });

    it('should filter students by department and search', async () => {
      const res = await request
        .get('/api/students?department=Computer Science')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.every((s) => s.department === 'Computer Science')).toBe(true);
    });
  });

  describe('POST /api/students (Admin)', () => {
    it('should successfully create a new student', async () => {
      const newStudent = {
        registrationNo: 'REG2026999',
        name: 'Charlie Brown',
        department: 'ECE',
        section: 'C',
        year: 1,
      };

      const res = await request
        .post('/api/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newStudent);

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject(newStudent);
    });

    it('should reject duplicate registration number with 409', async () => {
      const duplicateStudent = {
        registrationNo: 'REG2026001', // Already exists in testData
        name: 'Duplicate Alice',
        department: 'CSE',
        section: 'A',
        year: 3,
      };

      const res = await request
        .post('/api/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(duplicateStudent);

      expect(res.status).toBe(409);
      expect(res.body.error).toHaveProperty('code', 'DUPLICATE_REGISTRATION_NO');
    });

    it('should reject invalid student payload (missing required fields)', async () => {
      const res = await request
        .post('/api/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Incomplete Student' });

      expect(res.status).toBe(422);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/students/:id', () => {
    it('should retrieve student by ID', async () => {
      const res = await request.get('/api/students/stu-001').set('Authorization', `Bearer ${facultyToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('registrationNo', 'REG2026001');
    });

    it('should return 404 for non-existent student ID', async () => {
      const res = await request.get('/api/students/non-existent-id').set('Authorization', `Bearer ${facultyToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toHaveProperty('code', 'STUDENT_NOT_FOUND');
    });
  });

  describe('GET /api/students/presence', () => {
    it('should return student presence list', async () => {
      const res = await request.get('/api/students/presence').set('Authorization', `Bearer ${facultyToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
