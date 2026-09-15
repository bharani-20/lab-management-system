'use strict';

const { request } = require('../setup/testServer');
const { getAuthToken } = require('../setup/testData');
const { ROLES } = require('../../src/utils/constants');

describe('Student Kiosk Attendance Compatibility Endpoint Tests (POST & PUT /api/attendance)', () => {
  const adminToken = getAuthToken(ROLES.ADMIN);

  it('POST /api/attendance with kiosk payload should start a session and record attendance without JWT', async () => {
    const res = await request
      .post('/api/attendance')
      .send({
        registerNumber: '732224IT013',
        studentName: 'Bharani',
        systemNumber: 'LAB1-PC10',
        faculty: 'Dr. D. Sathya',
        inTime: '2026-09-15T10:00:00.000Z',
        sessionId: 'sess_kiosk_100',
        department: 'IT',
        section: 'A',
        year: 3,
        duration: 60,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('sessionId');
    expect(res.body.data.registrationNo).toBe('732224IT013');
    expect(res.body.data.systemCode).toBe('PC-10');
    expect(res.body.data.faculty).toBe('Dr. D. Sathya');
    expect(res.body.data.status).toBe('ACTIVE');
  });

  it('POST /api/attendance should reject duplicate active student on another PC with 409 and Invalid User', async () => {
    // Start active session on PC-10 first
    await request
      .post('/api/attendance')
      .send({
        registerNumber: '732224IT013',
        studentName: 'Bharani',
        systemNumber: 'LAB1-PC10',
        sessionId: 'sess_kiosk_100',
      });

    // Try starting another session for same student on PC-11
    const res = await request
      .post('/api/attendance')
      .send({
        registerNumber: '732224IT013',
        studentName: 'Bharani',
        systemNumber: 'LAB1-PC11',
        sessionId: 'sess_kiosk_101',
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Invalid User');
    expect(res.body.error.code).toBe('STUDENT_ALREADY_ACTIVE');
  });

  it('PUT /api/attendance/:id/end should end the student session using kiosk sessionId', async () => {
    // Start active session first
    await request
      .post('/api/attendance')
      .send({
        registerNumber: '732224IT013',
        studentName: 'Bharani',
        systemNumber: 'LAB1-PC10',
        sessionId: 'sess_kiosk_100',
      });

    const res = await request
      .put('/api/attendance/sess_kiosk_100/end')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('COMPLETED');
  });

  it('POST /api/attendance with JWT and studentId should record manual admin attendance', async () => {
    const res = await request
      .post('/api/attendance')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        studentId: 'stu-732224IT001',
        date: '2026-09-15',
        status: 'PRESENT',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});
