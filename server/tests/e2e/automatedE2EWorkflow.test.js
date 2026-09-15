'use strict';

const { request } = require('../setup/testServer');
const { getAuthToken } = require('../setup/testData');
const { ROLES, SYSTEM_STATUS, SESSION_STATUS } = require('../../src/utils/constants');

describe('Full Automated End-to-End (E2E) Workflow Testing Suite', () => {
  const adminToken = getAuthToken(ROLES.ADMIN);
  const facultyToken = getAuthToken(ROLES.FACULTY);

  it('Step 1: Machine Boot & Dynamic IP Registration -> Heartbeat & Info Poll', async () => {
    // 1.1 System boots and registers dynamic IP
    const hbRes = await request
      .post('/api/systems/heartbeat')
      .send({
        systemCode: 'PC-01',
        hostname: 'LAB1-PC01-HOST',
        ipAddress: '192.168.1.101',
      });

    expect(hbRes.status).toBe(200);
    expect(hbRes.body.success).toBe(true);
    expect(hbRes.body.data.systemCode).toBe('PC-01');
    expect(hbRes.body.data.ipAddress).toBe('192.168.1.101');

    // 1.2 Student Kiosk client polls system info
    const infoRes = await request.get('/api/system/info?systemCode=PC-01');
    expect(infoRes.status).toBe(200);
    expect(infoRes.body.data.systemCode).toBe('PC-01');
    expect(infoRes.body.data.status).toBe(SYSTEM_STATUS.AVAILABLE);
    expect(infoRes.body.data.serverTime).toBeDefined();

    // 1.3 Kiosk loads dropdown configurations
    const facultyRes = await request.get('/api/faculty');
    expect(facultyRes.status).toBe(200);
    expect(facultyRes.body.data.faculty.length).toBeGreaterThanOrEqual(1);

    const labsRes = await request.get('/api/labs');
    expect(labsRes.status).toBe(200);
    expect(labsRes.body.data.labs.length).toBeGreaterThanOrEqual(1);
  });

  it('Step 2: Student Login -> Backend Start Time Capture & Active Status', async () => {
    const studentPayload = {
      registerNumber: '732224IT001',
      studentName: 'Alice Johnson',
      systemNumber: 'LAB1-PC01',
      faculty: 'Dr. D. Sathya',
      department: 'IT',
      section: 'A',
      year: 3,
      duration: 120,
      sessionId: 'sess_e2e_001',
    };

    const startRes = await request.post('/api/attendance').send(studentPayload);

    expect(startRes.status).toBe(201);
    expect(startRes.body.success).toBe(true);
    expect(startRes.body.data.registrationNo).toBe('732224IT001');
    expect(startRes.body.data.systemCode).toBe('PC-01');
    expect(startRes.body.data.status).toBe(SESSION_STATUS.ACTIVE);
    expect(startRes.body.data.faculty).toBe('Dr. D. Sathya');

    // Verify PC-01 is now ACTIVE
    const sysRes = await request.get('/api/systems/sys-PC-01');
    expect(sysRes.status).toBe(200);
    expect(sysRes.body.data.status).toBe(SYSTEM_STATUS.ACTIVE);
  });

  it('Step 3: Security & Conflict Automation -> Reject Duplicate Active Student & Busy Workstation', async () => {
    // 3.1 Start active session for Student 1 on PC-01
    await request.post('/api/attendance').send({
      registerNumber: '732224IT001',
      studentName: 'Alice Johnson',
      systemNumber: 'PC-01',
      sessionId: 'sess_e2e_001',
    });

    // 3.2 Duplicate Active Student Login Prevention:
    // Same student tries to log into PC-02 concurrently -> MUST BE REJECTED with 409 'Invalid User'
    const dupStudentRes = await request.post('/api/attendance').send({
      registerNumber: '732224IT001',
      studentName: 'Alice Johnson',
      systemNumber: 'PC-02',
      sessionId: 'sess_e2e_002',
    });

    expect(dupStudentRes.status).toBe(409);
    expect(dupStudentRes.body.message).toBe('Invalid User');
    expect(dupStudentRes.body.error.code).toBe('STUDENT_ALREADY_ACTIVE');

    // 3.3 Workstation Conflict Prevention:
    // Different student tries to log into PC-01 (which is already ACTIVE) -> MUST BE REJECTED with 409 'SYSTEM_BUSY'
    const busySysRes = await request.post('/api/attendance').send({
      registerNumber: '732224IT002',
      studentName: 'Bob Smith',
      systemNumber: 'PC-01',
      sessionId: 'sess_e2e_003',
    });

    expect(busySysRes.status).toBe(409);
    expect(busySysRes.body.error.code).toBe('SYSTEM_BUSY');
  });

  it('Step 4: Problem Ticket Reporting & Admin Resolution Flow', async () => {
    // 4.1 Student reports hardware issue from kiosk
    const ticketRes = await request.post('/api/tickets').send({
      systemNumber: 'LAB1-PC01',
      category: 'Hardware',
      description: 'Mouse sensor stuttering',
      studentName: 'Alice Johnson',
      registerNumber: '732224IT001',
    });

    expect(ticketRes.status).toBe(201);
    expect(ticketRes.body.data.ticketId).toBeDefined();
    expect(ticketRes.body.data.status).toBe('OPEN');
    const ticketId = ticketRes.body.data.id;

    // 4.2 Staff views open tickets
    const listRes = await request
      .get('/api/tickets?status=OPEN')
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((t) => t.id === ticketId)).toBe(true);

    // 4.3 Staff resolves the ticket
    const resolveRes = await request
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ status: 'RESOLVED' });

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.status).toBe('RESOLVED');
    expect(resolveRes.body.data.resolvedAt).toBeDefined();
  });

  it('Step 5: Session End -> Workstation Release & Next Session Activation', async () => {
    // 5.1 Start session
    await request.post('/api/attendance').send({
      registerNumber: '732224IT001',
      studentName: 'Alice Johnson',
      systemNumber: 'PC-01',
      sessionId: 'sess_e2e_release',
    });

    // 5.2 End session from kiosk
    const endRes = await request.put('/api/attendance/sess_e2e_release/end').send({});

    expect(endRes.status).toBe(200);
    expect(endRes.body.data.status).toBe(SESSION_STATUS.COMPLETED);

    // 5.3 Verify PC-01 is AVAILABLE again
    const sysRes = await request.get('/api/systems/sys-PC-01');
    expect(sysRes.body.data.status).toBe(SYSTEM_STATUS.AVAILABLE);

    // 5.4 Student can now start a new session on PC-02 without duplicate conflict
    const newSessionRes = await request.post('/api/attendance').send({
      registerNumber: '732224IT001',
      studentName: 'Alice Johnson',
      systemNumber: 'PC-02',
      sessionId: 'sess_e2e_new',
    });

    expect(newSessionRes.status).toBe(201);
    expect(newSessionRes.body.data.status).toBe(SESSION_STATUS.ACTIVE);
  });

  it('Step 6: Administrative Analytics, Attendance, & Excel Export', async () => {
    // 6.1 Dashboard overview stats
    const dashRes = await request
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(dashRes.status).toBe(200);
    expect(dashRes.body.data).toHaveProperty('systems');

    // 6.2 Attendance log records
    const attRes = await request
      .get('/api/attendance')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(attRes.status).toBe(200);
    expect(attRes.body.data).toBeDefined();

    // 6.3 Real-time student presence
    const presRes = await request
      .get('/api/students/presence')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(presRes.status).toBe(200);
    expect(presRes.body.data).toBeDefined();

    // 6.4 Excel export of sessions
    const exportRes = await request
      .get('/api/export/sessions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(exportRes.status).toBe(200);
    expect(exportRes.headers['content-type']).toContain('spreadsheetml');
  });
});
