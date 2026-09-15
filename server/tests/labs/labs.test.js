'use strict';

const { request } = require('../setup/testServer');

describe('Labs Endpoint Tests (GET /api/labs)', () => {
  it('GET /api/labs should return lab configurations', async () => {
    const res = await request.get('/api/labs');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('labs');
    expect(Array.isArray(res.body.data.labs)).toBe(true);
    expect(res.body.data.labs.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.labs[0]).toHaveProperty('id');
    expect(res.body.data.labs[0]).toHaveProperty('name');
  });
});
