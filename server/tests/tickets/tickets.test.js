'use strict';

const { request } = require('../setup/testServer');
const { getAuthToken } = require('../setup/testData');
const { ROLES } = require('../../src/utils/constants');

describe('Tickets Endpoint Tests (POST /api/tickets, GET /api/tickets, PATCH /api/tickets/:id/status)', () => {
  const adminToken = getAuthToken(ROLES.ADMIN);
  const facultyToken = getAuthToken(ROLES.FACULTY);

  it('POST /api/tickets should allow student kiosk to submit a problem report without JWT', async () => {
    const res = await request
      .post('/api/tickets')
      .send({
        systemNumber: 'LAB1-PC05',
        category: 'Hardware',
        description: 'Mouse scroll wheel is not responding properly.',
        studentName: 'Bharani',
        registerNumber: '732224IT013',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('ticketId');
    expect(res.body.data.systemCode).toBe('PC-05');
    expect(res.body.data.category).toBe('Hardware');
    expect(res.body.data.status).toBe('OPEN');
  });

  it('GET /api/tickets should require authentication', async () => {
    const res = await request.get('/api/tickets');
    expect(res.status).toBe(401);
  });

  it('GET /api/tickets should allow ADMIN and FACULTY to list tickets', async () => {
    // Create a ticket first
    await request
      .post('/api/tickets')
      .send({
        systemNumber: 'LAB1-PC05',
        category: 'Hardware',
        description: 'Keyboard key stuck.',
      });

    const res = await request
      .get('/api/tickets')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0]).toHaveProperty('ticketId');
  });

  it('PATCH /api/tickets/:id/status should allow staff to update status to RESOLVED', async () => {
    // Create a ticket first
    const createRes = await request
      .post('/api/tickets')
      .send({
        systemNumber: 'LAB1-PC05',
        category: 'Network',
        description: 'Ethernet cable loose.',
      });

    const ticketId = createRes.body.data.id;

    const res = await request
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ status: 'RESOLVED' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('RESOLVED');
    expect(res.body.data.resolvedAt).toBeDefined();
  });
});
