'use strict';

const { request, prisma } = require('../setup/testServer');

describe('4. Health API Tests', () => {
  it('GET /api/health should return 200 and healthy status', async () => {
    const res = await request.get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('server', 'ok');
    expect(res.body.data).toHaveProperty('database', 'ok');
    expect(res.body.data).toHaveProperty('timestamp');
  });

  it('GET /api/health should return 503 when database query fails', async () => {
    const originalQueryRaw = prisma.$queryRaw;
    prisma.$queryRaw = jest.fn().mockRejectedValue(new Error('Connection lost'));

    const res = await request.get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code', 'DATABASE_UNAVAILABLE');

    prisma.$queryRaw = originalQueryRaw;
  });

  it('GET /api/nonexistent-route should return 404 with standardized error', async () => {
    const res = await request.get('/api/nonexistent-route');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
  });
});
